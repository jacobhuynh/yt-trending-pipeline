export interface ProtoTimestamp {
  seconds: number;
  nanos: number;
}

export interface JobStatus {
  job_id: string;
  state: number;
  region: string;
  category_id: number;
  attempt: number;
  max_attempts: number;
  videos_fetched: number;
  videos_inserted: number;
  error_message?: string;
  next_retry_at?: ProtoTimestamp;
  created_at?: ProtoTimestamp;
  started_at?: ProtoTimestamp;
  completed_at?: ProtoTimestamp;
  metadata?: Record<string, string>;
}

export interface JobResponse {
  job_id: string;
  state: number;
  message?: string;
  created_at?: ProtoTimestamp;
}

export interface JobUpdate {
  job_id: string;
  state: number;
  videos_fetched: number;
  videos_inserted: number;
  message?: string;
  occurred_at?: ProtoTimestamp;
}

export interface BatchJobResult {
  job_id: string;
  state: number;
  idempotency_key: string;
  message?: string;
}

export interface BatchResponse {
  total_received: number;
  total_accepted: number;
  total_rejected: number;
  results: BatchJobResult[];
}

export interface SubmitJobRequest {
  region: string;
  category_id: number;
  max_results: number;
  idempotency_key: string;
}
