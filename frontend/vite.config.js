import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['react-pdf'],
    include: ['pdfjs-dist', 'warning']
  },
  // server: {
  //   proxy: {
  //     '/api': {
  //       target: 'https://h34690j75f.execute-api.us-east-1.amazonaws.com/prod',
  //       changeOrigin: true,
  //       rewrite: (path) => path.replace(/^\/api/, ''),
  //     }
  //   }
  // }
})