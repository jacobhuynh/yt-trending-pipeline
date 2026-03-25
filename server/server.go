package server

import (
	"context"
	"time"

	"github.com/jackc/pgx/v5"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/jacobhuynh/youtube-etl-pipeline/db"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
)

type ETLServer struct {
	pb.UnimplementedETLServiceServer
	db       *db.DB
	jobQueue chan *pb.JobRequest
}

func New(d *db.DB) *ETLServer {
	return &ETLServer{
		db:       d,
		jobQueue: make(chan *pb.JobRequest, 100),
	}
}

func (s *ETLServer) SubmitJob(ctx context.Context, req *pb.JobRequest) (*pb.JobResponse, error) {
	status, err := s.db.GetJobByIdempotencyKey(ctx, req.IdempotencyKey)
	if err != nil && err != pgx.ErrNoRows {
		return nil, err
	}

	if err == nil {
		return &pb.JobResponse{JobId: status.JobId, State: pb.JobState_JOB_STATE_QUEUED, Message: "Job already exists with the same idempotency key.", CreatedAt: status.CreatedAt}, nil
	}

	jobId, err := s.db.InsertJob(ctx, req)
	if err != nil {
		return nil, err
	}

	s.jobQueue <- req

	return &pb.JobResponse{JobId: jobId, State: pb.JobState_JOB_STATE_QUEUED, Message: "Job queued successfully.", CreatedAt: timestamppb.New(time.Now())}, nil
}
