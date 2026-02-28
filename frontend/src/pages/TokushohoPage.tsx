import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

const TokushohoPage: React.FC = () => {
  return (
    <div className="bg-white">
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-900 to-gray-800">
        <div className="absolute inset-0 opacity-40">
          <div className="absolute -top-24 -left-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute top-16 right-[-120px] h-80 w-80 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="relative container mx-auto px-4 sm:px-6 md:px-8 py-14 md:py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur">
              <FileText className="h-4 w-4" />
              Carat Community
            </div>
            <h1 className="mt-6 text-3xl md:text-5xl font-bold tracking-tight text-white">
              特定商取引法に基づく表記
            </h1>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-3xl">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm md:text-base" style={{ overflowWrap: 'anywhere' }}>
              <tbody>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">販売事業者（運営事業者名）</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">ポテンシャルデザイン</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">運営責任者</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">上田 孝久</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">所在地</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">〒545-0021 大阪府大阪市阿倍野区阪南町6-1-5</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">電話番号</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">06-6697-0034</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">メールアドレス</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">
                    <a href="mailto:ted@carat-community.com" className="text-blue-600 hover:underline">ted@carat-community.com</a>
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">販売価格（役務の対価）</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">会員料金：月額1,000円（税込）</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">商品代金以外の必要料金</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">インターネット接続料金、通信料等はお客様のご負担となります。</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">支払方法</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">クレジットカード決済（Stripe）</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">支払時期</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">会員登録時に初回決済。以降、1か月ごとに自動更新（サブスクリプション）。</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">提供時期（役務の提供時期）</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">本人確認（eKYC）および決済完了後、直ちに利用可能。</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">解約・返金について</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">課金期間途中の解約による日割り返金は行わない。ただし重複課金やシステム障害等、当社の責に帰すべき事由がある場合は個別に確認のうえ対応。解約は次回更新日前までに手続き。</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">解約方法</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">アカウント設定から解約（必要に応じて決済プラットフォーム上で停止。画面案内に従う）。</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">動作環境（推奨）</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">Google Chrome／Safari／Microsoft Edge／Firefox（いずれも最新版推奨）</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">特別条件</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">Caratポイントによる特典あり（条件はサービス内案内を参照）。</td>
                </tr>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-4 md:px-6 text-left font-semibold text-gray-900 bg-gray-50 w-1/3 align-top whitespace-nowrap">関連リンク</th>
                  <td className="py-4 px-4 md:px-6 text-gray-700">
                    <span className="inline-flex flex-wrap gap-x-1 gap-y-1">
                      <Link to="/about" className="text-blue-600 hover:underline">Caratとは</Link>
                      <span className="text-gray-400">／</span>
                      <Link to="/about/usage" className="text-blue-600 hover:underline">ご利用方法</Link>
                      <span className="text-gray-400">／</span>
                      <Link to="/about/terms" className="text-blue-600 hover:underline">利用規約</Link>
                      <span className="text-gray-400">／</span>
                      <Link to="/privacy" className="text-blue-600 hover:underline">プライバシーポリシー</Link>
                      <span className="text-gray-400">／</span>
                      <span className="text-gray-500">特定商取引法に基づく表記（当ページ）</span>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TokushohoPage;
