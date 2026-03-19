import { Link } from 'react-router-dom'

const sections = [
  {
    icon: '✝️',
    title: 'Honour God in Everything',
    body: 'This is first and foremost a Christian community. All content should reflect the values of the Christian faith — love, truth, respect, and edification. Before posting, ask yourself: does this glorify God?',
  },
  {
    icon: '💬',
    title: 'Speak the Truth in Love',
    body: 'You are welcome to share opinions, testimonies, and reflections. All discourse must be respectful and grounded in love. Disagreements are natural — hostility is not. "Speaking the truth in love, we will in all things grow up into him who is the head, that is, Christ." — Ephesians 4:15',
  },
  {
    icon: '✅',
    title: 'What Is Welcome',
    list: [
      'Testimonies, prayer requests, and praise reports',
      'Encouraging words, devotionals, and scripture',
      'Church announcements and event updates',
      'Questions about faith, scripture, and community life',
      'Respectful discussion of Christian topics',
    ],
  },
  {
    icon: '🚫',
    title: 'What Is Not Allowed',
    body: 'The following may result in post removal and suspension:',
    list: [
      'Harassment or bullying — targeting any individual with mockery, threats, or persistent negativity',
      'Inappropriate content — profanity, sexual content, or anything unsuitable in a church setting',
      'Spam — repetitive posts, irrelevant promotional links, or off-topic content',
      'False information — deliberately spreading misinformation about the church, leadership, or members',
      'Divisive content — posts intended to cause strife or faction within the body',
      'Defamation — making false or damaging statements about any member or organisation',
    ],
    accent: '#dc2626',
  },
  {
    icon: '🔒',
    title: "Protect One Another's Privacy",
    body: "Do not share personal information about other members without their consent. Photos of minors require parental permission. What is shared in vulnerability should be treated with discretion.",
  },
  {
    icon: '🚩',
    title: 'Reporting',
    body: 'If you see a post that violates these guidelines, use the 🚩 report button. Do not engage or argue — simply report and move on. Accumulated reports are reviewed by our admin team. Repeated or serious violations will result in suspension. Suspended members may request a review through the suspension notice on their account.',
  },
]

const consequences = [
  { level: 'Minor / first offence', action: 'Post removed, warning issued', color: '#f59e0b' },
  { level: 'Repeated or moderate', action: 'Temporary or indefinite suspension', color: '#f97316' },
  { level: 'Severe (harassment, abuse)', action: 'Immediate indefinite suspension', color: '#dc2626' },
  { level: '10 unique reports on a single post', action: 'Automatic suspension pending admin review', color: '#7c3aed' },
]

export default function Guidelines() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream, #fdfaf6)', paddingTop: 66 }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, var(--brand-deep, #0a2612), var(--brand-mid, #166534))',
        padding: 'clamp(60px, 10vw, 100px) 5% 56px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative cross watermark */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.04, fontSize: '20rem', pointerEvents: 'none', userSelect: 'none' }}>✝</div>
        <span style={{ display: 'inline-block', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.22em', color: 'var(--gold, #d4af37)', textTransform: 'uppercase', marginBottom: 14, background: 'rgba(212,175,55,0.12)', padding: '5px 16px', borderRadius: 20, border: '1px solid rgba(212,175,55,0.25)' }}>
          CCG World
        </span>
        <h1 style={{ fontFamily: 'var(--font-display, Georgia)', fontWeight: 900, fontSize: 'clamp(2rem, 5vw, 3.2rem)', color: 'white', margin: '0 0 16px', lineHeight: 1.15 }}>
          Community Guidelines
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.7)', maxWidth: 560, margin: '0 auto 28px', lineHeight: 1.8, fontSize: 'clamp(0.9rem, 2.5vw, 1.05rem)' }}>
          A Spirit-filled fellowship committed to worship, growth, and service in the name of Jesus Christ. These guidelines protect that vision.
        </p>
        <Link to="/timeline" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 24px', borderRadius: 30, background: 'rgba(255,255,255,0.12)', color: 'white', textDecoration: 'none', fontWeight: 600, fontSize: '0.88rem', border: '1px solid rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
          ← Back to Timeline
        </Link>
      </div>

      {/* Scripture banner */}
      <div style={{ background: 'var(--brand-pale, #e8f5e9)', borderBottom: '1px solid var(--brand-light, #4caf50)22', padding: '18px 5%', textAlign: 'center' }}>
        <p style={{ color: 'var(--brand-deep, #0a2612)', fontSize: '0.92rem', fontStyle: 'italic', margin: 0, lineHeight: 1.7 }}>
          "Let no corrupting talk come out of your mouths, but only such as is good for building up, as fits the occasion, that it may give grace to those who hear." — <strong>Ephesians 4:29</strong>
        </p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 5% 80px' }}>

        {/* Sections */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {sections.map((s, i) => (
            <div key={i} style={{
              background: 'white',
              borderRadius: 16,
              padding: '24px 28px',
              boxShadow: '0 2px 16px rgba(10,38,18,0.06)',
              border: '1px solid rgba(10,38,18,0.07)',
              borderLeft: `4px solid ${s.accent || 'var(--brand-mid, #166534)'}`,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: s.body || s.list ? 12 : 0 }}>
                <span style={{ fontSize: '1.4rem' }}>{s.icon}</span>
                <h2 style={{ fontFamily: 'var(--font-display, Georgia)', fontSize: '1.1rem', color: 'var(--brand-deep, #0a2612)', margin: 0, fontWeight: 800 }}>{s.title}</h2>
              </div>
              {s.body && <p style={{ color: 'var(--text-mid, #4b5563)', lineHeight: 1.75, margin: 0, marginBottom: s.list ? 12 : 0, fontSize: '0.92rem' }}>{s.body}</p>}
              {s.list && (
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {s.list.map((item, j) => (
                    <li key={j} style={{ color: 'var(--text-mid, #4b5563)', lineHeight: 1.7, fontSize: '0.92rem' }}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Consequences table */}
        <div style={{ marginTop: 32, background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 2px 16px rgba(10,38,18,0.06)', border: '1px solid rgba(10,38,18,0.07)' }}>
          <div style={{ background: 'linear-gradient(135deg,var(--brand-deep,#0a2612),var(--brand-mid,#166534))', padding: '18px 24px' }}>
            <h2 style={{ fontFamily: 'var(--font-display,Georgia)', color: 'white', margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>⚖️ Consequences</h2>
          </div>
          <div>
            {consequences.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '14px 24px', borderBottom: i < consequences.length - 1 ? '1px solid #f1f5f9' : 'none', flexWrap: 'wrap', gap: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark,#111)', fontSize: '0.88rem' }}>{c.level}</div>
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, padding: '4px 12px', borderRadius: 20, background: c.color + '15', color: c.color, whiteSpace: 'nowrap' }}>
                  {c.action}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <div style={{ marginTop: 32, textAlign: 'center', padding: '24px', background: 'var(--brand-pale,#e8f5e9)', borderRadius: 16, border: '1px solid var(--brand-light,#4caf50)22' }}>
          <p style={{ color: 'var(--brand-deep,#0a2612)', fontSize: '0.88rem', lineHeight: 1.7, margin: '0 0 16px' }}>
            We believe this community can be a powerful space for edification, fellowship, and the advancement of God's kingdom. These guidelines exist not to restrict, but to protect that vision.
          </p>
          <p style={{ color: 'var(--text-light,#9ca3af)', fontSize: '0.75rem', margin: 0 }}>
            Last updated: March 2026 — Christian Church of God Mission
          </p>
        </div>

      </div>
    </div>
  )
}
