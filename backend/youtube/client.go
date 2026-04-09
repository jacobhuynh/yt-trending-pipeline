package client

import (
	"encoding/json"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/jacobhuynh/youtube-etl-pipeline/pb"
)

// Client holds the YouTube Data API key used to authenticate requests.
type Client struct {
	APIKey string
}

// Video represents a single YouTube video and its engagement metrics at a point in time.
type Video struct {
	VideoId      string
	JobId        string
	Region       string
	FetchedAt    time.Time
	Title        string
	ChannelId    string
	ChannelTitle string
	PublishedAt  time.Time
	CategoryId   int
	ViewCount    int
	LikeCount    int
	CommentCount int
}

type youtubeResponse struct {
	Items []youtubeItem `json:"items"`
}

type youtubeItem struct {
	ID      string         `json:"id"`
	Snippet youtubeSnippet `json:"snippet"`
	Stats   youtubeStats   `json:"statistics"`
}

type youtubeSnippet struct {
	Title        string `json:"title"`
	ChannelId    string `json:"channelId"`
	ChannelTitle string `json:"channelTitle"`
	PublishedAt  string `json:"publishedAt"`
	CategoryId   string `json:"categoryId"`
}

type youtubeStats struct {
	ViewCount    string `json:"viewCount"`
	LikeCount    string `json:"likeCount"`
	CommentCount string `json:"commentCount"`
}

// FetchTrending calls the YouTube Data API to retrieve the most popular videos for the region and category specified
// in req, tagging each result with JobId, and returns them as a slice of Video.
func (c *Client) FetchTrending(req *pb.JobRequest, JobId string) ([]Video, error) {
	videos := make([]Video, 0, req.MaxResults)

	params := url.Values{}
	params.Set("part", "snippet,statistics")
	params.Set("chart", "mostPopular")
	params.Set("regionCode", req.Region)
	params.Set("maxResults", strconv.Itoa(int(req.MaxResults)))
	params.Set("key", c.APIKey)

	if req.CategoryId != 0 {
		params.Set("videoCategoryId", strconv.Itoa(int(req.CategoryId)))
	}

	URL := "https://www.googleapis.com/youtube/v3/videos?" + params.Encode()

	resp, err := http.Get(URL)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result youtubeResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	for _, item := range result.Items {
		publishedAt, _ := time.Parse(time.RFC3339, item.Snippet.PublishedAt)
		viewCount, _ := strconv.Atoi(item.Stats.ViewCount)
		likeCount, _ := strconv.Atoi(item.Stats.LikeCount)
		commentCount, _ := strconv.Atoi(item.Stats.CommentCount)
		categoryId, _ := strconv.Atoi(item.Snippet.CategoryId)
		videos = append(videos, Video{
			VideoId:      item.ID,
			JobId:        JobId,
			Region:       req.Region,
			FetchedAt:    time.Now(),
			Title:        item.Snippet.Title,
			ChannelId:    item.Snippet.ChannelId,
			ChannelTitle: item.Snippet.ChannelTitle,
			PublishedAt:  publishedAt,
			CategoryId:   categoryId,
			ViewCount:    viewCount,
			LikeCount:    likeCount,
			CommentCount: commentCount,
		})
	}
	return videos, nil
}
