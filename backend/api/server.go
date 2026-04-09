package api

import (
	"io"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
)

type APIServer struct {
	ETLClient       pb.ETLServiceClient
	AnalyticsClient pb.AnalyticsServiceClient
}

func New(ETLClient pb.ETLServiceClient, AnalyticsClient pb.AnalyticsServiceClient) *APIServer {
	return &APIServer{ETLClient: ETLClient, AnalyticsClient: AnalyticsClient}
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

	resp, err := s.ETLClient.SubmitJob(c.Request.Context(), &req)
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

	stream, err := s.ETLClient.SubmitBatch(c.Request.Context())
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
	resp, err := s.ETLClient.GetJobStatus(c.Request.Context(), &pb.GetJobStatusRequest{JobId: jobID})
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get job status"})
		return
	}

	c.JSON(200, resp)
}

func (s *APIServer) handleWatchJob(c *gin.Context) {
	jobID := c.Param("id")

	stream, err := s.ETLClient.WatchJob(c.Request.Context(), &pb.WatchJobRequest{JobId: jobID})
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
	categoryId, _ := strconv.Atoi(c.DefaultQuery("category_id", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	videos, err := s.AnalyticsClient.GetVideos(c.Request.Context(), &pb.GetVideosRequest{
		Region:     region,
		CategoryId: int32(categoryId),
		Limit:      int32(limit),
		Offset:     int32(offset),
	})
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get videos"})
		return
	}
	c.JSON(200, videos)
}

func (s *APIServer) handleGetTopChannels(c *gin.Context) {
	region := c.Query("region")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))
	sortBy := c.DefaultQuery("sort_by", "appear_count")
	var sortByEnum pb.SortBy
	switch sortBy {
	case "appear_count":
		sortByEnum = pb.SortBy_APPEAR_COUNT
	case "total_views":
		sortByEnum = pb.SortBy_VIEW_COUNT
	default:
		sortByEnum = pb.SortBy_APPEAR_COUNT
	}

	channels, err := s.AnalyticsClient.GetTopChannels(c.Request.Context(), &pb.GetTopChannelsRequest{
		Region: region,
		Limit:  int32(limit),
		SortBy: sortByEnum,
	})
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get top channels"})
		return
	}
	c.JSON(200, channels)
}

func (s *APIServer) handleGetVideoCount(c *gin.Context) {
	resp, err := s.AnalyticsClient.GetVideosCount(c.Request.Context(), &pb.GetVideosCountRequest{})
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get video count"})
		return
	}
	c.JSON(200, resp)
}

func (s *APIServer) handleGetTrackedRegions(c *gin.Context) {
	resp, err := s.AnalyticsClient.GetTrackedRegions(c.Request.Context(), &pb.GetTrackedRegionsRequest{})
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get tracked regions"})
		return
	}
	c.JSON(200, resp)
}

func (s *APIServer) handleGetVideoTrend(c *gin.Context) {
	videoId := c.Param("id")

	trend, err := s.AnalyticsClient.GetVideoTrend(c.Request.Context(), &pb.GetVideoTrendRequest{VideoId: videoId})
	if err != nil {
		c.JSON(500, gin.H{"error": "failed to get video trend"})
		return
	}

	c.JSON(200, trend)
}
