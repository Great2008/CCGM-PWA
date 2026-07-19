/**
 * AdminCertificates.jsx
 *
 * Admin page for managing certificate templates and issuing certificates.
 *
 * Features:
 *  - Upload membership / birth certificate templates (image PNG/JPG or PDF)
 *  - Visual drag-to-place field-position editor on the template
 *  - Save template + field positions to Supabase (certificate_templates table)
 *  - Browse members and issue (generate) a certificate on their behalf
 *  - Audit-log every action
 *
 * Supabase setup required — run the SQL in supabase/migrations/certificate_templates.sql
 * and create a public Storage bucket called  certificate-templates
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useAdmin } from '../AdminApp'
import PageHeader from '../components/PageHeader'
import AdminCard from '../components/AdminCard'
import { useTable } from '../useSupabaseAdmin'
import supabaseAdmin from '../../lib/supabase'

// ─── helpers ──────────────────────────────────────────────────────────────────

async function uploadTemplateFile(file) {
  const ext  = file.name.split('.').pop().toLowerCase()
  const name = `template-${Date.now()}.${ext}`
  const { data, error } = await supabaseAdmin.storage
    .from('certificate-templates')
    .upload(name, file, { contentType: file.type, upsert: false })
  if (error) throw new Error(error.message)
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('certificate-templates')
    .getPublicUrl(data.path)
  return { publicUrl, isPdf: ext === 'pdf' }
}

/** Render first page of a PDF blob URL onto an offscreen canvas, return dataURL */
async function pdfPageToDataUrl(pdfUrl) {
  // Dynamically import pdfjs-dist (must be in package.json)
  const pdfjsLib = await import('pdfjs-dist')
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
  const pdf  = await pdfjsLib.getDocument(pdfUrl).promise
  const page = await pdf.getPage(1)
  const vp   = page.getViewport({ scale: 2 })
  const c    = document.createElement('canvas')
  c.width  = vp.width
  c.height = vp.height
  await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise
  return c.toDataURL('image/png')
}

async function loadImg(src) {
  return new Promise((res, rej) => {
    const i = new Image(); i.crossOrigin = 'anonymous'
    i.onload = () => res(i); i.onerror = rej; i.src = src
  })
}

const CERT_TYPES = [
  { value: 'membership', label: '🏅 Membership Certificate' },
  { value: 'birth',      label: '🎂 Birth Certificate' },
]

// Fields that can be placed on each certificate type
const FIELD_DEFS = {
  membership: [
    { key: 'full_name',      label: 'Full Name' },
    { key: 'church_branch',  label: 'Branch' },
    { key: 'member_since',   label: 'Member Since' },
    { key: 'church_title',   label: 'Church Title / Post' },
    { key: 'cert_id',        label: 'Certificate ID' },
    { key: 'issued_date',    label: 'Issued Date' },
  ],
  birth: [
    { key: 'full_name',      label: 'Child Name' },
    { key: 'birthday',       label: 'Date of Birth' },
    { key: 'place_of_birth', label: 'Place of Birth' },
    { key: 'father_name',    label: "Father's Name" },
    { key: 'mother_name',    label: "Mother's Name" },
    { key: 'hometown',       label: 'Home Town' },
    { key: 'lga',            label: 'L.G.A.' },
    { key: 'cert_id',        label: 'Certificate No.' },
    { key: 'issued_date',    label: 'Issued Date' },
  ],
}

const FONTS = ['Georgia, serif', 'Arial, sans-serif', 'Times New Roman, serif', 'Courier New, monospace']
const DEFAULT_FIELD = { x: 100, y: 100, fontSize: 18, fontColor: '#0a2612', fontFamily: 'Georgia, serif', bold: false }

// ─── FieldEditor ─ drag-to-place fields on canvas preview ─────────────────────
function FieldEditor({ imgDataUrl, certType, fields, onChange }) {
  const canvasRef = useRef(null)
  const [selected, setSelected]   = useState(null)  // key of selected field
  const [dragging, setDragging]   = useState(null)  // { key, offX, offY }
  const [imgSize,  setImgSize]    = useState({ w: 1, h: 1 })
  const imgRef = useRef(null)

  // Draw everything on canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !imgRef.current) return
    const ctx  = canvas.getContext('2d')
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(imgRef.current, 0, 0, W, H)

    // Draw placed fields
    FIELD_DEFS[certType].forEach(def => {
      const f = fields[def.key]
      if (!f) return
      const sx = W / imgSize.w, sy = H / imgSize.h
      const px = f.x * sx, py = f.y * sy
      const fs = Math.round(f.fontSize * ((sx + sy) / 2))
      ctx.save()
      ctx.font = `${f.bold ? 'bold ' : ''}${fs}px ${f.fontFamily}`
      ctx.fillStyle = f.fontColor
      ctx.textBaseline = 'middle'
      // outline box
      const tw = ctx.measureText(def.label).width
      const bpad = 4
      ctx.strokeStyle = selected === def.key ? '#2563eb' : 'rgba(37,99,235,0.4)'
      ctx.lineWidth   = selected === def.key ? 2 : 1
      ctx.setLineDash([4, 3])
      ctx.strokeRect(px - bpad, py - fs / 2 - bpad, tw + bpad * 2, fs + bpad * 2)
      ctx.setLineDash([])
      // label text
      ctx.fillText(def.label, px, py)
      // drag handle dot
      ctx.beginPath()
      ctx.arc(px - bpad - 6, py, 5, 0, Math.PI * 2)
      ctx.fillStyle = selected === def.key ? '#2563eb' : 'rgba(37,99,235,0.6)'
      ctx.fill()
      ctx.restore()
    })
  }, [fields, certType, selected, imgSize])

  // Load image
  useEffect(() => {
    if (!imgDataUrl) return
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = imgDataUrl
  }, [imgDataUrl])

  useEffect(() => { redraw() }, [redraw])

  const getCanvasCoords = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const scaleX = canvasRef.current.width  / rect.width
    const scaleY = canvasRef.current.height / rect.height
    const cx = e.touches ? e.touches[0].clientX : e.clientX
    const cy = e.touches ? e.touches[0].clientY : e.clientY
    return {
      x: (cx - rect.left) * scaleX / (canvasRef.current.width  / imgSize.w),
      y: (cy - rect.top)  * scaleY / (canvasRef.current.height / imgSize.h),
    }
  }

  const hitTest = (imgX, imgY) => {
    const canvas = canvasRef.current
    const sx = canvas.width / imgSize.w, sy = canvas.height / imgSize.h
    for (const def of FIELD_DEFS[certType]) {
      const f = fields[def.key]
      if (!f) continue
      const px = f.x, py = f.y, fs = f.fontSize, tw = 120 // approx hit area
      if (imgX >= px - 10 && imgX <= px + tw && imgY >= py - fs && imgY <= py + fs) return def.key
    }
    return null
  }

  const onMouseDown = (e) => {
    e.preventDefault()
    const { x, y } = getCanvasCoords(e)
    const hit = hitTest(x, y)
    if (hit) {
      setSelected(hit)
      setDragging({ key: hit, offX: x - fields[hit].x, offY: y - fields[hit].y })
    } else {
      setSelected(null)
    }
  }
  const onMouseMove = (e) => {
    if (!dragging) return
    e.preventDefault()
    const { x, y } = getCanvasCoords(e)
    onChange(dragging.key, { x: Math.round(x - dragging.offX), y: Math.round(y - dragging.offY) })
  }
  const onMouseUp = () => setDragging(null)

  if (!imgDataUrl) return (
    <div style={{ background: '#f8fafc', borderRadius: 12, padding: 40, textAlign: 'center', color: '#94a3b8', border: '2px dashed #e2e8f0' }}>
      Upload a template above to start placing fields
    </div>
  )

  return (
    <canvas
      ref={canvasRef}
      width={imgSize.w > 1200 ? 1200 : imgSize.w}
      height={imgSize.w > 1200 ? Math.round(imgSize.h * (1200 / imgSize.w)) : imgSize.h}
      style={{ width: '100%', borderRadius: 10, border: '2px solid #e2e8f0', cursor: dragging ? 'grabbing' : 'grab', display: 'block' }}
      onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp}
      onTouchStart={onMouseDown} onTouchMove={onMouseMove} onTouchEnd={onMouseUp}
    />
  )
}

// ─── MemberPickerModal ─────────────────────────────────────────────────────────
function MemberPickerModal({ onSelect, onClose }) {
  const [q, setQ]         = useState('')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const search = async () => {
      setLoading(true)
      let query = supabaseAdmin.from('profiles').select('id, full_name, display_name, church_branch, birthday, gender, church_title, father_name, mother_name, place_of_birth, hometown, lga, created_at, avatar_url').order('full_name')
      if (q.trim()) query = query.ilike('full_name', `%${q.trim()}%`)
      else query = query.limit(40)
      const { data } = await query.limit(40)
      setMembers(data || [])
      setLoading(false)
    }
    search()
  }, [q])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 540, maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px 14px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, color: 'var(--brand-deep)', fontFamily: 'var(--font-display)' }}>Select Member</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
        <div style={{ padding: '12px 24px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name…" style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 20px' }}>
          {loading ? <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Searching…</div> :
            members.map(m => (
              <button key={m.id} onClick={() => onSelect(m)} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #f1f5f9', background: 'none', cursor: 'pointer', textAlign: 'left', marginBottom: 4, transition: 'background 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--brand-pale)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--brand-deep)', flexShrink: 0, fontSize: '1rem' }}>
                  {(m.full_name || m.display_name || '?').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{m.full_name || m.display_name || 'Unnamed'}</div>
                  <div style={{ fontSize: '0.76rem', color: '#94a3b8' }}>{m.church_branch || 'No branch'}{m.church_title ? ` · ${m.church_title}` : ''}</div>
                </div>
              </button>
            ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── IssueCertModal ─ generate certificate for a member using a template ──────
function IssueCertModal({ template, member, onClose, onIssued }) {
  const [generating, setGenerating] = useState(false)
  const [done,        setDone]       = useState(false)
  const [format,      setFormat]     = useState('png') // 'png' | 'pdf'
  const [error,       setError]      = useState('')
  const canvasRef = useRef(null)
  const imgRef    = useRef(null)

  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const fmtDate = iso => {
    if (!iso) return ''
    try {
      const [y, m, d] = iso.split('T')[0].split('-').map(Number)
      return `${d} ${MONTHS[m-1]} ${y}`
    } catch { return '' }
  }

  const getMemberValue = (key) => {
    const m = member
    switch (key) {
      case 'full_name':      return m.full_name || m.display_name || ''
      case 'church_branch':  return m.church_branch || ''
      case 'member_since':   return fmtDate(m.created_at)
      case 'church_title':   return m.church_title || ''
      case 'cert_id':        return (template.cert_type === 'birth' ? 'CCGB-' : 'CCG-') + m.id.slice(0,8).toUpperCase()
      case 'issued_date':    return fmtDate(new Date().toISOString())
      case 'birthday':       return fmtDate(m.birthday)
      case 'place_of_birth': return m.place_of_birth || ''
      case 'father_name':    return m.father_name || ''
      case 'mother_name':    return m.mother_name || ''
      case 'hometown':       return m.hometown || ''
      case 'lga':            return m.lga || ''
      default:               return ''
    }
  }

  const generate = async () => {
    setGenerating(true); setError('')
    try {
      // Resolve template image
      let imgDataUrl = template.preview_data_url  // set when admin just uploaded
      if (!imgDataUrl) {
        if (template.is_pdf) {
          imgDataUrl = await pdfPageToDataUrl(template.image_url)
        } else {
          const img = await loadImg(template.image_url)
          const tmp = document.createElement('canvas')
          tmp.width = img.naturalWidth; tmp.height = img.naturalHeight
          tmp.getContext('2d').drawImage(img, 0, 0)
          imgDataUrl = tmp.toDataURL('image/png')
        }
      }

      const bgImg  = await loadImg(imgDataUrl)
      const canvas = canvasRef.current
      canvas.width  = bgImg.naturalWidth
      canvas.height = bgImg.naturalHeight
      const ctx = canvas.getContext('2d')

      // Draw background
      ctx.drawImage(bgImg, 0, 0)

      // Draw each field
      const fieldDefs = FIELD_DEFS[template.cert_type] || []
      const fieldsMap  = template.fields || {}
      for (const def of fieldDefs) {
        const f = fieldsMap[def.key]
        if (!f) continue
        const val = getMemberValue(def.key)
        if (!val) continue
        ctx.save()
        ctx.font = `${f.bold ? 'bold ' : ''}${f.fontSize}px ${f.fontFamily}`
        ctx.fillStyle = f.fontColor
        ctx.textBaseline = 'middle'
        ctx.fillText(val, f.x, f.y)
        ctx.restore()
      }

      imgRef.current = canvas.toDataURL('image/png')
      setDone(true)
    } catch (e) {
      setError(e.message || 'Generation failed')
    }
    setGenerating(false)
  }

  const download = async () => {
    if (format === 'pdf') {
      const { jsPDF } = await import('jspdf')
      const imgData = imgRef.current
      const img     = await loadImg(imgData)
      const isLandscape = img.naturalWidth > img.naturalHeight
      const pdf = new jsPDF({ orientation: isLandscape ? 'landscape' : 'portrait', unit: 'px', format: [img.naturalWidth, img.naturalHeight] })
      pdf.addImage(imgData, 'PNG', 0, 0, img.naturalWidth, img.naturalHeight)
      pdf.save(`CCG-${template.cert_type}-${(member.full_name||'member').replace(/\s+/g,'-')}.pdf`)
    } else {
      const a = document.createElement('a')
      a.download = `CCG-${template.cert_type}-${(member.full_name||'member').replace(/\s+/g,'-')}.png`
      a.href = imgRef.current; a.click()
    }
    onIssued()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: 16, width: '100%', maxWidth: 780, overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ margin: 0, color: 'var(--brand-deep)', fontFamily: 'var(--font-display)' }}>Issue Certificate</h3>
            <p style={{ margin: '3px 0 0', fontSize: '0.83rem', color: '#64748b' }}>{template.name} → {member.full_name || member.display_name}</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.3rem', cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>
        <div style={{ padding: 24 }}>
          {error && <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 10, padding: '10px 14px', color: '#dc2626', fontSize: '0.86rem', marginBottom: 14 }}>❌ {error}</div>}

          {/* Hidden canvas for generation */}
          <canvas ref={canvasRef} style={{ position: 'absolute', left: '-9999px', top: 0 }} />

          {done ? (
            <>
              <img src={imgRef.current} alt="Generated certificate" style={{ width: '100%', borderRadius: 10, border: '1px solid #e2e8f0', marginBottom: 18 }} />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>Format:</label>
                {['png','pdf'].map(f => (
                  <button key={f} onClick={() => setFormat(f)} style={{ padding: '7px 18px', borderRadius: 20, border: `1.5px solid ${format===f ? 'var(--brand-mid)' : '#e2e8f0'}`, background: format===f ? 'var(--brand-mid)' : 'white', color: format===f ? 'white' : '#64748b', fontWeight: 600, cursor: 'pointer', fontSize: '0.82rem' }}>
                    {f.toUpperCase()}
                  </button>
                ))}
                <button onClick={download} style={{ marginLeft: 'auto', padding: '10px 24px', borderRadius: 30, border: 'none', background: 'var(--brand-mid)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                  ⬇️ Download {format.toUpperCase()}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📜</div>
              <p style={{ color: '#64748b', marginBottom: 24 }}>Generate the certificate for <strong>{member.full_name || member.display_name}</strong> using the <em>{template.name}</em> template.</p>
              <button onClick={generate} disabled={generating} style={{ padding: '12px 32px', borderRadius: 30, border: 'none', background: generating ? '#94a3b8' : 'var(--brand-mid)', color: 'white', fontWeight: 700, cursor: generating ? 'not-allowed' : 'pointer', fontSize: '1rem' }}>
                {generating ? '⏳ Generating…' : '🎨 Generate Certificate'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminCertificates() {
  const { showToast, logAction } = useAdmin()
  const { rows: templates, loading, insert: insertTemplate, update: updateTemplate, remove: removeTemplate, reload } = useTable('certificate_templates', { order: 'created_at', asc: false })

  // UI state
  const [view, setView]       = useState('list')   // 'list' | 'editor' | 'issue'
  const [editTpl, setEditTpl] = useState(null)     // template being edited/created
  const [issueTpl, setIssueTpl] = useState(null)   // template chosen for issuing
  const [issueMember, setIssueMember] = useState(null)
  const [showPicker,  setShowPicker]  = useState(false)

  // Editor state
  const [tplName,     setTplName]     = useState('')
  const [tplType,     setTplType]     = useState('membership')
  const [uploadFile,  setUploadFile]  = useState(null)
  const [previewUrl,  setPreviewUrl]  = useState(null)  // data-url for canvas preview
  const [rawFileUrl,  setRawFileUrl]  = useState(null)  // supabase public URL
  const [isPdf,       setIsPdf]       = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [fieldMap,    setFieldMap]    = useState({})  // { [key]: { x, y, fontSize, fontColor, fontFamily, bold } }
  const [selField,    setSelField]    = useState(null)

  const fileInputRef = useRef(null)

  // Open editor in create mode
  const startCreate = () => {
    setEditTpl(null); setTplName(''); setTplType('membership')
    setUploadFile(null); setPreviewUrl(null); setRawFileUrl(null); setIsPdf(false)
    setFieldMap({}); setSelField(null)
    setView('editor')
  }

  // Open editor in edit mode
  const startEdit = async (tpl) => {
    setEditTpl(tpl); setTplName(tpl.name); setTplType(tpl.cert_type)
    setFieldMap(tpl.fields || {}); setSelField(null)
    setRawFileUrl(tpl.image_url); setIsPdf(tpl.is_pdf)
    // Render preview
    try {
      if (tpl.is_pdf) {
        const du = await pdfPageToDataUrl(tpl.image_url)
        setPreviewUrl(du)
      } else {
        setPreviewUrl(tpl.image_url)
      }
    } catch { setPreviewUrl(null) }
    setView('editor')
  }

  // File chosen
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploadFile(file)
    const ext = file.name.split('.').pop().toLowerCase()
    const isPdfFile = ext === 'pdf'
    setIsPdf(isPdfFile)
    if (isPdfFile) {
      const url = URL.createObjectURL(file)
      try { const du = await pdfPageToDataUrl(url); setPreviewUrl(du) }
      catch { showToast('Could not render PDF preview — will still upload', 'error') }
    } else {
      const reader = new FileReader()
      reader.onload = ev => setPreviewUrl(ev.target.result)
      reader.readAsDataURL(file)
    }
  }

  // Upload file to storage
  const handleUpload = async () => {
    if (!uploadFile) return
    setUploading(true)
    try {
      const { publicUrl, isPdf: pdf } = await uploadTemplateFile(uploadFile)
      setRawFileUrl(publicUrl); setIsPdf(pdf)
      showToast('Template uploaded ✓')
    } catch (e) {
      showToast(e.message, 'error')
    }
    setUploading(false)
  }

  // Field map change from drag editor
  const handleFieldChange = (key, partial) => {
    setFieldMap(prev => ({ ...prev, [key]: { ...(prev[key] || DEFAULT_FIELD), ...partial } }))
  }

  // Add field to map at default position
  const addField = (key) => {
    if (fieldMap[key]) return
    setFieldMap(prev => ({ ...prev, [key]: { ...DEFAULT_FIELD, x: 100 + Object.keys(prev).length * 10, y: 100 + Object.keys(prev).length * 40 } }))
    setSelField(key)
  }

  // Save template
  const handleSave = async () => {
    if (!tplName.trim()) { showToast('Enter a template name', 'error'); return }
    if (!rawFileUrl)     { showToast('Upload the template file first', 'error'); return }
    setSaving(true)
    try {
      const payload = {
        name:      tplName.trim(),
        cert_type: tplType,
        image_url: rawFileUrl,
        is_pdf:    isPdf,
        fields:    fieldMap,
        active:    true,
      }
      if (editTpl) {
        await updateTemplate(editTpl.id, payload)
        logAction('cert_template_update', `Updated template: ${tplName}`, tplName)
        showToast('Template updated ✓')
      } else {
        await insertTemplate(payload)
        logAction('cert_template_create', `Created template: ${tplName}`, tplName)
        showToast('Template saved ✓')
      }
      setView('list')
    } catch (e) {
      showToast(e.message, 'error')
    }
    setSaving(false)
  }

  // Delete template
  const handleDelete = async (tpl) => {
    if (!confirm(`Delete template "${tpl.name}"?`)) return
    try {
      await removeTemplate(tpl.id)
      logAction('cert_template_delete', `Deleted template: ${tpl.name}`, tpl.name)
      showToast('Template deleted')
    } catch (e) {
      showToast(e.message, 'error')
    }
  }

  // Issue cert
  const startIssue = (tpl) => { setIssueTpl(tpl); setShowPicker(true) }
  const onMemberSelected = (m) => { setIssueMember(m); setShowPicker(false); setView('issue') }
  const onIssued = () => {
    logAction('cert_issued', `Issued ${issueTpl.name} for ${issueMember.full_name || issueMember.display_name}`, issueMember.full_name || issueMember.display_name)
    showToast('Certificate issued ✓')
    setView('list'); setIssueTpl(null); setIssueMember(null)
  }

  // ── RENDER ─────────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-light)' }}>Loading…</div>

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  if (view === 'list') return (
    <div>
      <PageHeader icon="📜" title="Certificate Templates"
        subtitle={`${templates.length} template${templates.length !== 1 ? 's' : ''}`}
        action={
          <button className="btn btn-blue" onClick={startCreate}>+ New Template</button>
        }
      />

      {templates.length === 0 && (
        <AdminCard>
          <div style={{ textAlign: 'center', padding: '48px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>📜</div>
            <p>No certificate templates yet.</p>
            <p style={{ fontSize: '0.85rem' }}>Upload your church's birth or membership certificate design and place fields on it.</p>
            <button className="btn btn-blue" onClick={startCreate} style={{ marginTop: 8 }}>Upload First Template</button>
          </div>
        </AdminCard>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
        {templates.map(tpl => (
          <AdminCard key={tpl.id} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Thumbnail */}
            <div style={{ borderRadius: 10, overflow: 'hidden', aspectRatio: '4/3', background: '#f1f5f9', position: 'relative' }}>
              {tpl.is_pdf ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontSize: '3rem', color: '#94a3b8' }}>📄</div>
              ) : (
                <img src={tpl.image_url} alt={tpl.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => e.target.style.display = 'none'} />
              )}
              <span style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.6)', color: 'white', fontSize: '0.7rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {tpl.cert_type}
              </span>
            </div>

            <div>
              <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '1rem', marginBottom: 3 }}>{tpl.name}</div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                {Object.keys(tpl.fields || {}).length} fields placed · {tpl.is_pdf ? 'PDF' : 'Image'} template
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 'auto' }}>
              <button className="btn btn-blue" style={{ flex: 1 }} onClick={() => startIssue(tpl)}>🎓 Issue</button>
              <button className="btn btn-outline-blue" onClick={() => startEdit(tpl)}>✏️ Edit</button>
              <button onClick={() => handleDelete(tpl)} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', cursor: 'pointer', fontSize: '0.82rem' }}>🗑</button>
            </div>
          </AdminCard>
        ))}
      </div>

      {/* Member picker modal */}
      {showPicker && <MemberPickerModal onSelect={onMemberSelected} onClose={() => setShowPicker(false)} />}
    </div>
  )

  // ── ISSUE VIEW ─────────────────────────────────────────────────────────────
  if (view === 'issue' && issueTpl && issueMember) return (
    <IssueCertModal
      template={{ ...issueTpl, preview_data_url: previewUrl }}
      member={issueMember}
      onClose={() => { setView('list'); setIssueTpl(null); setIssueMember(null) }}
      onIssued={onIssued}
    />
  )

  // ── EDITOR VIEW ─────────────────────────────────────────────────────────────
  const fieldDefs  = FIELD_DEFS[tplType] || []
  const selFDef    = selField ? fieldDefs.find(d => d.key === selField) : null
  const selFConfig = selField ? (fieldMap[selField] || DEFAULT_FIELD) : null

  return (
    <div>
      <PageHeader
        icon="📜"
        title={editTpl ? `Edit: ${editTpl.name}` : 'New Certificate Template'}
        action={
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-outline-blue" onClick={() => setView('list')}>← Back</button>
            <button className="btn btn-blue" onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving…' : '💾 Save Template'}</button>
          </div>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 24, alignItems: 'start' }}>
        {/* Left: canvas editor */}
        <div>
          <AdminCard style={{ marginBottom: 0 }}>
            <h3 style={{ margin: '0 0 14px', color: 'var(--brand-deep)', fontSize: '1rem', fontFamily: 'var(--font-display)' }}>Template Preview — Drag fields to position</h3>
            <FieldEditor
              imgDataUrl={previewUrl}
              certType={tplType}
              fields={fieldMap}
              onChange={handleFieldChange}
            />
            {previewUrl && (
              <p style={{ margin: '10px 0 0', fontSize: '0.78rem', color: '#94a3b8' }}>
                💡 Drag any field label to reposition it on the certificate. Add fields using the panel on the right.
              </p>
            )}
          </AdminCard>
        </div>

        {/* Right: settings panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Basic info */}
          <AdminCard>
            <h4 style={{ margin: '0 0 12px', color: 'var(--brand-deep)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Template Info</h4>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label>Template Name *</label>
              <input value={tplName} onChange={e => setTplName(e.target.value)} placeholder="e.g. Membership Certificate 2025" style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', boxSizing: 'border-box' }} />
            </div>
            <div className="form-group">
              <label>Certificate Type *</label>
              <select value={tplType} onChange={e => { setTplType(e.target.value); setFieldMap({}); setSelField(null) }}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', background: 'white' }}>
                {CERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </AdminCard>

          {/* Upload */}
          <AdminCard>
            <h4 style={{ margin: '0 0 12px', color: 'var(--brand-deep)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Template File</h4>
            <p style={{ margin: '0 0 10px', fontSize: '0.8rem', color: '#64748b' }}>Upload your church's certificate design as an image (PNG, JPG) or PDF.</p>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,application/pdf" onChange={handleFileChange} style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%', padding: '10px', borderRadius: 8, border: '2px dashed #cbd5e1', background: '#f8fafc', color: '#64748b', cursor: 'pointer', fontFamily: 'var(--font-body)', fontSize: '0.85rem', marginBottom: 10 }}>
              {uploadFile ? `📎 ${uploadFile.name}` : '📂 Choose file…'}
            </button>
            {uploadFile && !rawFileUrl && (
              <button onClick={handleUpload} disabled={uploading} style={{ width: '100%', padding: '9px', borderRadius: 8, border: 'none', background: 'var(--brand-mid)', color: 'white', fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-body)' }}>
                {uploading ? '⏳ Uploading…' : '☁️ Upload to Storage'}
              </button>
            )}
            {rawFileUrl && <div style={{ fontSize: '0.78rem', color: '#16a34a', marginTop: 4 }}>✅ Uploaded to Supabase Storage</div>}
          </AdminCard>

          {/* Fields */}
          <AdminCard>
            <h4 style={{ margin: '0 0 12px', color: 'var(--brand-deep)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fields</h4>
            <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#64748b' }}>Click a field to add it, then drag it on the preview.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {fieldDefs.map(def => {
                const placed = !!fieldMap[def.key]
                return (
                  <div key={def.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => { if (!placed) addField(def.key); setSelField(def.key) }}
                      style={{ flex: 1, padding: '7px 12px', borderRadius: 8, border: `1.5px solid ${selField===def.key ? 'var(--brand-mid)' : placed ? '#bbf7d0' : '#e2e8f0'}`, background: selField===def.key ? 'var(--brand-pale)' : placed ? '#f0fdf4' : 'white', color: '#1e293b', fontSize: '0.82rem', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-body)' }}>
                      {placed ? '✅' : '➕'} {def.label}
                    </button>
                    {placed && (
                      <button onClick={() => { setFieldMap(p => { const n={...p}; delete n[def.key]; return n }); if(selField===def.key) setSelField(null) }}
                        style={{ padding: '6px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff5f5', color: '#dc2626', cursor: 'pointer', fontSize: '0.75rem' }}>✕</button>
                    )}
                  </div>
                )
              })}
            </div>
          </AdminCard>

          {/* Selected field style */}
          {selFDef && selFConfig && (
            <AdminCard>
              <h4 style={{ margin: '0 0 12px', color: 'var(--brand-deep)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Style: {selFDef.label}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>Font Size (px)</label>
                  <input type="number" min={8} max={80} value={selFConfig.fontSize} onChange={e => handleFieldChange(selField, { fontSize: Number(e.target.value) })}
                    style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)' }} />
                </div>
                <div className="form-group">
                  <label style={{ fontSize: '0.75rem' }}>Color</label>
                  <input type="color" value={selFConfig.fontColor} onChange={e => handleFieldChange(selField, { fontColor: e.target.value })}
                    style={{ width: '100%', height: 36, padding: 2, borderRadius: 8, border: '1.5px solid #e2e8f0', cursor: 'pointer' }} />
                </div>
              </div>
              <div className="form-group" style={{ marginTop: 8 }}>
                <label style={{ fontSize: '0.75rem' }}>Font</label>
                <select value={selFConfig.fontFamily} onChange={e => handleFieldChange(selField, { fontFamily: e.target.value })}
                  style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', background: 'white' }}>
                  {FONTS.map(f => <option key={f} value={f}>{f.split(',')[0]}</option>)}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer', fontSize: '0.83rem', color: '#475569' }}>
                <input type="checkbox" checked={selFConfig.bold} onChange={e => handleFieldChange(selField, { bold: e.target.checked })} />
                Bold
              </label>
              <div style={{ marginTop: 10, fontSize: '0.75rem', color: '#94a3b8' }}>
                Position: ({fieldMap[selField]?.x}, {fieldMap[selField]?.y}) px
              </div>
            </AdminCard>
          )}
        </div>
      </div>

      {/* Mobile-friendly save button at bottom */}
      <div style={{ marginTop: 24, display: 'flex', gap: 10 }}>
        <button className="btn btn-outline-blue" onClick={() => setView('list')}>← Cancel</button>
        <button className="btn btn-blue" onClick={handleSave} disabled={saving}>{saving ? '⏳ Saving…' : '💾 Save Template'}</button>
      </div>
    </div>
  )
}
