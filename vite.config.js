import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  base: './',

  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Core React — always needed
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor'
          }
          // Supabase — always needed for auth
          if (id.includes('node_modules/@supabase')) {
            return 'supabase'
          }
          // jsPDF + fabric — only on /certificate page
          if (id.includes('jspdf') || id.includes('fabric') || id.includes('html2canvas')) {
            return 'pdf-cert'
          }
          // Note: admin is NOT split here — it's dynamically imported in main.jsx
          // only when pathname starts with /admin. Splitting it here causes browsers
          // to prefetch it via modulepreload hints even on non-admin pages.
        },
      },
    },
  },

  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
