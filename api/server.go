package api

import (
	"io"

	"github.com/gin-gonic/gin"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
)

type APIServer struct {
	client pb.ETLServiceClient
}

func New(client pb.ETLServiceClient) *APIServer {
	return &APIServer{client: client}
}

func (s *APIServer) RegisterRoutes(r *gin.Engine) {
	r.POST("/jobs", s.handleSubmitJob)
	r.POST("/jobs/batch", s.handleSubmitBatch)
	r.GET("/jobs/:id", s.handleGetJobStatus)
	r.GET("/jobs/:id/watch", s.handleWatchJob)
}

func (s *APIServer) handleSubmitJob(c *gin.Context) {
	var req pb.JobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}

	resp, err := s.client.SubmitJob(c.Request.Context(), &req)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to submit job"})
		return
	}

	c.JSON(200, gin.H{"job_id": resp.JobId})
}

func (s *APIServer) handleSubmitBatch(c *gin.Context) {
	var reqs []*pb.JobRequest
	if err := c.ShouldBindJSON(&reqs); err != nil {
		c.JSON(400, gin.H{"error": "invalid request"})
		return
	}

	stream, err := s.client.SubmitBatch(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to submit batch job"})
		return
	}

	for _, req := range reqs {
		if err := stream.Send(req); err != nil {
			c.JSON(500, gin.H{"error": "failed to send job to stream"})
			return
		}
	}

	resp, err := stream.CloseAndRecv()
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to receive batch response"})
		return
	}

	c.JSON(200, resp)
}

func (s *APIServer) handleGetJobStatus(c *gin.Context) {
	jobID := c.Param("id")
	resp, err := s.client.GetJobStatus(c.Request.Context(), &pb.GetJobStatusRequest{JobId: jobID})
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get job status"})
		return
	}

	c.JSON(200, resp)
}

func (s *APIServer) handleWatchJob(c *gin.Context) {
	jobID := c.Param("id")

	stream, err := s.client.WatchJob(c.Request.Context(), &pb.WatchJobRequest{JobId: jobID})
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to watch job"})
		return
	}

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")

	c.Stream(func(w io.Writer) bool {
		update, err := stream.Recv()
		if err != nil {
			return false
		}
		c.SSEvent("update", update)
		return true
	})
}
