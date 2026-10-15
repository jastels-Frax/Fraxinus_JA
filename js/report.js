// js/report.js — Editable print-to-PDF report, driven by a survey definition's `report` config.
//
// The report window is opened synchronously (inside the user's tap) so mobile
// popup blockers allow it; imagery and photos are then built and written in.
// If popups are blocked anyway, the finished report downloads as an .html file.

import { displayValue, isEmpty } from './core/fields.js';
import { baseName } from './core/export.js';

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const IMAGERY = 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export';
const HAB_COLOUR = '#0f7abf';

export async function openReport(def, session, { loadPhoto } = {}) {
  const w = window.open('', '_blank');
  if (w) {
    w.document.write('<!doctype html><title>Building report…</title><body style="font:16px sans-serif;padding:40px;color:#444">Building report — fetching imagery and photos…</body>');
  }
  try {
    const html = await buildReportHTML(def, session, { loadPhoto });
    if (w && !w.closed) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    } else {
      downloadText(html, `${baseName(def, session)}_report.html`, 'text/html');
    }
  } catch (err) {
    if (w && !w.closed) w.close();
    throw err;
  }
}

function downloadText(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Imagery ──────────────────────────────────────────────────────────────
function bboxFor(points, { pad, minHalfLat, minHalfLng }) {
  const lats = points.map(p => p.lat), lngs = points.map(p => p.lng);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
  const halfLat = Math.max((Math.max(...lats) - Math.min(...lats)) / 2 + pad, minHalfLat);
  const halfLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) / 2 + pad, minHalfLng);
  return { s: midLat - halfLat, n: midLat + halfLat, w: midLng - halfLng, e: midLng + halfLng };
}

function drawMap(bbox, marks, width = 760, height = 400) {
  const url = `${IMAGERY}?bbox=${bbox.w},${bbox.s},${bbox.e},${bbox.n}&bboxSR=4326&imageSR=4326&size=${width},${height}&f=image`;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = Object.assign(document.createElement('canvas'), { width, height });
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        for (const m of marks) {
          const x = ((m.lng - bbox.w) / (bbox.e - bbox.w)) * width;
          const y = (1 - (m.lat - bbox.s) / (bbox.n - bbox.s)) * height;
          ctx.beginPath(); ctx.arc(x, y, m.r, 0, Math.PI * 2);
          ctx.fillStyle = m.color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          ctx.setLineDash(m.dashed ? [4, 3] : []);
          ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = '#fff';
          ctx.font = `bold ${Math.round(m.r * (m.text.length > 2 ? 0.7 : 0.9))}px sans-serif`;
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(m.text, x, y);
        }
        resolve(c.toDataURL('image/jpeg', 0.85));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

// Groups points within ~150 m so each cluster gets one tight detail map
function clusters(marks, thresh = 0.0014) {
  const used = new Set(), out = [];
  marks.forEach((m, i) => {
    if (used.has(i)) return;
    const group = [m]; used.add(i);
    marks.forEach((o, j) => {
      if (!used.has(j) && Math.abs(m.lat - o.lat) < thresh && Math.abs(m.lng - o.lng) < thresh) { group.push(o); used.add(j); }
    });
    out.push(group);
  });
  return out;
}

async function buildMaps(def, session) {
  const obsMarks = session.obs.map((r, i) => ({ ...r, text: String(i + 1), r: 11, color: def.obs.color(r) }))
    .filter(m => Number.isFinite(m.lat));
  const habMarks = session.habitat.map((r, i) => ({ ...r, text: `H${i + 1}`, r: 10, color: HAB_COLOUR, dashed: true }))
    .filter(m => Number.isFinite(m.lat));
  const all = [...habMarks, ...obsMarks];
  if (!all.length) return { overview: null, details: [] };

  const overview = await drawMap(bboxFor(all, { pad: 0.003, minHalfLat: 0.003, minHalfLng: 0.003 }), all, 760, 380);
  const details = [];
  const groups = clusters(obsMarks.length ? obsMarks : habMarks);
  if (groups.length > 1 || all.length > 1) {
    for (const g of groups) {
      const bbox = bboxFor(g, { pad: 0.0003, minHalfLat: 0.0006, minHalfLng: 0.001 });
      const inView = all.filter(m => m.lat >= bbox.s && m.lat <= bbox.n && m.lng >= bbox.w && m.lng <= bbox.e);
      details.push({ label: inView.map(m => '#' + m.text).join(', '), src: await drawMap(bbox, inView) });
    }
  }
  return { overview, details };
}

// Downscale an image (URL) to a JPEG data URL so the report is self-contained
async function imageDataURL(src, max = 900) {
  const img = await new Promise((resolve, reject) => {
    const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src;
  });
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = Object.assign(document.createElement('canvas'),
    { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

async function photoDataURL(blob) {
  const url = URL.createObjectURL(blob);
  try { return await imageDataURL(url, 900); } finally { URL.revokeObjectURL(url); }
}

// Logos are embedded so they show offline and in the downloaded-HTML fallback
async function logoDataURLs() {
  const src = name => new URL(`../img/${name}`, import.meta.url).href;   // module-relative: works when embedded
  const [color, bw] = await Promise.all([
    imageDataURL(src('LOGO w TEXT white and green.jpg'), 600).catch(() => src('LOGO w TEXT white and green.jpg')),
    imageDataURL(src('LOGO w TEXT black.jpg'), 600).catch(() => src('LOGO w TEXT black.jpg')),
  ]);
  return { color, bw };
}

async function buildPhotos(def, session, loadPhoto) {
  if (!loadPhoto) return [];
  const out = [];
  for (const [kind, prefix] of [['obs', '#'], ['habitat', '#H']]) {
    const kd = kind === 'obs' ? def.obs : def.habitat;
    for (const [i, r] of session[kind].entries()) {
      for (const pid of r.photos || []) {
        const p = await loadPhoto(pid).catch(() => null);
        if (!p?.blob) continue;
        const src = await photoDataURL(p.blob).catch(() => null);
        if (src) out.push({ src, caption: `${prefix}${i + 1} — ${kd.label(r)}` });
      }
    }
  }
  return out;
}

// ─── HTML ─────────────────────────────────────────────────────────────────
function fieldText(f, rec) {
  if (f.type === 'species') return rec[f.key] || rec[f.key + 'Code'] || '';
  if (f.type === 'point') {
    const lat = rec[f.key + 'Lat'], lng = rec[f.key + 'Lng'];
    return isEmpty(lat) ? '' : `${(+lat).toFixed(5)}, ${(+lng).toFixed(5)}`;
  }
  return displayValue(rec[f.key]);
}

const coords = r => (Number.isFinite(r.lat) ? `${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}` : '');

export async function buildReportHTML(def, session, { loadPhoto } = {}) {
  const cfg = def.report;
  const meta = session.meta || {};
  const ctx = { meta, obs: session.obs, habitat: session.habitat, esc };
  const [maps, photos, logo] = await Promise.all([buildMaps(def, session), buildPhotos(def, session, loadPhoto), logoDataURLs()]);
  const today = new Date().toLocaleDateString('en-CA');

  // Survey notes get their own block below Findings rather than a grid cell
  const metaGrid = def.meta.filter(f => f.key !== 'notes').map(f => [f.label, fieldText(f, meta)])
    .filter(([, v]) => v)
    .map(([l, v]) => `<div><div class="ml">${esc(l)}</div><div class="mv" contenteditable="true">${esc(v)}</div></div>`).join('');

  const cols = cfg.columns.map(k => def.obs.fields.find(f => f.key === k)).filter(Boolean);
  const obsRows = session.obs.map((r, i) => `<tr><td>${i + 1}</td>${cols.map((f, j) =>
    `<td contenteditable="true"${j === 0 ? ` style="color:${def.obs.color(r)};font-weight:600"` : ''}>${esc(fieldText(f, r))}</td>`).join('')}
    <td contenteditable="true" class="co">${coords(r)}</td></tr>`).join('');

  const habRows = session.habitat.map((r, i) => `<tr><td>H${i + 1}</td>
    <td contenteditable="true">${esc(r.featureType || '')}</td>
    <td contenteditable="true">${esc((r.criteria || []).join(', '))}</td>
    <td contenteditable="true">${esc(r.note || '')}</td>
    <td contenteditable="true" class="co">${coords(r)}</td></tr>`).join('');

  const stats = cfg.stats(session.obs).map(s =>
    `<div class="sc"><div class="sv"${s.color ? ` style="color:${s.color}"` : ''}>${s.value}</div><div class="sl">${esc(s.label)}</div></div>`).join('');
  const legend = [...cfg.legend, ...(session.habitat.length ? [['Habitat feature (H#)', HAB_COLOUR]] : [])]
    .map(([l, c]) => `<span class="ld"><span class="dot" style="background:${c}"></span>${esc(l)}</span>`).join('');
  const extra = cfg.extra?.(ctx);
  const recKey = cfg.autoRec(ctx);

  const toolbar = (group, id) => `<div class="ptb no-print"><span>Preset:</span>
    <select id="sel-${id}"><option value="">— select template —</option>${Object.keys(cfg.presets[group])
      .map(k => `<option${group === 'recommendations' && k === recKey ? ' selected' : ''}>${esc(k)}</option>`).join('')}</select>
    <button onclick="insertPreset('${group}','${id}',false)">↩ Replace</button>
    <button onclick="insertPreset('${group}','${id}',true)">+ Append</button></div>`;
  const presetHTML = t => t.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');

  let n = 0;
  const h2 = t => `<h2 contenteditable="true">${++n}. ${esc(t)}</h2>`;
  const img = (src, alt) => src ? `<img class="map" src="${src}" alt="${esc(alt)}">`
    : '<p class="na">Map unavailable — imagery could not be loaded (offline?).</p>';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(cfg.title)} — ${esc(meta[def.labelKey] || session.id)}</title>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;600;700&display=swap" rel="stylesheet">
<style>
:root{--ca:#2d6b2d;--cal:#4caf50;--ct:#f8faf8;--cb:#cde8cd}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Oswald,'Segoe UI',sans-serif;color:#1a1a1a;background:#f4f4f4;font-size:10.5pt;line-height:1.55}
@page{margin:8mm 12mm;size:A4}
@media print{*{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}
 body{background:#fff;font-size:9.5pt}.page{box-shadow:none!important;margin:0!important;padding:0!important;max-width:100%!important}
 .ed{border:none!important;padding:0!important}[contenteditable]{outline:none!important;background:transparent!important}
 .fig{break-inside:avoid}}
.top{position:sticky;top:0;background:#111;border-bottom:3px solid var(--ca);z-index:9;padding:8px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;color:#ccc;font-size:.8rem}
.top b{color:#fff;flex:1;min-width:160px}.top small{display:block;color:#888;font-weight:300}
.top select{background:#222;color:#eee;border:1px solid #444;border-radius:4px;padding:4px;font-family:inherit}
.top button,.ptb button{background:var(--ca);color:#fff;border:1px solid var(--cal);border-radius:6px;padding:8px 16px;font-family:inherit;cursor:pointer;text-transform:uppercase;letter-spacing:.06em}
.page{max-width:800px;margin:16px auto 40px;padding:28px 32px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,.12)}
.hdr{display:flex;align-items:center;gap:20px;padding-bottom:14px;border-bottom:3px solid var(--ca);margin-bottom:20px}
.hdr img{height:72px;width:auto}.rt{font-size:1.2rem;font-weight:600}.rd{font-size:.74rem;color:#888;font-weight:300}
.mg{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;padding:14px 16px;background:var(--ct);border:1px solid var(--cb);border-radius:6px}
.ml{font-size:.67rem;text-transform:uppercase;letter-spacing:.08em;color:var(--ca);font-weight:600}.mv{font-size:.87rem}
h2{font-size:.85rem;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--ca);border-bottom:1px solid var(--cb);padding-bottom:3px;margin:22px 0 8px}
.ed{border:1px solid transparent;border-radius:4px;padding:6px 8px;font-size:.87rem;font-weight:300;min-height:1.6em}
.ed:hover,[contenteditable]:focus{background:var(--ct);outline:1px dashed var(--ca)}
.ptb{display:flex;flex-wrap:wrap;gap:6px;align-items:center;background:#f0f0f0;border:1px solid #ddd;border-radius:4px;padding:6px 8px;font-size:.75rem}
.ptb select{flex:1;min-width:160px;font-family:inherit;padding:3px}.ptb button{padding:3px 10px;font-size:.7rem}
.sr{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.sc{background:var(--ct);border:1px solid var(--cb);border-radius:6px;padding:6px 14px;text-align:center;min-width:72px}
.sv{font-size:1.5rem;font-weight:700;color:var(--ca);line-height:1.2}.sl{font-size:.66rem;text-transform:uppercase;color:#666}
table{width:100%;border-collapse:collapse;font-size:.76rem;margin-top:6px}
th{background:var(--ca);color:#fff;font-weight:600;padding:5px 6px;text-align:left;font-size:.7rem}
td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top}tr:nth-child(even) td{background:#f9fbf9}.co{font-size:.7rem;color:#555}
img.map{width:100%;border:1px solid #ccc;border-radius:4px}.na{color:#888;font-style:italic}
.cap{font-size:.76rem;font-weight:600;color:var(--ca);text-transform:uppercase;letter-spacing:.07em;margin:14px 0 4px}
.legend{display:flex;gap:14px;flex-wrap:wrap;font-size:.76rem;margin-top:6px}.ld{display:flex;align-items:center;gap:5px}
.dot{width:11px;height:11px;border-radius:50%;box-shadow:0 0 0 1px #999;display:inline-block}
.photos{display:grid;grid-template-columns:1fr 1fr;gap:12px}.fig img{width:100%;border-radius:4px;border:1px solid #ccc}
.fig div{font-size:.72rem;color:#555}
.ft{margin-top:28px;padding-top:10px;border-top:1px solid var(--cb);display:flex;justify-content:space-between;gap:8px;font-size:.7rem;color:#999}
</style></head><body>
<div class="top no-print"><b>${esc(cfg.title)}<small>Click any text to edit · Chrome/Edge: More settings → untick “Headers and footers”</small></b>
 Logo <select onchange="document.getElementById('logo').src=LOGOS[this.value]"><option value="color">Colour</option><option value="bw">B&amp;W</option></select>
 Theme <select onchange="theme(this.value)"><option value="green">Fraxinus Green</option><option value="navy">Navy &amp; Gold</option><option value="slate">Slate &amp; Teal</option><option value="charcoal">Charcoal &amp; Rust</option><option value="midnight">Midnight Blue</option></select>
 <button onclick="print()">🖨 Print / Save PDF</button></div>
<div class="page">
<div class="hdr"><img id="logo" src="${logo.color}" alt="Fraxinus Environmental &amp; Geomatics" onerror="this.style.display='none'">
 <div><div class="rt" contenteditable="true">${esc(cfg.title)}</div><div class="rd">Created: ${today}${session.submittedAt ? ' · Submitted: ' + esc(String(session.submittedAt).slice(0, 10)) : ''}</div></div></div>
<div class="mg">${metaGrid}</div>
${h2('Introduction')}${toolbar('intro', 'intro')}<div id="intro" class="ed" contenteditable="true">${cfg.intro(ctx)}</div>
${h2('Methods')}${toolbar('methods', 'methods')}<div id="methods" class="ed" contenteditable="true">${cfg.methods(ctx)}</div>
${h2('Findings')}<div class="sr">${stats}</div>${toolbar('findings', 'findings')}<div id="findings" class="ed" contenteditable="true">${cfg.findings(ctx)}</div>
${meta.notes ? `<div class="cap">Field notes</div><div class="ed" contenteditable="true">${esc(meta.notes)}</div>` : ''}
${extra ? h2(extra.title) + extra.html : ''}
${h2(def.obs.title + 's')}
<table><thead><tr><th>#</th>${cols.map(f => `<th>${esc(f.label.replace(/\s*\(.*\)$/, ''))}</th>`).join('')}<th>Coordinates</th></tr></thead><tbody>${obsRows || `<tr><td colspan="${cols.length + 2}"><em>None recorded</em></td></tr>`}</tbody></table>
${session.habitat.length ? `${h2('Habitat Features')}<table><thead><tr><th>#</th><th>Feature</th><th>Criteria met</th><th>Notes</th><th>Coordinates</th></tr></thead><tbody>${habRows}</tbody></table>` : ''}
${h2('Recommendations')}${toolbar('recommendations', 'recs')}<div id="recs" class="ed" contenteditable="true">${presetHTML(cfg.presets.recommendations[recKey] || '')}</div>
${h2('Observation Locations')}<div class="cap">Overview</div>${img(maps.overview, 'Overview map')}<div class="legend">${legend}</div>
${maps.details.map(d => `<div class="fig"><div class="cap">Detail — ${esc(d.label)}</div>${img(d.src, d.label)}</div>`).join('')}
${photos.length ? `${h2('Photographs')}<div class="photos">${photos.map((p, i) => `<div class="fig"><img src="${p.src}" alt=""><div contenteditable="true">Photo ${i + 1}: ${esc(p.caption)}</div></div>`).join('')}</div>` : ''}
<div class="ft"><span contenteditable="true">Fraxinus Environmental &amp; Geomatics</span><span contenteditable="true">${esc(cfg.footer)}</span><span contenteditable="true">${esc(meta.projectID || '')} · ${today}</span></div>
</div>
<script>
const LOGOS=${JSON.stringify(logo)};
const THEMES={green:['#2d6b2d','#4caf50','#f8faf8','#cde8cd'],navy:['#1a3560','#c9a227','#f5f7fb','#b8c8df'],slate:['#2c3e50','#1abc9c','#f4f8f8','#a8d5cb'],charcoal:['#2f2f2f','#c0392b','#f9f8f8','#d5b0ad'],midnight:['#0d1b2a','#3a86ff','#f4f6fb','#9ab4d8']};
function theme(v){const t=THEMES[v]||THEMES.green;['--ca','--cal','--ct','--cb'].forEach((k,i)=>document.documentElement.style.setProperty(k,t[i]));}
const P=${JSON.stringify(cfg.presets).replace(/</g, '\\u003c')};
function insertPreset(g,id,append){const k=document.getElementById('sel-'+id).value;if(!k)return;
 const html=P[g][k].replace(/\\n\\n/g,'<br><br>').replace(/\\n/g,'<br>');const el=document.getElementById(id);
 el.innerHTML=append&&el.innerHTML.trim()?el.innerHTML+'<br><br>'+html:html;el.focus();}
</script></body></html>`;
}

