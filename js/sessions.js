// js/sessions.js — Survey session lifecycle: draft, submit, resume

import * as G from './surveyGlobals.js';
import {
  saveSessionRecord, loadAllSessions as _loadAllSessions,
  deleteSessionRecord, clearObservationStores, restoreSnapshot
} from './storage.js';
import { speciesMarkers, mooseObservations, turtleObservations, habitatObservations } from './storageData.js';

// ─── Current session ID ───────────────────────────────────────────────────
let _sessionId = null;
export function getCurrentSessionId() { return _sessionId; }

export function initNewSession(type) {
  _sessionId = `${type}_${Date.now()}`;
  G.setCurrentSessionId(_sessionId);
}

export function setResumedSessionId(id) {
  _sessionId = id;
  G.setCurrentSessionId(id);
}

// ─── Session label (shown in the home screen list) ────────────────────────
function _buildLabel() {
  const date = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  if (G.activeSurvey === 'BBS')   return `BBS – ${G.pointID         || 'No Point ID'} – ${date}`;
  if (G.activeSurvey === 'MOOSE') return `Wildlife – ${G.mooseTransectID || 'No Transect'} – ${date}`;
  return `Turtle – ${G.turtleSiteName || 'No Site'} – ${date}`;
}

// ─── Observation count ────────────────────────────────────────────────────
function _obsCount() {
  const primary = G.activeSurvey === 'BBS'   ? speciesMarkers.length
                : G.activeSurvey === 'MOOSE' ? mooseObservations.length
                :                              turtleObservations.length;
  return primary + habitatObservations.length;
}

// ─── Serialize in-memory arrays (strip non-serialisable Leaflet objects) ──
function _serializeObs() {
  const strip = o => {
    const { marker, label, ...rest } = o;
    return { ...rest, latlng: { lat: o.latlng.lat, lng: o.latlng.lng } };
  };
  return {
    speciesMarkers:     speciesMarkers.map(strip),
    mooseObservations:  mooseObservations.map(strip),
    turtleObservations: turtleObservations.map(strip),
    habitatObservations:habitatObservations.map(strip)
  };
}

// ─── Clear in-memory arrays ───────────────────────────────────────────────
export function clearInMemoryArrays() {
  speciesMarkers.length     = 0;
  mooseObservations.length  = 0;
  turtleObservations.length = 0;
  habitatObservations.length= 0;
}

// ─── Build the session record ─────────────────────────────────────────────
async function _buildRecord(status) {
  // Capture all synchronous state BEFORE the first await so that
  // fire-and-forget callers (e.g. the back button) can't race with
  // clearInMemoryArrays() or a new survey being launched.
  const id       = _sessionId;
  const type     = G.activeSurvey;
  const label    = _buildLabel();
  const metadata = G.getMetadataSnapshot();
  const obsCount = _obsCount();
  const snapshot = _serializeObs();

  const sessions = await _loadAllSessions();
  const existing = sessions.find(s => s.id === id);
  return {
    id, type, status, label, metadata, obsCount, snapshot,
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// ─── Save to Drafts ───────────────────────────────────────────────────────
export async function saveDraft() {
  const record = await _buildRecord('draft');
  await saveSessionRecord(record);
  // Supersede: remove any older drafts with the same label (different id)
  const all   = await _loadAllSessions();
  const dupes = all.filter(s => s.status === 'draft' && s.label === record.label && s.id !== record.id);
  await Promise.all(dupes.map(s => deleteSessionRecord(s.id)));
  await clearObservationStores();
  clearInMemoryArrays();
}

// ─── Submit ───────────────────────────────────────────────────────────────
export async function submitSession() {
  const record = await _buildRecord('submitted');
  await saveSessionRecord(record);
  await clearObservationStores();
  clearInMemoryArrays();
}

// ─── Load all sessions (for home screen) ─────────────────────────────────
export async function loadSessions() {
  const all = await _loadAllSessions();
  // Sort newest first
  return all.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

// ─── Delete a session ─────────────────────────────────────────────────────
export async function deleteSession(id) {
  return deleteSessionRecord(id);
}

// ─── Resume a draft (restores metadata + observations to IDB) ────────────
export async function resumeSession(session) {
  setResumedSessionId(session.id);
  G.restoreMetadata(session.type, session.metadata);
  await clearObservationStores();
  await restoreSnapshot(session.snapshot || {});
}
