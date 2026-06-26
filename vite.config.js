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
          // Admin pages — never loaded by regular users
          if (id.includes('/src/admin/')) {
            return 'admin'
          }
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
