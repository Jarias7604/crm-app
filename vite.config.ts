import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Agrupar librerías por dominio → el browser las cachea por separado
        // Si actualizas el código del CRM, el vendor NO se re-descarga
        manualChunks: {
          // Core React (raramente cambia → máximo tiempo en caché del browser)
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Data fetching (estable)
          'vendor-query': ['@tanstack/react-query', '@tanstack/react-virtual'],
          // Charts (grande, cárguelo separado)
          'vendor-charts': ['recharts'],
          // UI utilities
          'vendor-ui': ['lucide-react', 'date-fns', 'react-hot-toast'],
          // Supabase client (estable)
          'vendor-supabase': ['@supabase/supabase-js'],
          // i18n (solo carga cuando el usuario cambia idioma)
          'vendor-i18n': ['i18next', 'react-i18next'],
        }
      }
    }
  }
})
