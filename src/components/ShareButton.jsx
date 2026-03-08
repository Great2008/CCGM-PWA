import { useState } from 'react'

/**
 * ShareButton — uses Web Share API on mobile, falls back to clipboard copy on desktop.
 *
 * Props:
 *   title   — content title
 *   text    — short description / excerpt
 *   url     — URL to share (defaults to current page)
 *   label   — button label (default: 'Share')
 *   variant — 'icon-only' | 'full' (default: 'full')
 *   style   — extra inline styles for the button
 */
export default function ShareButton({ title, text, url, label = 'Share', variant = 'full', style: extraStyle = {} }) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const shareUrl = url || window.location.href

  const shareData = {
    title: title || 'CCG World',
    text: text
      ? `${text}\n\nRead more on CCG World`
      : 'Check this out on CCG World',
    url: shareUrl,
  }

  const handleShare = async (e) => {
    e.stopPropagation()
    if (sharing) return
    setSharing(true)

    try {
      // Use native share sheet if available (mobile PWA / Android / iOS)
      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        await navigator.share(shareData)
      } else if (navigator.share) {
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
export function ShareButtonLight({ title, text, url, label = 'Share', style: extraStyle = {} }) {
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const shareUrl = url || window.location.href
  const shareData = {
    title: title || 'CCG World',
    text: text ? `${text}\n\nRead more on CCG World` : 'Check this out on CCG World',
    url: shareUrl,
  }

  const handleShare = async (e) => {
    e.stopPropagation()
    if (sharing) return
    setSharing(true)
    try {
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
