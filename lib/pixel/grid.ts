export type CellRange = Readonly<{ start: number; end: number }>;

export const getCellRange = (
  cell: number,
  gridSize: number,
  sourceSize: number,
): CellRange => {
  if (gridSize > sourceSize) {
    const sample = Math.min(
      sourceSize - 1,
      Math.floor(((cell + 0.5) * sourceSize) / gridSize),
    );
    return { start: sample, end: sample + 1 };
  }

  const start = Math.floor((cell * sourceSize) / gridSize);
  const end = Math.max(
    start + 1,
    Math.floor(((cell + 1) * sourceSize) / gridSize),
  );
  return { start, end: Math.min(sourceSize, end) };
};

export const dimensionsForAspect = (
  changed: "width" | "height",
  value: number,
  sourceWidth: number,
  sourceHeight: number,
): Readonly<{ width: number; height: number }> => {
  const aspect = sourceWidth / sourceHeight;
  return changed === "width"
    ? { width: value, height: Math.max(1, Math.round(value / aspect)) }
    : { width: Math.max(1, Math.round(value * aspect)), height: value };
};
