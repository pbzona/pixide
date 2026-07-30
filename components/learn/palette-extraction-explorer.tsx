"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { tracePaletteExtraction, type PaletteBoxTrace } from "@/lib/palette";
import { cn } from "@/lib/utils";

import { EXACT_PALETTE_PIXELS, PALETTE_EXTRACTION_PIXELS } from "./learning-data";
import { PixelGrid, type LearningPixel } from "./pixel-grid";

const cssRgb = (r: number, g: number, b: number) => `rgb(${r} ${g} ${b})`;

const sourceGrid = (pixels: Uint8ClampedArray): LearningPixel[] => {
  const result: LearningPixel[] = [];
  for (let index = 0; index < pixels.length / 4; index += 1) {
    const offset = index * 4;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    result.push({
      color: cssRgb(r, g, b),
      label: `Source pixel ${index + 1}: red ${r}, green ${g}, blue ${b}`,
    });
  }
  return result;
};

function BoxCard({ box, index, active }: Readonly<{ box: PaletteBoxTrace; index: number; active: boolean }>) {
  return (
    <div className={cn("min-w-0 border bg-background/45 p-3", active ? "border-primary" : "border-foreground/10")}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">Box {index + 1}</span>
        <span className="font-mono text-[9px] text-primary">score {box.score.toFixed(0)}</span>
      </div>
      <div className="mt-3 flex h-10 overflow-hidden border border-foreground/10">
        {box.colors.slice(0, 12).map((color, colorIndex) => (
          <span
            key={`${color.r}-${color.g}-${color.b}-${colorIndex}`}
            className="min-w-1 flex-1"
            style={{ backgroundColor: cssRgb(color.r, color.g, color.b) }}
            title={`RGB ${color.r}, ${color.g}, ${color.b}; ${color.count} pixels`}
          />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[9px] text-muted-foreground">
        <span>range {box.range}</span>
        <span>population {box.population}</span>
        <span>{box.colors.length} bins</span>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-foreground/10 pt-3 text-[10px]">
        <span className="size-5 border border-white/15" style={{ backgroundColor: box.representative }} />
        <span className="font-mono">mean color {box.representative}</span>
      </div>
    </div>
  );
}

export function PaletteExtractionExplorer() {
  const [mode, setMode] = useState<"exact" | "extracted">("extracted");
  const [splitStep, setSplitStep] = useState(0);
  const data = useMemo(() => {
    const pixels = mode === "exact" ? EXACT_PALETTE_PIXELS : PALETTE_EXTRACTION_PIXELS;
    return {
      pixels,
      trace: tracePaletteExtraction(pixels, mode === "exact" ? 8 : 6, mode === "exact" ? 64 : 4),
    };
  }, [mode]);
  const step = Math.min(splitStep, data.trace.splits.length);
  const currentSplit = step > 0 ? data.trace.splits[step - 1] : null;
  const boxes = currentSplit?.boxes ?? (data.trace.initialBox ? [data.trace.initialBox] : []);
  const final = step === data.trace.splits.length;

  const changeMode = (nextMode: "exact" | "extracted") => {
    setMode(nextMode);
    setSplitStep(0);
  };

  return (
    <section id="palette-extraction" className="scroll-mt-24 border-t border-foreground/10 pt-16 sm:pt-24">
      <div className="mb-8 max-w-3xl">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">03 / Palette extraction</p>
        <h2 className="mt-3 text-3xl font-medium tracking-[-0.045em] sm:text-5xl">Learn how Pixide extracts a palette.</h2>
        <p className="mt-4 text-sm leading-6 text-muted-foreground sm:text-base">
          Pixide keeps exact colors when the image has 64 or fewer unique colors. For larger color sets, Pixide uses weighted median cut.
        </p>
      </div>

      <div className="border border-foreground/10 bg-card/45">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-foreground/10 p-4 sm:p-5">
          <div className="flex border border-foreground/10 p-1" role="tablist" aria-label="Palette extraction path">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "exact"}
              className={cn("px-3 py-2 text-xs", mode === "exact" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              onClick={() => changeMode("exact")}
            >
              Exact colors
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "extracted"}
              className={cn("px-3 py-2 text-xs", mode === "extracted" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
              onClick={() => changeMode("extracted")}
            >
              Median cut
            </button>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
            {mode === "exact" ? `${data.trace.exactColorCount} exact colors` : `more than ${data.trace.exactLimit} exact colors`}
          </span>
        </div>

        <div className="grid gap-px bg-foreground/10 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="bg-background/70 p-4 sm:p-6">
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Source colors</span>
            <div className="mt-3 overflow-x-auto pb-2">
              <PixelGrid width={8} height={8} pixels={sourceGrid(data.pixels)} label="Palette extraction source pixels" compact />
            </div>
            <div className="mt-5 grid grid-cols-2 gap-px border border-foreground/10 bg-foreground/10">
              <div className="bg-background p-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">5-bit bins</span>
                <p className="mt-1 font-mono text-xs">{data.trace.histogram.length}</p>
              </div>
              <div className="bg-background p-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted-foreground">Requested colors</span>
                <p className="mt-1 font-mono text-xs">{mode === "exact" ? "all" : 6}</p>
              </div>
            </div>
            <details className="mt-5 border-y border-foreground/10 py-3">
              <summary className="cursor-pointer list-none font-mono text-[9px] uppercase tracking-[0.12em] text-primary marker:hidden">Calculation details</summary>
              <div className="mt-3 space-y-2 text-[11px] leading-5 text-muted-foreground">
                <p>Pixide ignores pixels with alpha values less than 128.</p>
                <p>For large color sets, Pixide reduces each RGB channel to five bits. It then creates color boxes.</p>
                <p>Pixide selects the box with the largest range × population score. It splits this box along its widest channel.</p>
              </div>
            </details>
          </aside>

          <div className="min-w-0 bg-card p-4 sm:p-6">
            {mode === "exact" ? (
              <div>
                <p className="max-w-2xl text-sm leading-6">
                  This image has 64 or fewer unique colors. Pixide does not approximate the colors. It keeps the order in which each color first occurs. The requested count does not apply.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  {data.trace.result.colors.map((color, index) => (
                    <div key={color} className="border border-foreground/10 bg-background/45 p-2">
                      <span className="block h-20 w-20 border border-white/10" style={{ backgroundColor: color }} />
                      <span className="mt-2 block font-mono text-[9px] text-muted-foreground">{index + 1}. {color}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-primary">Split {step} / {data.trace.splits.length}</span>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {step === 0
                        ? "All histogram bins are in one box. Pixide selects the box with the largest range × population score."
                        : `Pixide splits the selected box on the ${currentSplit?.channel.toUpperCase()} channel at weighted index ${currentSplit?.splitIndex}. The result has ${boxes.length} boxes.`}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="outline" size="icon-sm" disabled={step === 0} onClick={() => setSplitStep((value) => Math.max(0, value - 1))}>
                      <ChevronLeft />
                      <span className="sr-only">Previous split</span>
                    </Button>
                    <Button variant="outline" size="icon-sm" disabled={final} onClick={() => setSplitStep((value) => Math.min(data.trace.splits.length, value + 1))}>
                      <ChevronRight />
                      <span className="sr-only">Next split</span>
                    </Button>
                  </div>
                </div>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {boxes.map((box, index) => (
                    <BoxCard
                      key={`${step}-${index}-${box.representative}`}
                      box={box}
                      index={index}
                      active={!final && box.score === Math.max(...boxes.map((entry) => entry.score))}
                    />
                  ))}
                </div>

                {final ? (
                  <div className="mt-7 border-t border-foreground/10 pt-6">
                    <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Final colors, sorted by luminance</span>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {data.trace.result.colors.map((color) => (
                        <div key={color} className="flex items-center gap-2 border border-foreground/10 bg-background/45 px-2 py-2">
                          <span className="size-6 border border-white/10" style={{ backgroundColor: color }} />
                          <span className="font-mono text-[9px]">{color}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
