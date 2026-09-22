export interface DocumentItem {
  id: string;
  filename: string;
  content_type?: string;
  file_size?: number;
  status: "uploaded" | "processing" | "completed" | "failed";
  category?: string;
  classification_confidence?: number;
  summary?: string;
  extracted_text?: string;
  storage_path?: string;
  created_at?: string;
  updated_at?: string;
  structured_data?: Record<string, unknown>;
  analysis_source?: string;
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
}
