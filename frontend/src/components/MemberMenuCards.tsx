import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { usePaidMember } from '../hooks/usePremium';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

const menuItems = [
  {
    id: "matching",
    titleKey: "homepage.specialMenu.matching.title",
    descriptionKey: "homepage.specialMenu.matching.description",
    icon: "💕",
    link: "/matching",
  },
  {
    id: "salon",
    titleKey: "homepage.specialMenu.salon.title",
    descriptionKey: "homepage.specialMenu.salon.description",
    icon: "💬",
    link: "/salon",
  },
  {
    id: "business",
    titleKey: "homepage.specialMenu.business.title",
    descriptionKey: "homepage.specialMenu.business.description",
    icon: "💼",
    link: "/business",
  },
];

const MemberMenuCards: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, isFreeUser } = useAuth();
  const { isPaidUser } = usePaidMember();
  const [showModal, setShowModal] = useState(false);

  const handleMenuClick = (link: string) => {
    // 未ログインまたは無料ユーザーの場合はモーダル表示
    if (!user || isFreeUser || !isPaidUser) {
      setShowModal(true);
      return;
    }
    navigate(link);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <section className="py-12">
        <div className="flex flex-col md:flex-row md:items-baseline md:justify-between mb-6 gap-1 md:gap-0">
          <h3 className="text-4xl md:text-5xl font-serif font-semibold text-slate-900">
            {t('homepage.memberMenu.title')}
          </h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {menuItems.map((item) => {
            const isLocked = !user || isFreeUser || !isPaidUser;

            return (
              <Card
                key={item.id}
                className={`group backdrop-blur-md border transition-all duration-300 cursor-pointer shadow-lg ${
                  isLocked
                    ? 'bg-gray-100/90 border-gray-300 hover:bg-gray-200/90'
                    : 'bg-gray-50/90 border-gray-200 hover:bg-white hover:border-gray-300 hover:scale-[1.02] hover:shadow-2xl'
                }`}
                onClick={() => handleMenuClick(item.link)}
              >
                <CardContent className="p-6">
                  <div className="flex flex-col items-center text-center">
                    <div className={`text-5xl mb-4 transition-transform relative ${isLocked ? 'opacity-50' : 'group-hover:scale-110'}`}>
                      {item.icon}
                      {isLocked && (
                        <div className="absolute -top-1 -right-1 bg-gray-600 rounded-full p-1">
                          <Lock className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    <h4 className={`font-serif font-semibold text-xl mb-2 flex items-center gap-2 ${isLocked ? 'text-slate-500' : 'text-slate-900 group-hover:gold-accent'}`}>
                      {t(item.titleKey)}
                      {isLocked && <Lock className="h-4 w-4 text-gray-400" />}
                    </h4>
                    <p className={`text-sm mb-4 ${isLocked ? 'text-slate-400' : 'text-slate-600'}`}>
                      {t(item.descriptionKey)}
                    </p>
                    <Button
                      className={`font-medium w-full ${
                        isLocked
                          ? 'bg-gray-200 text-gray-500 border border-gray-300 hover:bg-gray-300'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100 hover:text-black group-hover:shadow-md'
                      } transition-all`}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMenuClick(item.link);
                      }}
                    >
                      {isLocked ? (
                        <>
                          <Lock className="h-3 w-3 mr-1" />
                          {t('homepage.specialMenu.premiumOnly')}
                        </>
                      ) : (
                        <>
                          {t('homepage.specialMenu.viewDetails')}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* 有料会員専用モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000] p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">
              この機能は有料会員専用です。
            </h3>
            {user ? (
              /* ログイン済みだが有料会員ではない場合 */
              <>
                <p className="text-sm text-gray-700 mb-6 text-center leading-relaxed">
                  この機能をご利用いただくには、<br />
                  有料会員登録（月額770円・税込）が必要です。
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      setShowModal(false);
                      navigate('/subscribe');
                    }}
                    className="w-full bg-black text-white hover:bg-gray-800"
                  >
                    会員登録
                  </Button>
                  <Button
                    onClick={() => setShowModal(false)}
                    className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                  >
                    閉じる
                  </Button>
                </div>
              </>
            ) : (
              /* 未ログインの場合 */
              <>
                <p className="text-sm text-gray-700 mb-6 text-center leading-relaxed">
                  ご利用にはログインのうえ、<br />
                  会員登録（月額770円・税込）が必要です。
                </p>
                <div className="flex flex-col gap-2">
                  <Button
                    onClick={() => {
                      setShowModal(false);
                      navigate('/login');
                    }}
                    className="w-full bg-black text-white hover:bg-gray-800"
                  >
                    ログイン
                  </Button>
                  <Button
                    onClick={() => {
                      setShowModal(false);
                      navigate('/subscribe');
                    }}
                    className="w-full bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                  >
                    会員登録
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default MemberMenuCards;
