// js/core/export.js — Session → CSV / GeoJSON / KML / JSON (pure, no DOM).
//
// Every export is built from one table per record kind so all formats carry
// identical columns: session info + every metadata field + record location/time
// + every record field + photo filenames + any legacy extras on migrated data.

import { fieldColumns, fieldKeys, colName, isEmpty } from './fields.js';

const KIND_LABEL = { obs: 'observations', habitat: 'habitat' };
const BASE_KEYS = new Set(['id', 'lat', 'lng', 'accuracy', 'time', 'updated', 'photos']);

export function kindDef(def, kind) {
  return kind === 'habitat' ? def.habitat : def.obs;
}

function cell(v, c) {
  if (isEmpty(v)) return null;
  if (Array.isArray(v)) return v.join(' | ');
  if (c?.num && v !== '' && Number.isFinite(+v)) return +v;
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

// Photo filenames inside the export package, keyed by photo id.
// OBS003_44.65012_-63.57001_1.jpg  ← record #3 (matches report numbering)
export function photoFileNames(session, photoTypes = {}) {
  const names = {};
  for (const kind of ['obs', 'habitat']) {
    (session[kind] || []).forEach((r, i) => {
      (r.photos || []).forEach((pid, n) => {
        const ext = (photoTypes[pid] || 'image/jpeg').split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
        const loc = Number.isFinite(r.lat) ? `_${r.lat.toFixed(5)}_${r.lng.toFixed(5)}` : '';
        names[pid] = `${kind === 'habitat' ? 'HAB' : 'OBS'}${String(i + 1).padStart(3, '0')}${loc}_${n + 1}.${ext}`;
      });
    });
  }
  return names;
}

// { columns: [{col, get(rec)}], rows: [[cell]] }
export function buildTable(def, session, kind, photoNames = {}) {
  const meta = session.meta || {};
  const records = session[kind] || [];
  const fields = kindDef(def, kind).fields;

  const cols = [
    { col: 'SESSION_ID',   get: () => session.id },
    { col: 'SURVEY_TYPE',  get: () => def.name },
    { col: 'SESSION_STATUS', get: () => session.status },
    { col: 'SUBMITTED_AT', get: () => session.submittedAt },
    ...def.meta.flatMap(fieldColumns).map(c => ({ ...c, get: () => meta[c.key] })),
    { col: 'RECORD_TYPE',  get: () => kind === 'habitat' ? 'Habitat' : 'Observation' },
    { col: 'RECORD_NO',    get: (r, i) => i + 1 },
    { col: 'RECORD_ID',    get: r => r.id },
    { col: 'LAT',          get: r => r.lat, num: true },
    { col: 'LNG',          get: r => r.lng, num: true },
    { col: 'GPS_ACCURACY_M', get: r => r.accuracy, num: true },
    { col: 'OBS_TIME',     get: r => r.time },
    { col: 'UPDATED_AT',   get: r => r.updated },
    ...fields.flatMap(fieldColumns).map(c => ({ ...c, get: r => r[c.key] })),
    { col: 'PHOTO_COUNT',  get: r => (r.photos || []).length, num: true },
    { col: 'PHOTO_FILES',  get: r => (r.photos || []).map(p => photoNames[p] || p) },
  ];

  // Keys present on records that no field defines (e.g. migrated legacy data)
  const known = new Set([...BASE_KEYS, ...fields.flatMap(fieldKeys)]);
  const taken = new Set(cols.map(c => c.col));
  const extras = [...new Set(records.flatMap(r => Object.keys(r)))].filter(k => !known.has(k)).sort();
  for (const key of extras) {
    let col = colName(key);
    if (taken.has(col)) col = 'EXTRA_' + col;
    taken.add(col);
    cols.push({ col, key, get: r => r[key] });
  }

  return {
    columns: cols,
    rows: records.map((r, i) => cols.map(c => cell(c.get(r, i), c))),
  };
}

// ─── CSV ──────────────────────────────────────────────────────────────────
const csvCell = v => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function toCSV(table) {
  const lines = [table.columns.map(c => c.col), ...table.rows].map(r => r.map(csvCell).join(','));
  return '﻿' + lines.join('\r\n') + '\r\n';   // BOM so Excel reads UTF-8 (°, é)
}

// ─── GeoJSON ──────────────────────────────────────────────────────────────
export function toGeoJSON(def, session, kind, photoNames) {
  const table = buildTable(def, session, kind, photoNames);
  const records = session[kind] || [];
  const features = table.rows.map((row, i) => {
    const r = records[i];
    const props = {};
    table.columns.forEach((c, j) => { props[c.col] = row[j]; });
    return {
      type: 'Feature',
      geometry: Number.isFinite(r.lat) && Number.isFinite(r.lng)
        ? { type: 'Point', coordinates: [r.lng, r.lat] } : null,
      properties: props,
    };
  });
  return JSON.stringify({ type: 'FeatureCollection', name: `${def.id}_${KIND_LABEL[kind]}`, features }, null, 2);
}

// ─── KML ──────────────────────────────────────────────────────────────────
const xml = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function toKML(def, session, photoNames) {
  const folder = kind => {
    const kd = kindDef(def, kind);
    const table = buildTable(def, session, kind, photoNames);
    const records = session[kind] || [];
    const marks = table.rows.map((row, i) => {
      const r = records[i];
      const data = table.columns.map((c, j) =>
        row[j] == null ? '' : `<Data name="${xml(c.col)}"><value>${xml(row[j])}</value></Data>`).join('');
      const point = Number.isFinite(r.lat) ? `<Point><coordinates>${r.lng},${r.lat},0</coordinates></Point>` : '';
      return `<Placemark><name>${xml(`#${i + 1} ${kd.label(r)}`)}</name><ExtendedData>${data}</ExtendedData>${point}</Placemark>`;
    }).join('\n');
    return `<Folder><name>${xml(kd.title)}</name>\n${marks}\n</Folder>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${xml(def.name)} – ${xml(session.id)}</name>
${folder('obs')}
${folder('habitat')}
</Document></kml>
`;
}

// ─── JSON (lossless) ──────────────────────────────────────────────────────
export function toJSON(def, session, photoNames = {}) {
  return JSON.stringify({
    format: 'fraxinus-wildlife-session', version: 2, survey: def.name,
    exportedAt: new Date().toISOString(),
    photoFiles: photoNames,
    session,
  }, null, 2);
}

// ─── Package (everything that goes in the zip, minus photo bytes) ─────────
export function baseName(def, session) {
  const key = String(session.meta?.[def.labelKey] || 'untitled').replace(/[^\w-]+/g, '_').replace(/^_|_$/g, '');
  const date = session.meta?.surveyDate || String(session.createdAt).slice(0, 10);
  return `${def.id}_${key}_${date}`;
}

export function packageFiles(def, session, photoNames = {}) {
  const files = [
    { name: 'observations.csv',     data: toCSV(buildTable(def, session, 'obs', photoNames)) },
    { name: 'observations.geojson', data: toGeoJSON(def, session, 'obs', photoNames) },
  ];
  if (session.habitat?.length) {
    files.push(
      { name: 'habitat.csv',     data: toCSV(buildTable(def, session, 'habitat', photoNames)) },
      { name: 'habitat.geojson', data: toGeoJSON(def, session, 'habitat', photoNames) });
  }
  files.push(
    { name: 'survey.kml',   data: toKML(def, session, photoNames) },
    { name: 'session.json', data: toJSON(def, session, photoNames) });
  return files;
}
