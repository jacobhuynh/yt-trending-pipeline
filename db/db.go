package db

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type DB struct {
	pool *pgxpool.Pool
}

func New(ctx context.Context, connString string) (*DB, error) {
	pool, err := pgxpool.New(ctx, connString)
	if err != nil {
		return nil, err
	}

	return &DB{pool: pool}, nil
}

func (d *DB) InsertJob(ctx context.Context, req *pb.JobRequest) (string, error) {
	jobID := uuid.New().String()

	_, err := d.pool.Exec(ctx, "INSERT INTO jobs (job_id, idempotency_key, state, region, category_id, max_results, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		jobID, req.IdempotencyKey, "queued", req.Region, req.CategoryId, req.MaxResults, req.Metadata)

	if err != nil {
		return "", err
	}

	return jobID, nil
}

func (d *DB) GetJobByID(ctx context.Context, id string) (*pb.JobStatus, error) {
	status := &pb.JobStatus{}
	var idempotencyKey string
	var maxResults int32
	var nextRetryAt, startedAt, completedAt sql.NullTime
	var createdAt time.Time

	row := d.pool.QueryRow(ctx, "SELECT * FROM jobs WHERE job_id = $1", id)
	err := row.Scan(&status.JobId, &idempotencyKey, &status.State, &status.Region, &status.CategoryId, &maxResults, &status.Attempt, &status.MaxAttempts, &status.VideosFetched, &status.VideosInserted, &status.ErrorMessage, &nextRetryAt, &createdAt, &startedAt, &completedAt, &status.Metadata)
	if err != nil {
		return nil, err
	}

	if nextRetryAt.Valid {
		status.NextRetryAt = timestamppb.New(nextRetryAt.Time)
	}

	status.CreatedAt = timestamppb.New(createdAt)

	if startedAt.Valid {
		status.StartedAt = timestamppb.New(startedAt.Time)
	}

	if completedAt.Valid {
		status.CompletedAt = timestamppb.New(completedAt.Time)
	}

	return status, nil
}

func (d *DB) GetJobByIdempotencyKey(ctx context.Context, key string) (*pb.JobStatus, error) {
	status := &pb.JobStatus{}
	var idempotencyKey string
	var maxResults int32
	var nextRetryAt, startedAt, completedAt sql.NullTime
	var createdAt time.Time

	row := d.pool.QueryRow(ctx, "SELECT * FROM jobs WHERE idempotency_key = $1", key)
	err := row.Scan(&status.JobId, &idempotencyKey, &status.State, &status.Region, &status.CategoryId, &maxResults, &status.Attempt, &status.MaxAttempts, &status.VideosFetched, &status.VideosInserted, &status.ErrorMessage, &nextRetryAt, &createdAt, &startedAt, &completedAt, &status.Metadata)
	if err != nil {
		return nil, err
	}

	if nextRetryAt.Valid {
		status.NextRetryAt = timestamppb.New(nextRetryAt.Time)
	}

	status.CreatedAt = timestamppb.New(createdAt)

	if startedAt.Valid {
		status.StartedAt = timestamppb.New(startedAt.Time)
	}

	if completedAt.Valid {
		status.CompletedAt = timestamppb.New(completedAt.Time)
	}

	return status, nil
}

func (d *DB) UpdateJobStarted(ctx context.Context, jobId string, startedAt time.Time) error {
	_, err := d.pool.Exec(ctx, "UPDATE jobs SET state = $1, started_at = $2 WHERE job_id = $3", "running", startedAt, jobId)
	return err
}

func (d *DB) UpdateJobCompleted(ctx context.Context, jobId string, completedAt time.Time, videosFetched, videosInserted int32) error {
	_, err := d.pool.Exec(ctx, "UPDATE jobs SET state = $1, completed_at = $2, videos_fetched = $3, videos_inserted = $4, next_retry_at = NULL WHERE job_id = $5", "done", completedAt, videosFetched, videosInserted, jobId)
	return err
}

func (d *DB) UpdateJobFailed(ctx context.Context, jobId string, errorMessage string, attempt int32, nextRetryAt *time.Time) error {
	_, err := d.pool.Exec(ctx, "UPDATE jobs SET state = $1, error_message = $2, attempt = $3, next_retry_at = $4 WHERE job_id = $5", "failed", errorMessage, attempt, nextRetryAt, jobId)
	return err
}

func (d *DB) UpdateJobDead(ctx context.Context, jobId string, errorMessage string) error {
	_, err := d.pool.Exec(ctx, "UPDATE jobs SET state = $1, error_message = $2, next_retry_at = NULL WHERE job_id = $3", "dead", errorMessage, jobId)
	return err
}
