import { startTransition, useEffect, useState } from "react";
import { toast } from "sonner";

import { useNotebooks } from "@/hooks/use-notebooks";
import {
  fetchNotebookDetail,
  sendNotebookChat as sendNotebookChatRequest,
} from "@/lib/notebook-detail";
import { sortConversations } from "@/lib/notebook-utils";

export function useNotebookSession({
  notebookId,
  requestedConversationId,
  isDraftConversation,
  setSearchParams,
}) {
  const { refreshNotebooks, syncConversation, syncNotebookDetail } = useNotebooks();
  const [notebook, setNotebook] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function loadNotebookOverview() {
      setLoading(true);

      try {
        const data = await fetchNotebookDetail(notebookId);
        setNotebook(data.notebook);
        setConversations(sortConversations(data.conversations ?? []));
        setActiveConversationId(null);
        setMessages([]);
        syncNotebookDetail(data.notebook, data.conversations ?? []);
      } catch (error) {
        toast.error(error.message);
      } finally {
        setLoading(false);
      }
    }

    loadNotebookOverview();
  }, [notebookId, syncNotebookDetail]);

  const isProcessingNotebook = notebook?.status === "processing";

  useEffect(() => {
    if (!isProcessingNotebook) {
      return undefined;
    }

    const intervalId = window.setInterval(async () => {
      try {
        const data = await fetchNotebookDetail(notebookId);
        setNotebook(data.notebook);
        setConversations(sortConversations(data.conversations ?? []));
        syncNotebookDetail(data.notebook, data.conversations ?? []);
      } catch (error) {
        console.error("[notebook] processing poll failed", error);
      }
    }, 3000);

    return () => window.clearInterval(intervalId);
  }, [isProcessingNotebook, notebookId, syncNotebookDetail]);

  useEffect(() => {
    async function loadConversation() {
      if (!requestedConversationId) {
        setActiveConversationId(null);
        setMessages([]);
        return;
      }

      setMessagesLoading(true);

      try {
        const data = await fetchNotebookDetail(notebookId, requestedConversationId);
        setActiveConversationId(data.activeConversationId);
        setMessages(data.messages);
        if (data.activeConversationId) {
          setSearchParams({ chat: data.activeConversationId }, { replace: true });
        } else {
          setSearchParams({}, { replace: true });
        }
      } catch (error) {
        toast.error(error.message);
      } finally {
        setMessagesLoading(false);
      }
    }

    if (!isDraftConversation) {
      loadConversation();
    }
  }, [
    isDraftConversation,
    notebookId,
    requestedConversationId,
    setSearchParams,
  ]);

  async function handleCreateConversation() {
    setActiveConversationId(null);
    setMessages([]);
    setSearchParams({ new: "1" });
  }

  async function sendMessage(message, currentConversationId) {
    if (!message) {
      return;
    }

    const tempUserMessage = {
      id: `temp-user-${crypto.randomUUID()}`,
      role: "user",
      content: message,
      citations: [],
    };
    const tempAssistantMessage = {
      id: `temp-assistant-${crypto.randomUUID()}`,
      role: "assistant",
      content: "",
      citations: [],
      isLoading: true,
    };

    setSending(true);
    setMessages((current) => [
      ...current,
      tempUserMessage,
      tempAssistantMessage,
    ]);

    try {
      const data = await sendNotebookChatRequest(notebookId, {
        message,
        conversationId: currentConversationId,
      });

      startTransition(() => {
        setActiveConversationId(data.conversation.id);
        setConversations((current) => {
          const next = current.filter((entry) => entry.id !== data.conversation.id);
          return sortConversations([data.conversation, ...next]);
        });
        setSearchParams({ chat: data.conversation.id }, { replace: true });
        setMessages((current) =>
          current.map((entry) => {
            if (entry.id === tempUserMessage.id) return data.userMessage;
            if (entry.id === tempAssistantMessage.id) return data.assistantMessage;
            return entry;
          }),
        );
      });

      syncConversation(notebookId, data.conversation);
      refreshNotebooks({ silent: true }).catch(() => undefined);
    } catch (error) {
      setMessages((current) =>
        current.filter(
          (entry) =>
            entry.id !== tempUserMessage.id &&
            entry.id !== tempAssistantMessage.id,
        ),
      );
      toast.error(error.message);
    } finally {
      setSending(false);
    }
  }

  return {
    activeConversationId,
    conversations,
    handleCreateConversation,
    loading,
    messages,
    messagesLoading,
    notebook,
    sendMessage,
    sending,
  };
}
