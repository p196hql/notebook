import { apiFetch } from "@/lib/api";

export async function fetchNotebookDetail(notebookId, conversationId) {
  const search = conversationId
    ? `?conversationId=${encodeURIComponent(conversationId)}`
    : "";

  return apiFetch(`/notebooks/${notebookId}${search}`);
}

export async function sendNotebookChat(notebookId, { message, conversationId }) {
  return apiFetch(`/notebooks/${notebookId}/chat`, {
    method: "POST",
    body: JSON.stringify({
      message,
      conversationId,
    }),
  });
}
