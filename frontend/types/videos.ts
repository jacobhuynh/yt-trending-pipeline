export interface Video {
  VideoId: string;
  JobId: string;
  Region: string;
  FetchedAt: string;
  Title: string;
  ChannelId: string;
  ChannelTitle: string;
  PublishedAt: string;
  CategoryId: number;
  ViewCount: number;
  LikeCount: number;
  CommentCount: number;
}

export interface TopChannel {
  ChannelId: string;
  ChannelTitle: string;
  AppearCount: number;
  TotalViews: number;
}

export interface TrendPoint {
  FetchedAt: string;
  ViewCount: number;
  LikeCount: number;
  CommentCount: number;
}
