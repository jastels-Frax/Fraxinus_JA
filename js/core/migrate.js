// js/core/migrate.js — Converts data written by app v1 (SpeciesSurveyDB) to v2 sessions.
// Pure module: the store reads the old database and hands the raw objects here.
//
// v1 kept per-survey metadata under prefixed keys (mooseObserver, nestSiteName…),
// copied that metadata onto every observation, and stored Leaflet-style latlng.
// v2 keeps metadata once per session and plain lat/lng on each record.

import { uid, localISO, isEmpty } from './fields.js';
import { getSurvey } from '../surveys/index.js';

const TYPE_MAP = { BBS: 'BBS', MOOSE: 'WILDLIFE', TURTLE: 'TURTLE', NEST: 'NEST' };
const PREFIX = { MOOSE: 'moose', TURTLE: 'turtle', NEST: 'nest' };
const PRIMARY_STORE = { BBS: 'speciesMarkers', MOOSE: 'mooseObservations', TURTLE: 'turtleObservations', NEST: 'nestObservations' };

// Metadata that v1 duplicated onto each record — dropped from records on migration
const COPIED_META = new Set([
  'projectID', 'pointID', 'observer', 'surveyType', 'surveyType_label', 'surveyLength', 'wind', 'windDir',
  'tempC', 'precip', 'siteHabitat', 'surveyLat', 'surveyLng', 'surveyStartTime', 'surveyEndTime',
  'surveyRemainingSeconds', 'transectID', 'surveyDate', 'startTime', 'endTime', 'visibility', 'snowCover',
  'windSpeed', 'siteName', 'waterTemp', 'airTemp', 'waterLevel', 'weather', 'client', 'municipality',
  'proposedActivity', 'habitatTypes', 'surveyMethod', 'areaHa', 'province', 'notes',
]);
const DROP = new Set(['marker', 'label', 'latlng', 'id', 'timestamp', 'soci', '_origIdx']);
const isStamp = k => /SubmittedAt$/.test(k);

const RENAME = {
  BBS:    { code: 'speciesCode', name: 'species' },
  TURTLE: { photoID: 'photoRef' },
};

function parseTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? String(ts) : localISO(d);
}

function cleanNumber(v) {
  return v === '' || v == null ? v : (Number.isFinite(+v) ? +v : v);
}

// v1 metadata (prefixed keys) → v2 meta for the given v1 type
export function migrateMeta(oldType, metadata = {}) {
  const out = {};
  const prefix = PREFIX[oldType];
  for (const [k, v] of Object.entries(metadata)) {
    if (isEmpty(v) || isStamp(k)) continue;
    let key = k;
    if (prefix && k.startsWith(prefix)) key = k[prefix.length].toLowerCase() + k.slice(prefix.length + 1);
    if (oldType === 'BBS') {
      if (k === 'surveyStartTime') key = 'startTime';
      if (k === 'surveyEndTime') key = 'endTime';
      if (k === 'surveyType' || k === 'surveyRemainingSeconds') continue;
    }
    out[key] = v;
  }
  if (typeof out.habitatTypes === 'string') {
    out.habitatTypes = out.habitatTypes.split(',').map(s => s.trim()).filter(Boolean);
  }
  return out;
}

function submittedFrom(oldType, metadata = {}) {
  if (oldType === 'BBS') return metadata.surveySubmittedAt || '';
  return metadata[PREFIX[oldType] + 'SubmittedAt'] || '';
}

// v1 observation → v2 record (unknown keys are kept so nothing is lost)
export function migrateRecord(oldType, o, isHabitat = false) {
  const rec = {
    id: uid('o'),
    lat: o.latlng?.lat ?? o.lat ?? null,
    lng: o.latlng?.lng ?? o.lng ?? null,
    time: parseTime(o.timestamp),
    photos: [],
  };
  const rename = isHabitat ? {} : (RENAME[oldType] || {});
  for (const [k, v] of Object.entries(o)) {
    if (DROP.has(k) || COPIED_META.has(k) || isStamp(k)) continue;
    if (isHabitat && (k === 'condition' || k === 'size') && isEmpty(v)) continue;
    if (oldType === 'NEST' && !isHabitat && k === 'photos') {
      if (v === true) rec.photosTaken = 'Yes';
      continue;
    }
    rec[rename[k] || k] = v;
  }
  for (const k of ['count', 'range', 'bearing', 'eggCount', 'chickCount', 'buffer', 'treeHeight']) {
    if (k in rec) rec[k] = cleanNumber(rec[k]);
  }
  return rec;
}

// One v1 session record → v2 session (or null if the type is unknown)
export function migrateSession(old) {
  const type = TYPE_MAP[old.type];
  if (!type) return null;
  const snap = old.snapshot || {};
  const meta = migrateMeta(old.type, old.metadata);
  if (!meta.surveyDate && old.createdAt) meta.surveyDate = String(old.createdAt).slice(0, 10);
  const s = {
    v: 2, id: old.id || `${type}_${Date.now()}`, type,
    status: old.status === 'submitted' ? 'submitted' : 'draft',
    meta,
    obs: (snap[PRIMARY_STORE[old.type]] || []).map(o => migrateRecord(old.type, o)),
    habitat: (snap.habitatObservations || []).map(o => migrateRecord(old.type, o, true)),
    createdAt: old.createdAt || localISO(),
    updatedAt: old.updatedAt || localISO(),
    migratedFrom: 'v1',
  };
  const sub = submittedFrom(old.type, old.metadata);
  if (sub) s.submittedAt = sub;
  return s;
}

// Observations left in v1's live stores (an unsaved survey, e.g. after a crash)
// → one recovered draft per survey type. `stores` = { storeName: [records] }.
export function recoverLiveStores(stores) {
  const sessions = [];
  for (const [oldType, storeName] of Object.entries(PRIMARY_STORE)) {
    const primary = stores[storeName] || [];
    const habitat = (stores.habitatObservations || []).filter(h => h.surveyType === oldType);
    if (!primary.length && !habitat.length) continue;
    const type = TYPE_MAP[oldType];
    const def = getSurvey(type);
    const sample = { ...(habitat[0] || {}), ...(primary[0] || {}) };
    if (oldType === 'BBS') {
      sample.startTime = sample.surveyStartTime;
      sample.endTime = sample.surveyEndTime;
    }
    const meta = {};
    for (const f of def.meta) {
      for (const key of f.type === 'point' ? [f.key + 'Lat', f.key + 'Lng'] : [f.key]) {
        if (!isEmpty(sample[key])) meta[key] = sample[key];
      }
    }
    if (typeof meta.habitatTypes === 'string') {
      meta.habitatTypes = meta.habitatTypes.split(',').map(s => s.trim()).filter(Boolean);
    }
    const now = localISO();
    sessions.push({
      v: 2, id: `${type}_recovered_${Date.now()}_${sessions.length}`, type, status: 'draft',
      meta,
      obs: primary.map(o => migrateRecord(oldType, o)),
      habitat: habitat.map(o => migrateRecord(oldType, o, true)),
      createdAt: now, updatedAt: now, migratedFrom: 'v1-live',
      recovered: true,
    });
  }
  return sessions;
}
