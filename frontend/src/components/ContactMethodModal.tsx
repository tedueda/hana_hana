import React from 'react';
import { Mail, MessageCircle, MoreHorizontal, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { usePaidMember } from '../hooks/usePremium';

export type ContactMethodType = 'email' | 'line' | 'other';

interface ContactMethodOption {
  type: ContactMethodType;
  label: string;
  icon: React.ReactNode;
  value: string;
}

interface ContactMethodModalProps {
  open: boolean;
  onClose: () => void;
  sellerName: string;
  contactMethods: ContactMethodOption[];
}

/**
 * お問い合わせモーダル
 * 有料会員のみ連絡先を表示
 * 未ログイン/無料会員にはゲート表示
 */
const ContactMethodModal: React.FC<ContactMethodModalProps> = ({
  open,
  onClose,
  sellerName,
  contactMethods,
}) => {
  const { user } = useAuth();
  const { isPaidUser } = usePaidMember();

  if (!open) return null;

  // 未ログイン
  if (!user) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-lg font-semibold mb-2">ログインが必要です</h3>
            <p className="text-gray-600 mb-6 text-sm">
              出品者への問い合わせにはログインが必要です。
            </p>
            <div className="flex gap-2">
              <Link
                to="/login"
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-center text-sm font-medium"
              >
                ログイン
              </Link>
              <Link
                to="/subscribe"
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center text-sm font-medium"
              >
                会員登録
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ログイン済み・非有料会員
  if (!isPaidUser) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
          <div className="flex justify-end">
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">💎</div>
            <h3 className="text-lg font-semibold mb-2">有料会員限定機能です</h3>
            <p className="text-gray-600 mb-6 text-sm">
              出品者への問い合わせには有料会員登録（月額1,000円・税込）が必要です。
            </p>
            <div className="flex gap-2">
              <Link
                to="/subscribe"
                className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-center text-sm font-medium"
              >
                会員登録
              </Link>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-center text-sm font-medium"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 有料会員 - 連絡先を表示
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">お問い合わせ</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-gray-600 mb-4">
          {sellerName}さんへの連絡方法
        </p>
        <div className="space-y-3">
          {contactMethods.map((method) => (
            <div
              key={method.type}
              className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 bg-gray-50"
            >
              <div className="text-gray-600">{method.icon}</div>
              <div>
                <div className="text-sm font-medium text-gray-900">{method.label}</div>
                <div className="text-sm text-gray-600">{method.value}</div>
              </div>
            </div>
          ))}
        </div>
        <button
          onClick={onClose}
          className="w-full mt-4 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
        >
          閉じる
        </button>
      </div>
    </div>
  );
};

/**
 * ContactMethodSelector - 出品者が連絡方法を選択するフォームコンポーネント
 */
export interface ContactMethodSelection {
  type: ContactMethodType;
  value: string;
}

interface ContactMethodSelectorProps {
  selected: ContactMethodSelection[];
  onChange: (methods: ContactMethodSelection[]) => void;
}

export const ContactMethodSelector: React.FC<ContactMethodSelectorProps> = ({
  selected,
  onChange,
}) => {
  const methodOptions: { type: ContactMethodType; label: string; icon: React.ReactNode; placeholder: string }[] = [
    { type: 'email', label: 'メール', icon: <Mail className="w-4 h-4" />, placeholder: 'example@email.com' },
    { type: 'line', label: 'LINE', icon: <MessageCircle className="w-4 h-4" />, placeholder: 'LINE ID' },
    { type: 'other', label: 'その他', icon: <MoreHorizontal className="w-4 h-4" />, placeholder: '連絡方法を入力' },
  ];

  const toggleMethod = (type: ContactMethodType) => {
    const exists = selected.find((m) => m.type === type);
    if (exists) {
      onChange(selected.filter((m) => m.type !== type));
    } else {
      onChange([...selected, { type, value: '' }]);
    }
  };

  const updateValue = (type: ContactMethodType, value: string) => {
    onChange(selected.map((m) => (m.type === type ? { ...m, value } : m)));
  };

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">
        連絡方法（購入者に表示されます）
      </label>
      {methodOptions.map((option) => {
        const isSelected = selected.some((m) => m.type === option.type);
        const current = selected.find((m) => m.type === option.type);
        return (
          <div key={option.type}>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleMethod(option.type)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="flex items-center gap-1.5 text-sm">
                {option.icon}
                {option.label}
              </span>
            </label>
            {isSelected && (
              <input
                type="text"
                value={current?.value || ''}
                onChange={(e) => updateValue(option.type, e.target.value)}
                placeholder={option.placeholder}
                className="mt-2 ml-6 w-[calc(100%-1.5rem)] px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-gray-900/20 focus:border-transparent"
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ContactMethodModal;
