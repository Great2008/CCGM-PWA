import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  base: './',

  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    // cssCodeSplit:false keeps ALL styles in one file — avoids per-route CSS chunks
    // which add extra network requests. The main CSS is already small (3.1 KiB).
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core — always needed, split so it caches independently
          if (id.includes('node_modules/react-dom')) return 'react-dom'
          if (id.includes('node_modules/react-router-dom')) return 'react-router'
          if (id.includes('node_modules/react')) return 'react-core'

          // Supabase — needed for auth on all pages but can load slightly deferred
          if (id.includes('node_modules/@supabase')) return 'supabase'

          // jsPDF/fabric — do NOT split into named chunk
          // They are already dynamically imported inside Certificate.jsx
          // Putting them in manualChunks causes Vite to emit modulepreload hints
          // which load the chunk on every page, not just /certificate
          // Leave them in their own auto-generated chunk — no hint emitted
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
