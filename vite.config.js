import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/fb2-to-pdf-converter/',
  optimizeDeps: {
    exclude: ['pdfjs-dist'],
  },
  build: {
    rollupOptions: {
      external: [],
      output: {
        // Убеждаемся, что sw.js копируется в корень сборки
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'sw.js') {
            return 'sw.js';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    },
  },
})
