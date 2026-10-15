// js/core/fields.js — Field-spec helpers shared by forms, exports and reports.
// Pure module: no DOM, no browser globals (runs under Node for tests).
//
// A field spec looks like:
//   { key, label, type, options?, other?, required?, default?, showIf?, hidden?, col?, unit? }
// Types: text | textarea | number | counter | date | time | select | radio |
//        checks | species | point
//   select/radio options: array of strings or {value,label}, or fn(values) → array
//   other: true  → select gets an "Other…" choice backed by a free-text input
//   species      → stores key, keyCode, keySci, keySara, keySrank
//   point        → stores keyLat, keyLng

// camelCase → UPPER_SNAKE  (projectID → PROJECT_ID, tempC → TEMP_C)
export function colName(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toUpperCase();
}

// Columns a field contributes to tabular exports: [{ col, key, num?, list? }]
export function fieldColumns(f) {
  const base = f.col || colName(f.key);
  if (f.type === 'species') return [
    { col: base,                 key: f.key },
    { col: base + '_CODE',       key: f.key + 'Code' },
    { col: base + '_SCIENTIFIC', key: f.key + 'Sci' },
    { col: base + '_SARA',       key: f.key + 'Sara' },
    { col: base + '_SRANK',      key: f.key + 'Srank' },
  ];
  if (f.type === 'point') return [
    { col: base + '_LAT', key: f.key + 'Lat', num: true },
    { col: base + '_LNG', key: f.key + 'Lng', num: true },
  ];
  return [{
    col: base, key: f.key,
    num:  f.type === 'number' || f.type === 'counter',
    list: f.type === 'checks',
  }];
}

// Record keys a field owns (used to tell defined data from legacy extras)
export function fieldKeys(f) {
  return fieldColumns(f).map(c => c.key);
}

export function optionList(f, values = {}) {
  const raw = typeof f.options === 'function' ? f.options(values) : (f.options || []);
  return raw.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
}

export function isVisible(f, values) {
  return !f.hidden && (!f.showIf || f.showIf(values));
}

export function isEmpty(v) {
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

// Human-readable value for tables, KML, reports
export function displayValue(v) {
  if (isEmpty(v)) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

// ─── Time helpers ──────────────────────────────────────────────────────────
const pad = n => String(n).padStart(2, '0');

export function today(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function nowHM(d = new Date()) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ISO 8601 with local offset, e.g. 2026-10-15T14:31:05-03:00
export function localISO(d = new Date()) {
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const a = Math.abs(off);
  return `${today(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
         `${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

export function uid(prefix = 'r') {
  const rnd = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}${rnd}`;
}
