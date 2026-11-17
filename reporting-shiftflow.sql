-- Aggregate-only reporting API. No identities, session tokens, payroll or log payloads leave ShiftFlow.
CREATE SCHEMA IF NOT EXISTS pl_reporting;
CREATE TABLE IF NOT EXISTS pl_reporting.excluded_companies (company_id uuid PRIMARY KEY,reason text NOT NULL,excluded_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS pl_reporting.excluded_users (user_id uuid PRIMARY KEY,reason text NOT NULL,excluded_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION pl_reporting.shiftflow_report(p_from timestamptz,p_to timestamptz)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $report$
WITH real_users AS (SELECT u.id,u."createdAt" FROM public."User" u WHERE NOT EXISTS(SELECT 1 FROM pl_reporting.excluded_users e WHERE e.user_id=u.id)),
real_companies AS (SELECT c.id,c."createdAt" FROM public."Company" c WHERE NOT EXISTS(SELECT 1 FROM pl_reporting.excluded_companies e WHERE e.company_id=c.id)),
real_shifts AS (SELECT s.status,s."createdAt",s."actualStart",s."actualEnd" FROM public."Shift" s JOIN real_companies c ON c.id=s."companyId"),
real_runs AS (SELECT r.status,r."completedAt" FROM public."ChecklistRun" r JOIN real_companies c ON c.id=r."companyId"),
users_period AS (SELECT "createdAt" AS at FROM real_users WHERE "createdAt">=p_from AND "createdAt"<p_to),
companies_period AS (SELECT "createdAt" AS at FROM real_companies WHERE "createdAt">=p_from AND "createdAt"<p_to),
activity AS (SELECT a."createdAt" AS at,a."userId",a."companyId" FROM public."AuditLog" a JOIN real_companies c ON c.id=a."companyId" JOIN real_users u ON u.id=a."userId" WHERE a."createdAt">=p_from AND a."createdAt"<p_to),
completed_shifts AS (SELECT "actualEnd" AS at FROM real_shifts WHERE status='COMPLETED' AND "actualEnd">=p_from AND "actualEnd"<p_to),
completed_runs AS (SELECT "completedAt" AS at FROM real_runs WHERE status='COMPLETED' AND "completedAt">=p_from AND "completedAt"<p_to),
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
 'testDataExcluded',true,
 'totals',jsonb_build_object('users',(SELECT count(*)::int FROM real_users),'companies',(SELECT count(*)::int FROM real_companies),
 'employees',(SELECT count(*)::int FROM public."CompanyMember" m JOIN real_companies c ON c.id=m."companyId" JOIN real_users u ON u.id=m."userId" WHERE m.status='ACTIVE' AND m.role<>'OWNER'),
 'locations',(SELECT count(*)::int FROM public."Location" l JOIN real_companies c ON c.id=l."companyId" WHERE l.status='ACTIVE')),
 'current',jsonb_build_object('newUsers',(SELECT count(*)::int FROM users_period),'newCompanies',(SELECT count(*)::int FROM companies_period),
 'activeUsers',(SELECT count(DISTINCT "userId")::int FROM activity),'activeCompanies',(SELECT count(DISTINCT "companyId")::int FROM activity),
 'actions',(SELECT count(*)::int FROM activity),'shiftsCreated',(SELECT count(*)::int FROM real_shifts WHERE "createdAt">=p_from AND "createdAt"<p_to),
 'shiftsStarted',(SELECT count(*)::int FROM real_shifts WHERE "actualStart">=p_from AND "actualStart"<p_to),
 'shiftsCompleted',(SELECT count(*)::int FROM completed_shifts),'checklistsCompleted',(SELECT count(*)::int FROM completed_runs)),
 'shifts',COALESCE((SELECT jsonb_agg(s ORDER BY s.status) FROM (SELECT status::text,count(*)::int AS count FROM real_shifts GROUP BY status) s),'[]'::jsonb),
 'checklists',COALESCE((SELECT jsonb_agg(s ORDER BY s.status) FROM (SELECT status::text,count(*)::int AS count FROM real_runs GROUP BY status) s),'[]'::jsonb),
 'daily',COALESCE((SELECT jsonb_agg(d ORDER BY d.day) FROM (SELECT * FROM daily ORDER BY day DESC LIMIT 400) d),'[]'::jsonb),
 'dailyTruncated',(SELECT count(*)>400 FROM daily)
)
$report$;
REVOKE ALL ON FUNCTION pl_reporting.shiftflow_report(timestamptz,timestamptz) FROM PUBLIC;
