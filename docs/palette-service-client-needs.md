# Palette service client needs

Pixide is a browser-based pixel-art editor. A palette service would primarily help users discover palettes and bring them into the editor, replacing the current small library of built-in and locally stored palettes.

## Minimum useful API

The first integration can be read-only. Pixide needs to:

- List palettes with pagination.
- Search by name and tags.
- Filter by color count, hue, or included color.
- Fetch one complete palette by ID.
- Sort by relevance, popularity, or recency.

List responses should include enough information to render a library card without another request: ID, name, ordered colors, color count, tags, and optional author or attribution.

## Palette representation

Each palette should have a stable string ID, a name, and an ordered collection of colors. Colors should be returned as canonical `#rrggbb` or `#rrggbbaa` values. Pixide supports between 1 and 64 unique colors and accepts alpha values.

```json
{
  "id": "palette_123",
  "name": "Evening Arcade",
  "colors": ["#191724", "#eb6f92", "#f6c177", "#e0def4"],
  "tags": ["dark", "retro"],
  "updatedAt": "2026-07-31T12:00:00Z"
}
```

Color order must be preserved. Stable per-color IDs would also be useful if the service supports editing, although Pixide can assign local numeric IDs when importing a read-only palette.

## Useful later

A deeper integration could let authenticated users save and synchronize their own palettes. Useful operations would include creating, renaming, updating, deleting, and duplicating or forking a public palette. Updates should use a revision number or ETag so the client can detect conflicts instead of silently overwriting newer changes.

Bulk fetching and a “changed since revision” endpoint would make local caching and cross-device synchronization efficient. Visibility and ownership fields would distinguish public, private, and service-provided palettes.

## Client and error requirements

The API must support browser CORS and should provide cache headers for public palettes. Validation errors should identify the invalid color or field. Rate-limit responses should state when the client may retry. The service should normalize colors, remove or reject duplicates, enforce its palette-size limit, and always preserve the returned color order.

Palette adjustments used while editing artwork, such as hue, chroma, lightness, contrast, exclusions, and temporary isolation, should remain local Pixide state rather than properties of the shared palette.
