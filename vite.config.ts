import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Punto 1 de la lista: front comprimido y SIN source maps públicos.
    sourcemap: false,
    minify: true, // minificador por defecto de Vite 8 (oxc)
    target: 'es2022',
    rollupOptions: {
      output: {
        // Separa las librerías grandes en chunks propios: se cachean una vez y no
        // se vuelven a bajar con cada cambio de la app.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@supabase')) return 'supabase'
          if (id.includes('@tanstack')) return 'query'
          if (id.includes('@dnd-kit')) return 'dnd'
          if (id.includes('xlsx')) return 'xlsx'
          if (id.includes('@sentry')) return 'sentry'
          if (id.includes('react')) return 'vendor'
          return undefined
        },
      },
    },
  },
  server: { port: 5173, strictPort: true },
})
