import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/metrics/mono':  { target: 'http://localhost:3001', rewrite: () => '/metrics', changeOrigin: true },
      '/metrics/ms':    { target: 'http://localhost:3002', rewrite: () => '/metrics', changeOrigin: true },
      '/metrics/hybrid':{ target: 'http://localhost:3003', rewrite: () => '/metrics', changeOrigin: true },
    }
  }
})
