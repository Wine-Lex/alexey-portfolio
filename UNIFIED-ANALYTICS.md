# Program Lab: unified owner analytics

URL: https://alexey-portfolio-leads.onrender.com/owner

The existing Telegram OTP flow protects `/api/owner/hub`. Public assets contain no database credentials. The original analytics collector, consent behavior, session expiry, lead delivery and other application sites are unchanged.

## Sources

- Portfolio: existing analytics database, existing counters and event retention (180 days).
- ShiftFlow: `SHIFTFLOW_ANALYTICS_URL`, a dedicated restricted role with EXECUTE on `pl_reporting.shiftflow_report(timestamptz,timestamptz)` only. The fixed SQL, STABLE, SECURITY DEFINER function uses `search_path=pg_catalog` and fully qualified source tables; PUBLIC execution is revoked. No direct SELECT on application tables is granted. Four headline counters cover all accounts, all companies, companies with audit actions during the period, and shifts completed in the period. Details include registrations, users with actions, created/started shifts, completed checklists, current employee/location counts, and all-time status counts. No names, contacts, password hashes, session tokens, audit payloads or payroll values leave this source. No new browser tracker is installed.
- My Shifts: `MYSHIFTS_ANALYTICS_URL`, a dedicated restricted reader of `pl_reporting` views. Calculations are copied unchanged from Wine-Lex/shiftflow, branch moi-smeny, analytics.mjs at bf79856543e417dc659b85f42415580e0e1acd0c. Existing 400-day retention and pseudonymous account grouping apply. Reports contain aggregates, not visitor-level exports. Account totals/current usage are independent of behavioral consent.
- Between Lines: `BETWEEN_ANALYTICS_URL`, restricted reader of `pl_reporting.summary`. Exactly the four existing all-time operational counters; internal accounts and deleted works are excluded. No user names, emails, work content or feedback is exported.

Database credentials belong only in Render environment variables. Merge additions; never replace existing Telegram/portfolio configuration. Readers have SELECT on reporting views or EXECUTE on the fixed aggregate function only, read-only transactions by default, no source-table or exclusion-registry grants, and a 12-second statement timeout. SQL definitions are additive one-time migrations, tested on branches before production. Existing collectors, records and panels remain available.

## Behavior

The overview does not sum people across applications. Detailed views retain source-specific definitions. Periods use UTC+5; `all` is bounded by source retention. Between Lines always shows all-time counters, with the period selector disabled. Source responses are cached for 45 seconds. An unavailable source is explicitly marked and never replaced with zeroes. Responses and owner assets use no-store/noindex headers.

ShiftFlow activity means recorded audit actions, not page views or login counts. Companies and active users are distinct within the entire selected range, not sums of daily unique counts. Registrations use creation time; finished shifts require current COMPLETED status and actualEnd in the half-open range [from,to); completed checklists use completedAt and COMPLETED status. The all-history option has no artificial lower cutoff; the daily table shows at most the last 400 non-empty dates, with an explicit truncation notice. Owner-confirmed ShiftFlow test companies and associated test users are excluded by explicit UUID registries in pl_reporting.excluded_companies and pl_reporting.excluded_users. All operational counters, historical daily rows and current statuses apply these exclusions. Existing app rows remain intact. New accounts and companies are counted automatically; no date, email, name or blanket-zero heuristics are used. New report responses require testDataExcluded=true to avoid incorrectly labelling an old unfiltered report. Company counts are not paying-customer counts. Source management remains at https://shiftflow-xmpy.onrender.com/admin.

## Build and checks

`npm ci`, then `npm run build:analytics`. Commit the generated analytics.bundle.cjs because the existing Render service runs a prebuilt bundle without installing dependencies.

`npm test` runs collector, client and hub checks. The existing real-Postgres integration test requires an isolated ANALYTICS_DATABASE_URL. New restricted-reader integration checks require MYSHIFTS_ANALYTICS_URL and BETWEEN_ANALYTICS_URL; use test branches and never commit credentials. Test access denial, private source-table denial, write denial, source-failure isolation, cache expiry and report shapes. UI verification covers desktop, 390px mobile width, all source tabs, detail disclosures and period selection.

Administrative editing of ad costs, users, publications and feedback remains in the original project owner panels, linked from the relevant section.

## ShiftFlow validation, 2026-11-17

`node --env-file=.test.env --test shiftflow.test.cjs`: UTC+5 boundaries, aggregate-only reader, denied private-table reads and writes, and isolated-branch fixtures verify inclusive lower / exclusive upper bounds, distinct actors and daily grouping. Owner fixture writes are guarded by the named temporary branch id. Production has no fixture writes. `.test.env`, `.preview.env` and `.connections.local.json` must stay local and uncommitted. Production permission checks use the restricted role; no public auth change is required.

## Owner-confirmed exclusions, 2026-11-17

The owner confirmed all ten existing companies as test registrations. Their exact company UUIDs were seeded privately; sixteen associated accounts with no non-excluded company relationship at classification time were marked as test users. No identities are included in the public SQL migration. Additive registries and CREATE OR REPLACE FUNCTION preserve application records and existing reader privileges. Restricted readers cannot edit or list the registries. Company exclusion filters locations, memberships, shifts, checklist runs and audit activity. User exclusion filters registrations and actor activity. Only owner-confirmed accounts/companies belong in these registries.

Four integration checks passed against the named test branch, including explicit removal, historical counters, preservation of app rows, and continued counting of other new registrations. Production checks confirmed unchanged table row counts and zero non-test data for the existing snapshot.
