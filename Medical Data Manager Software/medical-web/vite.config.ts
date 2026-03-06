import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: '/viewer/',
  plugins: [vue()],
  server: {
    proxy: {
      '/api': 'http://localhost:8080',
    }
  }
})
