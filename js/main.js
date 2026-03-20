// js/main.js — App entry point: survey selection → map initialisation

// Pre-load shared modules so their side effects (window.* bindings) are ready
import './storageData.js';
import './surveyGlobals.js';

import { setActiveSurvey, activeSurvey } from './surveyGlobals.js';
import { initializeMap, destroyMap } from './map.js';
import { initTimerBindings, updateTable } from './ui.js';
import { updateSpeciesList, saveSpeciesObservation } from './species.js';
import { injectMooseModal } from './moose.js';
import { injectTurtleModal } from './turtle.js';
import { injectHabitatModal } from './habitat.js';
import {
  initNewSession, saveDraft, submitSession,
  loadSessions, deleteSession, resumeSession, clearInMemoryArrays
} from './sessions.js';
import { speciesMarkers, mooseObservations, turtleObservations, habitatObservations } from './storageData.js';
import {
  exportSpeciesCSV, exportSpeciesGeoJSON, exportSpeciesKML,
  exportMooseCSV,   exportMooseGeoJSON,   exportMooseKML,
  exportTurtleCSV,  exportTurtleGeoJSON,  exportTurtleKML,
  exportHabitatCSV, exportHabitatGeoJSON, exportHabitatKML
} from './export.js';

document.addEventListener('DOMContentLoaded', async () => {
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

// ─── Shared map UI setup ──────────────────────────────────────────────────
function _showMapUI(type) {
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

// ─── Back button — navigate immediately; save happens in the background ───
// We must NOT await any DB operation here — if IDB hangs the button freezes.
window.goBackToSelection = function () {
  saveDraft().catch(e => console.warn('Back-button auto-save failed:', e));
  clearInMemoryArrays();   // clear now so a new survey starts clean
  _returnToHome();
};

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
  try {
    await submitSession();
    _showExportDialog(() => _returnToHome());
  } catch (e) {
    console.error('Submit failed:', e);
    alert('Could not submit:\n' + (e?.message || String(e)));
    _returnToHome();
  }
};

// ─── Export dialog (shown after submit) ──────────────────────────────────
function _showExportDialog(onDone) {
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
        <button id="expStore" class="export-store-local">💾 Store Locally — No Download</button>
        <button id="expSkip" class="export-skip">Done</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  const close = () => { overlay.remove(); onDone(); };

  document.getElementById('expCsv').addEventListener('click', () => {
    _runExport('csv'); close();
  });
  document.getElementById('expGeoJson').addEventListener('click', () => {
    _runExport('geojson'); close();
  });
  document.getElementById('expKml').addEventListener('click', () => {
    _runExport('kml'); close();
  });
  document.getElementById('expStore').addEventListener('click', close);
  document.getElementById('expSkip').addEventListener('click', close);
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

  overlay.querySelector('#reexpCsv').addEventListener('click',     () => doExport('csv'));
  overlay.querySelector('#reexpGeoJson').addEventListener('click', () => doExport('geojson'));
  overlay.querySelector('#reexpKml').addEventListener('click',     () => doExport('kml'));
  overlay.querySelector('#reexpClose').addEventListener('click', close);
}
