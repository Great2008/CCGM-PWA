import { useState, useEffect, useRef } from 'react'
import { useAdmin } from '../AdminApp'
import { getContent, setContent } from '../supabase'

export default function AdminSignature() {
  const { showToast } = useAdmin()
  const [current, setCurrent] = useState(null)  // current saved signature (base64)
  const [mode, setMode]       = useState('draw') // 'draw' | 'upload'
  const [saving, setSaving]   = useState(false)
  const [loading, setLoading] = useState(true)

  // Canvas drawing
  const canvasRef   = useRef(null)
  const drawing     = useRef(false)
  const lastPos     = useRef(null)
  const [hasDrawn,  setHasDrawn]  = useState(false)

  // Upload
  const [uploadPreview, setUploadPreview] = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    getContent('admin_signature').then(val => {
      if (val?.image) setCurrent(val.image)
      setLoading(false)
    })
  }, [])

  // ── Canvas drawing setup ──────────────────────────────────
  useEffect(() => {
    if (mode !== 'draw') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.strokeStyle = '#0a2612'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [mode])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY }
  }

  const startDraw = (e) => {
    e.preventDefault()
    drawing.current = true
    lastPos.current = getPos(e, canvasRef.current)
  }

  const draw = (e) => {
    e.preventDefault()
    if (!drawing.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current.x, lastPos.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPos.current = pos
    setHasDrawn(true)
  }

  const stopDraw = () => { drawing.current = false }

  const clearCanvas = () => {
    const canvas = canvasRef.current
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  // ── File upload ───────────────────────────────────────────
  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.', 'error'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setUploadPreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  // ── Save ─────────────────────────────────────────────────
  const handleSave = async () => {
    let imageData = null
    if (mode === 'draw') {
      if (!hasDrawn) { showToast('Please draw a signature first.', 'error'); return }
      imageData = canvasRef.current.toDataURL('image/png')
    } else {
      if (!uploadPreview) { showToast('Please upload an image first.', 'error'); return }
      imageData = uploadPreview
    }
    setSaving(true)
    try {
      await setContent('admin_signature', { image: imageData, updatedAt: new Date().toISOString() })
      setCurrent(imageData)
      showToast('Signature saved successfully!')
      clearCanvas()
      setUploadPreview(null)
    } catch (e) {
      showToast(e.message, 'error')
    }
    setSaving(false)
  }

  const handleRemove = async () => {
    if (!window.confirm('Remove the current signature?')) return
    setSaving(true)
    await setContent('admin_signature', { image: null })
    setCurrent(null)
    showToast('Signature removed.')
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-light)' }}>Loading…</div>

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.7rem', color: 'var(--brand-deep)', margin: '0 0 4px' }}>✍️ Admin Signature</h1>
        <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.86rem' }}>
          This signature appears on birth certificates issued to members.
        </p>
      </div>

      {/* Current signature */}
      {current && (
        <div style={{ background: 'white', borderRadius: 16, padding: '24px', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #d1fae5', marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1rem', margin: 0 }}>✅ Current Signature</h3>
            <button onClick={handleRemove} disabled={saving}
              style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #fecaca', background: 'transparent', color: '#dc2626', fontWeight: 600, fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
              Remove
            </button>
          </div>
          <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0' }}>
            <img src={current} alt="Admin signature" style={{ maxWidth: 280, maxHeight: 100, objectFit: 'contain', display: 'block' }} />
          </div>
          <p style={{ color: 'var(--text-light)', fontSize: '0.8rem', marginTop: 10, marginBottom: 0 }}>
            This signature will appear on all birth certificates. Update it below if needed.
          </p>
        </div>
      )}

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {[['draw','✏️ Draw Signature'],['upload','📁 Upload Image']].map(([k,l]) => (
          <button key={k} onClick={() => setMode(k)}
            style={{ padding: '9px 22px', borderRadius: 30, border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: '0.84rem', background: mode===k?'var(--brand-mid)':'#f1f5f9', color: mode===k?'white':'var(--text-mid)' }}>
            {l}
          </button>
        ))}
      </div>

      <div style={{ background: 'white', borderRadius: 16, padding: '24px', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0' }}>

        {/* Draw mode */}
        {mode === 'draw' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ color: 'var(--text-mid)', fontSize: '0.86rem', margin: 0 }}>Draw your signature in the box below using mouse or finger:</p>
              <button onClick={clearCanvas}
                style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'transparent', color: 'var(--text-mid)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}>
                Clear
              </button>
            </div>
            <canvas
              ref={canvasRef}
              width={600} height={180}
              style={{ width: '100%', height: 180, border: '2px dashed #d1fae5', borderRadius: 12, cursor: 'crosshair', background: '#fafffe', touchAction: 'none', display: 'block' }}
              onMouseDown={startDraw} onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
              onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={stopDraw}
            />
            <p style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: 8, marginBottom: 0 }}>
              Tip: Sign your name naturally. The signature will be cropped to fit the certificate.
            </p>
          </div>
        )}

        {/* Upload mode */}
        {mode === 'upload' && (
          <div>
            <p style={{ color: 'var(--text-mid)', fontSize: '0.86rem', marginBottom: 16 }}>
              Upload a PNG or JPG image of your signature. Use a white or transparent background for best results.
            </p>
            <div
              onClick={() => fileRef.current?.click()}
              style={{ border: '2px dashed #d1fae5', borderRadius: 12, padding: '32px 20px', textAlign: 'center', cursor: 'pointer', background: '#fafffe', marginBottom: 16 }}>
              {uploadPreview ? (
                <img src={uploadPreview} alt="Preview" style={{ maxWidth: 280, maxHeight: 100, objectFit: 'contain' }} />
              ) : (
                <>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📁</div>
                  <div style={{ color: 'var(--text-mid)', fontSize: '0.88rem' }}>Click to choose a file</div>
                  <div style={{ color: 'var(--text-light)', fontSize: '0.78rem', marginTop: 4 }}>PNG or JPG, max 2MB</div>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
            {uploadPreview && (
              <button onClick={() => { setUploadPreview(null); fileRef.current.value = '' }}
                style={{ padding: '6px 16px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'transparent', color: 'var(--text-mid)', fontSize: '0.8rem', fontFamily: 'var(--font-body)', cursor: 'pointer', marginBottom: 16 }}>
                Clear
              </button>
            )}
          </div>
        )}

        <button onClick={handleSave} disabled={saving || (mode==='draw'&&!hasDrawn) || (mode==='upload'&&!uploadPreview)}
          style={{ padding: '12px 32px', borderRadius: 40, border: 'none', background: (saving||(mode==='draw'&&!hasDrawn)||(mode==='upload'&&!uploadPreview)) ? '#9ca3af' : 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color: 'white', fontWeight: 700, fontSize: '0.9rem', fontFamily: 'var(--font-body)', cursor: 'pointer', marginTop: 16 }}>
          {saving ? 'Saving…' : '💾 Save Signature'}
        </button>
      </div>
    </div>
  )
}
