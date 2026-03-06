import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../server/dist/webview',
    emptyOutDir: true,
  },
  base: './',
})
