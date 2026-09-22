const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

async function apiRequest(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);

  if (!response.ok) {
    let message = "Request failed.";
    try {
      const body = await response.json();
      message = body.detail || message;
    } catch {
      // Keep the generic message when the response is not JSON.
    }
    throw new Error(message);
  }

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
