import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { resolveImageUrl } from '@/utils/imageUtils';
import { API_URL } from '@/config';
import { Lock } from 'lucide-react';
import { useTranslation } from 'react-i18next';

type Profile = {
  user_id: number;
  phone_number?: string;
  nickname?: string;
  email?: string;
  display_name?: string;
  real_name?: string;
  display_flag: boolean;
  nationality?: string;
  prefecture: string;
  residence_detail?: string;
  hometown?: string;
  age_band?: string;
  occupation?: string;
  blood_type?: string;
  zodiac?: string;
  meet_pref?: string;
  bio?: string;
  identity?: string;
  community_category?: string;
  position?: string;
  avatar_url?: string;
  romance_targets?: string[];
  hobbies?: string[];
};

type MediaImage = {
  id: number;
  url: string;
  order?: number;
  created_at: string;
  size_bytes?: number;
};

const MatchingProfilePage: React.FC = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  // 有料会員かどうか
  const isPaidUser = user?.membership_type === 'premium' || user?.membership_type === 'admin' || user?.membership_type === 'founder_free';
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [images, setImages] = useState<MediaImage[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [hobbyPickerOpen, setHobbyPickerOpen] = useState(false);
  const [tempHobbies, setTempHobbies] = useState<string[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);

  // i18n key mappings for select options
  const AGE_BAND_KEYS: Record<string, string> = {
    '10代': '10s', '20代前半': '20sEarly', '20代後半': '20sLate',
    '30代前半': '30sEarly', '30代後半': '30sLate', '40代前半': '40sEarly',
    '40代後半': '40sLate', '50代前半': '50sEarly', '50代後半': '50sLate', '60代以上': '60sPlus'
  };
  const OCCUPATION_KEYS: Record<string, string> = {
    '会社員': 'employee', '自営業': 'selfEmployed', 'フリーランス': 'freelance',
    '学生': 'student', '専門職': 'professional', '公務員': 'publicServant',
    'パート・アルバイト': 'partTime', 'その他': 'other'
  };
  const BLOOD_TYPE_KEYS: Record<string, string> = {
    'A型': 'A', 'B型': 'B', 'O型': 'O', 'AB型': 'AB', '不明': 'unknown'
  };
  const ZODIAC_KEYS: Record<string, string> = {
    '牡羊座': 'aries', '牡牛座': 'taurus', '双子座': 'gemini', '蟹座': 'cancer',
    '獅子座': 'leo', '乙女座': 'virgo', '天秤座': 'libra', '蠍座': 'scorpio',
    '射手座': 'sagittarius', '山羊座': 'capricorn', '水瓶座': 'aquarius', '魚座': 'pisces'
  };
  const MEET_PREF_KEYS: Record<string, string> = {
    'パートナー探し': 'partner', '友人探し': 'friend', '相談相手探し': 'counselor',
    'メンバー募集': 'member', 'その他': 'other'
  };
  const IDENTITY_KEYS: Record<string, string> = {
    'ゲイ': 'gay', 'レズビアン': 'lesbian', 'バイセクシュアル': 'bisexual',
    'トランスジェンダー': 'transgender', 'クィア': 'queer',
    'ストレート・アライ': 'ally', 'その他': 'other', '非公開': 'hidden'
  };
  const HOBBY_KEYS: Record<string, string> = {
    '音楽': 'music', '映画': 'movies', 'ドラマ': 'drama', 'アニメ': 'anime', '漫画': 'manga',
    '読書': 'reading', 'カフェ': 'cafe', '料理': 'cooking', 'グルメ': 'gourmet', 'お酒': 'alcohol',
    '旅行': 'travel', '国内旅行': 'domesticTravel', '海外旅行': 'internationalTravel',
    '写真': 'photography', 'カメラ': 'camera', 'カラオケ': 'karaoke', 'ゲーム': 'gaming',
    'ボードゲーム': 'boardGames', 'スポーツ観戦': 'sportsWatching', '筋トレ': 'gym',
    'ランニング': 'running', 'ハイキング': 'hiking', 'キャンプ': 'camping', '釣り': 'fishing',
    'ヨガ': 'yoga', 'ダンス': 'dance', '美術館': 'artMuseum', '博物館': 'museum',
    'ボランティア': 'volunteer', 'ペット': 'pets'
  };

  const PREFECTURES = [
    '北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県'
  ];
  
  // 国籍リスト（ISO 3166-1 alpha-2コードと国旗絵文字）
  const NATIONALITIES: { code: string; name: string; flag: string }[] = [
    { code: 'JP', name: '日本', flag: '🇯🇵' },
    { code: 'US', name: 'アメリカ', flag: '🇺🇸' },
    { code: 'GB', name: 'イギリス', flag: '🇬🇧' },
    { code: 'CA', name: 'カナダ', flag: '🇨🇦' },
    { code: 'AU', name: 'オーストラリア', flag: '🇦🇺' },
    { code: 'NZ', name: 'ニュージーランド', flag: '🇳🇿' },
    { code: 'DE', name: 'ドイツ', flag: '🇩🇪' },
    { code: 'FR', name: 'フランス', flag: '🇫🇷' },
    { code: 'IT', name: 'イタリア', flag: '🇮🇹' },
    { code: 'ES', name: 'スペイン', flag: '🇪🇸' },
    { code: 'PT', name: 'ポルトガル', flag: '🇵🇹' },
    { code: 'NL', name: 'オランダ', flag: '🇳🇱' },
    { code: 'BE', name: 'ベルギー', flag: '🇧🇪' },
    { code: 'CH', name: 'スイス', flag: '🇨🇭' },
    { code: 'AT', name: 'オーストリア', flag: '🇦🇹' },
    { code: 'SE', name: 'スウェーデン', flag: '🇸🇪' },
    { code: 'NO', name: 'ノルウェー', flag: '🇳🇴' },
    { code: 'DK', name: 'デンマーク', flag: '🇩🇰' },
    { code: 'FI', name: 'フィンランド', flag: '🇫🇮' },
    { code: 'IE', name: 'アイルランド', flag: '🇮🇪' },
    { code: 'KR', name: '韓国', flag: '🇰🇷' },
    { code: 'CN', name: '中国', flag: '🇨🇳' },
    { code: 'TW', name: '台湾', flag: '🇹🇼' },
    { code: 'HK', name: '香港', flag: '🇭🇰' },
    { code: 'SG', name: 'シンガポール', flag: '🇸🇬' },
    { code: 'TH', name: 'タイ', flag: '🇹🇭' },
    { code: 'VN', name: 'ベトナム', flag: '🇻🇳' },
    { code: 'PH', name: 'フィリピン', flag: '🇵🇭' },
    { code: 'ID', name: 'インドネシア', flag: '🇮🇩' },
    { code: 'MY', name: 'マレーシア', flag: '🇲🇾' },
    { code: 'IN', name: 'インド', flag: '🇮🇳' },
    { code: 'BR', name: 'ブラジル', flag: '🇧🇷' },
    { code: 'MX', name: 'メキシコ', flag: '🇲🇽' },
    { code: 'AR', name: 'アルゼンチン', flag: '🇦🇷' },
    { code: 'CL', name: 'チリ', flag: '🇨🇱' },
    { code: 'CO', name: 'コロンビア', flag: '🇨🇴' },
    { code: 'PE', name: 'ペルー', flag: '🇵🇪' },
    { code: 'ZA', name: '南アフリカ', flag: '🇿🇦' },
    { code: 'EG', name: 'エジプト', flag: '🇪🇬' },
    { code: 'IL', name: 'イスラエル', flag: '🇮🇱' },
    { code: 'AE', name: 'UAE', flag: '🇦🇪' },
    { code: 'RU', name: 'ロシア', flag: '🇷🇺' },
    { code: 'PL', name: 'ポーランド', flag: '🇵🇱' },
    { code: 'CZ', name: 'チェコ', flag: '🇨🇿' },
    { code: 'GR', name: 'ギリシャ', flag: '🇬🇷' },
    { code: 'TR', name: 'トルコ', flag: '🇹🇷' },
    { code: 'OTHER', name: 'その他', flag: '🌍' },
  ];

  // 主要都市の区データ
  const CITY_WARDS: Record<string, string[]> = {
    '東京都': ['千代田区','中央区','港区','新宿区','文京区','台東区','墨田区','江東区','品川区','目黒区','大田区','世田谷区','渋谷区','中野区','杉並区','豊島区','北区','荒川区','板橋区','練馬区','足立区','葛飾区','江戸川区'],
    '大阪市': ['都島区','福島区','此花区','西区','港区','大正区','天王寺区','浪速区','西淀川区','東淀川区','東成区','生野区','旭区','城東区','阿倍野区','住吉区','東住吉区','西成区','淀川区','鶴見区','住之江区','平野区','北区','中央区'],
    '名古屋市': ['千種区','東区','北区','西区','中村区','中区','昭和区','瑞穂区','熱田区','中川区','港区','南区','守山区','緑区','名東区','天白区'],
    '福岡市': ['東区','博多区','中央区','南区','城南区','早良区','西区'],
    '仙台市': ['青葉区','宮城野区','若林区','太白区','泉区'],
    '札幌市': ['中央区','北区','東区','白石区','豊平区','南区','西区','厚別区','手稲区','清田区'],
    '広島市': ['中区','東区','南区','西区','安佐南区','安佐北区','安芸区','佐伯区'],
  };
  const AGE_BANDS = ['10代','20代前半','20代後半','30代前半','30代後半','40代前半','40代後半','50代前半','50代後半','60代以上'];
  const OCCUPATIONS = ['会社員','自営業','フリーランス','学生','専門職','公務員','パート・アルバイト','その他'];
  const BLOOD_TYPES = ['A型','B型','O型','AB型','不明'];
  const ZODIACS = ['牡羊座','牡牛座','双子座','蟹座','獅子座','乙女座','天秤座','蠍座','射手座','山羊座','水瓶座','魚座'];
  const MEET_PREFS = ['パートナー探し','友人探し','相談相手探し','メンバー募集','その他'];
  const IDENTITIES = ['ゲイ','レズビアン','バイセクシュアル','トランスジェンダー','クィア','ストレート・アライ','その他','非公開'];
  const POSITIONS = ['タチ','ウケ（ネコ）','リバーシブル','非公開'];
  const HOBBY_CATALOG = [
    '音楽','映画','ドラマ','アニメ','漫画','読書','カフェ','料理','グルメ','お酒',
    '旅行','国内旅行','海外旅行','写真','カメラ','カラオケ','ゲーム','ボードゲーム','スポーツ観戦','筋トレ',
    'ランニング','ハイキング','キャンプ','釣り','ヨガ','ダンス','美術館','博物館','ボランティア','ペット'
  ];

  // 居住地に応じた対象都市キーを取得
  const getCityKey = (pref: string): string | null => {
    if (pref === '東京都') return '東京都';
    if (pref === '大阪府') return '大阪市';
    if (pref === '愛知県') return '名古屋市';
    if (pref === '福岡県') return '福岡市';
    if (pref === '宮城県') return '仙台市';
    if (pref === '北海道') return '札幌市';
    if (pref === '広島県') return '広島市';
    return null;
  };

  // 居住地変更時は詳細をリセット
  useEffect(() => {
    setProfile((prev) => prev ? { ...prev, residence_detail: '' } : prev);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.prefecture]);

  const fetchProfile = async () => {
    if (!token) {
      setError('ログインが必要です');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/matching/profiles/me`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        let errorMessage = `エラー ${res.status}: ${res.statusText}`;
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.detail) {
            if (typeof errorJson.detail === 'object' && errorJson.detail.error === 'premium_required') {
              errorMessage = '有料会員限定機能です';
            } else {
              errorMessage = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
            }
          }
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }
      
      const data = await res.json();
      // ローカル保存のフォールバック（DB未対応時）
      const lsResidence = localStorage.getItem('profile:residence_detail') || '';
      const lsHometown = localStorage.getItem('profile:hometown') || '';

      setProfile({
        user_id: data.user_id,
        phone_number: data.phone_number || '',
        nickname: data.nickname || '',
        email: data.email || '',
        display_name: data.display_name || '',
        display_flag: !!data.display_flag,
        prefecture: data.prefecture || '',
        residence_detail: (data.residence_detail || lsResidence),
        hometown: (data.hometown || lsHometown),
        age_band: data.age_band || '',
        occupation: data.occupation || '',
        blood_type: data.blood_type || '',
        zodiac: data.zodiac || '',
        meet_pref: data.meet_pref || '',
        bio: data.bio || '',
        identity: data.community_category || data.identity || '',
        community_category: data.community_category || data.identity || '',
        position: data.position || '',
        avatar_url: data.avatar_url || '',
        romance_targets: Array.isArray(data.romance_targets) ? data.romance_targets : [],
        hobbies: Array.isArray(data.hobbies) ? data.hobbies : [],
      });
    } catch (e: any) {
      console.error('Profile fetch error:', e);
      setError(e?.message || 'プロフィールの取得に失敗しました。バックエンドが起動していることを確認してください。');
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    if (!token) return;
    try {
      const timestamp = Date.now();
      const res = await fetch(`${API_URL}/api/matching/profiles/me?_t=${timestamp}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        },
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      console.log('Profile data with images:', data);
      
      let items = (data.images || [])
        .filter((img: any) => img && img.id && img.url) // id と url が存在する画像のみ
        .slice(0, 4)
        .map((img: any) => ({
          id: img.id,
          url: img.url.startsWith('http') ? img.url : `${API_URL}${img.url}`,
          order: img.order,
          created_at: img.created_at
        }));
      
      console.log('Filtered profile images:', items);
      setImages(items);
      
      // 現在のスライドが範囲外になった場合は調整
      if (items.length > 0) {
        if (profile?.avatar_url) {
          const idx = items.findIndex((it: MediaImage) => it.url === profile.avatar_url);
          if (idx >= 0) {
            setCurrentSlide(idx);
          } else if (currentSlide >= items.length) {
            setCurrentSlide(0);
          }
        } else if (currentSlide >= items.length) {
          setCurrentSlide(0);
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch images:', e);
      setImages([]); // エラー時は空配列をセット
    }
  };

  const saveProfile = async () => {
    if (!token || !profile) return;
    
    // 表示名の必須チェック
    if (!profile.nickname || profile.nickname.trim() === '') {
      setError('表示名は必須です');
      return;
    }
    
    setSaving(true);
    setError(null);
    try {
      const payload: any = {
        nickname: profile.nickname,
        email: profile.email,
        display_name: profile.display_name,
        real_name: profile.real_name,
        display_flag: profile.display_flag,
        nationality: profile.nationality || '',
        prefecture: profile.prefecture,
        residence_detail: profile.residence_detail || '',
        hometown: profile.hometown || '',
        age_band: profile.age_band,
        occupation: profile.occupation,
        blood_type: profile.blood_type || '',
        zodiac: profile.zodiac || '',
        meet_pref: profile.meet_pref,
        bio: profile.bio,
        identity: profile.community_category || profile.identity,
        community_category: profile.community_category || profile.identity,
        position: profile.position || '',
        avatar_url: images[currentSlide] ? images[currentSlide].url : (images.length > 0 ? images[0].url : null),
        hobbies: profile.hobbies || [],
      };
      if (newPassword) {
        payload.password = newPassword;
      }
      const res = await fetch(`${API_URL}/api/matching/profiles/me`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Save profile error:', res.status, errorText);
        try {
          const errorData = JSON.parse(errorText);
          throw new Error(errorData.detail || `保存に失敗しました (${res.status})`);
        } catch (parseError) {
          throw new Error(errorText || `保存に失敗しました (${res.status})`);
        }
      }
      
      await fetchProfile();
      setNewPassword('');
      
      // プロフィール保存後、マッチングページへリダイレクト
      alert('プロフィールを保存しました。あなたにおすすめの会員を表示します。');
      navigate('/about?tab=matching');
    } catch (e: any) {
      console.error('Profile save error:', e);
      const errorMessage = e?.message || '保存に失敗しました';
      setError(errorMessage);
      alert(`❌ エラー\n\n${errorMessage}\n\n入力内容を確認してもう一度お試しください。`);
    } finally {
      setSaving(false);
    }
  };

  const uploadImage = async (file: File) => {
    if (!token || !file) return;
    if (images.length >= 4) {
      alert('画像は4枚まで登録できます');
      return;
    }
    // ファイル形式チェック
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      alert('JPEG、PNG、WEBP形式の画像のみアップロード可能です');
      return;
    }
    // 合計容量チェック（既存画像含めて20MBまで）
    const currentTotalSize = images.reduce((sum, img) => sum + (img.size_bytes || 0), 0);
    const maxTotalSize = 20 * 1024 * 1024; // 20MB
    if (currentTotalSize + file.size > maxTotalSize) {
      alert('合計容量が20MBを超えています。既存の画像を削除してください');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    try {
      setUploading(true);
      const uploadRes = await fetch(`${API_URL}/api/media/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: form,
      });
      if (!uploadRes.ok) throw new Error(await uploadRes.text());
      const uploadData = await uploadRes.json();
      
      const attachRes = await fetch(`${API_URL}/api/matching/profiles/me/images`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url: uploadData.url }),
      });
      if (!attachRes.ok) throw new Error(await attachRes.text());
      
      await fetchImages();
      
      // ファイル入力をリセット（同じファイルを再選択可能にする）
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      alert('画像をアップロードしました');
    } catch (e: any) {
      console.error('Image upload error:', e);
      alert(`画像アップロードに失敗しました: ${e.message || 'ネットワークエラー'}`);
    } finally {
      setUploading(false);
      // エラー時もファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const deleteImage = async (imageId: number) => {
    if (!token) return;
    if (!confirm('この画像を削除しますか？')) return;
    try {
      const res = await fetch(`${API_URL}/api/matching/profiles/me/images/${imageId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error('Delete error:', errorText);
        throw new Error(errorText);
      }
      await fetchImages();
      // ファイル入力をリセット（削除後も新しい画像を選択可能にする）
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      alert('画像を削除しました');
    } catch (e: any) {
      console.error('Failed to delete image:', e);
      alert(`画像削除に失敗しました: ${e.message || 'ネットワークエラー'}`);
    }
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev === 0 ? Math.max(0, images.length - 1) : prev - 1));
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev >= images.length - 1 ? 0 : prev + 1));
  };

  const moveImage = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const newImages = [...images];
    const [movedImage] = newImages.splice(fromIndex, 1);
    newImages.splice(toIndex, 0, movedImage);
    setImages(newImages);
    setCurrentSlide(toIndex);
    try {
      const ids = newImages.map((i) => i.id);
      await fetch(`${API_URL}/api/matching/profiles/me/images/reorder`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_ids: ids }),
      });
    } catch (e) {
      console.error('Failed to save order:', e);
      alert('画像の順序保存に失敗しました');
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== dropIndex) {
      moveImage(draggedIndex, dropIndex);
    }
    setDraggedIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  useEffect(() => {
    fetchProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // プロフィール（特に avatar_url）取得後に画像を読み込む
  useEffect(() => {
    if (!token || !profile) return;
    fetchImages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, profile?.avatar_url]);

  const openModal = (url: string) => {
    setModalImageUrl(url);
  };

  const closeModal = () => {
    setModalImageUrl(null);
  };

  // 有料会員でない場合はアップグレード画面を表示
  if (!isPaidUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-4">
        <Lock className="h-16 w-16 text-yellow-500 mb-4" />
        <h2 className="text-xl font-semibold mb-2">有料会員限定機能</h2>
        <p className="text-gray-600 mb-6 text-center">
          プロフィール編集は有料会員のみご利用いただけます。
        </p>
        <button
          onClick={() => navigate('/account')}
          className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
        >
          有料会員になる
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-3">プロフィール編集</h2>
      {/* ガイダンステキスト */}
      <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p>あなたに合ったマッチング・サロンを表示するために、プロフィールを設定してください。</p>
        <p>入力内容はあとからいつでも変更できます。</p>
        <p>公開したくない項目は「非公開」を選択できます。</p>
      </div>
      <div className="p-0 sm:p-4">
        <div className="mx-auto w-full sm:max-w-3xl bg-white border rounded-lg">
          {/* 画像スライダー */}
          <div className="p-5 border-b">
            <div className="mb-2 font-medium">プロフィール画像（最大4枚）</div>
            {images.length > 0 ? (
              <div className="relative">
                {/* メイン画像表示 */}
                <div className="w-full max-w-md mx-auto aspect-[4/3] bg-gray-100 rounded-lg overflow-hidden relative">
                  {images[currentSlide] && (
                  <div 
                    className={`relative w-full h-full ${draggedIndex === currentSlide ? 'opacity-50' : ''}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, currentSlide)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, currentSlide)}
                    onDragEnd={handleDragEnd}
                  >
                    <button
                      onClick={() => openModal(resolveImageUrl(images[currentSlide].url))}
                      className="w-full h-full relative group cursor-grab active:cursor-grabbing"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resolveImageUrl(images[currentSlide]?.url)}
                        alt={`画像 ${currentSlide + 1}`}
                        className="w-full h-full object-contain"
                      />
                    </button>
                    
                    {/* カテゴリーバッジ（左上） */}
                    {(profile?.community_category || profile?.identity) && (profile?.community_category || profile?.identity) !== '非公開' && (profile?.community_category || profile?.identity) !== '非表示' && (
                      <div className="absolute top-2 left-2 bg-black text-white text-xs px-2 py-1 rounded font-semibold shadow-lg z-10">
                        {profile.community_category || profile.identity}
                      </div>
                    )}
                    
                    
                    {/* メイン画像バッジ */}
                    {currentSlide === 0 && (
                      <div className="absolute top-2 right-12 bg-gray-800 text-white text-xs px-2 py-1 rounded font-semibold shadow-lg z-10">
                        メイン
                      </div>
                    )}
                    
                    {/* 削除ボタン */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteImage(images[currentSlide].id);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-600 shadow-lg z-10"
                      aria-label="この画像を削除"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  )}
                </div>
                {/* ナビゲーションボタン */}
                {images.length > 1 && (
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between px-2">
                    <button
                      onClick={prevSlide}
                      className="w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg"
                      aria-label="前の画像"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>
                    <button
                      onClick={nextSlide}
                      className="w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg"
                      aria-label="次の画像"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                )}
                {/* ドットインジケーター（ドラッグ&ドロップ対応） */}
                <div className="flex justify-center gap-2 mt-3">
                  {images.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-3 h-3 rounded-full transition-all cursor-grab active:cursor-grabbing ${
                        idx === currentSlide ? 'bg-black scale-125' : 'bg-gray-300'
                      } ${draggedIndex === idx ? 'opacity-50' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, idx)}
                      onDragEnd={handleDragEnd}
                      onClick={() => setCurrentSlide(idx)}
                      role="button"
                      tabIndex={0}
                      aria-label={`画像${idx + 1}へ移動（ドラッグで順序変更可能）`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          setCurrentSlide(idx);
                        }
                      }}
                    />
                  ))}
                </div>
                <div className="text-xs text-gray-500 text-center mt-2">
                  {currentSlide + 1} / {images.length}
                </div>
                
                {/* サムネイル一覧 */}
                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
                    {Array.from({ length: 4 }).map((_, idx) => {
                      const image = images[idx];
                      return (
                        <div
                          key={idx}
                          className={`aspect-square border-2 rounded-lg overflow-hidden relative ${
                            image ? 'border-gray-300' : 'border-dashed border-gray-300 bg-gray-50'
                          } ${currentSlide === idx ? 'ring-2 ring-black' : ''} ${
                            draggedIndex === idx ? 'opacity-50' : ''
                          }`}
                          draggable={!!image}
                          onDragStart={(e) => image && handleDragStart(e, idx)}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, idx)}
                          onDragEnd={handleDragEnd}
                        >
                          {image ? (
                            <>
                              {/* サムネイル画像 */}
                              <button
                                onClick={() => setCurrentSlide(idx)}
                                className="w-full h-full relative group cursor-pointer"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={resolveImageUrl(image.url)}
                                  alt={`画像 ${idx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                {/* ホバー時のオーバーレイ */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                              </button>
                              
                              {/* メインバッジ */}
                              {idx === 0 && (
                                <div className="absolute top-1 left-1 bg-gray-800 text-white text-xs px-1 py-0.5 rounded text-[10px] font-semibold">
                                  メイン
                                </div>
                              )}
                              
                              {/* 削除ボタン */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteImage(image.id);
                                }}
                                className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 text-xs"
                                aria-label="画像を削除"
                              >
                                ×
                              </button>
                            </>
                          ) : (
                            /* 空きスロット */
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                              <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                              <span className="text-xs">追加</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md mx-auto aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 relative">
                {/* 性別バッジ（左上）- ダミー表示時も表示 */}
                {profile?.identity && profile.identity !== '非表示' && (
                  <div className="absolute top-2 left-2 bg-black text-white text-xs px-2 py-1 rounded font-semibold shadow-lg z-10">
                    {profile.identity}
                  </div>
                )}
                
                
                <div className="text-center">
                  <svg className="w-20 h-20 mx-auto mb-3 text-gray-300" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                  </svg>
                  <p className="text-sm text-gray-500 mb-2">プロフィール画像がありません</p>
                  <p className="text-xs text-gray-400">下のサムネイルから画像を追加してください</p>
                </div>
                
                {/* サムネイル一覧（画像なし時） */}
                <div className="mt-4">
                  <div className="grid grid-cols-4 gap-2 max-w-md mx-auto">
                    {Array.from({ length: 4 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="aspect-square border-2 border-dashed border-gray-300 bg-gray-50 rounded-lg overflow-hidden relative"
                      >
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full h-full flex flex-col items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                        >
                          <svg className="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <span className="text-xs">追加</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {/* 画像追加ボタン */}
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={images.length >= 4}
                className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                画像を追加 ({images.length}/4)
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files && e.target.files[0] && uploadImage(e.target.files[0])}
            />
            {uploading && <div className="text-sm text-gray-500 mt-2">画像をアップロード中...</div>}
            <div className="text-xs text-gray-500 mt-3">
              • 画像をクリックすると拡大表示されます<br/>
              • 1枚目の画像がメイン画像として他のユーザーに表示されます<br/>
              • サムネイルをドラッグ&ドロップで順序を変更できます<br/>
              • サムネイルの×ボタンで削除、+ボタンで追加できます<br/>
              • JPEG/PNG/WEBP形式、合計20MBまで
            </div>
          </div>

          {/* プロフィール公開設定 */}
          <div className="p-5 border-b bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium text-gray-900 mb-1">プロフィール公開設定</div>
                <div className="text-sm text-gray-600">
                  {profile?.display_flag 
                    ? 'プロフィールは公開されています。マッチング検索に表示されます。' 
                    : 'プロフィールは非公開です。マッチング検索に表示されません。'}
                </div>
              </div>
              <button
                onClick={() => {
                  if (profile) {
                    setProfile({ ...profile, display_flag: !profile.display_flag });
                  }
                }}
                className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-gray-800 focus:ring-offset-2 ${
                  profile?.display_flag ? 'bg-black' : 'bg-gray-300'
                }`}
                role="switch"
                aria-checked={profile?.display_flag ? 'true' : 'false'}
                aria-label="プロフィール公開設定"
              >
                <span
                  className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-lg transition-transform ${
                    profile?.display_flag ? 'translate-x-7' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              • ONにすると、あなたのプロフィールがマッチング検索に表示されます<br/>
              • OFFにすると、検索結果に表示されなくなります（既存のマッチやチャットは継続）
            </div>
          </div>

          {/* 画像モーダル */}
          {modalImageUrl && (
            <div
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
              onClick={closeModal}
            >
              <div className="relative max-w-4xl max-h-[90vh]">
                <button
                  onClick={closeModal}
                  className="absolute -top-10 right-0 text-white hover:text-gray-300"
                  aria-label="閉じる"
                >
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={modalImageUrl}
                  alt="拡大表示"
                  className="max-w-full max-h-[90vh] object-contain rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* 興味・趣味モーダル */}
          {hobbyPickerOpen && profile && (
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={t('matching.profile.hobbies.title')}>
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="font-semibold">{t('matching.profile.hobbies.modalTitle')}</h3>
                  <button className="text-gray-500 hover:text-gray-700" aria-label="×" onClick={() => setHobbyPickerOpen(false)}>×</button>
                </div>
                <div className="px-4 py-3 text-sm text-gray-600">{t('matching.profile.hobbies.selected')}: {tempHobbies.length} / 5</div>
                <div className="max-h-80 overflow-y-auto px-4 pb-2">
                  <div className="space-y-2">
                    {HOBBY_CATALOG.map((h) => {
                      const checked = tempHobbies.includes(h);
                      const disableNew = !checked && tempHobbies.length >= 5;
                      const hobbyKey = HOBBY_KEYS[h];
                      return (
                        <label key={h} className={`flex items-center gap-2 p-2 rounded border ${checked ? 'bg-blue-50 border-blue-300' : 'border-gray-200'}`}>
                          <input
                            type="checkbox"
                            className="w-4 h-4 text-pink-600 border-gray-300 rounded focus:ring-pink-500"
                            checked={checked}
                            disabled={disableNew}
                            aria-label={t(`matching.hobbyCatalog.${hobbyKey}`) || h}
                            onChange={(e) => {
                              if (e.target.checked) {
                                if (tempHobbies.length >= 5) return;
                                setTempHobbies([...tempHobbies, h]);
                              } else {
                                setTempHobbies(tempHobbies.filter((x) => x !== h));
                              }
                            }}
                          />
                          <span className="text-sm">{t(`matching.hobbyCatalog.${hobbyKey}`) || h}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="px-4 py-3 border-t flex items-center justify-end gap-2">
                  <button className="px-3 py-2 text-sm border rounded hover:bg-gray-50" onClick={() => setHobbyPickerOpen(false)}>{t('matching.profile.hobbies.cancel')}</button>
                  <button
                    className="px-3 py-2 text-sm bg-pink-600 text-white rounded hover:bg-pink-700"
                    onClick={() => {
                      setProfile({ ...profile, hobbies: [...tempHobbies] });
                      setHobbyPickerOpen(false);
                    }}
                  >
                    {t('matching.profile.hobbies.confirm')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="p-5">
            {loading && <div>{t('matching.profile.loading')}</div>}
            {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
            {profile && (
              <div className="space-y-6">
                <section>
                  <div className="font-medium mb-3">{t('matching.profile.account.title')}</div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="user_id" className="block text-sm mb-1">{t('matching.profile.account.userId')}</label>
                      <input
                        id="user_id"
                        type="text"
                        value={profile.phone_number || ''}
                        disabled
                        className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="nickname" className="block text-sm mb-1">
                        {t('matching.profile.account.displayName')}<span className="text-red-500 ml-1">*</span>
                      </label>
                      <input
                        id="nickname"
                        type="text"
                        value={profile.nickname || ''}
                        onChange={(e) => setProfile({ ...profile, nickname: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label htmlFor="real_name" className="block text-sm mb-1">{t('matching.profile.account.realName')}</label>
                      <input
                        id="real_name"
                        type="text"
                        value={profile.real_name || ''}
                        onChange={(e) => setProfile({ ...profile, real_name: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      />
                      <div className="text-xs text-gray-500 mt-1">{t('matching.profile.account.realNameTip')}</div>
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm mb-1">{t('matching.profile.account.email')}</label>
                      <input
                        id="email"
                        type="email"
                        value={profile.email || ''}
                        onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder="email@example.com"
                      />
                    </div>
                    <div>
                      <label htmlFor="password" className="block text-sm mb-1">{t('matching.profile.account.password')}</label>
                      <input
                        id="password"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        placeholder={t('matching.profile.account.newPassword')}
                      />
                    </div>
                  </div>
                </section>

                <section>
                  <div className="font-medium mb-2">{t('matching.profile.basic.title')}</div>
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label htmlFor="nationality" className="block text-sm mb-1">
                        {t('matching.profile.basic.nationality')} <span className="text-red-500">*</span>
                      </label>
                      <select
                        id="nationality"
                        aria-label={t('matching.profile.basic.nationality')}
                        value={profile.nationality || ''}
                        onChange={(e) => setProfile({ ...profile, nationality: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                        required
                      >
                        <option value="">{t('matching.profile.selectPlaceholder')}</option>
                        {NATIONALITIES.map((n) => (
                          <option key={n.code} value={n.code}>{n.flag} {t(`matching.nationalities.${n.code}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="prefecture" className="block text-sm mb-1">{t('matching.profile.basic.residence')}</label>
                      <select
                        id="prefecture"
                        aria-label={t('matching.profile.basic.residence')}
                        value={profile.prefecture}
                        onChange={(e) => setProfile({ ...profile, prefecture: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">{t('matching.profile.hidden')}</option>
                        {PREFECTURES.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                      {/* 居住地の詳細（区） */}
                      {(() => {
                        const cityKey = getCityKey(profile.prefecture);
                        if (!cityKey) return null;
                        return (
                          <div className="mt-2">
                            <label htmlFor="residence_detail" className="block text-sm mb-1">{t('matching.profile.basic.residenceDetail')}</label>
                            <select
                              id="residence_detail"
                              aria-label={t('matching.profile.basic.residenceDetail')}
                              value={profile.residence_detail || ''}
                              onChange={(e) => setProfile({ ...profile, residence_detail: e.target.value })}
                              className="w-full border rounded px-3 py-2 text-sm"
                            >
                              <option value="">{t('matching.profile.notSelected')}</option>
                              {CITY_WARDS[cityKey].map((w) => (
                                <option key={w} value={`${cityKey}${w}`}>{`${cityKey}${w}`}</option>
                              ))}
                            </select>
                          </div>
                        );
                      })()}
                    </div>
                    <div>
                      <label htmlFor="age_band" className="block text-sm mb-1">{t('matching.profile.basic.ageBand')}</label>
                      <select
                        id="age_band"
                        aria-label={t('matching.profile.basic.ageBand')}
                        value={profile.age_band}
                        onChange={(e) => setProfile({ ...profile, age_band: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">{t('matching.profile.hidden')}</option>
                        {AGE_BANDS.map((a) => (
                          <option key={a} value={a}>{t(`matching.ageBands.${AGE_BAND_KEYS[a]}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="occupation" className="block text-sm mb-1">{t('matching.profile.basic.occupation')}</label>
                      <select
                        id="occupation"
                        aria-label={t('matching.profile.basic.occupation')}
                        value={profile.occupation}
                        onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">{t('matching.profile.hidden')}</option>
                        {OCCUPATIONS.map((o) => (
                          <option key={o} value={o}>{t(`matching.occupations.${OCCUPATION_KEYS[o]}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="blood_type" className="block text-sm mb-1">{t('matching.profile.basic.bloodType')}</label>
                      <select
                        id="blood_type"
                        aria-label={t('matching.profile.basic.bloodType')}
                        value={profile.blood_type || ''}
                        onChange={(e) => setProfile({ ...profile, blood_type: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">{t('matching.profile.hidden')}</option>
                        {BLOOD_TYPES.map((b) => (
                          <option key={b} value={b}>{t(`matching.bloodTypes.${BLOOD_TYPE_KEYS[b]}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="zodiac" className="block text-sm mb-1">{t('matching.profile.basic.zodiac')}</label>
                      <select
                        id="zodiac"
                        aria-label={t('matching.profile.basic.zodiac')}
                        value={profile.zodiac || ''}
                        onChange={(e) => setProfile({ ...profile, zodiac: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">{t('matching.profile.hidden')}</option>
                        {ZODIACS.map((z) => (
                          <option key={z} value={z}>{t(`matching.zodiacs.${ZODIAC_KEYS[z]}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="meet_pref" className="block text-sm mb-1">{t('matching.profile.basic.meetPref')}</label>
                      <select
                        id="meet_pref"
                        aria-label={t('matching.profile.basic.meetPref')}
                        value={profile.meet_pref}
                        onChange={(e) => setProfile({ ...profile, meet_pref: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">{t('matching.profile.hidden')}</option>
                        {MEET_PREFS.map((m) => (
                          <option key={m} value={m}>{t(`matching.meetPrefs.${MEET_PREF_KEYS[m]}`)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label htmlFor="community_category" className="block text-sm mb-1">コミュニティカテゴリー</label>
                      <select
                        id="community_category"
                        aria-label="コミュニティカテゴリー"
                        value={profile.community_category || profile.identity || ''}
                        onChange={(e) => setProfile({ ...profile, community_category: e.target.value, identity: e.target.value })}
                        className="w-full border rounded px-3 py-2 text-sm"
                      >
                        <option value="">選択してください</option>
                        {IDENTITIES.map((idv) => (
                          <option key={idv} value={idv}>{idv}</option>
                        ))}
                      </select>
                      <div className="text-xs text-gray-500 mt-1">あなたにおすすめのマッチング・サロンを表示するために使用されます</div>
                    </div>
                    <div>
                      <div className="block text-sm mb-1">ポジション</div>
                      <div className="space-y-2" role="group" aria-label="ポジション">
                        {POSITIONS.map((pos) => (
                          <label key={pos} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="position"
                              checked={(profile.position || '') === pos}
                              onChange={() => setProfile({ ...profile, position: pos })}
                              className="w-4 h-4 text-black border-gray-300 focus:ring-black"
                            />
                            <span className="text-sm">{pos}</span>
                          </label>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">公開したくない場合は「非公開」を選択できます</div>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="font-medium mb-2">{t('matching.profile.hobbies.title')}</div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => {
                        setTempHobbies([...(profile.hobbies || [])]);
                        setHobbyPickerOpen(true);
                      }}
                      className="px-3 py-2 bg-white border rounded text-sm hover:bg-gray-50"
                      aria-label={t('matching.profile.hobbies.title')}
                    >
                      {t('matching.profile.hobbies.select')}
                    </button>
                    {/* 選択済みのタグ表示 */}
                    <div className="flex flex-wrap gap-2" aria-label={t('matching.profile.hobbies.title')}>
                      {(profile.hobbies || []).length === 0 && (
                        <span className="text-xs text-gray-500">{t('matching.profile.hobbies.notSelected')}</span>
                      )}
                      {(profile.hobbies || []).map((h) => (
                        <span key={h} className="px-2 py-1 bg-gray-100 text-gray-800 border border-gray-300 rounded-full text-xs">
                          {t(`matching.hobbyCatalog.${HOBBY_KEYS[h]}`) || h}
                        </span>
                      ))}
                    </div>
                  </div>
                </section>

                <section>
                  <label htmlFor="bio" className="block font-medium mb-2">{t('matching.profile.bio.title')}</label>
                  <textarea
                    id="bio"
                    value={profile.bio}
                    onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                    className="w-full border rounded px-3 py-2 text-sm h-32"
                    placeholder={t('matching.profile.bio.placeholder')}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    {t('matching.profile.bio.tip')}
                  </div>
                </section>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPreviewOpen(true)}
                    type="button"
                    className="px-4 py-2 bg-gray-800 text-white rounded text-sm hover:bg-gray-700 transition-colors"
                  >
                    👁️ {t('matching.profile.preview')}
                  </button>
                  <button
                    onClick={saveProfile}
                    disabled={saving}
                    className="px-4 py-2 bg-black text-white rounded text-sm hover:bg-gray-800 disabled:opacity-60 transition-colors"
                  >
                    {saving ? t('matching.profile.saving') : t('matching.profile.save')}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* プレビューモーダル */}
      {previewOpen && profile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setPreviewOpen(false)}>
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-xl font-bold">{t('matching.profile.previewTitle')}</h2>
              <button
                onClick={() => setPreviewOpen(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              {/* 画像スライド */}
              {images.length > 0 && (
                <div className="relative">
                  <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden">
                    <img
                      src={resolveImageUrl(images[currentSlide]?.url)}
                      alt={t('matching.profile.preview')}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {profile.identity && profile.identity !== '非表示' && profile.identity !== '非公開' && (
                    <div className="absolute top-4 left-4 bg-black text-white px-3 py-1 rounded-full text-sm font-bold">
                      {t(`matching.identities.${IDENTITY_KEYS[profile.identity]}`) || profile.identity}
                    </div>
                  )}
                  {images.length > 1 && (
                    <div className="absolute bottom-4 left-4 right-4 flex justify-center gap-2">
                      {images.map((_, idx) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full ${idx === currentSlide ? 'bg-black' : 'bg-white/50'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* プロフィール情報 */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {profile.prefecture && (
                    <div>
                      <div className="text-xs text-gray-500">{t('matching.profile.basic.residence')}</div>
                      <div className="font-medium">{profile.prefecture}{profile.residence_detail && ` ${profile.residence_detail}`}</div>
                    </div>
                  )}
                  {profile.age_band && (
                    <div>
                      <div className="text-xs text-gray-500">{t('matching.profile.basic.ageBand')}</div>
                      <div className="font-medium">{t(`matching.ageBands.${AGE_BAND_KEYS[profile.age_band]}`) || profile.age_band}</div>
                    </div>
                  )}
                  {profile.occupation && (
                    <div>
                      <div className="text-xs text-gray-500">{t('matching.profile.basic.occupation')}</div>
                      <div className="font-medium">{t(`matching.occupations.${OCCUPATION_KEYS[profile.occupation]}`) || profile.occupation}</div>
                    </div>
                  )}
                  {profile.blood_type && (
                    <div>
                      <div className="text-xs text-gray-500">{t('matching.profile.basic.bloodType')}</div>
                      <div className="font-medium">{t(`matching.bloodTypes.${BLOOD_TYPE_KEYS[profile.blood_type]}`) || profile.blood_type}</div>
                    </div>
                  )}
                  {profile.zodiac && (
                    <div>
                      <div className="text-xs text-gray-500">{t('matching.profile.basic.zodiac')}</div>
                      <div className="font-medium">{t(`matching.zodiacs.${ZODIAC_KEYS[profile.zodiac]}`) || profile.zodiac}</div>
                    </div>
                  )}
                  {profile.hometown && (
                    <div>
                      <div className="text-xs text-gray-500">{t('matching.profile.basic.residence')}</div>
                      <div className="font-medium">{profile.hometown}</div>
                    </div>
                  )}
                </div>

                {profile.romance_targets && profile.romance_targets.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{t('matching.profile.basic.romanceTarget')}</div>
                    <div className="flex flex-wrap gap-2">
                      {profile.romance_targets.map((target, idx) => (
                        <span key={idx} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm border border-gray-200">
                          {target}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.hobbies && profile.hobbies.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{t('matching.profile.hobbies.title')}</div>
                    <div className="flex flex-wrap gap-2">
                      {profile.hobbies.map((hobby, idx) => (
                        <span key={idx} className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm border border-gray-200">
                          {t(`matching.hobbyCatalog.${HOBBY_KEYS[hobby]}`) || hobby}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {profile.meet_pref && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{t('matching.profile.basic.meetPref')}</div>
                    <div className="font-medium">{t(`matching.meetPrefs.${MEET_PREF_KEYS[profile.meet_pref]}`) || profile.meet_pref}</div>
                  </div>
                )}

                {profile.bio && (
                  <div>
                    <div className="text-xs text-gray-500 mb-1">{t('matching.profile.bio.title')}</div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{profile.bio}</div>
                  </div>
                )}
              </div>

              <div className="flex justify-center pt-4">
                <button
                  onClick={() => setPreviewOpen(false)}
                  className="px-6 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
                >
                  {t('matching.profile.hobbies.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatchingProfilePage;
