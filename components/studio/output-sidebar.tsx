"use client";

import { Fragment, useState } from "react";
import {
  CircleSlash2,
  Eye,
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  Unlink2,
} from "lucide-react";

import { PaletteAdjustments } from "@/components/palette/palette-adjustments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { PaletteAdjustments as PaletteAdjustmentsValue } from "@/lib/color";
import {
  insertMidpointSwatch,
  midpointColor,
  nextSwatchId,
  removeSwatch,
  replaceSwatch,
  type Palette,
} from "@/lib/palette";
import { cn } from "@/lib/utils";

type OutputSidebarProps = Readonly<{
  gridWidth: number;
  gridHeight: number;
  aspectLocked: boolean;
  inputVersion: number;
  palette: Palette;
  paletteAdjustments: PaletteAdjustmentsValue;
  excludedColorIds: ReadonlySet<number>;
  isolatedColorIds: ReadonlySet<number>;
  processing: boolean;
  onGridChange: (axis: "width" | "height", value: number) => void;
  onGridScale: (factor: 0.5 | 2) => void;
  onAspectLockedChange: (locked: boolean) => void;
  onPaletteChange: (palette: Palette) => void;
  onOpenPalette: () => void;
  onToggleExcludedColor: (colorId: number) => void;
  onToggleIsolatedColor: (colorId: number) => void;
  onClearIsolation: () => void;
  onPaletteAdjustmentsChange: (adjustments: PaletteAdjustmentsValue) => void;
  onRerun: () => void;
}>;

export function OutputSidebar({
  gridWidth,
  gridHeight,
  aspectLocked,
  inputVersion,
  palette,
  paletteAdjustments,
  excludedColorIds,
  isolatedColorIds,
  processing,
  onGridChange,
  onGridScale,
  onAspectLockedChange,
  onPaletteChange,
  onOpenPalette,
  onToggleExcludedColor,
  onToggleIsolatedColor,
  onClearIsolation,
  onPaletteAdjustmentsChange,
  onRerun,
}: OutputSidebarProps) {
  const [selectedSwatch, setSelectedSwatch] = useState<number | null>(null);
  const [editColor, setEditColor] = useState("#ef6a47");
  const [error, setError] = useState<string | null>(null);
  const selectedColor = palette.colors.find((swatch) => swatch.id === selectedSwatch);
  const matchingColorCount = palette.colors.length - excludedColorIds.size;

  const updateColor = () => {
    if (selectedSwatch === null) return;
    const result = replaceSwatch(palette, selectedSwatch, editColor);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onPaletteChange(result.value);
    setError(null);
  };

  return (
    <ScrollArea className="min-h-0 flex-1 [&_[data-slot=scroll-area-viewport]>div]:!block [&_[data-slot=scroll-area-viewport]>div]:!w-full">
      <div className="divide-y divide-border">
        <section className="px-4 py-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <Label>Cell grid</Label>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="xs"
                aria-label="Divide cell grid dimensions by two"
                disabled={gridWidth <= 4 || gridHeight <= 4}
                onClick={() => onGridScale(0.5)}
              >
                ÷2
              </Button>
              <Button
                variant="ghost"
                size="xs"
                aria-label="Multiply cell grid dimensions by two"
                disabled={gridWidth >= 512 || gridHeight >= 512}
                onClick={() => onGridScale(2)}
              >
                ×2
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <label>
              <span className="sr-only">Grid width</span>
              <Input
                key={`${inputVersion}-output-width-${gridWidth}`}
                type="number"
                min={4}
                max={512}
                defaultValue={gridWidth}
                className="font-mono tabular-nums"
                onBlur={(event) => onGridChange("width", Number(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </label>
            <Button
              variant={aspectLocked ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => onAspectLockedChange(!aspectLocked)}
            >
              {aspectLocked ? <Link2 /> : <Unlink2 />}
              <span className="sr-only">
                {aspectLocked ? "Unlock aspect ratio" : "Preserve aspect ratio"}
              </span>
            </Button>
            <label>
              <span className="sr-only">Grid height</span>
              <Input
                key={`${inputVersion}-output-height-${gridHeight}`}
                type="number"
                min={4}
                max={512}
                defaultValue={gridHeight}
                className="font-mono tabular-nums"
                onBlur={(event) => onGridChange("height", Number(event.target.value))}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                }}
              />
            </label>
          </div>
          <div className="mt-1 grid grid-cols-[1fr_auto_1fr] gap-2 text-center font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            <span>width</span>
            <span className="w-7" />
            <span>height</span>
          </div>
        </section>

        <section className="px-4 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <Label>Palette</Label>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">
                {palette.name} · {matchingColorCount}/{palette.colors.length} matching
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={onOpenPalette}>Manage</Button>
          </div>

          <div className="mt-4 overflow-x-auto border bg-muted/20 p-2">
            <div className="flex w-max min-w-full items-center justify-center py-1">
              {palette.colors.map((swatch, index) => {
                const nextSwatch = palette.colors[index + 1];
                const midpoint = nextSwatch
                  ? midpointColor(swatch.hex, nextSwatch.hex)
                  : null;
                const insertion = nextSwatch
                  ? insertMidpointSwatch(palette, swatch.id, nextSwatch.id)
                  : null;
                const excluded = excludedColorIds.has(swatch.id);
                const isolated = isolatedColorIds.has(swatch.id);

                return (
                  <Fragment key={swatch.id}>
                    <button
                      type="button"
                      className={cn(
                        "relative size-8 shrink-0 border border-white/15 outline-offset-2 transition-transform hover:-translate-y-0.5 focus-visible:z-20 focus-visible:outline-2 focus-visible:outline-ring",
                        excluded && "opacity-40 grayscale",
                        isolated && "ring-2 ring-[#ef6a47] ring-offset-2 ring-offset-background",
                        selectedSwatch === swatch.id && "z-10 outline-2 outline-foreground",
                      )}
                      style={{ backgroundColor: swatch.hex }}
                      aria-label={`Edit ${swatch.hex}${excluded ? ", excluded from matching" : ""}${isolated ? ", isolated in previews" : ""}`}
                      aria-pressed={selectedSwatch === swatch.id}
                      onClick={() => {
                        setSelectedSwatch(swatch.id);
                        setEditColor(swatch.hex.slice(0, 7));
                        setError(null);
                      }}
                    >
                      {excluded ? (
                        <CircleSlash2
                          className="absolute inset-0 m-auto size-4 text-white drop-shadow-[0_1px_2px_rgb(0_0_0)]"
                          aria-hidden="true"
                        />
                      ) : null}
                      {isolated ? (
                        <Eye
                          className="absolute -top-1.5 -right-1.5 size-3.5 bg-background p-0.5 text-[#ef6a47]"
                          aria-hidden="true"
                        />
                      ) : null}
                    </button>
                    {nextSwatch ? (
                      <button
                        type="button"
                        className="group relative z-20 -mx-2 grid h-8 w-4 shrink-0 cursor-copy place-items-center outline-none disabled:cursor-not-allowed disabled:opacity-35"
                        disabled={!insertion?.ok}
                        title={
                          insertion?.ok
                            ? `Insert ${midpoint?.ok ? midpoint.value : "midpoint"}`
                            : insertion?.error
                        }
                        aria-label={`Insert midpoint between ${swatch.hex} and ${nextSwatch.hex}`}
                        onClick={() => {
                          if (!insertion?.ok) return;
                          const newId = nextSwatchId(palette.colors);
                          const newColor = insertion.value.colors.find(
                            (color) => color.id === newId,
                          );
                          onPaletteChange(insertion.value);
                          setSelectedSwatch(newId);
                          if (newColor) setEditColor(newColor.hex.slice(0, 7));
                          setError(null);
                        }}
                      >
                        <span className="absolute h-5 w-px bg-white/35 transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0" />
                        <span
                          className="grid size-5 scale-0 place-items-center border border-white/60 text-white opacity-0 shadow-[0_0_0_1px_rgba(0,0,0,.45),0_2px_8px_rgba(0,0,0,.6)] transition group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100"
                          style={{
                            backgroundColor: midpoint?.ok ? midpoint.value : "transparent",
                          }}
                        >
                          <Plus className="size-3 drop-shadow-[0_1px_1px_rgba(0,0,0,.9)]" />
                        </span>
                      </button>
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          </div>

          {selectedSwatch !== null && selectedColor ? (
            <div className="mt-4 border bg-muted/25 p-3">
              <div className="flex items-end gap-2">
                <label>
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
                  <Input
                    value={editColor}
                    onChange={(event) => setEditColor(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") updateColor();
                    }}
                  />
                </label>
                <Button size="sm" onClick={updateColor}>Update</Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    const result = removeSwatch(palette, selectedSwatch);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    onPaletteChange(result.value);
                    setSelectedSwatch(null);
                    setError(null);
                  }}
                >
                  <Trash2 />
                  <span className="sr-only">Remove selected color</span>
                </Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 border-t pt-3">
                <Button
                  variant={excludedColorIds.has(selectedColor.id) ? "secondary" : "outline"}
                  size="sm"
                  aria-pressed={excludedColorIds.has(selectedColor.id)}
                  disabled={
                    !excludedColorIds.has(selectedColor.id) && matchingColorCount <= 1
                  }
                  onClick={() => onToggleExcludedColor(selectedColor.id)}
                >
                  <CircleSlash2 data-icon="inline-start" />
                  {excludedColorIds.has(selectedColor.id) ? "Excluded" : "Exclude"}
                </Button>
                <Button
                  variant={isolatedColorIds.has(selectedColor.id) ? "secondary" : "outline"}
                  size="sm"
                  aria-pressed={isolatedColorIds.has(selectedColor.id)}
                  onClick={() => onToggleIsolatedColor(selectedColor.id)}
                >
                  <Eye data-icon="inline-start" />
                  {isolatedColorIds.has(selectedColor.id) ? "Isolated" : "Isolate"}
                </Button>
              </div>
              <p className="mt-2 text-[10px] leading-4 text-muted-foreground">
                Exclude changes matching. Isolate only changes on-screen previews.
              </p>
              {error ? (
                <p className="mt-2 text-xs text-destructive" role="alert">{error}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-[10px] leading-4 text-muted-foreground">
              Select a swatch to edit it. Hover or focus between colors to insert a midpoint.
            </p>
          )}

          {excludedColorIds.size > 0 || isolatedColorIds.size > 0 ? (
            <div
              className="mt-3 flex items-center justify-between gap-3 border bg-muted/20 px-3 py-2"
              aria-live="polite"
            >
              <p className="text-[10px] leading-4 text-muted-foreground">
                {excludedColorIds.size > 0
                  ? `${excludedColorIds.size} excluded`
                  : "All colors matching"}
                {" · "}
                {isolatedColorIds.size > 0
                  ? `${isolatedColorIds.size} isolated`
                  : "All previews visible"}
              </p>
              {isolatedColorIds.size > 0 ? (
                <Button variant="ghost" size="xs" onClick={onClearIsolation}>
                  Show all
                </Button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-4 flex gap-2 border-t pt-4">
            <PaletteAdjustments value={paletteAdjustments} onChange={onPaletteAdjustmentsChange} />
            <Button variant="ghost" size="sm" disabled={processing} onClick={onRerun}>
              <RefreshCw data-icon="inline-start" />
              Re-match
            </Button>
          </div>
        </section>
      </div>
    </ScrollArea>
  );
}
