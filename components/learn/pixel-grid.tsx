"use client";

import { cn } from "@/lib/utils";

export type LearningPixel = Readonly<{
  color: string;
  label: string;
  marker?: string;
  state?: "default" | "muted" | "current" | "target" | "complete";
}>;

type PixelGridProps = Readonly<{
  width: number;
  height: number;
  pixels: readonly LearningPixel[];
  label: string;
  selectedIndex?: number;
  onSelect?: (index: number) => void;
  compact?: boolean;
  className?: string;
}>;

const checkerboard = {
  backgroundColor: "#27231f",
  backgroundImage:
    "linear-gradient(45deg, #39332d 25%, transparent 25%), linear-gradient(-45deg, #39332d 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #39332d 75%), linear-gradient(-45deg, transparent 75%, #39332d 75%)",
  backgroundPosition: "0 0, 0 5px, 5px -5px, -5px 0px",
  backgroundSize: "10px 10px",
};

export function PixelGrid({
  width,
  height,
  pixels,
  label,
  selectedIndex,
  onSelect,
  compact = false,
  className,
}: PixelGridProps) {
  return (
    <div
      role="grid"
      aria-label={label}
      aria-rowcount={height}
      aria-colcount={width}
      className={cn(
        "grid w-fit max-w-full gap-px overflow-hidden border border-foreground/15 bg-foreground/15 p-px shadow-[4px_4px_0_0_color-mix(in_oklab,var(--foreground)_10%,transparent)]",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))` }}
    >
      {pixels.map((pixel, index) => {
        const selected = selectedIndex === index;
        const cellClassName = cn(
          "relative grid aspect-square place-items-center overflow-hidden outline-none",
          compact ? "size-5 sm:size-6" : "size-7 sm:size-9",
          onSelect && "transition-[filter,box-shadow] hover:brightness-110 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
          selected && "z-10 ring-2 ring-primary ring-inset",
          pixel.state === "muted" && "opacity-35 saturate-50",
          pixel.state === "current" && "z-10 ring-2 ring-foreground ring-inset",
          pixel.state === "target" && "after:absolute after:inset-1 after:border after:border-dashed after:border-foreground/80",
          pixel.state === "complete" && "after:absolute after:inset-0 after:bg-background/10",
        );
        const style = pixel.color === "transparent"
          ? checkerboard
          : { backgroundColor: pixel.color };
        const marker = pixel.marker ? (
          <span className="relative z-10 font-mono text-[8px] font-semibold leading-none text-white mix-blend-difference">
            {pixel.marker}
          </span>
        ) : null;

        return onSelect ? (
          <button
            key={index}
            type="button"
            role="gridcell"
            aria-rowindex={Math.floor(index / width) + 1}
            aria-colindex={(index % width) + 1}
            aria-selected={selected}
            aria-label={pixel.label}
            className={cellClassName}
            style={style}
            onClick={() => onSelect(index)}
          >
            {marker}
          </button>
        ) : (
          <span
            key={index}
            role="gridcell"
            aria-rowindex={Math.floor(index / width) + 1}
            aria-colindex={(index % width) + 1}
            aria-label={pixel.label}
            className={cellClassName}
            style={style}
          >
            {marker}
          </span>
        );
      })}
    </div>
  );
}
