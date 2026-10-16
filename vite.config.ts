import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base 使用相对路径：同一份产物可同时用于本地预览、GitHub Pages 子路径与自定义域名根路径
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    // es2018：转译掉可选 catch 绑定（ES2019）等语法，兼容更老的移动端 WebView（如部分微信 X5 内核）
    target: 'es2018',
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
        },
      },
    },
  },
})
