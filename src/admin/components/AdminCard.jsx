export default function AdminCard({ children, style = {} }) {
  return (
    <div style={{ background: 'white', borderRadius: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.07)', padding: 24, ...style }}>
      {children}
    </div>
  )
}
