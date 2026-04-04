import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

const isGitHubPages = process.env.GITHUB_PAGES === 'true'

export default defineConfig({
  base: isGitHubPages ? '/rainbow_community/' : '/',
  plugins: [react()],
  publicDir: 'public-lite',
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: [
      '.devinapps.com',
    ],
    // 相対パス /api 利用時用（通常は config の API_URL で本番 URL 直指定）
    proxy: {
      '/api': {
        target: 'https://ddxdewgmen.ap-northeast-1.awsapprunner.com',
        changeOrigin: true,
      },
    },
    hmr: false,
  },
})

