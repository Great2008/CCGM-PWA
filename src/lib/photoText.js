// src/lib/photoText.js
// Helps admins write captions that work as image descriptions for Google and screen readers.
// True when the text looks like a camera file name or an id instead of a description.
export function looksLikeFilename(text) {
  const t = String(text || '').trim()
  if (!t) return false
  return /^(img|dsc|dscn|image|photo|pxl|mvimg|screenshot|vid)[-_ ]?\d{3,}([-_ .]?\d+)*(\.\w{2,4})?$/i.test(t)   // IMG_2034, DSC01234.jpg
    || /^whatsapp image\b/i.test(t)
    || /\.(jpe?g|png|webp|gif|heic)$/i.test(t)                                                                  // anything ending .jpg
    || /^[a-f0-9-]{24,}$/i.test(t)                                                                              // uuid-like ids
    || /^\d{6,}$/.test(t)                                                                                       // 20260412103045
}

// Catches links that are a web PAGE, not the picture itself. Returns '' when the link is fine,
// otherwise a short message for the admin. (ImgBB gives out two kinds of link: the "viewer" page
// https://ibb.co/abc123 and the "direct link" https://i.ibb.co/abc123/photo.jpg. Only the second works.)
export function imageLinkProblem(url) {
  const u = String(url || '').trim()
  if (!u) return ''
  if (!/^https?:\/\//i.test(u)) return 'The link must start with https://'
  let host = ''
  try { host = new URL(u).hostname.toLowerCase() } catch { return 'This doesn’t look like a valid link.' }
  if (host === 'ibb.co' || host === 'www.ibb.co') {
    return 'This is an ImgBB page link, not the picture itself. On ImgBB, copy the “Direct link” instead: it starts with https://i.ibb.co/ and ends in .jpg or .png.'
  }
  return ''
}
