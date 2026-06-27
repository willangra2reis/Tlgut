/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
    css: true,
  },
  server: {
    proxy: {
      // Em desenvolvimento local, redireciona /api/* para um servidor
      // local de simulação. Em produção (Cloudflare Pages) a function
      // em /functions/api/transcribe.js é usada automaticamente.
      '/api': {
        target: 'http://localhost:8788',
        changeOrigin: true,
      },
    },
  },
})

