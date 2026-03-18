// js/main.js — App entry point: survey selection → map initialisation

// Pre-load shared modules so their side effects (window.* bindings) are ready
import './storageData.js';
import './surveyGlobals.js';

import { setActiveSurvey } from './surveyGlobals.js';
import { initializeMap }   from './map.js';
import { initTimerBindings, updateTable } from './ui.js';
import { closeModal }      from './modal.js';
import { updateSpeciesList, saveSpeciesObservation } from './species.js';
import { injectMooseModal } from './moose.js';
import { injectTurtleModal } from './turtle.js';

document.addEventListener('DOMContentLoaded', () => {
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
});

// ─── Launch a survey ──────────────────────────────────────────────────────
function _launchSurvey(type) {
  // 1. Store active survey (live binding used by all other modules)
  setActiveSurvey(type);

  // 2. Hide selection screen
  document.getElementById('surveySelection').style.display = 'none';

  // 3. Show map and master buttons
  document.getElementById('map').style.removeProperty('display');
  document.getElementById('masterButton').style.removeProperty('display');

  // 4. Hide dataDrawer initially (updateTable will show it when opened)
  document.getElementById('dataDrawer').style.display = 'none';

  // 5. Timer strip: only visible for BBS
  const timerStrip = document.getElementById('survey-timer-strip');
  if (timerStrip) timerStrip.style.display = type === 'BBS' ? 'flex' : 'none';

  // 6. Inject survey-specific observation modals into DOM
  if (type === 'MOOSE') {
    injectMooseModal();
  } else if (type === 'TURTLE') {
    injectTurtleModal();
  }

  // 7. Initialise Leaflet map + load stored observations from IndexedDB
  initializeMap();

  // 8. Wire timer buttons (BBS only)
  if (type === 'BBS') initTimerBindings();

  // 9. Initial empty table render
  updateTable();
}
