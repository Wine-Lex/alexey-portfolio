# Program Lab: unified owner analytics

URL: https://alexey-portfolio-leads.onrender.com/owner

The existing Telegram OTP flow protects `/api/owner/hub`. Public assets contain no database credentials. The original analytics collector, consent behavior, session expiry, lead delivery and other application sites are unchanged.

## Sources

- Portfolio: existing analytics database, existing counters and event retention (180 days).
- My Shifts: `MYSHIFTS_ANALYTICS_URL`, a dedicated restricted reader of `pl_reporting` views. Calculations are copied unchanged from Wine-Lex/shiftflow, branch moi-smeny, analytics.mjs at bf79856543e417dc659b85f42415580e0e1acd0c. Existing 400-day retention and pseudonymous account grouping apply. Reports contain aggregates, not visitor-level exports. Account totals/current usage are independent of behavioral consent.
- Between Lines: `BETWEEN_ANALYTICS_URL`, restricted reader of `pl_reporting.summary`. Exactly the four existing all-time operational counters; internal accounts and deleted works are excluded. No user names, emails, work content or feedback is exported.

Database credentials belong only in Render environment variables. Merge additions; never replace existing Telegram/portfolio configuration. Readers have SELECT on reporting views only, read-only transactions by default, no source-table grants, and a 12-second statement timeout. SQL view definitions are additive one-time migrations, tested on branches before production. Existing collectors, records and panels remain available.

## Behavior

The overview does not sum people across applications. Detailed views retain source-specific definitions. Periods use UTC+5; `all` is bounded by source retention. Between Lines always shows all-time counters, with the period selector disabled. Source responses are cached for 45 seconds. An unavailable source is explicitly marked and never replaced with zeroes. Responses and owner assets use no-store/noindex headers.

## Build and checks

`npm ci`, then `npm run build:analytics`. Commit the generated analytics.bundle.cjs because the existing Render service runs a prebuilt bundle without installing dependencies.

`npm test` runs collector, client and hub checks. The existing real-Postgres integration test requires an isolated ANALYTICS_DATABASE_URL. New restricted-reader integration checks require MYSHIFTS_ANALYTICS_URL and BETWEEN_ANALYTICS_URL; use test branches and never commit credentials. Test access denial, private source-table denial, write denial, source-failure isolation, cache expiry and report shapes. UI verification covers desktop, 390px mobile width, all source tabs, detail disclosures and period selection.

Administrative editing of ad costs, users, publications and feedback remains in the original project owner panels, linked from the relevant section.
