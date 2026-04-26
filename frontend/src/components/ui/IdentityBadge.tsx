import { Badge } from './badge';

interface IdentityBadgeProps {
  value?: string | null;
}

export function IdentityBadge({ value }: IdentityBadgeProps) {
  if (!value || value === '非公開' || value === '非表示') return null;

  const identityMap: Record<string, { label: string; className: string }> = {
    gay: { label: 'ゲイ', className: 'bg-blue-100 text-blue-700 border-blue-300' },
    'ゲイ': { label: 'ゲイ', className: 'bg-blue-100 text-blue-700 border-blue-300' },
    lesbian: { label: 'レズビアン', className: 'bg-pink-100 text-pink-700 border-pink-300' },
    'レズ': { label: 'レズビアン', className: 'bg-pink-100 text-pink-700 border-pink-300' },
    'レズビアン': { label: 'レズビアン', className: 'bg-pink-100 text-pink-700 border-pink-300' },
    bisexual: { label: 'バイ', className: 'bg-purple-100 text-purple-700 border-purple-300' },
    'バイセクシュアル': { label: 'バイ', className: 'bg-purple-100 text-purple-700 border-purple-300' },
    'バイセクシャル': { label: 'バイ', className: 'bg-purple-100 text-purple-700 border-purple-300' },
    transgender: { label: 'トランス', className: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
    'トランスジェンダー': { label: 'トランス', className: 'bg-cyan-100 text-cyan-700 border-cyan-300' },
    queer: { label: 'クィア', className: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    'クィア': { label: 'クィア', className: 'bg-indigo-100 text-indigo-700 border-indigo-300' },
    'ストレート・アライ': { label: 'アライ', className: 'bg-green-100 text-green-700 border-green-300' },
    other: { label: 'その他', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    'その他': { label: 'その他', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    male: { label: 'その他', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    '男性': { label: 'その他', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    female: { label: 'その他', className: 'bg-gray-100 text-gray-700 border-gray-300' },
    '女性': { label: 'その他', className: 'bg-gray-100 text-gray-700 border-gray-300' },
  };

  const identity = identityMap[value] || identityMap[value.toLowerCase()] || { 
    label: value, 
    className: 'bg-gray-100 text-gray-700 border-gray-300' 
  };

  return (
    <Badge variant="outline" className={`text-xs ${identity.className}`}>
      {identity.label}
    </Badge>
  );
}

interface PositionBadgeProps {
  value?: string | null;
}

export function PositionBadge({ value }: PositionBadgeProps) {
  if (!value || value === '非公開') return null;

  const positionMap: Record<string, { label: string; className: string }> = {
    'タチ': { label: 'タチ', className: 'bg-amber-100 text-amber-700 border-amber-300' },
    'ウケ（ネコ）': { label: 'ウケ', className: 'bg-rose-100 text-rose-700 border-rose-300' },
    'リバーシブル': { label: 'リバ', className: 'bg-violet-100 text-violet-700 border-violet-300' },
  };

  const pos = positionMap[value] || { label: value, className: 'bg-gray-100 text-gray-700 border-gray-300' };

  return (
    <Badge variant="outline" className={`text-xs ${pos.className}`}>
      {pos.label}
    </Badge>
  );
}
