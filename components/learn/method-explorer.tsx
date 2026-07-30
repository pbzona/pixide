"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { linearToSrgbByte, srgbByteToLinear } from "@/lib/color";
import {
  CONVERSION_METHODS,
  conversionMethodDefinition,
  traceImageConversion,
  type ConversionMethod,
  type ImageConversionTrace,
  type PaletteMatchInspection,
  type QuantizationCellTrace,
  type QuantizationTraceDetails,
  type TraceRgb,
} from "@/lib/pixel";
import { cn } from "@/lib/utils";

import { lessonPixels, METHOD_LESSONS, TEACHING_PALETTE } from "./learning-data";
import { PixelGrid, type LearningPixel } from "./pixel-grid";

type MethodExplorerProps = Readonly<{
  method: ConversionMethod;
  onMethodChange: (method: ConversionMethod) => void;
}>;

const cssRgb = (color: TraceRgb) => `rgb(${color.r} ${color.g} ${color.b})`;
const paletteCss = (index: number) => {
  const color = TEACHING_PALETTE[index]?.color;
  return color ? `rgb(${color.r} ${color.g} ${color.b})` : "transparent";
};
const fixed = (value: number) => value.toFixed(3);

const kindForMethod = (method: ConversionMethod): QuantizationTraceDetails["kind"] => {
  if (method === "dominant" || method === "average" || method === "median" || method === "center" || method === "bayer") {
    return method;
  }
  return "diffusion";
};

const methodTrace = (method: ConversionMethod): Readonly<{
  source: Uint8ClampedArray;
  trace: ImageConversionTrace;
}> => {
  const source = lessonPixels(method);
  return {
    source,
    trace: traceImageConversion(source, 8, 8, {
      gridWidth: 4,
      gridHeight: 4,
      method,
      palette: TEACHING_PALETTE,
      preserveTransparency: true,
      alphaThreshold: 128,
    }),
  };
};

const rgbLabel = (color: TraceRgb | null) =>
  color ? `${color.r.toFixed(0)}, ${color.g.toFixed(0)}, ${color.b.toFixed(0)}` : "transparent";

const getMatch = (details: QuantizationTraceDetails): PaletteMatchInspection | null => {
  if (details.kind === "average" || details.kind === "median" || details.kind === "center" || details.kind === "bayer" || details.kind === "diffusion") {
    return details.match;
  }
  return null;
};

function PaletteStrip({ selectedIndex }: Readonly<{ selectedIndex: number | null }>) {
  return (
    <div className="flex flex-wrap gap-2" aria-label="Teaching palette">
      {TEACHING_PALETTE.map((entry, index) => (
        <div
          key={entry.id}
          className={cn(
            "flex items-center gap-2 border px-2 py-1.5 font-mono text-[9px]",
            selectedIndex === index ? "border-primary bg-primary/10 text-foreground" : "border-foreground/10 text-muted-foreground",
          )}
        >
          <span className="size-3 border border-white/15" style={{ backgroundColor: paletteCss(index) }} />
          ID {entry.id}
        </div>
      ))}
    </div>
  );
}

function PaletteDistances({ match }: Readonly<{ match: PaletteMatchInspection }>) {
  const max = Math.max(...match.distances, 0.000_001);
  return (
    <div className="space-y-2">
      {match.distances.map((distance, index) => (
        <div key={TEACHING_PALETTE[index].id} className="grid grid-cols-[1rem_2rem_1fr_3.5rem] items-center gap-2 text-[10px]">
          <span className="size-3 border border-white/15" style={{ backgroundColor: paletteCss(index) }} />
          <span className="font-mono text-muted-foreground">{TEACHING_PALETTE[index].id}</span>
          <span className="h-1.5 bg-foreground/8">
            <span
              className={cn("block h-full", index === match.nearestPaletteIndex ? "bg-primary" : "bg-foreground/30")}
              style={{ width: `${Math.max(3, (distance / max) * 100)}%` }}
            />
          </span>
          <span className="text-right font-mono tabular-nums text-muted-foreground">{distance.toFixed(4)}</span>
        </div>
      ))}
      <p className="font-mono text-[9px] leading-4 text-muted-foreground">
        The smallest squared OKLab distance identifies the nearest color. A shorter bar shows a smaller distance.
      </p>
    </div>
  );
}

function DominantAnalysis({ cell }: Readonly<{ cell: QuantizationCellTrace }>) {
  if (cell.details.kind !== "dominant") return null;
  const max = Math.max(...cell.details.counts, 1);
  return (
    <div className="space-y-4">
      <div>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Palette counts</span>
        <div className="mt-3 space-y-2">
          {cell.details.counts.map((count, index) => (
            <div key={TEACHING_PALETTE[index].id} className="grid grid-cols-[1rem_2rem_1fr_1rem] items-center gap-2 text-[10px]">
              <span className="size-3 border border-white/15" style={{ backgroundColor: paletteCss(index) }} />
              <span className="font-mono text-muted-foreground">{TEACHING_PALETTE[index].id}</span>
              <span className="h-2 bg-foreground/8">
                <span className="block h-full bg-primary" style={{ width: `${(count / max) * 100}%` }} />
              </span>
              <span className="text-right font-mono tabular-nums">{count}</span>
            </div>
          ))}
        </div>
      </div>
      <PaletteStrip selectedIndex={cell.details.selectedPaletteIndex} />
    </div>
  );
}

function AverageAnalysis({ cell }: Readonly<{ cell: QuantizationCellTrace }>) {
  if (cell.details.kind !== "average") return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <ValueCard label="Linear-light average" value={cell.details.representativeLinear ? `${fixed(cell.details.representativeLinear.r)} / ${fixed(cell.details.representativeLinear.g)} / ${fixed(cell.details.representativeLinear.b)}` : "transparent"} />
      <ValueCard label="Encoded sRGB" value={rgbLabel(cell.details.representativeSrgb)} color={cell.details.representativeSrgb ? cssRgb(cell.details.representativeSrgb) : undefined} />
    </div>
  );
}

function MedianAnalysis({ cell }: Readonly<{ cell: QuantizationCellTrace }>) {
  if (cell.details.kind !== "median") return null;
  const details = cell.details;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {(["r", "g", "b"] as const).map((channel) => {
        const values = details.histograms[channel];
        const max = Math.max(...values.map((entry) => entry.count), 1);
        return (
          <div key={channel} className="border border-foreground/10 bg-background/35 p-3">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{channel} histogram</span>
            <div className="mt-3 flex h-20 items-end gap-1">
              {values.map((entry) => (
                <span key={entry.value} className="group relative flex min-w-2 flex-1 items-end" title={`${entry.value}: ${entry.count}`}>
                  <span
                    className={cn("block w-full", channel === "r" ? "bg-red-400" : channel === "g" ? "bg-emerald-400" : "bg-sky-400")}
                    style={{ height: `${Math.max(8, (entry.count / max) * 100)}%` }}
                  />
                </span>
              ))}
            </div>
            <p className="mt-2 font-mono text-[10px]">median {details.median?.[channel] ?? "—"}</p>
          </div>
        );
      })}
    </div>
  );
}

function CenterAnalysis({ cell }: Readonly<{ cell: QuantizationCellTrace }>) {
  if (cell.details.kind !== "center") return null;
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <ValueCard label="Chosen coordinate" value={`x ${cell.details.sample.x}, y ${cell.details.sample.y}`} />
      <div
        className="size-20 border-4 border-background shadow-[0_0_0_1px_rgba(255,255,255,0.14)]"
        style={{ backgroundColor: cssRgb(cell.details.sample.rgb) }}
        aria-label={`Chosen source color ${rgbLabel(cell.details.sample.rgb)}`}
      />
    </div>
  );
}

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;

function BayerAnalysis({ cell }: Readonly<{ cell: QuantizationCellTrace }>) {
  if (cell.details.kind !== "bayer") return null;
  return (
    <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
      <div className="grid grid-cols-4 gap-px border border-foreground/15 bg-foreground/15 p-px" aria-label="Bayer 4 by 4 threshold matrix">
        {BAYER.map((value, index) => {
          const active = index === (cell.y % 4) * 4 + (cell.x % 4);
          return (
            <span
              key={index}
              className={cn(
                "grid size-9 place-items-center bg-background font-mono text-[10px]",
                active && "bg-primary text-primary-foreground",
              )}
            >
              {value}
            </span>
          );
        })}
      </div>
      <div className="space-y-4">
        <ValueCard label="Projected mix" value={cell.details.mix?.toFixed(3) ?? "—"} />
        <div>
          <div className="mb-2 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>threshold {cell.details.threshold.toFixed(3)}</span>
            <span>mix {cell.details.mix?.toFixed(3) ?? "—"}</span>
          </div>
          <div className="relative h-3 bg-foreground/10">
            <span className="absolute inset-y-0 w-px bg-primary" style={{ left: `${cell.details.threshold * 100}%` }} />
            <span className="block h-full bg-foreground/35" style={{ width: `${(cell.details.mix ?? 0) * 100}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DiffusionAnalysis({ cell }: Readonly<{ cell: QuantizationCellTrace }>) {
  if (cell.details.kind !== "diffusion") return null;
  const details = cell.details;
  const deliveryMap = new Map(
    details.deliveries.map((delivery) => [`${delivery.x - cell.x},${delivery.y - cell.y}`, delivery]),
  );
  const selectedPalette = details.selectedPaletteIndex === null
    ? null
    : TEACHING_PALETTE[details.selectedPaletteIndex];
  const selectedLinear = selectedPalette
    ? {
        r: srgbByteToLinear(selectedPalette.color.r),
        g: srgbByteToLinear(selectedPalette.color.g),
        b: srgbByteToLinear(selectedPalette.color.b),
      }
    : null;
  const receivedChange = details.representativeLinear && details.currentLinear
    ? {
        r: details.currentLinear.r - details.representativeLinear.r,
        g: details.currentLinear.g - details.representativeLinear.g,
        b: details.currentLinear.b - details.representativeLinear.b,
      }
    : null;
  const exampleDelivery = details.deliveries.find((delivery) => delivery.applied) ?? null;
  const exampleChange = exampleDelivery && details.error
    ? {
        r: details.error.r * exampleDelivery.weight,
        g: details.error.g * exampleDelivery.weight,
        b: details.error.b * exampleDelivery.weight,
      }
    : null;
  const stencil: { dx: number; dy: number }[] = [];
  for (let dy = 0; dy <= 2; dy += 1) {
    for (let dx = -1; dx <= 2; dx += 1) stencil.push({ dx, dy });
  }
  return (
    <div className="space-y-5">
      <div className="border border-primary/35 bg-primary/5 p-4">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary">Source of the quantization error</span>
        <p className="mt-3 text-xs leading-5 text-foreground/85">
          Quantization error is a three-value linear RGB difference. Pixide calculates it after palette matching. It does not come from the source image.
        </p>
        <p className="mt-2 border bg-background/60 px-3 py-2 font-mono text-[10px] leading-5">
          error = current linear RGB color - selected palette color in linear RGB
        </p>
        <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
          A positive error value increases that color channel in a later cell. A negative value decreases that channel.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <ValueCard
            label="Current color before match"
            value={details.currentLinear ? `${fixed(details.currentLinear.r)} / ${fixed(details.currentLinear.g)} / ${fixed(details.currentLinear.b)}` : "—"}
          />
          <ValueCard
            label="Selected palette color"
            value={selectedLinear ? `${fixed(selectedLinear.r)} / ${fixed(selectedLinear.g)} / ${fixed(selectedLinear.b)}` : "—"}
            color={details.selectedPaletteIndex === null ? undefined : paletteCss(details.selectedPaletteIndex)}
          />
          <ValueCard
            label="Quantization error"
            value={details.error ? `${fixed(details.error.r)} / ${fixed(details.error.g)} / ${fixed(details.error.b)}` : "—"}
          />
        </div>
        <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
          The current color includes changes received from earlier cells. Pixide multiplies the error by a weight. It adds the weighted value to a later cell before that cell selects a palette color.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <ValueCard
            label="Change received from earlier cells"
            value={receivedChange ? `${fixed(receivedChange.r)} / ${fixed(receivedChange.g)} / ${fixed(receivedChange.b)}` : "—"}
          />
          <ValueCard
            label={exampleDelivery ? `Example change sent to cell (${exampleDelivery.x}, ${exampleDelivery.y})` : "Example change sent"}
            value={exampleChange && exampleDelivery ? `${exampleDelivery.weight.toFixed(3)} × error = ${fixed(exampleChange.r)} / ${fixed(exampleChange.g)} / ${fixed(exampleChange.b)}` : "No later cell receives error"}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="grid grid-cols-4 gap-px border border-foreground/15 bg-foreground/15 p-px" aria-label="Error distribution weights">
          {stencil.map(({ dx, dy }) => {
            const delivery = deliveryMap.get(`${dx},${dy}`);
            const origin = dx === 0 && dy === 0;
            return (
              <span
                key={`${dx},${dy}`}
                className={cn(
                  "grid h-11 w-12 place-items-center bg-background px-1 text-center font-mono text-[8px] leading-3 text-muted-foreground",
                  origin && "bg-primary text-primary-foreground",
                  delivery?.applied && "bg-[#536f72] text-white",
                  delivery && !delivery.applied && "bg-muted text-muted-foreground line-through",
                )}
              >
                {origin ? "this cell" : delivery ? `${Math.round(delivery.weight * 1000) / 1000}` : ""}
              </span>
            );
          })}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <ValueCard label="Quantization error (linear RGB)" value={details.error ? `${fixed(details.error.r)} / ${fixed(details.error.g)} / ${fixed(details.error.b)}` : "—"} />
          <ValueCard label="Total error sent from this cell" value={`${Math.round(details.propagatedWeight * 100)}%`} />
        </div>
      </div>
    </div>
  );
}

function ValueCard({ label, value, color }: Readonly<{ label: string; value: string; color?: string }>) {
  return (
    <div className="border border-foreground/10 bg-background/35 p-3">
      <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="mt-2 flex items-center gap-2">
        {color ? <span className="size-4 border border-white/15" style={{ backgroundColor: color }} /> : null}
        <span className="font-mono text-xs tabular-nums">{value}</span>
      </div>
    </div>
  );
}

const stageFacts = (cell: QuantizationCellTrace): readonly string[] => {
  const details = cell.details;
  const sampleCount = details.kind === "center" ? 1 : details.samples.length;
  const mapped = `${sampleCount} source sample${sampleCount === 1 ? "" : "s"}: x ${cell.sourceRange.startX}–${cell.sourceRange.endX - 1}, y ${cell.sourceRange.startY}–${cell.sourceRange.endY - 1}.`;
  if (details.kind === "dominant") {
    return [mapped, `Pixide matches ${details.samples.length} samples to palette colors.`, `Palette counts: ${details.counts.join(" / ")}.`, `${details.tiedPaletteIndices.length} palette color${details.tiedPaletteIndices.length === 1 ? " has" : "s have"} the highest count.`, `Pixide stores palette ID ${cell.resultColorId}.`];
  }
  if (details.kind === "average") {
    return [mapped, `Pixide converts ${details.samples.length} samples to linear RGB.`, `Linear RGB mean: ${details.representativeLinear ? `${fixed(details.representativeLinear.r)} / ${fixed(details.representativeLinear.g)} / ${fixed(details.representativeLinear.b)}` : "transparent"}.`, `sRGB result: ${rgbLabel(details.representativeSrgb)}.`, `Pixide stores palette ID ${cell.resultColorId}.`];
  }
  if (details.kind === "median") {
    return [mapped, `Pixide adds ${details.samples.length} values to each channel histogram.`, `Median RGB values: ${rgbLabel(details.median)}.`, "Pixide combines the three channel values.", `Pixide stores palette ID ${cell.resultColorId}.`];
  }
  if (details.kind === "center") {
    return [mapped, `The cell center maps to source coordinate (${details.sample.x}, ${details.sample.y}).`, `Sample RGB: ${rgbLabel(details.sample.rgb)}.`, `Nearest palette index: ${details.match?.nearestPaletteIndex ?? "—"}.`, `Pixide stores palette ID ${cell.resultColorId}.`];
  }
  if (details.kind === "bayer") {
    return [mapped, `Mean sRGB color: ${rgbLabel(details.representativeSrgb)}.`, `Nearest palette indices: ${details.nearestPaletteIndex ?? "—"} and ${details.secondPaletteIndex ?? "—"}.`, `Mix value: ${details.mix?.toFixed(3) ?? "—"}. Threshold: ${details.threshold.toFixed(3)}.`, `Pixide stores palette ID ${cell.resultColorId}.`];
  }
  return [mapped, `Mean linear RGB before received error: ${details.representativeLinear ? `${fixed(details.representativeLinear.r)} / ${fixed(details.representativeLinear.g)} / ${fixed(details.representativeLinear.b)}` : "transparent"}.`, `Current linear RGB after received error: ${details.currentLinear ? `${fixed(details.currentLinear.r)} / ${fixed(details.currentLinear.g)} / ${fixed(details.currentLinear.b)}` : "—"}.`, `${details.deliveries.filter((delivery) => delivery.applied).length} later cells receive part of the error.`, `Pixide stores palette ID ${cell.resultColorId}.`];
};

export function MethodExplorer({ method, onMethodChange }: MethodExplorerProps) {
  const lesson = METHOD_LESSONS[method];
  const definition = conversionMethodDefinition(method);
  const data = useMemo(() => methodTrace(method), [method]);
  const [stage, setStage] = useState(0);
  const [selectedCell, setSelectedCell] = useState(method === "dither" || method === "atkinson" ? 0 : 5);
  const methodTabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = methodTabsRef.current;
    const active = container?.querySelector<HTMLElement>("[aria-selected=true]");
    if (!container || !active) return;
    container.scrollTo({
      left: Math.max(0, active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2),
      behavior: "auto",
    });
  }, [method]);
  const cell = data.trace.cells[selectedCell];
  const expectedKind = kindForMethod(method);
  if (!cell || cell.details.kind !== expectedKind) return null;

  const paletteById = new Map(TEACHING_PALETTE.map((entry) => [entry.id, entry.color]));
  const deliveryTargets = cell.details.kind === "diffusion"
    ? new Set(cell.details.deliveries.filter((delivery) => delivery.applied).map((delivery) => delivery.y * 4 + delivery.x))
    : new Set<number>();

  const outputPixels: LearningPixel[] = data.trace.cells.map((traceCell, index) => {
    const complete = cell.details.kind === "diffusion" && index <= selectedCell;
    let color: string;
    if (complete || cell.details.kind !== "diffusion") {
      const paletteColor = paletteById.get(traceCell.resultColorId);
      color = paletteColor ? `rgb(${paletteColor.r} ${paletteColor.g} ${paletteColor.b})` : "transparent";
    } else if (traceCell.details.kind === "diffusion" && traceCell.details.representativeLinear) {
      color = cssRgb({
        r: linearToSrgbByte(traceCell.details.representativeLinear.r),
        g: linearToSrgbByte(traceCell.details.representativeLinear.g),
        b: linearToSrgbByte(traceCell.details.representativeLinear.b),
      });
    } else {
      color = "transparent";
    }
    return {
      color,
      label: `Output cell ${traceCell.x + 1}, ${traceCell.y + 1}, palette ID ${traceCell.resultColorId}`,
      marker: index === selectedCell ? String(index + 1) : undefined,
      state: index === selectedCell ? "current" : deliveryTargets.has(index) ? "target" : complete ? "complete" : "default",
    };
  });

  const sourcePixels: LearningPixel[] = [];
  for (let index = 0; index < 64; index += 1) {
    const offset = index * 4;
    const x = index % 8;
    const y = Math.floor(index / 8);
    const inRange = x >= cell.sourceRange.startX && x < cell.sourceRange.endX && y >= cell.sourceRange.startY && y < cell.sourceRange.endY;
    const color = { r: data.source[offset], g: data.source[offset + 1], b: data.source[offset + 2] };
    sourcePixels.push({
      color: cssRgb(color),
      label: `Source pixel ${x + 1}, ${y + 1}: RGB ${rgbLabel(color)}`,
      state: inRange ? "target" : "muted",
    });
  }

  const facts = stageFacts(cell);
  const match = getMatch(cell.details);
  const selectedPaletteIndex = cell.details.kind === "dominant"
    ? cell.details.selectedPaletteIndex
    : match?.nearestPaletteIndex ?? null;

  return (
    <section id="methods" className="relative scroll-mt-24 border-t border-foreground/10 pt-16 sm:pt-24">
      {CONVERSION_METHODS.map((entry) => <span key={entry.slug} id={entry.slug} className="absolute -top-20" />)}
      <div className="mb-8 max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">02 / Quantization methods</p>
        <h2 className="mt-3 text-3xl font-medium tracking-[-0.045em] sm:text-5xl">Compare the methods.</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
          Each method reduces source samples to one palette ID. Select a method and an output cell. Then review each calculation step.
        </p>
      </div>

      <div ref={methodTabsRef} className="overflow-x-auto border-y border-foreground/10 py-3">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Quantization methods">
          {CONVERSION_METHODS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              role="tab"
              aria-selected={method === entry.value}
              className={cn(
                "border px-3 py-2 text-xs transition-colors",
                method === entry.value
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-foreground/15 hover:text-foreground",
              )}
              onClick={() => onMethodChange(entry.value)}
            >
              {entry.shortLabel}
            </button>
          ))}
        </div>
      </div>

      <article className="mt-6 border border-foreground/10 bg-card/45">
        <header className="grid gap-5 border-b border-foreground/10 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-primary">{lesson.eyebrow}</p>
            <h3 className="mt-2 text-3xl font-medium tracking-[-0.04em] sm:text-4xl">{definition.label}</h3>
            <p className="mt-3 max-w-2xl text-base leading-7">{lesson.principle}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{lesson.explanation}</p>
          </div>
          <div className="grid grid-cols-2 gap-px border border-foreground/10 bg-foreground/10">
            <div className="bg-background/80 p-3">
              <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">Family</span>
              <p className="mt-1 text-xs capitalize">{definition.family}</p>
            </div>
            <div className="bg-background/80 p-3">
              <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted-foreground">Output</span>
              <p className="mt-1 text-xs">Palette ID {cell.resultColorId}</p>
            </div>
          </div>
        </header>

        <div className="border-b border-foreground/10 p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 overflow-x-auto" role="tablist" aria-label={`${definition.label} stages`}>
              {lesson.stages.map((label, index) => (
                <button
                  key={label}
                  type="button"
                  role="tab"
                  aria-selected={stage === index}
                  className={cn(
                    "min-w-max border-b-2 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.08em] transition-colors",
                    stage === index ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setStage(index)}
                >
                  {index + 1}. {label}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              <Button variant="outline" size="icon-sm" disabled={stage === 0} onClick={() => setStage((value) => Math.max(0, value - 1))}>
                <ChevronLeft />
                <span className="sr-only">Previous stage</span>
              </Button>
              <Button variant="outline" size="icon-sm" disabled={stage === lesson.stages.length - 1} onClick={() => setStage((value) => Math.min(lesson.stages.length - 1, value + 1))}>
                <ChevronRight />
                <span className="sr-only">Next stage</span>
              </Button>
              <Button variant="ghost" size="icon-sm" onClick={() => setStage(0)}>
                <RotateCcw />
                <span className="sr-only">Reset stages</span>
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-start gap-3 border-l-2 border-primary bg-primary/5 px-3 py-2.5">
            <span className="font-mono text-[10px] text-primary">{String(stage + 1).padStart(2, "0")}</span>
            <p className="font-mono text-[10px] leading-5 text-foreground/80" aria-live="polite">{facts[stage]}</p>
          </div>
        </div>

        <div className="grid gap-px bg-foreground/10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.85fr)]">
          <div className="min-w-0 bg-card p-4 sm:p-6">
            <div className="grid gap-8 sm:grid-cols-2">
              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Source samples</span>
                  <span className="font-mono text-[9px] text-muted-foreground">8×8</span>
                </div>
                <div className="overflow-x-auto pb-2">
                  <PixelGrid width={8} height={8} pixels={sourcePixels} label={`${definition.label} source example`} compact />
                </div>
              </div>
              <div className="min-w-0">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Output cells</span>
                  <span className="font-mono text-[9px] text-primary">select an output cell</span>
                </div>
                <div className="overflow-x-auto pb-2">
                  <PixelGrid width={4} height={4} pixels={outputPixels} label={`${definition.label} output example`} selectedIndex={selectedCell} onSelect={setSelectedCell} />
                </div>
                {cell.details.kind === "diffusion" ? (
                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-foreground/10 pt-3">
                    <Button variant="outline" size="xs" disabled={selectedCell === 0} onClick={() => setSelectedCell((value) => Math.max(0, value - 1))}>Previous pixel</Button>
                    <span className="font-mono text-[9px] tabular-nums text-muted-foreground">scan {selectedCell + 1} / {data.trace.cells.length}</span>
                    <Button variant="outline" size="xs" disabled={selectedCell === data.trace.cells.length - 1} onClick={() => setSelectedCell((value) => Math.min(data.trace.cells.length - 1, value + 1))}>Next pixel</Button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="mt-7 border-t border-foreground/10 pt-6">
              {cell.details.kind === "dominant" ? <DominantAnalysis cell={cell} /> : null}
              {cell.details.kind === "average" ? <AverageAnalysis cell={cell} /> : null}
              {cell.details.kind === "median" ? <MedianAnalysis cell={cell} /> : null}
              {cell.details.kind === "center" ? <CenterAnalysis cell={cell} /> : null}
              {cell.details.kind === "bayer" ? <BayerAnalysis cell={cell} /> : null}
              {cell.details.kind === "diffusion" ? <DiffusionAnalysis cell={cell} /> : null}
            </div>
          </div>

          <aside className="min-w-0 bg-background/70 p-4 sm:p-6">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Palette result</span>
            <div className="mt-3">
              <PaletteStrip selectedIndex={selectedPaletteIndex} />
            </div>
            {match ? (
              <div className="mt-6 border-t border-foreground/10 pt-5">
                <PaletteDistances match={match} />
              </div>
            ) : null}
            <div className="mt-7 space-y-3 border-t border-foreground/10 pt-5">
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Recommended use</span>
                <p className="mt-2 text-xs leading-5">{lesson.useWhen}</p>
              </div>
              <div>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Limit</span>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{lesson.limitation}</p>
              </div>
            </div>
            <details className="group mt-6 border-y border-foreground/10 py-3">
              <summary className="cursor-pointer list-none font-mono text-[9px] uppercase tracking-[0.12em] text-primary marker:hidden">
                Calculation details
              </summary>
              <ul className="mt-3 space-y-2 text-[11px] leading-5 text-muted-foreground">
                {lesson.exact.map((detail) => <li key={detail} className="border-l border-foreground/15 pl-3">{detail}</li>)}
              </ul>
            </details>
          </aside>
        </div>
      </article>
    </section>
  );
}
