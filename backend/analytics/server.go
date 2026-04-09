package analytics

import (
	"context"
	"time"

	"github.com/jacobhuynh/youtube-etl-pipeline/db"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
	"google.golang.org/protobuf/types/known/timestamppb"
)

type AnalyticsServer struct {
	pb.UnimplementedAnalyticsServiceServer
	db *db.DB
}

func New(d *db.DB) *AnalyticsServer {
	return &AnalyticsServer{db: d}
}

func (s *AnalyticsServer) GetVideos(ctx context.Context, req *pb.GetVideosRequest) (*pb.GetVideosResponse, error) {
	var fetchedAfter, fetchedBefore time.Time
	if req.FetchedAfter != nil {
		fetchedAfter = req.FetchedAfter.AsTime()
	}
	if req.FetchedBefore != nil {
		fetchedBefore = req.FetchedBefore.AsTime()
	}

	videos, err := s.db.GetVideos(ctx, req.Region, req.CategoryId, fetchedAfter, fetchedBefore, req.Limit, req.Offset)
	if err != nil {
		return nil, err
	}

	var pbVideos []*pb.Video
	for _, v := range videos {
		pbVideos = append(pbVideos, &pb.Video{
			VideoId:      v.VideoId,
			JobId:        v.JobId,
			Region:       v.Region,
			FetchedAt:    timestamppb.New(v.FetchedAt),
			Title:        v.Title,
			ChannelId:    v.ChannelId,
			ChannelTitle: v.ChannelTitle,
			PublishedAt:  timestamppb.New(v.PublishedAt),
			CategoryId:   int32(v.CategoryId),
			ViewCount:    int64(v.ViewCount),
			LikeCount:    int64(v.LikeCount),
			CommentCount: int64(v.CommentCount),
		})
	}
	return &pb.GetVideosResponse{Videos: pbVideos}, nil
}

func (s *AnalyticsServer) GetTopChannels(ctx context.Context, req *pb.GetTopChannelsRequest) (*pb.GetTopChannelsResponse, error) {
	var sortBy string
	switch req.SortBy {
	case pb.SortBy_APPEAR_COUNT:
		sortBy = "appear_count"
	case pb.SortBy_VIEW_COUNT:
		sortBy = "total_views"
	default:
		sortBy = "appear_count"
	}

	channels, err := s.db.GetTopChannels(ctx, req.Region, req.Limit, sortBy)
	if err != nil {
		return nil, err
	}

	var pbChannels []*pb.Channel
	for _, c := range channels {
		pbChannels = append(pbChannels, &pb.Channel{
			ChannelId:    c.ChannelId,
			ChannelTitle: c.ChannelTitle,
			AppearCount:  int64(c.AppearCount),
			ViewCount:    int64(c.TotalViews),
		})
	}
	return &pb.GetTopChannelsResponse{Channels: pbChannels}, nil
}

func (s *AnalyticsServer) GetVideosCount(ctx context.Context, req *pb.GetVideosCountRequest) (*pb.GetVideosCountResponse, error) {
	count, err := s.db.GetVideoCount(ctx)
	if err != nil {
		return nil, err
	}
	return &pb.GetVideosCountResponse{Count: count}, nil
}

func (s *AnalyticsServer) GetTrackedRegions(ctx context.Context, req *pb.GetTrackedRegionsRequest) (*pb.GetTrackedRegionsResponse, error) {
	count, regions, err := s.db.GetTrackedRegions(ctx)
	if err != nil {
		return nil, err
	}
	return &pb.GetTrackedRegionsResponse{Count: count, Regions: regions}, nil
}

func (s *AnalyticsServer) GetVideoTrend(ctx context.Context, req *pb.GetVideoTrendRequest) (*pb.GetVideoTrendResponse, error) {
	points, err := s.db.GetVideoTrend(ctx, req.VideoId)
	if err != nil {
		return nil, err
	}

	var pbPoints []*pb.TrendPoint
	for _, p := range points {
		pbPoints = append(pbPoints, &pb.TrendPoint{
			FetchedAt:    timestamppb.New(p.FetchedAt),
			ViewCount:    int64(p.ViewCount),
			LikeCount:    int64(p.LikeCount),
			CommentCount: int64(p.CommentCount),
		})
	}
	return &pb.GetVideoTrendResponse{Points: pbPoints}, nil
}
