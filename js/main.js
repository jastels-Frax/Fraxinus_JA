// js/main.js — App entry point: survey selection → map initialisation

// Pre-load shared modules so their side effects (window.* bindings) are ready
import './storageData.js';
import './surveyGlobals.js';

import { setActiveSurvey } from './surveyGlobals.js';
import { initializeMap, destroyMap } from './map.js';
import { initTimerBindings, updateTable } from './ui.js';
import { closeModal }      from './modal.js';
import { updateSpeciesList, saveSpeciesObservation } from './species.js';
import { injectMooseModal } from './moose.js';
import { injectTurtleModal } from './turtle.js';
import { injectHabitatModal } from './habitat.js';
import {
  initNewSession, saveDraft, submitSession,
  loadSessions, deleteSession, resumeSession, clearInMemoryArrays
} from './sessions.js';
import {
  exportSpeciesCSV, exportSpeciesGeoJSON, exportSpeciesKML,
  exportMooseCSV,   exportMooseGeoJSON,   exportMooseKML,
  exportTurtleCSV,  exportTurtleGeoJSON,  exportTurtleKML,
  exportHabitatCSV, exportHabitatGeoJSON, exportHabitatKML
} from './export.js';

document.addEventListener('DOMContentLoaded', async () => {
  // ── Survey selection button handlers ──────────────────────────────────
  document.querySelectorAll('.survey-choice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      try {
        _launchSurvey(btn.dataset.survey);
      } catch (err) {
        alert('Error launching survey:\n' + err.message + '\n\nCheck browser console (F12) for details.');
        console.error(err);
      }
    });
  });

  // ── BBS modal backdrop / button bindings (attached once; modal hidden by default)
  document.getElementById('modalBackdrop')?.addEventListener('click', closeModal);
  document.getElementById('speciesSearch')?.addEventListener('input', e => {
    updateSpeciesList(e.target.value);
  });
  document.getElementById('speciesSaveButton')?.addEventListener('click', saveSpeciesObservation);

  // ── Render session lists on home screen ───────────────────────────────
  await _renderSessionLists();
});

// ─── Launch a survey (new session) ────────────────────────────────────────
function _launchSurvey(type) {
  initNewSession(type);
  setActiveSurvey(type);
  _showMapUI(type);
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

// ─── Tear down map UI, return to home ────────────────────────────────────
function _returnToHome() {
  document.getElementById('dataDrawer').style.display       = 'none';
  document.getElementById('surveyModal').style.display      = 'none';
  document.getElementById('modalBackdrop').style.display    = 'none';
  document.getElementById('survey-timer-strip').style.display = 'none';
  document.getElementById('masterButton').style.display     = 'none';
  document.getElementById('map').style.display              = 'none';
  destroyMap();
  document.getElementById('surveySelection').style.display  = '';
  _renderSessionLists();
}

// ─── Back button — auto-save draft if observations exist ─────────────────
window.goBackToSelection = async function () {
  try { await saveDraft(); } catch (e) { console.error('Auto-save failed:', e); }
  _returnToHome();
};

// ─── Save to Drafts button ────────────────────────────────────────────────
window.saveDraftAndGoHome = async function () {
  try { await saveDraft(); } catch (e) { console.error('Save draft failed:', e); }
  _returnToHome();
};

// ─── Submit button — save, show export dialog, then go home ──────────────
window.submitAndShowExport = async function () {
  try {
    await submitSession();
    _showExportDialog(() => _returnToHome());
  } catch (e) {
    console.error('Submit failed:', e);
    _returnToHome();
  }
};

// ─── Export dialog (shown after submit) ──────────────────────────────────
function _showExportDialog(onDone) {
  const survey = document.querySelector('[data-active-survey]')?.dataset.activeSurvey
              || window._lastSurveyType || 'BBS';

  const overlay = document.createElement('div');
  overlay.id = 'exportDialog';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;';

  overlay.innerHTML = `
    <div class="export-dialog-box">
      <div class="export-dialog-icon">✅</div>
      <h2 class="export-dialog-title">Survey Submitted</h2>
      <p class="export-dialog-sub">Download your data before returning home.</p>
      <div class="export-dialog-btns">
        <button id="expCsv">Download CSV</button>
        <button id="expGeoJson">Download GeoJSON</button>
        <button id="expKml">Download KML</button>
        <button id="expSkip" class="export-skip">Skip — Return Home</button>
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
  document.getElementById('expSkip').addEventListener('click', close);
}

// Save survey type before submitting so export dialog can use it
import { activeSurvey } from './surveyGlobals.js';
function _runExport(fmt) {
  // activeSurvey is still set at this point (cleared after _returnToHome)
  if (activeSurvey === 'BBS') {
    if (fmt === 'csv')     { exportSpeciesCSV();  exportHabitatCSV();     }
    if (fmt === 'geojson') { exportSpeciesGeoJSON(); exportHabitatGeoJSON(); }
    if (fmt === 'kml')     { exportSpeciesKML();  exportHabitatKML();     }
  } else if (activeSurvey === 'MOOSE') {
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

  document.getElementById('draftsSection').style.display  = drafts.length  ? '' : 'none';
  document.getElementById('recentSection').style.display  = recent.length  ? '' : 'none';
}

function _populateList(listId, sessions, isDraft) {
  const el = document.getElementById(listId);
  if (!el) return;
  el.innerHTML = '';
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
        ${isDraft ? `<button class="session-btn-resume" data-id="${s.id}" title="Resume">▶ Resume</button>` : ''}
        <button class="session-btn-export" data-type="${s.type}" data-id="${s.id}" title="Re-export">⬇ Export</button>
        <button class="session-btn-delete" data-id="${s.id}" title="Delete">✕</button>
      </div>`;

    if (isDraft) {
      item.querySelector('.session-btn-resume').addEventListener('click', async e => {
        e.stopPropagation();
        const session = (await loadSessions()).find(x => x.id === s.id);
        if (session) _resumeSurvey(session);
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
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:9000;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;';

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
  const doExport = async (fmt) => {
    // Populate in-memory arrays from snapshot so export functions work
    await import('./storage.js').then(m => m.restoreSnapshot(snap));
    // Re-load into memory (storage load functions populate in-memory arrays)
    // Use a simpler direct approach: push serialized records to arrays
    const { speciesMarkers, mooseObservations, turtleObservations, habitatObservations } = await import('./storageData.js');
    clearInMemoryArrays();
    (snap.speciesMarkers     || []).forEach(r => speciesMarkers.push(r));
    (snap.mooseObservations  || []).forEach(r => mooseObservations.push(r));
    (snap.turtleObservations || []).forEach(r => turtleObservations.push(r));
    (snap.habitatObservations|| []).forEach(r => habitatObservations.push(r));

    const type = session.type;
    if (type === 'BBS') {
      if (fmt === 'csv')     { exportSpeciesCSV();     exportHabitatCSV();     }
      if (fmt === 'geojson') { exportSpeciesGeoJSON();  exportHabitatGeoJSON(); }
      if (fmt === 'kml')     { exportSpeciesKML();      exportHabitatKML();     }
    } else if (type === 'MOOSE') {
      if (fmt === 'csv')     { exportMooseCSV();        exportHabitatCSV();     }
      if (fmt === 'geojson') { exportMooseGeoJSON();    exportHabitatGeoJSON(); }
      if (fmt === 'kml')     { exportMooseKML();        exportHabitatKML();     }
    } else {
      if (fmt === 'csv')     { exportTurtleCSV();       exportHabitatCSV();     }
      if (fmt === 'geojson') { exportTurtleGeoJSON();   exportHabitatGeoJSON(); }
      if (fmt === 'kml')     { exportTurtleKML();       exportHabitatKML();     }
    }
    clearInMemoryArrays();
    close();
  };

  overlay.querySelector('#reexpCsv').addEventListener('click',     () => doExport('csv'));
  overlay.querySelector('#reexpGeoJson').addEventListener('click', () => doExport('geojson'));
  overlay.querySelector('#reexpKml').addEventListener('click',     () => doExport('kml'));
  overlay.querySelector('#reexpClose').addEventListener('click', close);
}
