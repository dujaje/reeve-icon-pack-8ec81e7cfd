# Reece Icon Packs

A Microsoft Word + PowerPoint add-in that gives your team one-click access to a shared library of SVG icons, organised into bundles.

- **Browse** your icon library in a side panel inside Word/PowerPoint
- **Click an icon** to insert it at the cursor (Word: scalable SVG; PowerPoint: high-res raster)
- **Multiple bundles** (e.g. `core`, `flags`) shown as tabs
- **Search** within the active bundle
- **Hosted on GitHub Pages** — add icons, push, done

---

## Project layout

```
office-icon-addin/
├── manifest.xml              # Office Add-in manifest (this is what users install)
├── docs/                     # GitHub Pages root — everything in here is publicly served
│   ├── index.html            # Task pane UI
│   ├── taskpane.js           # Insert logic (Word OOXML + PPT raster)
│   ├── taskpane.css
│   ├── commands.html
│   ├── assets/               # Placeholder add-in icons — replace with your branding
│   └── icons/
│       ├── core/             # Drop your core SVGs here
│       └── flags/            # Drop flag SVGs here
├── scripts/
│   └── build-icon-index.mjs  # Generates docs/icons.json from the icons/ folders
└── .github/workflows/deploy.yml  # Builds the index + deploys to GitHub Pages
```

---

## One-time setup

### 1. Create the GitHub repo

Use an **unguessable repo name** for security-through-obscurity (since the icons aren't sensitive):

```bash
cd ~/Documents/code/office-icon-addin
git init
git add -A
git commit -m "Initial scaffold"
# Replace YOUR_USERNAME and pick a random suffix
gh repo create reece-icon-packs-7a3f9b2c1d --public --source=. --push
```

> The repo is public (required for free GitHub Pages) but the URL is unguessable. Anyone with the URL can see the icons; nobody can find it without it.

### 2. Enable GitHub Pages

In the repo settings → **Pages**, set **Source** to **GitHub Actions**. The first push to `main` triggers a deploy.

Your add-in will then be hosted at:

```
https://YOUR_USERNAME.github.io/reece-icon-packs-7a3f9b2c1d/
```

### 3. Wire the URL into the manifest

Open `manifest.xml` and replace **every occurrence**:

- `{{GITHUB_USERNAME}}` → your GitHub username/org
- `{{REPO_NAME}}` → the repo name you chose above

Commit + push.

### 4. Replace placeholder add-in icons (optional but recommended)

`docs/assets/icon-{16,32,64,80}.png` are 1×1 transparent placeholders so the manifest validates. Replace them with proper square PNGs at those sizes (your team logo, an icon-themed glyph, etc.) so the ribbon button looks right.

### 5. Deploy to your team (Microsoft 365 admin)

1. Go to **Microsoft 365 Admin Center** → **Settings** → **Integrated apps** → **Upload custom apps**.
2. Choose **Office Add-in** → **Provide link to manifest file**, paste:
   ```
   https://YOUR_USERNAME.github.io/reece-icon-packs-7a3f9b2c1d/manifest.xml
   ```
   ⚠️ The manifest needs to be served from Pages too. Either commit `manifest.xml` to `docs/` (in addition to repo root) **or** upload the local file directly in the admin portal.
3. Assign to **Everyone** (or a specific group).
4. Word/PowerPoint will show the **Icon Library** button in the Home ribbon for assigned users within ~24 hours.

> No M365 admin access? Each user can sideload by going to **Insert → Get Add-ins → My Add-ins → Upload My Add-in** and selecting `manifest.xml` locally.

---

## Adding icons

### Add a single icon

1. Drop a `.svg` file into `docs/icons/core/` (or `docs/icons/flags/`)
2. Commit and push to `main`
3. GitHub Actions rebuilds the index and redeploys to Pages (~1 minute)
4. Users click the ⟳ refresh in the task pane (or reopen it) to see the new icon

### Add a new bundle

1. Create a new folder under `docs/icons/`, e.g. `docs/icons/finance/`
2. Drop SVGs in
3. (Optional) Create `docs/icons/finance/_meta.json`:
   ```json
   { "name": "Finance Symbols", "order": 2 }
   ```
4. Commit + push — a new tab appears in the task pane automatically

### Icon SVG conventions

- Keep `viewBox` on the root `<svg>` (used for aspect ratio)
- Self-contained: no external CSS, fonts, or `<image href="…">`
- Kebab-case filenames: `arrow-right.svg` → shown as "arrow-right"

---

## Local development

```bash
npm run serve     # builds icons.json, serves docs/ at http://localhost:8080
```

To test the add-in locally without publishing, you can sideload `manifest.xml` against `http://localhost:8080`, but Office requires HTTPS for production — easier path is to push to a feature branch and use a separate Pages deploy.

---

## How insertion actually works

- **Word**: builds an OOXML package containing the SVG (vector) plus a high-res PNG fallback, then `Word.run` → `range.insertOoxml`. Result is the same scalable SVG drawing you'd get by pasting an SVG from the clipboard.
- **PowerPoint**: rasterizes the SVG to a high-resolution PNG (8× the SVG's intrinsic size) and inserts via `setSelectedDataAsync`. PowerPoint's add-in API doesn't expose a vector-preserving insert path. If you need vector in PowerPoint, copy-paste from Word still works.

---

## Troubleshooting

**Task pane is blank / "Failed to load icons"**
The `icons.json` couldn't be fetched. Check that the GitHub Action ran (Actions tab) and that Pages is serving from the correct branch.

**Icon inserts as a broken image in Word**
Likely the SVG has external references or malformed XML. Open the SVG, ensure it has a self-contained `<svg xmlns="http://www.w3.org/2000/svg" viewBox="…">` root and no `<image href="…">` external links.

**Add-in button doesn't appear in the ribbon**
Centralized deployment can take up to 24 hours to propagate. Try closing and reopening Word/PowerPoint, or sideload locally as a fast check.
