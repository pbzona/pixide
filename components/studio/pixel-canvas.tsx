"use client";

import { useEffect, useRef, useState } from "react";
import { Columns2, Grid2X2, Grid3X3, Maximize2, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  brushIndices,
  colorIdsToRgba,
  combineSelectionMasks,
  contiguousSelectionMask,
  getGuidePositions,
  lineCells,
  rectangleSelectionMask,
  type PixelPaletteColor,
  type PixelPreview,
  type SelectionMask,
} from "@/lib/pixel";
import { cn } from "@/lib/utils";

import type {
  EditorMode,
  EditorTool,
  SelectionCombineMode,
  SelectionTool,
} from "./types";
import { ComparisonPreview } from "./comparison-preview";

type PixelCanvasProps = Readonly<{
  width: number;
  height: number;
  colorIds: Uint16Array | null;
  palette: readonly PixelPaletteColor[];
  visibleColorIds: ReadonlySet<number> | null;
  originalPreview: PixelPreview | null;
  adjustedPreview: PixelPreview | null;
  mode: EditorMode;
  tool: EditorTool;
  brushSize: number;
  selectionMask: Uint8Array | null;
  selectionTool: SelectionTool;
  selectionBrushSize: number;
  selectionCombineMode: SelectionCombineMode;
  processing: boolean;
  showGuides: boolean;
  guideColumns: number;
  guideRows: number;
  onShowGuidesChange: (show: boolean) => void;
  onGuideColumnsChange: (columns: number) => void;
  onGuideRowsChange: (rows: number) => void;
  onBeginStroke: (bulk?: boolean) => void;
  onPaint: (indices: readonly number[], restore: boolean) => void;
  onEndStroke: () => void;
  onFill: (index: number) => void;
  onPick: (index: number) => void;
  onSelectionChange: (mask: Uint8Array | null) => void;
}>;

const MIN_ZOOM = 2;
const MAX_ZOOM = 40;

type Cell = Readonly<{ x: number; y: number }>;

type PaintGesture = {
  kind: "paint";
  pointerId: number;
  lastCell: Cell;
  tool: Extract<EditorTool, "pencil" | "restore">;
  brushSize: number;
  width: number;
  height: number;
};

type SelectionGesture = {
  kind: "selection";
  pointerId: number;
  startCell: Cell;
  lastCell: Cell;
  tool: Exclude<SelectionTool, "contiguous">;
  brushSize: number;
  combineMode: SelectionCombineMode;
  width: number;
  height: number;
  baseMask: SelectionMask;
  incomingMask: SelectionMask;
  previewMask: SelectionMask;
};

type CanvasGesture = PaintGesture | SelectionGesture;

type PanGesture = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
};

const ignoresPanShortcut = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  Boolean(
    target.closest(
        "input, textarea, select, button, a[href], [role=option], [role=menuitem], [role=dialog], [contenteditable=true]",
    ),
  );

export function PixelCanvas({
  width,
  height,
  colorIds,
  palette,
  visibleColorIds,
  originalPreview,
  adjustedPreview,
  mode,
  tool,
  brushSize,
  selectionMask,
  selectionTool,
  selectionBrushSize,
  selectionCombineMode,
  processing,
  showGuides,
  guideColumns,
  guideRows,
  onShowGuidesChange,
  onGuideColumnsChange,
  onGuideRowsChange,
  onBeginStroke,
  onPaint,
  onEndStroke,
  onFill,
  onPick,
  onSelectionChange,
}: PixelCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<CanvasGesture | null>(null);
  const panGestureRef = useRef<PanGesture | null>(null);
  const spaceHeldRef = useRef(false);
  const [zoom, setZoom] = useState(12);
  const [showGrid, setShowGrid] = useState(true);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const [keyboardCell, setKeyboardCell] = useState({ x: 0, y: 0 });
  const [keyboardActive, setKeyboardActive] = useState(false);
  const [selectionPreview, setSelectionPreview] = useState<SelectionMask | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
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

  useEffect(() => {
    const canvas = selectionCanvasRef.current;
    if (!canvas) return;
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);

    const visibleMask = selectionPreview ?? selectionMask;
    if (!visibleMask || visibleMask.length !== width * height) return;
    const imageData = context.createImageData(width, height);
    for (let index = 0; index < visibleMask.length; index += 1) {
      if (!visibleMask[index]) continue;
      const offset = index * 4;
      imageData.data[offset] = 56;
      imageData.data[offset + 1] = 189;
      imageData.data[offset + 2] = 248;
      imageData.data[offset + 3] = 255;
    }
    context.putImageData(imageData, 0, 0);
  }, [height, selectionMask, selectionPreview, width]);

  useEffect(() => {
    const releaseSpace = () => {
      spaceHeldRef.current = false;
      setSpaceHeld(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        ignoresPanShortcut(event.target)
      ) {
        return;
      }
      event.preventDefault();
      if (spaceHeldRef.current) return;
      spaceHeldRef.current = true;
      setSpaceHeld(true);
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") releaseSpace();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseSpace);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseSpace);
    };
  }, []);

  const fitCanvas = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const availableWidth = Math.max(120, viewport.clientWidth - 80);
    const availableHeight = Math.max(120, viewport.clientHeight - 80);
    setZoom(
      Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.floor(Math.min(availableWidth / width, availableHeight / height)))),
    );
  };

  const cellFromPointer = (
    event: React.PointerEvent<HTMLDivElement>,
    gridWidth = width,
    gridHeight = height,
  ): Cell => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const localX = event.clientX - bounds.left - event.currentTarget.clientLeft;
    const localY = event.clientY - bounds.top - event.currentTarget.clientTop;
    return {
      x: Math.min(
        gridWidth - 1,
        Math.max(0, Math.floor((localX / event.currentTarget.clientWidth) * gridWidth)),
      ),
      y: Math.min(
        gridHeight - 1,
        Math.max(0, Math.floor((localY / event.currentTarget.clientHeight) * gridHeight)),
      ),
    };
  };

  const paintSegment = (from: Cell, to: Cell, gesture: PaintGesture) => {
    const indices = new Set<number>();
    for (const cell of lineCells(from.x, from.y, to.x, to.y)) {
      for (const index of brushIndices(
        cell.x,
        cell.y,
        gesture.brushSize,
        gesture.width,
        gesture.height,
      )) {
        indices.add(index);
      }
    }
    onPaint([...indices], gesture.tool === "restore");
  };

  const baseSelectionMask = (gridWidth: number, gridHeight: number): SelectionMask => {
    const size = gridWidth * gridHeight;
    return selectionMask?.length === size ? selectionMask.slice() : new Uint8Array(size);
  };

  const combineModeFromModifiers = (
    shiftKey: boolean,
    altKey: boolean,
    fallback: SelectionCombineMode,
  ): SelectionCombineMode => {
    if (altKey) return "subtract";
    if (shiftKey) return "add";
    return fallback;
  };

  const addBrushSegment = (
    mask: SelectionMask,
    from: Cell,
    to: Cell,
    size: number,
    gridWidth: number,
    gridHeight: number,
  ) => {
    for (const cell of lineCells(from.x, from.y, to.x, to.y)) {
      for (const index of brushIndices(cell.x, cell.y, size, gridWidth, gridHeight)) {
        mask[index] = 1;
      }
    }
  };

  const updateGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const cell = cellFromPointer(event, gesture.width, gesture.height);
    if (cell.x === gesture.lastCell.x && cell.y === gesture.lastCell.y) return;

    if (gesture.kind === "paint") {
      paintSegment(gesture.lastCell, cell, gesture);
      gesture.lastCell = cell;
      return;
    }

    if (gesture.tool === "brush") {
      addBrushSegment(
        gesture.incomingMask,
        gesture.lastCell,
        cell,
        gesture.brushSize,
        gesture.width,
        gesture.height,
      );
    } else {
      gesture.incomingMask = rectangleSelectionMask(
        gesture.startCell.x,
        gesture.startCell.y,
        cell.x,
        cell.y,
        gesture.width,
        gesture.height,
      );
    }
    gesture.lastCell = cell;
    gesture.previewMask = combineSelectionMasks(
      gesture.baseMask,
      gesture.incomingMask,
      gesture.combineMode,
    );
    setSelectionPreview(gesture.previewMask);
  };

  const finishGesture = (pointerId: number, commitSelection: boolean) => {
    const gesture = gestureRef.current;
    if (!gesture || gesture.pointerId !== pointerId) return;
    gestureRef.current = null;
    if (gesture.kind === "paint") {
      onEndStroke();
      return;
    }

    setSelectionPreview(null);
    if (commitSelection) onSelectionChange(gesture.previewMask);
  };

  const beginPan = (event: React.PointerEvent<HTMLDivElement>) => {
    const startsWithSpace = event.button === 0 && spaceHeldRef.current;
    const startsWithRightButton = event.button === 2;
    if ((!startsWithSpace && !startsWithRightButton) || panGestureRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    panGestureRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPanning(true);
  };

  const updatePan = (event: React.PointerEvent<HTMLDivElement>) => {
    const gesture = panGestureRef.current;
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.scrollLeft = gesture.scrollLeft - (event.clientX - gesture.startX);
    event.currentTarget.scrollTop = gesture.scrollTop - (event.clientY - gesture.startY);
  };

  const finishPan = (pointerId: number) => {
    if (panGestureRef.current?.pointerId !== pointerId) return;
    panGestureRef.current = null;
    setPanning(false);
  };

  const activateKeyboardCell = (shiftKey: boolean, altKey: boolean) => {
    if (mode !== "paint" && mode !== "select") return;
    const x = Math.min(width - 1, keyboardCell.x);
    const y = Math.min(height - 1, keyboardCell.y);
    const index = y * width + x;

    if (mode === "select") {
      let incomingMask: SelectionMask;
      if (selectionTool === "contiguous") {
        if (!colorIds) return;
        incomingMask = contiguousSelectionMask(index, colorIds, width, height);
      } else if (selectionTool === "rectangle") {
        incomingMask = rectangleSelectionMask(x, y, x, y, width, height);
      } else {
        incomingMask = new Uint8Array(width * height);
        addBrushSegment(incomingMask, { x, y }, { x, y }, selectionBrushSize, width, height);
      }
      const combineMode = combineModeFromModifiers(
        shiftKey,
        altKey,
        selectionCombineMode,
      );
      onSelectionChange(
        combineSelectionMasks(baseSelectionMask(width, height), incomingMask, combineMode),
      );
      return;
    }

    if (!colorIds) return;
    if (tool === "eyedropper") {
      onPick(index);
      return;
    }
    onBeginStroke(tool === "fill");
    if (tool === "fill") onFill(index);
    else onPaint(brushIndices(x, y, brushSize, width, height), tool === "restore");
    onEndStroke();
  };

  const beginGesture = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || gestureRef.current) return;
    if (mode !== "paint" && mode !== "select") return;
    if (mode === "paint" && !colorIds) return;

    event.currentTarget.focus({ preventScroll: true });
    const cell = cellFromPointer(event);
    setKeyboardCell(cell);
    const index = cell.y * width + cell.x;

    if (mode === "paint") {
      if (tool === "eyedropper") {
        onPick(index);
        return;
      }
      if (tool === "fill") {
        onBeginStroke(true);
        onFill(index);
        onEndStroke();
        return;
      }

      const gesture: PaintGesture = {
        kind: "paint",
        pointerId: event.pointerId,
        lastCell: cell,
        tool,
        brushSize,
        width,
        height,
      };
      gestureRef.current = gesture;
      event.currentTarget.setPointerCapture(event.pointerId);
      onBeginStroke();
      paintSegment(cell, cell, gesture);
      return;
    }

    const combineMode = combineModeFromModifiers(
      event.shiftKey,
      event.altKey,
      selectionCombineMode,
    );
    const baseMask = baseSelectionMask(width, height);
    if (selectionTool === "contiguous") {
      if (!colorIds) return;
      const incomingMask = contiguousSelectionMask(index, colorIds, width, height);
      onSelectionChange(combineSelectionMasks(baseMask, incomingMask, combineMode));
      return;
    }

    let incomingMask: SelectionMask;
    if (selectionTool === "rectangle") {
      incomingMask = rectangleSelectionMask(cell.x, cell.y, cell.x, cell.y, width, height);
    } else {
      incomingMask = new Uint8Array(width * height);
      addBrushSegment(incomingMask, cell, cell, selectionBrushSize, width, height);
    }
    const previewMask = combineSelectionMasks(baseMask, incomingMask, combineMode);
    const gesture: SelectionGesture = {
      kind: "selection",
      pointerId: event.pointerId,
      startCell: cell,
      lastCell: cell,
      tool: selectionTool,
      brushSize: selectionBrushSize,
      combineMode,
      width,
      height,
      baseMask,
      incomingMask,
      previewMask,
    };
    gestureRef.current = gesture;
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelectionPreview(previewMask);
  };

  const revealKeyboardCell = (cell: { x: number; y: number }) => {
    window.requestAnimationFrame(() => {
      const viewport = viewportRef.current;
      const artwork = canvasRef.current?.parentElement;
      if (!viewport || !artwork) return;
      const viewportBounds = viewport.getBoundingClientRect();
      const artworkBounds = artwork.getBoundingClientRect();
      const left = artworkBounds.left + artwork.clientLeft + cell.x * zoom;
      const right = left + zoom;
      const top = artworkBounds.top + artwork.clientTop + cell.y * zoom;
      const bottom = top + zoom;
      const visibleTop = viewportBounds.top + 56;
      let leftDelta = 0;
      let topDelta = 0;
      if (left < viewportBounds.left + 16) leftDelta = left - viewportBounds.left - 16;
      else if (right > viewportBounds.right - 16) leftDelta = right - viewportBounds.right + 16;
      if (top < visibleTop + 16) topDelta = top - visibleTop - 16;
      else if (bottom > viewportBounds.bottom - 16) {
        topDelta = bottom - viewportBounds.bottom + 16;
      }
      if (leftDelta || topDelta) viewport.scrollBy({ left: leftDelta, top: topDelta });
    });
  };

  return (
    <section className="relative min-h-0 flex-1 bg-[#0e0f11]">
      <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 border border-white/10 bg-[#191a1d]/95 p-1 shadow-lg shadow-black/30 backdrop-blur">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom((value) => Math.max(MIN_ZOOM, value - 2))}>
              <Minus />
              <span className="sr-only">Zoom out</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom out</TooltipContent>
        </Tooltip>
        <span className="w-11 text-center font-mono text-[10px] tabular-nums">{zoom}×</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom((value) => Math.min(MAX_ZOOM, value + 2))}>
              <Plus />
              <span className="sr-only">Zoom in</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zoom in</TooltipContent>
        </Tooltip>
        <span className="mx-1 h-4 w-px bg-border" />
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon-sm">
              <Columns2 />
              <span className="sr-only">Compare source and pixel output</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="center"
            className="w-[min(20rem,calc(100vw-2rem))] rounded-none p-4"
          >
            <ComparisonPreview
              width={width}
              height={height}
              colorIds={colorIds}
              palette={palette}
              visibleColorIds={visibleColorIds}
              originalPreview={originalPreview}
              adjustedPreview={adjustedPreview}
              compact
            />
          </PopoverContent>
        </Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon-sm" onClick={fitCanvas}>
              <Maximize2 />
              <span className="sr-only">Fit canvas</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Fit canvas</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showGrid ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setShowGrid((value) => !value)}
            >
              <Grid3X3 />
              <span className="sr-only">Toggle grid</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle grid</TooltipContent>
        </Tooltip>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant={showGuides ? "secondary" : "ghost"}
              size="icon-sm"
              aria-pressed={showGuides}
            >
              <Grid2X2 />
              <span className="sr-only">Configure guidelines</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-64 rounded-none p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="canvas-guides">Guidelines</Label>
                <p className="mt-1 text-[10px] text-muted-foreground">Editor only. Not included in export.</p>
              </div>
              <Switch id="canvas-guides" checked={showGuides} onCheckedChange={onShowGuidesChange} />
            </div>
            <div className="mt-4 flex gap-2">
              <Button
                variant={guideColumns === 3 && guideRows === 3 ? "secondary" : "outline"}
                size="xs"
                onClick={() => {
                  onGuideColumnsChange(3);
                  onGuideRowsChange(3);
                  onShowGuidesChange(true);
                }}
              >
                Thirds · 3×3
              </Button>
              <Button
                variant={guideColumns === 10 && guideRows === 10 ? "secondary" : "outline"}
                size="xs"
                onClick={() => {
                  onGuideColumnsChange(10);
                  onGuideRowsChange(10);
                  onShowGuidesChange(true);
                }}
              >
                Transfer · 10×10
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <label>
                <span className="mb-1.5 block text-[10px] text-muted-foreground">Columns</span>
                <Input
                  type="number"
                  min={2}
                  max={32}
                  value={guideColumns}
                  className="font-mono tabular-nums"
                  onChange={(event) => onGuideColumnsChange(Number(event.target.value))}
                />
              </label>
              <label>
                <span className="mb-1.5 block text-[10px] text-muted-foreground">Rows</span>
                <Input
                  type="number"
                  min={2}
                  max={32}
                  value={guideRows}
                  className="font-mono tabular-nums"
                  onChange={(event) => onGuideRowsChange(Number(event.target.value))}
                />
              </label>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div
        ref={viewportRef}
        className={cn(
          "absolute inset-0 overflow-auto overscroll-contain pt-12",
          spaceHeld && !panning && "cursor-grab",
          panning && "cursor-grabbing select-none",
        )}
        onPointerDownCapture={beginPan}
        onPointerMoveCapture={updatePan}
        onPointerUpCapture={(event) => {
          updatePan(event);
          finishPan(event.pointerId);
        }}
        onPointerCancel={(event) => finishPan(event.pointerId)}
        onLostPointerCapture={(event) => finishPan(event.pointerId)}
        onContextMenu={(event) => event.preventDefault()}
      >
        <div
          className="flex min-h-full min-w-full items-center justify-center p-10"
          style={{ width: width * zoom + 82, height: height * zoom + 82 }}
        >
          <div
            className={cn(
              "relative box-content shrink-0 overflow-hidden border border-white/20 bg-[#17191c] bg-[linear-gradient(45deg,#25282d_25%,transparent_25%),linear-gradient(-45deg,#25282d_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#25282d_75%),linear-gradient(-45deg,transparent_75%,#25282d_75%)] bg-[length:16px_16px] bg-[position:0_0,0_8px,8px_-8px,-8px_0px] shadow-[0_22px_70px_rgba(0,0,0,.55)]",
              panning && "cursor-grabbing",
              spaceHeld && !panning && "cursor-grab",
              !spaceHeld &&
                !panning &&
                (mode === "paint" || mode === "select") &&
                "cursor-crosshair touch-none",
            )}
            style={{ width: width * zoom, height: height * zoom }}
            role="grid"
            aria-label={`Editable pixel artwork, ${width} columns by ${height} rows`}
            aria-describedby="pixel-canvas-instructions"
            aria-rowcount={height}
            aria-colcount={width}
            aria-activedescendant={
              keyboardActive && (mode === "paint" || mode === "select")
                ? "pixel-active-cell"
                : undefined
            }
            tabIndex={mode === "paint" || mode === "select" ? 0 : -1}
            onFocus={() => setKeyboardActive(true)}
            onBlur={() => setKeyboardActive(false)}
            onKeyDown={(event) => {
              if (mode !== "paint" && mode !== "select") return;
              const movement = {
                ArrowLeft: [-1, 0],
                ArrowRight: [1, 0],
                ArrowUp: [0, -1],
                ArrowDown: [0, 1],
              }[event.key];
              if (movement) {
                event.preventDefault();
                const next = {
                  x: Math.min(width - 1, Math.max(0, keyboardCell.x + movement[0])),
                  y: Math.min(height - 1, Math.max(0, keyboardCell.y + movement[1])),
                };
                setKeyboardCell(next);
                revealKeyboardCell(next);
              } else if (event.key === "Enter") {
                event.preventDefault();
                activateKeyboardCell(event.shiftKey, event.altKey);
              }
            }}
            onPointerDown={beginGesture}
            onPointerMove={updateGesture}
            onPointerUp={(event) => {
              updateGesture(event);
              finishGesture(event.pointerId, true);
            }}
            onPointerCancel={(event) => finishGesture(event.pointerId, false)}
            onLostPointerCapture={(event) => {
              finishGesture(event.pointerId, false);
            }}
          >
            <canvas
              ref={canvasRef}
              className="block size-full"
              style={{ imageRendering: "pixelated" }}
              aria-hidden="true"
            />
            <canvas
              ref={selectionCanvasRef}
              width={width}
              height={height}
              className={cn(
                "pointer-events-none absolute inset-0 block size-full",
                mode === "select" && "opacity-[0.46]",
                mode === "paint" && "opacity-[0.2]",
                mode === "convert" && "opacity-0",
              )}
              style={{ imageRendering: "pixelated" }}
              aria-hidden="true"
            />
            {showGrid && zoom >= 8 ? (
              <span
                className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,.14)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,.14)_1px,transparent_1px)]"
                style={{ backgroundSize: `${zoom}px ${zoom}px` }}
                aria-hidden="true"
              />
            ) : null}
            {showGuides ? (
              <span className="pointer-events-none absolute inset-0" aria-hidden="true">
                {getGuidePositions(guideColumns).map((position) => (
                  <span
                    key={`column-${position}`}
                    className="absolute inset-y-0 w-px -translate-x-1/2 bg-[#ff7657]/90 shadow-[1px_0_0_rgba(0,0,0,.65)]"
                    style={{ left: `${position}%` }}
                  />
                ))}
                {getGuidePositions(guideRows).map((position) => (
                  <span
                    key={`row-${position}`}
                    className="absolute inset-x-0 h-px -translate-y-1/2 bg-[#ff7657]/90 shadow-[0_1px_0_rgba(0,0,0,.65)]"
                    style={{ top: `${position}%` }}
                  />
                ))}
              </span>
            ) : null}
            {keyboardActive && (mode === "paint" || mode === "select") ? (
              <span
                role="row"
                className="pointer-events-none absolute"
                style={{
                  left: Math.min(width - 1, keyboardCell.x) * zoom,
                  top: Math.min(height - 1, keyboardCell.y) * zoom,
                  width: zoom,
                  height: zoom,
                }}
              >
                <span
                  id="pixel-active-cell"
                  role="gridcell"
                  aria-rowindex={Math.min(height - 1, keyboardCell.y) + 1}
                  aria-colindex={Math.min(width - 1, keyboardCell.x) + 1}
                  aria-label={`Cursor at row ${Math.min(height - 1, keyboardCell.y) + 1}, column ${Math.min(width - 1, keyboardCell.x) + 1}`}
                  className="block size-full border-2 border-[#ef6a47] shadow-[0_0_0_1px_white]"
                />
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <p id="pixel-canvas-instructions" className="sr-only">
        Use arrow keys to move between cells. Press Enter to use the active tool. Hold
        Space and drag, or drag with the right mouse button, to pan.
      </p>

      <div className="pointer-events-none absolute bottom-4 left-4 hidden border border-white/10 bg-[#191a1d]/90 px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-white/45 shadow-lg md:block">
        Space + drag / right-drag to pan
      </div>

      {processing ? (
        <div className="pointer-events-none absolute right-4 bottom-4 flex items-center gap-2 border border-white/10 bg-[#191a1d]/95 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.12em] text-white/60 shadow-lg shadow-black/30">
          <span className="size-2 animate-pulse bg-[#ef6a47]" />
          Quantizing
        </div>
      ) : null}
    </section>
  );
}
