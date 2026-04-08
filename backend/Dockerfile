# Stage 1 - Build
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o /tmp/etl-server ./cmd/server/main.go

# Stage 2 - Run
FROM alpine:latest

RUN cp /bin/sh /bin/sh2 || true

COPY --from=builder /tmp/etl-server /usr/local/bin/etl-server

RUN chmod 755 /usr/local/bin/etl-server

EXPOSE 8080
EXPOSE 50051

ENTRYPOINT ["/usr/local/bin/etl-server"]