import { apiFetch } from "@/lib/api";

export async function fetchNotebooks() {
  return apiFetch("/notebooks");
}

export async function createNotebook({ name, files }) {
  const formData = new FormData();
  formData.append("name", name);
  files.forEach((file) => formData.append("files", file));

  return apiFetch("/notebooks", {
    method: "POST",
    body: formData,
  });
}

export async function renameNotebook(notebookId, name) {
  return apiFetch(`/notebooks/${notebookId}`, {
    method: "PATCH",
    body: JSON.stringify({ name }),
  });
}

export async function deleteNotebook(notebookId) {
  return apiFetch(`/notebooks/${notebookId}`, {
    method: "DELETE",
  });
}

export async function renameConversation(notebookId, conversationId, title) {
  return apiFetch(`/notebooks/${notebookId}/conversations/${conversationId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function deleteConversation(notebookId, conversationId) {
  return apiFetch(`/notebooks/${notebookId}/conversations/${conversationId}`, {
    method: "DELETE",
  });
}
