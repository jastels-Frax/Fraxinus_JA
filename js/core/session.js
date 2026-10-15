// js/core/session.js — Session model: one self-contained record per survey visit.
// Pure module. The session object is the single source of truth; the store
// persists it whole after every change.
//
// {
//   v: 2, id, type, status: 'draft' | 'submitted',
//   meta:    { <meta field keys> },
//   obs:     [record], habitat: [record],
//   createdAt, updatedAt, submittedAt?
// }
// record = { id, lat, lng, accuracy, time, updated, photos: [photoId], <field keys> }

import { uid, localISO, isEmpty, isVisible, today } from './fields.js';

export const KINDS = ['obs', 'habitat'];

export function createSession(def, defaults = {}) {
  const meta = {};
  for (const f of def.meta) {
    if (f.default) meta[f.key] = f.default();
  }
  for (const [k, v] of Object.entries(defaults)) {
    if (!isEmpty(v) && def.meta.some(f => f.key === k)) meta[k] = v;
  }
  const now = localISO();
  return {
    v: 2, id: `${def.id}_${Date.now()}`, type: def.id, status: 'draft',
    meta, obs: [], habitat: [], createdAt: now, updatedAt: now,
  };
}

export function newRecord(fields, values = {}) {
  const rec = { id: uid('o'), photos: [] };
  for (const f of fields) if (f.default) rec[f.key] = f.default();
  return Object.assign(rec, values);
}

export function sessionLabel(def, s) {
  const key = s.meta?.[def.labelKey];
  const date = s.meta?.surveyDate || (s.createdAt || '').slice(0, 10) || today();
  return `${def.name} – ${key || 'Untitled'} – ${date}`;
}

export function recordCount(s) {
  return (s.obs?.length || 0) + (s.habitat?.length || 0);
}

export function photoCount(s) {
  return [...(s.obs || []), ...(s.habitat || [])].reduce((n, r) => n + (r.photos?.length || 0), 0);
}

// Required fields that are visible and blank: [label]
export function missingFields(fields, values) {
  return fields.filter(f => f.required && isVisible(f, values) && fieldIsBlank(f, values)).map(f => f.label);
}

function fieldIsBlank(f, v) {
  if (f.type === 'point') return isEmpty(v[f.key + 'Lat']) || isEmpty(v[f.key + 'Lng']);
  return isEmpty(v[f.key]);
}

// True when the session holds nothing worth keeping: no records and no metadata
// beyond auto-filled defaults. Used to silently discard abandoned blank sessions.
const PREFILLED = new Set(['projectID', 'observer']);
export function isBlank(def, s) {
  if (recordCount(s)) return false;
  const auto = new Set(def.meta.filter(f => f.default).map(f => f.key));
  return Object.entries(s.meta || {}).every(([k, v]) => isEmpty(v) || auto.has(k) || PREFILLED.has(k));
}

// Every record's location as [lat, lng] (for map bounds)
export function allPoints(s) {
  return [...(s.obs || []), ...(s.habitat || [])]
    .filter(r => Number.isFinite(r.lat) && Number.isFinite(r.lng));
}
