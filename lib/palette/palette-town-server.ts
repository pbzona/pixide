import "server-only";

import { getCache } from "@vercel/functions";

import { paletteTownCacheKey } from "./palette-town";

const runtimeCache = getCache({ namespace: "pixide-palette-town-v1" });

export const PALETTE_TOWN_CACHE_TAG = "palette-town";
export const PALETTE_TOWN_PALETTES_CACHE_TAG = "palette-town:palettes";
export const PALETTE_TOWN_TAGS_CACHE_TAG = "palette-town:tags";

export class PaletteTownError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly retryAfter: string | null = null,
  ) {
    super(message);
  }
}

export const fetchPaletteTown = async (
  pathname: string,
  searchParams?: URLSearchParams,
  validate: (body: unknown) => boolean = () => true,
): Promise<unknown> => {
  const baseUrl = process.env.PALETTE_TOWN_URL?.trim();
  const apiKey = process.env.PALETTE_TOWN_API_KEY?.trim();
  if (!baseUrl || !apiKey || apiKey.length < 32) {
    throw new PaletteTownError("Palette Town is not configured.", 503);
  }

  const url = new URL(pathname, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (searchParams) url.search = searchParams.toString();
  const cacheKey = paletteTownCacheKey(baseUrl, pathname, searchParams);
  const ttl = pathname.endsWith("/tags") ? 300 : 60;

  try {
    const cached = await runtimeCache.get(cacheKey);
    if (cached !== null && validate(cached)) return cached;
    if (cached !== null) await runtimeCache.delete(cacheKey);
  } catch {
    // Cache failures should not make Palette Town unavailable.
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
  } catch {
    throw new PaletteTownError("Palette Town could not be reached.", 503);
  }

  if (!response.ok) {
    const status = response.status === 429 ? 429 : response.status === 400 ? 400 : 503;
    throw new PaletteTownError(
      status === 429 ? "Palette Town is temporarily rate limited." : "Palette Town is unavailable.",
      status,
      response.headers.get("Retry-After"),
    );
  }

  try {
    const body: unknown = await response.json();
    if (!validate(body)) {
      throw new PaletteTownError("Palette Town returned invalid data.", 502);
    }
    try {
      await runtimeCache.set(cacheKey, body, {
        ttl,
        tags: [
          PALETTE_TOWN_CACHE_TAG,
          pathname.endsWith("/tags")
            ? PALETTE_TOWN_TAGS_CACHE_TAG
            : PALETTE_TOWN_PALETTES_CACHE_TAG,
        ],
        name: pathname.endsWith("/tags") ? "Palette Town tags" : "Palette Town search",
      });
    } catch {
      // Return fresh data even when the cache cannot be written.
    }
    return body;
  } catch {
    throw new PaletteTownError("Palette Town returned invalid data.", 502);
  }
};

export const expirePaletteTownCache = (scope: "all" | "palettes" | "tags" = "all") =>
  runtimeCache.expireTag(
    scope === "all"
      ? PALETTE_TOWN_CACHE_TAG
      : scope === "palettes"
        ? PALETTE_TOWN_PALETTES_CACHE_TAG
        : PALETTE_TOWN_TAGS_CACHE_TAG,
  );
