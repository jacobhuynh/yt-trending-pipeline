# Stage 1 - Build
FROM golang:1.24-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o server ./cmd/server/main.go

# Stage 2 - Run
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/server .

EXPOSE 8080
EXPOSE 50051

CMD ["./server"]