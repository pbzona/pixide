import type { ConversionMethod, PixelPaletteColor } from "@/lib/pixel";

export type MethodLesson = Readonly<{
  eyebrow: string;
  principle: string;
  explanation: string;
  stages: readonly string[];
  useWhen: string;
  limitation: string;
  exact: readonly string[];
}>;

export const METHOD_LESSONS: Readonly<Record<ConversionMethod, MethodLesson>> = {
  dominant: {
    eyebrow: "Select the most frequent color",
    principle: "Match each source sample to the palette. Count the matches. Select the palette color with the highest count.",
    explanation:
      "This method keeps colors that occur most often in a cell. It does not average the source colors.",
    stages: ["Map source samples", "Match samples to the palette", "Count palette matches", "Resolve equal counts", "Store the color ID"],
    useWhen: "Use this method for shapes with large areas of the same color.",
    limitation: "A difference of one sample can change the output color.",
    exact: [
      "If transparency is enabled, transparent samples have a separate count.",
      "The result is transparent when this count is greater than the largest opaque count.",
      "For equal opaque counts, Pixide compares each color to the mean sRGB color in OKLab.",
    ],
  },
  average: {
    eyebrow: "Calculate a linear RGB mean",
    principle: "Convert each sample from sRGB to linear RGB. Calculate the mean. Match the result to the palette.",
    explanation:
      "A direct sRGB mean can be too dark. Pixide calculates the mean in linear RGB.",
    stages: ["Map source samples", "Convert sRGB to linear RGB", "Calculate the mean", "Convert linear RGB to sRGB", "Match the palette"],
    useWhen: "Use this method for smooth color changes and low image noise.",
    limitation: "The mean can remove small details with high contrast.",
    exact: [
      "Pixide adds the values in each linear RGB channel. It divides each sum by the opaque sample count.",
      "The result is transparent only when transparent samples are the majority. A tie gives a colored result.",
      "The palette lookup uses OKLab distances in a 32x32x32 table.",
    ],
  },
  median: {
    eyebrow: "Select the middle channel values",
    principle: "Create one histogram for each RGB channel. Select the middle value from each histogram.",
    explanation:
      "One very bright or dark sample has less effect on a median than on a mean.",
    stages: ["Map source samples", "Build RGB histograms", "Select three medians", "Combine the channel values", "Match the palette"],
    useWhen: "Use this method when the source has isolated bright, dark, or noisy pixels.",
    limitation: "The three median values can make a color that is not in the source.",
    exact: [
      "Pixide uses three histograms with 256 bins. It does not sort sample arrays.",
      "For an even sample count, Pixide selects the lower median.",
      "This method uses a separate median for each channel. It does not use a geometric median or median cut.",
    ],
  },
  center: {
    eyebrow: "Use one source sample",
    principle: "Find the source pixel at the center of the output cell. Match only that pixel to the palette.",
    explanation:
      "This method does not average adjacent pixels. It keeps hard edges when the source grid and output grid align.",
    stages: ["Locate the output cell", "Calculate the cell center", "Select one source pixel", "Check the alpha value", "Match the palette"],
    useWhen: "Use this method for source images that already have hard pixel edges.",
    limitation: "A thin feature can be missing if it does not cover the center sample.",
    exact: [
      "Pixide calculates the source coordinate as floor((cell + 0.5) * sourceSize / gridSize).",
      "Pixide applies source adjustments before it matches the sampled color.",
      "Only the selected sample affects transparency and palette matching.",
    ],
  },
  dither: {
    eyebrow: "Distribute the quantization error",
    principle: "Select a palette color. Subtract it from the current linear RGB color. Add weighted parts of this difference to four unprocessed cells.",
    explanation:
      "This difference is the quantization error. The output uses patterns of palette colors to represent colors that are not in the palette.",
    stages: ["Calculate cell means", "Add received error", "Select a palette color", "Calculate linear RGB error", "Send error to four cells"],
    useWhen: "Use this method when a small palette must represent gradual changes in tone.",
    limitation: "The scan direction can make a visible pattern. Error does not cross transparent cells or cells that use another method.",
    exact: [
      "Quantization error = current linear RGB color - selected palette color in linear RGB.",
      "The error weights are 7/16 to the right, 3/16 down-left, 5/16 down, and 1/16 down-right.",
      "Pixide scans rows from left to right. It does not reverse the direction on alternate rows.",
      "Pixide calculates and adds error in linear RGB. It does not adjust weights at an image edge.",
    ],
  },
  atkinson: {
    eyebrow: "Send 75 percent of the error",
    principle: "Subtract the selected palette color from the current linear RGB color. Divide this difference into eight equal parts. Send six parts to nearby cells.",
    explanation:
      "This difference is the quantization error. Atkinson sends 75 percent of it to six cells.",
    stages: ["Calculate cell means", "Add received error", "Select a palette color", "Divide error into eighths", "Send six parts"],
    useWhen: "Use this method for a light dither pattern with high local contrast.",
    limitation: "The discarded error reduces color accuracy near the lightest and darkest palette colors.",
    exact: [
      "Quantization error = current linear RGB color - selected palette color in linear RGB.",
      "Six cells receive 1/8 of the error each. Thus, Pixide sends 6/8, or 75 percent, of the error.",
      "Pixide does not send error across an intermediate cell that cannot receive Atkinson error.",
      "Pixide scans rows from left to right. It calculates error in linear RGB.",
    ],
  },
  bayer: {
    eyebrow: "Use a fixed threshold matrix",
    principle: "Calculate a color mix value. Compare it with one value in a repeating 4x4 threshold matrix.",
    explanation:
      "This method uses the same threshold matrix for all cells. It does not transfer error between cells.",
    stages: ["Calculate the cell mean", "Find two nearby palette colors", "Calculate the mix value", "Read the Bayer threshold", "Select a palette color"],
    useWhen: "Use this method for stable patterns or independent cell processing.",
    limitation: "The repeating 4x4 matrix can make a visible regular pattern.",
    exact: [
      "Pixide converts matrix values 0 through 15 to thresholds with (value + 0.5) / 16.",
      "Pixide projects the mean color onto a line between the two palette colors in linear RGB.",
      "The matrix uses global output coordinates. Moving image content changes the matrix position for that content.",
    ],
  },
  "blue-noise": {
    eyebrow: "Scatter thresholds without a visible grid",
    principle: "Calculate a two-color mix. Compare it with one rank in a fixed 8x8 blue-noise threshold map.",
    explanation:
      "The irregular rank map breaks up the repeating crosshatch structure of a Bayer matrix while remaining deterministic.",
    stages: ["Calculate the cell mean", "Find two nearby palette colors", "Calculate the mix value", "Read the blue-noise rank", "Select a palette color"],
    useWhen: "Use this method for stable, grain-like dithering without directional error trails.",
    limitation: "The 8x8 tile still repeats, and isolated ranks can look like fine noise.",
    exact: [
      "Pixide uses a fixed permutation of ranks 0 through 63 generated by toroidal best-candidate placement.",
      "Each rank becomes a threshold with (rank + 0.5) / 64.",
      "Like Bayer dithering, this method projects the mean between the two nearest palette colors in linear RGB.",
    ],
  },
  riemersma: {
    eyebrow: "Follow a space-filling curve",
    principle: "Visit cells along a Hilbert curve. Adjust each cell with a weighted history of the last 16 quantization errors.",
    explanation:
      "The curve repeatedly turns through nearby cells, reducing the directional streaks caused by a row-by-row scan.",
    stages: ["Calculate cell means", "Follow the Hilbert path", "Apply recent errors", "Select a palette color", "Store the new error"],
    useWhen: "Use this method for organic error diffusion with less horizontal or diagonal emphasis.",
    limitation: "A change can affect the next 16 cells on the path, and rectangular edges can interrupt the curve.",
    exact: [
      "Pixide keeps 16 RGB errors. The newest has weight 1 and the oldest has weight 1/16.",
      "Weights decay exponentially between those endpoints.",
      "Transparent cells and cells using another method clear the history so error cannot cross a regional boundary.",
      "The curve is generated on the smallest enclosing power-of-two square; coordinates outside the grid are skipped.",
    ],
  },
  "geometric-median": {
    eyebrow: "Find a robust perceptual center",
    principle: "Convert sampled color bins to OKLab. Repeatedly move toward the point with the smallest total distance to them.",
    explanation:
      "Unlike a mean, the geometric median is resistant to isolated color outliers. Unlike channel median, it treats color as one three-dimensional point.",
    stages: ["Map source samples", "Build the color histogram", "Start at the OKLab mean", "Run Weiszfeld iterations", "Match the palette"],
    useWhen: "Use this method when a cell contains noise or isolated highlights but its overall color should remain stable.",
    limitation: "The iterative calculation is slower than average or channel median, and uses 5-bit RGB histogram bins.",
    exact: [
      "Pixide groups source colors into the same 32x32x32 RGB resolution used by its palette lookup table.",
      "The first point is the weighted OKLab mean. Each Weiszfeld iteration weights a bin by count divided by distance.",
      "Iteration stops after 12 steps or when movement is at most 0.00001 in OKLab.",
    ],
  },
};

export const TEACHING_PALETTE: readonly PixelPaletteColor[] = [
  { id: 10, color: { r: 23, g: 21, b: 19, alpha: 1 } },
  { id: 20, color: { r: 72, g: 101, b: 106, alpha: 1 } },
  { id: 30, color: { r: 239, g: 106, b: 71, alpha: 1 } },
  { id: 40, color: { r: 241, g: 232, b: 217, alpha: 1 } },
];

type RgbTuple = readonly [number, number, number];

const clampByte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));

const createPixels = (sample: (x: number, y: number) => RgbTuple) => {
  const pixels = new Uint8ClampedArray(8 * 8 * 4);
  for (let y = 0; y < 8; y += 1) {
    for (let x = 0; x < 8; x += 1) {
      const [r, g, b] = sample(x, y);
      pixels.set([clampByte(r), clampByte(g), clampByte(b), 255], (y * 8 + x) * 4);
    }
  }
  return pixels;
};

const paletteRgb = (index: number): RgbTuple => {
  const color = TEACHING_PALETTE[index % TEACHING_PALETTE.length].color;
  return [color.r, color.g, color.b];
};

export const lessonPixels = (method: ConversionMethod): Uint8ClampedArray => {
  if (method === "dominant") {
    return createPixels((x, y) => {
      const gridX = Math.floor(x / 2);
      const gridY = Math.floor(y / 2);
      const sample = (y % 2) * 2 + (x % 2);
      const base = (gridX + gridY) % TEACHING_PALETTE.length;
      return paletteRgb(sample === 3 ? base + 1 : base);
    });
  }

  if (method === "median") {
    return createPixels((x, y) => {
      const gridX = Math.floor(x / 2);
      const gridY = Math.floor(y / 2);
      const isOutlier = x % 2 === 0 && y % 2 === 0;
      if (isOutlier) return [250, 246, 235];
      const base = 42 + (gridX + gridY) * 20;
      return [base + 14, base, base - 8];
    });
  }

  if (method === "center") {
    return createPixels((x, y) => {
      const gridX = Math.floor(x / 2);
      const gridY = Math.floor(y / 2);
      const base = (gridX + gridY) % TEACHING_PALETTE.length;
      const isCenterSample = x % 2 === 1 && y % 2 === 1;
      return paletteRgb(isCenterSample ? base + 1 : base);
    });
  }

  if (method === "bayer") {
    return createPixels(() => [167, 145, 125]);
  }

  if (method === "blue-noise") {
    return createPixels(() => [167, 145, 125]);
  }

  if (method === "dither" || method === "atkinson" || method === "riemersma") {
    return createPixels((x, y) => {
      const gridX = Math.floor(x / 2);
      const gridY = Math.floor(y / 2);
      const amount = (gridX + gridY) / 6;
      return [45 + amount * 190, 43 + amount * 175, 40 + amount * 155];
    });
  }

  if (method === "geometric-median") {
    return createPixels((x, y) => {
      const gridX = Math.floor(x / 2);
      const gridY = Math.floor(y / 2);
      const outlier = x % 2 === 0 && y % 2 === 0;
      if (outlier) return paletteRgb(gridX + gridY + 2);
      const base = paletteRgb(gridX + gridY + 1);
      return [base[0] + (x % 2) * 5, base[1] + (y % 2) * 5, base[2]];
    });
  }

  return createPixels((x, y) => {
    const amount = (x + y) / 14;
    return [35 + amount * 205, 52 + amount * 165, 58 + amount * 145];
  });
};

export const PALETTE_EXTRACTION_PIXELS = createPixels((x, y) => {
  const cluster = (Math.floor(x / 2) + Math.floor(y / 2) * 2) % 4;
  const noise = ((x * 17 + y * 29) % 23) - 11;
  const centers: readonly RgbTuple[] = [
    [35, 47, 52],
    [220, 91, 61],
    [76, 132, 129],
    [232, 211, 177],
  ];
  const center = centers[cluster];
  return [center[0] + noise, center[1] - noise / 2, center[2] + noise / 3];
});

export const EXACT_PALETTE_PIXELS = createPixels((x, y) =>
  paletteRgb((Math.floor(x / 2) + Math.floor(y / 2)) % TEACHING_PALETTE.length),
);
