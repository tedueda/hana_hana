-- 交流サロン (S1) 用 enum 拡張。新しい enum 値は同一トランザクション内で使えないため本体 Migration と分離する。
-- ---------------------------------------------------------------------------
-- enum 拡張
-- ---------------------------------------------------------------------------
alter type report_reason_t add value if not exists 'spam';
alter type report_reason_t add value if not exists 'solicitation';
alter type report_reason_t add value if not exists 'personal_info';
alter type notification_type_t add value if not exists 'salon_comment';
alter type notification_type_t add value if not exists 'salon_reaction';
alter type notification_type_t add value if not exists 'salon_moderation';

