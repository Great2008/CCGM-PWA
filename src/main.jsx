import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

// Route to admin panel if URL starts with /admin
if (window.location.pathname.startsWith('/admin')) {
  import('./admin/AdminApp').then(({ default: AdminApp }) => {
    createRoot(document.getElementById('root')).render(<StrictMode><AdminApp /></StrictMode>)
  })
} else {
  import('./App').then(({ default: App }) => {
    createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
  })
}
