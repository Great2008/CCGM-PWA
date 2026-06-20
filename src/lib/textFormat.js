/**
 * textFormat.js
 * Shared "markdown-lite" parsing used by Sabbath School & Sermons content
 * (both on the public pages and in the Admin live previews), so all four
 * places render identically.
 *
 * Supported syntax:
 *   ## Heading        -> section heading
 *   # Heading         -> sub-heading
 *   **bold text**     -> bold
 *   *italic text*     -> italic
 *   (blank line)      -> paragraph break
 */
import { Fragment } from 'react'

// ── Block-level parsing ──────────────────────────────────────────────────
// Splits raw text into an array of block strings. Headings keep their
// leading '#'/'##' marker; everything else is a joined paragraph.
export function parseBlocks(text) {
  if (!text) return []
  const lines = text.split('\n')
  const blocks = []
  let paraLines = []
  const flushPara = () => {
    const joined = paraLines.join(' ').trim()
    if (joined) blocks.push(joined)
    paraLines = []
  }
  lines.forEach(line => {
    const trimmed = line.trim()
    if (/^##/.test(trimmed) && trimmed.length > 2) { flushPara(); blocks.push(trimmed) }
    else if (/^#/.test(trimmed) && trimmed.length > 1 && !trimmed.startsWith('##')) { flushPara(); blocks.push(trimmed) }
    else if (trimmed === '') { flushPara() }
    else { paraLines.push(trimmed) }
  })
  flushPara()
  return blocks.filter(Boolean)
}

// ── Inline parsing ───────────────────────────────────────────────────────
// Turns a single string into an array of { text, bold?, italic? } tokens.
// **bold** is matched before *italic* so "**x**" isn't read as two italics.
const INLINE_RE = /\*\*(.+?)\*\*|\*(.+?)\*/g

export function parseInline(str) {
  if (!str) return []
  const tokens = []
  let lastIndex = 0
  let match
  INLINE_RE.lastIndex = 0
  while ((match = INLINE_RE.exec(str)) !== null) {
    if (match.index > lastIndex) tokens.push({ text: str.slice(lastIndex, match.index) })
    if (match[1] !== undefined) tokens.push({ text: match[1], bold: true })
    else tokens.push({ text: match[2], italic: true })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < str.length) tokens.push({ text: str.slice(lastIndex) })
  return tokens
}

// Renders **bold**/*italic* markers in a string as React nodes.
export function renderInline(str, keyPrefix = '') {
  return parseInline(str).map((tok, i) => {
    if (tok.bold) return <strong key={keyPrefix + i}>{tok.text}</strong>
    if (tok.italic) return <em key={keyPrefix + i}>{tok.text}</em>
    return <Fragment key={keyPrefix + i}>{tok.text}</Fragment>
  })
}

// Drop-in component for anywhere a plain string is currently rendered.
export function FormattedText({ text }) {
  if (!text) return null
  return <>{renderInline(text)}</>
}

// For contexts that can't render React (share text, PDF fallback, SEO
// descriptions) — strips the markers and returns plain text.
export function stripFormatting(str) {
  if (!str) return ''
  return str.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
}

// ── Shared reading-content renderer ──────────────────────────────────────
// Used by both SabbathSchool.jsx and Sermons.jsx for the main lesson/sermon
// body, so headings/paragraphs/bold/italic look identical in both places.
export function ReadingContent({ blocks, fontSize }) {
  return (
    <div style={{ lineHeight: 1.9, color: 'var(--text-dark)', fontSize: fontSize + 'px' }}>
      {blocks.map((para, i) =>
        /^##/.test(para) ? (
          <h3 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: (fontSize + 4) + 'px', margin: '32px 0 14px', borderBottom: '2px solid var(--brand-pale)', paddingBottom: 6 }}>
            {renderInline(para.replace(/^##\s*/, ''))}
          </h3>
        ) : /^#/.test(para) ? (
          <h4 key={i} style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-light)', fontSize: (fontSize + 2) + 'px', margin: '22px 0 10px', fontWeight: 700 }}>
            {renderInline(para.replace(/^#\s*/, ''))}
          </h4>
        ) : (
          <p key={i} style={{ marginBottom: 20 }}>{renderInline(para)}</p>
        )
      )}
    </div>
  )
}
