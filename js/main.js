// js/main.js — App entry point: survey selection → map initialisation

// Pre-load shared modules so their side effects (window.* bindings) are ready
import './storageData.js';
import './surveyGlobals.js';

import { setActiveSurvey, activeSurvey, resetMetadata, hasAnyMetadata } from './surveyGlobals.js';
import { initializeMap, destroyMap } from './map.js';
import { initTimerBindings, updateTable } from './ui.js';
import { updateSpeciesList, saveSpeciesObservation } from './species.js';
import { injectMooseModal } from './moose.js';
import { injectTurtleModal } from './turtle.js';
import { injectHabitatModal } from './habitat.js';
import {
  initNewSession, saveDraft, saveDraftSilently, submitSession,
  loadSessions, deleteSession, resumeSession, clearInMemoryArrays
} from './sessions.js';
import { speciesMarkers, mooseObservations, turtleObservations, habitatObservations } from './storageData.js';
import {
  exportSpeciesCSV, exportSpeciesGeoJSON, exportSpeciesKML,
  exportMooseCSV,   exportMooseGeoJSON,   exportMooseKML,
  exportTurtleCSV,  exportTurtleGeoJSON,  exportTurtleKML,
  exportHabitatCSV, exportHabitatGeoJSON, exportHabitatKML
} from './export.js';
import { uploadToFelt } from './felt.js';
import { showToast } from './toast.js';

document.addEventListener('DOMContentLoaded', async () => {
  // ── Expose globals needed by any inline onclick= handlers ─────────────
  window.uploadToFelt = uploadToFelt;

  // ── Settings gear button ───────────────────────────────────────────────
  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) settingsBtn.addEventListener('click', _showSettingsModal);

  // ── Survey selection button handlers ──────────────────────────────────
  document.querySelectorAll('.survey-choice-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await _launchSurvey(btn.dataset.survey);
      } catch (err) {
        alert('Error launching survey:\n' + err.message + '\n\nCheck browser console (F12) for details.');
        console.error(err);
      }
    });
  });

  // ── Browser back-button → same flow as the in-app back button ─────────
  window.addEventListener('popstate', () => {
    if (activeSurvey) {
      history.pushState(null, '', location.href);
      window.goBackToSelection();
    }
  });

  // ── Render session lists on home screen ───────────────────────────────
  await _renderSessionLists();
});

// ─── Launch a survey (new session) ────────────────────────────────────────
async function _launchSurvey(type) {
  const sessions = await loadSessions();
  const drafts   = sessions.filter(s => s.status === 'draft' && s.type === type);
  if (drafts.length > 0) {
    _showContinueOrNewDialog(drafts[0], type);
    return;
  }
  _startFreshSurvey(type);
}

function _startFreshSurvey(type) {
  clearInMemoryArrays();  // discard any stale data left by home-screen re-export operations
  resetMetadata(type);    // clear stale fields; preserves surveyor name
  initNewSession(type);
  setActiveSurvey(type);
  _showMapUI(type);
}

// ─── "Continue or New?" dialog ────────────────────────────────────────────
function _showContinueOrNewDialog(recentDraft, type) {
  const overlay = document.createElement('div');
  overlay.className = 'survey-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;';
  overlay.innerHTML = `
    <div class="export-dialog-box">
      <div class="export-dialog-icon">${SURVEY_EMOJI[type] || '📋'}</div>
      <h2 class="export-dialog-title">Survey In Progress</h2>
      <p class="export-dialog-sub" style="margin-bottom:4px;">${recentDraft.label}</p>
      <p class="export-dialog-sub" style="color:#888;font-size:0.78rem;margin-bottom:0;">
        ${recentDraft.obsCount || 0} obs &middot; ${new Date(recentDraft.updatedAt).toLocaleString()}
      </p>
      <div class="export-dialog-btns">
        <button id="_contBtn">▶ Continue</button>
        <button id="_newBtn" class="export-skip">＋ Start New</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#_contBtn').addEventListener('click', () => {
    overlay.remove();
    _resumeSurvey(recentDraft);
  });
  overlay.querySelector('#_newBtn').addEventListener('click', () => {
    overlay.remove();
    _startFreshSurvey(type);
  });
}

// ─── Resume a draft session ───────────────────────────────────────────────
async function _resumeSurvey(session) {
  setActiveSurvey(session.type);
  await resumeSession(session);
  _showMapUI(session.type);
}

// ─── Auto-save timer ──────────────────────────────────────────────────────
let _autoSaveTimer = null;

function _startAutoSave() {
  _stopAutoSave();
  const secs = parseInt(localStorage.getItem('autoSaveInterval') || '0', 10);
  if (!secs) return;
  _autoSaveTimer = setInterval(async () => {
    if (!activeSurvey) return;
    try { await saveDraftSilently(); }
    catch (e) { console.warn('Auto-save failed:', e); }
  }, secs * 1000);
}

function _stopAutoSave() {
  if (_autoSaveTimer) { clearInterval(_autoSaveTimer); _autoSaveTimer = null; }
}

// ─── Shared map UI setup ──────────────────────────────────────────────────
function _showMapUI(type) {
  // Push state so the browser back button fires popstate instead of navigating away
  history.pushState(null, '', location.href);

  document.getElementById('surveySelection').style.display = 'none';
  document.getElementById('map').style.removeProperty('display');
  document.getElementById('masterButton').style.removeProperty('display');
  document.getElementById('dataDrawer').style.display = 'none';

  const timerStrip = document.getElementById('survey-timer-strip');
  if (timerStrip) timerStrip.style.display = type === 'BBS' ? 'flex' : 'none';

  if (type === 'MOOSE')  injectMooseModal();
  else if (type === 'TURTLE') injectTurtleModal();
  injectHabitatModal(type);

  initializeMap();
  if (type === 'BBS') initTimerBindings();
  updateTable();
  _startAutoSave();
}

// ─── Close every survey overlay/modal/panel before going home ────────────
function _closeAllSurveyUI() {
  // Observation forms (each also calls unlockMap + resets placing-point flag)
  window.closeModal?.();
  window.closeMooseModal?.();
  window.closeTurtleModal?.();
  window.closeHabitatModal?.();
  // Help panel and metadata form
  window.closeInstructions?.();
  window.closeSurveyModal?.();
  // Observation list drawer
  window.closeDrawer?.();
  // Dynamically appended overlays (export dialog, no-data warning, etc.)
  document.querySelectorAll('.survey-overlay').forEach(el => el.remove());
  // Belt-and-braces: ensure backdrop is hidden and map lock is cleared
  const backdrop = document.getElementById('modalBackdrop');
  if (backdrop) backdrop.style.display = 'none';
  document.getElementById('masterButton')?.classList.remove('ui-locked');
}

// ─── Tear down map UI, return to home ────────────────────────────────────
function _returnToHome() {
  _stopAutoSave();
  _closeAllSurveyUI();
  const hide = id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; };
  hide('dataDrawer');
  hide('surveyModal');
  hide('modalBackdrop');
  hide('survey-timer-strip');
  hide('masterButton');
  hide('map');
  try { destroyMap(); } catch (e) { console.error('destroyMap error:', e); }
  setActiveSurvey(null);
  const sel = document.getElementById('surveySelection');
  if (sel) sel.style.display = '';
  _renderSessionLists();
}

// ─── Observation count for the active survey ──────────────────────────────
function _currentObsCount() {
  const primary = activeSurvey === 'BBS'   ? speciesMarkers.length
                : activeSurvey === 'MOOSE' ? mooseObservations.length
                :                            turtleObservations.length;
  return primary + habitatObservations.length;
}

// ─── "No observations" popup ──────────────────────────────────────────────
function _showNoDataModal() {
  const overlay = document.createElement('div');
  overlay.className = 'survey-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9500;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;';
  overlay.innerHTML = `
    <div style="background:#222;border:1px solid #3a3a3a;border-radius:12px;padding:28px 32px;text-align:center;max-width:320px;width:90vw;box-shadow:0 8px 32px rgba(0,0,0,0.7);">
      <div style="font-size:2rem;margin-bottom:12px;">📋</div>
      <h2 style="color:#f0f0f0;font-family:Oswald,sans-serif;font-size:1.1rem;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;margin:0 0 10px;">No Observations</h2>
      <p style="color:#999;font-family:Oswald,sans-serif;font-size:0.85rem;font-weight:300;margin:0 0 20px;line-height:1.5;">Add at least one observation before saving or submitting.</p>
      <button id="_noDataOk" style="font-family:Oswald,sans-serif;font-size:0.9rem;font-weight:500;letter-spacing:0.05em;text-transform:uppercase;padding:9px 20px;border-radius:6px;cursor:pointer;background:#2d6b2d;border:1px solid #3d8f3d;color:#fff;">OK</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.querySelector('#_noDataOk').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
}

// ─── Back button — auto-save with metadata guard ──────────────────────────
window.goBackToSelection = async function () {
  // Case C: no metadata at all → prompt before discarding
  if (!hasAnyMetadata()) {
    _showNoMetadataModal();
    return;
  }
  // Cases A & B: has metadata (with or without observations) — auto-save draft
  const obsCount = _currentObsCount();
  // _buildRecord captures state synchronously before the first await, so
  // calling clearInMemoryArrays() immediately after is safe.
  await saveDraft().catch(e => console.error('saveDraft error:', e));
  clearInMemoryArrays();
  _returnToHome();
  showToast(
    obsCount > 0 ? 'Survey saved to drafts.' : 'Survey saved to drafts (no observations yet).',
    'success'
  );
};

// ─── No-metadata modal (Case C) ────────────────────────────────────────────
function _showNoMetadataModal() {
  const overlay = document.createElement('div');
  overlay.className = 'survey-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:320px;width:90vw;text-align:center;">
      <h2 style="color:steelblue;margin:0 0 12px;">No Metadata</h2>
      <p style="color:#ccc;font-size:0.88rem;line-height:1.5;margin:0 0 20px;">
        No survey information has been entered yet. Please fill in the survey metadata before saving, or discard and exit.
      </p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <button id="_noMetaEnter"
          style="background:#2d6b2d;border:1px solid #3d8f3d;color:#fff;padding:9px 16px;border-radius:6px;cursor:pointer;font-family:Oswald,sans-serif;">
          Enter Metadata
        </button>
        <button id="_noMetaDiscard"
          style="background:#6b2d2d;border:1px solid #8f3d3d;color:#fff;padding:9px 16px;border-radius:6px;cursor:pointer;font-family:Oswald,sans-serif;">
          Discard and Exit
        </button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  // "Enter Metadata" — close modal, stay in survey so user can fill in fields
  overlay.querySelector('#_noMetaEnter').addEventListener('click', () => overlay.remove());
  // "Discard and Exit" — abandon survey without saving
  overlay.querySelector('#_noMetaDiscard').addEventListener('click', () => {
    overlay.remove();
    clearInMemoryArrays();
    _returnToHome();
  });
}

// ─── Save to Drafts button ────────────────────────────────────────────────
window.saveDraftAndGoHome = async function () {
  if (_currentObsCount() === 0) { _showNoDataModal(); return; }
  try {
    await saveDraft();
  } catch (e) {
    console.error('Save draft failed:', e);
    alert('Could not save draft:\n' + (e?.message || String(e)));
  }
  _returnToHome();
};

// ─── Submit button — save, show export dialog, then go home ──────────────
window.submitAndShowExport = async function () {
  if (_currentObsCount() === 0) { _showNoDataModal(); return; }
  // Capture survey type and observation snapshot BEFORE submitSession() clears
  // the in-memory arrays and IDB observation stores, so the export dialog can
  // still offer CSV / GeoJSON / KML / Felt uploads after submission.
  const capturedType = activeSurvey;
  const _strip = o => { const { marker, label, ...r } = o; return { ...r, latlng: { lat: o.latlng.lat, lng: o.latlng.lng } }; };
  const capturedSnap = {
    speciesMarkers:      speciesMarkers.map(_strip),
    mooseObservations:   mooseObservations.map(_strip),
    turtleObservations:  turtleObservations.map(_strip),
    habitatObservations: habitatObservations.map(_strip),
  };
  try {
    await submitSession();
    _showExportDialog(capturedType, capturedSnap, () => _returnToHome());
  } catch (e) {
    console.error('Submit failed:', e);
    alert('Could not submit:\n' + (e?.message || String(e)));
    _returnToHome();
  }
};

// ─── Settings modal ───────────────────────────────────────────────────────
function _showSettingsModal() {
  const defObs   = localStorage.getItem('defaultObserver')  || '';
  const defPrj   = localStorage.getItem('defaultProjectID') || '';
  const autoSave = localStorage.getItem('autoSaveInterval') || '0';
  const feltKey  = localStorage.getItem('feltApiKey')       || '';

  const _esc = s => String(s).replace(/"/g, '&quot;');
  const _sel = v => (opt) => v === opt ? 'selected' : '';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:20px 16px;box-sizing:border-box;';
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:380px;width:100%;margin:auto;">
      <h2 style="display:flex;align-items:center;gap:8px;margin:0 0 16px;"><i class="fas fa-gear"></i> Settings</h2>

      <p style="color:#888;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Defaults</p>
      <label style="display:block;">Default Observer Name</label>
      <input type="text" id="settingsDefObs" value="${_esc(defObs)}"
        placeholder="e.g. J. Smith" autocomplete="off"
        style="width:100%;box-sizing:border-box;margin-top:4px;" />
      <p style="color:#999;font-size:0.78rem;margin:4px 0 12px;line-height:1.4;">
        Pre-fills the observer field for new surveys across all types.
      </p>

      <label style="display:block;">Default Project ID</label>
      <input type="text" id="settingsDefPrj" value="${_esc(defPrj)}"
        placeholder="e.g. NTB-2026" autocomplete="off"
        style="width:100%;box-sizing:border-box;margin-top:4px;" />
      <p style="color:#999;font-size:0.78rem;margin:4px 0 16px;line-height:1.4;">
        Pre-fills the project ID field across all survey types.
      </p>

      <hr style="border:none;border-top:1px solid #3a3a3a;margin:0 0 16px;" />
      <p style="color:#888;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Auto-Save</p>
      <label style="display:block;">Auto-save interval</label>
      <select id="settingsAutoSave" style="width:100%;box-sizing:border-box;margin-top:4px;">
        <option value="0"   ${_sel(autoSave)('0')  }>Off</option>
        <option value="30"  ${_sel(autoSave)('30') }>Every 30 seconds</option>
        <option value="60"  ${_sel(autoSave)('60') }>Every minute</option>
        <option value="120" ${_sel(autoSave)('120')}>Every 2 minutes</option>
        <option value="300" ${_sel(autoSave)('300')}>Every 5 minutes</option>
      </select>
      <p style="color:#999;font-size:0.78rem;margin:4px 0 16px;line-height:1.4;">
        Silently saves a draft while a survey is in progress.
      </p>

      <hr style="border:none;border-top:1px solid #3a3a3a;margin:0 0 16px;" />
      <p style="color:#888;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Felt Integration</p>
      <label style="display:block;">Felt API Key</label>
      <input type="password" id="feltApiKeyInput" value="${_esc(feltKey)}"
        placeholder="felt_pat_…" autocomplete="off"
        style="width:100%;box-sizing:border-box;margin-top:4px;" />
      <p style="color:#999;font-size:0.78rem;margin:4px 0 16px;line-height:1.4;">
        Stored locally on this device. Sent only to the Felt API.
      </p>

      <hr style="border:none;border-top:1px solid #3a3a3a;margin:0 0 16px;" />
      <p style="color:#888;font-size:0.75rem;text-transform:uppercase;letter-spacing:0.08em;margin:0 0 8px;">Data Management</p>
      <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
        <button id="settingsExportBackup"
          style="background:#1e3a5f;border:1px solid #2a5a9f;color:#fff;padding:9px 16px;border-radius:6px;cursor:pointer;font-family:Oswald,sans-serif;text-align:left;">
          <i class="fas fa-download"></i> Export Full Backup (JSON)
        </button>
        <button id="settingsClearArchive"
          style="background:#5f1e1e;border:1px solid #9f2a2a;color:#fff;padding:9px 16px;border-radius:6px;cursor:pointer;font-family:Oswald,sans-serif;text-align:left;">
          <i class="fas fa-trash"></i> Clear All Archived Sessions
        </button>
      </div>

      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="settingsCancel" style="background:#333;border:1px solid #555;color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;">Cancel</button>
        <button id="settingsSave"   style="background:#2d6b2d;border:1px solid #3d8f3d;color:#fff;padding:8px 16px;border-radius:6px;cursor:pointer;">Save</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.querySelector('#settingsCancel').addEventListener('click', close);

  overlay.querySelector('#settingsSave').addEventListener('click', () => {
    const defObsVal  = (overlay.querySelector('#settingsDefObs').value  || '').trim();
    const defPrjVal  = (overlay.querySelector('#settingsDefPrj').value  || '').trim();
    const autoSaveVal = overlay.querySelector('#settingsAutoSave').value;
    const feltKeyVal = (overlay.querySelector('#feltApiKeyInput').value || '').trim();

    if (defObsVal)  localStorage.setItem('defaultObserver',  defObsVal);
    else            localStorage.removeItem('defaultObserver');
    if (defPrjVal)  localStorage.setItem('defaultProjectID', defPrjVal);
    else            localStorage.removeItem('defaultProjectID');
    localStorage.setItem('autoSaveInterval', autoSaveVal);
    if (feltKeyVal) localStorage.setItem('feltApiKey', feltKeyVal);
    else            localStorage.removeItem('feltApiKey');

    showToast('Settings saved', 'success');
    close();
  });

  overlay.querySelector('#settingsExportBackup').addEventListener('click', async () => {
    const sessions = await loadSessions();
    const json = JSON.stringify(sessions, null, 2);
    const date = new Date().toLocaleDateString('en-CA').replace(/-/g, '');
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `fraxinus_backup_${date}.json` });
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Backup downloaded', 'success');
  });

  overlay.querySelector('#settingsClearArchive').addEventListener('click', async () => {
    if (!confirm('Delete all archived (submitted) sessions? This cannot be undone.')) return;
    const all      = await loadSessions();
    const archived = all.filter(s => s.status === 'submitted');
    await Promise.all(archived.map(s => deleteSession(s.id)));
    const n = archived.length;
    showToast(`${n} archived session${n !== 1 ? 's' : ''} deleted`, 'success');
    _renderSessionLists();
  });
}

// ─── Export dialog (shown after submit) ──────────────────────────────────
// type and snap are captured before submitSession() clears in-memory arrays.
function _showExportDialog(type, snap, onDone) {
  const overlay = document.createElement('div');
  overlay.id = 'exportDialog';
  overlay.className = 'survey-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;';

  overlay.innerHTML = `
    <div class="export-dialog-box">
      <div class="export-dialog-icon">✅</div>
      <h2 class="export-dialog-title">Survey Submitted</h2>
      <p class="export-dialog-sub">Saved to your archive. Download a copy?</p>
      <div class="export-dialog-btns">
        <button id="expCsv">Download CSV</button>
        <button id="expGeoJson">Download GeoJSON</button>
        <button id="expKml">Download KML</button>
        <button id="expFelt" class="export-felt-btn">↑ Upload to Felt</button>
        <button id="expStore" class="export-store-local">💾 Store Locally — No Download</button>
        <button id="expSkip" class="export-skip">Done</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => { overlay.remove(); onDone(); };

  // Restore snapshot arrays, call fn(), then clear — safe export helper
  const withSnap = (fn) => {
    clearInMemoryArrays();
    (snap.speciesMarkers     || []).forEach(r => speciesMarkers.push(r));
    (snap.mooseObservations  || []).forEach(r => mooseObservations.push(r));
    (snap.turtleObservations || []).forEach(r => turtleObservations.push(r));
    (snap.habitatObservations|| []).forEach(r => habitatObservations.push(r));
    fn();
    clearInMemoryArrays();
  };

  document.getElementById('expCsv').addEventListener('click',     () => { withSnap(() => _runExport('csv',     type)); close(); });
  document.getElementById('expGeoJson').addEventListener('click', () => { withSnap(() => _runExport('geojson', type)); close(); });
  document.getElementById('expKml').addEventListener('click',     () => { withSnap(() => _runExport('kml',     type)); close(); });
  document.getElementById('expFelt').addEventListener('click',    () => {
    overlay.remove();
    // Restore snapshot so uploadToFelt can read observations (arrays were cleared by submitSession)
    clearInMemoryArrays();
    (snap.speciesMarkers     || []).forEach(r => speciesMarkers.push(r));
    (snap.mooseObservations  || []).forEach(r => mooseObservations.push(r));
    (snap.turtleObservations || []).forEach(r => turtleObservations.push(r));
    (snap.habitatObservations|| []).forEach(r => habitatObservations.push(r));
    uploadToFelt(type, () => { clearInMemoryArrays(); onDone(); });
  });
  document.getElementById('expStore').addEventListener('click', close);
  document.getElementById('expSkip').addEventListener('click',  close);
}

function _runExport(fmt, type = activeSurvey) {
  if (type === 'BBS') {
    if (fmt === 'csv')     { exportSpeciesCSV();  exportHabitatCSV();     }
    if (fmt === 'geojson') { exportSpeciesGeoJSON(); exportHabitatGeoJSON(); }
    if (fmt === 'kml')     { exportSpeciesKML();  exportHabitatKML();     }
  } else if (type === 'MOOSE') {
    if (fmt === 'csv')     { exportMooseCSV();    exportHabitatCSV();     }
    if (fmt === 'geojson') { exportMooseGeoJSON(); exportHabitatGeoJSON(); }
    if (fmt === 'kml')     { exportMooseKML();    exportHabitatKML();     }
  } else {
    if (fmt === 'csv')     { exportTurtleCSV();   exportHabitatCSV();     }
    if (fmt === 'geojson') { exportTurtleGeoJSON();exportHabitatGeoJSON(); }
    if (fmt === 'kml')     { exportTurtleKML();   exportHabitatKML();     }
  }
}

// ─── Home screen session lists ────────────────────────────────────────────
const SURVEY_EMOJI = { BBS: '🐦', MOOSE: '🦌', TURTLE: '🐢' };

async function _renderSessionLists() {
  const sessions = await loadSessions();
  const drafts   = sessions.filter(s => s.status === 'draft');
  const recent   = sessions.filter(s => s.status === 'submitted');

  _populateList('draftsList',  drafts,  true);
  _populateList('recentList',  recent,  false);

  document.getElementById('draftsSection').style.display = drafts.length ? '' : 'none';
  document.getElementById('recentSection').style.display = '';
}

window._refreshSessionLists = async function () {
  const btn = document.getElementById('btn-refresh-sessions');
  if (btn) {
    btn.disabled = true;
    btn.querySelector('i')?.classList.add('fa-spin');
  }
  await _renderSessionLists();
  if (btn) {
    btn.disabled = false;
    btn.querySelector('i')?.classList.remove('fa-spin');
  }
};

function _populateList(listId, sessions, isDraft) {
  const el = document.getElementById(listId);
  if (!el) return;
  el.innerHTML = '';
  if (!sessions.length && !isDraft) {
    el.innerHTML = '<p class="session-empty">No archived surveys yet.</p>';
    return;
  }
  sessions.forEach(s => {
    const item = document.createElement('div');
    item.className = 'session-item';
    const obs = s.obsCount != null ? `${s.obsCount} obs` : '';
    item.innerHTML = `
      <div class="session-item-left">
        <span class="session-emoji">${SURVEY_EMOJI[s.type] || '📋'}</span>
        <div>
          <div class="session-item-label">${s.label}</div>
          <div class="session-item-meta">${obs}${obs ? ' · ' : ''}${new Date(s.updatedAt).toLocaleString()}</div>
        </div>
      </div>
      <div class="session-item-actions">
        ${isDraft
        ? `<button class="session-btn-resume" data-id="${s.id}" title="Resume">▶ Resume</button>`
        : `<button class="session-btn-edit"   data-id="${s.id}" title="Edit">✏ Edit</button>`}
        <button class="session-btn-export" data-type="${s.type}" data-id="${s.id}" title="Re-export">⬇ Export</button>
        <button class="session-btn-delete" data-id="${s.id}" title="Delete">✕ Delete</button>
      </div>`;

    if (isDraft) {
      item.querySelector('.session-btn-resume').addEventListener('click', e => {
        e.stopPropagation();
        _resumeSurvey(s);
      });
    } else {
      item.querySelector('.session-btn-edit').addEventListener('click', e => {
        e.stopPropagation();
        _resumeSurvey(s);
      });
    }

    item.querySelector('.session-btn-export').addEventListener('click', e => {
      e.stopPropagation();
      _showReExportDialog(s);
    });

    item.querySelector('.session-btn-delete').addEventListener('click', async e => {
      e.stopPropagation();
      if (confirm(`Delete "${s.label}"?`)) {
        await deleteSession(s.id);
        _renderSessionLists();
      }
    });

    el.appendChild(item);
  });
}

// ─── Re-export dialog for submitted/draft sessions ────────────────────────
function _showReExportDialog(session) {
  const overlay = document.createElement('div');
  overlay.className = 'survey-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:10000;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;';

  overlay.innerHTML = `
    <div class="export-dialog-box">
      <div class="export-dialog-icon">${SURVEY_EMOJI[session.type] || '📋'}</div>
      <h2 class="export-dialog-title">${session.label}</h2>
      <p class="export-dialog-sub">${session.obsCount || 0} observations</p>
      <div class="export-dialog-btns">
        <button id="reexpCsv">Download CSV</button>
        <button id="reexpGeoJson">Download GeoJSON</button>
        <button id="reexpKml">Download KML</button>
        <button id="reexpFelt" class="export-felt-btn">↑ Upload to Felt</button>
        <button id="reexpClose" class="export-skip">Close</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  // Temporarily restore snapshot to in-memory arrays, export, then clear
  const snap = session.snapshot || {};
  const doExport = (fmt) => {
    clearInMemoryArrays();
    (snap.speciesMarkers     || []).forEach(r => speciesMarkers.push(r));
    (snap.mooseObservations  || []).forEach(r => mooseObservations.push(r));
    (snap.turtleObservations || []).forEach(r => turtleObservations.push(r));
    (snap.habitatObservations|| []).forEach(r => habitatObservations.push(r));
    _runExport(fmt, session.type);
    clearInMemoryArrays();
    close();
  };

  const doFeltUpload = () => {
    // Restore snapshot arrays synchronously; felt.js builds GeoJSON immediately,
    // then clears arrays via the onClose callback after the modal closes.
    clearInMemoryArrays();
    (snap.speciesMarkers     || []).forEach(r => speciesMarkers.push(r));
    (snap.mooseObservations  || []).forEach(r => mooseObservations.push(r));
    (snap.turtleObservations || []).forEach(r => turtleObservations.push(r));
    (snap.habitatObservations|| []).forEach(r => habitatObservations.push(r));
    overlay.remove();
    uploadToFelt(session.type, () => { clearInMemoryArrays(); });
  };

  overlay.querySelector('#reexpCsv').addEventListener('click',     () => doExport('csv'));
  overlay.querySelector('#reexpGeoJson').addEventListener('click', () => doExport('geojson'));
  overlay.querySelector('#reexpKml').addEventListener('click',     () => doExport('kml'));
  overlay.querySelector('#reexpFelt').addEventListener('click',    doFeltUpload);
  overlay.querySelector('#reexpClose').addEventListener('click', close);
}
