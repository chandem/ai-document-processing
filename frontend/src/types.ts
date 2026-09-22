export interface DocumentItem {
  id: string;
  filename: string;
  contentType?: string;
  status: "uploaded" | "processing" | "completed" | "failed";
  createdAt?: string;
}

export interface UploadResponse {
  filename: string;
  content_type?: string;
  status: string;
  message: string;
}
