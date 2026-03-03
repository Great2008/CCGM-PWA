import { useState } from 'react'
import supabase from '../../lib/supabase'

export default function AdminLogin({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pass, setPass]   = useState('')
  const [err, setErr]     = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async e => {
    e.preventDefault(); setErr(''); setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass })
    if (error) { setErr(error.message); setLoading(false); return }
    // Check admin role
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
    if (profile?.role !== 'admin') {
      await supabase.auth.signOut()
      setErr('Access denied. This account does not have admin privileges.')
      setLoading(false); return
    }
    onLogin()
  }

  return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,var(--brand-deep) 0%,var(--brand-mid) 100%)', padding:20 }}>
      <div style={{ background:'white', borderRadius:20, padding:'44px 40px', width:'100%', maxWidth:420, boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <img src="/logo.png" alt="CCG World" style={{ width:72, height:72, objectFit:'contain', margin:'0 auto 16px', display:'block', filter:'drop-shadow(0 4px 12px rgba(0,0,0,0.15))' }} />
          <h1 style={{ fontFamily:'var(--font-display)', color:'var(--brand-deep)', fontSize:'1.6rem', margin:'0 0 4px' }}>CCG World Admin</h1>
          <p style={{ color:'var(--text-light)', fontSize:'0.85rem', margin:0 }}>Sign in with your admin account</p>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="admin@ccgworld.org" required autoFocus /></div>
          <div className="form-group"><label>Password</label><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder="••••••••" required /></div>
          {err&&<div style={{ background:'#fff5f5', border:'1px solid #fecaca', borderRadius:8, padding:'10px 14px', color:'#dc2626', fontSize:'0.85rem', marginBottom:16 }}>❌ {err}</div>}
          <button type="submit" className="btn btn-blue" style={{ width:'100%', justifyContent:'center', padding:'13px' }} disabled={loading}>
            {loading?'⏳ Signing in...':'🔐 Sign In'}
          </button>
        </form>
        <p style={{ textAlign:'center', marginTop:24, fontSize:'0.78rem', color:'var(--text-light)', lineHeight:1.7 }}>
          Create your admin user in Supabase Dashboard<br/>then set their role to <code style={{ background:'#f0f9ff', padding:'1px 6px', borderRadius:4 }}>admin</code> in the profiles table.
        </p>
      </div>
    </div>
  )
}
