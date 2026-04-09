package worker

import (
	"context"
	"math"
	"time"

	"github.com/jacobhuynh/youtube-etl-pipeline/db"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
	client "github.com/jacobhuynh/youtube-etl-pipeline/youtube"
)

// Worker consumes jobs from a channel, fetches trending videos via the YouTube client, and persists them to the database.
type Worker struct {
	jobQueue chan *Job
	db       *db.DB
	client   *client.Client
}

// Job holds the database job ID and the original request parameters for a single ETL run.
type Job struct {
	ID  string
	Req *pb.JobRequest
}

// New creates a new Worker that reads from jobQueue and uses the given database and YouTube client.
func New(jobQueue chan *Job, db *db.DB, client *client.Client) *Worker {
	return &Worker{
		jobQueue: jobQueue,
		db:       db,
		client:   client,
	}
}

// Start launches a goroutine that processes jobs from the queue until ctx is cancelled.
func (w *Worker) Start(ctx context.Context) {
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case req := <-w.jobQueue:
				w.processJob(ctx, req)
			}
		}
	}()
}

// processJob executes a single ETL job with up to three attempts, using exponential backoff between retries.
// It marks the job dead if all attempts fail or if a database update itself errors.
func (w *Worker) processJob(ctx context.Context, req *Job) {
	const maxAttempts = 3
	var videosFetched, videosInserted int32

	err := w.db.UpdateJobStarted(ctx, req.ID, time.Now())
	if err != nil {
		w.db.UpdateJobDead(ctx, req.ID, "Failed to update job as started.")
		return
	}

	for attempt := 1; attempt < maxAttempts+1; attempt++ {
		videos, err := w.client.FetchTrending(req.Req, req.ID)

		if err != nil {
			backoff := time.Duration(math.Pow(2, float64(attempt))) * time.Second
			nextRetryAt := time.Now().Add(backoff)

			err := w.db.UpdateJobRetrying(ctx, req.ID, "Error fetching data from YouTube API.", int32(attempt), &nextRetryAt)
			if err != nil {
				w.db.UpdateJobDead(ctx, req.ID, "Failed to update job as failed.")
				return
			}
			time.Sleep(backoff)
		} else {
			videosFetched = int32(len(videos))

			for _, video := range videos {
				err := w.db.InsertVideo(ctx, &video)
				if err != nil {
					w.db.UpdateJobDead(ctx, req.ID, "Failed to insert video data into database.")
					return
				}
				videosInserted++
			}
			w.db.UpdateJobCompleted(ctx, req.ID, time.Now(), videosFetched, videosInserted)
			return
		}
	}

	w.db.UpdateJobDead(ctx, req.ID, "Max retry attempts reached.")
}
