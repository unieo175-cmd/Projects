import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue(), viteSingleFile()],
  base: './',
  build: {
    outDir: 'dist-pm',
    assetsInlineLimit: 100000000,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index-verify.html')
      },
      output: {
        entryFileNames: '[name].js',
      }
    }
  }
})
