"use client";

import { useEffect, useRef, useState } from "react";

import {
  colorIdsToRgba,
  type PixelPaletteColor,
  type PixelPreview,
} from "@/lib/pixel";

type ComparisonPreviewProps = Readonly<{
  width: number;
  height: number;
  colorIds: Uint16Array | null;
  palette: readonly PixelPaletteColor[];
  visibleColorIds: ReadonlySet<number> | null;
  originalPreview: PixelPreview | null;
  adjustedPreview: PixelPreview | null;
  compact?: boolean;
}>;

export function ComparisonPreview({
  width,
  height,
  colorIds,
  palette,
  visibleColorIds,
  originalPreview,
  adjustedPreview,
  compact = false,
}: ComparisonPreviewProps) {
  const pixelCanvasRef = useRef<HTMLCanvasElement>(null);
  const inputCanvasRef = useRef<HTMLCanvasElement>(null);
  const [position, setPosition] = useState(50);
  const [inputMode, setInputMode] = useState<"original" | "adjusted">("adjusted");

  useEffect(() => {
    const canvas = pixelCanvasRef.current;
    if (!canvas) return;
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    if (!colorIds) return;
    context.putImageData(
      new ImageData(colorIdsToRgba(colorIds, palette, visibleColorIds), width, height),
      0,
      0,
    );
  }, [colorIds, height, palette, visibleColorIds, width]);

  const inputPreview =
    inputMode === "adjusted" ? adjustedPreview ?? originalPreview : originalPreview;

  useEffect(() => {
    const canvas = inputCanvasRef.current;
    if (!canvas || !inputPreview) return;
    canvas.width = inputPreview.width;
    canvas.height = inputPreview.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.putImageData(
      new ImageData(inputPreview.pixels, inputPreview.width, inputPreview.height),
      0,
      0,
    );
  }, [inputPreview]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        <span>Pixel</span>
        <span className="flex items-center gap-1">
          <button
            type="button"
            className={inputMode === "original" ? "text-foreground" : "hover:text-foreground"}
            aria-pressed={inputMode === "original"}
            onClick={() => setInputMode("original")}
          >
            Original
          </button>
          <span aria-hidden="true">/</span>
          <button
            type="button"
            className={inputMode === "adjusted" ? "text-foreground" : "hover:text-foreground"}
            aria-pressed={inputMode === "adjusted"}
            onClick={() => setInputMode("adjusted")}
          >
            Adjusted
          </button>
        </span>
      </div>
      <div className={`${compact ? "h-40" : "h-48"} flex items-center justify-center overflow-hidden border bg-[#151619] bg-[linear-gradient(45deg,#25272b_25%,transparent_25%),linear-gradient(-45deg,#25272b_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#25272b_75%),linear-gradient(-45deg,transparent_75%,#25272b_75%)] bg-[length:12px_12px] bg-[position:0_0,0_6px,6px_-6px,-6px_0px]`}>
        <div
          className="relative max-h-full max-w-full overflow-hidden bg-background has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-2 has-[:focus-visible]:ring-offset-background"
          style={
            width / height >= 1
              ? { width: "100%", aspectRatio: width / height }
              : { height: "100%", aspectRatio: width / height }
          }
        >
          <canvas
            ref={inputCanvasRef}
            className="absolute inset-0 size-full"
            style={{ imageRendering: "auto" }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          >
            <canvas
              ref={pixelCanvasRef}
              className="size-full"
              style={{ imageRendering: "pixelated" }}
              aria-hidden="true"
            />
          </div>
          <div
            className="pointer-events-none absolute inset-y-0 w-px bg-white shadow-[0_0_0_1px_rgba(0,0,0,.3)]"
            style={{ left: `${position}%` }}
          >
            <span className="absolute top-1/2 left-1/2 grid size-5 -translate-1/2 place-items-center rounded-full border border-black/20 bg-white text-[9px] text-black">
              ↔
            </span>
          </div>
          <input
            className="absolute inset-0 size-full cursor-ew-resize opacity-0"
            type="range"
            min="0"
            max="100"
            value={position}
            aria-label={`Reveal ${inputMode} input or pixel version`}
            onChange={(event) => setPosition(Number(event.target.value))}
          />
        </div>
      </div>
    </div>
  );
}
