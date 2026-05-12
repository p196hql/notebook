import { NotebookPen, Sparkles } from "lucide-react";

import { ModeToggle } from "@/components/mode-toggle";

function AuthLayout({ title, description, children, footer }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(60% 50% at 80% 0%, color-mix(in oklab, var(--primary-glow) 35%, transparent), transparent 70%), radial-gradient(50% 60% at 0% 100%, color-mix(in oklab, var(--primary) 25%, transparent), transparent 70%)",
        }}
      />

      <div className="absolute right-4 top-4 z-10">
        <ModeToggle />
      </div>

      <div className="mx-auto grid min-h-screen w-full max-w-6xl grid-cols-1 items-center gap-8 px-4 py-10 lg:grid-cols-2 lg:gap-16 lg:px-8">
        <section className="hidden flex-col justify-between gap-10 lg:flex">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <NotebookPen className="size-5" />
            </div>
            <div>
              <p className="text-base font-semibold tracking-tight">
                Notebook AI
              </p>
              <p className="text-xs text-muted-foreground">
                Research workspace
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <Sparkles className="size-3.5 text-primary" />
              Chat with your sources
            </div>
            <h2 className="text-4xl font-semibold leading-tight tracking-tight">
              A calmer way to{" "}
              <span className="text-gradient">read, search and reason</span>{" "}
              across your documents.
            </h2>
            <p className="max-w-md text-base leading-relaxed text-muted-foreground">
              Upload PDFs and images, ask anything, and get cited answers from
              your own library. Built for focused, deep work.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm">
            {[
              { k: "Cited", v: "Answers" },
              { k: "Private", v: "Notebooks" },
              { k: "Fast", v: "Indexing" },
            ].map((item) => (
              <div
                key={item.k}
                className="rounded-xl border bg-card/60 px-3 py-3 backdrop-blur"
              >
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {item.k}
                </p>
                <p className="mt-1 font-medium">{item.v}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex w-full flex-col items-center lg:items-start">
          <div className="flex items-center gap-3 lg:hidden">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <NotebookPen className="size-5" />
            </div>
            <p className="text-base font-semibold tracking-tight">
              Notebook AI
            </p>
          </div>

          <div className="mt-8 w-full max-w-md rounded-2xl border bg-card p-7 shadow-soft lg:mt-0">
            <div className="mb-6 flex flex-col gap-1.5">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex flex-col gap-5">
              {children}
              {footer ? (
                <div className="border-t pt-5 text-center">{footer}</div>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export { AuthLayout };
