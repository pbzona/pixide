import { NextResponse } from "next/server";

import { parsePaletteTownTags } from "@/lib/palette/palette-town";
import { fetchPaletteTown, PaletteTownError } from "@/lib/palette/palette-town-server";

export async function GET() {
  try {
    const body = await fetchPaletteTown(
      "api/v1/tags",
      undefined,
      (value) => parsePaletteTownTags(value).ok,
    );
    const parsedBody = parsePaletteTownTags(body);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: "Palette Town returned invalid data." }, { status: 502 });
    }
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=300, must-revalidate" },
    });
  } catch (error) {
    const upstream =
      error instanceof PaletteTownError
        ? error
        : new PaletteTownError("Palette Town is unavailable.", 503);
    return NextResponse.json(
      { error: upstream.message },
      {
        status: upstream.status,
        headers: upstream.retryAfter ? { "Retry-After": upstream.retryAfter } : undefined,
      },
    );
  }
}
