import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  // Capacitor requires './' base for file:// protocol on device
  base: './',

  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 1000,
    // Enable CSS code splitting for smaller initial CSS payload
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor':  ['react', 'react-dom', 'react-router-dom'],
          'supabase':      ['@supabase/supabase-js'],
          // Split heavy admin pages — never loaded by regular users
          'admin':         ['./src/admin/AdminApp'],
          // Split certificate/PDF generation — only loaded on /certificate
          'pdf-cert':      ['./src/pages/Certificate'],
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
