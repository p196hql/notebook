import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { NotebooksContext } from "@/contexts/notebooks-context";
import { useAuth } from "@/hooks/use-auth";
import {
  createNotebook as createNotebookRequest,
  deleteConversation as deleteConversationRequest,
  deleteNotebook as deleteNotebookRequest,
  fetchNotebooks,
  renameConversation as renameConversationRequest,
  renameNotebook as renameNotebookRequest,
} from "@/lib/notebooks";
import { sortConversations, sortNotebooks } from "@/lib/notebook-utils";

function mergeNotebook(current, notebook, conversations = current?.conversations ?? []) {
  return {
    ...current,
    ...notebook,
    conversations: sortConversations(conversations),
  };
}

function NotebooksProvider({ children }) {
  const { user } = useAuth();
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [notebooks, setNotebooks] = useState([]);

  const refreshNotebooks = useCallback(
    async ({ silent = false } = {}) => {
      if (!user) {
        return [];
      }

      try {
        const data = await fetchNotebooks();
        setNotebooks(sortNotebooks(data.notebooks));
        console.debug("[notebooks] fetched", data.notebooks);
        return data.notebooks;
      } catch (error) {
        if (!silent) {
          toast.error(error.message);
        }
        throw error;
      }
    },
    [user],
  );

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    async function loadInitialNotebooks() {
      try {
        const data = await fetchNotebooks();

        if (cancelled) {
          return;
        }

        setNotebooks(sortNotebooks(data.notebooks));
        console.debug("[notebooks] fetched", data.notebooks);
      } catch (error) {
        if (!cancelled) {
          toast.error(error.message);
        }
      }
    }

    loadInitialNotebooks();

    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return undefined;
    }

    const hasProcessingNotebook = notebooks.some(
      (notebook) => notebook.status === "processing",
    );

    if (!hasProcessingNotebook) {
      return undefined;
    }

    console.debug("[notebooks] polling for processing notebooks");

    const intervalId = window.setInterval(() => {
      refreshNotebooks({ silent: true }).catch((error) => {
        console.error("[notebooks] poll failed", error);
      });
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [notebooks, refreshNotebooks, user]);

  const updateNotebookState = useCallback((notebookId, updater) => {
    setNotebooks((current) =>
      sortNotebooks(
        current.map((notebook) =>
          notebook.id === notebookId ? updater(notebook) : notebook,
        ),
      ),
    );
  }, []);

  const syncNotebookDetail = useCallback((notebook, conversations = []) => {
    setNotebooks((current) => {
      const existing = current.find((entry) => entry.id === notebook.id);
      const nextNotebook = mergeNotebook(existing, notebook, conversations);
      const remaining = current.filter((entry) => entry.id !== notebook.id);
      return sortNotebooks([nextNotebook, ...remaining]);
    });
  }, []);

  const syncConversation = useCallback(
    (notebookId, conversation) => {
      updateNotebookState(notebookId, (notebook) => {
        const conversations = notebook.conversations ?? [];
        const nextConversations = conversations.filter(
          (entry) => entry.id !== conversation.id,
        );

        return {
          ...notebook,
          lastMessageAt: conversation.lastMessageAt ?? notebook.lastMessageAt,
          conversations: sortConversations([conversation, ...nextConversations]),
        };
      });
    },
    [updateNotebookState],
  );

  const handleCreateNotebook = useCallback(async ({ name, files }) => {
    setCreatingNotebook(true);

    try {
      const data = await createNotebookRequest({ name, files });
      console.debug("[notebooks] created", data.notebook);
      setNotebooks((current) => sortNotebooks([data.notebook, ...current]));
      toast.success("Notebook created. Processing started.");
      return { notebook: data.notebook, error: null };
    } catch (error) {
      toast.error(error.message);
      return { notebook: null, error };
    } finally {
      setCreatingNotebook(false);
    }
  }, []);

  const handleDeleteConversation = useCallback(
    async (notebookId, conversationId) => {
      try {
        const data = await deleteConversationRequest(notebookId, conversationId);

        updateNotebookState(notebookId, (notebook) => ({
          ...notebook,
          conversations: (notebook.conversations ?? []).filter(
            (conversation) => conversation.id !== conversationId,
          ),
        }));

        toast.success("Conversation deleted.");
        return data;
      } catch (error) {
        toast.error(error.message);
        return null;
      }
    },
    [updateNotebookState],
  );

  const handleRenameNotebook = useCallback(
    async (notebookId, name) => {
      try {
        const data = await renameNotebookRequest(notebookId, name);

        updateNotebookState(notebookId, (notebook) => ({
          ...notebook,
          ...data.notebook,
        }));

        toast.success(data.message);
        return data.notebook;
      } catch (error) {
        toast.error(error.message);
        return null;
      }
    },
    [updateNotebookState],
  );

  const handleRenameConversation = useCallback(
    async (notebookId, conversationId, title) => {
      try {
        const data = await renameConversationRequest(
          notebookId,
          conversationId,
          title,
        );

        updateNotebookState(notebookId, (notebook) => ({
          ...notebook,
          conversations: sortConversations(
            (notebook.conversations ?? []).map((conversation) =>
              conversation.id === conversationId
                ? { ...conversation, ...data.conversation }
                : conversation,
            ),
          ),
        }));

        toast.success(data.message);
        return data.conversation;
      } catch (error) {
        toast.error(error.message);
        return null;
      }
    },
    [updateNotebookState],
  );

  const handleDeleteNotebook = useCallback(async (notebookId) => {
    try {
      const data = await deleteNotebookRequest(notebookId);

      setNotebooks((current) =>
        current.filter((notebook) => notebook.id !== notebookId),
      );
      toast.success(data.message);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  }, []);

  const value = useMemo(
    () => ({
      creatingNotebook,
      notebooks: user ? notebooks : [],
      onCreateNotebook: handleCreateNotebook,
      onDeleteConversation: handleDeleteConversation,
      onDeleteNotebook: handleDeleteNotebook,
      onRenameConversation: handleRenameConversation,
      onRenameNotebook: handleRenameNotebook,
      refreshNotebooks,
      syncConversation,
      syncNotebookDetail,
    }),
    [
      creatingNotebook,
      handleCreateNotebook,
      handleDeleteConversation,
      handleDeleteNotebook,
      handleRenameConversation,
      handleRenameNotebook,
      notebooks,
      refreshNotebooks,
      syncConversation,
      syncNotebookDetail,
      user,
    ],
  );

  return (
    <NotebooksContext.Provider value={value}>
      {children}
    </NotebooksContext.Provider>
  );
}

export { NotebooksProvider };
