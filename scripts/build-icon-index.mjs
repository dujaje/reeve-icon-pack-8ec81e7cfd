#!/usr/bin/env node
/* Scans docs/icons/<bundle>/ for .svg files and writes docs/icons.json.
 *
 * Bundle id  = folder name (e.g. "core", "flags").
 * Bundle name = title-cased folder name; override with a "_meta.json" inside the
 *               bundle folder: { "name": "Country Flags", "order": 1 }.
 *
 * Icon name = filename without extension. Sorted alphabetically.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const ICONS_DIR = path.join(ROOT, 'docs', 'icons');
const OUT = path.join(ROOT, 'docs', 'icons.json');

function titleCase(s) {
  return s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

async function readMeta(bundleDir) {
  try {
    const txt = await fs.readFile(path.join(bundleDir, '_meta.json'), 'utf8');
    return JSON.parse(txt);
  } catch { return {}; }
}

async function main() {
  let entries;
  try {
    entries = await fs.readdir(ICONS_DIR, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') {
      await fs.writeFile(OUT, JSON.stringify({ bundles: [] }, null, 2));
      console.log('No icons/ dir found, wrote empty bundle list.');
      return;
    }
    throw err;
  }

  const bundles = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const bundleDir = path.join(ICONS_DIR, entry.name);
    const meta = await readMeta(bundleDir);

    const files = await fs.readdir(bundleDir);
    const icons = files
      .filter((f) => f.toLowerCase().endsWith('.svg'))
      .sort((a, b) => a.localeCompare(b))
      .map((f) => ({
        name: f.replace(/\.svg$/i, ''),
        path: `icons/${entry.name}/${f}`,
      }));

    if (icons.length === 0) continue;

    bundles.push({
      id: entry.name,
      name: meta.name || titleCase(entry.name),
      order: meta.order ?? 99,
      icons,
    });
  }

  bundles.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  bundles.forEach((b) => delete b.order);

  await fs.writeFile(OUT, JSON.stringify({ bundles }, null, 2));
  const total = bundles.reduce((n, b) => n + b.icons.length, 0);
  console.log(`Wrote ${path.relative(ROOT, OUT)}: ${bundles.length} bundles, ${total} icons.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
