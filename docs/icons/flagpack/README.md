# Flag Icons

Drop your flag SVG icons in this folder. Each `.svg` file becomes an icon in the "Flags" bundle.

## Suggested naming

Use ISO 3166-1 alpha-2 country codes (lowercase) so search works predictably:

- `gb.svg` — United Kingdom
- `us.svg` — United States
- `de.svg` — Germany
- `au.svg` — Australia

A good MIT-licensed starter set: <https://github.com/lipis/flag-icons> (copy the `flags/4x3/` files into here).

## Conventions

Same as `core/`:
- Self-contained SVGs (no external assets)
- `viewBox` attribute preserved
- Optional `_meta.json` for bundle name/ordering

After adding flags, commit and push — the GitHub Action handles rebuilding and redeploying.
