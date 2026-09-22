const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "/api/v1"; // relative path works with Vite proxy in dev and same-origin deploys

function networkErrorMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
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

async function apiRequest(path: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, options);
  } catch (err) {
    throw new Error(networkErrorMessage(err));
  }

  if (!response.ok) {
    let message = `Request failed (${response.status}).`;
    try {
      const body = await response.json();
      const detail = body.detail;
      if (typeof detail === "string") message = detail;
      else if (Array.isArray(detail)) message = detail.map((d) => d.msg || d).join("; ");
      else if (detail) message = JSON.stringify(detail);
    } catch {
      // keep generic message
    }
    throw new Error(message);
  }

  // 204 No Content
  if (response.status === 204) return null;

  return response.json();
}

export async function healthCheck() {
  return apiRequest("/health");
}

export async function uploadDocument(file: File, accessToken: string) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest("/documents/persist", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
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
) {
  return apiRequest(`/documents/${documentId}/ask`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ question }),
  });
}

export async function analyzeDocument(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  return apiRequest("/documents/analyze", {
    method: "POST",
    body: formData,
  });
}

export function getApiBaseUrl() {
  return API_BASE_URL;
}
