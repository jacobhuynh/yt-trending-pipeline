# Stage 1 - Build
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN go build -o /app/server ./cmd/server/main.go

# Stage 2 - Run
FROM alpine:latest

RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

COPY --from=builder /app/server /app/server
RUN chmod +x /app/server && chown appuser:appgroup /app/server

USER appuser

EXPOSE 8080
EXPOSE 50051

CMD ["/app/server"]