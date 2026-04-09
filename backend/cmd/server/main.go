package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"

	"github.com/gin-gonic/gin"
	"github.com/jacobhuynh/youtube-etl-pipeline/analytics"
	"github.com/jacobhuynh/youtube-etl-pipeline/api"
	"github.com/jacobhuynh/youtube-etl-pipeline/db"
	"github.com/jacobhuynh/youtube-etl-pipeline/etl"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
	"github.com/jacobhuynh/youtube-etl-pipeline/worker"
	client "github.com/jacobhuynh/youtube-etl-pipeline/youtube"
	"github.com/redis/go-redis/v9"
)

func main() {
	numWorkers := 5
	databaseURL := os.Getenv("DATABASE_URL")
	youtubeClient := &client.Client{APIKey: os.Getenv("YOUTUBE_API_KEY")}

	// DB Connection

	ctx := context.Background()
	db, err := db.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	// Redis Connection

	redisURL := os.Getenv("REDIS_URL")
	opts, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("failed to parse redis url: %v", err)
	}
	redisClient := redis.NewClient(opts)

	// ETL gRPC Server

	etl_server := etl.New(db)
	etl_lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	etlGrpcServer := grpc.NewServer()
	pb.RegisterETLServiceServer(etlGrpcServer, etl_server)

	for i := 0; i < numWorkers; i++ {
		w := worker.New(etl_server.JobQueue(), db, youtubeClient)
		w.Start(ctx)
	}

	go func() {
		log.Printf("gRPC server listening on :50051")
		if err := etlGrpcServer.Serve(etl_lis); err != nil {
			log.Fatalf("failed to serve: %v", err)
		}
	}()

	etl_conn, err := grpc.NewClient("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to gRPC server: %v", err)
	}
	defer etl_conn.Close()
	grpcClient := pb.NewETLServiceClient(etl_conn)

	// Analytics gRPC Server

	analytics_server := analytics.New(db, redisClient)
	analytics_lis, err := net.Listen("tcp", ":50052")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	analyticsGrpcServer := grpc.NewServer()
	pb.RegisterAnalyticsServiceServer(analyticsGrpcServer, analytics_server)

	go func() {
		log.Printf("gRPC server listening on :50052")
		if err := analyticsGrpcServer.Serve(analytics_lis); err != nil {
			log.Fatalf("failed to serve: %v", err)
		}
	}()

	analytics_conn, err := grpc.NewClient("localhost:50052", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to gRPC server: %v", err)
	}
	defer analytics_conn.Close()
	analyticsClient := pb.NewAnalyticsServiceClient(analytics_conn)

	// API Server

	apiServer := api.New(grpcClient, analyticsClient)

	r := gin.Default()
	apiServer.RegisterRoutes(r)

	go func() {
		log.Printf("REST API listening on :8080")
		if err := r.Run(":8080"); err != nil {
			log.Fatalf("failed to run API server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	log.Println("shutting down...")
	etlGrpcServer.GracefulStop()
	analyticsGrpcServer.GracefulStop()
}
