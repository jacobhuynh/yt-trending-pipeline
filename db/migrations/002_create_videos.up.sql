CREATE TABLE videos (
    video_id      TEXT NOT NULL,
    job_id        TEXT NOT NULL REFERENCES jobs(job_id),
    region        TEXT NOT NULL,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    title         TEXT NOT NULL,
    channel_id    TEXT NOT NULL,
    channel_title TEXT NOT NULL,
    published_at  TIMESTAMPTZ NOT NULL,
    category_id   INTEGER NOT NULL,
    view_count    BIGINT NOT NULL DEFAULT 0,
    like_count    BIGINT NOT NULL DEFAULT 0,
    comment_count BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (video_id, region, job_id)
);