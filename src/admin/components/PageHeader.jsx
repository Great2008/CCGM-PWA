export default function PageHeader({ icon, title, subtitle, action }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
      <div>
        <h1 style={{ fontFamily: 'var(--font-display)', color: 'var(--green-deep)', fontSize: '1.8rem', margin: '0 0 4px' }}>
          {icon} {title}
        </h1>
        {subtitle && <p style={{ color: 'var(--text-light)', margin: 0, fontSize: '0.9rem' }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}
