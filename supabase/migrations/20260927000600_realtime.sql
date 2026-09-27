-- Realtime: メッセージ / 通知 / 会話一覧の変更をクライアントへ配信する
-- (RLS はそのまま適用されるため、購読者は自分が参照できる行のみ受信する)
alter publication supabase_realtime add table messages;
alter publication supabase_realtime add table notifications;
alter publication supabase_realtime add table conversations;
alter publication supabase_realtime add table matches;

-- UPDATE/DELETE イベントで旧値を含めるため
alter table messages replica identity full;
