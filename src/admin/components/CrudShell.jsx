import { useState } from 'react'

export default function CrudShell({ title, icon, subtitle, form, list, onNew }) {
  return (
    <div>
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:24,flexWrap:'wrap',gap:14 }}>
        <div>
          <h1 style={{ fontFamily:'var(--font-display)',color:'var(--green-deep)',fontSize:'1.7rem',margin:'0 0 4px' }}>{icon} {title}</h1>
          {subtitle && <p style={{ color:'var(--text-light)',margin:0,fontSize:'0.86rem' }}>{subtitle}</p>}
        </div>
        {onNew && <button className="btn btn-green" onClick={onNew} style={{ padding:'10px 22px',fontSize:'0.85rem' }}>+ New {title.replace(/s$/,'')}</button>}
      </div>
      {form}
      {list}
    </div>
  )
}

export function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:9999,padding:'40px 16px',overflowY:'auto' }}>
      <div style={{ background:'white',borderRadius:16,width:'100%',maxWidth:wide?760:600,boxShadow:'0 24px 80px rgba(0,0,0,0.25)' }}>
        <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'20px 24px',borderBottom:'1px solid #f0f0f0' }}>
          <h2 style={{ margin:0,color:'var(--green-deep)',fontFamily:'var(--font-display)',fontSize:'1.2rem' }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none',border:'none',cursor:'pointer',fontSize:'1.3rem',color:'var(--text-light)',lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:'24px' }}>{children}</div>
      </div>
    </div>
  )
}

export function Confirm({ message, onConfirm, onCancel, loading }) {
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.45)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:9999,padding:16 }}>
      <div style={{ background:'white',borderRadius:16,padding:32,maxWidth:360,width:'100%',textAlign:'center',boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize:'2.5rem',marginBottom:12 }}>⚠️</div>
        <p style={{ color:'var(--text-dark)',marginBottom:24,lineHeight:1.6 }}>{message}</p>
        <div style={{ display:'flex',gap:12,justifyContent:'center' }}>
          <button className="btn btn-green" onClick={onConfirm} disabled={loading}>{loading?'Deleting...':'Yes, Delete'}</button>
          <button className="btn btn-outline-green" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
