import { useState, useEffect } from 'react'
import supabaseAdmin from '../../lib/supabase'

function initials(m) {
  return (m?.display_name || m?.full_name || '?').charAt(0).toUpperCase()
}

export default function AdminMemberDirectory() {
  const [members, setMembers] = useState([])
  const [branches, setBranches] = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [openStates, setOpenStates]     = useState({}) // state key → bool
  const [openBranches, setOpenBranches] = useState({}) // branch key → bool

  useEffect(() => {
    Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('id, full_name, display_name, email, phone, church_branch, role')
        .order('full_name'),
      supabaseAdmin
        .from('church_branches')
        .select('id, name, location, country')
        .order('name'),
    ]).then(([{ data: m }, { data: b }]) => {
      setMembers(m || [])
      setBranches(b || [])
      // Default all states + branches open
      const stateMap = {}
      const branchMap = {}
      ;(b || []).forEach(branch => {
        const state = branch.location || 'Unknown State'
        stateMap[state] = true
        branchMap[branch.name] = true
      })
      stateMap['No Branch'] = true
      setOpenStates(stateMap)
      setOpenBranches(branchMap)
      setLoading(false)
    })
  }, [])

  const toggleState  = s => setOpenStates(p  => ({ ...p, [s]: !p[s] }))
  const toggleBranch = b => setOpenBranches(p => ({ ...p, [b]: !p[b] }))

  // Filter members by search
  const q = search.toLowerCase()
  const filtered = members.filter(m =>
    !q ||
    (m.full_name   || '').toLowerCase().includes(q) ||
    (m.display_name|| '').toLowerCase().includes(q) ||
    (m.email       || '').toLowerCase().includes(q) ||
    (m.phone       || '').toLowerCase().includes(q) ||
    (m.church_branch || '').toLowerCase().includes(q)
  )

  // Build state → branch → members tree
  const branchByName = Object.fromEntries(branches.map(b => [b.name, b]))

  // Group members by their church_branch
  const byBranch = {}
  const noBranch = []
  filtered.forEach(m => {
    if (m.church_branch && branchByName[m.church_branch]) {
      if (!byBranch[m.church_branch]) byBranch[m.church_branch] = []
      byBranch[m.church_branch].push(m)
    } else {
      noBranch.push(m)
    }
  })

  // Group branches by state (location field)
  const byState = {}
  branches.forEach(b => {
    if (!byBranch[b.name] || byBranch[b.name].length === 0) return // skip empty
    const state = b.location || 'Unknown State'
    if (!byState[state]) byState[state] = []
    byState[state].push(b)
  })
  const states = Object.keys(byState).sort()

  const totalShown = filtered.length

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>
      <div style={{ width: 36, height: 36, border: '3px solid var(--brand-pale)', borderTopColor: 'var(--brand-base)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
      Loading directory…
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.7rem', margin: '0 0 4px' }}>
          🗂 Member Directory
        </h1>
        <p style={{ color: 'var(--text-light)', fontSize: '0.86rem', margin: 0 }}>
          {totalShown} member{totalShown !== 1 ? 's' : ''} · grouped by state and branch
        </p>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', maxWidth: 420, marginBottom: 28 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-light)', fontSize: '1rem', pointerEvents: 'none' }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, phone or branch…"
          style={{ width: '100%', padding: '11px 14px 11px 42px', borderRadius: 30, border: '1.5px solid #e2e8f0', fontFamily: 'var(--font-body)', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
          onFocus={e => e.target.style.borderColor = 'var(--brand-base)'}
          onBlur={e => e.target.style.borderColor = '#e2e8f0'}
        />
        {search && (
          <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', fontSize: '1rem', lineHeight: 1 }}>✕</button>
        )}
      </div>

      {totalShown === 0 && (
        <div style={{ background: 'white', borderRadius: 16, padding: '48px 24px', textAlign: 'center', color: 'var(--text-light)', boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0' }}>
          No members match your search.
        </div>
      )}

      {/* States loop */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {states.map(state => (
          <div key={state} style={{ background: 'white', borderRadius: 18, boxShadow: 'var(--shadow-sm)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>

            {/* State header */}
            <button
              onClick={() => toggleState(state)}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', background: 'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', gap: 10 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.1rem' }}>📍</span>
                <span style={{ color: 'white', fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: '1rem' }}>{state}</span>
                <span style={{ background: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                  {byState[state].reduce((acc, b) => acc + (byBranch[b.name]?.length || 0), 0)} members
                </span>
              </div>
              <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', flexShrink: 0 }}>{openStates[state] ? '▲' : '▼'}</span>
            </button>

            {/* Branches within state */}
            {openStates[state] && (
              <div style={{ padding: '12px 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {byState[state].map(branch => (
                  <div key={branch.name} style={{ border: '1.5px solid var(--brand-pale)', borderRadius: 14, overflow: 'hidden' }}>

                    {/* Branch header */}
                    <button
                      onClick={() => toggleBranch(branch.name)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'var(--brand-mist)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)', gap: 10 }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: '1rem' }}>⛪</span>
                        <span style={{ color: 'var(--brand-deep)', fontWeight: 700, fontSize: '0.92rem' }}>{branch.name}</span>
                        {branch.country && (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>· {branch.country}</span>
                        )}
                        <span style={{ background: 'var(--brand-pale)', color: 'var(--brand-mid)', fontSize: '0.68rem', fontWeight: 700, padding: '2px 9px', borderRadius: 20 }}>
                          {byBranch[branch.name]?.length || 0}
                        </span>
                      </div>
                      <span style={{ color: 'var(--text-light)', fontSize: '0.8rem', flexShrink: 0 }}>{openBranches[branch.name] ? '▲' : '▼'}</span>
                    </button>

                    {/* Member rows */}
                    {openBranches[branch.name] && (
                      <div>
                        {(byBranch[branch.name] || []).length === 0 ? (
                          <div style={{ padding: '14px 20px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No members in this branch.</div>
                        ) : (
                          <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px solid var(--brand-pale)' }}>
                                  {['Member', 'Email', 'Phone'].map(h => (
                                    <th key={h} style={{ padding: '9px 18px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: 'var(--brand-mid)', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap', background: '#fafcfa' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {(byBranch[branch.name] || []).map((m, i, arr) => (
                                  <tr key={m.id}
                                    style={{ borderBottom: i < arr.length - 1 ? '1px solid #f1f5f1' : 'none', transition: 'background 0.12s' }}
                                    onMouseEnter={e => e.currentTarget.style.background = '#f5fbf5'}
                                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                                  >
                                    <td style={{ padding: '11px 18px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-light),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0 }}>
                                          {initials(m)}
                                        </div>
                                        <div>
                                          <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.88rem' }}>{m.full_name || m.display_name || '—'}</div>
                                          {m.role === 'admin' && (
                                            <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#7c3aed', background: '#ede9fe', padding: '1px 7px', borderRadius: 10 }}>Admin</span>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td style={{ padding: '11px 18px', color: 'var(--text-mid)', fontSize: '0.85rem' }}>
                                      {m.email ? (
                                        <a href={`mailto:${m.email}`} style={{ color: 'var(--brand-mid)', textDecoration: 'none', fontWeight: 500 }}
                                          onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                                          onMouseLeave={e => e.target.style.textDecoration = 'none'}
                                        >{m.email}</a>
                                      ) : '—'}
                                    </td>
                                    <td style={{ padding: '11px 18px', color: 'var(--text-mid)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                                      {m.phone ? (
                                        <a href={`tel:${m.phone}`} style={{ color: 'var(--text-mid)', textDecoration: 'none' }}
                                          onMouseEnter={e => e.target.style.color = 'var(--brand-base)'}
                                          onMouseLeave={e => e.target.style.color = 'var(--text-mid)'}
                                        >{m.phone}</a>
                                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {/* Members with no branch assigned */}
        {noBranch.length > 0 && (
          <div style={{ background: 'white', borderRadius: 18, boxShadow: 'var(--shadow-sm)', border: '1.5px dashed #e2e8f0', overflow: 'hidden' }}>
            <button
              onClick={() => toggleState('No Branch')}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 22px', background: '#f8fafc', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: '1.1rem' }}>❓</span>
                <span style={{ color: 'var(--text-mid)', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>No Branch Assigned</span>
                <span style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.72rem', fontWeight: 700, padding: '2px 10px', borderRadius: 20 }}>
                  {noBranch.length} members
                </span>
              </div>
              <span style={{ color: 'var(--text-light)', fontSize: '0.9rem' }}>{openStates['No Branch'] ? '▲' : '▼'}</span>
            </button>

            {openStates['No Branch'] && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      {['Member', 'Email', 'Phone'].map(h => (
                        <th key={h} style={{ padding: '9px 18px', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.12em', whiteSpace: 'nowrap', background: '#fafcff' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {noBranch.map((m, i, arr) => (
                      <tr key={m.id}
                        style={{ borderBottom: i < arr.length - 1 ? '1px solid #f8fafc' : 'none', transition: 'background 0.12s' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#f8faff'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <td style={{ padding: '11px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#94a3b8,#64748b)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.85rem', flexShrink: 0 }}>
                              {initials(m)}
                            </div>
                            <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.88rem' }}>{m.full_name || m.display_name || '—'}</span>
                          </div>
                        </td>
                        <td style={{ padding: '11px 18px', fontSize: '0.85rem' }}>
                          {m.email ? (
                            <a href={`mailto:${m.email}`} style={{ color: 'var(--brand-mid)', textDecoration: 'none' }}>{m.email}</a>
                          ) : '—'}
                        </td>
                        <td style={{ padding: '11px 18px', color: 'var(--text-mid)', fontSize: '0.85rem' }}>
                          {m.phone || <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
