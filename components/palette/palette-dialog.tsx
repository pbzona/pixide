"use client";

import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  FileUp,
  ImageIcon,
  Plus,
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
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEFAULT_PALETTES,
  appendSwatch,
  moveSwatch,
  removeSwatch,
  replaceSwatch,
  type Palette,
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
              <div className="grid gap-2 p-5 sm:grid-cols-2">
                {palettes.map((palette) => (
                  <button
                    type="button"
                    key={`${palette.builtIn ? "built-in" : "custom"}-${palette.id}`}
                    className={cn(
                      "group border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      activePalette.id === palette.id &&
                        activePalette.builtIn === palette.builtIn &&
                        "border-foreground",
                    )}
                    aria-pressed={
                      activePalette.id === palette.id &&
                      activePalette.builtIn === palette.builtIn
                    }
                    onClick={() => {
                      setSelectedSwatch(null);
                      setEditColor("#ef6a47");
                      setError(null);
                      onSelect(palette);
                      onOpenChange(false);
                    }}
                  >
                    <span className="mb-3 flex items-center justify-between text-sm font-medium">
                      {palette.name}
                      {activePalette.id === palette.id &&
                      activePalette.builtIn === palette.builtIn ? (
                        <Check className="size-4" />
                      ) : null}
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
                    </span>
                  </button>
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
                    disabled={Boolean(activePalette.builtIn)}
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
                      onChange({ ...activePalette, name: event.target.value, builtIn: false })
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
