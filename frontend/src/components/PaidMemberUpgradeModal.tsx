import React from 'react';
import { Button } from '@/components/ui/button';
import { Crown } from 'lucide-react';

interface PaidMemberUpgradeModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  featureName?: string;
}

/**
 * 有料会員登録を促すモーダル
 */
const PaidMemberUpgradeModal: React.FC<PaidMemberUpgradeModalProps> = ({ 
  open, 
  onClose, 
  title = '有料会員限定機能です',
  description,
  featureName
}) => {
  if (!open) return null;

  const handleUpgrade = () => {
    // 会員登録ページへ遷移
    window.location.href = '/register';
  };

  const defaultDescription = featureName 
    ? `「${featureName}」は有料会員限定の機能です。`
    : 'この機能は有料会員限定です。';

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-center mb-4">
          <div className="bg-gradient-to-r from-amber-400 to-yellow-500 p-3 rounded-full">
            <Crown className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">{title}</h2>
        <p className="text-sm text-gray-700 mb-4 text-center">
          {description || defaultDescription}
        </p>
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 className="font-semibold text-gray-900 mb-2">有料会員特典</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              すべてのカテゴリへの投稿
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              会員マッチング機能
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              会員サロン（チャットルーム）
            </li>
            <li className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              寄付金募集・商品販売
            </li>
          </ul>
        </div>
        <p className="text-xs text-gray-500 mb-4 text-center">
          月額770円 ・ いつでも解約可能
        </p>
        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleUpgrade} 
            className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white font-semibold"
          >
            <Crown className="h-4 w-4 mr-2" />
            有料会員に登録
          </Button>
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="w-full border-gray-300"
          >
            閉じる
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PaidMemberUpgradeModal;

/** @deprecated PaidMemberUpgradeModal を使用してください */
export { PaidMemberUpgradeModal as PremiumUpgradeModal };
