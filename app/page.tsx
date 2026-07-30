import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  BookOpenText,
  Brush,
  Grid3X3,
  LockKeyhole,
  Palette,
  Sparkles,
} from "lucide-react";

import { BrandMark } from "@/components/site/brand-mark";
import { Button } from "@/components/ui/button";
import { CONVERSION_METHODS } from "@/lib/pixel/methods";

export const metadata: Metadata = {
  description:
    "Create palette-driven pixel art in your browser and explore the image sampling and quantization behind it.",
};

const SOURCE_PIXELS = [
  0, 0, 1, 1, 1, 0, 0, 0,
  0, 1, 2, 2, 1, 1, 0, 0,
  1, 2, 3, 3, 2, 1, 1, 0,
  1, 2, 3, 3, 2, 2, 1, 0,
  0, 1, 2, 2, 2, 1, 0, 0,
  0, 1, 1, 2, 1, 1, 0, 0,
  0, 0, 1, 1, 1, 0, 0, 0,
  0, 0, 0, 1, 0, 0, 0, 0,
] as const;

const SOURCE_COLORS = ["#171513", "#48656a", "#ef6a47", "#f1e8d9"] as const;
const METHOD_PREVIEWS = [
  [0, 0, 1, 1, 1, 0, 0, 0, 0, 1, 2, 2, 1, 1, 0, 0],
  [0, 1, 1, 2, 2, 1, 0, 0, 1, 2, 3, 3, 2, 1, 0, 0],
  [0, 0, 1, 2, 1, 0, 0, 0, 0, 1, 2, 3, 2, 1, 0, 0],
  [0, 1, 0, 2, 1, 0, 0, 0, 1, 2, 3, 2, 1, 1, 0, 0],
] as const;

function PixelGrid({
  pixels,
  columns,
}: Readonly<{
  pixels: readonly number[];
  columns: number;
}>) {
  return (
    <div
      className="grid gap-px bg-foreground/15 p-px"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      aria-hidden="true"
    >
      {pixels.map((color, index) => (
        <span
          key={index}
          className="aspect-square"
          style={{ backgroundColor: SOURCE_COLORS[color] }}
        />
      ))}
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="sticky top-0 z-50 border-b border-foreground/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <BrandMark />
            <span className="text-xs font-semibold tracking-[-0.02em]">PIXIDE</span>
          </Link>
          <nav className="flex items-center gap-1" aria-label="Main navigation">
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <a href="#how-it-works">How it works</a>
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/learn">Learn</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/editor" prefetch={false}>Create</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-foreground/10">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
              maskImage: "linear-gradient(to bottom, black, transparent 88%)",
            }}
            aria-hidden="true"
          />
          <div className="relative mx-auto grid min-h-[calc(100svh-3.5rem)] max-w-7xl items-center gap-14 px-4 py-16 sm:px-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,.95fr)] lg:px-8">
            <div className="max-w-3xl">
              <p className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.18em] text-primary">
                <Sparkles className="size-4" />
                Pixel art, made visible
              </p>
              <h1 className="mt-6 text-balance text-5xl font-medium leading-[0.94] tracking-[-0.065em] sm:text-7xl lg:text-[5.5rem]">
                Turn images into intentional pixels.
              </h1>
              <p className="mt-7 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                Pixide automates sampling and palette matching, then gives you the grid to refine by hand. Create an image or open the process and see exactly how it works.
              </p>
              <div className="mt-9 grid max-w-2xl gap-3 sm:grid-cols-2">
                <Link
                  href="/editor"
                  prefetch={false}
                  className="group flex min-h-28 items-center justify-between border border-primary/55 bg-primary/10 p-5 transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>
                    <Brush className="mb-3 size-5 text-primary" />
                    <span className="block text-base font-medium">Create pixel art</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Open the browser editor</span>
                  </span>
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  href="/learn"
                  className="group flex min-h-28 items-center justify-between border border-primary/55 bg-primary/10 p-5 transition-colors hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span>
                    <BookOpenText className="mb-3 size-5 text-primary" />
                    <span className="block text-base font-medium">Learn pixelation</span>
                    <span className="mt-1 block text-xs text-muted-foreground">Explore the interactive lab</span>
                  </span>
                  <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-lg lg:mr-0">
              <div className="absolute -left-5 -top-5 size-24 border-l border-t border-primary/55" aria-hidden="true" />
              <div className="border border-foreground/15 bg-card p-4 shadow-[12px_12px_0_0_rgba(255,255,255,0.045)] sm:p-6">
                <div className="mb-5 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
                  <span>Source image</span>
                  <span className="text-primary">Image → color IDs</span>
                </div>
                <PixelGrid pixels={SOURCE_PIXELS} columns={8} />
                <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                  <div className="space-y-1">
                    {SOURCE_COLORS.map((color) => (
                      <span key={color} className="block h-2" style={{ backgroundColor: color }} />
                    ))}
                  </div>
                  <ArrowDown className="size-4 -rotate-90 text-primary" />
                  <div className="grid grid-cols-4 gap-px bg-foreground/15 p-px">
                    {METHOD_PREVIEWS[0].map((color, index) => (
                      <span key={index} className="aspect-square" style={{ backgroundColor: SOURCE_COLORS[color] }} />
                    ))}
                  </div>
                </div>
                <p className="mt-5 border-t border-foreground/10 pt-4 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                  Sample · Match · Refine
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="border-b border-foreground/10 scroll-mt-14">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr]">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">How it works</p>
                <h2 className="mt-4 max-w-md text-4xl font-medium tracking-[-0.05em] sm:text-5xl">Automation you can inspect.</h2>
              </div>
              <div className="grid gap-px border border-foreground/10 bg-foreground/10 sm:grid-cols-3">
                {[
                  [Grid3X3, "01", "Sample", "Divide the source into cells and inspect the pixels inside each one."],
                  [Palette, "02", "Quantize", "Reduce each cell to a color, then match it against the active palette."],
                  [Brush, "03", "Refine", "Select regions, change methods, or paint individual cells by hand."],
                ].map(([Icon, number, title, description]) => {
                  const StepIcon = Icon as typeof Grid3X3;
                  return (
                    <article key={number as string} className="bg-background p-6 sm:min-h-64">
                      <div className="flex items-center justify-between">
                        <StepIcon className="size-5 text-primary" />
                        <span className="font-mono text-[10px] text-muted-foreground">{number as string}</span>
                      </div>
                      <h3 className="mt-12 text-xl font-medium">{title as string}</h3>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">{description as string}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-foreground/10">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
            <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-primary">Quantization methods</p>
                <h2 className="mt-4 text-4xl font-medium tracking-[-0.05em] sm:text-5xl">One image, different decisions.</h2>
              </div>
              <Button asChild variant="outline">
                <Link href="/learn#methods">Explore every method <ArrowRight data-icon="inline-end" /></Link>
              </Button>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {CONVERSION_METHODS.slice(0, METHOD_PREVIEWS.length).map((method, index) => (
                <Link
                  key={method.value}
                  href={`/learn#${method.slug}`}
                  className="group border border-foreground/12 bg-card p-4 transition-colors hover:border-primary/50"
                >
                  <PixelGrid pixels={METHOD_PREVIEWS[index]} columns={8} />
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm font-medium">{method.label}</span>
                    <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{method.description}.</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="mx-auto grid max-w-7xl gap-px bg-foreground/10 px-4 py-20 sm:px-6 sm:py-28 lg:grid-cols-2 lg:px-8">
            <div className="bg-background p-8 sm:p-12">
              <LockKeyhole className="size-5 text-primary" />
              <h2 className="mt-6 text-3xl font-medium tracking-[-0.045em]">Your image stays yours.</h2>
              <p className="mt-4 max-w-md text-sm leading-6 text-muted-foreground">Image decoding, conversion, editing, and export happen locally in your browser. Nothing is uploaded.</p>
            </div>
            <div className="grid gap-3 bg-background p-8 sm:grid-cols-2 sm:p-12">
              <Link href="/editor" prefetch={false} className="group flex min-h-36 flex-col justify-between border border-primary/45 bg-primary/10 p-5">
                <Brush className="size-5 text-primary" />
                <span className="flex items-end justify-between gap-4 text-lg font-medium">Create <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" /></span>
              </Link>
              <Link href="/learn" className="group flex min-h-36 flex-col justify-between border border-primary/45 bg-primary/10 p-5">
                <BookOpenText className="size-5 text-primary" />
                <span className="flex items-end justify-between gap-4 text-lg font-medium">Learn <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" /></span>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-foreground/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3"><BrandMark className="size-5" /><span className="text-xs font-semibold">PIXIDE</span></div>
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Pixels, explained</p>
        </div>
      </footer>
    </div>
  );
}
