import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig(({ mode }) => {
  const { CAMPUS_BACKEND_URL } = loadEnv(mode, process.cwd(), 'CAMPUS_')
  return {
    base: './',
    plugins: [vue()],
    server: {
      port: 8080,
      proxy: CAMPUS_BACKEND_URL
        ? { '/api': { target: CAMPUS_BACKEND_URL, changeOrigin: true, cookiePathRewrite: '/' } }
        : undefined,
    },
  }
})
