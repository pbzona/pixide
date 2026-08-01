import { describe, expect, it } from "vitest";

import {
  appendSwatch,
  paletteIdentity,
  parsePaletteTownList,
  parsePaletteTownQuery,
  serializePaletteTownQuery,
} from "@/lib/palette";

const remotePalette = {
  id: "evening-arcade",
  name: "Evening Arcade",
  colors: ["#191724", "#eb6f92", "#f6c177"],
  colorCount: 3,
  tags: ["dark", "retro"],
  popularity: 12,
  author: { name: "Artist", url: "https://example.com/artist" },
  attribution: {
    text: "Used with permission",
    url: "https://example.com/palette",
    license: "CC-BY-4.0",
  },
  createdAt: "2026-07-31T12:00:00Z",
  updatedAt: "2026-07-31T12:00:00Z",
};

describe("Palette Town queries", () => {
  it("normalizes and serializes supported discovery parameters", () => {
    const parsed = parsePaletteTownQuery(
      new URLSearchParams("q= arcade &tag=Retro&tag=dark&sort=relevance&page=2&pageSize=12"),
    );
    expect(parsed).toEqual({
      ok: true,
      value: {
        q: "arcade",
        tags: ["retro", "dark"],
        sort: "relevance",
        page: 2,
        pageSize: 12,
      },
    });
    if (!parsed.ok) return;
    expect(serializePaletteTownQuery(parsed.value).toString()).toBe(
      "q=arcade&tag=retro&tag=dark&sort=relevance&page=2&pageSize=12",
    );
  });

  it("rejects unknown parameters and relevance without a query", () => {
    expect(parsePaletteTownQuery(new URLSearchParams("color=%23fff"))).toEqual({
      ok: false,
      error: "Unknown parameter: color.",
    });
    expect(parsePaletteTownQuery(new URLSearchParams("sort=relevance"))).toEqual({
      ok: false,
      error: "relevance sorting requires a search query.",
    });
  });
});

describe("Palette Town responses", () => {
  it("adapts remote palettes while preserving color order and attribution", () => {
    const parsed = parsePaletteTownList({
      data: [remotePalette],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value.palettes[0]).toMatchObject({
      id: "evening-arcade",
      source: "palette-town",
      tags: ["dark", "retro"],
      attribution: { license: "CC-BY-4.0" },
      colors: [
        { id: 0, hex: "#191724" },
        { id: 1, hex: "#eb6f92" },
        { id: 2, hex: "#f6c177" },
      ],
    });
  });

  it("rejects duplicate colors and forks remote edits into local identity", () => {
    const invalid = parsePaletteTownList({
      data: [{ ...remotePalette, colors: ["#191724", "#191724"], colorCount: 2 }],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    expect(invalid.ok).toBe(false);

    const parsed = parsePaletteTownList({
      data: [remotePalette],
      pagination: { page: 1, pageSize: 12, totalItems: 1, totalPages: 1 },
    });
    if (!parsed.ok) return;
    const edited = appendSwatch(parsed.value.palettes[0], "#ffffff");
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;
    expect(edited.value.source).toBe("local");
    expect(paletteIdentity(edited.value)).toBe("local:evening-arcade");
  });
});
