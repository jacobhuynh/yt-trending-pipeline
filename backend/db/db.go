package db

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
	client "github.com/jacobhuynh/youtube-etl-pipeline/youtube"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type DB struct {
	pool *pgxpool.Pool
}

type ChannelStat struct {
	ChannelId    string
	ChannelTitle string
	AppearCount  int
	TotalViews   int64
}

type VideoTrendPoint struct {
	FetchedAt    time.Time
	ViewCount    int64
	LikeCount    int64
	CommentCount int64
}

func New(ctx context.Context, connString string) (*DB, error) {
	config, err := pgxpool.ParseConfig(connString)
	if err != nil {
		return nil, err
	}

	config.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeSimpleProtocol
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		return nil, err
	}

	return &DB{pool: pool}, nil
}

func (d *DB) InsertJob(ctx context.Context, req *pb.JobRequest) (string, error) {
	jobID := uuid.New().String()

	if req.Metadata == nil {
		req.Metadata = map[string]string{}
	}

	metadataJSON, err := json.Marshal(req.Metadata)
	if err != nil {
		return "", err
	}

	_, err = d.pool.Exec(ctx, "INSERT INTO jobs (job_id, idempotency_key, state, region, category_id, max_results, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)",
		jobID, req.IdempotencyKey, "queued", req.Region, req.CategoryId, req.MaxResults, string(metadataJSON))

	if err != nil {
		return "", err
	}

	return jobID, nil
}

func (d *DB) GetJobByID(ctx context.Context, id string) (*pb.JobStatus, error) {
	row := d.pool.QueryRow(ctx, "SELECT * FROM jobs WHERE job_id = $1", id)
	return scanJobStatus(row)
}

func (d *DB) GetJobByIdempotencyKey(ctx context.Context, key string) (*pb.JobStatus, error) {
	row := d.pool.QueryRow(ctx, "SELECT * FROM jobs WHERE idempotency_key = $1", key)
	return scanJobStatus(row)
}

func (d *DB) UpdateJobStarted(ctx context.Context, jobId string, startedAt time.Time) error {
	_, err := d.pool.Exec(ctx, "UPDATE jobs SET state = $1, started_at = $2 WHERE job_id = $3", "running", startedAt, jobId)
	return err
}

func (d *DB) UpdateJobCompleted(ctx context.Context, jobId string, completedAt time.Time, videosFetched, videosInserted int32) error {
	_, err := d.pool.Exec(ctx, "UPDATE jobs SET state = $1, completed_at = $2, videos_fetched = $3, videos_inserted = $4, next_retry_at = NULL WHERE job_id = $5", "done", completedAt, videosFetched, videosInserted, jobId)
	return err
}

func (d *DB) UpdateJobRetrying(ctx context.Context, jobId string, errorMessage string, attempt int32, nextRetryAt *time.Time) error {
	_, err := d.pool.Exec(ctx, "UPDATE jobs SET state = $1, error_message = $2, attempt = $3, next_retry_at = $4 WHERE job_id = $5", "retrying", errorMessage, attempt, nextRetryAt, jobId)
	return err
}

func (d *DB) UpdateJobDead(ctx context.Context, jobId string, errorMessage string) error {
	_, err := d.pool.Exec(ctx, "UPDATE jobs SET state = $1, error_message = $2, next_retry_at = NULL WHERE job_id = $3", "dead", errorMessage, jobId)
	return err
}

func (d *DB) InsertVideo(ctx context.Context, video *client.Video) error {
	_, err := d.pool.Exec(ctx, "INSERT INTO videos (video_id, job_id, region, fetched_at, title, channel_id, channel_title, published_at, category_id, view_count, like_count, comment_count) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)",
		video.VideoId, video.JobId, video.Region, video.FetchedAt, video.Title, video.ChannelId, video.ChannelTitle, video.PublishedAt, video.CategoryId, video.ViewCount, video.LikeCount, video.CommentCount)
	return err
}

func (d *DB) GetVideos(ctx context.Context, region string, categoryId int32, fetchedAfter time.Time, fetchedBefore time.Time, limit int32, offset int32) ([]*client.Video, error) {
	inner := "SELECT DISTINCT ON (video_id) video_id, job_id, region, fetched_at, title, channel_id, channel_title, published_at, category_id, view_count, like_count, comment_count FROM videos WHERE 1=1"
	args := []any{}
	argNum := 1

	if region != "" {
		inner += fmt.Sprintf(" AND region = $%d", argNum)
		args = append(args, region)
		argNum++
	}

	if categoryId != 0 {
		inner += fmt.Sprintf(" AND category_id = $%d", argNum)
		args = append(args, categoryId)
		argNum++
	}

	if !fetchedAfter.IsZero() {
		inner += fmt.Sprintf(" AND fetched_at > $%d", argNum)
		args = append(args, fetchedAfter)
		argNum++
	}

	if !fetchedBefore.IsZero() {
		inner += fmt.Sprintf(" AND fetched_at < $%d", argNum)
		args = append(args, fetchedBefore)
		argNum++
	}

	inner += " ORDER BY video_id, fetched_at DESC"
	query := fmt.Sprintf("SELECT * FROM (%s) sub ORDER BY view_count DESC LIMIT $%d OFFSET $%d", inner, argNum, argNum+1)
	args = append(args, limit, offset)

	rows, err := d.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var videos []*client.Video
	for rows.Next() {
		video := &client.Video{}
		err := rows.Scan(&video.VideoId, &video.JobId, &video.Region, &video.FetchedAt, &video.Title, &video.ChannelId, &video.ChannelTitle, &video.PublishedAt, &video.CategoryId, &video.ViewCount, &video.LikeCount, &video.CommentCount)
		if err != nil {
			return nil, err
		}
		videos = append(videos, video)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return videos, nil
}

func (d *DB) GetTopChannels(ctx context.Context, region string, limit int32) ([]*ChannelStat, error) {
	query := `
		SELECT channel_id, channel_title, COUNT(*) as appear_count, SUM(view_count) as total_views
		FROM videos
		WHERE 1=1`
	args := []any{}
	argNum := 1

	if region != "" {
		query += fmt.Sprintf(" AND region = $%d", argNum)
		args = append(args, region)
		argNum++
	}

	query += fmt.Sprintf(" GROUP BY channel_id, channel_title ORDER BY appear_count DESC LIMIT $%d", argNum)
	args = append(args, limit)

	rows, err := d.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stats []*ChannelStat
	for rows.Next() {
		stat := &ChannelStat{}
		err := rows.Scan(&stat.ChannelId, &stat.ChannelTitle, &stat.AppearCount, &stat.TotalViews)
		if err != nil {
			return nil, err
		}
		stats = append(stats, stat)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return stats, nil
}

func (d *DB) GetVideoCount(ctx context.Context) (int64, error) {
	var count int64
	err := d.pool.QueryRow(ctx, "SELECT COUNT(*) FROM videos").Scan(&count)
	return count, err
}

func (d *DB) GetTrackedRegions(ctx context.Context) (int64, []string, error) {
	var count int64
	var regions []string
	err := d.pool.QueryRow(ctx, "SELECT COUNT(DISTINCT region), array_agg(DISTINCT region) FROM videos").Scan(&count, &regions)
	return count, regions, err
}

func (d *DB) GetVideoTrend(ctx context.Context, videoId string) ([]*VideoTrendPoint, error) {
	rows, err := d.pool.Query(ctx,
		"SELECT fetched_at, view_count, like_count, comment_count FROM videos WHERE video_id = $1 ORDER BY fetched_at ASC",
		videoId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var points []*VideoTrendPoint
	for rows.Next() {
		point := &VideoTrendPoint{}
		err := rows.Scan(&point.FetchedAt, &point.ViewCount, &point.LikeCount, &point.CommentCount)
		if err != nil {
			return nil, err
		}
		points = append(points, point)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return points, nil
}

// Helpers
func scanJobStatus(row pgx.Row) (*pb.JobStatus, error) {
	status := &pb.JobStatus{}
	var idempotencyKey string
	var state string
	var errorMessage sql.NullString
	var maxResults int32
	var nextRetryAt, startedAt, completedAt sql.NullTime
	var createdAt time.Time

	err := row.Scan(&status.JobId, &idempotencyKey, &state, &status.Region, &status.CategoryId, &maxResults, &status.Attempt, &status.MaxAttempts, &status.VideosFetched, &status.VideosInserted, &errorMessage, &nextRetryAt, &createdAt, &startedAt, &completedAt, &status.Metadata)
	if err != nil {
		return nil, err
	}

	status.State = stringToJobState(state)

	if errorMessage.Valid {
		status.ErrorMessage = errorMessage.String
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

func stringToJobState(s string) pb.JobState {
	switch s {
	case "queued":
		return pb.JobState_JOB_STATE_QUEUED
	case "running":
		return pb.JobState_JOB_STATE_RUNNING
	case "retrying":
		return pb.JobState_JOB_STATE_RETRYING
	case "done":
		return pb.JobState_JOB_STATE_DONE
	case "dead":
		return pb.JobState_JOB_STATE_DEAD
	default:
		return pb.JobState_JOB_STATE_UNSPECIFIED
	}
}
