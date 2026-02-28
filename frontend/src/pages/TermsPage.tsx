import React from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';

const TermsPage: React.FC = () => {
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
              利用規約
            </h1>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-3xl prose prose-gray prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 max-w-none">

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-0 border-b border-gray-200 pb-3">
            第1条（適用）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>本規約は、コミュニティサイト「Carat」（以下「本サービス」といいます。）の提供条件および、本サービスを利用する閲覧者ならびに会員（第2条で定義します。）と、運営者（以下「当社」といいます。）との間の権利義務関係を定めるものです。</li>
            <li>当社が本サービス上で随時掲示する各種ルール、ガイドライン、注意事項等（名称の如何を問いません。）は、本規約の一部を構成するものとします。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第2条（定義）
          </h2>
          <p className="text-sm md:text-base leading-relaxed text-gray-700">
            本規約において使用する用語の定義は、次の各号のとおりとします。
          </p>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>「閲覧者」とは、本サービスに会員登録をせず、ログインを行わずに本サービスを閲覧する者をいいます。</li>
            <li>「会員」とは、当社所定の手続により会員登録を行い、当社所定の月額課金（第8条）を完了したうえで、本サービスの会員向け機能を利用する者をいいます。</li>
            <li>「登録情報」とは、会員登録または本人確認（eKYC）に際して当社に提供した情報をいいます。</li>
            <li>「投稿データ」とは、会員が本サービスに投稿、送信またはアップロードした文章、画像、動画、コメントその他一切の情報をいいます。</li>
            <li>「有料サービス」とは、会員に提供される投稿、コメント、チャット、サロン参加等の機能およびこれに付随するサービスをいいます。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第3条（会員登録）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>会員登録希望者は、本規約に同意のうえ、当社所定の方法により会員登録手続を行うものとします。</li>
            <li>
              当社は、会員登録希望者が以下のいずれかに該当すると判断した場合、会員登録を承認しないことがあります。なお、その理由について当社は開示義務を負いません。
              <ol className="list-none pl-4 mt-2 space-y-2">
                <li>（1）登録情報に虚偽、誤記または記載漏れがあった場合</li>
                <li>（2）過去に本規約違反等により利用停止等の措置を受けたことがある場合</li>
                <li>（3）反社会的勢力等（暴力団、暴力団員、準構成員、これらに準ずる者を含みます。）である、または資金提供その他の関与をしている場合</li>
                <li>（4）その他、当社が会員登録を適当でないと判断した場合</li>
              </ol>
            </li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第3条の2（年齢制限）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>本サービスは、<strong>18歳以上の方のみ</strong>利用できます。</li>
            <li>18歳未満の方は、本サービスの閲覧を含む利用（会員登録、投稿、チャット、サロン参加その他一切を含みます。）を行うことはできません。</li>
            <li>当社は、利用者が18歳未満である、またはそのおそれがあると判断した場合、事前の通知なく利用停止その他必要な措置を講じることができます。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第4条（アカウント管理）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>会員は、自己の責任において、ID・パスワード等の認証情報を適切に管理・保管するものとします。</li>
            <li>会員は、認証情報を第三者に使用させ、または貸与、譲渡、名義変更、売買等をしてはなりません。</li>
            <li>認証情報の管理不十分、使用上の過誤、第三者の使用等によって生じた損害について、当社は責任を負いません。ただし、当社の故意または重過失による場合はこの限りではありません。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第5条（禁止事項）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>
              閲覧者および会員は、本サービスの利用にあたり、以下の行為をしてはなりません。
              <ol className="list-none pl-4 mt-2 space-y-2">
                <li>（1）差別、ヘイトスピーチ、誹謗中傷、脅迫、嫌がらせ、ハラスメント行為</li>
                <li>（2）アウティング（本人の同意なく性的指向・性自認等を暴露する行為）、個人情報の無断公開</li>
                <li>（3）ストーキング、なりすまし、詐欺等の不正行為、違法行為またはこれを助長する行為</li>
                <li>（4）児童の性的搾取に関する内容、わいせつ・過度に暴力的または残虐な表現等、公序良俗に反する内容の投稿・送信</li>
                <li>（5）第三者の著作権、商標権、肖像権、プライバシーその他の権利を侵害する行為（無断転載を含みます。）</li>
                <li>（6）無許可の広告宣伝、勧誘（ネットワークビジネス、宗教、投資等を含む）、スパム行為</li>
                <li>（7）本サービスの運営を妨害する行為、不正アクセス、リバースエンジニアリングその他セキュリティを脅かす行為</li>
                <li>（8）その他、当社が不適切と判断する行為</li>
              </ol>
            </li>
            <li>当社は、前項に違反する行為があった場合、またはそのおそれがあると判断した場合、当該投稿の削除、表示制限、警告、機能制限、会員資格停止またはアカウント停止等の措置を行うことができます。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第6条（投稿データの取扱い・権利）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>投稿データの著作権その他の権利は、当該投稿を行った会員に帰属します。</li>
            <li>当社は、本サービスの提供、維持、改善、運営上の表示、プロモーション、不正防止・調査対応のために必要な範囲で、投稿データを無償で利用（複製、公衆送信、翻案、表示等を含みます。）できるものとし、会員はこれを許諾します。</li>
            <li>前項の許諾は、非独占的かつ世界的な範囲で行われるものとします。ただし、当社は会員の権利を不当に侵害しないよう配慮します。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第7条（モデレーション）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>当社は、規約違反や安全上の必要がある場合、事前の通知なく、投稿削除、表示制限、機能制限、アカウント停止等の措置を行うことができます。</li>
            <li>当社は、モデレーションの判断基準や対応理由について、個別に説明する義務を負いません。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第8条（有料サービス・課金）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>会員は、当社所定の本人確認（eKYC）手続の完了後、当社が指定する決済サービス（<strong>Stripe</strong>）を通じて、<strong>月額1,000円（税込）</strong>の会費を支払うことで、有料サービスを利用できます。</li>
            <li>会費はサブスクリプション方式とし、解約手続が完了するまで、所定の更新日に自動更新されます。</li>
            <li>会員が更新日までに解約手続を完了しない場合、翌課金期間の会費が課金されます。</li>
            <li>課金期間の途中で解約した場合でも、当社は当該課金期間分の会費の返金を行いません。ただし、二重課金、システム障害等当社の責に帰すべき事由がある場合はこの限りではありません。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第9条（退会・解約）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>会員は、当社所定の方法により、いつでも解約（退会）手続を行うことができます。</li>
            <li>
              解約手続は、アカウントページより行うものとします。
              <br />
              <span className="text-gray-500 text-xs md:text-sm">（アカウントページ：<Link to="/account" className="text-blue-600 hover:underline">https://carat-community.com/account</Link>）</span>
            </li>
            <li>解約の効力発生時期（当月末まで利用可／即時停止等）は本サービスの表示・決済仕様に従います。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第10条（免責）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>当社は、通信障害、システム障害、第三者の不正行為その他当社の合理的支配を超える事由により生じた損害について、当社に故意または重過失がない限り責任を負いません。</li>
            <li>当社が損害賠償責任を負う場合であっても、当社の責に帰すべき事由により会員に生じた通常損害の範囲に限り、かつ、当該損害発生月の会費相当額を上限とします。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第11条（規約変更）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>当社は、必要に応じて本規約を変更することができます。</li>
            <li>変更後の規約は、本サービス上への掲示その他当社所定の方法により周知し、掲示等の時点または当社が別途定める時点から効力を生じます。</li>
          </ol>

          <h2 className="text-xl md:text-2xl font-bold text-gray-900 mt-10 border-b border-gray-200 pb-3">
            第12条（準拠法・管轄）
          </h2>
          <ol className="list-decimal list-outside pl-5 space-y-3 text-sm md:text-base leading-relaxed text-gray-700">
            <li>本規約は日本法に準拠し、これに従って解釈されます。</li>
            <li>本サービスに関して当社と閲覧者または会員との間で紛争が生じた場合、大阪地方裁判所を第一審の専属的合意管轄裁判所とします。</li>
          </ol>

        </div>
      </section>

      <section className="bg-gray-50 border-t border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-10 md:py-14">
          <div className="max-w-3xl flex flex-wrap gap-3">
            <Link
              to="/about/usage"
              className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
            >
              ご利用方法を見る
            </Link>
            <Link
              to="/subscribe"
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              会員登録はこちら
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TermsPage;
