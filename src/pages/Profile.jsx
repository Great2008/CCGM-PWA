import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import supabase from '../lib/supabase'

function timeAgo(ts) {
  const d = Math.floor((Date.now() - new Date(ts)) / 1000)
  if (d < 60) return 'just now'
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`
  return `${Math.floor(d / 86400)}d ago`
}

function Avatar({ profile, size = 96 }) {
  const init = (profile?.display_name || profile?.full_name || '?').charAt(0).toUpperCase()
  return profile?.avatar_url
    ? <img src={profile.avatar_url} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,var(--brand-base),var(--gold))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: size * 0.38, flexShrink: 0, fontFamily: 'var(--font-display)' }}>{init}</div>
}

const ROLE_LABELS = {
  admin: { label: 'Admin', color: '#7c3aed', bg: '#ede9fe' },
  member: { label: 'Member', color: 'var(--brand-mid)', bg: 'var(--brand-pale)' },
  pastor: { label: 'Pastor', color: '#b45309', bg: '#fef3c7' },
}

export default function Profile() {
  const { user, profile, updateProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const fileRef = useRef(null)

  const [tab, setTab] = useState('info')
  const [form, setForm] = useState({
    display_name: '', bio: '', phone: '', location: '',
    occupation: '', church_branch: '', birthday: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Activity state
  const [posts, setPosts] = useState([])
  const [prayers, setPrayers] = useState([])
  const [bookmarks, setBookmarks] = useState([])
  const [activityLoading, setActivityLoading] = useState(false)

  // Settings state
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)
  const [pwMsg, setPwMsg] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(false)

  // Branches from DB
  const [branches, setBranches] = useState([])

  // Redirect if not logged in
  useEffect(() => {
    if (user === null) navigate('/timeline')
  }, [user, navigate])

  // Populate form from profile
  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name || '',
        bio: profile.bio || '',
        phone: profile.phone || '',
        location: profile.location || '',
        occupation: profile.occupation || '',
        church_branch: profile.church_branch || '',
        birthday: profile.birthday || '',
      })
    }
  }, [profile])

  // Load branches from Supabase
  useEffect(() => {
    supabase.from('church_branches')
      .select('id, name, location')
      .eq('active', true)
      .order('name')
      .then(({ data }) => setBranches(data || []))
  }, [])

  // Load activity when tab switches
  useEffect(() => {
    if (tab !== 'activity' || !user) return
    setActivityLoading(true)
    Promise.all([
      supabase.from('timeline_posts')
        .select('id, body, post_type, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('prayer_requests')
        .select('id, body, created_at, prayer_counts')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase.from('devotional_bookmarks')
        .select('id, created_at, devotionals(title, date)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
    ]).then(([p, pr, bk]) => {
      setPosts(p.data || [])
      setPrayers(pr.data || [])
      setBookmarks(bk.data || [])
      setActivityLoading(false)
    })
  }, [tab, user])

  // Notification permission check
  useEffect(() => {
    if ('Notification' in window) {
      setNotifEnabled(Notification.permission === 'granted')
    }
  }, [])

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = `avatars/${user.id}.${ext}`
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (!upErr) {
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await updateProfile({ avatar_url: publicUrl })
    }
    setUploadingAvatar(false)
  }

  const handleSave = async () => {
    setSaving(true); setSaveError('')
    const payload = {
      ...form,
      birthday: form.birthday?.trim() || null,
    }
    const err = await updateProfile(payload)
    if (err) setSaveError(err.message || 'Failed to save.')
    else { setSaved(true); setTimeout(() => setSaved(false), 2500) }
    setSaving(false)
  }

  const handlePasswordChange = async () => {
    if (pwForm.next !== pwForm.confirm) { setPwMsg('Passwords do not match.'); return }
    if (pwForm.next.length < 8) { setPwMsg('Password must be at least 8 characters.'); return }
    setPwSaving(true); setPwMsg('')
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    if (error) setPwMsg(error.message)
    else { setPwMsg('✅ Password updated successfully.'); setPwForm({ current: '', next: '', confirm: '' }) }
    setPwSaving(false)
  }

  const handleNotifToggle = async () => {
    if (!('Notification' in window)) return
    if (Notification.permission === 'granted') {
      setNotifEnabled(false) // can't revoke programmatically, just toggle UI note
    } else {
      const perm = await Notification.requestPermission()
      setNotifEnabled(perm === 'granted')
    }
  }

  const POST_TYPE_COLORS = { update: 'var(--brand-light)', testimony: '#7c3aed', prayer: '#059669' }
  const POST_TYPE_LABELS = { update: '📝 Update', testimony: '🙌 Testimony', prayer: '🙏 Prayer' }

  const role = profile?.role || 'member'
  const roleInfo = ROLE_LABELS[role] || ROLE_LABELS.member
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  if (!user || !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--off-white)' }}>
        <div style={{ width: 40, height: 40, border: '3px solid var(--brand-pale)', borderTopColor: 'var(--brand-base)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--off-white)', paddingTop: 66 }}>

      {/* ── Hero header ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-deep) 0%, var(--brand-mid) 60%, #1a6b3c 100%)',
        padding: 'clamp(36px,6vw,64px) 5% 0',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative glow */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(ellipse at 80% 40%, rgba(245,158,11,0.12) 0%, transparent 60%), radial-gradient(ellipse at 20% 80%, rgba(37,99,235,0.1) 0%, transparent 50%)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'clamp(16px,3vw,32px)', flexWrap: 'wrap' }}>

            {/* Avatar */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ borderRadius: '50%', border: '4px solid rgba(255,255,255,0.2)', padding: 2, background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' }}>
                {uploadingAvatar
                  ? <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>⏳</div>
                  : <Avatar profile={profile} size={96} />
                }
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                title="Change avatar"
                style={{ position: 'absolute', bottom: 4, right: 4, width: 28, height: 28, borderRadius: '50%', background: 'var(--gold)', border: '2px solid var(--brand-deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '0.75rem', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}
              >📷</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
            </div>

            {/* Name + meta */}
            <div style={{ flex: 1, minWidth: 0, paddingBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                <h1 style={{ fontFamily: 'var(--font-display)', color: 'white', fontSize: 'clamp(1.4rem,3vw,2rem)', fontWeight: 900, lineHeight: 1.1 }}>
                  {profile.full_name || profile.display_name || 'Member'}
                </h1>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 12px', borderRadius: 20, background: roleInfo.bg, color: roleInfo.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {roleInfo.label}
                </span>
              </div>
              {profile.display_name && profile.display_name !== profile.full_name && (
                <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.85rem', marginBottom: 4 }}>@{profile.display_name}</div>
              )}
              <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                {memberSince && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                    🗓 Member since {memberSince}
                  </span>
                )}
                {profile.church_branch && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                    ⛪ {profile.church_branch}
                  </span>
                )}
                {profile.location && (
                  <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: 5 }}>
                    📍 {profile.location}
                  </span>
                )}
              </div>
              {profile.bio && (
                <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.88rem', marginTop: 8, lineHeight: 1.6, maxWidth: 480 }}>{profile.bio}</p>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: 0, marginTop: 8 }}>
            {[
              { id: 'info', label: '✏️ My Info' },
              { id: 'activity', label: '📋 My Activity' },
              { id: 'settings', label: '⚙️ Settings' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  padding: '12px 22px', border: 'none', cursor: 'pointer',
                  background: 'transparent', fontFamily: 'var(--font-body)',
                  fontSize: '0.84rem', fontWeight: tab === t.id ? 700 : 400,
                  color: tab === t.id ? 'white' : 'rgba(255,255,255,0.5)',
                  borderBottom: tab === t.id ? '3px solid var(--gold)' : '3px solid transparent',
                  transition: 'all 0.2s', whiteSpace: 'nowrap',
                }}
              >{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(24px,4vw,40px) 5% 60px' }}>

        {/* ─── MY INFO TAB ─── */}
        {tab === 'info' && (
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ background: 'white', borderRadius: 18, padding: 'clamp(20px,4vw,36px)', boxShadow: 'var(--shadow-sm)', border: '1px solid rgba(15,31,61,0.06)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.2rem', marginBottom: 24, paddingBottom: 14, borderBottom: '1px solid var(--brand-pale)' }}>Personal Information</h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
                <Field label="Display Name" value={form.display_name} onChange={v => setForm(f => ({ ...f, display_name: v }))} placeholder="How others see you" />
                <Field label="Phone" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+1 555 000 0000" type="tel" />
                <Field label="Location / City" value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} placeholder="e.g. Accra, Ghana" />
                <Field label="Occupation" value={form.occupation} onChange={v => setForm(f => ({ ...f, occupation: v }))} placeholder="e.g. Teacher, Engineer..." />
                <Field label="Birthday (optional)" value={form.birthday} onChange={v => setForm(f => ({ ...f, birthday: v }))} type="date" />

                {/* Church Branch dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Church Branch</label>
                  <select
                    value={form.church_branch}
                    onChange={e => setForm(f => ({ ...f, church_branch: e.target.value }))}
                    style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: 'white', fontSize: '0.9rem', color: form.church_branch ? 'var(--text-dark)' : '#9ca3af', fontFamily: 'var(--font-body)', outline: 'none', cursor: 'pointer', transition: 'border-color 0.2s', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%234a7c59' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36 }}
                    onFocus={e => e.target.style.borderColor = 'var(--brand-base)'}
                    onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                  >
                    <option value="">— Select your branch —</option>
                    {branches.length === 0 && (
                      <option disabled>Loading branches...</option>
                    )}
                    {branches.map(b => (
                      <option key={b.id} value={b.name}>{b.name}{b.location ? ` — ${b.location}` : ''}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bio */}
              <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Bio</label>
                <textarea
                  value={form.bio}
                  onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                  placeholder="A short bio about yourself..."
                  rows={3}
                  style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: '0.9rem', fontFamily: 'var(--font-body)', resize: 'vertical', outline: 'none', lineHeight: 1.6, color: 'var(--text-dark)', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = 'var(--brand-base)'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
              </div>

              {saveError && (
                <div style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '0.85rem' }}>
                  ❌ {saveError}
                </div>
              )}

              <div style={{ marginTop: 22, display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{ padding: '11px 32px', borderRadius: 40, background: saving ? '#9ca3af' : 'linear-gradient(135deg,var(--brand-base),var(--brand-mid))', color: 'white', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'var(--font-body)', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', boxShadow: saving ? 'none' : 'var(--shadow-sm)', transition: 'all 0.2s', letterSpacing: '0.06em' }}
                >
                  {saving ? 'Saving…' : '💾 Save Changes'}
                </button>
                {saved && <span style={{ color: 'var(--brand-base)', fontWeight: 700, fontSize: '0.88rem', animation: 'fadeIn 0.3s ease' }}>✅ Saved!</span>}
              </div>
            </div>
          </div>
        )}

        {/* ─── MY ACTIVITY TAB ─── */}
        {tab === 'activity' && (
          <div style={{ display: 'grid', gap: 24 }}>
            {activityLoading ? (
              <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-light)' }}>
                <div style={{ width: 36, height: 36, border: '3px solid var(--brand-pale)', borderTopColor: 'var(--brand-base)', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 14px' }} />
                Loading activity…
              </div>
            ) : (
              <>
                {/* Timeline Posts */}
                <ActivitySection title="🌐 Recent Timeline Posts" empty={posts.length === 0} emptyText="No posts yet.">
                  {posts.map(p => (
                    <div key={p.id} style={{ padding: '14px 18px', borderRadius: 12, background: '#f8faf8', border: '1px solid #e8f0e8', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: (POST_TYPE_COLORS[p.post_type] || 'var(--brand-light)') + '18', color: POST_TYPE_COLORS[p.post_type] || 'var(--brand-light)', flexShrink: 0, marginTop: 2 }}>
                        {POST_TYPE_LABELS[p.post_type] || '📝'}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'var(--text-mid)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{p.body}</p>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginTop: 4, display: 'block' }}>{timeAgo(p.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </ActivitySection>

                {/* Prayer Requests */}
                <ActivitySection title="🙏 My Prayer Requests" empty={prayers.length === 0} emptyText="No prayer requests submitted.">
                  {prayers.map(p => (
                    <div key={p.id} style={{ padding: '14px 18px', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', gap: 12, justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ color: 'var(--text-mid)', fontSize: '0.9rem', lineHeight: 1.6, margin: 0, flex: 1 }}>{p.body}</p>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.72rem' }}>{timeAgo(p.created_at)}</span>
                        {p.prayer_counts?.length > 0 && (
                          <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 700 }}>🙌 {p.prayer_counts.length} praying</span>
                        )}
                      </div>
                    </div>
                  ))}
                </ActivitySection>

                {/* Bookmarked Devotionals */}
                <ActivitySection title="🌅 Bookmarked Devotionals" empty={bookmarks.length === 0} emptyText="No bookmarked devotionals yet.">
                  {bookmarks.map(b => (
                    <div key={b.id} style={{ padding: '14px 18px', borderRadius: 12, background: '#fffbeb', border: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-dark)', fontSize: '0.9rem', fontWeight: 600 }}>{b.devotionals?.title || 'Devotional'}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{b.devotionals?.date || ''}</span>
                    </div>
                  ))}
                </ActivitySection>
              </>
            )}
          </div>
        )}

        {/* ─── SETTINGS TAB ─── */}
        {tab === 'settings' && (
          <div style={{ display: 'grid', gap: 20 }}>

            {/* Change Password */}
            <div style={{ background: 'white', borderRadius: 18, padding: 'clamp(20px,4vw,32px)', boxShadow: 'var(--shadow-sm)', border: '1px solid rgba(15,31,61,0.06)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.15rem', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--brand-pale)' }}>🔐 Change Password</h2>
              <div style={{ display: 'grid', gap: 14, maxWidth: 400 }}>
                <Field label="New Password" value={pwForm.next} onChange={v => setPwForm(f => ({ ...f, next: v }))} type="password" placeholder="At least 8 characters" />
                <Field label="Confirm New Password" value={pwForm.confirm} onChange={v => setPwForm(f => ({ ...f, confirm: v }))} type="password" placeholder="Repeat new password" />
              </div>
              {pwMsg && (
                <div style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, background: pwMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${pwMsg.startsWith('✅') ? '#bbf7d0' : '#fecaca'}`, color: pwMsg.startsWith('✅') ? '#059669' : '#dc2626', fontSize: '0.85rem' }}>
                  {pwMsg}
                </div>
              )}
              <button
                onClick={handlePasswordChange}
                disabled={pwSaving || !pwForm.next || !pwForm.confirm}
                style={{ marginTop: 18, padding: '10px 28px', borderRadius: 40, background: (pwSaving || !pwForm.next) ? '#9ca3af' : 'var(--brand-mid)', color: 'white', fontWeight: 700, fontSize: '0.86rem', fontFamily: 'var(--font-body)', border: 'none', cursor: (pwSaving || !pwForm.next) ? 'not-allowed' : 'pointer', transition: 'all 0.2s' }}
              >{pwSaving ? 'Updating…' : 'Update Password'}</button>
            </div>

            {/* Push Notifications */}
            <div style={{ background: 'white', borderRadius: 18, padding: 'clamp(20px,4vw,32px)', boxShadow: 'var(--shadow-sm)', border: '1px solid rgba(15,31,61,0.06)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.15rem', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--brand-pale)' }}>🔔 Push Notifications</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)', fontSize: '0.95rem', marginBottom: 4 }}>Receive push notifications</div>
                  <div style={{ color: 'var(--text-light)', fontSize: '0.82rem' }}>
                    {notifEnabled ? 'Notifications are enabled for this device.' : 'Enable to receive alerts from CCG World.'}
                  </div>
                </div>
                <button
                  onClick={handleNotifToggle}
                  style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', background: notifEnabled ? 'var(--brand-base)' : '#d1d5db', position: 'relative', transition: 'background 0.25s', flexShrink: 0 }}
                >
                  <span style={{ position: 'absolute', top: 3, left: notifEnabled ? 26 : 3, width: 22, height: 22, borderRadius: '50%', background: 'white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.25s' }} />
                </button>
              </div>
            </div>

            {/* Account info */}
            <div style={{ background: 'white', borderRadius: 18, padding: 'clamp(20px,4vw,32px)', boxShadow: 'var(--shadow-sm)', border: '1px solid rgba(15,31,61,0.06)' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.15rem', marginBottom: 18, paddingBottom: 12, borderBottom: '1px solid var(--brand-pale)' }}>👤 Account</h2>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-light)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Email</div>
                  <div style={{ color: 'var(--text-dark)', fontSize: '0.95rem' }}>{user?.email}</div>
                </div>
                <button
                  onClick={() => { signOut(); navigate('/') }}
                  style={{ padding: '10px 24px', borderRadius: 40, border: '1.5px solid #e2e8f0', background: 'transparent', color: 'var(--text-mid)', fontWeight: 700, fontSize: '0.84rem', fontFamily: 'var(--font-body)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#f8faf8'; e.currentTarget.style.borderColor = 'var(--brand-base)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = '#e2e8f0' }}
                >Sign Out</button>
              </div>
            </div>

            {/* Danger zone */}
            <div style={{ background: '#fff5f5', borderRadius: 18, padding: 'clamp(20px,4vw,32px)', boxShadow: 'var(--shadow-sm)', border: '1.5px solid #fecaca' }}>
              <h2 style={{ fontFamily: 'var(--font-display)', color: '#dc2626', fontSize: '1.15rem', marginBottom: 8 }}>⚠️ Danger Zone</h2>
              <p style={{ color: '#7f1d1d', fontSize: '0.85rem', marginBottom: 18, lineHeight: 1.6 }}>Deleting your account is permanent and cannot be undone. All your posts, prayers, and data will be removed.</p>
              {!deleteConfirm ? (
                <button
                  onClick={() => setDeleteConfirm(true)}
                  style={{ padding: '10px 24px', borderRadius: 40, border: '1.5px solid #fca5a5', background: 'transparent', color: '#dc2626', fontWeight: 700, fontSize: '0.84rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                >Delete My Account</button>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.85rem', color: '#dc2626', fontWeight: 600 }}>Are you sure? This cannot be undone.</span>
                  <button
                    onClick={async () => {
                      await supabase.auth.admin?.deleteUser(user.id).catch(() => {})
                      await signOut()
                      navigate('/')
                    }}
                    style={{ padding: '9px 22px', borderRadius: 40, background: '#dc2626', border: 'none', color: 'white', fontWeight: 700, fontSize: '0.84rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                  >Yes, delete</button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    style={{ padding: '9px 22px', borderRadius: 40, border: '1.5px solid #e2e8f0', background: 'transparent', color: 'var(--text-mid)', fontWeight: 600, fontSize: '0.84rem', fontFamily: 'var(--font-body)', cursor: 'pointer' }}
                  >Cancel</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
      `}</style>
    </div>
  )
}

// ── Reusable field component ──
function Field({ label, value, onChange, placeholder, type = 'text' }) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{ padding: '10px 14px', borderRadius: 10, border: `1.5px solid ${focused ? 'var(--brand-base)' : '#e2e8f0'}`, fontSize: '0.9rem', fontFamily: 'var(--font-body)', outline: 'none', color: 'var(--text-dark)', background: 'white', transition: 'border-color 0.2s' }}
      />
    </div>
  )
}

// ── Activity section wrapper ──
function ActivitySection({ title, children, empty, emptyText }) {
  return (
    <div style={{ background: 'white', borderRadius: 18, padding: 'clamp(18px,3vw,28px)', boxShadow: 'var(--shadow-sm)', border: '1px solid rgba(15,31,61,0.06)' }}>
      <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--brand-deep)', fontSize: '1.05rem', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--brand-pale)' }}>{title}</h3>
      {empty
        ? <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', textAlign: 'center', padding: '20px 0' }}>{emptyText}</p>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
      }
    </div>
  )
}
