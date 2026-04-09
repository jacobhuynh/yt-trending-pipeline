# YouTube Trending Data ETL Pipeline

![Go](https://img.shields.io/badge/Go-1.26-00ADD8?logo=go&logoColor=white)
![gRPC](https://img.shields.io/badge/gRPC-Protocol_Buffers-244c5a?logo=grpc&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Supabase-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-Cache-DC382D?logo=redis&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Multi--stage-2496ED?logo=docker&logoColor=white)
![Railway](https://img.shields.io/badge/Railway-Backend-0B0D0E?logo=railway&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Frontend-000000?logo=vercel&logoColor=white)

A distributed data pipeline that ingests YouTube trending video data hourly across 8 global regions, stores snapshots in PostgreSQL, and surfaces cross-regional trend analytics through a Next.js dashboard. Three Go services communicate internally over gRPC; a REST gateway translates HTTP/JSON for browser clients.

**Live demo:** [yt-trending-pipeline.vercel.app](https://yt-trending-pipeline.vercel.app)

---

## Architecture

```
                         ┌─────────────────────────────────────┐
                         │         GitHub Actions Cron          │
                         │  (0 * * * *) — 8 regions per hour   │
                         └──────────────┬──────────────────────┘
                                        │ POST /jobs/batch
                                        ▼
                         ┌─────────────────────────────────────┐
                         │         REST Gateway :8080           │
                         │              (Gin)                   │
                         │   CORS · JSON ↔ gRPC translation    │
                         └────────┬───────────────┬────────────┘
                                  │               │
                    SubmitBatch   │               │  GetVideos / GetTopChannels
                    WatchJob      │               │  GetVideoTrend / GetRegions
                                  ▼               ▼
          ┌───────────────────────────┐   ┌──────────────────────────┐
          │     ETL Service :50051    │   │  Analytics Service :50052 │
          │         (gRPC)            │   │        (gRPC)             │
          │                           │   │                           │
          │  SubmitJob   (unary)      │   │  GetVideos      (unary)   │
          │  SubmitBatch (client-str) │   │  GetTopChannels (unary)   │
          │  GetJobStatus(unary)      │   │  GetVideoTrend  (unary)   │
          │  WatchJob    (server-str) │   │  GetTrackedRegions(unary) │
          └──────────┬────────────────┘   └──────────┬───────────────┘
                     │                               │
           enqueue   │                        query  │  cache
                     ▼                               ▼        ▼
          ┌──────────────────────┐       ┌──────────────┐  ┌──────────┐
          │    Worker Pool       │       │  PostgreSQL   │  │  Redis   │
          │  (5 goroutines)      │──────▶│  (Supabase)   │  │  1h TTL  │
          │  exp. backoff retry  │ write │               │  │          │
          │  dead letter queue   │       │  jobs table   │  └──────────┘
          └──────────┬───────────┘       │  videos table │
                     │                   └──────────────┘
          YouTube    │ fetch
          Data API   ▼
          v3      ┌──────────────────────┐
                  │  youtube.Client      │
                  │  FetchTrending()     │
                  └──────────────────────┘
```

**Data flow:** GitHub Actions POSTs a batch of 8 regional jobs every hour → REST gateway streams them to the ETL service → workers fetch from YouTube Data API v3 and insert snapshots into PostgreSQL → Analytics service queries PostgreSQL and caches results in Redis for one hour.

---

## Project Structure

```
.
├── backend/
│   ├── analytics/          # Analytics gRPC service implementation
│   ├── api/                # REST gateway (Gin) — zero DB access, pure gRPC adapter
│   ├── cmd/server/         # Entry point — wires all three services and worker pool
│   ├── db/                 # PostgreSQL layer (pgx/v5 with connection pooling)
│   ├── etl/                # ETL gRPC service — job submission and state management
│   ├── proto/              # Protocol Buffer definitions (source of truth)
│   ├── pb/                 # Generated Go code from protoc
│   ├── worker/             # Worker pool — YouTube fetch, retry logic, DB writes
│   ├── youtube/            # YouTube Data API v3 client
│   └── Dockerfile          # Multi-stage build (golang:1.26-alpine → alpine)
├── frontend/               # Next.js 15 dashboard (Vercel)
└── .github/workflows/
    ├── ci.yml              # CI
    └── cron.yml            # Hourly ingestion trigger (0 * * * *)
```

---

## Tech Stack

| Component | Choice | Reason |
|---|---|---|
| Language | Go 1.26 | Goroutine-based concurrency maps naturally to a worker pool; low memory footprint per goroutine |
| Service communication | gRPC + Protocol Buffers | Typed contracts across service boundaries; all four RPC patterns available (unary, client-streaming, server-streaming all in use) |
| Database | PostgreSQL (Supabase) | Relational structure for jobs/videos; `DISTINCT ON` for per-video deduplication without a separate dedup pass |
| Cache | Redis | 1h TTL aligned with ingestion frequency; analytics queries are expensive aggregations that don't need sub-minute freshness |
| HTTP layer | Gin | Minimal overhead; SSE streaming support for job watch endpoint |
| Frontend | Next.js 15 | Server components for initial analytics load; client components for live SSE job monitoring |
| Container | Docker multi-stage | Builder stage compiles Go binary; final Alpine image is ~15MB |
| CI/CD | GitHub Actions | Cron scheduler (`0 * * * *`) submits batch jobs via REST; no custom scheduler infrastructure needed |
| Hosting | Railway (backend) / Vercel (frontend) | Railway handles TCP ports for gRPC listeners; Vercel handles Next.js edge deployment |

---

## Key Technical Decisions

### Worker pool with exponential backoff
Workers read from a buffered Go channel (`cap=100`). Each job gets up to 3 attempts. Backoff between retries is `2^attempt` seconds. After max attempts, the job is promoted to the dead letter state (`dead`) and removed from the retry schedule. The job lifecycle is fully reflected in the `jobs` table: `queued → running → retrying → done | dead`.

### Idempotency keys
The cron workflow hashes `region + github.run_id` into an idempotency key per job. The ETL service checks for an existing key before inserting, returning the existing job ID if found. This makes cron re-runs (e.g. after a flake) safe without any external locking.

### Connection pooling — `QueryExecModeSimpleProtocol`
Supabase's transaction pooler (PgBouncer in transaction mode) does not support the extended query protocol because prepared statements don't persist across pooled connections. Setting `pgx` to `QueryExecModeSimpleProtocol` sends all queries as simple text, avoiding `ERROR: prepared statement does not exist` at scale.

### Separate gRPC services with a pure REST adapter
The REST gateway (`api/`) holds zero database connections and contains zero business logic. It only translates HTTP/JSON to typed gRPC calls. This means all validation, caching, and data access logic lives in one place (the gRPC services), and adding another consumer (CLI, mobile, another service) requires no changes to those services.

### Redis cache invalidation strategy
Analytics queries (top channels, video lists) are cached with a 1h TTL that matches the ingestion cron interval. Stale data is acceptable because the underlying data only changes when a new ingest completes. This avoids write-through complexity: when the TTL expires, the next read repopulates the cache from the freshest data.

---

## Local Setup

### Prerequisites
- Go 1.22+
- Docker (optional, for containerized run)
- A PostgreSQL database (Supabase free tier works)
- A Redis instance (Redis Cloud free tier works)
- A [YouTube Data API v3 key](https://console.cloud.google.com/)

### Environment variables

```bash
export DATABASE_URL="postgres://user:password@host:port/dbname"
export YOUTUBE_API_KEY="AIza..."
export REDIS_URL="redis://default:password@host:port"
```

### Database schema

Run the following migrations against your PostgreSQL database before starting:

```sql
CREATE TABLE IF NOT EXISTS jobs (
    job_id          TEXT PRIMARY KEY,
    idempotency_key TEXT UNIQUE NOT NULL,
    state           TEXT NOT NULL DEFAULT 'queued',
    region          TEXT NOT NULL,
    category_id     INT NOT NULL DEFAULT 0,
    max_results     INT NOT NULL DEFAULT 50,
    attempt         INT NOT NULL DEFAULT 0,
    max_attempts    INT NOT NULL DEFAULT 3,
    videos_fetched  INT NOT NULL DEFAULT 0,
    videos_inserted INT NOT NULL DEFAULT 0,
    error_message   TEXT,
    next_retry_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    metadata        JSONB NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS videos (
    video_id      TEXT NOT NULL,
    job_id        TEXT NOT NULL REFERENCES jobs(job_id),
    region        TEXT NOT NULL,
    fetched_at    TIMESTAMPTZ NOT NULL,
    title         TEXT NOT NULL,
    channel_id    TEXT NOT NULL,
    channel_title TEXT NOT NULL,
    published_at  TIMESTAMPTZ NOT NULL,
    category_id   INT NOT NULL DEFAULT 0,
    view_count    BIGINT NOT NULL DEFAULT 0,
    like_count    BIGINT NOT NULL DEFAULT 0,
    comment_count BIGINT NOT NULL DEFAULT 0
);
```

### Run locally

```bash
cd backend
go run ./cmd/server/main.go
```

The process starts all three services in-process:
- ETL gRPC service on `:50051`
- Analytics gRPC service on `:50052`
- REST gateway on `:8080`

### Run with Docker

```bash
cd backend
docker build -t yt-etl-pipeline .
docker run \
  -e DATABASE_URL="$DATABASE_URL" \
  -e YOUTUBE_API_KEY="$YOUTUBE_API_KEY" \
  -e REDIS_URL="$REDIS_URL" \
  -p 8080:8080 \
  -p 50051:50051 \
  yt-etl-pipeline
```

### Frontend

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

---

## REST API Reference

All endpoints are served by the Gin gateway on `:8080`. Request and response bodies are JSON.

### Jobs

| Method | Path | Description |
|---|---|---|
| `POST` | `/jobs` | Submit a single ingest job. Body: `JobRequest`. |
| `POST` | `/jobs/batch` | Submit an array of ingest jobs via client-streaming gRPC. Body: `JobRequest[]`. Returns aggregated accepted/rejected counts. |
| `GET` | `/jobs/:id` | Get the current status of a job by ID. |
| `GET` | `/jobs/:id/watch` | Stream job state-change events as SSE until the job reaches a terminal state. |

**`JobRequest` body:**
```json
{
  "region": "US",
  "category_id": 0,
  "max_results": 50,
  "idempotency_key": "unique-key",
  "metadata": {}
}
```

### Videos

| Method | Path | Query params | Description |
|---|---|---|---|
| `GET` | `/videos` | `region`, `category_id`, `limit` (default 50), `offset` (default 0) | List videos ordered by view count descending. Returns the latest snapshot per video ID. |
| `GET` | `/videos/count` | — | Total number of video rows in the database. |

### Analytics

| Method | Path | Query params | Description |
|---|---|---|---|
| `GET` | `/analytics/top-channels` | `region`, `limit` (default 10), `sort_by` (`appear_count` \| `total_views`) | Top channels by trending frequency or cumulative views. Cached 1h. |
| `GET` | `/analytics/regions` | — | Count and list of distinct regions with collected data. |
| `GET` | `/analytics/videos/:id/trend` | — | Time-series view, like, and comment counts for a specific video across all fetches. |

---

## gRPC Services

### ETLService (`:50051`)

Defined in [`backend/proto/etl.proto`](backend/proto/etl.proto).

| RPC | Pattern | Description |
|---|---|---|
| `SubmitJob` | Unary | Submit a single job; deduplicates on idempotency key. |
| `SubmitBatch` | Client-streaming | Stream multiple job requests; returns aggregated batch result. |
| `GetJobStatus` | Unary | Fetch current job state by ID. |
| `WatchJob` | Server-streaming | Push `JobUpdate` messages on every state transition until terminal state. |

### AnalyticsService (`:50052`)

Defined in [`backend/proto/analytics.proto`](backend/proto/analytics.proto).

| RPC | Pattern | Description |
|---|---|---|
| `GetVideos` | Unary | Paginated video list with region/category/time filters. |
| `GetTopChannels` | Unary | Top channels by appear count or total views. |
| `GetVideosCount` | Unary | Total video row count. |
| `GetTrackedRegions` | Unary | Distinct regions present in the dataset. |
| `GetVideoTrend` | Unary | Time-series engagement data for a specific video. |
