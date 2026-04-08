# Stage 1 - Build
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /app/server ./cmd/server/main.go && chmod +x /app/server

# Stage 2 - Run
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/server /app/server
RUN chmod +x /app/server

EXPOSE 8080
EXPOSE 50051

CMD ["/app/server"]