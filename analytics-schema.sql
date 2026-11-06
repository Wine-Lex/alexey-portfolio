-- Separate Program Lab database. No personal contacts, IPs or form contents.
CREATE TABLE IF NOT EXISTS pl_events (
 id uuid PRIMARY KEY, visitor text NOT NULL, session text NOT NULL,
 kind text NOT NULL CHECK (kind IN ('view','project','contact','lead')),
 target text NOT NULL DEFAULT '', source text NOT NULL DEFAULT 'direct',
 device text NOT NULL CHECK (device IN ('mobile','desktop')),
 at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pl_events_at ON pl_events(at);
CREATE INDEX IF NOT EXISTS pl_events_visitor ON pl_events(visitor,at);
CREATE INDEX IF NOT EXISTS pl_events_session ON pl_events(session,at);
CREATE TABLE IF NOT EXISTS pl_login (
 id integer PRIMARY KEY CHECK(id=1), code_hash text NOT NULL,
 expires timestamptz NOT NULL, attempts integer NOT NULL DEFAULT 0,
 sent_at timestamptz NOT NULL DEFAULT now(), request_day date NOT NULL DEFAULT current_date,
 requests integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS pl_owner_sessions (
 token_hash text PRIMARY KEY, expires timestamptz NOT NULL
);

