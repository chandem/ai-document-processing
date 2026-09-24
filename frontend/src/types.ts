export type DocumentStatus = "uploaded" | "processing" | "completed" | "failed";

export interface DocumentItem {
  id: string;
  filename: string;
  content_type?: string;
  file_size?: number;
  status: DocumentStatus;
  category?: string;
  classification_confidence?: number;
  summary?: string;
  extracted_text?: string;
  storage_path?: string;
  structured_data?: Record<string, unknown> | null;
  error_message?: string | null;
  retry_count?: number;
  processed_at?: string | null;
  created_at?: string;
  updated_at?: string;
  analysis_source?: string;
}

export interface ProcessingJob {
  id: string;
  stage: string;
  status: "queued" | "processing" | "running" | "completed" | "failed";
  attempt?: number;
  error_message?: string | null;
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface Citation {
  index: number;
  snippet: string;
  score?: number;
}

export interface AskResponse {
  document_id?: string;
  question: string;
  answer: string;
  citations?: Citation[];
  conversation_id?: string | null;
  source?: string;
}

export interface Conversation {
  id: string;
  title?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[] | null;
  created_at?: string;
}

export interface AnalyzeResponse {
  filename: string;
  status: string;
  category: string;
  confidence: number;
  summary: string;
  structured_data?: Record<string, unknown> | null;
}

export interface UsageSnapshot {
  day: string;
  uploads: number;
  asks: number;
  exports: number;
  limits: {
    uploads_per_day: number;
    asks_per_day: number;
    exports_per_day: number;
  };
  checked_at?: string;
}

export interface HealthCapabilities {
  status: string;
  service: string;
  version?: string;
  env?: string;
  capabilities?: {
    ocr: boolean;
    ai: boolean;
    max_upload_size_mb: number;
  };
}
