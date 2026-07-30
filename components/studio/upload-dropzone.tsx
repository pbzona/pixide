"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { BookOpenText, ImagePlus, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type UploadDropzoneProps = Readonly<{
  onFile: (file: File) => void;
  error?: string | null;
  compact?: boolean;
  disabled?: boolean;
}>;

export function UploadDropzone({
  onFile,
  error,
  compact = false,
  disabled = false,
}: UploadDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const acceptFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onFile(file);
  };

  if (compact) {
    return (
      <>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          disabled={disabled}
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        >
          <ImagePlus data-icon="inline-start" />
          Replace image
        </Button>
      </>
    );
  }

  return (
    <main className="flex min-h-svh items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-3xl">
        <div className="mb-10 flex items-center justify-between gap-4 px-1">
          <div className="flex items-center gap-3">
            <div className="grid size-7 grid-cols-2 gap-px bg-foreground p-px" aria-hidden="true">
              <span className="bg-background" />
              <span className="bg-[#ef6a47]" />
              <span className="bg-[#ef6a47]" />
              <span className="bg-background" />
            </div>
            <span className="text-sm font-semibold tracking-[-0.02em]">PIXIDE</span>
          </div>
          <Button asChild variant="ghost" size="sm" className="text-muted-foreground">
            <Link href="/learn">
              <BookOpenText data-icon="inline-start" />
              <span className="hidden sm:inline">How pixelation works</span>
              <span className="sm:hidden">Learn</span>
            </Link>
          </Button>
        </div>

        <button
          type="button"
          disabled={disabled}
          className={cn(
            "group relative flex min-h-[420px] w-full flex-col items-center justify-center overflow-hidden border border-dashed border-foreground/25 bg-card px-8 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragging && "border-[#ef6a47] bg-[#ef6a47]/5",
          )}
          onClick={() => inputRef.current?.click()}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            acceptFiles(event.dataTransfer.files);
          }}
        >
          <span className="mb-8 grid size-16 place-items-center border border-foreground/15 bg-background shadow-[4px_4px_0_0_var(--foreground)] transition-transform group-hover:-translate-y-1">
            <ImagePlus className="size-6" strokeWidth={1.5} />
          </span>
          <span className="text-balance text-3xl font-medium tracking-[-0.04em] sm:text-4xl">
            Turn an image into pixels.
          </span>
          <span className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Drop a PNG, JPEG, or WebP here, or click to choose one.
          </span>
          <span className="mt-8 inline-flex items-center gap-2 text-xs text-muted-foreground">
            <LockKeyhole className="size-3.5" />
            Your image never leaves this browser
          </span>
          {error ? (
            <span className="mt-5 max-w-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </span>
          ) : null}
        </button>
        <input
          ref={inputRef}
          className="sr-only"
          type="file"
          disabled={disabled}
          accept="image/png,image/jpeg,image/webp,image/gif"
          onChange={(event) => {
            acceptFiles(event.target.files);
            event.currentTarget.value = "";
          }}
        />
      </div>
    </main>
  );
}
