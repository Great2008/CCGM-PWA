import { useState, useEffect } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import supabase from '../lib/supabase'

export default function Verify() {
  const [searchParams] = useSearchParams()
  const certId = searchParams.get('id') || ''

  const [status, setStatus]   = useState('loading') // loading | valid | invalid
  const [member, setMember]   = useState(null)
  const [certType, setCertType] = useState('membership') // membership | birth
  const [searchInput, setSearchInput] = useState('')
  const [searching, setSearching] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (!certId) { setStatus('invalid'); return }

    const isBirth = certId.startsWith('CCGB-')
    const isId    = certId.startsWith('CCG-ID-') || certId.startsWith('CCGID-')
    setCertType(isBirth ? 'birth' : isId ? 'id' : 'membership')

    // Extract user ID prefix from cert ID (CCG-XXXXXXXX or CCGB-XXXXXXXX)
    const prefix = certId.replace(/^CCG[B]?-/, '').toLowerCase()

    // UUIDs can't use ilike directly. Use gte/lt range matching on UUID prefix.
    // UUID prefix '55a6aa61' means IDs from '55a6aa61-0000...' to '55a6aa61-ffff...'
    const lo = prefix + '-0000-0000-0000-000000000000'
    const hi = prefix + '-ffff-ffff-ffff-ffffffffffff'
    supabase
      .from('profiles')
      .select('id, full_name, display_name, church_branch, role, created_at, birthday, suspended')
      .gte('id', lo)
      .lte('id', hi)
      .limit(1)
      .then(({ data, error }) => {
        const single = data?.[0]
        const error2 = error || (!single ? { message: 'not found' } : null)
        return { data: single, error: error2 }
      })
      .then(({ data, error }) => {
        if (error || !data) { setStatus('invalid'); return }
        if (data.suspended) { setStatus('suspended'); setMember(data); return }
        // For birth cert, must have birthday
        if (isBirth && !data.birthday) { setStatus('invalid'); return }
        setMember(data)
        setStatus('valid')
      })
  }, [certId])

  const name     = member ? (member.full_name || member.display_name || 'Member') : ''
  const branch   = member?.church_branch || 'CCG World'
  const joinDate = member?.created_at
    ? new Date(member.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : ''
  const birthday = member?.birthday
    ? new Date(member.birthday).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
    : ''

  const handleSearch = (e) => {
    e.preventDefault()
    const id = searchInput.trim().toUpperCase()
    if (!id) return
    setSearching(true)
    navigate('/verify?id=' + encodeURIComponent(id))
  }

  return (
    <>
      <div style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: 'clamp(80px,12vw,110px) 5% 48px', textAlign: 'center' }}>
        <div style={{ display:'flex', justifyContent:'center', marginBottom:16 }}>
          <picture><source srcSet="/logo-sm.webp" type="image/webp" /><img src="/logo.webp" alt="CCG World" width={64} height={64} style={{ width:64, height:64, objectFit:'contain' }} /></picture>
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 'clamp(1.8rem,4vw,2.6rem)', color: 'white', margin: '0 0 10px' }}>
          🔍 Certificate Verification
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', margin: '0 0 32px' }}>
          Christian Church of God Mission — Official Verification Portal
        </p>

        {/* Search form — always visible */}
        <form onSubmit={handleSearch} style={{ display:'flex', gap:10, maxWidth:460, margin:'0 auto', flexWrap:'wrap', justifyContent:'center' }}>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Enter Certificate ID (e.g. CCG-55A6AA61)"
            style={{ flex:1, minWidth:220, padding:'12px 18px', borderRadius:30, border:'none', fontFamily:'var(--font-body)', fontSize:'0.92rem', outline:'none', letterSpacing:'0.04em' }}
          />
          <button type="submit" disabled={!searchInput.trim()}
            style={{ padding:'12px 28px', borderRadius:30, border:'none', background: searchInput.trim() ? '#d97706' : 'rgba(255,255,255,0.2)', color:'white', fontWeight:700, cursor: searchInput.trim() ? 'pointer' : 'default', fontFamily:'var(--font-body)', fontSize:'0.9rem', transition:'all 0.2s' }}>
            Verify
          </button>
        </form>
      </div>

      <div className="container" style={{ maxWidth: 600, padding: '48px 5% 80px' }}>

        {/* Loading */}
        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-light)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 16, animation: 'spin 1s linear infinite', display: 'inline-block' }}>🔍</div>
            <div>Verifying certificate…</div>
          </div>
        )}

        {/* Invalid */}
        {(status === 'invalid' || !certId) && (
          <div style={{ background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 20, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>❌</div>
            <h2 style={{ fontFamily: 'var(--font-display)', color: '#dc2626', margin: '0 0 12px' }}>Certificate Not Found</h2>
            <p style={{ color: '#7f1d1d', lineHeight: 1.7, marginBottom: 28 }}>
              This certificate ID is invalid or does not match any member in our records.
              It may have been altered or does not belong to CCG World.
            </p>
            <div style={{ background: '#fee2e2', borderRadius: 10, padding: '10px 16px', fontSize: '0.82rem', color: '#991b1b', fontFamily: 'monospace', marginBottom: 24 }}>
              ID: {certId || 'None provided'}
            </div>
            <p style={{ color:'#7f1d1d', fontSize:'0.84rem', lineHeight:1.6 }}>
              Use the search box above to try a different certificate ID.
            </p>
          </div>
        )}

        {/* Suspended */}
        {status === 'suspended' && (
          <div style={{ background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 20, padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>🚫</div>
            <h2 style={{ fontFamily: 'var(--font-display)', color: '#dc2626', margin: '0 0 12px' }}>Account Suspended</h2>
            <p style={{ color: '#7f1d1d', lineHeight: 1.7 }}>
              This member's account is currently suspended. Their certificate is not valid at this time.
            </p>
          </div>
        )}

        {/* Valid */}
        {status === 'valid' && member && (
          <div>
            {/* Success banner */}
            <div style={{ background: 'linear-gradient(135deg,#14532d,#16a34a)', borderRadius: 20, padding: '28px 32px', textAlign: 'center', marginBottom: 24, boxShadow: '0 8px 32px rgba(22,163,74,0.25)' }}>
              <div style={{ fontSize: '3.5rem', marginBottom: 12 }}>✅</div>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'white', margin: '0 0 8px', fontSize: '1.5rem' }}>
                Certificate Verified
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.8)', margin: 0, fontSize: '0.9rem' }}>
                This is a valid {certType === 'birth' ? 'birth' : 'membership'} certificate issued by CCG World
              </p>
            </div>

            {/* Member details */}
            <div style={{ background: 'var(--white, white)', borderRadius: 16, boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 24 }}>
              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', padding: '24px 28px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-light),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '1.4rem', flexShrink: 0 }}>
                  {name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ color: 'white', fontWeight: 700, fontSize: '1.15rem' }}>{name}</div>
                  <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem', marginTop: 2 }}>
                    {member.role === 'admin' ? '🛡 Admin' : '✅ Active Member'}
                  </div>
                </div>
              </div>

              {/* Info grid */}
              <div style={{ padding: '20px 24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {[
                    ['Certificate ID',   certId],
                    ['Certificate Type', certType === 'birth' ? '🎂 Birth' : certType === 'id' ? '🪪 ID Card' : '🏅 Membership'],
                    ['Full Name',        name],
                    ['Church Branch',    branch],
                  ].map(([k, v]) => (
                    <div key={k} style={{ background: '#f1f5f9', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{k}</div>
                      <div style={{ color: '#0f172a', fontWeight: 600, fontSize: '0.88rem' }}>{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Issuer note */}
            <div style={{ background: 'var(--brand-pale)', borderRadius: 14, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
              <picture><source srcSet="/logo-sm.webp" type="image/webp" /><img src="/logo.webp" alt="CCG" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'contain', flexShrink: 0 }} /></picture>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--brand-deep)', fontSize: '0.88rem' }}>Christian Church of God Mission</div>
                <div style={{ color: 'var(--text-light)', fontSize: '0.8rem', marginTop: 2 }}>
                  Re-established 1st October, 1954 · ccgm-pwa.vercel.app
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </>
  )
}
