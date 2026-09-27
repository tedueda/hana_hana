import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig, type Plugin } from "vite"

const isGitHubPages = process.env.GITHUB_PAGES === 'true'
// 新サービス専用サイト (別 Netlify サイト) 向けビルド: index.html の Carat 用 SEO メタを差し替える
const isHanaHanaStandalone = process.env.VITE_HANAHANA_STANDALONE === 'true'
const hanahanaAppName = process.env.VITE_APP_NAME || 'Hana-Hana'

function hanahanaHtml(): Plugin {
  return {
    name: 'hanahana-standalone-html',
    transformIndexHtml(html) {
      if (!isHanaHanaStandalone) return html
      const desc = `${hanahanaAppName} は日本と韓国をつなぐマッチング・交流サービス。恋愛・友達・言語交換・趣味から、安心してつながれます。`
      return html
        .replace(/<!-- SEO Meta Tags -->[\s\S]*?(?=<!-- Google Fonts)/, [
          `<meta name="description" content="${desc}" />`,
          '<meta name="robots" content="index, follow" />',
          `<meta property="og:title" content="${hanahanaAppName} - 日本と韓国をつなぐ、新しい出会い。" />`,
          `<meta property="og:description" content="${desc}" />`,
          '<meta property="og:type" content="website" />',
        ].join('\n    '))
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${hanahanaAppName} - 日本と韓国をつなぐ、新しい出会い。</title>`)
    },
  }
}

export default defineConfig({
  base: isGitHubPages ? '/rainbow_community/' : '/',
  plugins: [react(), hanahanaHtml()],
  publicDir: 'public',
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

