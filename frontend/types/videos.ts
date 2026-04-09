export interface Video {
  video_id: string;
  job_id: string;
  region: string;
  fetched_at: string;
  title: string;
  channel_id: string;
  channel_title: string;
  published_at: string;
  category_id: number;
  view_count: number;
  like_count: number;
  comment_count: number;
}

export interface TopChannel {
  channel_id: string;
  channel_title: string;
  appear_count: number;
  view_count: number;
}

export interface TrendPoint {
  fetched_at: string;
  view_count: number;
  like_count: number;
  comment_count: number;
}
