import { useMemo } from "react";
import {
  ArrowRight,
  FilePlus2,
  FileText,
  Loader2,
  MessagesSquare,
  Sparkles,
} from "lucide-react";
import { NavLink } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/lib/page-title";

function HomePage({ notebooks }) {
  usePageTitle("Home");

  const stats = useMemo(() => {
    const ready = notebooks.filter((n) => n.status === "ready").length;
    const sources = notebooks.reduce(
      (sum, n) => sum + (n.sourceFiles?.length ?? 0),
      0,
    );
    const chats = notebooks.reduce(
      (sum, n) => sum + (n.conversations?.length ?? 0),
      0,
    );
    return { ready, sources, chats };
  }, [notebooks]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-8 sm:px-6 lg:py-12">
      <section className="relative overflow-hidden rounded-3xl border bg-card p-6 sm:p-10 shadow-soft">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(40% 60% at 100% 0%, color-mix(in oklab, var(--primary-glow) 30%, transparent), transparent 60%), radial-gradient(50% 60% at 0% 100%, color-mix(in oklab, var(--primary) 18%, transparent), transparent 60%)",
          }}
        />

        <div className="flex flex-col gap-6">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-background/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <Sparkles className="size-3.5 text-primary" />
            Your research workspace
          </div>

          <div className="flex flex-col gap-3">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Welcome back.
            </h1>
            <p className="max-w-xl text-base text-muted-foreground">
              Create a new notebook from your sources or jump into one of your
              existing libraries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              asChild
              className="h-11 bg-gradient-primary px-5 text-base font-medium text-primary-foreground shadow-elegant hover:opacity-90"
            >
              <NavLink to="/notebooks/new">
                <FilePlus2 data-icon="inline-start" />
                Create notebook
              </NavLink>
            </Button>
          </div>

          <div className="mt-2 grid grid-cols-3 gap-3 sm:max-w-md">
            <StatCard label="Notebooks" value={stats.ready} />
            <StatCard label="Sources" value={stats.sources} />
            <StatCard label="Chats" value={stats.chats} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">
              Your notebooks
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {notebooks.length === 0
                ? "Nothing here yet."
                : `${notebooks.length} total · ${stats.ready} ready`}
            </p>
          </div>
        </div>

        {notebooks.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed bg-card/40 px-6 py-16 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <FilePlus2 className="size-6" />
            </div>
            <div>
              <p className="text-base font-medium">No notebooks yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Upload your first PDFs or images to start asking questions
                across your sources.
              </p>
            </div>
            <Button
              asChild
              className="h-10 bg-gradient-primary text-primary-foreground shadow-elegant hover:opacity-90"
            >
              <NavLink to="/notebooks/new">
                <FilePlus2 data-icon="inline-start" />
                Create your first notebook
              </NavLink>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {notebooks.map((notebook) => (
              <NotebookCard key={notebook.id} notebook={notebook} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border bg-background/70 px-3 py-3 backdrop-blur">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function NotebookCard({ notebook }) {
  const isReady = notebook.status === "ready";
  const sourceCount = notebook.sourceFiles?.length ?? 0;
  const chatCount = notebook.conversations?.length ?? 0;

  const card = (
    <div
      className={
        "group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border bg-card p-5 shadow-soft transition-all " +
        (isReady ? "hover:-translate-y-0.5 hover:shadow-elegant" : "opacity-80")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-primary text-primary-foreground shadow-elegant">
          <FileText className="size-5" />
        </div>
        <Badge
          variant={isReady ? "secondary" : "outline"}
          className="capitalize"
        >
          {isReady ? null : (
            <Loader2 className="size-3 animate-spin" data-icon="inline-start" />
          )}
          {notebook.status}
        </Badge>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold tracking-tight">
          {notebook.name}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
          {isReady
            ? `${sourceCount} ${sourceCount === 1 ? "source" : "sources"} · ${chatCount} ${chatCount === 1 ? "chat" : "chats"}`
            : "Indexing your sources — this usually takes a moment."}
        </p>
      </div>

      <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <MessagesSquare className="size-3.5" />
          {chatCount} {chatCount === 1 ? "chat" : "chats"}
        </span>
        {isReady ? (
          <span className="inline-flex items-center gap-1 font-medium text-foreground/80 transition group-hover:text-primary">
            Open <ArrowRight className="size-3.5" />
          </span>
        ) : null}
      </div>
    </div>
  );

  if (!isReady) {
    return card;
  }

  return (
    <NavLink to={`/notebooks/${notebook.id}`} className="block">
      {card}
    </NavLink>
  );
}

export { HomePage };
