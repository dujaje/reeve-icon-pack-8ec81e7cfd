/* Reeve Icon Pack - task pane logic
 *
 * Loads icons.json (built by scripts/build-icon-index.mjs), renders bundles as tabs,
 * and inserts the clicked SVG into the active Word document or PowerPoint slide.
 *
 * Word path: OOXML package with SVG primary + PNG fallback (preserves vector).
 * PowerPoint path: high-res PNG via setSelectedDataAsync (PowerPoint add-in API
 * does not expose a reliable vector SVG insert).
 */

const state = {
  bundles: [],
  activeBundle: null,
  filter: '',
};

Office.onReady(() => { init(); });

async function init() {
  try {
    const res = await fetch('icons.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(`icons.json: ${res.status}`);
    const data = await res.json();
    state.bundles = data.bundles || [];

    if (state.bundles.length === 0) {
      showStatus('No icon bundles yet. Add SVGs to docs/icons/<bundle>/ and redeploy.');
      return;
    }

    state.activeBundle = state.bundles[0];
    renderTabs();
    renderGrid();
    document.getElementById('status').textContent = '';

    document.getElementById('search').addEventListener('input', (e) => {
      state.filter = e.target.value.trim().toLowerCase();
      renderGrid();
    });
  } catch (err) {
    showStatus(`Failed to load icons: ${err.message}`, true);
  }
}

function showStatus(msg, isError = false) {
  const el = document.getElementById('status');
  el.textContent = msg;
  el.classList.toggle('error', isError);
}

function renderTabs() {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = state.bundles
    .map((b) => `<button class="tab${b === state.activeBundle ? ' active' : ''}" data-id="${b.id}">${escapeHtml(b.name)} <small>(${b.icons.length})</small></button>`)
    .join('');
  tabs.onclick = (e) => {
    const btn = e.target.closest('.tab');
    if (!btn) return;
    state.activeBundle = state.bundles.find((b) => b.id === btn.dataset.id);
    renderTabs();
    renderGrid();
  };
}

function renderGrid() {
  const grid = document.getElementById('grid');
  if (!state.activeBundle) { grid.innerHTML = ''; return; }

  const icons = state.activeBundle.icons.filter((i) =>
    !state.filter || i.name.toLowerCase().includes(state.filter)
  );

  if (icons.length === 0) {
    grid.innerHTML = '<p class="status">No matches.</p>';
    return;
  }

  grid.innerHTML = icons
    .map((i) => `
      <button class="icon-tile" data-path="${escapeAttr(i.path)}" title="${escapeAttr(i.name)}">
        <img src="${escapeAttr(i.path)}" alt="${escapeAttr(i.name)}" loading="lazy" />
        <span>${escapeHtml(i.name)}</span>
      </button>`)
    .join('');

  grid.onclick = async (e) => {
    const tile = e.target.closest('.icon-tile');
    if (!tile) return;
    tile.classList.add('inserting');
    try {
      await insertSvg(tile.dataset.path);
    } catch (err) {
      console.error(err);
      showStatus(`Insert failed: ${err.message}`, true);
    } finally {
      tile.classList.remove('inserting');
    }
  };
}

async function insertSvg(svgPath) {
  const res = await fetch(svgPath, { cache: 'force-cache' });
  if (!res.ok) throw new Error(`Failed to fetch ${svgPath}`);
  const svgText = await res.text();

  const host = Office.context.host;
  if (host === Office.HostType.Word) {
    await insertIntoWord(svgText);
  } else if (host === Office.HostType.PowerPoint) {
    await insertIntoPowerPoint(svgText);
  } else {
    throw new Error(`Host ${host} not supported`);
  }
}

async function insertIntoWord(svgText) {
  const { width, height } = readSvgDimensions(svgText);
  const pngBase64 = await rasterizeSvg(svgText, Math.max(256, width * 4), Math.max(256, height * 4));

  // EMU = 914400 per inch. Default visual size ~0.5 inch tall, preserve aspect.
  const heightEmu = 457200;
  const widthEmu = Math.round((width / height) * heightEmu);

  const ooxml = buildWordSvgPackage({ svgText, pngBase64, widthEmu, heightEmu });

  await Word.run(async (context) => {
    const range = context.document.getSelection();
    range.insertOoxml(ooxml, Word.InsertLocation.replace);
    await context.sync();
  });
}

async function insertIntoPowerPoint(svgText) {
  const { width, height } = readSvgDimensions(svgText);
  const pngBase64 = await rasterizeSvg(svgText, Math.max(512, width * 8), Math.max(512, height * 8));

  await new Promise((resolve, reject) => {
    Office.context.document.setSelectedDataAsync(
      pngBase64,
      { coercionType: Office.CoercionType.Image },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) resolve();
        else reject(new Error(result.error.message));
      }
    );
  });
}

function readSvgDimensions(svgText) {
  const widthMatch = svgText.match(/\bwidth\s*=\s*"([\d.]+)/i);
  const heightMatch = svgText.match(/\bheight\s*=\s*"([\d.]+)/i);
  const viewBoxMatch = svgText.match(/\bviewBox\s*=\s*"\s*[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)/i);

  let width = widthMatch ? parseFloat(widthMatch[1]) : null;
  let height = heightMatch ? parseFloat(heightMatch[1]) : null;

  if (viewBoxMatch) {
    if (!width) width = parseFloat(viewBoxMatch[1]);
    if (!height) height = parseFloat(viewBoxMatch[2]);
  }
  return { width: width || 24, height: height || 24 };
}

function rasterizeSvg(svgText, w, h) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(w);
        canvas.height = Math.round(h);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        const dataUrl = canvas.toDataURL('image/png');
        resolve(dataUrl.split(',')[1]);
      } catch (err) { reject(err); }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to rasterize SVG'));
    };
    img.src = url;
  });
}

function buildWordSvgPackage({ svgText, pngBase64, widthEmu, heightEmu }) {
  const cleanedSvg = svgText.replace(/<\?xml[^?]*\?>\s*/i, '').trim();
  return `<?xml version="1.0" standalone="yes"?>
<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
  <pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml" pkg:padding="512">
    <pkg:xmlData>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
      </Relationships>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml" pkg:padding="256">
    <pkg:xmlData>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
        <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.svg"/>
      </Relationships>
    </pkg:xmlData>
  </pkg:part>
  <pkg:part pkg:name="/word/media/image1.png" pkg:contentType="image/png" pkg:compression="store"><pkg:binaryData>${pngBase64}</pkg:binaryData></pkg:part>
  <pkg:part pkg:name="/word/media/image1.svg" pkg:contentType="image/svg+xml"><pkg:xmlData>${cleanedSvg}</pkg:xmlData></pkg:part>
  <pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">
    <pkg:xmlData>
      <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture" xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main">
        <w:body>
          <w:p>
            <w:r>
              <w:drawing>
                <wp:inline distT="0" distB="0" distL="0" distR="0">
                  <wp:extent cx="${widthEmu}" cy="${heightEmu}"/>
                  <wp:effectExtent l="0" t="0" r="0" b="0"/>
                  <wp:docPr id="1" name="Icon"/>
                  <wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
                  <a:graphic>
                    <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
                      <pic:pic>
                        <pic:nvPicPr><pic:cNvPr id="1" name="Icon"/><pic:cNvPicPr/></pic:nvPicPr>
                        <pic:blipFill>
                          <a:blip r:embed="rId1">
                            <a:extLst>
                              <a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}">
                                <asvg:svgBlip r:embed="rId2"/>
                              </a:ext>
                            </a:extLst>
                          </a:blip>
                          <a:stretch><a:fillRect/></a:stretch>
                        </pic:blipFill>
                        <pic:spPr>
                          <a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm>
                          <a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
                        </pic:spPr>
                      </pic:pic>
                    </a:graphicData>
                  </a:graphic>
                </wp:inline>
              </w:drawing>
            </w:r>
          </w:p>
        </w:body>
      </w:document>
    </pkg:xmlData>
  </pkg:part>
</pkg:package>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAttr(s) { return escapeHtml(s); }
