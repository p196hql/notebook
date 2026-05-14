import { useContext } from "react";

import { NotebooksContext } from "@/contexts/notebooks-context";

export function useNotebooks() {
  const context = useContext(NotebooksContext);

  if (!context) {
    throw new Error("useNotebooks must be used within a NotebooksProvider.");
  }

  return context;
}
