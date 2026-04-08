# Stage 1 - Build
FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/server ./cmd/server/main.go

# Stage 2 - Run
FROM alpine:latest

COPY --from=builder /app/server /server

RUN chmod +x /server

EXPOSE 8080
EXPOSE 50051

CMD ["/server"]