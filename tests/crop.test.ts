import { describe, expect, it } from "vitest";

import { cropPixels, sourceCropFromCells } from "@/lib/pixel";

describe("source crop", () => {
  it("maps cell edges to the nearest source pixel boundaries", () => {
    expect(
      sourceCropFromCells(
        { left: 1, top: 1, right: 4, bottom: 3 },
        5,
        4,
        13,
        10,
      ),
    ).toEqual({ x: 3, y: 3, width: 7, height: 5 });
  });

  it("normalizes reversed and out-of-range cell bounds", () => {
    expect(
      sourceCropFromCells(
        { left: 5, top: 4, right: -2, bottom: 1 },
        5,
        4,
        10,
        8,
      ),
    ).toEqual({ x: 0, y: 2, width: 10, height: 6 });
  });

  it("keeps a crop valid when the grid is larger than the source", () => {
    expect(
      sourceCropFromCells(
        { left: 1, top: 1, right: 2, bottom: 2 },
        8,
        8,
        2,
        2,
      ),
    ).toEqual({ x: 0, y: 0, width: 1, height: 1 });
  });

  it("copies only the selected source rows and columns", () => {
    const pixels = new Uint8ClampedArray(4 * 3 * 4);
    for (let index = 0; index < 12; index += 1) {
      pixels.set([index, index, index, 255], index * 4);
    }

    expect([...cropPixels(pixels, 4, 3, { x: 1, y: 1, width: 2, height: 2 })]).toEqual([
      5, 5, 5, 255,
      6, 6, 6, 255,
      9, 9, 9, 255,
      10, 10, 10, 255,
    ]);
  });
});
