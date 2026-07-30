"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LockKeyhole, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { usePixelWorker } from "@/hooks/use-pixel-worker";
import { DEFAULT_PALETTE_ADJUSTMENTS } from "@/lib/color";
import { decodeImageFile } from "@/lib/browser/image";
import {
  CONVERSION_METHODS,
  colorIdsToRgba,
  paletteToPixelColors,
  type ConversionMethod,
  type ConversionResult,
  type PixelPaletteColor,
  type PixelPreview,
} from "@/lib/pixel";
import {
  DEFAULT_PALETTE,
  DEFAULT_PALETTES,
  createPalette,
  type Palette,
} from "@/lib/palette";
import { cn } from "@/lib/utils";

type ComparisonSource = Readonly<{
  name: string;
  width: number;
  height: number;
  preview: PixelPreview;
}>;

type ResultCanvasProps = Readonly<{
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  label: string;
  pixelated?: boolean;
}>;

function ResultCanvas({ width, height, pixels, label, pixelated = true }: ResultCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context || pixels.length !== width * height * 4) return;
    canvas.width = width;
    canvas.height = height;
    const imagePixels = new Uint8ClampedArray(pixels.length);
    imagePixels.set(pixels);
    context.putImageData(new ImageData(imagePixels, width, height), 0, 0);
  }, [height, pixels, width]);

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      className="block h-auto max-h-[34rem] w-full border border-foreground/10 bg-[repeating-conic-gradient(#2e2924_0_25%,#211e1a_0_50%)] bg-[length:16px_16px] object-contain"
      style={{ imageRendering: pixelated ? "pixelated" : "auto", aspectRatio: `${width} / ${height}` }}
    />
  );
}

type OutputPanelProps = Readonly<{
  side: "A" | "B";
  method: ConversionMethod;
  onMethodChange: (method: ConversionMethod) => void;
  result: ConversionResult | null;
  palette: readonly PixelPaletteColor[];
  processing: boolean;
}>;

function OutputPanel({ side, method, onMethodChange, result, palette, processing }: OutputPanelProps) {
  const definition = CONVERSION_METHODS.find((entry) => entry.value === method)!;
  const pixels = result ? colorIdsToRgba(result.colorIds, palette) : new Uint8ClampedArray();
  return (
    <article className="min-w-0 border border-foreground/10 bg-card/55">
      <header className="border-b border-foreground/10 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary">Output {side}</span>
          {result ? <span className="font-mono text-[9px] text-muted-foreground">{result.width}×{result.height}</span> : null}
        </div>
        <Select value={method} onValueChange={(value: string) => onMethodChange(value as ConversionMethod)}>
          <SelectTrigger className="h-9 w-full rounded-none" aria-label={`Output ${side} quantization method`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="rounded-none">
            {CONVERSION_METHODS.map((entry) => (
              <SelectItem key={entry.value} value={entry.value} className="rounded-none">{entry.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">{definition.description}</p>
      </header>
      <div className="relative p-3 sm:p-4">
        {result ? (
          <ResultCanvas width={result.width} height={result.height} pixels={pixels} label={`${definition.label} result`} />
        ) : (
          <div className="grid aspect-square place-items-center border border-dashed border-foreground/15 bg-background/35 text-xs text-muted-foreground">
            Waiting for an image
          </div>
        )}
        {processing ? (
          <span className="absolute bottom-6 right-6 flex items-center gap-2 border bg-background/90 px-2 py-1.5 font-mono text-[8px] uppercase tracking-[0.1em] shadow-sm">
            <RefreshCw className="size-3 animate-spin motion-reduce:animate-none" />
            processing
          </span>
        ) : null}
      </div>
    </article>
  );
}

const gridForSource = (longestSide: number, width: number, height: number) => {
  if (width >= height) {
    return { width: longestSide, height: Math.max(4, Math.round(longestSide * height / width)) };
  }
  return { width: Math.max(4, Math.round(longestSide * width / height)), height: longestSide };
};

export function ImageComparisonLab() {
  const inputRef = useRef<HTMLInputElement>(null);
  const requestGeneration = useRef(0);
  const { setSource: setWorkerSource, convert, extractPalette } = usePixelWorker();
  const [source, setSource] = useState<ComparisonSource | null>(null);
  const [extractedPalette, setExtractedPalette] = useState<Palette | null>(null);
  const [paletteId, setPaletteId] = useState(DEFAULT_PALETTE.id);
  const [leftMethod, setLeftMethod] = useState<ConversionMethod>("average");
  const [rightMethod, setRightMethod] = useState<ConversionMethod>("dither");
  const [gridLongestSide, setGridLongestSide] = useState(32);
  const [leftResult, setLeftResult] = useState<ConversionResult | null>(null);
  const [rightResult, setRightResult] = useState<ConversionResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availablePalettes = extractedPalette
    ? [...DEFAULT_PALETTES, extractedPalette]
    : DEFAULT_PALETTES;
  const activePalette = availablePalettes.find((palette) => palette.id === paletteId) ?? DEFAULT_PALETTE;
  const pixelPalette = paletteToPixelColors(activePalette, DEFAULT_PALETTE_ADJUSTMENTS);
  const grid = source
    ? gridForSource(gridLongestSide, source.width, source.height)
    : { width: gridLongestSide, height: gridLongestSide };

  const runComparison = async (
    nextSource: ComparisonSource,
    nextLeftMethod: ConversionMethod,
    nextRightMethod: ConversionMethod,
    nextGridLongestSide: number,
    nextPalette: Palette,
  ) => {
    const conversionPalette = paletteToPixelColors(nextPalette, DEFAULT_PALETTE_ADJUSTMENTS);
    if (conversionPalette.length === 0) return;
    const nextGrid = gridForSource(nextGridLongestSide, nextSource.width, nextSource.height);
    const generation = ++requestGeneration.current;
    setProcessing(true);
    setError(null);
    const shared = {
      gridWidth: nextGrid.width,
      gridHeight: nextGrid.height,
      palette: conversionPalette,
      preserveTransparency: true,
      alphaThreshold: 128,
    };
    try {
      const nextLeft = await convert({ ...shared, method: nextLeftMethod });
      if (generation !== requestGeneration.current) return;
      const nextRight = nextLeftMethod === nextRightMethod
        ? nextLeft
        : await convert({ ...shared, method: nextRightMethod });
      if (generation !== requestGeneration.current) return;
      setLeftResult(nextLeft);
      setRightResult(nextRight);
    } catch (failure) {
      if (generation !== requestGeneration.current) return;
      setError(failure instanceof Error ? failure.message : "Comparison failed.");
    } finally {
      if (generation === requestGeneration.current) setProcessing(false);
    }
  };

  const handleFile = async (file: File) => {
    requestGeneration.current += 1;
    setUploading(true);
    setProcessing(false);
    setError(null);
    try {
      const decoded = await decodeImageFile(file);
      const preview = await setWorkerSource(decoded.pixels, decoded.width, decoded.height);
      let nextExtracted: Palette | null = null;
      try {
        const extraction = await extractPalette(preview.pixels.slice(), 12);
        if (extraction.colors.length > 0) {
          const created = createPalette("learn-image", "Image colors", extraction.colors);
          if (created.ok) nextExtracted = created.value;
        }
      } catch {
        nextExtracted = null;
      }
      const nextSource = { name: file.name, width: decoded.width, height: decoded.height, preview };
      const nextPalette = paletteId === "learn-image" && nextExtracted
        ? nextExtracted
        : activePalette;
      setExtractedPalette(nextExtracted);
      setSource(nextSource);
      setLeftResult(null);
      setRightResult(null);
      if (paletteId === "learn-image" && !nextExtracted) setPaletteId(DEFAULT_PALETTE.id);
      await runComparison(
        nextSource,
        leftMethod,
        rightMethod,
        gridLongestSide,
        paletteId === "learn-image" && !nextExtracted ? DEFAULT_PALETTE : nextPalette,
      );
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not read this image.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <section id="compare" className="scroll-mt-24 border-t border-foreground/10 pt-16 sm:pt-24">
      <div className="mb-8 max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">04 / Your image</p>
        <h2 className="mt-3 text-3xl font-medium tracking-[-0.045em] sm:text-5xl">Compare two methods on your image.</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
          The two outputs use the same source, grid, palette, and transparency settings. Select a different method for each output.
        </p>
      </div>

      {!source ? (
        <div
          className={cn(
            "relative grid min-h-80 place-items-center border border-dashed border-foreground/20 bg-card/45 p-6 text-center transition-colors",
            dragging && "border-primary bg-primary/5",
          )}
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
            const file = event.dataTransfer.files[0];
            if (file) void handleFile(file);
          }}
        >
          <div>
            <span className="mx-auto grid size-14 place-items-center border border-foreground/15 bg-background shadow-[4px_4px_0_0_var(--foreground)]">
              <ImagePlus className="size-5" />
            </span>
            <h3 className="mt-6 text-2xl font-medium tracking-[-0.035em]">Select an image.</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Drop a PNG, JPEG, WebP, or GIF here. Pixide processes the image in this browser.</p>
            <Button className="mt-6" disabled={uploading} onClick={() => inputRef.current?.click()}>
              <ImagePlus data-icon="inline-start" />
              {uploading ? "Reading pixels…" : "Select an image"}
            </Button>
            <p className="mt-5 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
              <LockKeyhole className="size-3.5" />
              Pixide does not upload the image
            </p>
            {error ? <p className="mt-4 border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p> : null}
          </div>
        </div>
      ) : (
        <div className="border border-foreground/10 bg-card/45">
          <div className="grid gap-px bg-foreground/10 lg:grid-cols-[16rem_minmax(0,1fr)]">
            <aside className="min-w-0 bg-background/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{source.name}</p>
                  <p className="mt-1 font-mono text-[9px] text-muted-foreground">{source.width}×{source.height} source</p>
                </div>
                <Button variant="outline" size="icon-sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
                  <ImagePlus />
                  <span className="sr-only">Replace image</span>
                </Button>
              </div>
              <div className="mt-4">
                <ResultCanvas width={source.preview.width} height={source.preview.height} pixels={source.preview.pixels} label="Uploaded source preview" pixelated={false} />
              </div>

              <div className="mt-6 space-y-6 border-t border-foreground/10 pt-5">
                <div>
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <Label className="text-xs">Grid size (long side)</Label>
                    <span className="font-mono text-[10px] text-primary">{grid.width}×{grid.height}</span>
                  </div>
                  <Slider
                    aria-label="Output grid longest side"
                    min={8}
                    max={96}
                    step={4}
                    value={[gridLongestSide]}
                    onValueChange={(values: number[]) => {
                      const value = values[0];
                      setGridLongestSide(value);
                      void runComparison(source, leftMethod, rightMethod, value, activePalette);
                    }}
                  />
                  <div className="mt-2 flex justify-between font-mono text-[8px] text-muted-foreground"><span>8</span><span>96</span></div>
                </div>
                <div>
                  <Label className="mb-2 text-xs">Palette for both outputs</Label>
                  <Select
                    value={activePalette.id}
                    onValueChange={(value: string) => {
                      const palette = availablePalettes.find((entry) => entry.id === value);
                      if (!palette) return;
                      setPaletteId(value);
                      void runComparison(source, leftMethod, rightMethod, gridLongestSide, palette);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full rounded-none" aria-label="Shared comparison palette"><SelectValue /></SelectTrigger>
                    <SelectContent className="rounded-none">
                      {availablePalettes.map((palette) => (
                        <SelectItem key={palette.id} value={palette.id} className="rounded-none">{palette.name} · {palette.colors.length}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {activePalette.colors.map((swatch) => (
                      <span key={swatch.id} className="size-4 border border-white/10" style={{ backgroundColor: swatch.hex }} title={swatch.hex} />
                    ))}
                  </div>
                </div>
                <p className="border-l border-primary/50 pl-3 text-[10px] leading-5 text-muted-foreground">
                  Alpha values below 128 are transparent. The method is the only setting that can differ between the outputs.
                </p>
              </div>
            </aside>

            <div className="min-w-0 bg-card p-3 sm:p-5">
              <div className="grid gap-4 xl:grid-cols-2">
                <OutputPanel
                  side="A"
                  method={leftMethod}
                  onMethodChange={(nextMethod) => {
                    setLeftMethod(nextMethod);
                    void runComparison(source, nextMethod, rightMethod, gridLongestSide, activePalette);
                  }}
                  result={leftResult}
                  palette={pixelPalette}
                  processing={processing}
                />
                <OutputPanel
                  side="B"
                  method={rightMethod}
                  onMethodChange={(nextMethod) => {
                    setRightMethod(nextMethod);
                    void runComparison(source, leftMethod, nextMethod, gridLongestSide, activePalette);
                  }}
                  result={rightResult}
                  palette={pixelPalette}
                  processing={processing}
                />
              </div>
              {error ? <p className="mt-4 border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p> : null}
            </div>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className="sr-only"
        accept="image/png,image/jpeg,image/webp,image/gif"
        disabled={uploading}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleFile(file);
          event.currentTarget.value = "";
        }}
      />
    </section>
  );
}
