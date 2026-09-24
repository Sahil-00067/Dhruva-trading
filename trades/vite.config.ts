import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    // Forward API calls to the local FastAPI backtest engine (backend/app/main.py).
    // If the engine isn't running, the app falls back to demo data client-side.
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
