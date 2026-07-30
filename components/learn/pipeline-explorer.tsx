"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import { traceImageConversion } from "@/lib/pixel";
import { cn } from "@/lib/utils";

import { lessonPixels, TEACHING_PALETTE } from "./learning-data";
import { PixelGrid, type LearningPixel } from "./pixel-grid";

const PIPELINE_STAGES = [
  { label: "Decode", description: "The browser decodes the image to RGBA byte values. It stores pixels by row." },
  { label: "Adjust", description: "Pixide converts each sample to linear RGB. It then applies the input adjustments." },
  { label: "Map", description: "The output cell maps to a range of source pixels." },
  { label: "Reduce", description: "The selected method calculates one color or selects one sample." },
  { label: "Match", description: "Pixide finds the nearest palette color." },
  { label: "Store", description: "Pixide stores the palette ID for the output cell." },
  { label: "Render", description: "Pixide converts palette IDs to RGBA pixels. It scales the image without smoothing." },
] as const;

const cssRgb = (r: number, g: number, b: number) => `rgb(${r} ${g} ${b})`;
const fixed = (value: number) => value.toFixed(3);

export function PipelineExplorer() {
  const [trace] = useState(() => {
    const pixels = lessonPixels("average");
    return {
      pixels,
      trace: traceImageConversion(pixels, 8, 8, {
        gridWidth: 4,
        gridHeight: 4,
        method: "average",
        palette: TEACHING_PALETTE,
        preserveTransparency: true,
        alphaThreshold: 128,
      }),
    };
  });
  const [stage, setStage] = useState(0);
  const [selectedCell, setSelectedCell] = useState(5);
  const cell = trace.trace.cells[selectedCell];
  if (cell.details.kind !== "average") return null;

  const sourcePixels: LearningPixel[] = [];
  for (let index = 0; index < 64; index += 1) {
    const offset = index * 4;
    const x = index % 8;
    const y = Math.floor(index / 8);
    const inRange =
      x >= cell.sourceRange.startX &&
      x < cell.sourceRange.endX &&
      y >= cell.sourceRange.startY &&
      y < cell.sourceRange.endY;
    const r = trace.pixels[offset];
    const g = trace.pixels[offset + 1];
    const b = trace.pixels[offset + 2];
    sourcePixels.push({
      color: cssRgb(r, g, b),
      label: `Source pixel ${x + 1}, ${y + 1}: red ${r}, green ${g}, blue ${b}`,
      state: stage >= 2 && inRange ? "target" : stage >= 2 ? "muted" : "default",
    });
  }

  const paletteById = new Map(TEACHING_PALETTE.map((entry) => [entry.id, entry.color]));
  const outputPixels: LearningPixel[] = [...trace.trace.result.colorIds].map((id, index) => {
    const color = paletteById.get(id);
    const x = index % 4;
    const y = Math.floor(index / 4);
    return {
      color: color ? cssRgb(color.r, color.g, color.b) : "transparent",
      label: `Output cell ${x + 1}, ${y + 1}: palette ID ${id}`,
      marker: index === selectedCell ? String(id) : undefined,
      state: index === selectedCell ? "current" : "default",
    };
  });

  const firstSample = cell.details.samples[0];
  const representative = cell.details.representativeSrgb;
  const linear = cell.details.representativeLinear;
  const match = cell.details.match;
  const selectedPalette = match
    ? TEACHING_PALETTE[match.nearestPaletteIndex]
    : null;
  const stageFacts = [
    `${trace.pixels.length / 4} pixels × 4 channels = ${trace.pixels.length} bytes`,
    firstSample
      ? `sRGB ${firstSample.rgb.r}, ${firstSample.rgb.g}, ${firstSample.rgb.b} → linear ${fixed(firstSample.linear.r)}, ${fixed(firstSample.linear.g)}, ${fixed(firstSample.linear.b)}`
      : "There are no opaque samples.",
    `Cell (${cell.x}, ${cell.y}) reads x ${cell.sourceRange.startX}–${cell.sourceRange.endX - 1}, y ${cell.sourceRange.startY}–${cell.sourceRange.endY - 1}`,
    linear && representative
      ? `linear ${fixed(linear.r)}, ${fixed(linear.g)}, ${fixed(linear.b)} → sRGB ${representative.r}, ${representative.g}, ${representative.b}`
      : "Most samples are transparent.",
    match && selectedPalette
      ? `Lookup-table (LUT) color ${match.lookupColor.r.toFixed(1)}, ${match.lookupColor.g.toFixed(1)}, ${match.lookupColor.b.toFixed(1)} → palette ID ${selectedPalette.id}`
      : "There is no palette match.",
    `Pixide stores Uint16 value ${cell.resultColorId} at index ${cell.index}.`,
    `The image is 4 × 4 pixels. The display enlarges it without image smoothing.`,
  ];

  return (
    <section id="pipeline" className="scroll-mt-24 border-t border-foreground/10 pt-16 sm:pt-24">
      <div className="mb-8 max-w-2xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">01 / Image pipeline</p>
        <h2 className="mt-3 text-3xl font-medium tracking-[-0.045em] sm:text-5xl">Inspect one output cell through the pipeline.</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
          Select an output cell. Then select each processing step. The page highlights the source pixels and shows the calculated values.
        </p>
      </div>

      <div className="overflow-x-auto border-y border-foreground/10 py-3">
        <div className="flex min-w-max items-center gap-1" role="tablist" aria-label="Image pipeline stages">
          {PIPELINE_STAGES.map((entry, index) => (
            <button
              key={entry.label}
              type="button"
              role="tab"
              aria-selected={stage === index}
              className={cn(
                "flex items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.1em] transition-colors",
                stage === index
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-transparent text-muted-foreground hover:border-foreground/15 hover:text-foreground",
              )}
              onClick={() => setStage(index)}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 border border-foreground/10 bg-card/45 p-4 sm:p-6 xl:grid-cols-[minmax(0,1fr)_15rem_minmax(0,1fr)] xl:items-center">
        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Source / 8×8</span>
            <span className="font-mono text-[9px] text-muted-foreground">select an output cell</span>
          </div>
          <div className="overflow-x-auto pb-2">
            <PixelGrid width={8} height={8} pixels={sourcePixels} label="Source image pixels" compact />
          </div>
        </div>

        <div className="relative min-w-0 border-y border-foreground/10 py-6 text-center xl:border-x xl:border-y-0 xl:px-5 xl:py-10">
          <span className="mx-auto grid size-7 place-items-center border border-primary/40 bg-primary/10 font-mono text-[10px] text-primary">
            {stage + 1}
          </span>
          <h3 className="mt-3 text-lg font-medium">{PIPELINE_STAGES[stage].label}</h3>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{PIPELINE_STAGES[stage].description}</p>
          <p className="mt-4 border bg-background/55 p-3 font-mono text-[10px] leading-5 text-foreground/85">
            {stageFacts[stage]}
          </p>
          <ArrowRight className="absolute -right-3 top-1/2 hidden size-5 -translate-y-1/2 bg-card text-primary xl:block" aria-hidden="true" />
        </div>

        <div className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Output / 4×4</span>
            <span className="font-mono text-[9px] text-primary">ID {cell.resultColorId}</span>
          </div>
          <div className="overflow-x-auto pb-2">
            <PixelGrid
              width={4}
              height={4}
              pixels={outputPixels}
              label="Quantized output cells"
              selectedIndex={selectedCell}
              onSelect={setSelectedCell}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
