CREATE TABLE jobs (
    job_id           TEXT PRIMARY KEY,
    idempotency_key  TEXT UNIQUE NOT NULL,
    state            TEXT NOT NULL DEFAULT 'queued',
    region           TEXT NOT NULL,
    category_id      INTEGER NOT NULL DEFAULT 0,
    max_results      INTEGER NOT NULL DEFAULT 50,
    attempt          INTEGER NOT NULL DEFAULT 0,
    max_attempts     INTEGER NOT NULL DEFAULT 3,
    videos_fetched   INTEGER NOT NULL DEFAULT 0,
    videos_inserted  INTEGER NOT NULL DEFAULT 0,
    error_message    TEXT,
    next_retry_at    TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    metadata         JSONB NOT NULL DEFAULT '{}'
);