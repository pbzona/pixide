"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, FlaskConical } from "lucide-react";

import { Button } from "@/components/ui/button";
import { BrandMark } from "@/components/site/brand-mark";
import {
  CONVERSION_METHODS,
  type ConversionMethod,
} from "@/lib/pixel";
import { cn } from "@/lib/utils";

import { ImageComparisonLab } from "./image-comparison-lab";
import { MethodExplorer } from "./method-explorer";
import { PaletteExtractionExplorer } from "./palette-extraction-explorer";
import { PipelineExplorer } from "./pipeline-explorer";

const HERO_PIXELS = [
  0, 0, 1, 1, 1, 0, 0, 0,
  0, 1, 2, 2, 1, 1, 0, 0,
  1, 2, 3, 3, 2, 1, 1, 0,
  1, 2, 3, 3, 2, 2, 1, 0,
  0, 1, 2, 2, 2, 1, 0, 0,
  0, 1, 1, 2, 1, 1, 0, 0,
  0, 0, 1, 1, 1, 0, 0, 0,
  0, 0, 0, 1, 0, 0, 0, 0,
] as const;

const HERO_COLORS = ["#171513", "#48656a", "#ef6a47", "#f1e8d9"] as const;

const methodForHash = (hash: string): ConversionMethod | null => {
  const slug = hash.replace(/^#/u, "");
  return CONVERSION_METHODS.find((entry) => entry.slug === slug)?.value ?? null;
};

type LearningNavProps = Readonly<{
  method: ConversionMethod;
  onMethodChange: (method: ConversionMethod) => void;
  mobile?: boolean;
}>;

function LearningNav({ method, onMethodChange, mobile = false }: LearningNavProps) {
  return (
    <nav
      aria-label="Learning page sections"
      className={cn(
        mobile
          ? "flex min-w-max items-center gap-1 px-4 py-2"
          : "space-y-1 border-l border-foreground/10 pl-4",
      )}
    >
      <a className={cn("block text-xs text-muted-foreground hover:text-foreground", mobile ? "border px-3 py-2" : "py-1.5")} href="#pipeline">
        Pipeline
      </a>
      {!mobile ? <p className="pb-1 pt-4 font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground/65">Methods</p> : null}
      {CONVERSION_METHODS.map((entry) => (
        <a
          key={entry.value}
          href={`#${entry.slug}`}
          aria-current={method === entry.value ? "page" : undefined}
          className={cn(
            "block text-xs transition-colors",
            mobile ? "border px-3 py-2" : "py-1.5",
            method === entry.value
              ? "border-primary bg-primary/10 text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onMethodChange(entry.value)}
        >
          {entry.shortLabel}
        </a>
      ))}
      <a className={cn("block text-xs text-muted-foreground hover:text-foreground", mobile ? "border px-3 py-2" : "mt-3 py-1.5")} href="#palette-extraction">
        Palette extraction
      </a>
      <a className={cn("block text-xs text-muted-foreground hover:text-foreground", mobile ? "border px-3 py-2" : "py-1.5")} href="#compare">
        Your image
      </a>
    </nav>
  );
}

export function QuantizationLab() {
  const [method, setMethod] = useState<ConversionMethod>("dominant");
  const mobileNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const syncHash = () => {
      const nextMethod = methodForHash(window.location.hash);
      if (nextMethod) setMethod(nextMethod);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    const container = mobileNavRef.current;
    const active = container?.querySelector<HTMLElement>("[aria-current=page]");
    if (!container || !active) return;
    container.scrollTo({
      left: Math.max(0, active.offsetLeft - (container.clientWidth - active.offsetWidth) / 2),
      behavior: "auto",
    });
  }, [method]);

  const changeMethod = (nextMethod: ConversionMethod) => {
    setMethod(nextMethod);
    const slug = CONVERSION_METHODS.find((entry) => entry.value === nextMethod)?.slug;
    if (slug) window.history.replaceState(null, "", `#${slug}`);
  };

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-foreground/10 bg-background/95 px-4 backdrop-blur sm:px-6">
        <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <BrandMark />
          <span className="text-xs font-semibold tracking-[-0.02em]">PIXIDE</span>
          <span className="hidden h-4 w-px bg-border sm:block" />
          <span className="hidden font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground sm:block">Pixelation guide</span>
        </Link>
        <Button asChild variant="outline" size="sm">
          <Link href="/editor" prefetch={false}>
            Open studio
            <ArrowUpRight data-icon="inline-end" />
          </Link>
        </Button>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-foreground/10">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage: "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "linear-gradient(to bottom, black, transparent 85%)",
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto grid min-h-[calc(100svh-3.5rem)] max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] lg:px-8">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                <FlaskConical className="size-4" />
                Interactive pixelation guide
              </div>
              <h1 className="mt-6 text-balance text-5xl font-medium leading-[0.95] tracking-[-0.065em] sm:text-7xl lg:text-[5.6rem]">
                Learn how Pixide converts an image to pixels.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Pixide divides the image into output cells. It samples source pixels for each cell. A quantization method selects one palette color for each output cell. Use this page to inspect each step.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <a href="#pipeline">
                    View the image pipeline
                    <ArrowDown data-icon="inline-end" />
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="#dominant-vote" onClick={() => changeMethod("dominant")}>Compare the methods</a>
                </Button>
              </div>
              <div className="mt-12 grid max-w-xl grid-cols-3 gap-px border-y border-foreground/10 bg-foreground/10">
                {[
                  ["Cell", "sampling unit"],
                  ["Palette", "color matching"],
                  ["Local", "browser processing"],
                ].map(([value, label]) => (
                  <div key={label} className="bg-background/85 py-4 pr-3">
                    <p className="font-mono text-xl tabular-nums">{value}</p>
                    <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-md lg:mr-0">
              <div className="absolute -left-5 -top-5 size-20 border-l border-t border-primary/55" aria-hidden="true" />
              <div className="border border-foreground/15 bg-card p-4 shadow-[12px_12px_0_0_rgba(255,255,255,0.045)] sm:p-6">
                <div className="mb-5 flex items-center justify-between">
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Example image / 8×8</span>
                  <span className="font-mono text-[9px] text-primary">RGBA → ID</span>
                </div>
                <div className="grid grid-cols-8 gap-px bg-foreground/10 p-px">
                  {HERO_PIXELS.map((color, index) => (
                    <span
                      key={index}
                      className="aspect-square"
                      style={{ backgroundColor: HERO_COLORS[color] }}
                    />
                  ))}
                </div>
                <div className="mt-6 space-y-px bg-foreground/10">
                  {[
                    ["01", "sample", "Which source pixels are in this cell?"],
                    ["02", "reduce", "How does the method combine these pixels?"],
                    ["03", "match", "Which palette color is nearest?"],
                  ].map(([number, verb, question]) => (
                    <div key={number} className="grid grid-cols-[2rem_4rem_1fr] gap-3 bg-background/85 px-3 py-3 font-mono text-[9px]">
                      <span className="text-primary">{number}</span>
                      <span className="uppercase text-foreground">{verb}</span>
                      <span className="text-muted-foreground">{question}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div ref={mobileNavRef} className="sticky top-14 z-40 overflow-x-auto border-b border-foreground/10 bg-background/95 backdrop-blur lg:hidden">
          <LearningNav method={method} onMethodChange={changeMethod} mobile />
        </div>

        <div className="mx-auto grid max-w-7xl gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-[11rem_minmax(0,1fr)] lg:px-8">
          <aside className="hidden lg:block">
            <div className="sticky top-24 pt-16">
              <p className="mb-4 font-mono text-[8px] uppercase tracking-[0.16em] text-muted-foreground/65">Guide</p>
              <LearningNav method={method} onMethodChange={changeMethod} />
            </div>
          </aside>
          <div className="min-w-0">
            <PipelineExplorer />
            <MethodExplorer key={method} method={method} onMethodChange={changeMethod} />
            <PaletteExtractionExplorer />
            <ImageComparisonLab />
          </div>
        </div>
      </main>
    </div>
  );
}
