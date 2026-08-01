import { describe, expect, it } from "vitest";

import {
  appendSwatch,
  paletteIdentity,
  paletteTownCacheKey,
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
      new URLSearchParams(
        "q= arcade &tag=Retro&tag=dark&minColors=4&maxColors=16&hue=355&hueTolerance=20&color=%23ff6600&colorTolerance=4.5&sort=relevance&page=2&pageSize=12",
      ),
    );
    expect(parsed).toEqual({
      ok: true,
      value: {
        q: "arcade",
        tags: ["retro", "dark"],
        minColors: 4,
        maxColors: 16,
        hue: 355,
        hueTolerance: 20,
        color: "#ff6600",
        colorTolerance: 4.5,
        sort: "relevance",
        page: 2,
        pageSize: 12,
      },
    });
    if (!parsed.ok) return;
    expect(serializePaletteTownQuery(parsed.value).toString()).toBe(
      "q=arcade&tag=dark&tag=retro&minColors=4&maxColors=16&hue=355&hueTolerance=20&color=%23ff6600&colorTolerance=4.5&sort=relevance&page=2&pageSize=12",
    );
  });

  it("rejects unknown and invalid dependent parameters", () => {
    expect(parsePaletteTownQuery(new URLSearchParams("owner=phil"))).toEqual({
      ok: false,
      error: "Unknown parameter: owner.",
    });
    expect(parsePaletteTownQuery(new URLSearchParams("sort=relevance"))).toEqual({
      ok: false,
      error: "relevance sorting requires a search query.",
    });
    expect(parsePaletteTownQuery(new URLSearchParams("hueTolerance=10"))).toEqual({
      ok: false,
      error: "hueTolerance requires hue.",
    });
    expect(parsePaletteTownQuery(new URLSearchParams("minColors=20&maxColors=10"))).toEqual({
      ok: false,
      error: "minColors cannot exceed maxColors.",
    });
  });

  it("builds stable runtime-cache keys from canonical searches", () => {
    const first = serializePaletteTownQuery({ tags: ["retro", "dark"], page: 1 });
    const second = serializePaletteTownQuery({ tags: ["dark", "retro"], page: 1 });
    expect(paletteTownCacheKey("https://palette.example/", "api/v1/palettes", first)).toBe(
      paletteTownCacheKey("https://palette.example", "api/v1/palettes", second),
    );
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
