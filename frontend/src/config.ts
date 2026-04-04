/** 本番 API（AWS App Runner）。ローカル `npm run dev` 時のデフォルト接続先。 */
export const DIRECT_API_URL = 'https://ddxdewgmen.ap-northeast-1.awsapprunner.com';

/**
 * フロントが API に接続するときのベース URL。
 * - 開発（Vite）: デフォルトは本番 AWS。ローカル FastAPI を使うときだけ `VITE_LOCAL_API=true` とし、必要なら `VITE_API_URL=http://localhost:8000`。
 * - 本番ビルド: `VITE_API_URL`（Netlify 等）。未設定なら空（同一オリジンやビルド時注入に任せる）。
 */
function resolveApiUrl(): string {
  if (import.meta.env.DEV) {
    if (import.meta.env.VITE_LOCAL_API === 'true') {
      return (import.meta.env.VITE_API_URL as string | undefined)?.trim() || 'http://localhost:8000';
    }
    // Viteプロキシ経由で本番APIに接続（相対パス）
    return '';
  }
  return ((import.meta.env.VITE_API_URL as string | undefined) ?? '').trim();
}

export const API_URL = resolveApiUrl();

/** 画像・ブログ等。API_URL が空のときも本番直叩きにフォールバック */
export const BACKEND_URL = API_URL || DIRECT_API_URL;
