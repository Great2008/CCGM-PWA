import { useState } from 'react'

/**
 * ShareButton — uses Web Share API on mobile, falls back to clipboard copy on desktop.
 *
 * Props:
 *   title    — content title
 *   text     — short description / excerpt
 *   url      — URL to share (defaults to current page)
 *   imageUrl — optional image to attach to the share (best-effort: only works
 *              where the browser supports file-sharing AND the image's host
 *              allows cross-origin fetching; silently falls back to a
 *              link-only share otherwise)
 *   label    — button label (default: 'Share')
 *   variant  — 'icon-only' | 'full' (default: 'full')
 *   suffix   — line appended after `text` (default: 'Read more on CCG World')
 *   style    — extra inline styles for the button
 */

// Best-effort: fetch an image URL and wrap it as a File for navigator.share({files}).
// Returns null on any failure (CORS block, network error, unsupported), so callers
// can gracefully fall back to a link-only share.
async function tryBuildImageFile(imageUrl) {
  if (!imageUrl) return null
  try {
    const res = await fetch(imageUrl, { mode: 'cors' })
    if (!res.ok) { console.warn('[ShareButton] image fetch failed:', res.status, imageUrl); return null }
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) { console.warn('[ShareButton] fetched content is not an image:', blob.type, imageUrl); return null }
    const ext = (blob.type.split('/')[1] || 'jpg').split('+')[0]
    const file = new File([blob], `event-image.${ext}`, { type: blob.type })
    if (navigator.canShare && navigator.canShare({ files: [file] })) return file
    console.warn('[ShareButton] navigator.canShare rejected the file — file-sharing likely unsupported on this browser/device')
    return null
  } catch (err) {
    // Almost always a CORS block: the image host didn't send an
    // Access-Control-Allow-Origin header, so the browser refuses to let us
    // read the bytes. Nothing wrong with the URL itself — falls back to a
    // link-only share, which is expected behavior for hosts without CORS.
    console.warn('[ShareButton] could not fetch image for sharing (likely CORS):', err.message, imageUrl)
    return null
  }
}

export default function ShareButton({ title, text, url, imageUrl, label = 'Share', variant = 'full', suffix = 'Read more on CCG World', style: extraStyle = {} }) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const shareUrl = url || window.location.href

  const baseShareData = {
    title: title || 'CCG World',
    text: text
      ? `${text}\n\n${suffix}`
      : 'Check this out on CCG World',
    url: shareUrl,
  }

  const handleShare = async (e) => {
    e.stopPropagation()
    if (sharing) return
    setSharing(true)

    try {
      const imageFile = await tryBuildImageFile(imageUrl)
      // Some platforms drop title/url when files are present, but they never
      // error for including them — safe to always pass everything we have.
      const shareData = imageFile ? { ...baseShareData, files: [imageFile] } : baseShareData

      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        // Desktop fallback — copy link to clipboard
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    } catch (err) {
      // User cancelled share — not an error
      if (err.name !== 'AbortError') {
        // Last resort fallback
        try {
          await navigator.clipboard.writeText(shareUrl)
          setCopied(true)
          setTimeout(() => setCopied(false), 2500)
        } catch {}
      }
    } finally {
      setSharing(false)
    }
  }

  const baseStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: variant === 'icon-only' ? '8px' : '8px 16px',
    borderRadius: 30,
    border: '1.5px solid',
    borderColor: copied ? '#22c55e' : 'rgba(255,255,255,0.3)',
    background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.1)',
    color: copied ? '#22c55e' : 'white',
    fontSize: '0.8rem',
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'var(--font-body)',
    transition: 'all 0.2s',
    flexShrink: 0,
    ...extraStyle,
  }

  return (
    <button onClick={handleShare} style={baseStyle} title="Share">
      {copied ? '✅' : '↗'}
      {variant !== 'icon-only' && (
        <span>{copied ? 'Copied!' : label}</span>
      )}
    </button>
  )
}

/**
 * ShareButtonLight — for use on white/light backgrounds (cards, detail panes)
 */
export function ShareButtonLight({ title, text, url, imageUrl, label = 'Share', suffix = 'Read more on CCG World', style: extraStyle = {} }) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const shareUrl = url || window.location.href
  const baseShareData = {
    title: title || 'CCG World',
    text: text ? `${text}\n\n${suffix}` : 'Check this out on CCG World',
    url: shareUrl,
  }

  const handleShare = async (e) => {
    e.stopPropagation()
    if (sharing) return
    setSharing(true)
    try {
      const imageFile = await tryBuildImageFile(imageUrl)
      const shareData = imageFile ? { ...baseShareData, files: [imageFile] } : baseShareData

      if (navigator.share) {
        await navigator.share(shareData)
      } else {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        try {
          await navigator.clipboard.writeText(shareUrl)
          setCopied(true)
          setTimeout(() => setCopied(false), 2500)
        } catch {}
      }
    } finally {
      setSharing(false)
    }
  }

  return (
    <button onClick={handleShare} style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '7px 16px',
      borderRadius: 30,
      border: '1.5px solid',
      borderColor: copied ? '#22c55e' : '#e2e8f0',
      background: copied ? '#f0fdf4' : 'white',
      color: copied ? '#16a34a' : 'var(--text-mid)',
      fontSize: '0.8rem',
      fontWeight: 700,
      cursor: 'pointer',
      fontFamily: 'var(--font-body)',
      transition: 'all 0.2s',
      flexShrink: 0,
      ...extraStyle,
    }} title="Share">
      {copied ? '✅' : '↗'}
      <span>{copied ? 'Copied!' : label}</span>
    </button>
  )
}
