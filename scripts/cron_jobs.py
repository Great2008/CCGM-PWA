#!/usr/bin/env python3
"""
CCG World scheduled jobs (replaces Supabase pg_cron + edge functions).

Usage:
    python scripts/cron_jobs.py dispatch   # send due scheduled push notifications
    python scripts/cron_jobs.py podcast    # generate today's podcast audio

Runs on GitHub Actions (.github/workflows/cron.yml). All secrets come from
environment variables (GitHub repo secrets) -- nothing is hardcoded.
"""
import asyncio
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from urllib.parse import quote

import requests

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

VAPID_PRIVATE_KEY = os.environ.get("VAPID_PRIVATE_KEY", "")
VAPID_SUBJECT = os.environ.get("VAPID_SUBJECT", "mailto:info@ccgworld.org")
FIREBASE_PROJECT = os.environ.get("FIREBASE_PROJECT_ID", "")
FIREBASE_SA_JSON = os.environ.get("FIREBASE_SERVICE_ACCOUNT", "")

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Supabase REST helpers (plain PostgREST, no extra SDK) ────────────────────
def rest(method: str, path: str, **kw) -> requests.Response:
    extra = kw.pop("headers", {})
    r = requests.request(
        method, f"{SUPABASE_URL}/rest/v1/{path}",
        headers={**HEADERS, **extra}, timeout=30, **kw,
    )
    if not r.ok:
        raise RuntimeError(f"{method} {path.split('?')[0]} -> {r.status_code}: {r.text[:300]}")
    return r


def fetch_all(table: str) -> list[dict]:
    """Page through a table (PostgREST caps responses at ~1000 rows)."""
    rows, start, size = [], 0, 1000
    while True:
        r = rest("GET", f"{table}?select=*",
                 headers={"Range-Unit": "items", "Range": f"{start}-{start + size - 1}"})
        batch = r.json()
        rows += batch
        if len(batch) < size:
            return rows
        start += size


# ── Push senders ─────────────────────────────────────────────────────────────
_fcm_token = None


def fcm_access_token() -> str:
    global _fcm_token
    if _fcm_token is None:
        from google.oauth2 import service_account
        from google.auth.transport.requests import Request
        creds = service_account.Credentials.from_service_account_info(
            json.loads(FIREBASE_SA_JSON),
            scopes=["https://www.googleapis.com/auth/firebase.messaging"],
        )
        creds.refresh(Request())
        _fcm_token = creds.token
    return _fcm_token


def send_fcm(token: str, p: dict) -> tuple[bool, str]:
    try:
        r = requests.post(
            f"https://fcm.googleapis.com/v1/projects/{FIREBASE_PROJECT}/messages:send",
            headers={"Authorization": f"Bearer {fcm_access_token()}"},
            json={"message": {
                "token": token,
                "notification": {"title": p["title"], "body": p["body"]},
                "android": {"notification": {
                    "click_action": "FLUTTER_NOTIFICATION_CLICK",
                    "channel_id": "ccg_world", "icon": "ic_launcher", "color": "#0f1f3d",
                }},
                "data": {"url": p.get("url") or "/", "tag": p.get("tag") or "general"},
            }},
            timeout=20,
        )
        if r.status_code in (404, 410) or "UNREGISTERED" in r.text:
            return False, "expired"
        return (True, "") if r.ok else (False, r.text[:200])
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def send_webpush(sub: dict, payload: dict) -> tuple[bool, str]:
    from pywebpush import webpush, WebPushException
    try:
        webpush(
            subscription_info={"endpoint": sub["endpoint"],
                               "keys": {"p256dh": sub["p256dh"], "auth": sub["auth"]}},
            data=json.dumps(payload),
            vapid_private_key=VAPID_PRIVATE_KEY,
            vapid_claims={"sub": VAPID_SUBJECT},
            ttl=86400,
        )
        return True, ""
    except WebPushException as e:
        status = getattr(e.response, "status_code", 0)
        if status in (404, 410):
            return False, "expired"
        return False, f"HTTP {status}: {str(e)[:200]}"
    except Exception as e:  # noqa: BLE001
        return False, str(e)


def send_via_edge(subs: list[dict], payload: dict) -> dict:
    """Delegate to the existing Supabase `send-push` edge function, which already
    holds the VAPID + Firebase secrets (and cleans up expired subscriptions)."""
    r = requests.post(
        f"{SUPABASE_URL}/functions/v1/send-push", headers=HEADERS,
        json={"subscriptions": subs, "payload": payload}, timeout=120,
    )
    body = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if not r.ok:
        raise RuntimeError(body.get("error") or f"send-push failed ({r.status_code})")
    return {"delivered": body.get("delivered", 0), "failed": body.get("failed", 0),
            "expired": body.get("expired", 0)}


def send_to_all(subs: list[dict], payload: dict) -> dict:
    # No VAPID key in GitHub secrets -> use the edge function instead.
    if not VAPID_PRIVATE_KEY:
        return send_via_edge(subs, payload)
    delivered = failed = 0
    expired = []
    for sub in subs:
        is_fcm = sub.get("p256dh") == "fcm" or sub.get("auth") == "fcm"
        ok, err = send_fcm(sub["endpoint"], payload) if is_fcm else send_webpush(sub, payload)
        if ok:
            delivered += 1
        else:
            failed += 1
            print(f"  push failed [{'FCM' if is_fcm else 'VAPID'}] {sub['endpoint'][:50]}: {err}")
            if err == "expired" and not is_fcm:
                expired.append(sub["endpoint"])
    for ep in expired:  # clean up dead web-push subscriptions
        rest("DELETE", f"push_subscriptions?endpoint=eq.{quote(ep, safe='')}")
    return {"delivered": delivered, "failed": failed, "expired": len(expired)}


# ── Job 1: dispatch scheduled notifications ──────────────────────────────────
def dispatch() -> None:
    # ATOMIC claim: flips pending -> processing and returns only the rows this run
    # claimed, so two overlapping runs can never double-send. One light query when idle.
    claimed = rest(
        "PATCH",
        f"scheduled_notifications?status=eq.pending&send_at=lte.{quote(now_iso(), safe='')}",
        json={"status": "processing"},
        headers={"Prefer": "return=representation"},
    ).json()

    if not claimed:
        print("Nothing due.")
        return

    subs = fetch_all("push_subscriptions")
    print(f"{len(claimed)} notification(s) due, {len(subs)} subscription(s)")

    for n in claimed:
        payload = {
            "title": n["title"], "body": n["body"], "url": n.get("url") or "/",
            "tag": n.get("tag") or "general", "image": n.get("image") or None,
            "requireInteraction": bool(n.get("require_interaction")),
            "icon": "/icon-192.png", "badge": "/icon-96.png",
        }
        payload = {k: v for k, v in payload.items() if v is not None}
        try:
            res = send_to_all(subs, payload)
            rest("PATCH", f"scheduled_notifications?id=eq.{n['id']}",
                 json={"status": "sent", "sent_at": now_iso()})
            rest("POST", "notification_logs", json={
                "title": n["title"], "body": n["body"], "url": n.get("url"),
                "tag": n.get("tag"), "recipients": len(subs),
                "delivered": res["delivered"], "failed": res["failed"],
                "sent_at": now_iso(), "scheduled": True,
            })
            print(f"  sent {n['id']}: {res}")
        except Exception as e:  # noqa: BLE001
            print(f"  FAILED {n['id']}: {e}")
            rest("PATCH", f"scheduled_notifications?id=eq.{n['id']}",
                 json={"status": "failed", "error": str(e)[:500]})


# ── Job 2: daily podcast audio (edge-tts) ────────────────────────────────────
VOICE = "en-GB-ThomasNeural"
WORDS_PER_MINUTE = 150
MAX_WORDS = 750
MAX_CHARS = 1500


def strip_script(raw: str) -> str:
    raw = re.sub(r"^##?\s*", "", raw, flags=re.M)
    return re.sub(r"\s+", " ", raw.replace("**", "")).strip()


def chunk_text(text: str, max_len: int) -> list[str]:
    sentences = re.findall(r"[^.!?]+[.!?]+(?:\s|$)", text) or [text]
    chunks, cur = [], ""
    for s in sentences:
        if len(cur) + len(s) > max_len and cur:
            chunks.append(cur.strip())
            cur = s
        else:
            cur += s
    if cur.strip():
        chunks.append(cur.strip())
    return chunks


async def synth(text: str) -> bytes:
    import edge_tts
    audio = b""
    async for part in edge_tts.Communicate(text, VOICE).stream():
        if part["type"] == "audio":
            audio += part["data"]
    if len(audio) < 100:
        raise RuntimeError(f"Empty audio for chunk: {text[:40]}...")
    return audio


def podcast(episode_id: str | None = None) -> None:
    if episode_id:
        q = f"podcast_episodes?select=id,title,script&id=eq.{episode_id}"
    else:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        q = (f"podcast_episodes?select=id,title,script&published=eq.true"
             f"&episode_date=eq.{today}&audio_url=is.null")
    rows = rest("GET", q).json()
    if not rows:
        print("No matching episode to process.")
        return
    ep = rows[0]

    script = strip_script(f"{ep['title']}. {ep.get('script') or ''}")
    words = script.split(" ")
    if len(words) > MAX_WORDS:
        script = " ".join(words[:MAX_WORDS]) + "."

    audio = b"".join(asyncio.run(synth(c)) for c in chunk_text(script, MAX_CHARS))

    path = f"{ep['id']}.mp3"
    up = requests.post(
        f"{SUPABASE_URL}/storage/v1/object/podcast-audio/{path}",
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
                 "Content-Type": "audio/mpeg", "x-upsert": "true", "cache-control": "0"},
        data=audio, timeout=120,
    )
    if not up.ok:
        raise RuntimeError(f"Upload failed {up.status_code}: {up.text[:300]}")

    url = f"{SUPABASE_URL}/storage/v1/object/public/podcast-audio/{path}?v={int(time.time() * 1000)}"
    seconds = round(len(script.split(" ")) / WORDS_PER_MINUTE * 60)
    rest("PATCH", f"podcast_episodes?id=eq.{ep['id']}",
         json={"audio_url": url, "duration_seconds": seconds, "status": "ready"})
    print(f"Podcast ready: {url} ({seconds}s)")


if __name__ == "__main__":
    job = sys.argv[1] if len(sys.argv) > 1 else ""
    if job == "dispatch":
        dispatch()
    elif job == "podcast":
        podcast(sys.argv[2] if len(sys.argv) > 2 else None)
    else:
        sys.exit("usage: cron_jobs.py [dispatch|podcast [episode_id]]")
