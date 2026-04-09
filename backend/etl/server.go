package etl

import (
	"context"
	"io"
	"time"

	"github.com/jackc/pgx/v5"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/jacobhuynh/youtube-etl-pipeline/db"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
	"github.com/jacobhuynh/youtube-etl-pipeline/worker"
)

// ETLServer implements the ETLService gRPC server, handling job submission and status tracking.
type ETLServer struct {
	pb.UnimplementedETLServiceServer
	db       *db.DB
	jobQueue chan *worker.Job
}

// New creates a new ETLServer with the given database and a buffered job queue of capacity 100.
func New(d *db.DB) *ETLServer {
	return &ETLServer{
		db:       d,
		jobQueue: make(chan *worker.Job, 100),
	}
}

// SubmitJob validates the request for duplicate idempotency keys, inserts a new job, and enqueues it for processing.
// It returns the job ID and current state, or reports that the job already exists if the idempotency key is reused.
func (s *ETLServer) SubmitJob(ctx context.Context, req *pb.JobRequest) (*pb.JobResponse, error) {
	jobId, jobCreated, err := s.processJob(ctx, req)
	if err != nil {
		return nil, err
	}

	if !jobCreated {
		return &pb.JobResponse{JobId: jobId, State: pb.JobState_JOB_STATE_QUEUED, Message: "Job already exists with the same idempotency key.", CreatedAt: timestamppb.New(time.Now())}, nil
	}

	s.jobQueue <- &worker.Job{ID: jobId, Req: req}

	return &pb.JobResponse{JobId: jobId, State: pb.JobState_JOB_STATE_QUEUED, Message: "Job queued successfully.", CreatedAt: timestamppb.New(time.Now())}, nil
}

// SubmitBatch receives a client-streaming batch of job requests, deduplicates by idempotency key,
// enqueues accepted jobs, and returns a summary of total received, accepted, and rejected counts.
func (s *ETLServer) SubmitBatch(stream pb.ETLService_SubmitBatchServer) error {
	var totalReceived, totalAccepted, totalRejected int32
	var results []*pb.BatchJobResult

	for {
		req, err := stream.Recv()
		if err == io.EOF {
			return stream.SendAndClose(&pb.BatchResponse{TotalReceived: totalReceived, TotalAccepted: totalAccepted, TotalRejected: totalRejected, Results: results})
		}
		if err != nil {
			return err
		}

		totalReceived++

		jobId, jobCreated, err := s.processJob(stream.Context(), req)
		if err != nil {
			totalRejected++
		} else if !jobCreated {
			totalRejected++
			results = append(results, &pb.BatchJobResult{
				JobId:          jobId,
				State:          pb.JobState_JOB_STATE_QUEUED,
				IdempotencyKey: req.IdempotencyKey,
				Message:        "Job already exists with the same idempotency key.",
			})
		} else {
			totalAccepted++
			s.jobQueue <- &worker.Job{ID: jobId, Req: req}
			results = append(results, &pb.BatchJobResult{
				JobId:          jobId,
				State:          pb.JobState_JOB_STATE_QUEUED,
				IdempotencyKey: req.IdempotencyKey,
				Message:        "Job processed successfully.",
			})
		}
	}
}

// GetJobStatus returns the current status of a job identified by its job ID.
func (s *ETLServer) GetJobStatus(ctx context.Context, req *pb.GetJobStatusRequest) (*pb.JobStatus, error) {
	status, err := s.db.GetJobByID(ctx, req.JobId)
	if err != nil {
		return nil, err
	}

	return status, nil
}

// WatchJob streams state-change updates for a job until it reaches a terminal state (done, failed, or dead).
// It polls the database every two seconds and sends a JobUpdate message whenever the state changes.
func (s *ETLServer) WatchJob(req *pb.WatchJobRequest, stream pb.ETLService_WatchJobServer) error {
	var lastState pb.JobState
	for {
		select {
		case <-stream.Context().Done():
			return stream.Context().Err()
		default:
		}

		status, err := s.db.GetJobByID(stream.Context(), req.JobId)
		if err != nil {
			return err
		}

		if status.State != lastState {
			if err := stream.Send(&pb.JobUpdate{JobId: status.JobId, State: status.State, VideosFetched: status.VideosFetched, VideosInserted: status.VideosInserted, Message: "State updated.", OccurredAt: timestamppb.Now()}); err != nil {
				return err
			}
			lastState = status.State
		}

		if status.State == pb.JobState_JOB_STATE_DONE || status.State == pb.JobState_JOB_STATE_FAILED || status.State == pb.JobState_JOB_STATE_DEAD {
			return nil
		}

		time.Sleep(2 * time.Second)
	}
}

// JobQueue returns the server's internal job channel so workers can consume queued jobs.
func (s *ETLServer) JobQueue() chan *worker.Job {
	return s.jobQueue
}

// Helpers
func (s *ETLServer) processJob(ctx context.Context, req *pb.JobRequest) (string, bool, error) {
	status, err := s.db.GetJobByIdempotencyKey(ctx, req.IdempotencyKey)
	if err != nil && err != pgx.ErrNoRows {
		return "", false, err
	}

	if err == nil {
		return status.JobId, false, nil
	}

	JobId, err := s.db.InsertJob(ctx, req)
	if err != nil {
		return "", false, err
	}
	return JobId, true, nil
}
