-- Additive reporting-only views. Existing collectors, rows and application permissions stay intact.
CREATE SCHEMA IF NOT EXISTS pl_reporting;
CREATE VIEW pl_reporting.visitors AS SELECT id,actor,first_at,last_at,source,medium,campaign FROM public.myshifts_analytics_visitors;
CREATE VIEW pl_reporting.sessions AS SELECT id,visitor,first_at,last_at,source,medium,campaign FROM public.myshifts_analytics_sessions;
CREATE VIEW pl_reporting.events AS SELECT visitor,session,name,min(at) AS at,count(*)::int AS count FROM public.myshifts_analytics_events GROUP BY visitor,session,name,to_char(at::timestamptz AT TIME ZONE 'Asia/Qyzylorda','YYYY-MM-DD');
CREATE VIEW pl_reporting.costs AS SELECT id,date,source,medium,campaign,amount,currency,version,voided FROM public.myshifts_analytics_costs;
CREATE VIEW pl_reporting.coverage AS SELECT started_at FROM public.myshifts_analytics_config WHERE id=1;
CREATE VIEW pl_reporting.registrations AS SELECT to_char(created_at::timestamptz AT TIME ZONE 'Asia/Qyzylorda','YYYY-MM-DD') AS day,count(*)::int AS count FROM public.myshifts_users GROUP BY 1;
CREATE VIEW pl_reporting.account_totals AS SELECT (SELECT count(*)::int FROM public.myshifts_users) AS total;
CREATE VIEW pl_reporting.work_usage AS
 WITH documents AS (SELECT user_id,body::jsonb AS doc FROM public.myshifts_documents),
 work_data AS (SELECT user_id,doc AS data FROM documents UNION ALL SELECT user_id,w->'data' FROM documents CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(doc->'workplaces')='array' THEN doc->'workplaces' ELSE '[]'::jsonb END) w),
 flags AS (SELECT user_id,
 jsonb_array_length(CASE WHEN jsonb_typeof(data->'shifts')='array' THEN data->'shifts' ELSE '[]'::jsonb END)>0 AS shifts,
 (EXISTS(SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(data->'shifts')='array' THEN data->'shifts' ELSE '[]'::jsonb END) s WHERE s->>'end' IS NOT NULL AND COALESCE((s->>'planned')::boolean,false)=false AND COALESCE((s->>'cancelled')::boolean,false)=false)
 OR jsonb_array_length(CASE WHEN jsonb_typeof(data->'incomeEntries')='array' THEN data->'incomeEntries' ELSE '[]'::jsonb END)>0
 OR jsonb_array_length(CASE WHEN jsonb_typeof(data->'revenues')='array' THEN data->'revenues' ELSE '[]'::jsonb END)>0
 OR jsonb_array_length(CASE WHEN jsonb_typeof(data->'days')='array' THEN data->'days' ELSE '[]'::jsonb END)>0) AS salary FROM work_data)
 SELECT count(DISTINCT user_id) FILTER(WHERE shifts)::int AS with_shifts,count(DISTINCT user_id) FILTER(WHERE salary)::int AS with_salary FROM flags;
