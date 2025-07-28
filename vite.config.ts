import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5600',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    manifest: false,
    emptyOutDir: true,
    // Enhanced watch mode configuration
    watch: {
      // Include files to watch beyond the default
      include: ['src/**/*', 'public/**/*'],
      // Exclude files from watching
      exclude: ['node_modules/**', 'dist/**']
    }
  }
})