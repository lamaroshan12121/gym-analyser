import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Pass any request starting with /api on to the backend (vercel dev)
      '/api': 'http://localhost:3000',
    },
  },
})