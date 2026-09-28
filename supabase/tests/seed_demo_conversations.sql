-- 実行: SUPABASE_PROJECT_REF=... supabase/scripts/run_sql.sh supabase/tests/seed_demo_conversations.sql
-- デモ会員4名 (seed_demo_users.sql) 同士のサンプル会話を投入する（画面イメージ確認用）。
--   ・チャット: 咲希⇄민준 / 悠真⇄지은 の 2 組（相互いいね→マッチ→メッセージ）
--   ・サロン: 各テーマに投稿＋コメント＋リアクション
--   ・翻訳キャッシュ (message_translations / salon_translations) も同時に投入し、AI翻訳ボタンで即表示
-- 再実行可（デモ会員に関する既存の会話・投稿を削除してから入れ直す）。本番運用開始前に削除すること。
do $$
declare
  saki   uuid := 'd2000000-0000-4000-8000-000000000001';
  yuma   uuid := 'd2000000-0000-4000-8000-000000000002';
  jieun  uuid := 'd2000000-0000-4000-8000-000000000003';
  minjun uuid := 'd2000000-0000-4000-8000-000000000004';
  demo   uuid[] := array['d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002',
                         'd2000000-0000-4000-8000-000000000003','d2000000-0000-4000-8000-000000000004']::uuid[];
  conv_a uuid;  -- 咲希⇄민준
  conv_b uuid;  -- 悠真⇄지은
  t0 timestamptz := now() - interval '6 days';
begin
  -- ---------------------------------------------------------------------
  -- 既存のデモ会話・投稿を削除（再実行用）
  -- ---------------------------------------------------------------------
  delete from salon_posts where author_id = any(demo);
  delete from likes where from_user_id = any(demo) or to_user_id = any(demo);
  delete from matches where user_low_id = any(demo) or user_high_id = any(demo);
  delete from notifications where user_id = any(demo);

  -- プラン上限トリガーは seed 中のみ無効化（無料男性はメッセージ 0 件のため）
  alter table likes disable trigger likes_enforce_limit;
  alter table messages disable trigger messages_enforce_limit;
  -- コメントの可視性判定は auth.uid() 前提のため seed 中のみ無効化（件数・通知トリガーは有効のまま）
  alter table salon_comments disable trigger salon_comments_before_write;

  -- ---------------------------------------------------------------------
  -- 相互いいね → マッチ・会話は handle_like トリガーが作成
  -- ---------------------------------------------------------------------
  insert into likes (from_user_id, to_user_id, created_at, updated_at) values
    (minjun, saki,  t0, t0),
    (saki,   minjun, t0 + interval '3 hours', t0 + interval '3 hours'),
    (yuma,   jieun, t0 + interval '1 day', t0 + interval '1 day'),
    (jieun,  yuma,  t0 + interval '1 day 5 hours', t0 + interval '1 day 5 hours'),
    (yuma,   saki,  t0 + interval '2 days', t0 + interval '2 days');   -- 片思い（いいね受信の表示用）

  select c2.id into conv_a from conversations c2 join matches mt on mt.id = c2.match_id
   where mt.user_low_id = least(saki, minjun) and mt.user_high_id = greatest(saki, minjun);
  select c2.id into conv_b from conversations c2 join matches mt on mt.id = c2.match_id
   where mt.user_low_id = least(yuma, jieun) and mt.user_high_id = greatest(yuma, jieun);

  -- ---------------------------------------------------------------------
  -- チャット A: 咲希（日本語）⇄ 민준（韓国語）
  -- ---------------------------------------------------------------------
  create temp table msgs (n int, conv uuid, sender uuid, body text, lang text, tr text, tr_lang text, at timestamptz) on commit drop;
  insert into msgs values
    (1, conv_a, minjun, '안녕하세요, 사키 씨! 매칭돼서 반가워요. 프로필에 한국 영화 좋아한다고 쓰셨던데 최근에 본 영화 있어요?', 'ko',
        'こんにちは、咲希さん！マッチできてうれしいです。プロフィールに韓国映画が好きと書いてありましたが、最近見た映画はありますか？', 'ja', t0 + interval '3 hours 10 minutes'),
    (2, conv_a, saki,   'ミンジュンさん、こんにちは！こちらこそよろしくお願いします。先週「はちどり」を見ました。静かなのにずっと心に残る映画でした。', 'ja',
        '민준 씨, 안녕하세요! 저도 잘 부탁드려요. 지난주에 「벌새」를 봤어요. 조용한데도 계속 마음에 남는 영화였어요.', 'ko', t0 + interval '3 hours 25 minutes'),
    (3, conv_a, minjun, '「벌새」 저도 정말 좋아해요! 서울 배경이라 동네 풍경이 익숙해서 더 좋았어요. 사키 씨는 한국어 공부 얼마나 하셨어요?', 'ko',
        '「はちどり」、僕も本当に好きです！ソウルが舞台なので街並みが身近に感じられて、なおさら良かったです。咲希さんは韓国語の勉強をどのくらいされていますか？', 'ja', t0 + interval '3 hours 40 minutes'),
    (4, conv_a, saki,   'まだ1年くらいです。ドラマは字幕なしだと半分くらいしか分かりません😅 ミンジュンさんの日本語はとても自然ですね！', 'ja',
        '아직 1년 정도예요. 드라마는 자막 없으면 반 정도밖에 못 알아들어요😅 민준 씨 일본어는 정말 자연스러워요!', 'ko', t0 + interval '4 hours'),
    (5, conv_a, minjun, '고마워요. 대학 때 오사카에 1년 교환학생으로 있었어요. 그때 자주 갔던 나카자키초 카페 거리가 아직도 그리워요.', 'ko',
        'ありがとうございます。大学のときに大阪へ1年交換留学していました。よく行っていた中崎町のカフェ通りが今でも懐かしいです。', 'ja', t0 + interval '1 day 2 hours'),
    (6, conv_a, saki,   '中崎町！私もよく行きます。最近は古い長屋を改装したカフェが増えて、写真を撮るのも楽しいですよ。建築がお好きなら気に入ると思います。', 'ja',
        '나카자키초! 저도 자주 가요. 요즘은 오래된 나가야를 개조한 카페가 늘어서 사진 찍는 것도 즐거워요. 건축 좋아하시면 마음에 드실 거예요.', 'ko', t0 + interval '1 day 2 hours 20 minutes'),
    (7, conv_a, minjun, '사진 꼭 보고 싶어요! 다음에 오사카 가면 추천 카페 알려 주세요. 대신 서울 오시면 제가 좋아하는 건축 산책 코스 안내할게요 🙂', 'ko',
        '写真、ぜひ見たいです！次に大阪へ行くときは、おすすめのカフェを教えてください。代わりにソウルに来られたら、僕の好きな建築散歩コースを案内します🙂', 'ja', t0 + interval '2 days 9 hours'),
    (8, conv_a, saki,   'いいですね！約束です。まずはお互いのおすすめカフェを3つずつ交換しませんか？私は明日リストを送ります。', 'ja',
        '좋아요! 약속이에요. 먼저 서로 추천 카페를 3개씩 교환할까요? 저는 내일 리스트 보낼게요.', 'ko', t0 + interval '2 days 9 hours 30 minutes'),
    (9, conv_a, minjun, '좋아요, 기대할게요! 저도 서울 카페 3곳 골라 둘게요. 사키 씨 오늘도 좋은 하루 보내세요.', 'ko',
        'いいですね、楽しみにしています！僕もソウルのカフェを3か所選んでおきます。咲希さん、今日も良い一日を。', 'ja', t0 + interval '2 days 10 hours'),

  -- ---------------------------------------------------------------------
  -- チャット B: 悠真（日本語）⇄ 지은（韓国語）
  -- ---------------------------------------------------------------------
    (11, conv_b, yuma,  'ジウンさん、はじめまして。悠真です。プロフィールの「本屋さんと喫茶店が好き」に共感してマッチしました。大阪はどのあたりに住んでいますか？', 'ja',
        '지은 씨, 처음 뵙겠습니다. 유마예요. 프로필의 "서점과 커피숍을 좋아한다"에 공감해서 매칭했어요. 오사카 어느 쪽에 사세요?', 'ko', t0 + interval '1 day 6 hours'),
    (12, conv_b, jieun, '유마 씨, 반가워요! 저는 오사카 덴노지 근처에 살아요. 주말마다 근처 헌책방을 돌아다니는 게 취미예요. 도쿄에는 좋은 서점 많죠?', 'ko',
        '悠真さん、はじめまして！私は大阪の天王寺の近くに住んでいます。週末ごとに近所の古本屋をまわるのが趣味です。東京には良い本屋さんが多いですよね？', 'ja', t0 + interval '1 day 6 hours 30 minutes'),
    (13, conv_b, yuma,  '神保町の古書店街がおすすめです。一日いても飽きません。ジウンさんは日本語の本も読みますか？', 'ja',
        '진보초 고서점 거리를 추천해요. 하루 종일 있어도 지겹지 않아요. 지은 씨는 일본어 책도 읽으세요?', 'ko', t0 + interval '1 day 7 hours'),
    (14, conv_b, jieun, '네, 요즘은 요시모토 바나나의 「키친」을 천천히 읽고 있어요. 모르는 단어는 사전 찾으면서요. 유마 씨는 한국어 공부 어떻게 하세요?', 'ko',
        'はい、最近は吉本ばななの「キッチン」をゆっくり読んでいます。分からない単語は辞書を引きながら。悠真さんは韓国語の勉強をどうしていますか？', 'ja', t0 + interval '1 day 7 hours 20 minutes'),
    (15, conv_b, yuma,  '料理動画で覚えています！先週はキムチチゲに挑戦しました。レシピの単語から覚えると忘れにくいです。おすすめの韓国料理があれば教えてください。', 'ja',
        '요리 영상으로 배우고 있어요! 지난주에는 김치찌개에 도전했어요. 레시피 단어부터 익히면 잘 안 잊혀요. 추천하는 한국 요리 있으면 알려 주세요.', 'ko', t0 + interval '2 days 12 hours'),
    (16, conv_b, jieun, '김치찌개 좋네요! 다음엔 된장찌개도 도전해 보세요. 저는 반대로 일본 가정식 배우고 싶어요. 니쿠자가 레시피 알려 주실 수 있어요?', 'ko',
        'キムチチゲ、いいですね！次はテンジャンチゲにも挑戦してみてください。私は逆に日本の家庭料理を習いたいです。肉じゃがのレシピを教えてもらえますか？', 'ja', t0 + interval '2 days 12 hours 40 minutes'),
    (17, conv_b, yuma,  'もちろんです！母のレシピを日本語と、頑張って韓国語でも書いてみます。間違っていたら直してください。', 'ja',
        '물론이죠! 어머니 레시피를 일본어로, 그리고 열심히 한국어로도 써 볼게요. 틀리면 고쳐 주세요.', 'ko', t0 + interval '3 days 8 hours'),
    (18, conv_b, jieun, '와, 기대돼요! 저도 된장찌개 레시피를 일본어로 써 볼게요. 서로 첨삭해 주는 거 재밌겠어요 😊', 'ko',
        'わあ、楽しみです！私もテンジャンチゲのレシピを日本語で書いてみます。お互いに添削するの、楽しそうですね😊', 'ja', t0 + interval '3 days 8 hours 15 minutes');

  -- メッセージ本体（会話ごとに時系列順で insert し、last_message_* をトリガーで更新）
  insert into messages (id, conversation_id, sender_id, body, body_lang, read_at, created_at)
  select gen_random_uuid(), conv, sender, body, lang,
         case when n in (9, 18) then null else at + interval '5 minutes' end, at
  from msgs order by n;
  -- 翻訳キャッシュ
  insert into message_translations (message_id, target_lang, translated_body, provider)
  select ms.id, x.tr_lang, x.tr, 'seed'
  from msgs x join messages ms on ms.conversation_id = x.conv and ms.body = x.body
  on conflict do nothing;

  alter table likes enable trigger likes_enforce_limit;
  alter table messages enable trigger messages_enforce_limit;

  -- ---------------------------------------------------------------------
  -- サロン投稿・コメント・リアクション
  -- ---------------------------------------------------------------------
  create temp table sp (
    id uuid default gen_random_uuid(), cat text, author uuid, title text, body text, lang text,
    title_tr text, body_tr text, tr_lang text, at timestamptz
  ) on commit drop;
  create temp table sc (post_title text, author uuid, body text, lang text, tr text, tr_lang text, at interval) on commit drop;

  insert into sp (cat, author, title, body, lang, title_tr, body_tr, tr_lang, at) values
  ('jk_talk', saki,
   'はじめまして！大阪の咲希です',
   '韓国語を勉強中の会社員です。週末はカフェ巡りか韓国映画を見ています。日本と韓国の「日常のちょっとした違い」を話せる友達ができたらうれしいです。よろしくお願いします！',
   'ja', '처음 뵙겠습니다! 오사카의 사키입니다',
   '한국어를 공부 중인 회사원이에요. 주말에는 카페 투어를 하거나 한국 영화를 봐요. 한국과 일본의 "일상의 작은 차이"를 이야기할 수 있는 친구가 생기면 좋겠어요. 잘 부탁드려요!',
   'ko', t0 - interval '3 days'),
  ('jk_talk', minjun,
   '서울에서 인사드려요, 민준입니다',
   '사진과 건축, 요리를 좋아합니다. 대학 시절 오사카에서 교환학생으로 1년 지냈어요. 일본어로도 한국어로도 편하게 이야기해 주세요. 좋아하는 동네 이야기 환영합니다.',
   'ko', 'ソウルからご挨拶、ミンジュンです',
   '写真と建築、料理が好きです。大学時代に大阪で1年交換留学をしていました。日本語でも韓国語でも気軽に話してください。好きな街の話、歓迎です。',
   'ja', t0 - interval '3 days' + interval '2 hours'),

  ('language_study', yuma,
   '「〜거든요」の使い方が分かりません',
   'ドラマでよく「〜거든요」と聞くのですが、辞書だと「〜なんですよ」と出ます。どんな場面で使う表現ですか？例文をいくつか教えていただけるとうれしいです。',
   'ja', '"〜거든요" 사용법을 모르겠어요',
   '드라마에서 "〜거든요"를 자주 듣는데 사전에는 "〜なんですよ"라고 나와요. 어떤 상황에서 쓰는 표현인가요? 예문을 몇 개 알려 주시면 감사하겠습니다.',
   'ko', t0 - interval '2 days'),
  ('language_study', jieun,
   '일본어 "〜てしまう"의 뉘앙스 질문',
   '"食べてしまった"는 후회, "終わってしまう"는 아쉬움이라고 배웠는데, 긍정적인 상황에서도 쓰나요? 일본인 분들의 감각을 듣고 싶어요.',
   'ko', '日本語「〜てしまう」のニュアンスについて質問',
   '「食べてしまった」は後悔、「終わってしまう」は名残惜しさと習いましたが、肯定的な場面でも使いますか？日本の方の感覚を聞きたいです。',
   'ja', t0 - interval '2 days' + interval '5 hours'),

  ('travel_info', minjun,
   '오사카 나카자키초 카페 추천 3곳',
   '교환학생 시절 자주 갔던 곳입니다. ① 오래된 나가야를 개조한 카페(2층 창가가 좋아요) ② 자가 로스팅 커피집 ③ 골목 안 작은 갤러리 카페. 지도는 댓글로 물어봐 주세요.',
   'ko', '大阪・中崎町のおすすめカフェ3選',
   '交換留学のころによく通った場所です。①古い長屋を改装したカフェ（2階の窓際が好き）②自家焙煎のコーヒー店③路地裏の小さなギャラリーカフェ。地図はコメントで聞いてください。',
   'ja', t0 - interval '1 day'),
  ('travel_info', saki,
   'はじめてのソウル、3日間のまわり方を相談したいです',
   '11月に初めてソウルへ行きます。景福宮と北村は行きたいのですが、それ以外がノープランです。静かな本屋さんやカフェが好きなのですが、おすすめの地域はありますか？',
   'ja', '첫 서울 여행, 3일 코스 상담하고 싶어요',
   '11월에 처음 서울에 가요. 경복궁과 북촌은 가고 싶은데 그 외에는 계획이 없어요. 조용한 서점이나 카페를 좋아하는데 추천 지역이 있나요?',
   'ko', t0 - interval '1 day' + interval '3 hours'),

  ('kculture', jieun,
   '요즘 보는 드라마 공유해요',
   '저는 「나의 해방일지」를 다시 보고 있어요. 대사가 천천히 스며드는 작품이라 일본어 자막으로 보면 공부도 돼요. 여러분은 요즘 어떤 드라마 보세요?',
   'ko', '最近見ているドラマを共有しましょう',
   '私は「私の解放日誌」をもう一度見ています。台詞がゆっくり染みこむ作品なので、日本語字幕で見ると勉強にもなります。皆さんは最近どんなドラマを見ていますか？',
   'ja', t0 - interval '20 hours'),
  ('kculture', yuma,
   'キムチチゲに初挑戦しました',
   '動画を見ながら作りました。豆腐と豚肉の順番を間違えた気がしますが、味は満足です。次はテンジャンチゲに挑戦します。コツがあれば教えてください！',
   'ja', '김치찌개에 처음 도전했어요',
   '영상을 보면서 만들었어요. 두부와 돼지고기 넣는 순서를 틀린 것 같지만 맛은 만족이에요. 다음엔 된장찌개에 도전할게요. 요령이 있으면 알려 주세요!',
   'ko', t0 - interval '18 hours'),

  ('couple_stories', saki,
   '文化の違いで驚いたこと、ありますか？',
   '友人の日韓カップルは「記念日の数」で最初びっくりしたそうです。100日記念など、日本にはあまりない習慣ですよね。皆さんが驚いた文化の違いを教えてください。',
   'ja', '문화 차이로 놀란 적 있으세요?',
   '친구인 한일 커플은 "기념일 개수"에 처음 놀랐다고 해요. 100일 기념 같은 건 일본에는 별로 없는 문화죠. 여러분이 놀란 문화 차이를 알려 주세요.',
   'ko', t0 - interval '15 hours'),

  ('regional', minjun,
   '서울 거주 회원 계신가요?',
   '서울에 살고 있어요. 일본어 공부하는 분이나 일본에서 오신 분과 카페에서 언어 교환하고 싶어요. 관심 있으신 분은 댓글 남겨 주세요.',
   'ko', 'ソウル在住の会員さん、いますか？',
   'ソウルに住んでいます。日本語を勉強している方や日本から来られた方と、カフェで言語交換をしたいです。興味のある方はコメントを残してください。',
   'ja', t0 - interval '12 hours'),
  ('regional', jieun,
   '오사카 덴노지·아베노 근처 분들',
   '주말에 헌책방이나 커피숍 같이 다닐 분 있을까요? 한국어 회화 연습도 함께 할 수 있어요.',
   'ko', '大阪・天王寺／阿倍野あたりの皆さん',
   '週末に古本屋や喫茶店を一緒にまわる方はいませんか？韓国語の会話練習も一緒にできます。',
   'ja', t0 - interval '11 hours'),

  ('online_meetup', yuma,
   '【感想】第1回オンライン交流会に参加しました',
   '日本語と韓国語を15分ずつ交代で話す形式でした。最初は緊張しましたが、司会の方がテーマを出してくれるので話しやすかったです。次回は「好きな街」がテーマだそうです。',
   'ja', '[후기] 제1회 온라인 교류회에 참가했어요',
   '일본어와 한국어를 15분씩 교대로 말하는 형식이었어요. 처음엔 긴장했지만 진행자가 주제를 제시해 줘서 이야기하기 편했어요. 다음 회차 주제는 "좋아하는 동네"라고 합니다.',
   'ko', t0 - interval '9 hours'),

  ('verified_events', jieun,
   '본인 확인 완료 회원 이벤트, 어떤 게 있으면 좋을까요?',
   '소규모 온라인 대화 모임이나, 같은 취미(영화·독서·요리)별 모임이 있으면 참여하고 싶어요. 여러분의 아이디어도 듣고 싶어요.',
   'ko', '本人確認済み会員イベント、どんなものがあるといいですか？',
   '少人数のオンライン会話会や、同じ趣味（映画・読書・料理）ごとの集まりがあれば参加したいです。皆さんのアイデアも聞きたいです。',
   'ja', t0 - interval '7 hours'),

  ('offline_events', saki,
   '大阪でのリアルイベント、行きたい人いますか？',
   '中崎町でカフェ巡り＋言語交換の小さな会ができたら楽しそうです。運営の案内が出たら参加したいと思っています。同じ気持ちの方はコメントください。',
   'ja', '오사카 오프라인 이벤트, 가고 싶은 분 있나요?',
   '나카자키초에서 카페 투어＋언어 교환 소모임이 열리면 즐거울 것 같아요. 운영진 안내가 나오면 참가하려고 해요. 같은 마음이신 분은 댓글 주세요.',
   'ko', t0 - interval '5 hours');

  insert into salon_posts (id, author_id, category_id, title, body, body_lang, created_at, updated_at)
  select id, author, cat, title, body, lang, at, at from sp order by at;

  insert into salon_translations (target_type, target_id, target_lang, translated_body, provider)
  select 'post_title', id, tr_lang, title_tr, 'seed' from sp
  union all
  select 'post_body', id, tr_lang, body_tr, 'seed' from sp
  on conflict do nothing;

  -- コメント
  insert into sc values
  ('はじめまして！大阪の咲希です', minjun, '사키 씨 환영해요! 저도 오사카에 1년 살았어요. 카페 이야기 많이 해요 🙂', 'ko',
    '咲希さん、ようこそ！僕も大阪に1年住んでいました。カフェの話、たくさんしましょう🙂', 'ja', interval '40 minutes'),
  ('はじめまして！大阪の咲希です', jieun, '같은 오사카네요! 저는 덴노지 근처에 살아요. 잘 부탁드려요.', 'ko',
    '同じ大阪ですね！私は天王寺の近くに住んでいます。よろしくお願いします。', 'ja', interval '3 hours'),
  ('서울에서 인사드려요, 민준입니다', yuma, 'ミンジュンさん、はじめまして。建築がお好きなんですね。東京の好きな建物、ぜひ教えてください。', 'ja',
    '민준 씨, 처음 뵙겠습니다. 건축을 좋아하시는군요. 도쿄에서 좋아하는 건물, 꼭 알려 주세요.', 'ko', interval '1 hour'),

  ('「〜거든요」の使い方が分かりません', jieun, '"〜거든요"는 상대가 모르는 이유나 배경을 설명할 때 써요. 예: "저 오늘 못 가요. 약속이 있거든요."(약속があるんですよ)', 'ko',
    '「〜거든요」は相手が知らない理由や背景を説明するときに使います。例：「저 오늘 못 가요. 약속이 있거든요.」（今日は行けません。約束があるんですよ）', 'ja', interval '2 hours'),
  ('「〜거든요」の使い方が分かりません', minjun, '덧붙이면, 말끝을 살짝 올리면 "그래서 말인데…"처럼 다음 이야기를 이어가는 느낌도 나요.', 'ko',
    '補足すると、語尾を少し上げると「それでね…」のように次の話につなげる感じにもなります。', 'ja', interval '2 hours 30 minutes'),
  ('「〜거든요」の使い方が分かりません', yuma, 'お二人ともありがとうございます！「理由＋거든요」で練習してみます。', 'ja',
    '두 분 모두 감사합니다! "이유＋거든요"로 연습해 볼게요.', 'ko', interval '5 hours'),
  ('일본어 "〜てしまう"의 뉘앙스 질문', saki, '肯定的にも使いますよ！「一気に読んでしまった」は「面白くて止まらなかった」という良い意味です。', 'ja',
    '긍정적으로도 써요! "一気に読んでしまった"는 "재미있어서 멈출 수 없었다"는 좋은 의미예요.', 'ko', interval '1 hour'),
  ('일본어 "〜てしまう"의 뉘앙스 질문', jieun, '아, 그렇군요! 「面白くて一気に読んでしまいました」 이렇게 쓰면 되겠네요. 감사합니다.', 'ko',
    'あ、そうなんですね！「面白くて一気に読んでしまいました」と書けばいいんですね。ありがとうございます。', 'ja', interval '1 hour 30 minutes'),

  ('오사카 나카자키초 카페 추천 3곳', saki, '①のカフェ、私もよく行きます！2階の窓際、午後の光がきれいですよね。', 'ja',
    '① 카페, 저도 자주 가요! 2층 창가, 오후 햇살이 예쁘죠.', 'ko', interval '50 minutes'),
  ('오사카 나카자키초 카페 추천 3곳', yuma, '来月大阪へ行くので参考にします。③のギャラリーカフェが気になります。', 'ja',
    '다음 달 오사카에 가는데 참고할게요. ③ 갤러리 카페가 궁금해요.', 'ko', interval '4 hours'),
  ('はじめてのソウル、3日間のまわり方を相談したいです', minjun, '서촌(西村)을 추천해요. 경복궁 바로 옆인데 조용한 서점과 카페가 많아요. 을지로 쪽 옛 건물 카페도 좋아요.', 'ko',
    '西村（ソチョン）をおすすめします。景福宮のすぐ隣なのに静かな本屋さんやカフェが多いです。乙支路あたりの古いビルのカフェも良いですよ。', 'ja', interval '1 hour'),
  ('はじめてのソウル、3日間のまわり方を相談したいです', jieun, '저는 연희동도 추천! 동네 서점 "○○책방"이 아늑해요. 11월이면 단풍도 예쁠 거예요.', 'ko',
    '私は延禧洞（ヨンヒドン）もおすすめ！町の本屋さんが居心地いいです。11月なら紅葉もきれいですよ。', 'ja', interval '2 hours'),
  ('はじめてのソウル、3日間のまわり方を相談したいです', saki, 'お二人ともありがとうございます！西村と延禧洞、両方入れて計画してみます。', 'ja',
    '두 분 감사합니다! 서촌과 연희동 둘 다 넣어서 계획해 볼게요.', 'ko', interval '6 hours'),

  ('요즘 보는 드라마 공유해요', saki, '私は「マイ・ディア・ミスター」を見返しています。台詞が優しくて、韓国語のリスニングにもいいです。', 'ja',
    '저는 「나의 아저씨」를 다시 보고 있어요. 대사가 따뜻해서 한국어 듣기 연습에도 좋아요.', 'ko', interval '1 hour'),
  ('요즘 보는 드라마 공유해요', minjun, '둘 다 박해영 작가 작품이네요! 대사 노트 만들어서 공부하면 표현이 많이 늘어요.', 'ko',
    '2作とも同じ脚本家（パク・ヘヨン）の作品ですね！台詞ノートを作って勉強すると表現がすごく増えますよ。', 'ja', interval '2 hours'),
  ('キムチチゲに初挑戦しました', jieun, '두부는 마지막에 넣으면 부서지지 않아요! 다음 된장찌개는 멸치 육수가 포인트예요.', 'ko',
    '豆腐は最後に入れると崩れませんよ！次のテンジャンチゲは、いりこ出汁がポイントです。', 'ja', interval '30 minutes'),
  ('キムチチゲに初挑戦しました', yuma, 'なるほど、豆腐は最後！いりこ出汁も試してみます。ありがとうございます。', 'ja',
    '그렇군요, 두부는 마지막에! 멸치 육수도 시도해 볼게요. 감사합니다.', 'ko', interval '1 hour'),

  ('文化の違いで驚いたこと、ありますか？', minjun, '반대로 저는 일본의 "割り勘(더치페이)" 문화가 처음엔 신기했어요. 지금은 편해서 좋아요.', 'ko',
    '逆に僕は日本の「割り勘」文化が最初は不思議でした。今は気楽で好きです。', 'ja', interval '1 hour'),
  ('文化の違いで驚いたこと、ありますか？', jieun, '저는 일본 친구가 약속 시간 10분 전에 꼭 와 있는 게 놀라웠어요. 지금은 저도 그렇게 돼 버렸어요 😄', 'ko',
    '私は日本の友人が約束の10分前に必ず来ていることに驚きました。今は私もそうなってしまいました😄', 'ja', interval '2 hours'),

  ('서울 거주 회원 계신가요?', saki, 'ソウル在住ではないですが、11月に旅行で行きます！そのときにカフェで言語交換できたらうれしいです。', 'ja',
    '서울 거주는 아니지만 11월에 여행으로 가요! 그때 카페에서 언어 교환할 수 있으면 좋겠어요.', 'ko', interval '2 hours'),
  ('오사카 덴노지·아베노 근처 분들', saki, '私も行きたいです！天王寺の古本屋さん、いいところがあります。', 'ja',
    '저도 가고 싶어요! 덴노지의 헌책방, 좋은 곳이 있어요.', 'ko', interval '1 hour'),

  ('【感想】第1回オンライン交流会に参加しました', jieun, '저도 참가했어요! 유마 씨 김치찌개 이야기 기억나요 😊 다음 회차도 같이 해요.', 'ko',
    '私も参加しました！悠真さんのキムチチゲの話、覚えています😊 次回も一緒にやりましょう。', 'ja', interval '1 hour'),
  ('【感想】第1回オンライン交流会に参加しました', minjun, '다음 회차 주제가 "좋아하는 동네"라니 기대되네요. 저는 서촌 이야기 준비할게요.', 'ko',
    '次回のテーマが「好きな街」とは楽しみです。僕は西村の話を用意します。', 'ja', interval '3 hours'),

  ('본인 확인 완료 회원 이벤트, 어떤 게 있으면 좋을까요?', yuma, '料理テーマの回があれば参加したいです。作った料理を見せ合いながら話すのは楽しそう。', 'ja',
    '요리 테마 회차가 있으면 참가하고 싶어요. 만든 요리를 서로 보여 주며 이야기하면 즐거울 것 같아요.', 'ko', interval '1 hour'),

  ('大阪でのリアルイベント、行きたい人いますか？', jieun, '가고 싶어요! 덴노지에서 가까우니까 꼭 참가할게요.', 'ko',
    '行きたいです！天王寺から近いので必ず参加します。', 'ja', interval '30 minutes'),
  ('大阪でのリアルイベント、行きたい人いますか？', minjun, '오사카 갈 일정 맞으면 저도 참가하고 싶어요. 나카자키초 카페 안내는 제가 할게요 🙂', 'ko',
    '大阪に行く日程が合えば僕も参加したいです。中崎町のカフェ案内は僕がやります🙂', 'ja', interval '2 hours');

  insert into salon_comments (id, post_id, author_id, body, body_lang, created_at, updated_at)
  select gen_random_uuid(), sp.id, sc.author, sc.body, sc.lang, sp.at + sc.at, sp.at + sc.at
  from sc join sp on sp.title = sc.post_title
  order by sp.at + sc.at;

  insert into salon_translations (target_type, target_id, target_lang, translated_body, provider)
  select 'comment', cm.id, sc.tr_lang, sc.tr, 'seed'
  from sc join sp on sp.title = sc.post_title
  join salon_comments cm on cm.post_id = sp.id and cm.body = sc.body
  on conflict do nothing;

  -- リアクション（投稿者以外の会員から）
  insert into salon_reactions (post_id, user_id, created_at)
  select sp.id, u, sp.at + interval '1 hour'
  from sp, unnest(demo) u
  where u <> sp.author
    and (hashtext(sp.id::text || u::text) % 3) <> 0   -- 全員ではなくばらつかせる
  on conflict do nothing;

  alter table salon_comments enable trigger salon_comments_before_write;
end $$;

select 'conversations' k, count(*) from conversations c join matches m on m.id = c.match_id
 where m.user_low_id in ('d2000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000003')
union all select 'messages', count(*) from messages where sender_id::text like 'd2000000-%'
union all select 'salon_posts', count(*) from salon_posts where author_id::text like 'd2000000-%'
union all select 'salon_comments', count(*) from salon_comments where author_id::text like 'd2000000-%'
union all select 'salon_reactions', count(*) from salon_reactions where user_id::text like 'd2000000-%';
