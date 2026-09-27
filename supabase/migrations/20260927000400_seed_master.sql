-- マスターデータ初期値 (管理画面から編集可能)

insert into languages (code, name_ja, name_ko, name_en, sort_order) values
  ('ja', '日本語', '일본어', 'Japanese', 1),
  ('ko', '韓国語', '한국어', 'Korean', 2),
  ('en', '英語',   '영어',   'English', 3);

insert into purposes (slug, name_ja, name_ko, name_en, sort_order) values
  ('romance',        '恋人探し',     '연인 찾기',       'Looking for a partner', 1),
  ('dating',         '恋活',         '연애',            'Dating', 2),
  ('friendship',     '友達探し',     '친구 찾기',       'Friendship', 3),
  ('jp_kr_exchange', '日韓交流',     '한일 교류',       'Japan–Korea exchange', 4),
  ('language',       '言語交換',     '언어 교환',       'Language exchange', 5),
  ('hobby',          '趣味友達',     '취미 친구',       'Hobby friends', 6),
  ('travel',         '旅行時の交流', '여행 시 교류',    'Meet while traveling', 7),
  ('long_term',      '長期的な関係', '장기적인 관계',   'Long-term relationship', 8);

insert into interests (slug, name_ja, name_ko, name_en, category, sort_order) values
  ('music',    '音楽',       '음악',       'Music', 'culture', 1),
  ('movies',   '映画',       '영화',       'Movies', 'culture', 2),
  ('drama',    'ドラマ',     '드라마',     'Drama', 'culture', 3),
  ('kpop',     'K-POP',      'K-POP',      'K-POP', 'culture', 4),
  ('jpop',     'J-POP',      'J-POP',      'J-POP', 'culture', 5),
  ('anime',    'アニメ',     '애니메이션', 'Anime', 'culture', 6),
  ('manga',    'マンガ',     '만화',       'Manga', 'culture', 7),
  ('games',    'ゲーム',     '게임',       'Games', 'culture', 8),
  ('food',     '食べ歩き',   '맛집 탐방',  'Food', 'lifestyle', 9),
  ('cooking',  '料理',       '요리',       'Cooking', 'lifestyle', 10),
  ('cafe',     'カフェ',     '카페',       'Cafe', 'lifestyle', 11),
  ('travel',   '旅行',       '여행',       'Travel', 'lifestyle', 12),
  ('sports',   'スポーツ',   '스포츠',     'Sports', 'active', 13),
  ('fitness',  'フィットネス','피트니스',  'Fitness', 'active', 14),
  ('outdoor',  'アウトドア', '아웃도어',   'Outdoor', 'active', 15),
  ('fashion',  'ファッション','패션',      'Fashion', 'lifestyle', 16),
  ('beauty',   '美容',       '뷰티',       'Beauty', 'lifestyle', 17),
  ('photo',    '写真',       '사진',       'Photography', 'creative', 18),
  ('art',      'アート',     '아트',       'Art', 'creative', 19),
  ('reading',  '読書',       '독서',       'Reading', 'culture', 20),
  ('language', '語学',       '어학',       'Language learning', 'study', 21),
  ('history',  '歴史',       '역사',       'History', 'culture', 22),
  ('pets',     'ペット',     '반려동물',   'Pets', 'lifestyle', 23),
  ('business', 'ビジネス',   '비즈니스',   'Business', 'study', 24);

-- 日本: 47 都道府県 (JIS X 0401)
insert into regions (country, code, name_ja, name_ko, name_en, sort_order) values
  ('JP','01','北海道','홋카이도','Hokkaido',1),
  ('JP','02','青森県','아오모리현','Aomori',2),
  ('JP','03','岩手県','이와테현','Iwate',3),
  ('JP','04','宮城県','미야기현','Miyagi',4),
  ('JP','05','秋田県','아키타현','Akita',5),
  ('JP','06','山形県','야마가타현','Yamagata',6),
  ('JP','07','福島県','후쿠시마현','Fukushima',7),
  ('JP','08','茨城県','이바라키현','Ibaraki',8),
  ('JP','09','栃木県','도치기현','Tochigi',9),
  ('JP','10','群馬県','군마현','Gunma',10),
  ('JP','11','埼玉県','사이타마현','Saitama',11),
  ('JP','12','千葉県','지바현','Chiba',12),
  ('JP','13','東京都','도쿄도','Tokyo',13),
  ('JP','14','神奈川県','가나가와현','Kanagawa',14),
  ('JP','15','新潟県','니가타현','Niigata',15),
  ('JP','16','富山県','도야마현','Toyama',16),
  ('JP','17','石川県','이시카와현','Ishikawa',17),
  ('JP','18','福井県','후쿠이현','Fukui',18),
  ('JP','19','山梨県','야마나시현','Yamanashi',19),
  ('JP','20','長野県','나가노현','Nagano',20),
  ('JP','21','岐阜県','기후현','Gifu',21),
  ('JP','22','静岡県','시즈오카현','Shizuoka',22),
  ('JP','23','愛知県','아이치현','Aichi',23),
  ('JP','24','三重県','미에현','Mie',24),
  ('JP','25','滋賀県','시가현','Shiga',25),
  ('JP','26','京都府','교토부','Kyoto',26),
  ('JP','27','大阪府','오사카부','Osaka',27),
  ('JP','28','兵庫県','효고현','Hyogo',28),
  ('JP','29','奈良県','나라현','Nara',29),
  ('JP','30','和歌山県','와카야마현','Wakayama',30),
  ('JP','31','鳥取県','돗토리현','Tottori',31),
  ('JP','32','島根県','시마네현','Shimane',32),
  ('JP','33','岡山県','오카야마현','Okayama',33),
  ('JP','34','広島県','히로시마현','Hiroshima',34),
  ('JP','35','山口県','야마구치현','Yamaguchi',35),
  ('JP','36','徳島県','도쿠시마현','Tokushima',36),
  ('JP','37','香川県','가가와현','Kagawa',37),
  ('JP','38','愛媛県','에히메현','Ehime',38),
  ('JP','39','高知県','고치현','Kochi',39),
  ('JP','40','福岡県','후쿠오카현','Fukuoka',40),
  ('JP','41','佐賀県','사가현','Saga',41),
  ('JP','42','長崎県','나가사키현','Nagasaki',42),
  ('JP','43','熊本県','구마모토현','Kumamoto',43),
  ('JP','44','大分県','오이타현','Oita',44),
  ('JP','45','宮崎県','미야자키현','Miyazaki',45),
  ('JP','46','鹿児島県','가고시마현','Kagoshima',46),
  ('JP','47','沖縄県','오키나와현','Okinawa',47);

-- 韓国: 17 広域自治体
insert into regions (country, code, name_ja, name_ko, name_en, sort_order) values
  ('KR','11','ソウル特別市','서울특별시','Seoul',1),
  ('KR','26','釜山広域市','부산광역시','Busan',2),
  ('KR','27','大邱広域市','대구광역시','Daegu',3),
  ('KR','28','仁川広域市','인천광역시','Incheon',4),
  ('KR','29','光州広域市','광주광역시','Gwangju',5),
  ('KR','30','大田広域市','대전광역시','Daejeon',6),
  ('KR','31','蔚山広域市','울산광역시','Ulsan',7),
  ('KR','36','世宗特別自治市','세종특별자치시','Sejong',8),
  ('KR','41','京畿道','경기도','Gyeonggi',9),
  ('KR','42','江原特別自治道','강원특별자치도','Gangwon',10),
  ('KR','43','忠清北道','충청북도','Chungcheongbuk',11),
  ('KR','44','忠清南道','충청남도','Chungcheongnam',12),
  ('KR','45','全北特別自治道','전북특별자치도','Jeonbuk',13),
  ('KR','46','全羅南道','전라남도','Jeollanam',14),
  ('KR','47','慶尚北道','경상북도','Gyeongsangbuk',15),
  ('KR','48','慶尚南道','경상남도','Gyeongsangnam',16),
  ('KR','50','済州特別自治道','제주특별자치도','Jeju',17);

insert into regions (country, code, name_ja, name_ko, name_en, sort_order) values
  ('other','other','その他','기타','Other',1);

insert into app_settings (key, value) values
  ('recommend_weights', '{"gender":30,"gender_mutual":20,"nationality":25,"age":15,"language":20,"interest":5,"purpose":10,"region":10,"country":5,"meeting_pref":5,"recent":5,"verified":5}'),
  ('require_verification_for_like', 'false'),
  ('max_profile_photos', '5');
