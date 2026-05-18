function getSortTime(entry) {
  return new Date(
    entry.lastMessageAt ?? entry.updatedAt ?? entry.createdAt ?? 0,
  ).getTime();
}

export function sortConversations(items) {
  return [...items].sort((a, b) => getSortTime(b) - getSortTime(a));
}

export function sortNotebooks(items) {
  return [...items].sort((a, b) => getSortTime(b) - getSortTime(a));
}
