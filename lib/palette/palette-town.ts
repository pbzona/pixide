import { createPalette } from "./create";
import type { Palette } from "./types";

export type PaletteTownSort = "relevance" | "popularity" | "recency" | "name";

export type PaletteTownQuery = Readonly<{
  q?: string;
  tags?: readonly string[];
  minColors?: number;
  maxColors?: number;
  hue?: number;
  hueTolerance?: number;
  color?: string;
  colorTolerance?: number;
  sort?: PaletteTownSort;
  page?: number;
  pageSize?: number;
}>;

export type PaletteTownPagination = Readonly<{
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}>;

export type PaletteTownList = Readonly<{
  palettes: readonly Palette[];
  pagination: PaletteTownPagination;
}>;

export type PaletteTownTag = Readonly<{
  name: string;
  paletteCount: number;
}>;

type ParseResult<T> = Readonly<{ ok: true; value: T } | { ok: false; error: string }>;

const SORTS = new Set<PaletteTownSort>([
  "relevance",
  "popularity",
  "recency",
  "name",
]);
const TAG_PATTERN = /^[a-z0-9]+(?:[ _-][a-z0-9]+)*$/u;
const HEX_PATTERN = /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/u;
const SEARCH_HEX_PATTERN = /^#?(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSafeUrl = (value: unknown): value is string | null => {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

const parseInteger = (
  value: string | null,
  field: string,
  minimum: number,
  maximum: number,
): ParseResult<number | undefined> => {
  if (value === null) return { ok: true, value: undefined };
  if (!/^\d+$/u.test(value)) return { ok: false, error: `${field} must be an integer.` };
  const parsed = Number(value);
  if (parsed < minimum || parsed > maximum) {
    return { ok: false, error: `${field} must be between ${minimum} and ${maximum}.` };
  }
  return { ok: true, value: parsed };
};

const parseNumber = (
  value: string | null,
  field: string,
  minimum: number,
  maximum: number,
  exclusiveMaximum = false,
): ParseResult<number | undefined> => {
  if (value === null) return { ok: true, value: undefined };
  if (!value.trim() || !Number.isFinite(Number(value))) {
    return { ok: false, error: `${field} must be a number.` };
  }
  const parsed = Number(value);
  if (parsed < minimum || (exclusiveMaximum ? parsed >= maximum : parsed > maximum)) {
    return {
      ok: false,
      error: `${field} must be between ${minimum} and ${maximum}${exclusiveMaximum ? " (exclusive)" : ""}.`,
    };
  }
  return { ok: true, value: parsed };
};

export const parsePaletteTownQuery = (
  searchParams: URLSearchParams,
): ParseResult<PaletteTownQuery> => {
  const allowed = new Set([
    "q",
    "tag",
    "minColors",
    "maxColors",
    "hue",
    "hueTolerance",
    "color",
    "colorTolerance",
    "sort",
    "page",
    "pageSize",
  ]);
  for (const key of searchParams.keys()) {
    if (!allowed.has(key)) return { ok: false, error: `Unknown parameter: ${key}.` };
    if (key !== "tag" && searchParams.getAll(key).length > 1) {
      return { ok: false, error: `${key} may only be supplied once.` };
    }
  }

  const q = searchParams.get("q")?.trim();
  if (q && q.length > 100) return { ok: false, error: "q must be at most 100 characters." };

  const tags = searchParams
    .getAll("tag")
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
  if (tags.length > 10) return { ok: false, error: "At most 10 tags may be supplied." };
  if (new Set(tags).size !== tags.length) {
    return { ok: false, error: "Tags must be unique." };
  }
  if (tags.some((tag) => tag.length > 40 || !TAG_PATTERN.test(tag))) {
    return { ok: false, error: "A tag is invalid." };
  }

  const minColors = parseInteger(searchParams.get("minColors"), "minColors", 1, 64);
  if (!minColors.ok) return minColors;
  const maxColors = parseInteger(searchParams.get("maxColors"), "maxColors", 1, 64);
  if (!maxColors.ok) return maxColors;
  if (
    minColors.value !== undefined &&
    maxColors.value !== undefined &&
    minColors.value > maxColors.value
  ) {
    return { ok: false, error: "minColors cannot exceed maxColors." };
  }

  const hue = parseNumber(searchParams.get("hue"), "hue", 0, 360, true);
  if (!hue.ok) return hue;
  const hueTolerance = parseNumber(
    searchParams.get("hueTolerance"),
    "hueTolerance",
    0,
    180,
  );
  if (!hueTolerance.ok) return hueTolerance;
  if (hueTolerance.value !== undefined && hue.value === undefined) {
    return { ok: false, error: "hueTolerance requires hue." };
  }

  const color = searchParams.get("color")?.trim();
  if (color && !SEARCH_HEX_PATTERN.test(color)) {
    return { ok: false, error: "color must be an RGB or RGBA hex value." };
  }
  const colorTolerance = parseNumber(
    searchParams.get("colorTolerance"),
    "colorTolerance",
    0,
    25,
  );
  if (!colorTolerance.ok) return colorTolerance;
  if (colorTolerance.value !== undefined && !color) {
    return { ok: false, error: "colorTolerance requires color." };
  }

  const rawSort = searchParams.get("sort");
  if (rawSort !== null && !SORTS.has(rawSort as PaletteTownSort)) {
    return { ok: false, error: "sort is invalid." };
  }
  if (rawSort === "relevance" && !q) {
    return { ok: false, error: "relevance sorting requires a search query." };
  }

  const page = parseInteger(searchParams.get("page"), "page", 1, 100_000);
  if (!page.ok) return page;
  const pageSize = parseInteger(searchParams.get("pageSize"), "pageSize", 1, 24);
  if (!pageSize.ok) return pageSize;

  return {
    ok: true,
    value: {
      ...(q ? { q } : {}),
      ...(tags.length > 0 ? { tags } : {}),
      ...(minColors.value !== undefined ? { minColors: minColors.value } : {}),
      ...(maxColors.value !== undefined ? { maxColors: maxColors.value } : {}),
      ...(hue.value !== undefined ? { hue: hue.value } : {}),
      ...(hueTolerance.value !== undefined ? { hueTolerance: hueTolerance.value } : {}),
      ...(color ? { color: color.toLowerCase() } : {}),
      ...(colorTolerance.value !== undefined
        ? { colorTolerance: colorTolerance.value }
        : {}),
      ...(rawSort ? { sort: rawSort as PaletteTownSort } : {}),
      ...(page.value ? { page: page.value } : {}),
      ...(pageSize.value ? { pageSize: pageSize.value } : {}),
    },
  };
};

export const serializePaletteTownQuery = (query: PaletteTownQuery) => {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  for (const tag of [...(query.tags ?? [])].sort()) params.append("tag", tag);
  if (query.minColors !== undefined) params.set("minColors", String(query.minColors));
  if (query.maxColors !== undefined) params.set("maxColors", String(query.maxColors));
  if (query.hue !== undefined) params.set("hue", String(query.hue));
  if (query.hueTolerance !== undefined) {
    params.set("hueTolerance", String(query.hueTolerance));
  }
  if (query.color) params.set("color", query.color.toLowerCase());
  if (query.colorTolerance !== undefined) {
    params.set("colorTolerance", String(query.colorTolerance));
  }
  if (query.sort) params.set("sort", query.sort);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  return params;
};

export const paletteTownCacheKey = (
  baseUrl: string,
  pathname: string,
  searchParams?: URLSearchParams,
) => `${baseUrl.replace(/\/$/u, "")}/${pathname}?${searchParams?.toString() ?? ""}`;

const parseRemotePalette = (value: unknown): ParseResult<Palette> => {
  if (!isRecord(value)) return { ok: false, error: "A palette is not an object." };
  if (typeof value.id !== "string" || typeof value.name !== "string") {
    return { ok: false, error: "A palette has an invalid identity." };
  }
  if (
    !Array.isArray(value.colors) ||
    value.colors.length < 1 ||
    value.colors.length > 64 ||
    value.colors.some((color) => typeof color !== "string" || !HEX_PATTERN.test(color)) ||
    new Set(value.colors).size !== value.colors.length ||
    value.colorCount !== value.colors.length
  ) {
    return { ok: false, error: "A palette has invalid colors." };
  }
  if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string")) {
    return { ok: false, error: "A palette has invalid tags." };
  }

  const author = value.author;
  if (
    author !== null &&
    (!isRecord(author) ||
      typeof author.name !== "string" ||
      !isSafeUrl(author.url))
  ) {
    return { ok: false, error: "A palette has an invalid author." };
  }
  const attribution = value.attribution;
  if (
    attribution !== null &&
    (!isRecord(attribution) ||
      (attribution.text !== null && typeof attribution.text !== "string") ||
      !isSafeUrl(attribution.url) ||
      (attribution.license !== null && typeof attribution.license !== "string"))
  ) {
    return { ok: false, error: "A palette has invalid attribution." };
  }

  const created = createPalette(value.id, value.name, value.colors as string[], "palette-town");
  if (!created.ok) return created;
  return {
    ok: true,
    value: {
      ...created.value,
      tags: value.tags as string[],
      author: author as Palette["author"],
      attribution: attribution as Palette["attribution"],
    },
  };
};

export const parsePaletteTownList = (value: unknown): ParseResult<PaletteTownList> => {
  if (!isRecord(value) || !Array.isArray(value.data) || !isRecord(value.pagination)) {
    return { ok: false, error: "Palette Town returned an invalid list." };
  }
  const pagination = value.pagination;
  if (
    !Number.isInteger(pagination.page) ||
    !Number.isInteger(pagination.pageSize) ||
    !Number.isInteger(pagination.totalItems) ||
    !Number.isInteger(pagination.totalPages)
  ) {
    return { ok: false, error: "Palette Town returned invalid pagination." };
  }
  const palettes: Palette[] = [];
  for (const entry of value.data) {
    const parsed = parseRemotePalette(entry);
    if (!parsed.ok) return parsed;
    palettes.push(parsed.value);
  }
  return {
    ok: true,
    value: {
      palettes,
      pagination: pagination as PaletteTownPagination,
    },
  };
};

export const parsePaletteTownTags = (value: unknown): ParseResult<readonly PaletteTownTag[]> => {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    return { ok: false, error: "Palette Town returned invalid tags." };
  }
  if (
    value.data.some(
      (tag) =>
        !isRecord(tag) ||
        typeof tag.name !== "string" ||
        !Number.isInteger(tag.paletteCount) ||
        (tag.paletteCount as number) < 1,
    )
  ) {
    return { ok: false, error: "Palette Town returned invalid tags." };
  }
  return { ok: true, value: value.data as PaletteTownTag[] };
};
