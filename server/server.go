package server

import (
	"context"

	"github.com/jacobhuynh/youtube-etl-pipeline/db"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
)

type ETLServer struct {
	pb.UnimplementedETLServiceServer
	db       *db.DB
	jobQueue chan *pb.JobRequest
}

func NewETLServer(d *db.DB) *ETLServer {
	return &ETLServer{
		db:       d,
		jobQueue: make(chan *pb.JobRequest, 100),
	}
}

func (s *ETLServer) SubmitJob(ctx context.Context, req *pb.JobRequest) (*pb.JobResponse, error) {
	
}
