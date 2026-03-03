"""
CCOGM — Python Serverless API for Vercel
Vercel Python runtime expects a callable `app` (WSGI) or a handler function.
We use a simple WSGI-style approach compatible with Vercel's python3.12 runtime.
"""
import json
from datetime import datetime


def app(scope, receive, send):
    """ASGI-compatible entry point for Vercel Python runtime."""
    pass  # Vercel actually uses the handler below for serverless


def handler(request):
    """
    Vercel Python Serverless Function handler.
    Compatible with Vercel's @vercel/python runtime.
    """
    method = request.method
    path = request.path.rstrip("/")
    headers = {"Content-Type": "application/json", "Access-Control-Allow-Origin": "*"}

    # ── OPTIONS (CORS preflight) ──
    if method == "OPTIONS":
        return Response("", 204, headers)

    # ── GET routes ──
    if method == "GET":
        if path in ("/api", "/api/health"):
            return Response({"status": "ok", "timestamp": datetime.now().isoformat()}, 200, headers)

        if path == "/api/sermons":
            return Response({"sermons": SERMONS}, 200, headers)

        if path.startswith("/api/sermons/"):
            sid = path.split("/")[-1]
            sermon = next((s for s in SERMONS if str(s["id"]) == sid), None)
            return Response(sermon, 200, headers) if sermon else Response({"error": "Not found"}, 404, headers)

        if path == "/api/events":
            return Response({"events": EVENTS}, 200, headers)

        if path == "/api/blog":
            return Response({"posts": BLOG}, 200, headers)

        return Response({"error": "Not found"}, 404, headers)

    # ── POST routes ──
    if method == "POST":
        try:
            body = request.json
        except Exception:
            body = {}

        if path == "/api/contact":
            missing = [f for f in ["name", "email", "message"] if not body.get(f)]
            if missing:
                return Response({"error": f"Missing: {', '.join(missing)}"}, 400, headers)
            # TODO: send_email(body)
            return Response({"success": True, "message": f"Thanks {body['name']}! We'll be in touch."}, 200, headers)

        if path == "/api/prayer":
            missing = [f for f in ["name", "request"] if not body.get(f)]
            if missing:
                return Response({"error": f"Missing: {', '.join(missing)}"}, 400, headers)
            # TODO: notify prayer team
            return Response({"success": True, "message": "Your prayer request has been received. We are with you."}, 200, headers)

        if path == "/api/newsletter":
            email = (body.get("email") or "").strip()
            if not email or "@" not in email:
                return Response({"error": "Valid email required"}, 400, headers)
            # TODO: add to mailing list
            return Response({"success": True, "message": "Subscribed! Daily devotionals are on the way."}, 200, headers)

        return Response({"error": "Not found"}, 404, headers)

    return Response({"error": "Method not allowed"}, 405, headers)


class Response:
    """Minimal response wrapper."""
    def __init__(self, body, status=200, headers=None):
        self.body = json.dumps(body) if not isinstance(body, str) else body
        self.status_code = status
        self.headers = headers or {}


# ── Seed Data (replace with DB queries e.g. Supabase) ──

SERMONS = [
    {
        "id": 1, "title": "Walking in Faith Through Every Storm",
        "pastor": "Pastor John Mensah", "date": "2025-02-16",
        "scripture": "Matthew 14:22-33", "series": "Faith Series",
        "description": "A powerful message about trusting God when life's waves seem insurmountable.",
        "videoUrl": "", "audioUrl": "", "thumbnail": "", "duration": "48 min", "views": 1204,
    },
    {
        "id": 2, "title": "The Power of Prayer and Fasting",
        "pastor": "Pastor Sarah Boateng", "date": "2025-02-09",
        "scripture": "Isaiah 58:6-9", "series": "Prayer Life",
        "description": "Fasting as a spiritual discipline and pathway to breakthrough.",
        "videoUrl": "", "audioUrl": "", "thumbnail": "", "duration": "52 min", "views": 982,
    },
    {
        "id": 3, "title": "God First: Making Him Lord of Everything",
        "pastor": "Pastor Sarah Boateng", "date": "2025-01-26",
        "scripture": "Matthew 6:33", "series": "Kingdom Living",
        "description": "What does it truly mean to put God first in every area of your life?",
        "videoUrl": "", "audioUrl": "", "thumbnail": "", "duration": "50 min", "views": 1430,
    },
]

EVENTS = [
    {
        "id": 1, "title": "Sunday Worship Service",
        "date": "2025-02-23", "time": "9:00 AM & 11:00 AM",
        "location": "Main Sanctuary", "category": "Worship",
        "description": "Weekly Sunday worship. All are welcome.", "recurring": True,
    },
    {
        "id": 2, "title": "Annual Church Convention 2025",
        "date": "2025-03-14", "time": "9:00 AM",
        "location": "Church Main Hall", "category": "Special Event",
        "description": "Three-day revival with guest ministers, worship nights, and breakout sessions.", "recurring": False,
    },
    {
        "id": 3, "title": "Youth Night: Fire & Faith",
        "date": "2025-03-01", "time": "5:00 PM – 8:00 PM",
        "location": "Youth Hall", "category": "Youth",
        "description": "Worship, testimonies, and fellowship for young people aged 13–30.", "recurring": False,
    },
]

BLOG = [
    {
        "id": 1, "title": "Finding Peace in Life's Uncertainties",
        "author": "Pastor John Mensah", "date": "2025-02-18",
        "category": "Devotional", "readTime": "4 min read",
        "excerpt": "God's Word promises a peace that transcends human understanding. Here is how to access it daily.",
    },
    {
        "id": 2, "title": "The Discipline of Gratitude: A 7-Day Challenge",
        "author": "Pastor Sarah Boateng", "date": "2025-02-12",
        "category": "Lifestyle", "readTime": "5 min read",
        "excerpt": "Gratitude is a spiritual discipline that transforms your perspective and draws you closer to God.",
    },
]
