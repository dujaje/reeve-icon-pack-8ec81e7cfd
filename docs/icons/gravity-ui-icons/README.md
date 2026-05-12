# Core Icons

Drop your core SVG icons in this folder. Each `.svg` file becomes an icon in the "Core" bundle.

## Conventions

- **Filename = icon name** shown in the task pane. Use kebab-case: `arrow-right.svg`, `user-circle.svg`.
- **Keep the `viewBox` attribute** on the root `<svg>` element — the add-in uses it to compute aspect ratio. A `width`/`height` is also fine.
- **No external references** — SVGs must be self-contained (no external CSS, fonts, or `<image href="...">`).
- **Optional**: add a `_meta.json` in this folder to customize the bundle name and ordering:

  ```json
  { "name": "Core Library", "order": 1 }
  ```

After adding icons, commit and push. The GitHub Action rebuilds `icons.json` and redeploys to Pages automatically.
