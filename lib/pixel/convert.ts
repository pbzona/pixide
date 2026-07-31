import {
  linearToSrgbByte,
  oklabToRgb,
  oklabDistanceSquared,
  rgba,
  rgbToOklab,
  srgbByteToLinear,
} from "@/lib/color";

import { getCellRange } from "./grid";
import { createInputSampler, normalizeInputAdjustments, type InputSample } from "./input-adjust";
import { createPaletteMatcher, type PaletteMatcher } from "./matcher";
import type {
  DiffusionDelivery,
  ImageConversionTrace,
  QuantizationCellTrace,
  TraceSourceRange,
  TraceSourceSample,
} from "./trace";
import {
  MAX_GRID_SIDE,
  METHOD_ATKINSON,
  METHOD_AVERAGE,
  METHOD_BAYER,
  METHOD_BLUE_NOISE,
  METHOD_CENTER,
  METHOD_DITHER,
  METHOD_DOMINANT,
  METHOD_GEOMETRIC_MEDIAN,
  METHOD_INHERIT,
  METHOD_MEDIAN,
  METHOD_RIEMERSMA,
  MIN_GRID_SIDE,
  TRANSPARENT_COLOR_ID,
  conversionMethodCode,
  type ConversionOptions,
  type ConversionResult,
} from "./types";

type SourceImage = Readonly<{
  pixels: Uint8ClampedArray;
  width: number;
  height: number;
}>;

type RepresentativeGrid = {
  colors: Float32Array;
  transparent: Uint8Array;
  initialColors?: Float32Array;
  traceSamples?: readonly (readonly TraceSourceSample[] | undefined)[];
  traceRanges?: readonly (TraceSourceRange | undefined)[];
  traceTransparentCounts?: Uint32Array;
};

const createSample = (): InputSample => ({
  r: 0,
  g: 0,
  b: 0,
  linearR: 0,
  linearG: 0,
  linearB: 0,
  alpha: 0,
});

const sourceRange = (
  xStart: number,
  xEnd: number,
  yStart: number,
  yEnd: number,
): TraceSourceRange => ({
  startX: xStart,
  endX: xEnd,
  startY: yStart,
  endY: yEnd,
});

const traceSample = (
  x: number,
  y: number,
  sample: InputSample,
  transparent: boolean,
  paletteIndex?: number,
): TraceSourceSample => ({
  x,
  y,
  rgb: { r: sample.r, g: sample.g, b: sample.b },
  linear: { r: sample.linearR, g: sample.linearG, b: sample.linearB },
  alpha: sample.alpha,
  transparent,
  ...(paletteIndex === undefined ? {} : { paletteIndex }),
});

const nonzeroHistogram = (
  histogram: Uint32Array,
): readonly Readonly<{ value: number; count: number }>[] => {
  const values: { value: number; count: number }[] = [];
  for (let value = 0; value < histogram.length; value += 1) {
    if (histogram[value] > 0) values.push({ value, count: histogram[value] });
  }
  return values;
};

const validateConversion = (source: SourceImage, options: ConversionOptions) => {
  if (source.width < 1 || source.height < 1) throw new Error("Source image is empty.");
  if (source.pixels.length !== source.width * source.height * 4) {
    throw new Error("Source pixel data does not match its dimensions.");
  }
  if (options.palette.length === 0) throw new Error("Choose at least one palette color.");
  if (
    options.gridWidth < MIN_GRID_SIDE ||
    options.gridHeight < MIN_GRID_SIDE ||
    options.gridWidth > MAX_GRID_SIDE ||
    options.gridHeight > MAX_GRID_SIDE
  ) {
    throw new Error(`Grid dimensions must be between ${MIN_GRID_SIDE} and ${MAX_GRID_SIDE}.`);
  }
  if (!Number.isFinite(options.alphaThreshold) || options.alphaThreshold < 0 || options.alphaThreshold > 255) {
    throw new Error("Alpha threshold must be between 0 and 255.");
  }

  const outputLength = options.gridWidth * options.gridHeight;
  if (options.methodOverrides && options.methodOverrides.length !== outputLength) {
    throw new Error("Method overrides must match the output grid dimensions.");
  }
  if (options.methodOverrides) {
    for (const code of options.methodOverrides) {
      if (code !== METHOD_INHERIT && code > METHOD_GEOMETRIC_MEDIAN) {
        throw new Error(`Unknown conversion method code: ${code}.`);
      }
    }
  }

  const adjustments = normalizeInputAdjustments(options.inputAdjustments);
  if (Object.values(adjustments).some((value) => !Number.isFinite(value))) {
    throw new Error("Input adjustments must be finite numbers.");
  }
};

const convertCenter = (
  source: SourceImage,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  const sample = createSample();
  const sampler = createInputSampler(
    source.pixels,
    source.width,
    source.height,
    options.inputAdjustments,
    options.preserveTransparency,
  );

  for (let gridY = 0; gridY < options.gridHeight; gridY += 1) {
    const sourceY = Math.min(
      source.height - 1,
      Math.floor(((gridY + 0.5) * source.height) / options.gridHeight),
    );
    for (let gridX = 0; gridX < options.gridWidth; gridX += 1) {
      const index = gridY * options.gridWidth + gridX;
      if (methods[index] !== METHOD_CENTER) continue;
      const sourceX = Math.min(
        source.width - 1,
        Math.floor(((gridX + 0.5) * source.width) / options.gridWidth),
      );
      sampler.sample(sourceX, sourceY, sample);
      const transparent = options.preserveTransparency && sample.alpha < options.alphaThreshold;
      const paletteIndex = transparent ? null : matcher.match(sample.r, sample.g, sample.b);
      const inspected = traces && !transparent
        ? matcher.inspect(sample.r, sample.g, sample.b)
        : null;
      if (transparent) {
        output[index] = TRANSPARENT_COLOR_ID;
      } else {
        output[index] = options.palette[paletteIndex!].id;
      }
      if (traces) {
        const tracedSample = traceSample(sourceX, sourceY, sample, transparent);
        traces.push({
          index,
          x: gridX,
          y: gridY,
          sourceRange: sourceRange(sourceX, sourceX + 1, sourceY, sourceY + 1),
          transparent,
          resultColorId: output[index],
          details: {
            kind: "center",
            sample: tracedSample,
            match: inspected,
          },
        });
      }
    }
  }
};

const resolveMethods = (options: ConversionOptions): Uint8Array => {
  const methods = new Uint8Array(options.gridWidth * options.gridHeight);
  const globalMethod = conversionMethodCode(options.method);
  methods.fill(globalMethod);
  if (!options.methodOverrides) return methods;
  for (let index = 0; index < methods.length; index += 1) {
    const override = options.methodOverrides[index];
    if (override !== METHOD_INHERIT) methods[index] = override;
  }
  return methods;
};

const pickDominantIndex = (
  counts: Uint32Array,
  meanR: number,
  meanG: number,
  meanB: number,
  matcher: PaletteMatcher,
): number => {
  let highestCount = 0;
  for (let index = 0; index < counts.length; index += 1) {
    highestCount = Math.max(highestCount, counts[index]);
  }

  const meanLab = rgbToOklab(rgba(meanR, meanG, meanB));
  let winner = 0;
  let winnerDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < counts.length; index += 1) {
    if (counts[index] !== highestCount) continue;
    const distance = oklabDistanceSquared(meanLab, matcher.paletteLabs[index]);
    if (distance < winnerDistance) {
      winner = index;
      winnerDistance = distance;
    }
  }
  return winner;
};

const convertDominant = (
  source: SourceImage,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  const counts = new Uint32Array(options.palette.length);
  const sample = createSample();
  const sampler = createInputSampler(
    source.pixels,
    source.width,
    source.height,
    options.inputAdjustments,
    options.preserveTransparency,
  );

  for (let gridY = 0; gridY < options.gridHeight; gridY += 1) {
    const yRange = getCellRange(gridY, options.gridHeight, source.height);
    for (let gridX = 0; gridX < options.gridWidth; gridX += 1) {
      const outputIndex = gridY * options.gridWidth + gridX;
      if (methods[outputIndex] !== METHOD_DOMINANT) continue;
      const xRange = getCellRange(gridX, options.gridWidth, source.width);
      counts.fill(0);
      let transparent = 0;
      let opaque = 0;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      const samples: TraceSourceSample[] | null = traces ? [] : null;

      for (let y = yRange.start; y < yRange.end; y += 1) {
        for (let x = xRange.start; x < xRange.end; x += 1) {
          sampler.sample(x, y, sample);
          const isTransparent = options.preserveTransparency && sample.alpha < options.alphaThreshold;
          if (isTransparent) {
            transparent += 1;
            samples?.push(traceSample(x, y, sample, true));
            continue;
          }
          const paletteIndex = matcher.match(sample.r, sample.g, sample.b);
          counts[paletteIndex] += 1;
          sumR += sample.r;
          sumG += sample.g;
          sumB += sample.b;
          opaque += 1;
          samples?.push(traceSample(x, y, sample, false, paletteIndex));
        }
      }

      const highestOpaque = counts.reduce((highest, count) => Math.max(highest, count), 0);
      let selectedPaletteIndex: number | null = null;
      if (opaque === 0 || transparent > highestOpaque) {
        output[outputIndex] = TRANSPARENT_COLOR_ID;
      } else {
        selectedPaletteIndex = pickDominantIndex(
          counts,
          sumR / opaque,
          sumG / opaque,
          sumB / opaque,
          matcher,
        );
        output[outputIndex] = options.palette[selectedPaletteIndex].id;
      }
      if (traces) {
        const tiedPaletteIndices: number[] = [];
        for (let index = 0; index < counts.length; index += 1) {
          if (counts[index] === highestOpaque) tiedPaletteIndices.push(index);
        }
        traces.push({
          index: outputIndex,
          x: gridX,
          y: gridY,
          sourceRange: sourceRange(xRange.start, xRange.end, yRange.start, yRange.end),
          transparent: output[outputIndex] === TRANSPARENT_COLOR_ID,
          resultColorId: output[outputIndex],
          details: {
            kind: "dominant",
            samples: samples ?? [],
            counts: [...counts],
            transparentCount: transparent,
            mean: opaque === 0 ? null : { r: sumR / opaque, g: sumG / opaque, b: sumB / opaque },
            highestCount: highestOpaque,
            tiedPaletteIndices,
            selectedPaletteIndex,
          },
        });
      }
    }
  }
};

const averageGrid = (
  source: SourceImage,
  options: ConversionOptions,
  methods: Uint8Array,
  trace = false,
): RepresentativeGrid => {
  const colors = new Float32Array(options.gridWidth * options.gridHeight * 3);
  const transparent = new Uint8Array(options.gridWidth * options.gridHeight);
  const traceSamples: (TraceSourceSample[] | undefined)[] | undefined = trace
    ? new Array(options.gridWidth * options.gridHeight)
    : undefined;
  const traceRanges: (TraceSourceRange | undefined)[] | undefined = trace
    ? new Array(options.gridWidth * options.gridHeight)
    : undefined;
  const traceTransparentCounts = trace
    ? new Uint32Array(options.gridWidth * options.gridHeight)
    : undefined;
  const sample = createSample();
  const sampler = createInputSampler(
    source.pixels,
    source.width,
    source.height,
    options.inputAdjustments,
    options.preserveTransparency,
  );

  for (let gridY = 0; gridY < options.gridHeight; gridY += 1) {
    const yRange = getCellRange(gridY, options.gridHeight, source.height);
    for (let gridX = 0; gridX < options.gridWidth; gridX += 1) {
      const index = gridY * options.gridWidth + gridX;
      if (
        methods[index] !== METHOD_AVERAGE &&
        methods[index] !== METHOD_DITHER &&
        methods[index] !== METHOD_BAYER &&
        methods[index] !== METHOD_ATKINSON &&
        methods[index] !== METHOD_BLUE_NOISE &&
        methods[index] !== METHOD_RIEMERSMA
      ) {
        continue;
      }
      const xRange = getCellRange(gridX, options.gridWidth, source.width);
      const tracedSamples: TraceSourceSample[] | null = trace ? [] : null;
      let sumR = 0;
      let sumG = 0;
      let sumB = 0;
      let opaque = 0;
      let transparentCount = 0;

      for (let y = yRange.start; y < yRange.end; y += 1) {
        for (let x = xRange.start; x < xRange.end; x += 1) {
          sampler.sample(x, y, sample);
          const isTransparent = options.preserveTransparency && sample.alpha < options.alphaThreshold;
          tracedSamples?.push(traceSample(x, y, sample, isTransparent));
          if (isTransparent) {
            transparentCount += 1;
            continue;
          }
          sumR += sample.linearR;
          sumG += sample.linearG;
          sumB += sample.linearB;
          opaque += 1;
        }
      }

      if (opaque === 0 || transparentCount > opaque) {
        transparent[index] = 1;
      } else {
        const colorOffset = index * 3;
        colors[colorOffset] = sumR / opaque;
        colors[colorOffset + 1] = sumG / opaque;
        colors[colorOffset + 2] = sumB / opaque;
      }

      if (traceSamples && traceRanges && traceTransparentCounts) {
        traceSamples[index] = tracedSamples ?? [];
        traceRanges[index] = sourceRange(xRange.start, xRange.end, yRange.start, yRange.end);
        traceTransparentCounts[index] = transparentCount;
      }
    }
  }

  return {
    colors,
    transparent,
    ...(trace
      ? {
          initialColors: colors.slice(),
          traceSamples,
          traceRanges,
          traceTransparentCounts,
        }
      : {}),
  };
};

const BAYER_4X4 = new Uint8Array([
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
]);

// Generated with deterministic toroidal best-candidate placement.
const BLUE_NOISE_8X8 = new Uint8Array([
  7, 47, 15, 59, 4, 62, 12, 39,
  58, 24, 63, 26, 35, 23, 38, 28,
  8, 41, 0, 43, 13, 33, 2, 32,
  49, 17, 56, 16, 50, 27, 44, 20,
  6, 34, 11, 53, 5, 54, 9, 42,
  51, 30, 37, 25, 36, 21, 40, 18,
  14, 48, 3, 61, 10, 60, 1, 55,
  46, 29, 52, 31, 57, 22, 45, 19,
]);

const convertBayer = (
  grid: RepresentativeGrid,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  for (let y = 0; y < options.gridHeight; y += 1) {
    for (let x = 0; x < options.gridWidth; x += 1) {
      const index = y * options.gridWidth + x;
      if (methods[index] !== METHOD_BAYER) continue;
      const matrixValue = BAYER_4X4[(y % 4) * 4 + (x % 4)];
      const threshold = (matrixValue + 0.5) / 16;
      if (grid.transparent[index]) {
        output[index] = TRANSPARENT_COLOR_ID;
        traces?.push({
          index,
          x,
          y,
          sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
          transparent: true,
          resultColorId: output[index],
          details: {
            kind: "bayer",
            samples: grid.traceSamples?.[index] ?? [],
            transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
            representativeLinear: null,
            representativeSrgb: null,
            match: null,
            nearestPaletteIndex: null,
            secondPaletteIndex: null,
            mix: null,
            matrixValue,
            threshold,
          },
        });
        continue;
      }

      const offset = index * 3;
      const r = grid.colors[offset];
      const g = grid.colors[offset + 1];
      const b = grid.colors[offset + 2];
      const srgbR = linearToSrgbByte(r);
      const srgbG = linearToSrgbByte(g);
      const srgbB = linearToSrgbByte(b);
      const nearest = matcher.match(srgbR, srgbG, srgbB);
      const second = matcher.second(srgbR, srgbG, srgbB);
      let mix = 0;

      if (nearest === second) {
        output[index] = options.palette[nearest].id;
      } else {
        const firstColor = matcher.paletteLinear[nearest];
        const secondColor = matcher.paletteLinear[second];
        const deltaR = secondColor.r - firstColor.r;
        const deltaG = secondColor.g - firstColor.g;
        const deltaB = secondColor.b - firstColor.b;
        const denominator = deltaR * deltaR + deltaG * deltaG + deltaB * deltaB;
        mix = denominator === 0
          ? 0
          : Math.min(
              1,
              Math.max(
                0,
                ((r - firstColor.r) * deltaR +
                  (g - firstColor.g) * deltaG +
                  (b - firstColor.b) * deltaB) /
                  denominator,
              ),
            );
        output[index] = options.palette[threshold < mix ? second : nearest].id;
      }
      const inspected = traces ? matcher.inspect(srgbR, srgbG, srgbB) : null;
      traces?.push({
        index,
        x,
        y,
        sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
        transparent: false,
        resultColorId: output[index],
        details: {
          kind: "bayer",
          samples: grid.traceSamples?.[index] ?? [],
          transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
          representativeLinear: { r, g, b },
          representativeSrgb: { r: srgbR, g: srgbG, b: srgbB },
          match: inspected,
          nearestPaletteIndex: nearest,
          secondPaletteIndex: second,
          mix,
          matrixValue,
          threshold,
        },
      });
    }
  }
};

const convertBlueNoise = (
  grid: RepresentativeGrid,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  for (let y = 0; y < options.gridHeight; y += 1) {
    for (let x = 0; x < options.gridWidth; x += 1) {
      const index = y * options.gridWidth + x;
      if (methods[index] !== METHOD_BLUE_NOISE) continue;
      const matrixValue = BLUE_NOISE_8X8[(y % 8) * 8 + (x % 8)];
      const threshold = (matrixValue + 0.5) / 64;
      if (grid.transparent[index]) {
        output[index] = TRANSPARENT_COLOR_ID;
        traces?.push({
          index,
          x,
          y,
          sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
          transparent: true,
          resultColorId: output[index],
          details: {
            kind: "blue-noise",
            samples: grid.traceSamples?.[index] ?? [],
            transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
            representativeLinear: null,
            representativeSrgb: null,
            match: null,
            nearestPaletteIndex: null,
            secondPaletteIndex: null,
            mix: null,
            matrixValue,
            threshold,
          },
        });
        continue;
      }

      const offset = index * 3;
      const r = grid.colors[offset];
      const g = grid.colors[offset + 1];
      const b = grid.colors[offset + 2];
      const srgbR = linearToSrgbByte(r);
      const srgbG = linearToSrgbByte(g);
      const srgbB = linearToSrgbByte(b);
      const nearest = matcher.match(srgbR, srgbG, srgbB);
      const second = matcher.second(srgbR, srgbG, srgbB);
      let mix = 0;

      if (nearest === second) {
        output[index] = options.palette[nearest].id;
      } else {
        const firstColor = matcher.paletteLinear[nearest];
        const secondColor = matcher.paletteLinear[second];
        const deltaR = secondColor.r - firstColor.r;
        const deltaG = secondColor.g - firstColor.g;
        const deltaB = secondColor.b - firstColor.b;
        const denominator = deltaR * deltaR + deltaG * deltaG + deltaB * deltaB;
        mix = denominator === 0
          ? 0
          : Math.min(1, Math.max(0, (
              (r - firstColor.r) * deltaR +
              (g - firstColor.g) * deltaG +
              (b - firstColor.b) * deltaB
            ) / denominator));
        output[index] = options.palette[threshold < mix ? second : nearest].id;
      }

      traces?.push({
        index,
        x,
        y,
        sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
        transparent: false,
        resultColorId: output[index],
        details: {
          kind: "blue-noise",
          samples: grid.traceSamples?.[index] ?? [],
          transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
          representativeLinear: { r, g, b },
          representativeSrgb: { r: srgbR, g: srgbG, b: srgbB },
          match: traces ? matcher.inspect(srgbR, srgbG, srgbB) : null,
          nearestPaletteIndex: nearest,
          secondPaletteIndex: second,
          mix,
          matrixValue,
          threshold,
        },
      });
    }
  }
};

const convertAverage = (
  grid: RepresentativeGrid,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  for (let index = 0; index < output.length; index += 1) {
    if (methods[index] !== METHOD_AVERAGE) continue;
    const x = index % options.gridWidth;
    const y = Math.floor(index / options.gridWidth);
    const offset = index * 3;
    if (grid.transparent[index]) {
      output[index] = TRANSPARENT_COLOR_ID;
    } else {
      const paletteIndex = matcher.match(
        linearToSrgbByte(grid.colors[offset]),
        linearToSrgbByte(grid.colors[offset + 1]),
        linearToSrgbByte(grid.colors[offset + 2]),
      );
      output[index] = options.palette[paletteIndex].id;
    }
    if (traces) {
      const representativeLinear = grid.transparent[index]
        ? null
        : {
            r: grid.colors[offset],
            g: grid.colors[offset + 1],
            b: grid.colors[offset + 2],
          };
      const representativeSrgb = representativeLinear
        ? {
            r: linearToSrgbByte(representativeLinear.r),
            g: linearToSrgbByte(representativeLinear.g),
            b: linearToSrgbByte(representativeLinear.b),
          }
        : null;
      const inspected = representativeSrgb
        ? matcher.inspect(representativeSrgb.r, representativeSrgb.g, representativeSrgb.b)
        : null;
      traces.push({
        index,
        x,
        y,
        sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
        transparent: Boolean(grid.transparent[index]),
        resultColorId: output[index],
        details: {
          kind: "average",
          samples: grid.traceSamples?.[index] ?? [],
          transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
          representativeLinear,
          representativeSrgb,
          match: inspected,
        },
      });
    }
  }
};

const histogramMedian = (histogram: Uint32Array, count: number): number => {
  const midpoint = Math.floor((count - 1) / 2);
  let seen = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    seen += histogram[value];
    if (seen > midpoint) return value;
  }
  return 0;
};

const convertMedian = (
  source: SourceImage,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  const red = new Uint32Array(256);
  const green = new Uint32Array(256);
  const blue = new Uint32Array(256);
  const sample = createSample();
  const sampler = createInputSampler(
    source.pixels,
    source.width,
    source.height,
    options.inputAdjustments,
    options.preserveTransparency,
  );

  for (let gridY = 0; gridY < options.gridHeight; gridY += 1) {
    const yRange = getCellRange(gridY, options.gridHeight, source.height);
    for (let gridX = 0; gridX < options.gridWidth; gridX += 1) {
      const outputIndex = gridY * options.gridWidth + gridX;
      if (methods[outputIndex] !== METHOD_MEDIAN) continue;
      const xRange = getCellRange(gridX, options.gridWidth, source.width);
      red.fill(0);
      green.fill(0);
      blue.fill(0);
      let opaque = 0;
      let transparent = 0;
      const samples: TraceSourceSample[] | null = traces ? [] : null;

      for (let y = yRange.start; y < yRange.end; y += 1) {
        for (let x = xRange.start; x < xRange.end; x += 1) {
          sampler.sample(x, y, sample);
          const isTransparent = options.preserveTransparency && sample.alpha < options.alphaThreshold;
          samples?.push(traceSample(x, y, sample, isTransparent));
          if (isTransparent) {
            transparent += 1;
            continue;
          }
          red[sample.r] += 1;
          green[sample.g] += 1;
          blue[sample.b] += 1;
          opaque += 1;
        }
      }

      const median = opaque === 0
        ? null
        : {
            r: histogramMedian(red, opaque),
            g: histogramMedian(green, opaque),
            b: histogramMedian(blue, opaque),
          };
      if (opaque === 0 || transparent > opaque) {
        output[outputIndex] = TRANSPARENT_COLOR_ID;
      } else {
        output[outputIndex] = options.palette[matcher.match(median!.r, median!.g, median!.b)].id;
      }
      if (traces) {
        const inspected = median && transparent <= opaque
          ? matcher.inspect(median.r, median.g, median.b)
          : null;
        traces.push({
          index: outputIndex,
          x: gridX,
          y: gridY,
          sourceRange: sourceRange(xRange.start, xRange.end, yRange.start, yRange.end),
          transparent: output[outputIndex] === TRANSPARENT_COLOR_ID,
          resultColorId: output[outputIndex],
          details: {
            kind: "median",
            samples: samples ?? [],
            transparentCount: transparent,
            histograms: {
              r: nonzeroHistogram(red),
              g: nonzeroHistogram(green),
              b: nonzeroHistogram(blue),
            },
            median,
            match: inspected,
          },
        });
      }
    }
  }
};

const GEOMETRIC_MEDIAN_BINS = 32 ** 3;
const GEOMETRIC_MEDIAN_ITERATIONS = 12;
const GEOMETRIC_MEDIAN_EPSILON = 0.000_01;

const convertGeometricMedian = (
  source: SourceImage,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  const counts = new Uint32Array(GEOMETRIC_MEDIAN_BINS);
  const knownLabs = new Uint8Array(GEOMETRIC_MEDIAN_BINS);
  const labL = new Float64Array(GEOMETRIC_MEDIAN_BINS);
  const labA = new Float64Array(GEOMETRIC_MEDIAN_BINS);
  const labB = new Float64Array(GEOMETRIC_MEDIAN_BINS);
  const touched: number[] = [];
  const sample = createSample();
  const sampler = createInputSampler(
    source.pixels,
    source.width,
    source.height,
    options.inputAdjustments,
    options.preserveTransparency,
  );
  const readLab = (bin: number) => {
    if (!knownLabs[bin]) {
      const r = Math.floor(bin / 1024);
      const g = Math.floor((bin % 1024) / 32);
      const b = bin % 32;
      const lab = rgbToOklab(rgba((r * 255) / 31, (g * 255) / 31, (b * 255) / 31));
      labL[bin] = lab.l;
      labA[bin] = lab.a;
      labB[bin] = lab.b;
      knownLabs[bin] = 1;
    }
  };

  for (let gridY = 0; gridY < options.gridHeight; gridY += 1) {
    const yRange = getCellRange(gridY, options.gridHeight, source.height);
    for (let gridX = 0; gridX < options.gridWidth; gridX += 1) {
      const index = gridY * options.gridWidth + gridX;
      if (methods[index] !== METHOD_GEOMETRIC_MEDIAN) continue;
      const xRange = getCellRange(gridX, options.gridWidth, source.width);
      touched.length = 0;
      let opaque = 0;
      let transparentCount = 0;
      const tracedSamples: TraceSourceSample[] | null = traces ? [] : null;

      for (let y = yRange.start; y < yRange.end; y += 1) {
        for (let x = xRange.start; x < xRange.end; x += 1) {
          sampler.sample(x, y, sample);
          const transparent = options.preserveTransparency && sample.alpha < options.alphaThreshold;
          tracedSamples?.push(traceSample(x, y, sample, transparent));
          if (transparent) {
            transparentCount += 1;
            continue;
          }
          const bin = (sample.r >> 3) * 1024 + (sample.g >> 3) * 32 + (sample.b >> 3);
          if (counts[bin] === 0) touched.push(bin);
          counts[bin] += 1;
          opaque += 1;
        }
      }

      let initial: { l: number; a: number; b: number } | null = null;
      let median: { l: number; a: number; b: number } | null = null;
      const iterations: { l: number; a: number; b: number }[] | undefined = traces ? [] : undefined;
      if (opaque > 0 && transparentCount <= opaque) {
        let l = 0;
        let a = 0;
        let b = 0;
        for (const bin of touched) {
          readLab(bin);
          l += labL[bin] * counts[bin];
          a += labA[bin] * counts[bin];
          b += labB[bin] * counts[bin];
        }
        l /= opaque;
        a /= opaque;
        b /= opaque;
        initial = { l, a, b };

        for (let iteration = 0; iteration < GEOMETRIC_MEDIAN_ITERATIONS; iteration += 1) {
          let weightedL = 0;
          let weightedA = 0;
          let weightedB = 0;
          let totalWeight = 0;
          let coincidentWeight = 0;
          let residualL = 0;
          let residualA = 0;
          let residualB = 0;
          for (const bin of touched) {
            const dl = l - labL[bin];
            const da = a - labA[bin];
            const db = b - labB[bin];
            const distance = Math.sqrt(dl * dl + da * da + db * db);
            if (distance < Number.EPSILON) {
              coincidentWeight += counts[bin];
              continue;
            }
            const weight = counts[bin] / distance;
            weightedL += labL[bin] * weight;
            weightedA += labA[bin] * weight;
            weightedB += labB[bin] * weight;
            totalWeight += weight;
            residualL -= dl * weight;
            residualA -= da * weight;
            residualB -= db * weight;
          }
          const residual = Math.sqrt(
            residualL * residualL + residualA * residualA + residualB * residualB,
          );
          const staysAtCoincidentPoint = coincidentWeight > 0 && residual <= coincidentWeight;
          const coincidentShare = coincidentWeight > 0 && residual > coincidentWeight
            ? coincidentWeight / residual
            : 0;
          const targetL = totalWeight > 0 ? weightedL / totalWeight : l;
          const targetA = totalWeight > 0 ? weightedA / totalWeight : a;
          const targetB = totalWeight > 0 ? weightedB / totalWeight : b;
          const nextL = staysAtCoincidentPoint ? l : coincidentShare * l + (1 - coincidentShare) * targetL;
          const nextA = staysAtCoincidentPoint ? a : coincidentShare * a + (1 - coincidentShare) * targetA;
          const nextB = staysAtCoincidentPoint ? b : coincidentShare * b + (1 - coincidentShare) * targetB;
          const movement = Math.sqrt((nextL - l) ** 2 + (nextA - a) ** 2 + (nextB - b) ** 2);
          l = nextL;
          a = nextA;
          b = nextB;
          iterations?.push({ l, a, b });
          if (staysAtCoincidentPoint || movement <= GEOMETRIC_MEDIAN_EPSILON) break;
        }
        median = { l, a, b };
      }

      const representativeSrgb = median
        ? oklabToRgb({ ...median, alpha: 1 })
        : null;
      const match = traces && representativeSrgb
        ? matcher.inspect(representativeSrgb.r, representativeSrgb.g, representativeSrgb.b)
        : null;
      if (!representativeSrgb) {
        output[index] = TRANSPARENT_COLOR_ID;
      } else {
        output[index] = options.palette[matcher.match(
          representativeSrgb.r,
          representativeSrgb.g,
          representativeSrgb.b,
        )].id;
      }
      traces?.push({
        index,
        x: gridX,
        y: gridY,
        sourceRange: sourceRange(xRange.start, xRange.end, yRange.start, yRange.end),
        transparent: !representativeSrgb,
        resultColorId: output[index],
        details: {
          kind: "geometric-median",
          samples: tracedSamples ?? [],
          transparentCount,
          initial,
          iterations: iterations ?? [],
          median,
          representativeSrgb,
          match,
        },
      });
      for (const bin of touched) counts[bin] = 0;
    }
  }
};

const addError = (
  colors: Float32Array,
  transparent: Uint8Array,
  methods: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  errorR: number,
  errorG: number,
  errorB: number,
  weight: number,
  method: number,
): boolean => {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const index = y * width + x;
  if (methods[index] !== method || transparent[index]) return false;
  const offset = index * 3;
  colors[offset] += errorR * weight;
  colors[offset + 1] += errorG * weight;
  colors[offset + 2] += errorB * weight;
  return true;
};

const recordDelivery = (
  deliveries: DiffusionDelivery[] | undefined,
  x: number,
  y: number,
  weight: number,
  applied: boolean,
) => {
  deliveries?.push({ x, y, weight, applied });
};

const convertDither = (
  grid: RepresentativeGrid,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  for (let y = 0; y < options.gridHeight; y += 1) {
    for (let x = 0; x < options.gridWidth; x += 1) {
      const index = y * options.gridWidth + x;
      if (methods[index] !== METHOD_DITHER) continue;
      if (grid.transparent[index]) {
        output[index] = TRANSPARENT_COLOR_ID;
        traces?.push({
          index,
          x,
          y,
          sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
          transparent: true,
          resultColorId: output[index],
          details: {
            kind: "diffusion",
            algorithm: "dither",
            samples: grid.traceSamples?.[index] ?? [],
            transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
            representativeLinear: null,
            currentLinear: null,
            currentSrgb: null,
            match: null,
            selectedPaletteIndex: null,
            error: null,
            deliveries: [],
            propagatedWeight: 0,
          },
        });
        continue;
      }

      const offset = index * 3;
      const currentR = Math.min(1, Math.max(0, grid.colors[offset]));
      const currentG = Math.min(1, Math.max(0, grid.colors[offset + 1]));
      const currentB = Math.min(1, Math.max(0, grid.colors[offset + 2]));
      const currentSrgbR = linearToSrgbByte(currentR);
      const currentSrgbG = linearToSrgbByte(currentG);
      const currentSrgbB = linearToSrgbByte(currentB);
      const paletteIndex = matcher.match(currentSrgbR, currentSrgbG, currentSrgbB);
      const matched = options.palette[paletteIndex];
      output[index] = matched.id;

      const errorR = currentR - srgbByteToLinear(matched.color.r);
      const errorG = currentG - srgbByteToLinear(matched.color.g);
      const errorB = currentB - srgbByteToLinear(matched.color.b);
      const deliveries: DiffusionDelivery[] | undefined = traces ? [] : undefined;
      let applied = addError(grid.colors, grid.transparent, methods, options.gridWidth, options.gridHeight, x + 1, y, errorR, errorG, errorB, 7 / 16, METHOD_DITHER);
      recordDelivery(deliveries, x + 1, y, 7 / 16, applied);
      applied = addError(grid.colors, grid.transparent, methods, options.gridWidth, options.gridHeight, x - 1, y + 1, errorR, errorG, errorB, 3 / 16, METHOD_DITHER);
      recordDelivery(deliveries, x - 1, y + 1, 3 / 16, applied);
      applied = addError(grid.colors, grid.transparent, methods, options.gridWidth, options.gridHeight, x, y + 1, errorR, errorG, errorB, 5 / 16, METHOD_DITHER);
      recordDelivery(deliveries, x, y + 1, 5 / 16, applied);
      applied = addError(grid.colors, grid.transparent, methods, options.gridWidth, options.gridHeight, x + 1, y + 1, errorR, errorG, errorB, 1 / 16, METHOD_DITHER);
      recordDelivery(deliveries, x + 1, y + 1, 1 / 16, applied);
      if (traces) {
        const initial = grid.initialColors ?? grid.colors;
        const currentSrgb = { r: currentSrgbR, g: currentSrgbG, b: currentSrgbB };
        const inspected = matcher.inspect(currentSrgbR, currentSrgbG, currentSrgbB);
        traces.push({
          index,
          x,
          y,
          sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
          transparent: false,
          resultColorId: output[index],
          details: {
            kind: "diffusion",
            algorithm: "dither",
            samples: grid.traceSamples?.[index] ?? [],
            transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
            representativeLinear: {
              r: initial[offset],
              g: initial[offset + 1],
              b: initial[offset + 2],
            },
            currentLinear: { r: currentR, g: currentG, b: currentB },
            currentSrgb,
            match: inspected,
            selectedPaletteIndex: paletteIndex,
            error: { r: errorR, g: errorG, b: errorB },
            deliveries: deliveries ?? [],
            propagatedWeight: (deliveries ?? []).reduce(
              (sum, delivery) => sum + (delivery.applied ? delivery.weight : 0),
              0,
            ),
          },
        });
      }
    }
  }
};

const acceptsError = (
  transparent: Uint8Array,
  methods: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  method: number,
) => {
  if (x < 0 || y < 0 || x >= width || y >= height) return false;
  const index = y * width + x;
  return methods[index] === method && !transparent[index];
};

const addAtkinsonError = (
  grid: RepresentativeGrid,
  methods: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  errorR: number,
  errorG: number,
  errorB: number,
) =>
  addError(
    grid.colors,
    grid.transparent,
    methods,
    width,
    height,
    x,
    y,
    errorR,
    errorG,
    errorB,
    1 / 8,
    METHOD_ATKINSON,
  );

const convertAtkinson = (
  grid: RepresentativeGrid,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  const width = options.gridWidth;
  const height = options.gridHeight;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (methods[index] !== METHOD_ATKINSON) continue;
      if (grid.transparent[index]) {
        output[index] = TRANSPARENT_COLOR_ID;
        traces?.push({
          index,
          x,
          y,
          sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
          transparent: true,
          resultColorId: output[index],
          details: {
            kind: "diffusion",
            algorithm: "atkinson",
            samples: grid.traceSamples?.[index] ?? [],
            transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
            representativeLinear: null,
            currentLinear: null,
            currentSrgb: null,
            match: null,
            selectedPaletteIndex: null,
            error: null,
            deliveries: [],
            propagatedWeight: 0,
          },
        });
        continue;
      }

      const offset = index * 3;
      const currentR = Math.min(1, Math.max(0, grid.colors[offset]));
      const currentG = Math.min(1, Math.max(0, grid.colors[offset + 1]));
      const currentB = Math.min(1, Math.max(0, grid.colors[offset + 2]));
      const currentSrgbR = linearToSrgbByte(currentR);
      const currentSrgbG = linearToSrgbByte(currentG);
      const currentSrgbB = linearToSrgbByte(currentB);
      const paletteIndex = matcher.match(currentSrgbR, currentSrgbG, currentSrgbB);
      const matched = options.palette[paletteIndex];
      output[index] = matched.id;

      const errorR = currentR - srgbByteToLinear(matched.color.r);
      const errorG = currentG - srgbByteToLinear(matched.color.g);
      const errorB = currentB - srgbByteToLinear(matched.color.b);
      const deliveries: DiffusionDelivery[] | undefined = traces ? [] : undefined;
      let applied = addAtkinsonError(
        grid,
        methods,
        width,
        height,
        x + 1,
        y,
        errorR,
        errorG,
        errorB,
      );
      recordDelivery(deliveries, x + 1, y, 1 / 8, applied);
      const acceptsRight = acceptsError(
        grid.transparent,
        methods,
        width,
        height,
        x + 1,
        y,
        METHOD_ATKINSON,
      );
      applied = acceptsRight
        ? addAtkinsonError(grid, methods, width, height, x + 2, y, errorR, errorG, errorB)
        : false;
      recordDelivery(deliveries, x + 2, y, 1 / 8, applied);
      applied = addAtkinsonError(grid, methods, width, height, x - 1, y + 1, errorR, errorG, errorB);
      recordDelivery(deliveries, x - 1, y + 1, 1 / 8, applied);
      applied = addAtkinsonError(grid, methods, width, height, x, y + 1, errorR, errorG, errorB);
      recordDelivery(deliveries, x, y + 1, 1 / 8, applied);
      applied = addAtkinsonError(grid, methods, width, height, x + 1, y + 1, errorR, errorG, errorB);
      recordDelivery(deliveries, x + 1, y + 1, 1 / 8, applied);
      const acceptsDown = acceptsError(
        grid.transparent,
        methods,
        width,
        height,
        x,
        y + 1,
        METHOD_ATKINSON,
      );
      applied = acceptsDown
        ? addAtkinsonError(grid, methods, width, height, x, y + 2, errorR, errorG, errorB)
        : false;
      recordDelivery(deliveries, x, y + 2, 1 / 8, applied);
      if (traces) {
        const initial = grid.initialColors ?? grid.colors;
        const currentSrgb = { r: currentSrgbR, g: currentSrgbG, b: currentSrgbB };
        const inspected = matcher.inspect(currentSrgbR, currentSrgbG, currentSrgbB);
        traces.push({
          index,
          x,
          y,
          sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
          transparent: false,
          resultColorId: output[index],
          details: {
            kind: "diffusion",
            algorithm: "atkinson",
            samples: grid.traceSamples?.[index] ?? [],
            transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
            representativeLinear: {
              r: initial[offset],
              g: initial[offset + 1],
              b: initial[offset + 2],
            },
            currentLinear: { r: currentR, g: currentG, b: currentB },
            currentSrgb,
            match: inspected,
            selectedPaletteIndex: paletteIndex,
            error: { r: errorR, g: errorG, b: errorB },
            deliveries: deliveries ?? [],
            propagatedWeight: (deliveries ?? []).reduce(
              (sum, delivery) => sum + (delivery.applied ? delivery.weight : 0),
              0,
            ),
          },
        });
      }
    }
  }
};

const RIEMERSMA_HISTORY_LENGTH = 16;
const RIEMERSMA_WEIGHT_BASE = 16 ** (1 / (RIEMERSMA_HISTORY_LENGTH - 1));

const hilbertCoordinate = (side: number, distance: number): readonly [number, number] => {
  let x = 0;
  let y = 0;
  let remaining = distance;
  for (let scale = 1; scale < side; scale *= 2) {
    const rx = 1 & Math.floor(remaining / 2);
    const ry = 1 & (remaining ^ rx);
    if (ry === 0) {
      if (rx === 1) {
        x = scale - 1 - x;
        y = scale - 1 - y;
      }
      [x, y] = [y, x];
    }
    x += scale * rx;
    y += scale * ry;
    remaining = Math.floor(remaining / 4);
  }
  return [x, y];
};

const convertRiemersma = (
  grid: RepresentativeGrid,
  options: ConversionOptions,
  methods: Uint8Array,
  matcher: PaletteMatcher,
  output: Uint16Array,
  traces?: QuantizationCellTrace[],
) => {
  let side = 1;
  while (side < Math.max(options.gridWidth, options.gridHeight)) side *= 2;
  const history = new Float64Array(RIEMERSMA_HISTORY_LENGTH * 3);
  let historyLength = 0;
  let pathIndex = 0;
  let previousX = -1;
  let previousY = -1;

  for (let distance = 0; distance < side * side; distance += 1) {
    const [x, y] = hilbertCoordinate(side, distance);
    if (x >= options.gridWidth || y >= options.gridHeight) continue;
    if (previousX >= 0 && Math.abs(x - previousX) + Math.abs(y - previousY) !== 1) {
      historyLength = 0;
    }
    previousX = x;
    previousY = y;
    const index = y * options.gridWidth + x;
    if (methods[index] !== METHOD_RIEMERSMA) {
      historyLength = 0;
      pathIndex += 1;
      continue;
    }
    if (grid.transparent[index]) {
      historyLength = 0;
      output[index] = TRANSPARENT_COLOR_ID;
      traces?.push({
        index,
        x,
        y,
        sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
        transparent: true,
        resultColorId: output[index],
        details: {
          kind: "riemersma",
          pathIndex,
          samples: grid.traceSamples?.[index] ?? [],
          transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
          representativeLinear: null,
          adjustment: null,
          currentLinear: null,
          currentSrgb: null,
          match: null,
          selectedPaletteIndex: null,
          error: null,
          history: [],
        },
      });
      pathIndex += 1;
      continue;
    }

    let adjustmentR = 0;
    let adjustmentG = 0;
    let adjustmentB = 0;
    const tracedHistory: {
      age: number;
      weight: number;
      error: { r: number; g: number; b: number };
    }[] | undefined = traces ? [] : undefined;
    for (let historyIndex = 0; historyIndex < historyLength; historyIndex += 1) {
      const age = historyLength - 1 - historyIndex;
      const weight = RIEMERSMA_WEIGHT_BASE ** -age;
      const offset = historyIndex * 3;
      adjustmentR += history[offset] * weight;
      adjustmentG += history[offset + 1] * weight;
      adjustmentB += history[offset + 2] * weight;
      if (traces) {
        tracedHistory?.push({
          age,
          weight,
          error: { r: history[offset], g: history[offset + 1], b: history[offset + 2] },
        });
      }
    }

    const offset = index * 3;
    const representativeLinear = {
      r: grid.colors[offset],
      g: grid.colors[offset + 1],
      b: grid.colors[offset + 2],
    };
    const currentLinear = {
      r: Math.min(1, Math.max(0, representativeLinear.r + adjustmentR)),
      g: Math.min(1, Math.max(0, representativeLinear.g + adjustmentG)),
      b: Math.min(1, Math.max(0, representativeLinear.b + adjustmentB)),
    };
    const currentSrgb = {
      r: linearToSrgbByte(currentLinear.r),
      g: linearToSrgbByte(currentLinear.g),
      b: linearToSrgbByte(currentLinear.b),
    };
    const paletteIndex = matcher.match(currentSrgb.r, currentSrgb.g, currentSrgb.b);
    const matched = options.palette[paletteIndex];
    output[index] = matched.id;
    const error = {
      r: representativeLinear.r - srgbByteToLinear(matched.color.r),
      g: representativeLinear.g - srgbByteToLinear(matched.color.g),
      b: representativeLinear.b - srgbByteToLinear(matched.color.b),
    };

    if (historyLength === RIEMERSMA_HISTORY_LENGTH) {
      history.copyWithin(0, 3);
      historyLength -= 1;
    }
    const historyOffset = historyLength * 3;
    history[historyOffset] = error.r;
    history[historyOffset + 1] = error.g;
    history[historyOffset + 2] = error.b;
    historyLength += 1;

    traces?.push({
      index,
      x,
      y,
      sourceRange: grid.traceRanges?.[index] ?? sourceRange(0, 0, 0, 0),
      transparent: false,
      resultColorId: output[index],
      details: {
        kind: "riemersma",
        pathIndex,
        samples: grid.traceSamples?.[index] ?? [],
        transparentCount: grid.traceTransparentCounts?.[index] ?? 0,
        representativeLinear,
        adjustment: { r: adjustmentR, g: adjustmentG, b: adjustmentB },
        currentLinear,
        currentSrgb,
        match: matcher.inspect(currentSrgb.r, currentSrgb.g, currentSrgb.b),
        selectedPaletteIndex: paletteIndex,
        error,
        history: tracedHistory ?? [],
      },
    });
    pathIndex += 1;
  }
};

const runConversion = (
  pixels: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  options: ConversionOptions,
  traces?: QuantizationCellTrace[],
): ConversionResult => {
  const source = { pixels, width: sourceWidth, height: sourceHeight };
  validateConversion(source, options);
  const matcher = createPaletteMatcher(options.palette);
  const methods = resolveMethods(options);
  const colorIds = new Uint16Array(options.gridWidth * options.gridHeight);

  if (methods.includes(METHOD_DOMINANT)) {
    convertDominant(source, options, methods, matcher, colorIds, traces);
  }
  if (methods.includes(METHOD_MEDIAN)) {
    convertMedian(source, options, methods, matcher, colorIds, traces);
  }
  if (methods.includes(METHOD_GEOMETRIC_MEDIAN)) {
    convertGeometricMedian(source, options, methods, matcher, colorIds, traces);
  }
  if (methods.includes(METHOD_CENTER)) {
    convertCenter(source, options, methods, matcher, colorIds, traces);
  }
  const representativeMethods = [
    METHOD_AVERAGE,
    METHOD_BAYER,
    METHOD_BLUE_NOISE,
    METHOD_DITHER,
    METHOD_ATKINSON,
    METHOD_RIEMERSMA,
  ];
  if (representativeMethods.some((method) => methods.includes(method))) {
    const grid = averageGrid(source, options, methods, Boolean(traces));
    if (methods.includes(METHOD_AVERAGE)) {
      convertAverage(grid, options, methods, matcher, colorIds, traces);
    }
    if (methods.includes(METHOD_BAYER)) {
      convertBayer(grid, options, methods, matcher, colorIds, traces);
    }
    if (methods.includes(METHOD_BLUE_NOISE)) {
      convertBlueNoise(grid, options, methods, matcher, colorIds, traces);
    }
    if (methods.includes(METHOD_DITHER)) {
      convertDither(grid, options, methods, matcher, colorIds, traces);
    }
    if (methods.includes(METHOD_ATKINSON)) {
      convertAtkinson(grid, options, methods, matcher, colorIds, traces);
    }
    if (methods.includes(METHOD_RIEMERSMA)) {
      convertRiemersma(grid, options, methods, matcher, colorIds, traces);
    }
  }

  return { width: options.gridWidth, height: options.gridHeight, colorIds };
};

export const convertImage = (
  pixels: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  options: ConversionOptions,
): ConversionResult => runConversion(pixels, sourceWidth, sourceHeight, options);

export const traceImageConversion = (
  pixels: Uint8ClampedArray,
  sourceWidth: number,
  sourceHeight: number,
  options: ConversionOptions,
): ImageConversionTrace => {
  if (options.methodOverrides) {
    throw new Error("Teaching traces require one conversion method for the full grid.");
  }
  if (sourceWidth * sourceHeight > 4_096 || options.gridWidth * options.gridHeight > 256) {
    throw new Error("Teaching traces are limited to a 64x64 source and 16x16 grid.");
  }
  const cells: QuantizationCellTrace[] = [];
  const result = runConversion(pixels, sourceWidth, sourceHeight, options, cells);
  cells.sort((a, b) => a.index - b.index);
  return {
    method: options.method,
    sourceWidth,
    sourceHeight,
    result,
    cells,
  };
};
