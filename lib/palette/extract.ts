import { formatColorHex, rgba } from "@/lib/color";

type WeightedColor = {
  r: number;
  g: number;
  b: number;
  count: number;
};

type ColorBox = {
  colors: WeightedColor[];
  population: number;
  range: number;
};

type BoxSplit = Readonly<{
  left: ColorBox;
  right: ColorBox;
  channel: "r" | "g" | "b";
  splitIndex: number;
}>;

export type PaletteExtraction = Readonly<{
  colors: readonly string[];
  mode: "exact" | "extracted";
}>;

export type PaletteWeightedColorTrace = Readonly<{
  r: number;
  g: number;
  b: number;
  count: number;
}>;

export type PaletteBoxTrace = Readonly<{
  colors: readonly PaletteWeightedColorTrace[];
  population: number;
  range: number;
  score: number;
  representative: string;
}>;

export type PaletteSplitTrace = Readonly<{
  channel: "r" | "g" | "b";
  splitIndex: number;
  source: PaletteBoxTrace;
  boxes: readonly PaletteBoxTrace[];
}>;

export type PaletteExtractionTrace = Readonly<{
  result: PaletteExtraction;
  exactLimit: number;
  exactColorCount: number;
  histogram: readonly PaletteWeightedColorTrace[];
  initialBox: PaletteBoxTrace | null;
  splits: readonly PaletteSplitTrace[];
}>;

type PaletteTraceCollector = {
  exactColorCount: number;
  histogram: PaletteWeightedColorTrace[];
  initialBox: PaletteBoxTrace | null;
  splits: PaletteSplitTrace[];
};

const colorKey = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

const createBox = (colors: WeightedColor[]): ColorBox => {
  let minR = 255;
  let minG = 255;
  let minB = 255;
  let maxR = 0;
  let maxG = 0;
  let maxB = 0;
  let population = 0;

  for (const color of colors) {
    minR = Math.min(minR, color.r);
    minG = Math.min(minG, color.g);
    minB = Math.min(minB, color.b);
    maxR = Math.max(maxR, color.r);
    maxG = Math.max(maxG, color.g);
    maxB = Math.max(maxB, color.b);
    population += color.count;
  }

  return {
    colors,
    population,
    range: Math.max(maxR - minR, maxG - minG, maxB - minB),
  };
};

const splitBox = (box: ColorBox): BoxSplit | null => {
  if (box.colors.length < 2) return null;

  const ranges = (["r", "g", "b"] as const).map((channel) => {
    const values = box.colors.map((color) => color[channel]);
    return { channel, range: Math.max(...values) - Math.min(...values) };
  });
  const channel = ranges.sort((a, b) => b.range - a.range)[0].channel;
  const sorted = [...box.colors].sort(
    (a, b) => a[channel] - b[channel] || colorKey(a.r, a.g, a.b) - colorKey(b.r, b.g, b.b),
  );

  let cumulative = 0;
  const midpoint = box.population / 2;
  let splitIndex = 1;
  for (; splitIndex < sorted.length; splitIndex += 1) {
    cumulative += sorted[splitIndex - 1].count;
    if (cumulative >= midpoint) break;
  }
  splitIndex = Math.min(sorted.length - 1, Math.max(1, splitIndex));

  return {
    left: createBox(sorted.slice(0, splitIndex)),
    right: createBox(sorted.slice(splitIndex)),
    channel,
    splitIndex,
  };
};

const averageBox = (box: ColorBox): string => {
  let r = 0;
  let g = 0;
  let b = 0;
  for (const color of box.colors) {
    r += color.r * color.count;
    g += color.g * color.count;
    b += color.b * color.count;
  }
  return formatColorHex(rgba(r / box.population, g / box.population, b / box.population));
};

const traceBox = (box: ColorBox): PaletteBoxTrace => ({
  colors: box.colors.map((color) => ({ ...color })),
  population: box.population,
  range: box.range,
  score: box.range * box.population,
  representative: averageBox(box),
});

const runPaletteExtraction = (
  pixels: Uint8ClampedArray,
  requestedColors = 16,
  exactLimit = 64,
  trace?: PaletteTraceCollector,
): PaletteExtraction => {
  let exact: Map<number, WeightedColor> | null = new Map();
  const histogram = new Map<number, WeightedColor>();

  for (let index = 0; index < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue;
    const r = pixels[index];
    const g = pixels[index + 1];
    const b = pixels[index + 2];
    const key = colorKey(r, g, b);
    if (exact) {
      const existing = exact.get(key);
      if (existing) existing.count += 1;
      else {
        exact.set(key, { r, g, b, count: 1 });
        if (exact.size > exactLimit) exact = null;
      }
    }

    const histogramR = (r >> 3) * 8 + 4;
    const histogramG = (g >> 3) * 8 + 4;
    const histogramB = (b >> 3) * 8 + 4;
    const histogramKey = colorKey(histogramR, histogramG, histogramB);
    const histogramEntry = histogram.get(histogramKey);
    if (histogramEntry) histogramEntry.count += 1;
    else {
      histogram.set(histogramKey, {
        r: histogramR,
        g: histogramG,
        b: histogramB,
        count: 1,
      });
    }
  }

  if (trace) {
    trace.exactColorCount = exact?.size ?? exactLimit + 1;
    trace.histogram = [...histogram.values()].map((color) => ({ ...color }));
  }

  if (histogram.size === 0) return { colors: [], mode: "exact" };

  if (exact) {
    return {
      colors: [...exact.values()].map((color) =>
        formatColorHex(rgba(color.r, color.g, color.b)),
      ),
      mode: "exact",
    };
  }

  const target = Math.min(32, Math.max(4, requestedColors));
  const boxes: ColorBox[] = [createBox([...histogram.values()])];
  if (trace) trace.initialBox = traceBox(boxes[0]);

  while (boxes.length < target) {
    boxes.sort((a, b) => b.range * b.population - a.range * a.population);
    const box = boxes.shift();
    if (!box) break;
    const split = splitBox(box);
    if (!split) {
      boxes.unshift(box);
      break;
    }
    boxes.push(split.left, split.right);
    if (trace) {
      trace.splits.push({
        channel: split.channel,
        splitIndex: split.splitIndex,
        source: traceBox(box),
        boxes: boxes.map(traceBox),
      });
    }
  }

  return {
    colors: boxes
      .sort((a, b) => averageLuminance(a) - averageLuminance(b))
      .map(averageBox),
    mode: "extracted",
  };
};

export const extractPaletteFromPixels = (
  pixels: Uint8ClampedArray,
  requestedColors = 16,
  exactLimit = 64,
): PaletteExtraction => runPaletteExtraction(pixels, requestedColors, exactLimit);

export const tracePaletteExtraction = (
  pixels: Uint8ClampedArray,
  requestedColors = 16,
  exactLimit = 64,
): PaletteExtractionTrace => {
  if (pixels.length / 4 > 4_096) {
    throw new Error("Teaching traces are limited to 4096 source pixels.");
  }
  const trace: PaletteTraceCollector = {
    exactColorCount: 0,
    histogram: [],
    initialBox: null,
    splits: [],
  };
  const result = runPaletteExtraction(pixels, requestedColors, exactLimit, trace);
  return {
    result,
    exactLimit,
    exactColorCount: trace.exactColorCount,
    histogram: trace.histogram,
    initialBox: trace.initialBox,
    splits: trace.splits,
  };
};

const averageLuminance = (box: ColorBox): number => {
  let luminance = 0;
  for (const color of box.colors) {
    luminance += (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) * color.count;
  }
  return luminance / box.population;
};
