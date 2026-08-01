import "server-only";

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
): Promise<unknown> => {
  const baseUrl = process.env.PALETTE_TOWN_URL?.trim();
  const apiKey = process.env.PALETTE_TOWN_API_KEY?.trim();
  if (!baseUrl || !apiKey || apiKey.length < 32) {
    throw new PaletteTownError("Palette Town is not configured.", 503);
  }

  const url = new URL(pathname, baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`);
  if (searchParams) url.search = searchParams.toString();

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: pathname.endsWith("/tags") ? 300 : 60 },
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
    return await response.json();
  } catch {
    throw new PaletteTownError("Palette Town returned invalid data.", 502);
  }
};
