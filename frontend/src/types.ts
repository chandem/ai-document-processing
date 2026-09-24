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
  /** @deprecated prefer error_message */
  error?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AskResponse {
  document_id?: string;
  question: string;
  answer: string;
}

export interface AnalyzeResponse {
  filename: string;
  status: string;
  category: string;
  confidence: number;
  summary: string;
  structured_data?: Record<string, unknown> | null;
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
