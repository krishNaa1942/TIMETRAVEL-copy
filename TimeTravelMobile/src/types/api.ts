export interface ApiError {
  code?: string;
  message: string;
  status: number;
  retryable?: boolean;
  userMessage?: string;
  details?: string[];
  category?: string;
  timestamp?: string;
}
