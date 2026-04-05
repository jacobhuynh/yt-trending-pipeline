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
	"github.com/jacobhuynh/youtube-etl-pipeline/api"
	"github.com/jacobhuynh/youtube-etl-pipeline/db"
	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
	"github.com/jacobhuynh/youtube-etl-pipeline/server"
	"github.com/jacobhuynh/youtube-etl-pipeline/worker"
	client "github.com/jacobhuynh/youtube-etl-pipeline/youtube"
)

func main() {
	numWorkers := 5
	databaseURL := os.Getenv("DATABASE_URL")
	youtubeClient := &client.Client{APIKey: os.Getenv("YOUTUBE_API_KEY")}

	ctx := context.Background()
	db, err := db.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	server := server.New(db)

	lis, err := net.Listen("tcp", ":50051")
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	grpcServer := grpc.NewServer()
	pb.RegisterETLServiceServer(grpcServer, server)

	for i := 0; i < numWorkers; i++ {
		w := worker.New(server.JobQueue(), db, youtubeClient)
		w.Start(ctx)
	}

	go func() {
		log.Printf("gRPC server listening on :50051")
		if err := grpcServer.Serve(lis); err != nil {
			log.Fatalf("failed to serve: %v", err)
		}
	}()

	conn, err := grpc.NewClient("localhost:50051", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		log.Fatalf("failed to connect to gRPC server: %v", err)
	}
	defer conn.Close()

	grpcClient := pb.NewETLServiceClient(conn)
	apiServer := api.New(grpcClient)

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
	grpcServer.GracefulStop()
}
