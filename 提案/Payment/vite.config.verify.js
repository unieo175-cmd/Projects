import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// 验证版配置 - 使用不同端口和入口
export default defineConfig({
  plugins: [
    vue(),
    {
      name: 'rewrite-index',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/' || req.url === '/index.html') {
            req.url = '/index-verify.html'
          }
          next()
        })
      }
    }
  ],
  base: '/',
  server: {
    port: 5178,
    open: '/index-verify.html',
    allowedHosts: ['.trycloudflare.com', '.loca.lt']
  },
  build: {
    outDir: 'dist-verify',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index-verify.html')
      }
    }
  }
})
