// Canonical production URL. Use this instead of window.location.origin for
// anything shared outside the app (share sheets, QR codes, printed
// certificates) — window.location.origin resolves to whatever host the app
// happens to be running on (localhost in dev, a Vercel preview URL, etc.),
// which is wrong for a link a recipient will actually open.
export const APP_URL = 'https://ccgm-pwa.vercel.app'
