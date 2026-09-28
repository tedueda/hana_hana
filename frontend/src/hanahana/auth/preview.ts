/**
 * プレビューモード: テスト段階で ID/パスワード/会員登録なしに全ページを閲覧できるよう、
 * 未ログイン時にデモ会員として自動ログインする。
 * Netlify の環境変数 VITE_PREVIEW_LOGIN_EMAIL / VITE_PREVIEW_LOGIN_PASSWORD を外せば無効になる。
 */
const email = import.meta.env.VITE_PREVIEW_LOGIN_EMAIL as string | undefined;
const password = import.meta.env.VITE_PREVIEW_LOGIN_PASSWORD as string | undefined;

export const PREVIEW_LOGIN = email && password ? { email, password } : null;

/** ログアウト後にそのタブで自動ログインを繰り返さないためのフラグ */
export const PREVIEW_SKIP_KEY = 'hh_preview_skip';
