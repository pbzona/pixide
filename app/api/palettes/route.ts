import { NextResponse } from "next/server";

import {
  parsePaletteTownList,
  parsePaletteTownQuery,
  serializePaletteTownQuery,
} from "@/lib/palette/palette-town";
import { fetchPaletteTown, PaletteTownError } from "@/lib/palette/palette-town-server";

export async function GET(request: Request) {
  const parsedQuery = parsePaletteTownQuery(new URL(request.url).searchParams);
  if (!parsedQuery.ok) {
    return NextResponse.json({ error: parsedQuery.error }, { status: 400 });
  }

  try {
    const body = await fetchPaletteTown(
      "api/v1/palettes",
      serializePaletteTownQuery(parsedQuery.value),
    );
    const parsedBody = parsePaletteTownList(body);
    if (!parsedBody.ok) {
      return NextResponse.json({ error: "Palette Town returned invalid data." }, { status: 502 });
    }
    return NextResponse.json(body, {
      headers: { "Cache-Control": "private, max-age=60, must-revalidate" },
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
