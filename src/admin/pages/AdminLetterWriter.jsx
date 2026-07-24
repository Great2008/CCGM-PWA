import { useState, useEffect, useRef } from 'react'
import { useAdmin } from '../AdminApp'
import supabase from '../../lib/supabase'
import { getContent, setContent } from '../supabase'

async function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'
    i.onload = () => res(i); i.onerror = rej; i.src = src
  })
}
function imgToDataUrl(img) {
  const c = document.createElement('canvas')
  c.width = img.naturalWidth; c.height = img.naturalHeight
  c.getContext('2d').drawImage(img, 0, 0)
  return c.toDataURL('image/png')
}

const BRAND_GREEN   = [10, 38, 18]      // #0a2612 — app navbar green (used for CCG World variant)
const BRAND_ORANGE  = [217, 119, 6]     // #d97706
const CHURCH_GREEN  = [15, 130, 58]     // banner green from the real letterhead
const CHURCH_RED    = [198, 30, 30]     // motto/email/footer red
const REF_LABEL     = [176, 108, 22]    // "Our Ref / Your Ref / Date" orange-brown labels
const CREAM_BG      = [238, 242, 216]
const MINT_BG       = [231, 239, 233]

// ── Draws the header chrome for either letterhead type. Returns the y cursor
//    position where the letter body should start. ──
async function drawHeader(pdf, type, date) {
  const pageW = pdf.internal.pageSize.getWidth()
  const marginX = 42

  if (type === 'ccgworld') {
    // Digital-team letterhead — deliberately distinct from the official church
    // letterhead (no shield, navbar-style branding) so it reads as coming
    // from the tech/ops side, not the pastoral body.
    pdf.setFillColor(...MINT_BG); pdf.rect(0, 0, pageW, 88, 'F')
    pdf.setFillColor(...BRAND_GREEN); pdf.rect(marginX, 40, pageW - marginX*2, 34, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(20); pdf.setTextColor(255,255,255)
    pdf.text('CCG', marginX + 14, 63)
    const ccgW = pdf.getTextWidth('CCG ')
    pdf.setTextColor(...BRAND_ORANGE)
    pdf.text('World', marginX + 14 + ccgW, 63)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(220,230,225)
    pdf.text('DIGITAL MINISTRY TEAM — CHRISTIAN CHURCH OF GOD MISSION', pageW - marginX - 14, 63, { align: 'right' })

    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9.5); pdf.setTextColor(...CHURCH_GREEN)
    pdf.text('Official Digital Correspondence', marginX, 100)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(20,20,20)
    pdf.text('ccgm-pwa.vercel.app', marginX, 114)

    pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9)
    pdf.setTextColor(...CHURCH_GREEN)
    const addrLines = ['CCG World', 'Digital Ministry Team', 'Christian Church of God Mission']
    addrLines.forEach((l, i) => pdf.text(l, pageW - marginX, 100 + i*12, { align: 'right' }))
  } else {
    // Official church letterhead — matches the printed original.
    pdf.setFillColor(...CREAM_BG); pdf.rect(0, 0, pageW, 88, 'F')
    try {
      const logo = await loadImg('/logo.png')
      pdf.addImage(imgToDataUrl(logo), 'PNG', marginX, 18, 88, 88)
    } catch { /* logo optional — continue without it if it fails to load */ }

    const bannerX = marginX + 96
    pdf.setFillColor(...CHURCH_GREEN); pdf.rect(bannerX, 38, pageW - marginX - bannerX, 30, 'F')
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(15); pdf.setTextColor(255,255,255)
    pdf.text('CHRISTIAN CHURCH OF GOD MISSION NIGERIA', bannerX + (pageW - marginX - bannerX)/2, 58, { align: 'center' })

    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10)
    pdf.setTextColor(...CHURCH_RED); pdf.text('MOTTO:', bannerX, 82)
    const mottoW = pdf.getTextWidth('MOTTO: ')
    pdf.setTextColor(...CHURCH_GREEN); pdf.text('GOD FIRST', bannerX + mottoW, 82)
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5); pdf.setTextColor(20,20,20)
    pdf.text('www.ccgmission.org', bannerX, 96)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(...CHURCH_RED)
    pdf.text('E-mail: christianchurchofgodmissionnig@gmail.com', bannerX, 108)

    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...CHURCH_GREEN)
    pdf.text('The Secretariat', pageW - marginX, 84, { align: 'right' })
    pdf.setFont('helvetica', 'normal')
    ;['131 Ahoada Road,', 'P.O. Box 10 Omoku', 'ONELGA, Rivers State, Nigeria'].forEach((l, i) =>
      pdf.text(l, pageW - marginX, 96 + i*11, { align: 'right' }))
  }

  // ── Our Ref / Your Ref / Date — same formal fields on both letterheads ──
  let y = 128
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.setTextColor(...REF_LABEL)
  pdf.text('Our Ref:', marginX, y)
  pdf.setDrawColor(...REF_LABEL); pdf.setLineWidth(0.6)
  pdf.line(marginX + 42, y, pageW - marginX, y)
  y += 18
  pdf.text('Your Ref:', marginX, y)
  pdf.line(marginX + 46, y, marginX + 260, y)
  pdf.setTextColor(...REF_LABEL)
  pdf.text('Date:', pageW - marginX - 150, y)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10); pdf.setTextColor(20,20,20)
  const dateStr = new Date(date).toLocaleDateString(undefined, { year:'numeric', month:'long', day:'numeric' })
  pdf.text(dateStr, pageW - marginX - 118, y)
  return y + 32
}

function drawFooter(pdf, type) {
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8.5); pdf.setTextColor(...CHURCH_RED)
  const note = type === 'ccgworld'
    ? 'All correspondence from CCG World to be addressed to the Digital Ministry Team'
    : 'All Correspondence to be addressed to the Office of the General Secretariat'
  pdf.text(note, pageW/2, pageH - 24, { align: 'center' })
}

// ── Builds and downloads the PDF, returns nothing (side-effect: triggers download) ──
async function buildLetterPDF({ letterhead, date, recipient, subject, body, signatureImage, signatureName }) {
  const { jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const marginX = 56
  let y = await drawHeader(pdf, letterhead, date)

  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10.5); pdf.setTextColor(40,40,40)
  // ── Recipient ──
  if (recipient?.trim()) {
    const lines = pdf.splitTextToSize(recipient.trim(), pageW - marginX*2)
    pdf.text(lines, marginX, y)
    y += lines.length * 14 + 14
  }

  // ── Subject ──
  if (subject?.trim()) {
    pdf.setFont('helvetica', 'bold')
    pdf.text(`Subject: ${subject.trim()}`, marginX, y)
    pdf.setFont('helvetica', 'normal')
    y += 26
  }

  // ── Body (paginated) ──
  pdf.setFontSize(11)
  const bodyLines = pdf.splitTextToSize(body || '', pageW - marginX*2)
  const lineHeight = 16
  const bottomLimit = pageH - 100
  for (const line of bodyLines) {
    if (y > bottomLimit) { pdf.addPage(); y = 56 }
    pdf.text(line, marginX, y)
    y += lineHeight
  }

  // ── Signature ──
  if (signatureImage) {
    if (y > pageH - 160) { pdf.addPage(); y = 56 }
    y += 20
    pdf.addImage(signatureImage, 'PNG', marginX, y, 130, 46)
    y += 52
    pdf.setDrawColor(180,180,180); pdf.setLineWidth(0.6)
    pdf.line(marginX, y, marginX + 160, y)
    y += 14
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10)
    pdf.text(signatureName || 'Authorized Signatory', marginX, y)
  }

  const totalPages = pdf.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p)
    drawFooter(pdf, letterhead)
  }

  const fname = `CCG-Letter-${(subject||recipient||'letter').replace(/[^a-z0-9]+/gi,'-').slice(0,40)}-${date}.pdf`
  pdf.save(fname)
}

export default function AdminLetterWriter() {
  const { showToast, logAction } = useAdmin()

  // ── Signatures/stamps (named, saved under site_settings 'letter_signatures') ──
  const [signatures, setSignatures]   = useState([])
  const [sigLoading, setSigLoading]   = useState(true)
  const [showSigManager, setShowSigManager] = useState(false)
  const [sigMode, setSigMode]   = useState('draw')
  const [sigName, setSigName]   = useState('')
  const canvasRef  = useRef(null)
  const drawing    = useRef(false)
  const lastPos    = useRef(null)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [uploadPreview, setUploadPreview] = useState(null)
  const fileRef = useRef(null)
  const [savingSig, setSavingSig] = useState(false)

  useEffect(() => {
    getContent('letter_signatures').then(val => {
      setSignatures(Array.isArray(val) ? val : [])
      setSigLoading(false)
    })
  }, [])

  useEffect(() => {
    if (!showSigManager || sigMode !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0,0,canvas.width,canvas.height)
    ctx.strokeStyle = '#0a2612'; ctx.lineWidth = 2.5; ctx.lineCap='round'; ctx.lineJoin='round'
  }, [showSigManager, sigMode])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX-rect.left)*scaleX, y: (clientY-rect.top)*scaleY }
  }
  const startDraw = (e) => { e.preventDefault(); drawing.current = true; lastPos.current = getPos(e, canvasRef.current) }
  const draw = (e) => {
    e.preventDefault(); if (!drawing.current) return
    const canvas = canvasRef.current, ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(lastPos.current.x,lastPos.current.y); ctx.lineTo(pos.x,pos.y); ctx.stroke()
    lastPos.current = pos; setHasDrawn(true)
  }
  const stopDraw = () => { drawing.current = false }
  const clearCanvas = () => { canvasRef.current.getContext('2d').clearRect(0,0,600,180); setHasDrawn(false) }
  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.', 'error'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setUploadPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const saveSignature = async () => {
    if (!sigName.trim()) { showToast('Give this signature/stamp a name.', 'error'); return }
    let imageData = null
    if (sigMode === 'draw') {
      if (!hasDrawn) { showToast('Please draw a signature first.', 'error'); return }
      imageData = canvasRef.current.toDataURL('image/png')
    } else {
      if (!uploadPreview) { showToast('Please upload an image first.', 'error'); return }
      imageData = uploadPreview
    }
    setSavingSig(true)
    try {
      const next = [...signatures, { id: crypto.randomUUID(), name: sigName.trim(), image: imageData }]
      await setContent('letter_signatures', next)
      setSignatures(next)
      logAction('letter_signature_added', `Added letter signature "${sigName.trim()}"`, null)
      showToast('Signature saved.')
      setSigName(''); clearCanvas(); setUploadPreview(null)
    } catch (e) { showToast(e.message, 'error') }
    setSavingSig(false)
  }

  const deleteSignature = async (id) => {
    if (!window.confirm('Delete this signature/stamp?')) return
    const next = signatures.filter(s => s.id !== id)
    await setContent('letter_signatures', next)
    setSignatures(next)
    if (form.signatureId === id) setForm(f => ({ ...f, signatureId: '' }))
    showToast('Signature removed.')
  }

  // ── Letter form ──
  const [form, setForm] = useState({
    letterhead: 'church', date: new Date().toISOString().slice(0,10),
    recipient: '', subject: '', body: '', signatureId: '',
  })
  const [generating, setGenerating] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleGenerate = async () => {
    if (!form.body.trim()) { showToast('Write the letter body first.', 'error'); return }
    setGenerating(true)
    try {
      const sig = signatures.find(s => s.id === form.signatureId)
      await buildLetterPDF({
        letterhead: form.letterhead, date: form.date, recipient: form.recipient,
        subject: form.subject, body: form.body,
        signatureImage: sig?.image || null, signatureName: sig?.name || null,
      })
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('admin_letters').insert({
        letterhead: form.letterhead, recipient: form.recipient, subject: form.subject,
        body: form.body, letter_date: form.date,
        signature_name: sig?.name || null, signature_image: sig?.image || null,
        created_by: user?.id || null,
      })
      logAction('letter_generated', `Generated letter: ${form.subject || '(no subject)'}`, form.recipient || null)
      showToast('Letter downloaded.')
      loadHistory()
    } catch (e) { showToast(e.message || 'Failed to generate letter', 'error') }
    setGenerating(false)
  }

  // ── History ──
  const [history, setHistory] = useState([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const loadHistory = async () => {
    const { data } = await supabase.from('admin_letters').select('*').order('created_at', { ascending: false }).limit(50)
    setHistory(data || [])
    setHistoryLoading(false)
  }
  useEffect(() => { loadHistory() }, [])

  const redownload = async (row) => {
    await buildLetterPDF({
      letterhead: row.letterhead, date: row.letter_date, recipient: row.recipient,
      subject: row.subject, body: row.body,
      signatureImage: row.signature_image, signatureName: row.signature_name,
    })
  }
  const deleteHistory = async (id) => {
    if (!window.confirm('Delete this letter from history? This cannot be undone.')) return
    await supabase.from('admin_letters').delete().eq('id', id)
    setHistory(h => h.filter(r => r.id !== id))
  }

  const card = { background:'white', borderRadius:16, padding:24, boxShadow:'var(--shadow-sm)', border:'1px solid #e2e8f0', marginBottom:24 }
  const label = { display:'block', fontSize:'0.8rem', fontWeight:700, color:'var(--text-mid)', marginBottom:6 }
  const input = { width:'100%', padding:'10px 12px', borderRadius:8, border:'1px solid #e2e8f0', fontFamily:'var(--font-body)', fontSize:'0.9rem', boxSizing:'border-box' }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily:'var(--font-display)', fontSize:'1.7rem', color:'var(--brand-deep)', margin:'0 0 4px' }}>✉️ Letter Writer</h1>
        <p style={{ color:'var(--text-light)', margin:0, fontSize:'0.86rem' }}>Write and download official letters with letterhead and signature.</p>
      </div>

      {/* Signature manager */}
      <div style={card}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', cursor:'pointer' }}
          onClick={() => setShowSigManager(s => !s)}>
          <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1rem', margin:0 }}>
            🖋 Signatures & Stamps ({signatures.length})
          </h3>
          <span style={{ color:'var(--text-light)', fontSize:'0.85rem' }}>{showSigManager ? 'Hide ▲' : 'Manage ▼'}</span>
        </div>

        {!sigLoading && signatures.length > 0 && (
          <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginTop:16 }}>
            {signatures.map(s => (
              <div key={s.id} style={{ border:'1px solid #e2e8f0', borderRadius:10, padding:10, textAlign:'center', width:150 }}>
                <img src={s.image} alt={s.name} style={{ maxWidth:120, maxHeight:50, objectFit:'contain', display:'block', margin:'0 auto 6px' }} />
                <div style={{ fontSize:'0.75rem', fontWeight:700, color:'var(--text-mid)', marginBottom:6 }}>{s.name}</div>
                <button onClick={() => deleteSignature(s.id)}
                  style={{ fontSize:'0.72rem', color:'#dc2626', background:'none', border:'none', cursor:'pointer' }}>Delete</button>
              </div>
            ))}
          </div>
        )}

        {showSigManager && (
          <div style={{ marginTop:20, paddingTop:20, borderTop:'1px solid #f1f5f9' }}>
            <div style={{ display:'flex', gap:8, marginBottom:16 }}>
              {[['draw','✏️ Draw'],['upload','📁 Upload']].map(([k,l]) => (
                <button key={k} onClick={() => setSigMode(k)}
                  style={{ padding:'8px 18px', borderRadius:30, border:'none', cursor:'pointer', fontWeight:700, fontSize:'0.8rem', background: sigMode===k?'var(--brand-mid)':'#f1f5f9', color: sigMode===k?'white':'var(--text-mid)' }}>
                  {l}
                </button>
              ))}
            </div>

            {sigMode === 'draw' ? (
              <div>
                <canvas ref={canvasRef} width={600} height={180}
                  style={{ width:'100%', height:180, border:'2px dashed #d1fae5', borderRadius:12, cursor:'crosshair', background:'#fafffe', touchAction:'none', display:'block', marginBottom:10 }}
                  onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw} />
                <button onClick={clearCanvas} style={{ padding:'5px 14px', borderRadius:8, border:'1px solid #e2e8f0', background:'transparent', fontSize:'0.8rem', cursor:'pointer', marginBottom:14 }}>Clear</button>
              </div>
            ) : (
              <div onClick={() => fileRef.current?.click()}
                style={{ border:'2px dashed #d1fae5', borderRadius:12, padding:'24px 20px', textAlign:'center', cursor:'pointer', background:'#fafffe', marginBottom:14 }}>
                {uploadPreview ? <img src={uploadPreview} alt="" style={{ maxWidth:200, maxHeight:80, objectFit:'contain' }} /> : <div style={{ color:'var(--text-mid)', fontSize:'0.86rem' }}>📁 Click to choose an image</div>}
                <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display:'none' }} />
              </div>
            )}

            <label style={label}>Name this signature/stamp (e.g. "Senior Pastor", "Church Official Stamp")</label>
            <input style={{ ...input, marginBottom:14 }} value={sigName} onChange={e=>setSigName(e.target.value)} placeholder="e.g. Senior Pastor" />

            <button onClick={saveSignature} disabled={savingSig}
              style={{ padding:'10px 26px', borderRadius:30, border:'none', background: savingSig ? '#9ca3af' : 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, fontSize:'0.85rem', cursor:'pointer' }}>
              {savingSig ? 'Saving…' : '💾 Save Signature'}
            </button>
          </div>
        )}
      </div>

      {/* Letter form */}
      <div style={card}>
        <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1rem', margin:'0 0 18px' }}>📝 New Letter</h3>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
          <div>
            <label style={label}>Letterhead</label>
            <select style={input} value={form.letterhead} onChange={e=>set('letterhead', e.target.value)}>
              <option value="church">⛪ Church (main letterhead)</option>
              <option value="ccgworld">💻 CCG World Team</option>
            </select>
          </div>
          <div>
            <label style={label}>Date</label>
            <input type="date" style={input} value={form.date} onChange={e=>set('date', e.target.value)} />
          </div>
        </div>

        <label style={label}>Recipient (optional)</label>
        <input style={{ ...input, marginBottom:14 }} value={form.recipient} onChange={e=>set('recipient', e.target.value)} placeholder="e.g. The Registrar, Church Board" />

        <label style={label}>Subject (optional)</label>
        <input style={{ ...input, marginBottom:14 }} value={form.subject} onChange={e=>set('subject', e.target.value)} placeholder="e.g. Letter of Introduction" />

        <label style={label}>Body</label>
        <textarea style={{ ...input, minHeight:220, resize:'vertical', marginBottom:14, fontFamily:'var(--font-body)' }}
          value={form.body} onChange={e=>set('body', e.target.value)} placeholder="Write the letter here…" />

        <label style={label}>Signature / Stamp (optional)</label>
        <select style={{ ...input, marginBottom:20 }} value={form.signatureId} onChange={e=>set('signatureId', e.target.value)}>
          <option value="">None</option>
          {signatures.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <button onClick={handleGenerate} disabled={generating}
          style={{ padding:'12px 32px', borderRadius:40, border:'none', background: generating ? '#9ca3af' : 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color:'white', fontWeight:700, fontSize:'0.9rem', cursor:'pointer' }}>
          {generating ? 'Generating…' : '📄 Generate & Download PDF'}
        </button>
      </div>

      {/* History */}
      <div style={card}>
        <h3 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1rem', margin:'0 0 16px' }}>🕘 Letter History</h3>
        {historyLoading ? (
          <p style={{ color:'var(--text-light)', fontSize:'0.85rem' }}>Loading…</p>
        ) : history.length === 0 ? (
          <p style={{ color:'var(--text-light)', fontSize:'0.85rem' }}>No letters generated yet.</p>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {history.map(row => (
              <div key={row.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', border:'1px solid #f1f5f9', borderRadius:10, padding:'12px 14px', flexWrap:'wrap', gap:10 }}>
                <div>
                  <div style={{ fontWeight:700, fontSize:'0.88rem', color:'var(--text-mid)' }}>{row.subject || '(No subject)'}</div>
                  <div style={{ fontSize:'0.76rem', color:'var(--text-light)' }}>
                    {row.recipient ? `${row.recipient} · ` : ''}{new Date(row.letter_date).toLocaleDateString()} · {row.letterhead === 'ccgworld' ? 'CCG World Team' : 'Church'}
                  </div>
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => redownload(row)}
                    style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #d1fae5', background:'transparent', color:'var(--brand-deep)', fontWeight:600, fontSize:'0.78rem', cursor:'pointer' }}>
                    ⬇ Re-download
                  </button>
                  <button onClick={() => deleteHistory(row.id)}
                    style={{ padding:'6px 14px', borderRadius:8, border:'1px solid #fecaca', background:'transparent', color:'#dc2626', fontWeight:600, fontSize:'0.78rem', cursor:'pointer' }}>
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
