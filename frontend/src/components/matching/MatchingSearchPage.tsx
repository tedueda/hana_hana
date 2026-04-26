import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, resilientFetch } from '@/contexts/AuthContext';
import { useSearchParams } from 'react-router-dom';
import { TopTabs } from './TopTabs';
import { MatchCard } from './MatchCard';
import { BACKEND_URL } from '@/config';
import { SlidersHorizontal, X } from 'lucide-react';

type MatchItem = {
  user_id: number;
  display_name?: string;
  identity?: string | null;
  nationality?: string | null;
  romance_targets?: string[];
  prefecture?: string | null;
  age_band?: string | null;
  avatar_url?: string | null;
  occupation?: string | null;
  meet_pref?: string | null;
};

const MatchingSearchPage: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const segment = searchParams.get("segment") || "gay";
  
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<MatchItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [allItems, setAllItems] = useState<MatchItem[]>([]);
  
  const [selectedNationality, setSelectedNationality] = useState<string>("");
  const [selectedAgeBand, setSelectedAgeBand] = useState<string>("");
  const [selectedOccupation, setSelectedOccupation] = useState<string>("");
  const [selectedMeetPref, setSelectedMeetPref] = useState<string>("");
  const [showFilterModal, setShowFilterModal] = useState(false);

  const fetchSearch = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const headers: Record<string, string> = { 'Cache-Control': 'no-cache' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      // AWS 本番 API へ接続（resilientFetch: API_URL → DIRECT_API_URL の順で試行）
      const merged: MatchItem[] = [];
      let page = 1;
      const size = 50;
      while (page <= 10) {
        const params = new URLSearchParams({ page: String(page), size: String(size) });
        const res = await resilientFetch(
          `/api/matching/search?${params.toString()}&_t=${Date.now()}`,
          { headers },
        );
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || `HTTP ${res.status}`);
        }
        const data = await res.json();
        const batch: MatchItem[] = Array.isArray(data) ? data : data.items || [];
        merged.push(...batch);
        const total = typeof data.count === 'number' ? data.count : merged.length;
        if (batch.length < size || merged.length >= total) break;
        page += 1;
      }

      let fetchedItems = merged;

      // 画像URLを整形（相対パスは BACKEND_URL＝本番直 or 解決済み API 基準）
      fetchedItems = fetchedItems.map((it) => {
        let avatar = it.avatar_url || '';
        if (avatar && !avatar.startsWith('http')) {
          avatar = `${BACKEND_URL}${avatar.startsWith('/') ? '' : '/'}${avatar}`;
        }
        if (!avatar || avatar.includes('dicebear')) {
          avatar = '';
        }
        return { ...it, avatar_url: avatar };
      });
      
      // クライアント側で恋愛対象（romance_targets）またはidentityによるフィルタリング
      // romance_targetsがない場合はidentityで代替（後方互換性）
      if (segment === 'gay') {
        fetchedItems = fetchedItems.filter(it => {
          if (it.romance_targets && it.romance_targets.length > 0) {
            return it.romance_targets.includes('ゲイ');
          }
          // フォールバック: identityで判定
          return it.identity === 'ゲイ';
        });
      } else if (segment === 'lesbian') {
        fetchedItems = fetchedItems.filter(it => {
          if (it.romance_targets && it.romance_targets.length > 0) {
            return it.romance_targets.includes('レズ') || it.romance_targets.includes('レズビアン');
          }
          // フォールバック: identityで判定（レズ or レズビアン、マイグレーション後）
          return it.identity === 'レズ' || it.identity === 'レズビアン';
        });
      } else if (segment === 'other') {
        fetchedItems = fetchedItems.filter(it => {
          if (it.romance_targets && it.romance_targets.length > 0) {
            return !it.romance_targets.includes('ゲイ') && !it.romance_targets.includes('レズ') && !it.romance_targets.includes('レズビアン');
          }
          // フォールバック: identityで判定
          return it.identity !== 'ゲイ' && it.identity !== 'レズ' && it.identity !== 'レズビアン';
        });
      }
      
      setAllItems(fetchedItems);
      setItems(fetchedItems);
    } catch (e: any) {
      setError(e?.message || '検索に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, segment]);

  useEffect(() => {
    let filtered = [...allItems];
    
    if (selectedNationality) {
      filtered = filtered.filter(it => it.nationality === selectedNationality);
    }
    if (selectedAgeBand) {
      filtered = filtered.filter(it => it.age_band === selectedAgeBand);
    }
    if (selectedOccupation) {
      filtered = filtered.filter(it => it.occupation === selectedOccupation);
    }
    if (selectedMeetPref) {
      filtered = filtered.filter(it => it.meet_pref === selectedMeetPref);
    }
    
    setItems(filtered);
  }, [allItems, selectedNationality, selectedAgeBand, selectedOccupation, selectedMeetPref]);

  // Nationality codes for filtering
  const NATIONALITY_CODES = [
    'JP', 'US', 'KR', 'CN', 'TW', 'HK', 'TH', 'VN', 'PH', 'ID', 'MY', 'SG', 'IN',
    'AU', 'NZ', 'GB', 'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'CH', 'AT',
    'SE', 'NO', 'DK', 'FI', 'RU', 'CA', 'MX', 'BR', 'AR', 'CL', 'CO', 'PE',
    'ZA', 'EG', 'IL', 'AE', 'SA', 'TR', 'OTHER'
  ];
  // Age band keys for i18n
  const AGE_BAND_KEYS = ['10s', '20sEarly', '20sLate', '30sEarly', '30sLate', '40sEarly', '40sLate', '50sEarly', '50sLate', '60sPlus'];
  // Age band values (stored in DB)
  const AGE_BAND_VALUES = ['10代', '20代前半', '20代後半', '30代前半', '30代後半', '40代前半', '40代後半', '50代前半', '50代後半', '60代以上'];
  // Occupation keys for i18n
  const OCCUPATION_KEYS = ['employee', 'selfEmployed', 'freelance', 'student', 'professional', 'publicServant', 'partTime', 'other'];
  // Occupation values (stored in DB)
  const OCCUPATION_VALUES = ['会社員', '自営業', 'フリーランス', '学生', '専門職', '公務員', 'パート・アルバイト', 'その他'];
  // Meet pref keys for i18n
  const MEET_PREF_KEYS = ['partner', 'friend', 'counselor', 'member', 'other'];
  // Meet pref values (stored in DB)
  const MEET_PREF_VALUES = ['パートナー探し', '友人探し', '相談相手探し', 'メンバー募集', 'その他'];

  const clearFilters = () => {
    setSelectedNationality("");
    setSelectedAgeBand("");
    setSelectedOccupation("");
    setSelectedMeetPref("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-pink-50/30">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">
          {t('matching.searchList')}
        </h1>
        
        <TopTabs />
        
        {/* Mobile Filter Button */}
        <div className="md:hidden mb-4">
          <button
            onClick={() => setShowFilterModal(true)}
            className="w-full flex items-center justify-center gap-2 bg-black text-white px-4 py-3 rounded-lg hover:bg-gray-800 transition-colors"
          >
            <SlidersHorizontal className="h-5 w-5" />
            <span className="font-medium">{t('matching.searchConditions')}</span>
            {(selectedNationality || selectedAgeBand || selectedOccupation || selectedMeetPref) && (
              <span className="ml-2 bg-white text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {[selectedNationality, selectedAgeBand, selectedOccupation, selectedMeetPref].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Mobile Filter Modal */}
        {showFilterModal && (
          <div className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end">
            <div className="bg-white w-full rounded-t-2xl max-h-[80vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900">{t('matching.searchConditions')}</h3>
                <button
                  onClick={() => setShowFilterModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('matching.nationality')}</label>
                  <select
                    value={selectedNationality}
                    onChange={(e) => setSelectedNationality(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">{t('matching.all')}</option>
                    {NATIONALITY_CODES.map((code) => (
                      <option key={code} value={code}>{t(`matching.nationalities.${code}`)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('matching.ageGroup')}</label>
                  <select
                    value={selectedAgeBand}
                    onChange={(e) => setSelectedAgeBand(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">{t('matching.all')}</option>
                    {AGE_BAND_KEYS.map((key, idx) => (
                      <option key={key} value={AGE_BAND_VALUES[idx]}>{t(`matching.ageBands.${key}`)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('matching.occupation')}</label>
                  <select
                    value={selectedOccupation}
                    onChange={(e) => setSelectedOccupation(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">{t('matching.all')}</option>
                    {OCCUPATION_KEYS.map((key, idx) => (
                      <option key={key} value={OCCUPATION_VALUES[idx]}>{t(`matching.occupations.${key}`)}</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">{t('matching.matchingPurpose')}</label>
                  <select
                    value={selectedMeetPref}
                    onChange={(e) => setSelectedMeetPref(e.target.value)}
                    className="w-full px-4 py-3 text-base border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">{t('matching.all')}</option>
                    {MEET_PREF_KEYS.map((key, idx) => (
                      <option key={key} value={MEET_PREF_VALUES[idx]}>{t(`matching.meetPrefs.${key}`)}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => {
                      clearFilters();
                      setShowFilterModal(false);
                    }}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    {t('matching.clear')}
                  </button>
                  <button
                    onClick={() => setShowFilterModal(false)}
                    className="flex-1 px-4 py-3 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-medium"
                  >
                    {t('matching.apply')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Desktop Filter Section */}
        <div className="hidden md:block mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">{t('matching.conditionalSearch')}</h3>
            {(selectedNationality || selectedAgeBand || selectedOccupation || selectedMeetPref) && (
              <button
                onClick={clearFilters}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {t('matching.clear')}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('matching.nationality')}</label>
              <select
                value={selectedNationality}
                onChange={(e) => setSelectedNationality(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">{t('matching.all')}</option>
                {NATIONALITY_CODES.map((code) => (
                  <option key={code} value={code}>{t(`matching.nationalities.${code}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('matching.ageGroup')}</label>
              <select
                value={selectedAgeBand}
                onChange={(e) => setSelectedAgeBand(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">{t('matching.all')}</option>
                {AGE_BAND_KEYS.map((key, idx) => (
                  <option key={key} value={AGE_BAND_VALUES[idx]}>{t(`matching.ageBands.${key}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('matching.occupation')}</label>
              <select
                value={selectedOccupation}
                onChange={(e) => setSelectedOccupation(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">{t('matching.all')}</option>
                {OCCUPATION_KEYS.map((key, idx) => (
                  <option key={key} value={OCCUPATION_VALUES[idx]}>{t(`matching.occupations.${key}`)}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">{t('matching.matchingPurpose')}</label>
              <select
                value={selectedMeetPref}
                onChange={(e) => setSelectedMeetPref(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              >
                <option value="">{t('matching.all')}</option>
                {MEET_PREF_KEYS.map((key, idx) => (
                  <option key={key} value={MEET_PREF_VALUES[idx]}>{t(`matching.meetPrefs.${key}`)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="text-gray-600">{t('matching.loading')}</div>
          </div>
        )}
        
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-600">
            {error}
          </div>
        )}
        
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4">
            {items.map((item) => (
              <MatchCard key={item.user_id} item={item} />
            ))}
          </div>
        )}
        
        {!loading && !error && items.length === 0 && (
          <div className="flex min-h-[400px] items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 bg-white">
            <div className="text-center">
              <p className="text-lg font-medium text-gray-600">{t('matching.noUsersFound')}</p>
              <p className="mt-2 text-sm text-gray-500">{t('matching.tryOtherTab')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MatchingSearchPage;
