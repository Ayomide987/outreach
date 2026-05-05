import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  plugins: [react()],
  server: { proxy: { '/api': 'http://localhost:8000', '/track': 'http://localhost:8000', '/unsubscribe': 'http://localhost:8000' } }
})
