"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  FileUp,
  ImageIcon,
  LoaderCircle,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_PALETTES,
  appendSwatch,
  moveSwatch,
  paletteIdentity,
  parsePaletteTownList,
  parsePaletteTownTags,
  removeSwatch,
  replaceSwatch,
  serializePaletteTownQuery,
  type Palette,
  type PaletteTownPagination,
  type PaletteTownSort,
  type PaletteTownTag,
} from "@/lib/palette";
import { cn } from "@/lib/utils";

type PaletteDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activePalette: Palette;
  customPalettes: readonly Palette[];
  onSelect: (palette: Palette) => void;
  onChange: (palette: Palette) => void;
  onCreate: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onImport: (file: File, colorCount: number) => Promise<void>;
}>;

const EMPTY_PAGINATION: PaletteTownPagination = {
  page: 1,
  pageSize: 12,
  totalItems: 0,
  totalPages: 0,
};

type PaletteCardProps = Readonly<{
  palette: Palette;
  active: boolean;
  onSelect: () => void;
}>;

function PaletteCard({ palette, active, onSelect }: PaletteCardProps) {
  return (
    <div
      className={cn(
        "group border transition-colors hover:bg-muted/60",
        active && "border-foreground",
      )}
    >
      <button
        type="button"
        className="block w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        aria-pressed={active}
        onClick={onSelect}
      >
        <span className="mb-3 flex items-center justify-between text-sm font-medium">
          <span className="truncate">{palette.name}</span>
          {active ? <Check className="size-4 shrink-0" /> : null}
        </span>
        <span className="flex h-8 overflow-hidden border border-white/10">
          {palette.colors.map((swatch) => (
            <span
              key={swatch.id}
              className="h-full min-w-2 flex-1"
              style={{ backgroundColor: swatch.hex }}
            />
          ))}
        </span>
        <span className="mt-2 block font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {palette.colors.length} colors
          {palette.tags?.length ? ` · ${palette.tags.slice(0, 2).join(" · ")}` : ""}
        </span>
      </button>
      {palette.author || palette.attribution?.license ? (
        <div className="flex min-w-0 gap-1 px-3 pb-3 text-[10px] text-muted-foreground">
          {palette.author?.url ? (
            <a
              href={palette.author.url}
              target="_blank"
              rel="noreferrer"
              className="truncate underline-offset-2 hover:underline"
            >
              By {palette.author.name}
            </a>
          ) : palette.author ? (
            <span className="truncate">By {palette.author.name}</span>
          ) : null}
          {palette.attribution?.license ? <span>·</span> : null}
          {palette.attribution?.url ? (
            <a
              href={palette.attribution.url}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 underline-offset-2 hover:underline"
            >
              {palette.attribution.license}
            </a>
          ) : palette.attribution?.license ? (
            <span>{palette.attribution.license}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function PaletteDialog({
  open,
  onOpenChange,
  activePalette,
  customPalettes,
  onSelect,
  onChange,
  onCreate,
  onDuplicate,
  onDelete,
  onImport,
}: PaletteDialogProps) {
  const importInputRef = useRef<HTMLInputElement>(null);
  const [editColor, setEditColor] = useState("#ef6a47");
  const [selectedSwatch, setSelectedSwatch] = useState<number | null>(null);
  const [colorCount, setColorCount] = useState(16);
  const [importing, setImporting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remotePalettes, setRemotePalettes] = useState<readonly Palette[]>([]);
  const [remotePagination, setRemotePagination] =
    useState<PaletteTownPagination>(EMPTY_PAGINATION);
  const [remoteTags, setRemoteTags] = useState<readonly PaletteTownTag[]>([]);
  const [remoteQuery, setRemoteQuery] = useState("");
  const [remoteTag, setRemoteTag] = useState("all");
  const [remoteSort, setRemoteSort] = useState<PaletteTownSort>("popularity");
  const [remotePage, setRemotePage] = useState(1);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);
  const [remoteRequest, setRemoteRequest] = useState(0);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => {
        setRemoteLoading(true);
        setRemoteError(null);
        const params = serializePaletteTownQuery({
          ...(remoteQuery.trim() ? { q: remoteQuery.trim() } : {}),
          ...(remoteTag !== "all" ? { tags: [remoteTag] } : {}),
          sort: remoteSort,
          page: remotePage,
          pageSize: 12,
        });
        void fetch(`/api/palettes?${params}`, { signal: controller.signal })
          .then(async (response) => {
            const body: unknown = await response.json();
            if (!response.ok) {
              throw new Error(
                typeof body === "object" &&
                body !== null &&
                "error" in body &&
                typeof body.error === "string"
                  ? body.error
                  : "Palette Town is unavailable.",
              );
            }
            const parsed = parsePaletteTownList(body);
            if (!parsed.ok) throw new Error(parsed.error);
            setRemotePalettes(parsed.value.palettes);
            setRemotePagination(parsed.value.pagination);
          })
          .catch((fetchError: unknown) => {
            if (controller.signal.aborted) return;
            setRemoteError(
              fetchError instanceof Error ? fetchError.message : "Palette Town is unavailable.",
            );
          })
          .finally(() => {
            if (!controller.signal.aborted) setRemoteLoading(false);
          });
      },
      remoteQuery ? 250 : 0,
    );
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, remotePage, remoteQuery, remoteRequest, remoteSort, remoteTag]);

  useEffect(() => {
    if (!open || remoteTags.length > 0) return;
    const controller = new AbortController();
    void fetch("/api/palette-tags", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return;
        const parsed = parsePaletteTownTags(await response.json());
        if (parsed.ok) setRemoteTags(parsed.value);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [open, remoteTags.length]);

  const updateSelected = () => {
    if (selectedSwatch === null) {
      const result = appendSwatch(activePalette, editColor);
      if (result.ok) onChange(result.value);
      else setError(result.error);
      return;
    }
    const result = replaceSwatch(activePalette, selectedSwatch, editColor);
    if (result.ok) onChange(result.value);
    else setError(result.error);
  };

  const palettes = [...DEFAULT_PALETTES, ...customPalettes];

  const choosePalette = (palette: Palette) => {
    setSelectedSwatch(null);
    setEditColor("#ef6a47");
    setError(null);
    onSelect(palette);
    onOpenChange(false);
  };

  const importFile = async (file: File) => {
    if (importing) return;
    setImporting(true);
    setError(null);
    try {
      await onImport(file, colorCount);
      setSelectedSwatch(null);
      setEditColor("#ef6a47");
      onOpenChange(false);
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "Palette import failed.",
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88svh] w-[calc(100%-1.5rem)] max-w-2xl overflow-hidden rounded-none p-0 sm:max-w-2xl">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>Palette workshop</DialogTitle>
          <DialogDescription>Choose, import, or tune the colors used by every pixel.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="library" className="min-h-0 gap-0">
          <TabsList variant="line" className="mx-5 mt-2">
            <TabsTrigger value="library">Library</TabsTrigger>
            <TabsTrigger value="edit">Edit current</TabsTrigger>
            <TabsTrigger value="import">Import</TabsTrigger>
          </TabsList>

          <TabsContent value="library" className="min-h-0">
            <ScrollArea className="h-[52svh] max-h-[470px]">
              <div className="space-y-6 p-5">
                <section>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-sm font-medium">Your palettes</h3>
                    <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                      Built-in and local
                    </span>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {palettes.map((palette) => (
                      <PaletteCard
                        key={paletteIdentity(palette)}
                        palette={palette}
                        active={paletteIdentity(activePalette) === paletteIdentity(palette)}
                        onSelect={() => choosePalette(palette)}
                      />
                    ))}
                <button
                  type="button"
                  className="grid min-h-28 place-items-center border border-dashed text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
                  onClick={() => {
                    setSelectedSwatch(null);
                    setEditColor("#ef6a47");
                    setError(null);
                    onCreate();
                    onOpenChange(false);
                  }}
                >
                  <span className="flex items-center gap-2">
                    <Plus className="size-4" /> New palette
                  </span>
                </button>
                  </div>
                </section>

                <section className="border-t pt-5">
                  <div className="mb-3">
                    <h3 className="text-sm font-medium">Palette Town</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Community palettes load on demand and stay local only when edited.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                    <label className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
                      <Input
                        value={remoteQuery}
                        className="pl-8"
                        placeholder="Search palettes"
                        aria-label="Search Palette Town"
                        onChange={(event) => {
                          setRemoteQuery(event.target.value);
                          if (!event.target.value.trim() && remoteSort === "relevance") {
                            setRemoteSort("popularity");
                          }
                          setRemotePage(1);
                        }}
                      />
                    </label>
                    <Select
                      value={remoteTag}
                      onValueChange={(value: string) => {
                        setRemoteTag(value);
                        setRemotePage(1);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-36" aria-label="Filter by tag">
                        <SelectValue placeholder="All tags" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tags</SelectItem>
                        {remoteTags.map((tag) => (
                          <SelectItem key={tag.name} value={tag.name}>
                            {tag.name} ({tag.paletteCount})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={remoteSort}
                      onValueChange={(value: string) => {
                        setRemoteSort(value as PaletteTownSort);
                        setRemotePage(1);
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-32" aria-label="Sort palettes">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {remoteQuery.trim() ? (
                          <SelectItem value="relevance">Relevance</SelectItem>
                        ) : null}
                        <SelectItem value="popularity">Popular</SelectItem>
                        <SelectItem value="recency">Recent</SelectItem>
                        <SelectItem value="name">Name</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {remoteError ? (
                    <div className="mt-3 border border-destructive/40 p-4 text-sm" role="alert">
                      <p>{remoteError}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        onClick={() => setRemoteRequest((request) => request + 1)}
                      >
                        Retry
                      </Button>
                    </div>
                  ) : remoteLoading && remotePalettes.length === 0 ? (
                    <div className="grid min-h-32 place-items-center text-sm text-muted-foreground">
                      <span className="flex items-center gap-2">
                        <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
                        Loading Palette Town
                      </span>
                    </div>
                  ) : remotePalettes.length === 0 ? (
                    <div className="grid min-h-32 place-items-center text-sm text-muted-foreground">
                      No palettes match these filters.
                    </div>
                  ) : (
                    <div className={cn("mt-3 grid gap-2 sm:grid-cols-2", remoteLoading && "opacity-60")}>
                      {remotePalettes.map((palette) => (
                        <PaletteCard
                          key={paletteIdentity(palette)}
                          palette={palette}
                          active={paletteIdentity(activePalette) === paletteIdentity(palette)}
                          onSelect={() => choosePalette(palette)}
                        />
                      ))}
                    </div>
                  )}

                  {remotePagination.totalPages > 1 ? (
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={remoteLoading || remotePage <= 1}
                        onClick={() => setRemotePage((page) => Math.max(1, page - 1))}
                      >
                        <ArrowLeft data-icon="inline-start" /> Previous
                      </Button>
                      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                        Page {remotePagination.page} of {remotePagination.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={remoteLoading || remotePage >= remotePagination.totalPages}
                        onClick={() => setRemotePage((page) => page + 1)}
                      >
                        Next <ArrowRight data-icon="inline-end" />
                      </Button>
                    </div>
                  ) : null}
                </section>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="edit" className="min-h-0">
            <ScrollArea className="h-[52svh] max-h-[470px]">
              <div className="space-y-6 p-5">
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={onDuplicate}>
                    <Copy data-icon="inline-start" /> Duplicate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    disabled={activePalette.source !== "local"}
                    onClick={onDelete}
                  >
                    <Trash2 data-icon="inline-start" /> Delete
                  </Button>
                </div>
                <label className="block">
                  <Label className="mb-2">Name</Label>
                  <Input
                    value={activePalette.name}
                    onChange={(event) =>
                      onChange({ ...activePalette, name: event.target.value, source: "local" })
                    }
                  />
                </label>

                <div>
                  <Label className="mb-2">Swatches</Label>
                  <div className="grid grid-cols-8 gap-2 sm:grid-cols-12">
                    {activePalette.colors.map((swatch) => (
                      <button
                        type="button"
                        key={swatch.id}
                        className={cn(
                          "aspect-square border border-white/15 outline-offset-2 focus-visible:outline-2 focus-visible:outline-ring",
                          selectedSwatch === swatch.id && "outline-2 outline-foreground",
                        )}
                        style={{ backgroundColor: swatch.hex }}
                        aria-label={`Edit ${swatch.hex}`}
                        aria-pressed={selectedSwatch === swatch.id}
                        onClick={() => {
                          setSelectedSwatch(swatch.id);
                          setEditColor(swatch.hex.slice(0, 7));
                          setError(null);
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      className="grid aspect-square place-items-center border border-dashed text-muted-foreground"
                      aria-label="Add a color"
                      onClick={() => setSelectedSwatch(null)}
                    >
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>

                <div className="border bg-muted/30 p-3">
                  <div className="flex items-end gap-2">
                    <label className="block">
                      <Label className="mb-2">Color</Label>
                      <input
                        type="color"
                        value={editColor.slice(0, 7)}
                        className="block size-8 cursor-pointer border bg-transparent p-0"
                        onChange={(event) => setEditColor(event.target.value)}
                      />
                    </label>
                    <label className="min-w-0 flex-1">
                      <span className="sr-only">Hex or CSS color</span>
                      <Input value={editColor} onChange={(event) => setEditColor(event.target.value)} />
                    </label>
                    <Button onClick={updateSelected}>
                      {selectedSwatch === null ? "Add" : "Update"}
                    </Button>
                  </div>
                  {selectedSwatch !== null ? (
                    <div className="mt-3 flex gap-1">
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onChange(moveSwatch(activePalette, selectedSwatch, -1))}
                      >
                        <ArrowLeft />
                        <span className="sr-only">Move color left</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="icon-sm"
                        onClick={() => onChange(moveSwatch(activePalette, selectedSwatch, 1))}
                      >
                        <ArrowRight />
                        <span className="sr-only">Move color right</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon-sm"
                        onClick={() => {
                          const result = removeSwatch(activePalette, selectedSwatch);
                          if (result.ok) {
                            onChange(result.value);
                            setSelectedSwatch(null);
                          } else setError(result.error);
                        }}
                      >
                        <Trash2 />
                        <span className="sr-only">Remove color</span>
                      </Button>
                    </div>
                  ) : null}
                  {error ? <p className="mt-3 text-xs text-destructive">{error}</p> : null}
                </div>
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="import" className="min-h-0">
            <div className="space-y-6 p-5">
              <div
                className={cn(
                  "border border-dashed p-6 text-center transition-colors",
                  dragActive && "border-[#ef6a47] bg-[#ef6a47]/8",
                )}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (event.dataTransfer.types.includes("Files")) setDragActive(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                  if (event.dataTransfer.types.includes("Files")) setDragActive(true);
                }}
                onDragLeave={(event) => {
                  const nextTarget = event.relatedTarget;
                  if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                    setDragActive(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragActive(false);
                  const file = event.dataTransfer.files[0];
                  if (file) void importFile(file);
                }}
              >
                <ImageIcon className="mx-auto mb-3 size-6 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {dragActive ? "Drop to import palette" : "Drop an image, JSON, or text palette"}
                </p>
                <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  JSON should be an array. Text files use one CSS color per line. Images import exact swatches or extract a palette automatically.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={importing}
                  onClick={() => importInputRef.current?.click()}
                >
                  <FileUp data-icon="inline-start" />
                  {importing ? "Reading…" : "Choose palette file"}
                </Button>
                <input
                  ref={importInputRef}
                  type="file"
                  className="sr-only"
                  accept="image/png,image/jpeg,image/webp,.json,.txt,.hex,.palette"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    event.target.value = "";
                    void importFile(file);
                  }}
                />
              </div>
              <label className="block">
                <span className="mb-2 flex justify-between text-xs">
                  <span>Colors extracted from photos</span>
                  <span className="font-mono text-muted-foreground">{colorCount}</span>
                </span>
                <Slider
                  aria-label="Colors extracted from photos"
                  min={4}
                  max={32}
                  step={1}
                  value={[colorCount]}
                  onValueChange={([value]: number[]) => setColorCount(value)}
                />
              </label>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
