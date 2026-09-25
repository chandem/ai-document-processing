const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "/api/v1";

const DEFAULT_TIMEOUT_MS = 60_000;

function networkErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("AbortError") || msg.toLowerCase().includes("aborted")) {
    return "Request timed out. The API may be slow or unreachable — try again.";
  }
  if (
    msg === "Failed to fetch" ||
    msg.includes("NetworkError") ||
    msg.includes("Load failed") ||
    msg.includes("Network request failed")
  ) {
    return (
      "Cannot reach the API. Check that the backend is running and " +
      "VITE_API_BASE_URL points to it (and CORS allows this origin)."
    );
  }
  return msg || "Request failed.";
}

function buildUrl(path: string) {
  return `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

async function apiRequest(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const url = buildUrl(path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      const detail = body.detail;
      if (typeof detail === "string") message = detail;
      else if (Array.isArray(detail))
        message = detail.map((d) => d.msg || d).join("; ");
      else if (detail) message = JSON.stringify(detail);
    } catch {
      // keep generic message
    }
    throw new Error(message);
  }

  if (response.status === 204) return null;

  return response.json();
}

async function downloadBlob(
  path: string,
  accessToken: string,
  suggestedName: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
) {
  const url = buildUrl(path);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    let message = `Download failed (${response.status}).`;
    try {
      const body = await response.json();
      if (body.detail) message = String(body.detail);
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function healthCheck() {
  return apiRequest("/health", {}, 10_000);
}

export async function getUsage(accessToken: string) {
  return apiRequest("/documents/usage", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function uploadDocument(file: File, accessToken: string) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest(
    "/documents/persist",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      body: formData,
    },
    120_000,
  );
}

export async function listDocuments(accessToken: string) {
  return apiRequest("/documents", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function getDocument(documentId: string, accessToken: string) {
  return apiRequest(`/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function deleteDocument(documentId: string, accessToken: string) {
  return apiRequest(`/documents/${documentId}`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function askDocument(
  documentId: string,
  question: string,
  accessToken: string,
  options?: { conversationId?: string; saveHistory?: boolean },
) {
  return apiRequest(
    `/documents/${documentId}/ask`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question,
        conversation_id: options?.conversationId ?? null,
        save_history: options?.saveHistory ?? true,
      }),
    },
    90_000,
  );
}

export async function listConversations(
  documentId: string,
  accessToken: string,
) {
  return apiRequest(`/documents/${documentId}/conversations`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function listMessages(
  documentId: string,
  conversationId: string,
  accessToken: string,
) {
  return apiRequest(
    `/documents/${documentId}/conversations/${conversationId}/messages`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

export async function analyzeDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest(
    "/documents/analyze",
    {
      method: "POST",
      body: formData,
    },
    120_000,
  );
}

export async function exportDocument(
  documentId: string,
  accessToken: string,
  suggestedName = "document-export.json",
) {
  return downloadBlob(
    `/documents/${documentId}/export`,
    accessToken,
    suggestedName,
  );
}

export async function exportDocumentCsv(
  documentId: string,
  accessToken: string,
  suggestedName = "document-export.csv",
) {
  return downloadBlob(
    `/documents/${documentId}/export.csv`,
    accessToken,
    suggestedName,
  );
}

export async function exportDocumentsCsv(
  accessToken: string,
  suggestedName = "documents-export.csv",
) {
  return downloadBlob("/documents/export.csv", accessToken, suggestedName);
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export async function getProcessingHistory(
  documentId: string,
  accessToken: string,
) {
  return apiRequest(`/documents/${documentId}/history`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function getDocumentFileUrl(
  documentId: string,
  accessToken: string,
) {
  return apiRequest(`/documents/${documentId}/file-url`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function retryDocument(documentId: string, accessToken: string) {
  return apiRequest(
    `/documents/${documentId}/retry`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    120_000,
  );
}
