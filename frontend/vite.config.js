import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'


export default defineConfig({
    base: './',
    plugins: [vue()],
    server: { port: 8080 },   // 想换的数字
})
