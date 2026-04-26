import React from 'react';
import { Button } from '@/components/ui/button';

interface MatchingGateModalProps {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}

const MatchingGateModal: React.FC<MatchingGateModalProps> = ({ open, onClose, onUpgrade }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-bold text-gray-900 mb-2">マッチング機能は会員限定です</h2>
        <p className="text-sm text-gray-700 mb-4">
          有料会員（月額770円）でマッチングとチャットが無制限・追加料金なしでご利用できます。
          <br />
          <span className="text-xs text-gray-500">※登録後は即時ご利用いただけます。解約はいつでも可能です。</span>
        </p>
        <div className="flex gap-2 justify-end">
          <Button onClick={onUpgrade} className="bg-gray-500 hover:bg-gray-600 text-white">会員に登録</Button>
          <Button variant="outline" onClick={onClose} className="border-gray-300">閉じる</Button>
        </div>
      </div>
    </div>
  );
};

export default MatchingGateModal;
