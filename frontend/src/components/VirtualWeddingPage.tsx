import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronDown, ChevronUp, Home } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/card';
import { Button } from './ui/button';

const VirtualWeddingPage: React.FC = () => {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  const localVideoPath = '/images/flova_Live Wedding 01.mp4';

  // const features = [
  //   {
  //     icon: <Globe className="w-8 h-8" />,
  //     title: "世界中に配信",
  //     description: "距離を超えて、大切な人たちと特別な瞬間を共有"
  //   },
  //   {
  //     icon: <Camera className="w-8 h-8" />,
  //     title: "プロの撮影",
  //     description: "経験豊富なカメラマンが美しい映像を提供"
  //   },
  //   {
  //     icon: <Users className="w-8 h-8" />,
  //     title: "専任サポート",
  //     description: "当日まで専任スタッフが丁寧にサポート"
  //   },
  //   {
  //     icon: <Heart className="w-8 h-8" />,
  //     title: "思い出を永遠に",
  //     description: "録画データをお渡しし、いつでも振り返れます"
  //   }
  // ];

  const includedFeatures = [
    "カメラ4台によるマルチアングル収録",
    "配信用音響設備（マイク・ミキサー）",
    "高画質映像収録",
    "バーチャル背景作成（教会／披露宴／海外風景 等）",
    "配信サポート（Zoom等）",
    "オンラインメッセージ・お祝儀受け取り機能",
    "スタッフ1〜2名による運営サポート"
  ];

  const notIncludedFeatures = [
    "ヘアメイク・衣装",
    "司会・牧師・パートナー",
    "コーディネーター・プランナー",
    "花束・装飾",
    "飲食"
  ];

  const faqs = [
    {
      question: "どのような機材が必要ですか？",
      answer: "基本的な機材は全て弊社でご用意いたします。会場にインターネット環境があれば配信可能です。"
    },
    {
      question: "配信の品質はどの程度ですか？",
      answer: "プランに応じてHD〜4K画質での配信が可能です。安定したインターネット環境で高品質な配信を実現します。"
    },
    {
      question: "当日のサポート体制は？",
      answer: "専任スタッフが当日の進行をサポートいたします。技術的なトラブルにも迅速に対応いたします。"
    },
    {
      question: "録画データはいつ受け取れますか？",
      answer: "配信終了後、編集作業を経て約1週間以内にデータをお渡しいたします。"
    }
  ];

  return (
    <div className="min-h-screen bg-carat-gray1">
      {/* Hero Section with Background Video - Full Width */}
      <div className="relative w-full h-[850px] flex items-center justify-center overflow-hidden">
          {/* Background Video */}
          <video
            className="absolute inset-0 w-full h-full object-cover scale-[1.25]"
            src={localVideoPath}
            autoPlay
            muted
            loop
            playsInline
          />
          
          {/* Overlay */}
          <div className="absolute inset-0 bg-black/40"></div>
          
          {/* Content */}
          <div className="relative z-10 text-white px-4 w-full h-full flex flex-col">
            {/* ホームに戻るボタン */}
            <div className="pt-6 pl-4">
              <button
                onClick={() => {
                  navigate('/');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="flex items-center gap-2 text-white/80 hover:text-white transition-colors bg-black/30 px-4 py-2 rounded-full"
              >
                <Home className="h-5 w-5" />
                ホームに戻る
              </button>
            </div>

            {/* Top Section - キャッチ */}
            <div className="flex-1 flex flex-col justify-start pt-8">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-6 text-center">
                ライブ・ウェディング
              </h1>
              <p className="text-xl sm:text-2xl max-w-4xl mx-auto leading-relaxed text-center">
                オンライン上で"二人の誓い"を公開し、世界中の大切な人と感動を共有。
              </p>
            </div>
            
            {/* Bottom Section - ボタン */}
            <div className="pb-16 text-center">
              <Button 
                onClick={() => {
                  navigate('/live-wedding/application');
                  window.scrollTo(0, 0);
                }}
                className="bg-black text-white hover:bg-gray-800 px-8 py-4 text-xl font-semibold transition-colors"
              >
                相談予約
              </Button>
            </div>
          </div>
        </div>

      {/* Content Container */}
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Concept Section */}
        <div className="mb-16 pt-16">
          <div className="max-w-4xl mx-auto bg-carat-white rounded-2xl border border-carat-gray2 shadow-lg hover:shadow-xl transition-shadow duration-300 p-8">
            <h2 className="text-3xl font-bold text-center text-carat-black mb-8">コンセプト</h2>
            <div className="mb-8">
              <p className="text-xl text-carat-gray6 leading-relaxed">
                オンライン上で親しい人に『二人の誓い』を公開し、祝福を受ける新しいスタイルのウェディング
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold text-carat-black mb-4">【ライブ・ウェディングをおすすめの理由】</h3>
              <ul className="space-y-3 text-carat-gray6 text-lg">
                <li>• 公で挙式が難しい方に、堂々と愛を誓える場を提供</li>
                <li>• バーチャル背景で理想のウェディングシーンを演出</li>
                <li>• 遠方の友人・家族とオンラインで祝福を共有</li>
                <li>• スタジオQの設備を活かした唯一無二の体験</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-carat-black mb-12">特徴</h2>
          <div className="max-w-4xl mx-auto bg-carat-white rounded-2xl border border-carat-gray2 shadow-card p-8">
            <p className="text-carat-gray6 leading-relaxed text-xl">
              西日本随一の設備を誇り、業界のプロからも高い評価を得ているバーチャルスタジオ「Studio Q」を利用し、世界にたった一つのオンラインウェディングを提供します。AIによる背景合成技術により、夢に描いたあらゆるシーンを演出可能。教会や海外リゾート、花畑、夜景など、どんな世界観も自由に再現できます。遠方に住む両親、親戚、友人、知人をオンラインで招待し、リアルタイムで「誓い」と「祝福」を共有。さらに、お祝儀やメッセージをオンラインで受け取れる機能も搭載。二人の愛を形にし、永遠に残す"唯一無二"のウェディングを実現します。
            </p>
          </div>
        </div>

        {/* Single Plan Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-carat-black mb-12">料金プラン</h2>
          <div className="max-w-4xl mx-auto">
            <Card className="bg-carat-white border-carat-gray2 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="text-center">
                <h3 className="text-3xl font-bold text-carat-black mb-2">ライブ・ウエディングプラン</h3>
                <p className="text-carat-gray5 text-lg mb-2">
                  <span className="line-through">通常価格 ¥500,000</span>
                </p>
                <p className="text-4xl font-bold text-carat-black">¥300,000</p>
                <p className="text-carat-gray5 mt-2">（税別）</p>
                <div className="mt-4 px-4 py-2 bg-carat-black text-carat-white rounded-full inline-block">
                  <span className="text-sm font-semibold">Carat 会員価格</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* 含まれる内容 */}
                  <div>
                    <h4 className="text-xl font-semibold text-carat-black mb-4 flex items-center gap-2">
                      <Check className="w-5 h-5 text-green-500" />
                      含まれる内容
                    </h4>
                    <ul className="space-y-2">
                      {includedFeatures.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                          <span className="text-carat-gray6 text-base">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* 含まれない内容 */}
                  <div>
                    <h4 className="text-xl font-semibold text-carat-black mb-4 flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      含まれない内容
                    </h4>
                    <ul className="space-y-2 mb-4">
                      {notIncludedFeatures.map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          <span className="text-carat-gray6 text-base">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-carat-gray5 text-sm">必要な場合はお客様でお手配ください</p>
                  </div>
                </div>
                
                <div className="mt-8 text-center">
                  <Button 
                    onClick={() => {
                      navigate('/live-wedding/application');
                      window.scrollTo(0, 0);
                    }}
                    className="bg-black text-white hover:bg-gray-800 px-8 py-4 text-lg font-semibold"
                  >
                    このプランでお申し込み
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        
        {/* Background Composite Video Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-carat-black mb-12">背景合成イメージ動画</h2>
          <div className="max-w-4xl mx-auto bg-carat-white rounded-2xl border border-carat-gray2 shadow-lg hover:shadow-xl transition-shadow duration-300 p-8">
            <div 
              className="aspect-video rounded-xl overflow-hidden mb-6 cursor-pointer relative group"
              onClick={() => setIsVideoModalOpen(true)}
            >
              <video
                className="w-full h-full object-cover"
                src={localVideoPath}
                autoPlay
                muted
                loop
                playsInline
              />
              {/* 再生ボタンオーバーレイ */}
              <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                <div className="bg-transparent border-2 border-white rounded-full p-6 group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                  <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-carat-black mb-4">美しい背景で特別な演出</h3>
            <p className="text-carat-gray6 leading-relaxed text-lg">
              AIによる背景合成技術により、夢に描いたあらゆるシーンを演出可能。教会や海外リゾート、花畑、夜景など、
              どんな世界観も自由に再現できます。Studio Qの最新技術で、理想のウェディングシーンを実現いたします。
            </p>
          </div>
        </div>

        {/* Studio Q Link Banner */}
        <div className="mb-16">
          <div className="max-w-4xl mx-auto">
            <a 
              href="https://studioq.co.jp/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block bg-carat-white rounded-2xl border border-carat-gray2 shadow-lg hover:shadow-xl transition-all duration-300 group"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-carat-black rounded-full flex items-center justify-center">
                      <span className="text-carat-white font-bold text-xl">Q</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-bold text-carat-black group-hover:text-carat-gray6 transition-colors">
                        Studio Q
                      </h3>
                      <p className="text-carat-gray5">バーチャルスタジオ</p>
                    </div>
                  </div>
                  <p className="text-carat-gray6 leading-relaxed mb-4 text-lg">
                    西日本随一の設備を誇るバーチャルスタジオ。業界のプロからも高い評価を得ている最新技術で、
                    あなたの理想のウェディングシーンを実現します。
                  </p>
                  <div className="flex items-center gap-2 text-carat-gray5">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span>大阪市浪速区</span>
                  </div>
                </div>
                <div className="ml-6">
                  <div className="w-12 h-12 bg-carat-gray1 rounded-full flex items-center justify-center group-hover:bg-carat-black transition-colors">
                    <svg className="w-6 h-6 text-carat-gray6 group-hover:text-carat-white transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </div>
                </div>
              </div>
            </a>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center text-carat-black mb-12">よくある質問</h2>
          <div className="max-w-4xl mx-auto space-y-4">
            {faqs.map((faq, index) => (
              <Card key={index} className="bg-carat-white border-carat-gray2 shadow-card">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-carat-gray1 transition-colors"
                >
                  <span className="font-semibold text-carat-black">{faq.question}</span>
                  {expandedFaq === index ? (
                    <ChevronUp className="w-5 h-5 text-carat-gray5" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-carat-gray5" />
                  )}
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-6">
                    <p className="text-carat-gray6 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      </div>

      {/* Video Modal */}
      {isVideoModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="relative max-w-6xl w-full">
            {/* 閉じるボタン */}
            <button
              onClick={() => setIsVideoModalOpen(false)}
              className="absolute -top-12 right-0 text-white hover:text-carat-gray2 transition-colors"
              aria-label="動画を閉じる"
            >
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {/* 動画 */}
            <div className="aspect-video bg-black rounded-xl overflow-hidden">
              <video
                className="w-full h-full"
                src={localVideoPath}
                autoPlay
                controls
                playsInline
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualWeddingPage;
