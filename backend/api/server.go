package api

import (
	"io"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jacobhuynh/youtube-etl-pipeline/db"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
)

type APIServer struct {
	client pb.ETLServiceClient
	db     *db.DB
}

func New(client pb.ETLServiceClient, db *db.DB) *APIServer {
	return &APIServer{client: client, db: db}
}

func (s *APIServer) RegisterRoutes(r *gin.Engine) {
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "http://localhost:3000" || origin == "https://yt-trending-pipeline.vercel.app" {
			c.Header("Access-Control-Allow-Origin", origin)
		}
		c.Header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})
	r.POST("/jobs", s.handleSubmitJob)
	r.POST("/jobs/batch", s.handleSubmitBatch)
	r.GET("/jobs/:id", s.handleGetJobStatus)
	r.GET("/jobs/:id/watch", s.handleWatchJob)
	r.GET("/videos/count", s.handleGetVideoCount)
	r.GET("/videos", s.handleGetVideos)
	r.GET("/analytics/regions", s.handleGetTrackedRegions)
	r.GET("/analytics/top-channels", s.handleGetTopChannels)
	r.GET("/analytics/videos/:id/trend", s.handleGetVideoTrend)
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

func (s *APIServer) handleGetVideos(c *gin.Context) {
	region := c.Query("region")
	categoryId, _ := strconv.Atoi(c.Query("category_id"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	videos, err := s.db.GetVideos(c.Request.Context(), region, int32(categoryId), time.Time{}, time.Time{}, int32(limit), int32(offset))
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get videos"})
		return
	}

	c.JSON(200, videos)
}

func (s *APIServer) handleGetTopChannels(c *gin.Context) {
	region := c.Query("region")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	channels, err := s.db.GetTopChannels(c.Request.Context(), region, int32(limit))
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get top channels"})
		return
	}

	c.JSON(200, channels)
}

func (s *APIServer) handleGetVideoCount(c *gin.Context) {
	count, err := s.db.GetVideoCount(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get video count"})
		return
	}
	c.JSON(200, gin.H{"count": count})
}

func (s *APIServer) handleGetTrackedRegions(c *gin.Context) {
	count, regions, err := s.db.GetTrackedRegions(c.Request.Context())
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get tracked regions"})
		return
	}
	c.JSON(200, gin.H{"count": count, "regions": regions})
}

func (s *APIServer) handleGetVideoTrend(c *gin.Context) {
	videoId := c.Param("id")

	trend, err := s.db.GetVideoTrend(c.Request.Context(), videoId)
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get video trend"})
		return
	}

	c.JSON(200, trend)
}
