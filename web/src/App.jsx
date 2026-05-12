import { useEffect, useState } from "react";
import { toast } from "sonner";

import { apiFetch } from "@/lib/api";
import { AppRoutes } from "@/routes/AppRoutes";

function App() {
  const [user, setUser] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [creatingNotebook, setCreatingNotebook] = useState(false);
  const [notebooks, setNotebooks] = useState([]);

  useEffect(() => {
    async function loadSession() {
      try {
        const data = await apiFetch("/auth/me");
        setUser(data.user);
      } catch (error) {
        if (error.status !== 401) {
          toast.error(error.message);
        }
      } finally {
        setIsReady(true);
      }
    }

    loadSession();
  }, []);

  useEffect(() => {
    async function loadNotebooks() {
      if (!user) {
        setNotebooks([]);
        return;
      }

      try {
        const data = await apiFetch("/notebooks");
        setNotebooks(data.notebooks);
        console.debug("[notebooks] fetched", data.notebooks);
      } catch (error) {
        toast.error(error.message);
      }
    }

    loadNotebooks();
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

    const intervalId = window.setInterval(async () => {
      try {
        const data = await apiFetch("/notebooks");
        setNotebooks(data.notebooks);
        console.debug("[notebooks] poll update", data.notebooks);
      } catch (error) {
        console.error("[notebooks] poll failed", error);
      }
    }, 5000);

    return () => window.clearInterval(intervalId);
  }, [notebooks, user]);

  function updateNotebookState(notebookId, updater) {
    setNotebooks((current) =>
      current.map((notebook) =>
        notebook.id === notebookId ? updater(notebook) : notebook,
      ),
    );
  }

  async function handleLogin(values) {
    setAuthLoading(true);

    try {
      const data = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify(values),
      });

      setUser(data.user);
      toast.success(data.message);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignup(values) {
    setAuthLoading(true);

    try {
      const data = await apiFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify(values),
      });

      setUser(data.user);
      toast.success(data.message);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    setAuthLoading(true);

    try {
      const data = await apiFetch("/auth/logout", {
        method: "POST",
      });

      setUser(null);
      toast.success(data.message);
    } catch (error) {
      toast.error(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleCreateNotebook({ name, files }) {
    setCreatingNotebook(true);

    try {
      const formData = new FormData();
      formData.append("name", name);
      files.forEach((file) => formData.append("files", file));

      const data = await apiFetch("/notebooks", {
        method: "POST",
        body: formData,
      });

      console.debug("[notebooks] created", data.notebook);
      setNotebooks((current) => [data.notebook, ...current]);
      toast.success("Notebook created. Processing started.");
      return { notebook: data.notebook, error: null };
    } catch (error) {
      toast.error(error.message);
      return { notebook: null, error };
    } finally {
      setCreatingNotebook(false);
    }
  }

  async function handleDeleteConversation(notebookId, conversationId) {
    try {
      const data = await apiFetch(
        `/notebooks/${notebookId}/conversations/${conversationId}`,
        {
          method: "DELETE",
        },
      );

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
  }

  async function handleRenameNotebook(notebookId, name) {
    try {
      const data = await apiFetch(`/notebooks/${notebookId}`, {
        method: "PATCH",
        body: JSON.stringify({ name }),
      });

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
  }

  async function handleRenameConversation(notebookId, conversationId, title) {
    try {
      const data = await apiFetch(
        `/notebooks/${notebookId}/conversations/${conversationId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ title }),
        },
      );

      updateNotebookState(notebookId, (notebook) => ({
        ...notebook,
        conversations: (notebook.conversations ?? []).map((conversation) =>
          conversation.id === conversationId
            ? { ...conversation, ...data.conversation }
            : conversation,
        ),
      }));

      toast.success(data.message);
      return data.conversation;
    } catch (error) {
      toast.error(error.message);
      return null;
    }
  }

  async function handleDeleteNotebook(notebookId) {
    try {
      const data = await apiFetch(`/notebooks/${notebookId}`, {
        method: "DELETE",
      });

      setNotebooks((current) =>
        current.filter((notebook) => notebook.id !== notebookId),
      );
      toast.success(data.message);
      return true;
    } catch (error) {
      toast.error(error.message);
      return false;
    }
  }

  return (
    <AppRoutes
      authLoading={authLoading}
      creatingNotebook={creatingNotebook}
      isReady={isReady}
      notebooks={notebooks}
      onCreateNotebook={handleCreateNotebook}
      onDeleteConversation={handleDeleteConversation}
      onDeleteNotebook={handleDeleteNotebook}
      onRenameConversation={handleRenameConversation}
      onRenameNotebook={handleRenameNotebook}
      onLogin={handleLogin}
      onLogout={handleLogout}
      onSignup={handleSignup}
      user={user}
    />
  );
}

export default App;
