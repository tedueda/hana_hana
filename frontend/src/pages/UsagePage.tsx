import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, BookOpen, Users, AlertTriangle, MessageSquareWarning, HelpCircle, Lock } from 'lucide-react';

interface FaqItemProps {
  question: string;
  answer: string;
}

const FaqItem: React.FC<FaqItemProps> = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-900 text-sm md:text-base">Q. {question}</span>
        {open ? <ChevronUp className="h-5 w-5 text-gray-500 shrink-0" /> : <ChevronDown className="h-5 w-5 text-gray-500 shrink-0" />}
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm md:text-base text-gray-700 leading-relaxed bg-gray-50">
          {answer}
        </div>
      )}
    </div>
  );
};

const faqData: FaqItemProps[] = [
  {
    question: "このサイトは一般の方も利用できるのですか？",
    answer: "LGBTQ+の方を含め、広く一般の方もご利用できます。すべての方にオープンなサイトです。"
  },
  {
    question: "海外の方も参加できるのですか？",
    answer: "翻訳機能を備えているため、投稿・チャットを設定した言語でご利用いただけます。海外ユーザーの投稿も翻訳され、言語の壁を越えて交流できます。"
  },
  {
    question: "無料では何ができますか？",
    answer: "閲覧は無料（ログイン不要）でご利用いただけます。投稿・コメント・チャット・サロン参加は会員限定です。"
  },
  {
    question: "本人確認（eKYC）はどれくらい時間がかかりますか？",
    answer: "会員登録時に実施し、通常は数分程度で完了します（通信状況等により前後する場合があります）。"
  },
  {
    question: "匿名で利用できますか？",
    answer: "ニックネームでご利用いただけます。※安全性確保のため、会員登録時に本人確認（eKYC）をお願いしています。"
  },
  {
    question: "トラブルがあった場合は？",
    answer: "通報機能をご利用ください。運営が確認し、必要に応じて投稿削除、注意、利用制限・アカウント停止などの対応を行います。"
  },
  {
    question: "個人情報を公開しても大丈夫ですか？",
    answer: "住所・勤務先・本名・連絡先などの公開は推奨していません。特定につながる情報の掲載にはご注意ください。"
  },
  {
    question: "会員はいつでも解約できますか？",
    answer: "はい。解約方法は「アカウント設定」からご確認ください。更新タイミング等はプラン内容により異なる場合があります。"
  }
];

const UsagePage: React.FC = () => {
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
              <BookOpen className="h-4 w-4" />
              Carat（カラット）の使い方・ご案内
            </div>
            <h1 className="mt-6 text-3xl md:text-5xl font-bold tracking-tight text-white">
              ご利用方法
            </h1>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-white/85 max-w-2xl">
              Carat（カラット）は、LGBTQ+当事者およびアライ（支援者）の皆さんが、安心してつながり、自分らしく発信できるコミュニティサイトです。互いの尊厳を大切にし、誹謗中傷や差別のない場づくりを目指します。
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="h-7 w-7 text-gray-700" />
            Caratの特徴
          </h2>
          <ul className="mt-6 space-y-3 text-gray-700 text-sm md:text-base leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              <span><strong>閲覧は無料（ログイン不要）</strong>でご利用いただけます。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              <span><strong>投稿・コメント・チャット・サロン参加は会員（月額1,000円・税込）限定</strong>です。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              <span>各カテゴリーに投稿でき、コメントや「いいね」を受け取ることで<strong>Caratポイント</strong>が貯まります（※用途は別途案内）。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              <span>サロン（コミュニティ）での交流やマッチングを通じて、会員同士がつながり、理解を深められます。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              <span><strong>フリマ</strong>での商品・アート作品の販売、レッスン／セミナー開催など、会員同士でビジネス展開が可能です。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              <span><strong>イベントやツアー</strong>の企画を立てて、参加者を募集できます。</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              <span><strong>8か国語対応</strong>。翻訳機能により、選択した言語で世界中の人と交流できます。</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900">ご利用の流れ</h2>

            <div className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">閲覧者（無料・ログイン不要）でできること</h3>
              <ul className="mt-4 space-y-2 text-gray-700 text-sm md:text-base">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  タイムラインや各カテゴリーの<strong>閲覧</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  お知らせ・イベント情報の<strong>確認</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  コンテンツの雰囲気や投稿内容の<strong>チェック</strong>
                </li>
              </ul>
            </div>

            <div className="mt-5 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">会員（月額1,000円・税込）でできること</h3>
              <ul className="mt-4 space-y-2 text-gray-700 text-sm md:text-base">
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  <strong>投稿／コメント</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  <strong>チャット</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  <strong>サロン参加</strong>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
                  フリマ出品、レッスン・セミナー開催、イベント企画（※提供機能に応じて）
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900">会員登録・本人確認（eKYC）・決済</h2>
          <ol className="mt-6 space-y-4 text-gray-700 text-sm md:text-base leading-relaxed list-decimal list-inside">
            <li>「新規会員登録」から必要事項を入力してください。</li>
            <li>登録時に <strong>eKYC（オンライン本人確認）</strong> を行います。顔認証ができる本人確認書類（運転免許証・マイナンバーカード・パスポート等）を案内に沿って読み取ってください。通常は<strong>数分程度</strong>で完了します。</li>
            <li>会員機能をご利用の場合は、<strong>月額1,000円（税込）</strong>のサブスクリプションをクレジットカードで決済してください。</li>
            <li>決済が完了すると、会員向け機能が利用可能になります。</li>
            <li>公開できる範囲でプロフィールを入力してください。</li>
            <li><strong>センシティブな個人情報（住所・勤務先・本名等）の公開は推奨しません。</strong></li>
          </ol>
          <div className="mt-6">
            <Link
              to="/subscribe"
              className="inline-flex items-center justify-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-semibold text-white hover:bg-black transition-colors"
            >
              会員登録はこちら
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <AlertTriangle className="h-7 w-7 text-red-500" />
              投稿のルール（重要）
            </h2>
            <p className="mt-4 text-gray-700 text-sm md:text-base leading-relaxed">
              Caratでは、安心・安全のため以下の行為を禁止します。
            </p>
            <ul className="mt-4 space-y-2 text-gray-700 text-sm md:text-base leading-relaxed">
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                差別、ヘイト、侮辱、脅迫、誹謗中傷、ハラスメント
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                <strong>アウティング</strong>（本人の同意なく、性的指向や性自認などを第三者に暴露すること）
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                個人情報の晒し、ストーキング行為、なりすまし
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                わいせつ・児童に関する不適切な内容、違法行為の助長
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                無許可の広告・勧誘（ネットワークビジネス、宗教、投資等を含む）
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
                著作権侵害（他人の文章・画像等の無断転載など）
              </li>
            </ul>
            <p className="mt-4 text-xs md:text-sm text-gray-500">
              ※違反が確認された場合、投稿削除・機能制限・アカウント停止等の措置を行うことがあります。
            </p>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <MessageSquareWarning className="h-7 w-7 text-gray-700" />
            通報・ブロック
          </h2>
          <ul className="mt-6 space-y-3 text-gray-700 text-sm md:text-base leading-relaxed">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              規約違反と思われる投稿やユーザーを見かけたら、<strong>通報</strong>機能をご利用ください。
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              交流を避けたい場合は、<strong>ブロック</strong>機能をご利用ください。
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-gray-400 shrink-0" />
              緊急性が高い場合（自傷他害の恐れ、犯罪被害など）は、警察や専門窓口へ連絡してください。
            </li>
          </ul>
        </div>
      </section>

      <section className="bg-gray-50 border-y border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
          <div className="max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
              <HelpCircle className="h-7 w-7 text-gray-700" />
              よくある質問（FAQ）
            </h2>
            <div className="mt-6 space-y-3">
              {faqData.map((faq, i) => (
                <FaqItem key={i} question={faq.question} answer={faq.answer} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
        <div className="max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Lock className="h-7 w-7 text-gray-700" />
            セキュリティについて
          </h2>
          <p className="mt-4 text-gray-700 text-sm md:text-base leading-relaxed">
            Caratでは、<strong>eKYCによる本人確認</strong>と運営による適切な監視・管理体制のもと、安心してご利用いただける環境づくりに取り組んでいます。個人情報とコミュニティの安全性に配慮した対策を継続的に強化し、落ち着いて参加できる場を維持します。
          </p>
        </div>
      </section>

      <section className="bg-gray-900">
        <div className="container mx-auto px-4 sm:px-6 md:px-8 py-12 md:py-16">
          <div className="max-w-3xl text-center mx-auto">
            <p className="text-white text-lg md:text-xl font-semibold">
              Caratで、あなたらしいつながりを始めましょう
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link
                to="/subscribe"
                className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-3 text-sm font-semibold text-gray-900 hover:bg-gray-100 transition-colors"
              >
                会員登録はこちら
              </Link>
              <Link
                to="/feed"
                className="inline-flex items-center justify-center rounded-lg bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15 transition-colors border border-white/15"
              >
                コミュニティを見る
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default UsagePage;
