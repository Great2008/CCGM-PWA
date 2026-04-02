from http.server import BaseHTTPRequestHandler
import json
import os
import urllib.request
import urllib.parse

# ─── Config ─────────────────────────────────────────────────────────────────

YT_API_KEY    = os.environ.get('YOUTUBE_API_KEY', '')
YT_CHANNEL_ID = os.environ.get('YOUTUBE_CHANNEL_ID', '')
YT_BASE       = 'https://www.googleapis.com/youtube/v3'

MAX_RESULTS   = 24   # videos per page
MAX_PLAYLISTS = 12


# ─── YouTube helpers ─────────────────────────────────────────────────────────

def yt_get(path: str, params: dict) -> dict:
    """GET from YouTube Data API v3. Raises on HTTP error."""
    params['key'] = YT_API_KEY
    url = f"{YT_BASE}/{path}?{urllib.parse.urlencode(params)}"
    with urllib.request.urlopen(url, timeout=8) as r:
        return json.loads(r.read())


def get_uploads_playlist_id() -> str | None:
    """Resolve a channel's uploads playlist ID from its channel ID."""
    data = yt_get('channels', {
        'part': 'contentDetails',
        'id': YT_CHANNEL_ID,
    })
    items = data.get('items', [])
    if not items:
        return None
    return items[0]['contentDetails']['relatedPlaylists']['uploads']


def get_video_details(video_ids: list[str]) -> dict:
    """Fetch duration + viewCount for a list of video IDs."""
    if not video_ids:
        return {}
    data = yt_get('videos', {
        'part': 'contentDetails,statistics',
        'id': ','.join(video_ids),
    })
    return {
        item['id']: {
            'duration': item['contentDetails'].get('duration', ''),
            'views':    item['statistics'].get('viewCount', ''),
        }
        for item in data.get('items', [])
    }


def fetch_videos() -> list[dict]:
    """Return latest videos from the channel uploads playlist."""
    uploads_id = get_uploads_playlist_id()
    if not uploads_id:
        return []

    data = yt_get('playlistItems', {
        'part':       'snippet',
        'playlistId': uploads_id,
        'maxResults': MAX_RESULTS,
    })

    items = data.get('items', [])
    video_ids = [
        i['snippet']['resourceId']['videoId']
        for i in items
        if i['snippet'].get('resourceId', {}).get('kind') == 'youtube#video'
    ]

    details = get_video_details(video_ids)

    result = []
    for item in items:
        s  = item['snippet']
        vid = s.get('resourceId', {}).get('videoId', '')
        thumbs = s.get('thumbnails', {})
        thumb  = (thumbs.get('high') or thumbs.get('medium') or thumbs.get('default') or {}).get('url', '')
        d = details.get(vid, {})
        result.append({
            'id':          vid,
            'title':       s.get('title', ''),
            'thumbnail':   thumb,
            'publishedAt': s.get('publishedAt', ''),
            'description': s.get('description', '')[:200],
            'duration':    d.get('duration', ''),
            'views':       d.get('views', ''),
            'type':        'video',
            'isLive':      False,
        })

    return result


def fetch_playlists() -> list[dict]:
    """Return the channel's public playlists."""
    data = yt_get('playlists', {
        'part':       'snippet,contentDetails',
        'channelId':  YT_CHANNEL_ID,
        'maxResults': MAX_PLAYLISTS,
    })

    result = []
    for item in data.get('items', []):
        s      = item['snippet']
        thumbs = s.get('thumbnails', {})
        thumb  = (thumbs.get('high') or thumbs.get('medium') or thumbs.get('default') or {}).get('url', '')
        result.append({
            'id':          item['id'],
            'title':       s.get('title', ''),
            'description': s.get('description', '')[:200],
            'thumbnail':   thumb,
            'publishedAt': s.get('publishedAt', ''),
            'itemCount':   item.get('contentDetails', {}).get('itemCount', 0),
            'type':        'playlist',
        })

    return result


def fetch_live() -> list[dict]:
    """Return currently live or upcoming streams on the channel."""
    result = []
    for event_type in ('live', 'upcoming'):
        data = yt_get('search', {
            'part':       'snippet',
            'channelId':  YT_CHANNEL_ID,
            'eventType':  event_type,
            'type':       'video',
            'maxResults': 6,
        })
        for item in data.get('items', []):
            s      = item['snippet']
            vid    = item['id'].get('videoId', '')
            thumbs = s.get('thumbnails', {})
            thumb  = (thumbs.get('high') or thumbs.get('medium') or thumbs.get('default') or {}).get('url', '')
            result.append({
                'id':          vid,
                'title':       s.get('title', ''),
                'thumbnail':   thumb,
                'publishedAt': s.get('publishedAt', ''),
                'description': s.get('description', '')[:200],
                'type':        'video',
                'isLive':      event_type == 'live',
                'isUpcoming':  event_type == 'upcoming',
            })

    return result


# ─── CORS / response helpers ─────────────────────────────────────────────────

CORS_HEADERS = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
}


def ok(data: dict | list) -> tuple:
    return 200, json.dumps(data)


def err(msg: str, status: int = 500) -> tuple:
    return status, json.dumps({'error': msg})


# ─── Request handler ─────────────────────────────────────────────────────────

class handler(BaseHTTPRequestHandler):

    def _send(self, status: int, body: str):
        self.send_response(status)
        for k, v in CORS_HEADERS.items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body.encode())

    def do_OPTIONS(self):
        self._send(204, '')

    def do_GET(self):
        path = self.path.split('?')[0].rstrip('/')

        # ── YouTube routes ───────────────────────────────────────────
        if path == '/api/youtube/videos':
            if not YT_API_KEY or not YT_CHANNEL_ID:
                self._send(*err('YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID not set', 503))
                return
            try:
                items = fetch_videos()
                self._send(*ok({'items': items}))
            except Exception as e:
                self._send(*err(str(e)))
            return

        if path == '/api/youtube/playlists':
            if not YT_API_KEY or not YT_CHANNEL_ID:
                self._send(*err('YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID not set', 503))
                return
            try:
                items = fetch_playlists()
                self._send(*ok({'items': items}))
            except Exception as e:
                self._send(*err(str(e)))
            return

        if path == '/api/youtube/live':
            if not YT_API_KEY or not YT_CHANNEL_ID:
                self._send(*err('YOUTUBE_API_KEY or YOUTUBE_CHANNEL_ID not set', 503))
                return
            try:
                items = fetch_live()
                self._send(*ok({'items': items}))
            except Exception as e:
                self._send(*err(str(e)))
            return

        # ── Health check ─────────────────────────────────────────────
        if path == '/api':
            self._send(*ok({'status': 'ok'}))
            return

        self._send(*err('Not found', 404))

    def log_message(self, *args):
        pass  # suppress Vercel log noise
