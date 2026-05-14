import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  FileImage,
  FileText,
  Loader2,
  Sparkles,
  TriangleAlert,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useNotebooks } from "@/hooks/use-notebooks";
import { usePageTitle } from "@/lib/page-title";

function formatFileSize(size) {
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function CreateNotebookPage() {
  usePageTitle("Create notebook");

  const location = useLocation();
  const navigate = useNavigate();
  const { creatingNotebook, onCreateNotebook } = useNotebooks();
  const [name, setName] = useState(location.state?.draftName ?? "");
  const [files, setFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const filesRef = useRef([]);
  const fileInputRef = useRef(null);

  useEffect(() => {
    filesRef.current = files;
  }, [files]);

  useEffect(() => {
    return () => {
      filesRef.current.forEach((file) => {
        if (file.previewUrl) {
          URL.revokeObjectURL(file.previewUrl);
        }
      });
    };
  }, []);

  function addFiles(fileList) {
    setSubmitError("");
    const accepted = Array.from(fileList ?? []).filter(
      (file) => file.type === "application/pdf" || file.type.startsWith("image/"),
    );
    const rejected = (fileList?.length ?? 0) - accepted.length;
    if (rejected > 0) {
      toast.error(`${rejected} file(s) skipped — PDFs and images only.`);
    }

    const next = accepted.map((file) => ({
      id: crypto.randomUUID(),
      file,
      previewUrl: file.type.startsWith("image/")
        ? URL.createObjectURL(file)
        : "",
    }));

    setFiles((current) => [...current, ...next]);
  }

  function handleFilesChange(event) {
    addFiles(event.target.files);
    event.target.value = "";
  }

  function removeFile(id) {
    setFiles((current) => {
      const target = current.find((file) => file.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return current.filter((file) => file.id !== id);
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitError("");

    if (!name.trim()) {
      const message = "Notebook name is required.";
      setSubmitError(message);
      toast.error(message);
      return;
    }

    if (files.length === 0) {
      const message = "Select at least one file.";
      setSubmitError(message);
      toast.error(message);
      return;
    }

    const result = await onCreateNotebook({
      name,
      files: files.map((item) => item.file),
    });

    if (result?.notebook) {
      navigate(`/notebooks/${result.notebook.id}`);
      return;
    }

    setSubmitError(
      result?.error?.message ??
        "Notebook creation failed. Review the details and try again.",
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 lg:py-12">
      <div className="flex flex-col gap-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
        >
          <NavLink to="/">
            <ArrowLeft data-icon="inline-start" />
            Back to notebooks
          </NavLink>
        </Button>

        <div className="flex flex-col gap-2">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="size-3.5 text-primary" />
            New notebook
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Create a notebook
          </h1>
          <p className="text-sm text-muted-foreground">
            Give it a name and add the source files you want to chat with.
          </p>
        </div>
      </div>

      <form
        className="flex flex-col gap-6 rounded-2xl border bg-card p-6 shadow-soft sm:p-8"
        onSubmit={handleSubmit}
      >
        {submitError ? (
          <Alert variant="destructive">
            <TriangleAlert className="size-4" />
            <AlertTitle>Could not create notebook</AlertTitle>
            <AlertDescription>{submitError}</AlertDescription>
          </Alert>
        ) : null}

        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="notebook-name">Notebook name</FieldLabel>
            <FieldContent>
              <Input
                id="notebook-name"
                type="text"
                placeholder="e.g. Quarterly research"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (submitError) setSubmitError("");
                }}
                className="h-11"
              />
            </FieldContent>
          </Field>
        </FieldGroup>

        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Sources</p>
          <label
            htmlFor="notebook-files"
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              addFiles(e.dataTransfer.files);
            }}
            className={
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors " +
              (isDragging
                ? "border-primary bg-primary/5"
                : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50")
            }
          >
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-primary text-primary-foreground shadow-elegant">
              <UploadCloud className="size-6" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Drop files here or click to browse
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                PDFs and images (PNG, JPG)
              </p>
            </div>
            <Input
              ref={fileInputRef}
              id="notebook-files"
              type="file"
              accept=".pdf,image/*"
              multiple
              onChange={handleFilesChange}
              className="sr-only"
            />
          </label>

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <FileText className="size-3.5" /> PDF documents
            </span>
            <span className="inline-flex items-center gap-1.5">
              <FileImage className="size-3.5" /> Image files
            </span>
          </div>
        </div>

        {files.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium">
              Selected files{" "}
              <span className="text-muted-foreground">({files.length})</span>
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {files.map(({ id, file, previewUrl }) => (
                <div
                  key={id}
                  className="flex items-center gap-3 rounded-xl border bg-background p-2.5"
                >
                  {previewUrl ? (
                    <img
                      src={previewUrl}
                      alt={file.name}
                      className="size-12 rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
                      <FileText className="size-5 text-muted-foreground" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.type.startsWith("image/") ? "Image" : "PDF"} ·{" "}
                      {formatFileSize(file.size)}
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${file.name}`}
                    onClick={() => removeFile(id)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-3 border-t pt-5">
          <Button
            type="button"
            variant="ghost"
            asChild
            disabled={creatingNotebook}
          >
            <NavLink to="/">Cancel</NavLink>
          </Button>
          <Button
            type="submit"
            disabled={creatingNotebook}
            className="h-11 bg-gradient-primary px-5 text-base font-medium text-primary-foreground shadow-elegant hover:opacity-90"
          >
            {creatingNotebook ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <UploadCloud data-icon="inline-start" />
            )}
            Create notebook
          </Button>
        </div>
      </form>
    </main>
  );
}

export { CreateNotebookPage };
