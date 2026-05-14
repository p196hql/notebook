import { useMemo, useState } from "react";
import {
  ChevronDown,
  FilePlus2,
  Loader2,
  LogOut,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Settings,
  Trash2,
  User,
} from "lucide-react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import { toast } from "sonner";

import { ModeToggle } from "@/components/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useNotebooks } from "@/hooks/use-notebooks";
import { cn } from "@/lib/utils";

function getInitials(text) {
  return (text || "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function AppShell() {
  const { authLoading, onLogout, user } = useAuth();
  const {
    notebooks,
    onDeleteConversation,
    onDeleteNotebook,
    onRenameConversation,
    onRenameNotebook,
  } = useNotebooks();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [pendingNotebookId, setPendingNotebookId] = useState("");
  const [pendingConversationId, setPendingConversationId] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [renameState, setRenameState] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const activeNotebookId = useMemo(() => {
    const match = location.pathname.match(/^\/notebooks\/([^/]+)/);
    return match?.[1] ?? null;
  }, [location.pathname]);

  const activeConversationId = searchParams.get("chat");
  const [expandedNotebookIds, setExpandedNotebookIds] = useState({});

  const activeNotebook = useMemo(
    () => notebooks.find((n) => n.id === activeNotebookId) ?? null,
    [notebooks, activeNotebookId],
  );

  function toggleNotebook(notebookId) {
    setExpandedNotebookIds((current) => ({
      ...current,
      [notebookId]: !current[notebookId],
    }));
  }

  function handleNewChat(notebookId) {
    setExpandedNotebookIds((current) => ({ ...current, [notebookId]: true }));
    setMobileSidebarOpen(false);
    navigate(`/notebooks/${notebookId}?new=1`);
  }

  async function handleDeleteNotebookAction(notebookId) {
    setPendingNotebookId(notebookId);
    try {
      const deleted = await onDeleteNotebook?.(notebookId);
      if (!deleted) return;
      if (activeNotebookId === notebookId) navigate("/", { replace: true });
    } finally {
      setPendingNotebookId("");
    }
  }

  async function handleDeleteConversationAction(notebookId, conversationId) {
    setPendingConversationId(conversationId);
    try {
      const result = await onDeleteConversation?.(notebookId, conversationId);
      if (!result) return;
      if (
        activeNotebookId === notebookId &&
        activeConversationId === conversationId
      ) {
        if (result.nextConversationId) {
          navigate(
            `/notebooks/${notebookId}?chat=${result.nextConversationId}`,
            { replace: true },
          );
        } else {
          navigate(`/notebooks/${notebookId}`, { replace: true });
        }
      }
    } finally {
      setPendingConversationId("");
    }
  }

  function openDeleteNotebookDialog(notebook) {
    setConfirmState({
      type: "notebook",
      notebookId: notebook.id,
      title: "Delete notebook?",
      description: `Delete "${notebook.name}" and all of its chats. This cannot be undone.`,
      actionLabel: "Delete notebook",
    });
  }


  function openDeleteConversationDialog(notebook, conversation) {
    setConfirmState({
      type: "conversation",
      notebookId: notebook.id,
      conversationId: conversation.id,
      title: "Delete chat?",
      description: `Delete "${conversation.title || "New chat"}". This cannot be undone.`,
      actionLabel: "Delete chat",
    });
  }

  function openRenameNotebookDialog(notebook) {
    setRenameState({
      type: "notebook",
      notebookId: notebook.id,
      currentName: notebook.name,
    });
    setRenameValue(notebook.name);
  }

  function openRenameConversationDialog(notebook, conversation) {
    setRenameState({
      type: "conversation",
      notebookId: notebook.id,
      conversationId: conversation.id,
      currentName: conversation.title || "New chat",
    });
    setRenameValue(conversation.title || "New chat");
  }

  async function handleConfirmAction() {
    if (!confirmState) return;
    if (confirmState.type === "notebook") {
      await handleDeleteNotebookAction(confirmState.notebookId);
    }
    if (confirmState.type === "conversation") {
      await handleDeleteConversationAction(
        confirmState.notebookId,
        confirmState.conversationId,
      );
    }
    setConfirmState(null);
  }

  async function handleRenameSubmit(event) {
    event.preventDefault();
    if (!renameState) return;
    const name = renameValue.trim();
    if (!name) {
      toast.error(
        renameState.type === "conversation"
          ? "Chat name is required."
          : "Notebook name is required.",
      );
      return;
    }
    try {
      if (renameState.type === "conversation") {
        setPendingConversationId(renameState.conversationId);
        const renamed = await onRenameConversation?.(
          renameState.notebookId,
          renameState.conversationId,
          name,
        );
        if (!renamed) return;
      } else {
        setPendingNotebookId(renameState.notebookId);
        const renamed = await onRenameNotebook?.(renameState.notebookId, name);
        if (!renamed) return;
      }
      setRenameState(null);
      setRenameValue("");
    } finally {
      setPendingNotebookId("");
      setPendingConversationId("");
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {mobileSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-30 bg-foreground/40 backdrop-blur-sm md:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground transition-[width,transform] duration-300 ease-out md:static md:translate-x-0",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full",
          sidebarCollapsed ? "w-17" : "w-72",
        )}
      >
        <div className="flex items-center justify-between gap-3 px-3 py-4">
          <NavLink to="/" className="flex min-w-0 items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background shadow-elegant">
              <img
                src="/logo_light.png"
                alt="Notebook AI"
                className="size-full object-cover dark:hidden"
              />
              <img
                src="/logo_dark.png"
                alt="Notebook AI"
                className="hidden size-full object-cover dark:block"
              />
            </div>
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">
                  Notebook AI
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  Research workspace
                </p>
              </div>
            ) : null}
          </NavLink>

          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            aria-label="Close sidebar"
            onClick={() => setMobileSidebarOpen(false)}
          >
            <PanelLeftClose />
          </Button>
        </div>

        <div className="px-3 pb-3">
          <Button
            asChild
            className={cn(
              "h-10 w-full bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90",
              sidebarCollapsed ? "px-0" : "",
            )}
          >
            <NavLink
              to="/notebooks/new"
              onClick={() => setMobileSidebarOpen(false)}
            >
              <FilePlus2
                data-icon={sidebarCollapsed ? undefined : "inline-start"}
              />
              {!sidebarCollapsed ? <span>New notebook</span> : null}
            </NavLink>
          </Button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-2 pb-2">
          {!sidebarCollapsed ? (
            <p className="px-3 pb-1.5 pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Library
            </p>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pr-1">
            {notebooks.map((notebook) => {
              const isReady = notebook.status === "ready";
              const isExpanded =
                expandedNotebookIds[notebook.id] ??
                activeNotebookId === notebook.id;
              const isNotebookSelected = activeNotebookId === notebook.id;
              const hasActiveConversationInNotebook =
                isNotebookSelected &&
                notebook.conversations?.some(
                  (conversation) => conversation.id === activeConversationId,
                );
              const isNotebookActive =
                isNotebookSelected && !hasActiveConversationInNotebook;
              const isNotebookContextual =
                hasActiveConversationInNotebook || (isExpanded && !isNotebookActive);
              const hasChats = (notebook.conversations?.length ?? 0) > 0;
              const isNotebookPending = pendingNotebookId === notebook.id;
              const initials = getInitials(notebook.name) || "NB";

              if (sidebarCollapsed) {
                return (
                  <button
                    key={notebook.id}
                    type="button"
                    title={notebook.name}
                    className={cn(
                      "mx-auto my-0.5 flex size-10 items-center justify-center rounded-xl text-xs font-semibold transition-colors",
                      isNotebookActive
                        ? "bg-gradient-primary text-primary-foreground shadow-elegant"
                        : "bg-sidebar-accent/60 text-sidebar-foreground hover:bg-sidebar-accent",
                    )}
                    onClick={() => {
                      if (!isReady) {
                        toast.message("This notebook is still processing.");
                        return;
                      }
                      navigate(`/notebooks/${notebook.id}`);
                      setMobileSidebarOpen(false);
                    }}
                  >
                    {initials}
                  </button>
                );
              }

              return (
                <div key={notebook.id} className="flex flex-col">
                  <div
                    className={cn(
                      "group/item flex items-center gap-1 rounded-lg pr-1 transition-colors",
                      isNotebookActive
                        ? "bg-sidebar-accent"
                        : isNotebookContextual
                          ? "bg-sidebar-accent/40"
                        : "hover:bg-sidebar-accent/60",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-2 text-left"
                      onClick={() => {
                        if (!isReady) {
                          toast.message("This notebook is still processing.");
                          return;
                        }
                        navigate(`/notebooks/${notebook.id}`);
                        setExpandedNotebookIds((current) => ({
                          ...current,
                          [notebook.id]: true,
                        }));
                        setMobileSidebarOpen(false);
                      }}
                    >
                      <div
                        className={cn(
                          "flex size-7 shrink-0 items-center justify-center rounded-lg text-[10px] font-semibold",
                          isNotebookActive
                            ? "bg-gradient-primary text-primary-foreground"
                            : isNotebookContextual
                              ? "bg-sidebar-accent/80 text-sidebar-foreground"
                            : "bg-sidebar-accent text-sidebar-accent-foreground",
                        )}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "truncate text-sm font-medium leading-tight",
                            isNotebookContextual && !isNotebookActive
                              ? "text-foreground/90"
                              : "",
                          )}
                        >
                          {notebook.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {isReady
                            ? `${notebook.conversations?.length ?? 0} chats`
                            : notebook.status}
                        </p>
                      </div>
                    </button>

                    {hasChats ? (
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        aria-label={
                          isExpanded ? "Collapse notebook" : "Expand notebook"
                        }
                        onClick={() => toggleNotebook(notebook.id)}
                      >
                        <ChevronDown
                          className={cn(
                            "transition-transform",
                            isExpanded ? "rotate-0" : "-rotate-90",
                          )}
                        />
                      </Button>
                    ) : null}

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Notebook actions"
                          className="opacity-0 transition group-hover/item:opacity-100 data-[state=open]:opacity-100"
                        >
                          {isNotebookPending ? (
                            <Loader2 className="animate-spin" />
                          ) : (
                            <MoreHorizontal />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuGroup>
                          <DropdownMenuItem
                            disabled={!isReady || isNotebookPending}
                            onClick={() => handleNewChat(notebook.id)}
                          >
                            <MessageSquarePlus data-icon="inline-start" />
                            New chat
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            disabled={isNotebookPending}
                            onClick={() => openRenameNotebookDialog(notebook)}
                          >
                            <Pencil data-icon="inline-start" />
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            disabled={isNotebookPending}
                            onClick={() => openDeleteNotebookDialog(notebook)}
                          >
                            <Trash2 data-icon="inline-start" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {isExpanded && hasChats ? (
                    <div
                      className={cn(
                        "ml-4 mt-0.5 flex flex-col gap-0.5 border-l pl-2",
                        hasActiveConversationInNotebook
                          ? "border-primary/30"
                          : "border-sidebar-border",
                      )}
                    >
                      {notebook.conversations.map((conversation) => {
                        const isConversationActive =
                          isNotebookActive &&
                          activeConversationId === conversation.id;
                        const isConversationPending =
                          pendingConversationId === conversation.id;

                        return (
                          <div
                            key={conversation.id}
                            className={cn(
                              "group/chat flex items-center gap-1 rounded-md pr-1 transition-colors",
                              isConversationActive
                                ? "bg-sidebar-accent text-sidebar-foreground"
                                : "hover:bg-sidebar-accent/60",
                            )}
                          >
                            <button
                              type="button"
                              className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[13px] text-muted-foreground hover:text-foreground"
                              onClick={() => {
                                navigate(
                                  `/notebooks/${notebook.id}?chat=${conversation.id}`,
                                );
                                setMobileSidebarOpen(false);
                              }}
                            >
                              <span
                                className={cn(
                                  "block truncate",
                                  isConversationActive
                                    ? "text-foreground"
                                    : "",
                                )}
                              >
                                {conversation.title || "New chat"}
                              </span>
                            </button>

                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  aria-label="Chat actions"
                                  disabled={isConversationPending}
                                  className="opacity-0 transition group-hover/chat:opacity-100 data-[state=open]:opacity-100"
                                >
                                  {isConversationPending ? (
                                    <Loader2 className="animate-spin" />
                                  ) : (
                                    <MoreHorizontal />
                                  )}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent
                                align="end"
                                className="min-w-40"
                              >
                                <DropdownMenuGroup>
                                  <DropdownMenuItem
                                    disabled={isConversationPending}
                                    onClick={() =>
                                      openRenameConversationDialog(
                                        notebook,
                                        conversation,
                                      )
                                    }
                                  >
                                    <Pencil data-icon="inline-start" />
                                    Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onClick={() =>
                                      openDeleteConversationDialog(
                                        notebook,
                                        conversation,
                                      )
                                    }
                                  >
                                    <Trash2 data-icon="inline-start" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}

            {notebooks.length === 0 && !sidebarCollapsed ? (
              <div className="mx-1 mt-2 rounded-xl border border-dashed bg-sidebar-accent/30 px-3 py-5 text-center text-xs text-muted-foreground">
                Create your first notebook to get started.
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-sidebar-border p-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent/80",
                  sidebarCollapsed ? "justify-center" : "",
                )}
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-semibold text-primary-foreground">
                  {getInitials(user?.fullName) || <User className="size-4" />}
                </div>
                {!sidebarCollapsed ? (
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">
                      {user?.fullName}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                ) : null}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              side={sidebarCollapsed ? "right" : "top"}
              className="min-w-52"
            >
              {!sidebarCollapsed ? null : (
                <>
                  <div className="px-2 py-1.5">
                    <p className="truncate text-sm font-medium">
                      {user?.fullName}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user?.email}
                    </p>
                  </div>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuGroup>
                <DropdownMenuItem onClick={() => toast.message("Coming soon")}>
                  <Settings data-icon="inline-start" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={onLogout}
                  disabled={authLoading}
                >
                  {authLoading ? (
                    <Loader2
                      className="animate-spin"
                      data-icon="inline-start"
                    />
                  ) : (
                    <LogOut data-icon="inline-start" />
                  )}
                  Log out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b bg-background/80 px-3 backdrop-blur-md sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              variant="ghost"
              size="icon-sm"
              className="md:hidden"
              aria-label="Open sidebar"
              onClick={() => setMobileSidebarOpen(true)}
            >
              <Menu />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden md:inline-flex"
              aria-label={
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
              onClick={() => setSidebarCollapsed((current) => !current)}
            >
              {sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            </Button>

            <div className="ml-1 min-w-0">
              {activeNotebook ? (
                <p className="truncate text-sm font-medium">
                  {activeNotebook.name}
                </p>
              ) : (
                <p className="truncate text-sm font-medium text-muted-foreground">
                  {location.pathname === "/notebooks/new"
                    ? "Create notebook"
                    : "Home"}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <ModeToggle />
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>

      <Dialog
        open={Boolean(confirmState)}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmState?.title ?? "Confirm action"}</DialogTitle>
            <DialogDescription>
              {confirmState?.description ?? ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmState(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={Boolean(pendingNotebookId || pendingConversationId)}
              onClick={handleConfirmAction}
            >
              {pendingNotebookId || pendingConversationId ? (
                <Loader2 className="animate-spin" data-icon="inline-start" />
              ) : (
                <Trash2 data-icon="inline-start" />
              )}
              {confirmState?.actionLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(renameState)}
        onOpenChange={(open) => {
          if (!open) {
            setRenameState(null);
            setRenameValue("");
          }
        }}
      >
        <DialogContent>
          <form className="flex flex-col gap-4" onSubmit={handleRenameSubmit}>
            <DialogHeader>
              <DialogTitle>
                {renameState?.type === "conversation"
                  ? "Rename chat"
                  : "Rename notebook"}
              </DialogTitle>
              <DialogDescription>
                {renameState?.type === "conversation"
                  ? "Update the chat name shown in the sidebar."
                  : "Update the notebook name shown in the sidebar and chat header."}
              </DialogDescription>
            </DialogHeader>
            <Input
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              placeholder={
                renameState?.type === "conversation"
                  ? "Chat name"
                  : "Notebook name"
              }
              maxLength={120}
              autoFocus
              className="h-10"
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setRenameState(null);
                  setRenameValue("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  !renameValue.trim() ||
                  Boolean(
                    renameState?.type === "conversation"
                      ? pendingConversationId === renameState.conversationId
                      : renameState &&
                          pendingNotebookId === renameState.notebookId,
                  )
                }
              >
                {(renameState?.type === "conversation" &&
                  pendingConversationId === renameState.conversationId) ||
                (renameState?.type !== "conversation" &&
                  renameState &&
                  pendingNotebookId === renameState.notebookId) ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Pencil data-icon="inline-start" />
                )}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export { AppShell };
