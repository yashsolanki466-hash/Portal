import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
 import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5175,
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Optimize build output
    minify: 'esbuild',
    rollupOptions: {
      output: {
        // Code splitting for better caching
        manualChunks: {
          'vendor': ['react', 'react-dom', 'framer-motion'],
          'mantine': ['@mantine/core', '@mantine/hooks'],
          'charts': ['recharts'],
        }
      }
    }
  },
  // Performance optimizations
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'framer-motion',
      '@mantine/core',
      '@mantine/hooks',
      'recharts',
      'axios',
      'lucide-react',
      'react-hot-toast'
    ]
  }
})
