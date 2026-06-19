// js/modal.js — BBS species observation modal + shared instructions modal

import { updateSpeciesList, adjustCount, saveSpeciesObservation } from './species.js';
import { observer, pointID, activeSurvey } from './surveyGlobals.js';
import { lockMap, unlockMap } from './map.js';
import { showToast } from './toast.js';

let placingPoint  = false;
let currentLatLng = null;

// ─── Active-modal registry ────────────────────────────────────────────────
let _activeModal = null;
export function setActiveModal(name) { _activeModal = name; }
export function clearActiveModal()   { _activeModal = null; }

// ─── BBS Species Modal ────────────────────────────────────────────────────
export function showSpeciesModal(latlng) {
  if (!observer || !pointID) {
    showToast('Metadata incomplete — tap 📋 to fill in.', 'warning', 3000);
  }

  const modal    = document.getElementById('speciesModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (!modal || !backdrop) return;

  placingPoint  = true;
  currentLatLng = latlng;

  const searchInput   = document.getElementById('speciesSearch');
  const speciesListEl = document.getElementById('speciesList');
  const countDisplay  = document.getElementById('speciesCountDisplay');
  const noteInput     = document.getElementById('noteInput');
  const breedingInput = document.getElementById('breedingInput');
  const passHtInput   = document.getElementById('passHtInput');
  const flightDirInput= document.getElementById('flightDirInput');

  if (searchInput)   { searchInput.value = ''; searchInput.style.display = ''; }
  if (speciesListEl) { speciesListEl.innerHTML = ''; speciesListEl.style.display = ''; }
  if (countDisplay)  countDisplay.textContent = '1';
  if (noteInput)     noteInput.value     = '';
  if (breedingInput) breedingInput.value = '';
  if (passHtInput)   passHtInput.value   = '';
  if (flightDirInput)flightDirInput.value= '';

  modal._selectedSpecies = null;
  const display = document.getElementById('selectedSpeciesDisplay');
  if (display) { display.style.display = 'none'; display.innerHTML = ''; }
  if (display && !display.dataset.wired) {
    display.dataset.wired = 'true';
    display.addEventListener('click', () => {
      modal._selectedSpecies = null;
      if (searchInput)   { searchInput.style.display = ''; searchInput.value = ''; searchInput.focus(); }
      if (speciesListEl) { speciesListEl.style.display = ''; }
      display.style.display = 'none';
      display.innerHTML = '';
      updateSpeciesList('');
    });
  }

  modal.style.display    = 'block';
  backdrop.style.display = 'block';
  setActiveModal('species');
  lockMap();
  updateSpeciesList('');
}

export function closeModal() {
  placingPoint  = false;
  currentLatLng = null;
  const speciesModal = document.getElementById('speciesModal');
  speciesModal?.style.setProperty('display', 'none');
  if (speciesModal) speciesModal._selectedSpecies = null;
  const display = document.getElementById('selectedSpeciesDisplay');
  if (display) { display.style.display = 'none'; display.innerHTML = ''; }
  const searchInput = document.getElementById('speciesSearch');
  if (searchInput) searchInput.style.display = '';
  const speciesListEl = document.getElementById('speciesList');
  if (speciesListEl) speciesListEl.style.display = '';
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
  clearActiveModal();
  unlockMap();
}

export function isPlacingPoint() { return placingPoint; }
export { currentLatLng };

// ─── Instructions Modal ───────────────────────────────────────────────────
const HELP_CONTENT = {
  BBS: `
    <h1><i class="fas fa-circle-question"></i> BBS Instructions</h1>
    <ul style="padding-left:20px;">
      <li><h2>Before You Start</h2>
        <ul>
          <li>Tap the clipboard icon and fill in all metadata (project, point ID, observer).</li>
          <li>Orient yourself to true north at your survey point.</li>
        </ul>
      </li>
      <li><h2>Recording Birds</h2>
        <ul>
          <li>Tap the map at the bird's estimated location.</li>
          <li>Search by common name or 4-letter code, set the count, add any breeding or flight details.</li>
          <li>Tap <b>Save Observation</b> — nothing is recorded until you do.</li>
          <li>Use the distance/bearing overlay (toggle on toolbar) to help estimate position — rings at 50, 100, 150, 200 m.</li>
        </ul>
      </li>
      <li><h2>Habitat</h2>
        <ul>
          <li>Tap the habitat button to log a habitat observation for the current point.</li>
        </ul>
      </li>
      <li><h2>Editing &amp; Deleting</h2>
        <ul>
          <li>Tap any marker to edit it in a popup.</li>
          <li>Use the list drawer to review, edit, or delete any observation.</li>
        </ul>
      </li>
      <li><h2>Saving</h2>
        <ul>
          <li><b>Save to Drafts</b> — keeps the session open to continue later.</li>
          <li><b>Submit</b> — finalises the session and prompts for export.</li>
        </ul>
      </li>
    </ul>`,

  MOOSE: `
    <h1><i class="fas fa-circle-question"></i> General Wildlife Survey Instructions</h1>
    <ul style="padding-left:20px;">
      <li><h2>Before You Start</h2>
        <ul>
          <li>Tap the clipboard icon and fill in all metadata (project, transect ID, observer, conditions).</li>
        </ul>
      </li>
      <li><h2>Recording Wildlife</h2>
        <ul>
          <li>Tap the map at the observation location.</li>
          <li>Select the animal type and observation category from the dropdowns, enter a count, add notes if needed.</li>
          <li>Tap <b>Save Observation</b> — nothing is recorded until you do.</li>
        </ul>
      </li>
      <li><h2>Habitat</h2>
        <ul>
          <li>Tap the habitat button to log a habitat observation at any point along the transect.</li>
        </ul>
      </li>
      <li><h2>Editing &amp; Deleting</h2>
        <ul>
          <li>Tap any marker to edit it in a popup.</li>
          <li>Use the list drawer to review, edit, or delete any observation.</li>
        </ul>
      </li>
      <li><h2>Saving</h2>
        <ul>
          <li><b>Save to Drafts</b> — keeps the session open to continue later.</li>
          <li><b>Submit</b> — finalises the session and prompts for export.</li>
        </ul>
      </li>
    </ul>`,

  TURTLE: `
    <h1><i class="fas fa-circle-question"></i> Turtle Survey Instructions</h1>
    <ul style="padding-left:20px;">
      <li><h2>Before You Start</h2>
        <ul>
          <li>Tap the clipboard icon and fill in all metadata (site name, observer, water and air temps, conditions).</li>
        </ul>
      </li>
      <li><h2>Recording Turtles</h2>
        <ul>
          <li>Tap the map at the observation location.</li>
          <li>Select species, enter a count, and fill in any relevant details (behaviour, substrate, etc.).</li>
          <li>Tap <b>Save Observation</b> — nothing is recorded until you do.</li>
        </ul>
      </li>
      <li><h2>Habitat</h2>
        <ul>
          <li>Tap the habitat button to log a habitat observation at any point along the route.</li>
        </ul>
      </li>
      <li><h2>Editing &amp; Deleting</h2>
        <ul>
          <li>Tap any marker to edit it in a popup.</li>
          <li>Use the list drawer to review, edit, or delete any observation.</li>
        </ul>
      </li>
      <li><h2>Saving</h2>
        <ul>
          <li><b>Save to Drafts</b> — keeps the session open to continue later.</li>
          <li><b>Submit</b> — finalises the session and prompts for export.</li>
        </ul>
      </li>
    </ul>`
};

function showInstructions() {
  const modal = document.getElementById('instructionsModal');
  if (!modal) return;

  const content = HELP_CONTENT[activeSurvey] || HELP_CONTENT.BBS;
  modal.innerHTML = `
    <div class="modal-content">
      ${content}
      <div class="button-row">
        <button onclick="closeInstructions()">Close</button>
      </div>
    </div>`;

  modal.style.display = 'block';
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'block');
  setActiveModal('instructions');
  lockMap();
}

function closeInstructions() {
  document.getElementById('instructionsModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
  clearActiveModal();
  unlockMap();
}

document.addEventListener('keydown', e => {
  if (e.key !== 'Escape' || !_activeModal) return;
  switch (_activeModal) {
    case 'species':      closeModal(); break;
    case 'moose':        window.closeMooseModal?.(); break;
    case 'turtle':       window.closeTurtleModal?.(); break;
    case 'nest':         window.closeNestModal?.(); break;
    case 'habitat':      window.closeHabitatModal?.(); break;
    case 'surveyMeta':   window.closeSurveyModal?.(); break;
    case 'instructions': closeInstructions(); break;
    case 'felt':         window.cancelFeltModal?.(); break;
  }
});

// ─── DOM-Ready Bindings ───────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const plus  = document.getElementById('countPlus');
  const minus = document.getElementById('countMinus');
  if (plus  && !plus.dataset.bound)  { plus.addEventListener('click', () => adjustCount(1));  plus.dataset.bound  = 'true'; }
  if (minus && !minus.dataset.bound) { minus.addEventListener('click', () => adjustCount(-1)); minus.dataset.bound = 'true'; }

  const saveButton = document.getElementById('speciesSaveButton');
  if (saveButton && !saveButton.dataset.bound) {
    saveButton.addEventListener('click', saveSpeciesObservation);
    saveButton.dataset.bound = 'true';
  }

  const searchInput = document.getElementById('speciesSearch');
  if (searchInput) {
    searchInput.addEventListener('input', e => updateSpeciesList(e.target.value));
    if (!document.getElementById('selectedSpeciesDisplay')) {
      const display = document.createElement('div');
      display.id = 'selectedSpeciesDisplay';
      display.style.cssText = 'display:none; padding:8px 10px; margin:4px 0 6px; background:#2a2a2a; border:1px solid #4caf50; border-radius:6px; cursor:pointer; font-size:0.95rem; color:#fff;';
      searchInput.parentNode.insertBefore(display, searchInput.nextSibling);
    }
  }

  // Backdrop click intentionally does NOT close observation modals —
  // the user must use Save or Cancel to prevent accidental dismissal.
});

// ─── Global Bindings ──────────────────────────────────────────────────────
window.closeModal        = closeModal;
window.showInstructions  = showInstructions;
window.closeInstructions = closeInstructions;
