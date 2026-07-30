import { NO_OVERRIDE_COLOR_ID } from "./types";

export const finalColorAt = (
  index: number,
  generated: Uint16Array,
  overrides: Int32Array,
): number =>
  overrides[index] === NO_OVERRIDE_COLOR_ID ? generated[index] : overrides[index];

export const lineCells = (
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): readonly Readonly<{ x: number; y: number }>[] => {
  const cells: { x: number; y: number }[] = [];
  let x = fromX;
  let y = fromY;
  const dx = Math.abs(toX - fromX);
  const sx = fromX < toX ? 1 : -1;
  const dy = -Math.abs(toY - fromY);
  const sy = fromY < toY ? 1 : -1;
  let error = dx + dy;

  while (true) {
    cells.push({ x, y });
    if (x === toX && y === toY) break;
    const doubled = error * 2;
    if (doubled >= dy) {
      error += dy;
      x += sx;
    }
    if (doubled <= dx) {
      error += dx;
      y += sy;
    }
  }

  return cells;
};

export const brushIndices = (
  x: number,
  y: number,
  brushSize: number,
  width: number,
  height: number,
): readonly number[] => {
  const indices: number[] = [];
  const before = Math.floor((brushSize - 1) / 2);
  const after = brushSize - before - 1;
  for (let currentY = y - before; currentY <= y + after; currentY += 1) {
    for (let currentX = x - before; currentX <= x + after; currentX += 1) {
      if (currentX >= 0 && currentY >= 0 && currentX < width && currentY < height) {
        indices.push(currentY * width + currentX);
      }
    }
  }
  return indices;
};

export const floodFillIndices = (
  startIndex: number,
  replacementId: number,
  generated: Uint16Array,
  overrides: Int32Array,
  width: number,
  height: number,
  allowedMask?: Uint8Array | null,
): readonly number[] => {
  if (allowedMask && allowedMask.length !== generated.length) {
    throw new RangeError("Fill selection must match the pixel grid dimensions.");
  }
  if (allowedMask && !allowedMask[startIndex]) return [];
  const targetId = finalColorAt(startIndex, generated, overrides);
  if (targetId === replacementId) return [];

  const matched: number[] = [];
  const queue = new Int32Array(generated.length);
  const seen = new Uint8Array(generated.length);
  let read = 0;
  let write = 0;
  queue[write++] = startIndex;
  seen[startIndex] = 1;
  const addNeighbor = (neighbor: number) => {
    if (neighbor >= 0 && !seen[neighbor] && (!allowedMask || allowedMask[neighbor])) {
      seen[neighbor] = 1;
      queue[write++] = neighbor;
    }
  };

  while (read < write) {
    const index = queue[read++];
    if (finalColorAt(index, generated, overrides) !== targetId) continue;
    matched.push(index);
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) addNeighbor(index - 1);
    if (x + 1 < width) addNeighbor(index + 1);
    if (y > 0) addNeighbor(index - width);
    if (y + 1 < height) addNeighbor(index + width);
  }

  return matched;
};
