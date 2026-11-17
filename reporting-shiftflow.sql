-- Aggregate-only reporting API. No identities, session tokens, payroll or log payloads leave ShiftFlow.
CREATE SCHEMA IF NOT EXISTS pl_reporting;
CREATE FUNCTION pl_reporting.shiftflow_report(p_from timestamptz,p_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $report$
WITH users_period AS (SELECT "createdAt" AS at FROM public."User" WHERE "createdAt">=p_from AND "createdAt"<p_to),
companies_period AS (SELECT "createdAt" AS at FROM public."Company" WHERE "createdAt">=p_from AND "createdAt"<p_to),
activity AS (SELECT "createdAt" AS at,"userId","companyId" FROM public."AuditLog" WHERE "createdAt">=p_from AND "createdAt"<p_to),
completed_shifts AS (SELECT "actualEnd" AS at FROM public."Shift" WHERE status='COMPLETED' AND "actualEnd">=p_from AND "actualEnd"<p_to),
completed_runs AS (SELECT "completedAt" AS at FROM public."ChecklistRun" WHERE status='COMPLETED' AND "completedAt">=p_from AND "completedAt"<p_to),
daily_events AS (
 SELECT at,'users' AS kind FROM users_period UNION ALL SELECT at,'companies' FROM companies_period
 UNION ALL SELECT at,'actions' FROM activity UNION ALL SELECT at,'shifts' FROM completed_shifts UNION ALL SELECT at,'checklists' FROM completed_runs
), daily AS (
 SELECT to_char(at AT TIME ZONE 'Asia/Qyzylorda','YYYY-MM-DD') AS day,
 count(*) FILTER(WHERE kind='users')::int AS users,count(*) FILTER(WHERE kind='companies')::int AS companies,
 count(*) FILTER(WHERE kind='actions')::int AS actions,count(*) FILTER(WHERE kind='shifts')::int AS shifts,
 count(*) FILTER(WHERE kind='checklists')::int AS checklists FROM daily_events GROUP BY 1
)
SELECT jsonb_build_object(
 'totals',jsonb_build_object('users',(SELECT count(*)::int FROM public."User"),'companies',(SELECT count(*)::int FROM public."Company"),
 'employees',(SELECT count(*)::int FROM public."CompanyMember" WHERE status='ACTIVE' AND role<>'OWNER'),
 'locations',(SELECT count(*)::int FROM public."Location" WHERE status='ACTIVE')),
 'current',jsonb_build_object('newUsers',(SELECT count(*)::int FROM users_period),'newCompanies',(SELECT count(*)::int FROM companies_period),
 'activeUsers',(SELECT count(DISTINCT "userId")::int FROM activity),'activeCompanies',(SELECT count(DISTINCT "companyId")::int FROM activity),
 'actions',(SELECT count(*)::int FROM activity),'shiftsCreated',(SELECT count(*)::int FROM public."Shift" WHERE "createdAt">=p_from AND "createdAt"<p_to),
 'shiftsStarted',(SELECT count(*)::int FROM public."Shift" WHERE "actualStart">=p_from AND "actualStart"<p_to),
 'shiftsCompleted',(SELECT count(*)::int FROM completed_shifts),'checklistsCompleted',(SELECT count(*)::int FROM completed_runs)),
 'shifts',COALESCE((SELECT jsonb_agg(s ORDER BY s.status) FROM (SELECT status::text,count(*)::int AS count FROM public."Shift" GROUP BY status) s),'[]'::jsonb),
 'checklists',COALESCE((SELECT jsonb_agg(s ORDER BY s.status) FROM (SELECT status::text,count(*)::int AS count FROM public."ChecklistRun" GROUP BY status) s),'[]'::jsonb),
 'daily',COALESCE((SELECT jsonb_agg(d ORDER BY d.day) FROM (SELECT * FROM daily ORDER BY day DESC LIMIT 400) d),'[]'::jsonb),
 'dailyTruncated',(SELECT count(*)>400 FROM daily)
)
$report$;
REVOKE ALL ON FUNCTION pl_reporting.shiftflow_report(timestamptz,timestamptz) FROM PUBLIC;
