import type { PaletteMatchInspection } from "./matcher";
import type { ConversionMethod, ConversionResult } from "./types";

export type TraceRgb = Readonly<{ r: number; g: number; b: number }>;

export type TraceSourceSample = Readonly<{
  x: number;
  y: number;
  rgb: TraceRgb;
  linear: TraceRgb;
  alpha: number;
  transparent: boolean;
  paletteIndex?: number;
}>;

export type TraceSourceRange = Readonly<{
  startX: number;
  endX: number;
  startY: number;
  endY: number;
}>;

export type DominantTraceDetails = Readonly<{
  kind: "dominant";
  samples: readonly TraceSourceSample[];
  counts: readonly number[];
  transparentCount: number;
  mean: TraceRgb | null;
  highestCount: number;
  tiedPaletteIndices: readonly number[];
  selectedPaletteIndex: number | null;
}>;

export type AverageTraceDetails = Readonly<{
  kind: "average";
  samples: readonly TraceSourceSample[];
  transparentCount: number;
  representativeLinear: TraceRgb | null;
  representativeSrgb: TraceRgb | null;
  match: PaletteMatchInspection | null;
}>;

export type MedianTraceDetails = Readonly<{
  kind: "median";
  samples: readonly TraceSourceSample[];
  transparentCount: number;
  histograms: Readonly<{
    r: readonly Readonly<{ value: number; count: number }>[];
    g: readonly Readonly<{ value: number; count: number }>[];
    b: readonly Readonly<{ value: number; count: number }>[];
  }>;
  median: TraceRgb | null;
  match: PaletteMatchInspection | null;
}>;

export type CenterTraceDetails = Readonly<{
  kind: "center";
  sample: TraceSourceSample;
  match: PaletteMatchInspection | null;
}>;

export type BayerTraceDetails = Readonly<{
  kind: "bayer";
  samples: readonly TraceSourceSample[];
  transparentCount: number;
  representativeLinear: TraceRgb | null;
  representativeSrgb: TraceRgb | null;
  match: PaletteMatchInspection | null;
  nearestPaletteIndex: number | null;
  secondPaletteIndex: number | null;
  mix: number | null;
  matrixValue: number;
  threshold: number;
}>;

export type DiffusionDelivery = Readonly<{
  x: number;
  y: number;
  weight: number;
  applied: boolean;
}>;

export type DiffusionTraceDetails = Readonly<{
  kind: "diffusion";
  algorithm: "dither" | "atkinson";
  samples: readonly TraceSourceSample[];
  transparentCount: number;
  representativeLinear: TraceRgb | null;
  currentLinear: TraceRgb | null;
  currentSrgb: TraceRgb | null;
  match: PaletteMatchInspection | null;
  selectedPaletteIndex: number | null;
  error: TraceRgb | null;
  deliveries: readonly DiffusionDelivery[];
  propagatedWeight: number;
}>;

export type QuantizationTraceDetails =
  | DominantTraceDetails
  | AverageTraceDetails
  | MedianTraceDetails
  | CenterTraceDetails
  | BayerTraceDetails
  | DiffusionTraceDetails;

export type QuantizationCellTrace = Readonly<{
  index: number;
  x: number;
  y: number;
  sourceRange: TraceSourceRange;
  transparent: boolean;
  resultColorId: number;
  details: QuantizationTraceDetails;
}>;

export type ImageConversionTrace = Readonly<{
  method: ConversionMethod;
  sourceWidth: number;
  sourceHeight: number;
  result: ConversionResult;
  cells: readonly QuantizationCellTrace[];
}>;
