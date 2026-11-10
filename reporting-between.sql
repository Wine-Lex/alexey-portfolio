-- Only four operational counters. Names, emails, works and feedback are not exported.
CREATE SCHEMA IF NOT EXISTS pl_reporting;
CREATE VIEW pl_reporting.summary AS
 WITH real_users AS (SELECT id::text AS id FROM neon_auth."user" u WHERE NOT EXISTS(SELECT 1 FROM public.bl_internal_accounts t WHERE t.user_id=u.id::text)),
 works AS (SELECT w.author_id,w.public_data IS NOT NULL AS published,w.deleted_at FROM public.bl_works w JOIN real_users u ON u.id=w.author_id)
 SELECT (SELECT count(*)::int FROM real_users) AS users,
 (SELECT count(DISTINCT author_id)::int FROM works WHERE published AND deleted_at IS NULL) AS authors,
 (SELECT count(*)::int FROM works WHERE published AND deleted_at IS NULL) AS published,
 (SELECT COALESCE(sum(a.login_count-1),0)::int FROM public.bl_account_logins a JOIN real_users u ON u.id=a.user_id) AS returning_logins;
