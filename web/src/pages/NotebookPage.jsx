import { memo, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  CircleAlert,
  Copy,
  Clock3,
  FileText,
  Layers3,
  Loader2,
  MessageSquarePlus,
  MessagesSquare,
  Quote,
  Send,
  Sparkles,
} from "lucide-react";
import rehypeRaw from "rehype-raw";
import ReactMarkdown from "react-markdown";
import { NavLink, useParams, useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { Children, isValidElement } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAutosizeTextarea } from "@/hooks/use-autosize-textarea";
import { useNotebookSession } from "@/hooks/use-notebook-session";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { usePageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";

const CITATIONS_PREFERENCE_KEY = "notebook-show-citations";

function getScrollParent(node) {
  let current = node?.parentElement ?? null;
  while (current) {
    const styles = window.getComputedStyle(current);
    const overflowY = styles.overflowY;
    if (
      (overflowY === "auto" || overflowY === "scroll") &&
      current.scrollHeight > current.clientHeight
    ) {
      return current;
    }
    current = current.parentElement;
  }
  return document.scrollingElement;
}

function formatRelative(dateString) {
  if (!dateString) return "";
  const d = new Date(dateString);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function getNodeText(node) {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join("");
  }

  if (isValidElement(node)) {
    return getNodeText(node.props.children);
  }

  return "";
}

function CodeBlock({ children, ...props }) {
  const [copied, setCopied] = useState(false);
  const resetTimeoutRef = useRef(null);
  const codeText = Children.toArray(children)
    .map(getNodeText)
    .join("")
    .replace(/\n$/, "");

  useEffect(() => {
    return () => {
      if (resetTimeoutRef.current) {
        window.clearTimeout(resetTimeoutRef.current);
      }
    };
  }, []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(codeText);
      setCopied(true);
      toast.success("Code copied.");

      if (resetTimeoutRef.current) {
        window.clearTimeout(resetTimeoutRef.current);
      }

      resetTimeoutRef.current = window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      toast.error("Could not copy code.");
    }
  }

  return (
    <div className="my-4 overflow-hidden rounded-xl border bg-muted">
      <div className="flex items-center justify-end border-b bg-background/70 px-2 py-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7"
          onClick={handleCopy}
        >
          {copied ? (
            <Check data-icon="inline-start" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        className="w-full max-w-full overflow-x-auto px-4 py-3 text-sm leading-6"
        {...props}
      >
        {children}
      </pre>
    </div>
  );
}

function MarkdownMessage({ content }) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden wrap-break-word text-[15px] leading-7 text-foreground">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: (p) => (
            <h1
              className="mt-2 mb-4 text-2xl font-semibold tracking-tight"
              {...p}
            />
          ),
          h2: (p) => (
            <h2
              className="mt-6 mb-3 text-xl font-semibold tracking-tight"
              {...p}
            />
          ),
          h3: (p) => (
            <h3
              className="mt-5 mb-2 text-lg font-semibold tracking-tight"
              {...p}
            />
          ),
          h4: (p) => (
            <h4 className="mt-4 mb-2 text-base font-semibold" {...p} />
          ),
          p: (p) => <p className="my-3 whitespace-pre-wrap leading-7" {...p} />,
          strong: (p) => <strong className="font-semibold" {...p} />,
          em: (p) => <em className="italic" {...p} />,
          u: (p) => <u className="underline underline-offset-2" {...p} />,
          ul: (p) => (
            <ul className="my-3 ml-5 flex list-disc flex-col gap-2" {...p} />
          ),
          ol: (p) => (
            <ol className="my-3 ml-5 flex list-decimal flex-col gap-2" {...p} />
          ),
          li: (p) => <li className="pl-1" {...p} />,
          blockquote: (p) => (
            <blockquote
              className="my-4 border-l-4 border-primary/40 pl-4 italic text-muted-foreground"
              {...p}
            />
          ),
          a: (p) => (
            <a
              className="text-primary underline underline-offset-4 hover:opacity-80"
              target="_blank"
              rel="noreferrer"
              {...p}
            />
          ),
          hr: (p) => <hr className="my-5 border-border" {...p} />,
          pre: (p) => <CodeBlock {...p} />,
          code(props) {
            const { children, className, ...rest } = props;
            const isInline = !className;
            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 text-[0.9em] font-mono"
                  {...rest}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...rest}>
                {children}
              </code>
            );
          },
          table: (p) => (
            <div className="my-4 w-full max-w-full overflow-x-auto rounded-xl border">
              <table className="min-w-full border-collapse text-sm" {...p} />
            </div>
          ),
          thead: (p) => <thead className="bg-muted/60" {...p} />,
          th: (p) => (
            <th className="border-b px-3 py-2 text-left font-medium" {...p} />
          ),
          td: (p) => <td className="border-t px-3 py-2 align-top" {...p} />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

function MessageBubble({ message, showCitations }) {
  const isUser = message.role === "user";
  const isLoading = message.role === "assistant" && message.isLoading;

  return (
    <div
      className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}
    >
      <div
        className={cn(
          "flex min-w-0 max-w-[85%] flex-col gap-3 rounded-2xl px-4 py-3 sm:max-w-2xl",
          isUser
            ? "bg-gradient-primary text-primary-foreground shadow-elegant"
            : "border bg-card text-card-foreground shadow-soft",
        )}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span className="text-sm">Thinking…</span>
          </div>
        ) : isUser ? (
          <p className="whitespace-pre-wrap text-[15px] leading-7">
            {message.content}
          </p>
        ) : (
          <MarkdownMessage content={message.content} />
        )}

        {!isUser && showCitations && message.citations?.length > 0 ? (
          <div className="mt-2 flex flex-col gap-2 border-t pt-3">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              <Quote className="size-3" />
              Citations
            </p>
            <div className="flex flex-col gap-2">
              {message.citations.map((citation, index) => (
                <div
                  key={`${message.id}-${index}`}
                  className="rounded-lg border bg-muted/40 px-3 py-2 text-xs"
                >
                  <p className="font-medium">
                    [{index + 1}] {citation.sourceName} · p.
                    {citation.pageNumber}
                  </p>
                  <p className="mt-1 leading-5 text-muted-foreground">
                    {citation.quote}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

const NotebookOverview = memo(function NotebookOverview({
  notebook,
  conversations,
  onCreateConversation,
  isReadyToChat,
  sending,
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-10">
      <section className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-8 shadow-soft">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(40% 60% at 100% 0%, color-mix(in oklab, var(--primary-glow) 25%, transparent), transparent 60%)",
          }}
        />
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={notebook.status === "ready" ? "secondary" : "outline"}
              className="capitalize"
            >
              {notebook.status}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {notebook.sourceFiles.length} sources · {notebook.chunkCount}{" "}
              chunks
            </span>
          </div>

          <div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              {notebook.name}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              {isReadyToChat
                ? "Ask questions across your sources and get cited answers."
                : `This notebook is ${notebook.status}. Chat will be available once processing finishes.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              onClick={onCreateConversation}
              disabled={sending || !isReadyToChat}
              className="h-10 bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90"
            >
              <MessageSquarePlus data-icon="inline-start" />
              Start a new chat
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">
              Conversations
            </h2>
            <span className="text-xs text-muted-foreground">
              {conversations.length}{" "}
              {conversations.length === 1 ? "chat" : "chats"}
            </span>
          </div>

          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed bg-card/40 px-6 py-14 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
                <MessagesSquare className="size-5" />
              </div>
              <div>
                <p className="text-sm font-medium">No chats yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Start the first conversation in this notebook.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {conversations.map((conversation) => (
                <NavLink
                  key={conversation.id}
                  to={`/notebooks/${notebook.id}?chat=${conversation.id}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3 transition-all hover:border-primary/40 hover:shadow-soft"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-gradient-primary group-hover:text-primary-foreground">
                      <MessagesSquare className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {conversation.title || "Untitled chat"}
                      </p>
                      <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Clock3 className="size-3" />
                        {formatRelative(
                          conversation.lastMessageAt ??
                            conversation.updatedAt ??
                            conversation.createdAt,
                        )}
                      </p>
                    </div>
                  </div>
                </NavLink>
              ))}
            </div>
          )}
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-2xl border bg-card p-4 shadow-soft">
            <p className="inline-flex items-center gap-2 text-sm font-semibold">
              <Layers3 className="size-4 text-primary" />
              Notebook scope
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              {notebook.chunkCount > 0
                ? `Indexed and ready to answer across ${notebook.chunkCount} chunks.`
                : "Becomes searchable once processing finishes."}
            </p>
          </div>

          <div className="rounded-2xl border bg-card shadow-soft">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">Sources</p>
              <p className="text-xs text-muted-foreground">
                Files indexed for this notebook
              </p>
            </div>
            <div className="flex max-h-96 flex-col gap-2 overflow-y-auto p-3">
              {notebook.sourceFiles.length === 0 ? (
                <p className="px-2 py-4 text-xs text-muted-foreground">
                  No indexed files yet.
                </p>
              ) : (
                notebook.sourceFiles.map((source) => (
                  <div
                    key={source.cloudinaryPublicId}
                    className="flex items-start gap-3 rounded-xl border bg-background/50 p-3"
                  >
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <FileText className="size-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">
                        {source.originalName}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {source.pageCount || 1}{" "}
                        {(source.pageCount || 1) === 1 ? "page" : "pages"} ·{" "}
                        {source.chunkCount} chunks
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
});

function NotebookPage() {
  const { notebookId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedConversationId = searchParams.get("chat");
  const isDraftConversation = searchParams.get("new") === "1";
  const isChatView = Boolean(requestedConversationId) || isDraftConversation;
  const [showCitations, setShowCitations] = usePersistentState(
    CITATIONS_PREFERENCE_KEY,
    true,
  );
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const {
    activeConversationId,
    conversations,
    handleCreateConversation,
    loading,
    messages,
    messagesLoading,
    notebook,
    sendMessage,
    sending,
  } = useNotebookSession({
    isDraftConversation,
    notebookId,
    requestedConversationId,
    setSearchParams,
  });

  const currentConversationId = requestedConversationId
    ? activeConversationId
    : null;
  const conversationTitle = currentConversationId
    ? conversations.find((c) => c.id === currentConversationId)?.title ||
      "Conversation"
    : "New chat";
  const isReadyToChat = notebook?.status === "ready";
  const isProcessingNotebook = notebook?.status === "processing";
  const isFailedNotebook = notebook?.status === "failed";
  const pageTitle = loading
    ? "Loading notebook"
    : notebook?.name
      ? isChatView
        ? `${notebook.name} - ${conversationTitle}`
        : notebook.name
      : "Notebook not found";

  usePageTitle(pageTitle);

  useEffect(() => {
    if (!isChatView) return undefined;
    let timeoutId = 0;

    const scrollToBottom = () => {
      const container =
        messagesContainerRef.current ?? getScrollParent(messagesEndRef.current);
      if (!container) return;
      container.scrollTo({
        top: container.scrollHeight,
        behavior: "smooth",
      });
    };

    const frameId = window.requestAnimationFrame(() => {
      scrollToBottom();
      window.requestAnimationFrame(() => {
        scrollToBottom();
        timeoutId = window.setTimeout(scrollToBottom, 80);
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [isChatView, messages.length, messagesLoading, sending]);

  if (loading) {
    return (
      <main className="flex min-h-full items-center justify-center p-6">
        <Loader2 className="animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!notebook) {
    return (
      <main className="mx-auto w-full max-w-2xl p-6">
        <div className="rounded-2xl border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">Notebook not found.</p>
          <Button asChild className="mt-4" variant="outline">
            <NavLink to="/">
              <ArrowLeft data-icon="inline-start" />
              Back to home
            </NavLink>
          </Button>
        </div>
      </main>
    );
  }

  if (isProcessingNotebook) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-3xl items-center justify-center p-6">
        <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-3xl border bg-card px-8 py-12 text-center shadow-soft">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
            <Loader2 className="size-6 animate-spin" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold tracking-tight">
              Processing {notebook.name}
            </p>
            <p className="text-sm text-muted-foreground">
              Your notebook is being processed. Please wait.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
            <Clock3 className="size-3.5" />
            Status: {notebook.status}
          </div>
        </div>
      </main>
    );
  }

  if (isFailedNotebook) {
    return (
      <main className="mx-auto flex min-h-full w-full max-w-3xl items-center justify-center p-6">
        <div className="flex w-full max-w-xl flex-col items-center gap-5 rounded-3xl border bg-card px-8 py-12 text-center shadow-soft">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <CircleAlert className="size-6" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-semibold tracking-tight">
              Notebook processing failed
            </p>
            <p className="text-sm text-muted-foreground">
              {notebook.errorMessage ||
                "We could not process these files. You can go back and try creating the notebook again."}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              asChild
              className="bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90"
            >
              <NavLink to="/notebooks/new" state={{ draftName: notebook.name }}>
                Try again
              </NavLink>
            </Button>
            <Button asChild variant="outline">
              <NavLink to="/">Back to notebooks</NavLink>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You&apos;ll need to upload the source files again for a new attempt.
          </p>
        </div>
      </main>
    );
  }

  if (!isChatView) {
    return (
      <NotebookOverview
        notebook={notebook}
        conversations={conversations}
        onCreateConversation={handleCreateConversation}
        isReadyToChat={isReadyToChat}
        sending={sending}
      />
    );
  }

  // ===== Chat view =====
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b bg-background/80 px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              asChild
              variant="ghost"
              size="icon-sm"
              aria-label="Back to notebook"
            >
              <NavLink to={`/notebooks/${notebook.id}`}>
                <ArrowLeft />
              </NavLink>
            </Button>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">
                {conversationTitle}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {notebook.name} · {notebook.sourceFiles.length} sources
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowCitations((c) => !c)}
            >
              <Quote data-icon="inline-start" />
              {showCitations ? "Hide citations" : "Show citations"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCreateConversation}
              disabled={sending || !isReadyToChat}
            >
              <MessageSquarePlus data-icon="inline-start" />
              New chat
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-4 py-6 sm:px-6"
      >
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
          {!isReadyToChat ? (
            <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground shadow-soft">
              This notebook is still {notebook.status}. Chat will be available
              once processing finishes.
            </div>
          ) : null}

          {messagesLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border bg-card px-5 py-4 text-sm text-muted-foreground shadow-soft">
              <Loader2 className="size-4 animate-spin" />
              Loading chat…
            </div>
          ) : null}

          {!messagesLoading && messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed bg-card/40 px-6 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
                <Sparkles className="size-5" />
              </div>
              <div>
                <p className="text-base font-semibold tracking-tight">
                  Ask anything about this notebook
                </p>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Try “Summarize the key findings” or “What are the main
                  arguments in chapter 2?”
                </p>
              </div>
            </div>
          ) : null}

          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              showCitations={showCitations}
            />
          ))}

          <div ref={messagesEndRef} className="h-1 shrink-0" />
        </div>
      </div>

      {isReadyToChat ? (
        <div className="border-t bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
          <ChatComposer
            key={`${notebookId}:${requestedConversationId ?? "draft"}:${isDraftConversation ? "new" : "existing"}`}
            currentConversationId={currentConversationId}
            onSend={sendMessage}
            sending={sending}
            textareaRef={textareaRef}
          />
          <p className="mx-auto mt-2 max-w-4xl px-1 text-[11px] text-muted-foreground">
            Enter to send · Shift+Enter for newline
          </p>
        </div>
      ) : null}
    </div>
  );
}

function ChatComposer({ currentConversationId, onSend, sending, textareaRef }) {
  const [prompt, setPrompt] = useState("");

  useAutosizeTextarea(textareaRef, prompt);

  async function submitPrompt() {
    const nextPrompt = prompt.trim();

    if (!nextPrompt) {
      return;
    }

    setPrompt("");
    await onSend(nextPrompt, currentConversationId);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    await submitPrompt();
  }

  async function handlePromptKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await submitPrompt();
    }
  }

  return (
    <form
      className="mx-auto flex w-full max-w-4xl items-end gap-2 rounded-2xl border bg-card px-3 py-2 shadow-soft focus-within:border-primary/50 focus-within:ring-3 focus-within:ring-primary/15"
      onSubmit={handleSubmit}
    >
      <Textarea
        ref={textareaRef}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handlePromptKeyDown}
        placeholder="Ask about this notebook…"
        rows={1}
        className="max-h-55 min-h-9 flex-1 resize-none overflow-y-auto border-0 bg-transparent! px-1.5 py-2 text-[15px] leading-6 shadow-none focus-visible:ring-0 dark:bg-transparent!"
      />
      <Button
        type="submit"
        disabled={sending || !prompt.trim()}
        aria-label="Send message"
        className="size-9 shrink-0 rounded-xl bg-gradient-primary p-0 text-primary-foreground shadow-elegant hover:opacity-90 disabled:opacity-40"
      >
        {sending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Send className="size-4" />
        )}
      </Button>
    </form>
  );
}

export { NotebookPage };
