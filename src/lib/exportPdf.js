/**
 * exportPdf.js
 * Client-side PDF generation for Sabbath School lessons and Sermons,
 * using the jsPDF dependency already in package.json. Understands the
 * same "## heading / # sub-heading / **bold** / *italic*" syntax as
 * textFormat.js, so the PDF matches what's on screen.
 *
 * Supports a font selector. jsPDF only ships Helvetica/Times/Courier
 * without embedding, so the other choices are embedded as real TTF data,
 * loaded on demand via dynamic import (each is its own bundle chunk, so
 * picking the default font costs nothing extra):
 *   - "Times New Roman" → Liberation Serif (open-license, metric-identical
 *     substitute — same project LibreOffice uses for Times New Roman)
 *   - "Cambria"          → Caladea (open-license, metric-identical
 *     substitute for Cambria)
 *   - "Georgia"          → DejaVu Serif (closest available open-license
 *     approximation — not a precise metric match, but the same warm,
 *     readable serif family)
 */
import jsPDF from 'jspdf'
import { parseBlocks, parseInline } from './textFormat'

const MARGIN = 18 // mm
const PAGE_W = 210
const PAGE_H = 297
const CONTENT_W = PAGE_W - MARGIN * 2

const BRAND = '#0f7a3d'
const BRAND_LIGHT = '#2f8f55'
const GOLD = '#b8860b'
const TEXT = '#222222'
const MUTED = '#6b7280'
const RULE = '#bbf7d0'

function slugify(str) {
  return (str || 'document')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 60) || 'document'
}

// ── Font selector ──────────────────────────────────────────────────────────
// Options shown in the UI dropdown. `value` is what's passed to the export
// functions and persisted in localStorage by the page components.
export const PDF_FONT_OPTIONS = [
  { value: 'helvetica',        label: 'Helvetica (Classic, fastest)' },
  { value: 'times-new-roman',  label: 'Times New Roman' },
  { value: 'cambria',          label: 'Cambria' },
  { value: 'georgia',          label: 'Georgia' },
]

const FONT_REGISTRY = {
  helvetica:       { family: 'helvetica', builtin: true },
  'times-new-roman': { family: 'LiberationSerif', builtin: false, fileBase: 'LiberationSerif', loader: () => import('./fonts/timesNewRomanFont.js') },
  cambria:         { family: 'Caladea', builtin: false, fileBase: 'Caladea', loader: () => import('./fonts/cambriaFont.js') },
  georgia:         { family: 'DejaVuSerif', builtin: false, fileBase: 'DejaVuSerif', loader: () => import('./fonts/georgiaFont.js') },
}

// Registers the chosen font's 4 styles (normal/bold/italic/bolditalic) into
// this jsPDF document's virtual file system, and returns the family name to
// pass to setFont(). No-op (and no network/bundle cost) for "helvetica".
async function registerFont(doc, fontKey) {
  const entry = FONT_REGISTRY[fontKey] || FONT_REGISTRY.helvetica
  if (entry.builtin) return entry.family
  const mod = await entry.loader()
  ;[
    ['normal', 'normal'],
    ['bold', 'bold'],
    ['italic', 'italic'],
    ['bolditalic', 'bolditalic'],
  ].forEach(([dataKey, jspdfStyle]) => {
    const fileName = `${entry.fileBase}-${dataKey}.ttf`
    doc.addFileToVFS(fileName, mod[dataKey])
    doc.addFont(fileName, entry.family, jspdfStyle)
  })
  return entry.family
}

// ── Low-level writer: handles pagination + inline bold/italic word-wrap ──
class PdfWriter {
  constructor(doc, fontFamily = 'helvetica') {
    this.doc = doc
    this.y = MARGIN
    this.fontFamily = fontFamily
  }

  ensureSpace(h) {
    if (this.y + h > PAGE_H - MARGIN - 8) {
      this.doc.addPage()
      this.y = MARGIN
    }
  }

  setFontFor(bold, italic, size) {
    let style = 'normal'
    if (bold && italic) style = 'bolditalic'
    else if (bold) style = 'bold'
    else if (italic) style = 'italic'
    this.doc.setFont(this.fontFamily, style)
    this.doc.setFontSize(size)
  }

  spaceWidth(size) {
    this.doc.setFont(this.fontFamily, 'normal')
    this.doc.setFontSize(size)
    return this.doc.getTextWidth(' ')
  }

  writeWordsLine(words, x, size, color) {
    this.doc.setTextColor(color)
    let cx = x
    const sw = this.spaceWidth(size)
    words.forEach((w, i) => {
      if (i > 0) cx += sw
      this.setFontFor(w.bold, w.italic, size)
      this.doc.text(w.text, cx, this.y)
      cx += this.doc.getTextWidth(w.text)
    })
  }

  // Parses **bold**/*italic* in rawText, word-wraps it to the content
  // width (minus indent), and writes it line by line with pagination.
  writeParagraph(rawText, { size = 11, lineHeight = 6, color = TEXT, indent = 0, gapAfter = 4 } = {}) {
    if (!rawText) return
    const tokens = parseInline(rawText)
    const words = []
    tokens.forEach(tok => {
      tok.text.split(/\s+/).forEach(w => {
        if (w) words.push({ text: w, bold: tok.bold, italic: tok.italic })
      })
    })
    if (!words.length) return

    const maxW = CONTENT_W - indent
    const sw = this.spaceWidth(size)
    let line = []
    let lineWidth = 0

    const flush = () => {
      if (!line.length) return
      this.ensureSpace(lineHeight)
      this.writeWordsLine(line, MARGIN + indent, size, color)
      this.y += lineHeight
      line = []
      lineWidth = 0
    }

    words.forEach(w => {
      this.setFontFor(w.bold, w.italic, size)
      const wWidth = this.doc.getTextWidth(w.text)
      const prospective = lineWidth + (line.length ? sw : 0) + wWidth
      if (prospective > maxW && line.length) {
        flush()
        lineWidth = wWidth
        line.push(w)
      } else {
        lineWidth = prospective
        line.push(w)
      }
    })
    flush()
    this.y += gapAfter
  }

  writeMeta(parts) {
    const text = parts.filter(Boolean).join('   •   ')
    if (!text) return
    this.ensureSpace(8)
    this.doc.setFont(this.fontFamily, 'normal')
    this.doc.setFontSize(9.5)
    this.doc.setTextColor(MUTED)
    this.doc.text(text, MARGIN, this.y)
    this.y += 9
  }

  writeDivider(color = RULE) {
    this.ensureSpace(6)
    this.doc.setDrawColor(color)
    this.doc.setLineWidth(0.5)
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y)
    this.y += 7
  }

  writeSectionHeading(text) {
    this.ensureSpace(16)
    this.y += 3
    this.doc.setFont(this.fontFamily, 'bold')
    this.doc.setFontSize(13.5)
    this.doc.setTextColor(BRAND)
    this.doc.text(text, MARGIN, this.y)
    this.y += 2.5
    this.doc.setDrawColor(RULE)
    this.doc.setLineWidth(0.5)
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y)
    this.y += 8
  }

  // Renders body text containing ##/#/blank-line/bold/italic markup.
  writeBlocks(rawText, { size = 11 } = {}) {
    parseBlocks(rawText).forEach(b => {
      if (/^##/.test(b)) {
        this.ensureSpace(11)
        this.y += 2
        this.doc.setFont(this.fontFamily, 'bold')
        this.doc.setFontSize(size + 2.5)
        this.doc.setTextColor(BRAND)
        this.doc.text(b.replace(/^##\s*/, ''), MARGIN, this.y)
        this.y += 7.5
      } else if (/^#/.test(b)) {
        this.ensureSpace(9)
        this.y += 1
        this.doc.setFont(this.fontFamily, 'bold')
        this.doc.setFontSize(size + 1)
        this.doc.setTextColor(BRAND_LIGHT)
        this.doc.text(b.replace(/^#\s*/, ''), MARGIN, this.y)
        this.y += 6.5
      } else {
        this.writeParagraph(b, { size, lineHeight: 6, color: TEXT })
      }
    })
  }

  writeNumberedList(rawText, { size = 11 } = {}) {
    rawText.split('\n').map(s => s.trim()).filter(Boolean).forEach((item, i) => {
      const clean = item.replace(/^\d+\.\s*/, '')
      this.writeParagraph(`${i + 1}. ${clean}`, { size, lineHeight: 6, gapAfter: 3 })
    })
    this.y += 2
  }

  writeKeyValue(label, value, { size = 10.5 } = {}) {
    if (!value) return
    this.ensureSpace(7)
    this.doc.setFont(this.fontFamily, 'bold')
    this.doc.setFontSize(size - 1)
    this.doc.setTextColor(GOLD)
    this.doc.text(label.toUpperCase(), MARGIN, this.y)
    this.y += 5
    this.writeParagraph(value, { size, lineHeight: 6, gapAfter: 5 })
  }
}

function writeMasthead(writer, doc, kicker) {
  doc.setFont(writer.fontFamily, 'bold')
  doc.setFontSize(10)
  doc.setTextColor(BRAND)
  doc.text('CCG WORLD', MARGIN, writer.y)
  if (kicker) {
    doc.setFont(writer.fontFamily, 'normal')
    doc.setTextColor(MUTED)
    doc.text(kicker, PAGE_W - MARGIN, writer.y, { align: 'right' })
  }
  writer.y += 6
  doc.setDrawColor(BRAND)
  doc.setLineWidth(0.8)
  doc.line(MARGIN, writer.y, PAGE_W - MARGIN, writer.y)
  writer.y += 10
}

function writeFooter(doc, fontFamily) {
  const total = doc.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont(fontFamily, 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(MUTED)
    doc.text('CCG World — Christian Church of God Mission', MARGIN, PAGE_H - 10)
    doc.text(`Page ${p} of ${total}`, PAGE_W - MARGIN, PAGE_H - 10, { align: 'right' })
  }
}

function fmtDate(d) {
  if (!d) return ''
  try { return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) }
  catch { return d }
}

// ── Public exports ────────────────────────────────────────────────────────
// Both now async (font registration is a dynamic import) — callers should
// `await` them, though jsPDF's doc.save() still fires automatically once
// the returned promise resolves either way.

export async function exportSabbathLessonPDF(lesson, { fontFamily = 'helvetica' } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const family = await registerFont(doc, fontFamily)
  const writer = new PdfWriter(doc, family)

  writeMasthead(writer, doc, 'Sabbath School')

  if (lesson.quarter) {
    doc.setFont(family, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(GOLD)
    doc.text(lesson.quarter.toUpperCase(), MARGIN, writer.y)
    writer.y += 7
  }

  writer.writeParagraph(`**${lesson.title || 'Sabbath School Lesson'}**`, { size: 18, lineHeight: 8, color: BRAND, gapAfter: 3 })

  writer.writeMeta([
    fmtDate(lesson.lesson_date),
    lesson.author && `By ${lesson.author}`,
    lesson.scripture && `Reading: ${lesson.scripture}`,
  ])
  writer.writeDivider()

  if (lesson.summary) writer.writeParagraph(`*${lesson.summary}*`, { size: 11, lineHeight: 6, color: BRAND, gapAfter: 6 })

  if (lesson.body) writer.writeBlocks(lesson.body)
  else if (lesson.pdf_url) writer.writeParagraph(`This lesson is available as a PDF download: ${lesson.pdf_url}`, { size: 10.5, color: MUTED })

  if (lesson.discussion_questions) {
    writer.writeSectionHeading('Discussion Questions')
    writer.writeNumberedList(lesson.discussion_questions)
  }

  if (lesson.analysis || lesson.analysis_points) {
    writer.writeSectionHeading('Detailed Analysis')
    if (lesson.analysis) writer.writeBlocks(lesson.analysis)
    if (lesson.analysis_points) {
      writer.y += 2
      doc.setFont(family, 'bold')
      doc.setFontSize(11.5)
      doc.setTextColor(BRAND)
      writer.ensureSpace(10)
      doc.text('Key Points', MARGIN, writer.y)
      writer.y += 7
      writer.writeNumberedList(lesson.analysis_points)
    }
  }

  const hasService = lesson.divine_message_title || lesson.divine_message_speaker || lesson.evening_title || lesson.evening_speaker
  if (hasService) {
    writer.writeSectionHeading('Divine Service')
    if (lesson.divine_message_title || lesson.divine_message_speaker) {
      doc.setFont(family, 'bold'); doc.setFontSize(10.5); doc.setTextColor(BRAND)
      writer.ensureSpace(7)
      doc.text('Morning Service', MARGIN, writer.y); writer.y += 6
      writer.writeKeyValue('Sermon Title', lesson.divine_message_title)
      writer.writeKeyValue('Preacher', lesson.divine_message_speaker)
      writer.writeKeyValue('Scripture', lesson.divine_message_scripture)
      writer.writeKeyValue('Notes', lesson.divine_message_notes)
    }
    if (lesson.evening_title || lesson.evening_speaker) {
      doc.setFont(family, 'bold'); doc.setFontSize(10.5); doc.setTextColor(BRAND)
      writer.ensureSpace(7)
      doc.text('Evening Service', MARGIN, writer.y); writer.y += 6
      writer.writeKeyValue('Sermon Title', lesson.evening_title)
      writer.writeKeyValue('Preacher', lesson.evening_speaker)
      writer.writeKeyValue('Scripture', lesson.evening_scripture)
      writer.writeKeyValue('Notes', lesson.evening_notes)
    }
  }

  writeFooter(doc, family)
  doc.save(`sabbath-school-${slugify(lesson.title)}.pdf`)
}

export async function exportSermonPDF(sermon, { fontFamily = 'helvetica' } = {}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const family = await registerFont(doc, fontFamily)
  const writer = new PdfWriter(doc, family)

  writeMasthead(writer, doc, 'Sermons')

  if (sermon.series) {
    doc.setFont(family, 'bold')
    doc.setFontSize(9)
    doc.setTextColor(GOLD)
    doc.text(sermon.series.toUpperCase(), MARGIN, writer.y)
    writer.y += 7
  }

  writer.writeParagraph(`**${sermon.title || 'Sermon'}**`, { size: 18, lineHeight: 8, color: BRAND, gapAfter: 3 })

  writer.writeMeta([
    sermon.date,
    sermon.pastor && `${sermon.pastor}`,
    sermon.scripture && `${sermon.scripture}`,
    sermon.duration,
  ])
  writer.writeDivider()

  if (sermon.description) writer.writeParagraph(`*${sermon.description}*`, { size: 11, lineHeight: 6, color: BRAND, gapAfter: 6 })

  if (sermon.body) writer.writeBlocks(sermon.body)
  else if (!sermon.description) writer.writeParagraph('No notes available for this sermon.', { size: 10.5, color: MUTED })

  if (sermon.videoUrl) writer.writeKeyValue('Watch Online', sermon.videoUrl)
  if (sermon.audioUrl) writer.writeKeyValue('Listen Online', sermon.audioUrl)

  writeFooter(doc, family)
  doc.save(`sermon-${slugify(sermon.title)}.pdf`)
}
