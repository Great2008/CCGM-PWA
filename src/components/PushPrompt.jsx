import { useState } from 'react'
import { usePushNotifications } from '../hooks/usePushNotifications'

export default function PushPrompt({ user, compact = false }) {
  const { supported, permission, subscribed, loading, subscribe, unsubscribe } = usePushNotifications(user)
  const [msg, setMsg] = useState('')
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('push-dismissed') === '1')

  if (!supported || permission === 'denied') return null
  if (subscribed && !compact) return null // Already subscribed — nothing to show on banner

  const handleSubscribe = async () => {
    const result = await subscribe()
    if (result.success) setMsg('✅ You\'ll be notified when we go live!')
    else if (result.error) setMsg('❌ ' + result.error)
  }

  const dismiss = () => {
    localStorage.setItem('push-dismissed', '1')
    setDismissed(true)
  }

  // COMPACT version — for settings / profile page
  if (compact) {
    return (
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,padding:'14px 18px',background:subscribed?'#f0fdf4':'var(--brand-pale)',borderRadius:12,border:`1.5px solid ${subscribed?'#bbf7d0':'#bfdbfe'}`}}>
        <div>
          <div style={{fontWeight:700,color:'var(--brand-deep)',fontSize:'0.88rem',marginBottom:2}}>
            {subscribed ? '🔔 Notifications On' : '🔕 Notifications Off'}
          </div>
          <div style={{fontSize:'0.75rem',color:'var(--text-light)'}}>
            {subscribed ? 'You\'ll be notified when CCG World goes live' : 'Get notified when we go live or post announcements'}
          </div>
        </div>
        <button onClick={subscribed?unsubscribe:handleSubscribe} disabled={loading}
          style={{padding:'8px 16px',borderRadius:20,border:'none',cursor:'pointer',fontFamily:'var(--font-body)',fontWeight:700,fontSize:'0.8rem',
            background:subscribed?'#dc2626':'var(--brand-light)',color:'white',flexShrink:0,transition:'opacity 0.2s',opacity:loading?0.6:1}}>
          {loading?'⏳...':subscribed?'Turn Off':'Enable'}
        </button>
      </div>
    )
  }

  // BANNER version — shows at bottom of page
  if (dismissed || permission === 'granted') return null

  return (
    <div style={{
      position:'fixed',bottom:0,left:0,right:0,zIndex:9000,
      background:'linear-gradient(135deg,var(--brand-deep),var(--brand-mid))',
      padding:'16px 20px',
      boxShadow:'0 -4px 24px rgba(0,0,0,0.25)',
      display:'flex',alignItems:'center',gap:14,flexWrap:'wrap',
      animation:'slideUp 0.4s ease',
    }}>
      <div style={{fontSize:'1.8rem',flexShrink:0}}>🔔</div>
      <div style={{flex:1,minWidth:200}}>
        <div style={{fontWeight:700,color:'white',fontSize:'0.9rem',marginBottom:2}}>
          Get notified when we go live!
        </div>
        <div style={{color:'rgba(255,255,255,0.7)',fontSize:'0.78rem'}}>
          Enable push notifications to know the moment our service starts.
        </div>
        {msg && <div style={{marginTop:4,fontSize:'0.78rem',color:msg.startsWith('✅')?'#86efac':'#fca5a5'}}>{msg}</div>}
      </div>
      <div style={{display:'flex',gap:8,flexShrink:0}}>
        <button onClick={handleSubscribe} disabled={loading}
          style={{padding:'9px 20px',borderRadius:30,background:'var(--gold)',border:'none',color:'var(--brand-deep)',fontWeight:900,fontSize:'0.82rem',cursor:'pointer',fontFamily:'var(--font-body)',opacity:loading?0.7:1}}>
          {loading?'⏳ Enabling...':'🔔 Enable'}
        </button>
        <button onClick={dismiss}
          style={{padding:'9px 14px',borderRadius:30,background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.2)',color:'rgba(255,255,255,0.7)',fontSize:'0.82rem',cursor:'pointer',fontFamily:'var(--font-body)'}}>
          Not now
        </button>
      </div>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>
    </div>
  )
}
