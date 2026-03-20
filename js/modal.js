// js/modal.js — BBS species observation modal + shared instructions modal

import { updateSpeciesList, adjustCount, saveSpeciesObservation } from './species.js';
import { observer, pointID } from './surveyGlobals.js';
import { lockMap, unlockMap } from './map.js';

let placingPoint  = false;
let currentLatLng = null;

// ─── BBS Species Modal ────────────────────────────────────────────────────
export function showSpeciesModal(latlng) {
  if (!observer || !pointID) {
    alert('Please complete survey metadata before placing observations.');
    return;
  }
  placingPoint  = true;
  currentLatLng = latlng;

  const modal    = document.getElementById('speciesModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (!modal || !backdrop) return;

  const searchInput  = document.getElementById('speciesSearch');
  const countDisplay = document.getElementById('speciesCountDisplay');
  const noteInput    = document.getElementById('noteInput');
  const breedingInput= document.getElementById('breedingInput');
  const passHtInput  = document.getElementById('passHtInput');
  const flightDirInput=document.getElementById('flightDirInput');

  if (searchInput)   searchInput.value   = '';
  if (countDisplay)  countDisplay.textContent = '1';
  if (noteInput)     noteInput.value     = '';
  if (breedingInput) breedingInput.value = '';
  if (passHtInput)   passHtInput.value   = '';
  if (flightDirInput)flightDirInput.value= '';

  modal.style.display    = 'block';
  backdrop.style.display = 'block';
  lockMap();
  updateSpeciesList('');
}

export function closeModal() {
  placingPoint  = false;
  currentLatLng = null;
  document.getElementById('speciesModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
  unlockMap();
}

export function isPlacingPoint() { return placingPoint; }
export { currentLatLng };

// ─── Instructions Modal ───────────────────────────────────────────────────
function showInstructions() {
  document.getElementById('instructionsModal')?.style.setProperty('display', 'block');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'block');
}

function closeInstructions() {
  document.getElementById('instructionsModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeInstructions();
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
  }

  // Backdrop click intentionally does NOT close observation modals —
  // the user must use Save or Cancel to prevent accidental dismissal.
});

// ─── Global Bindings ──────────────────────────────────────────────────────
window.closeModal        = closeModal;
window.showInstructions  = showInstructions;
window.closeInstructions = closeInstructions;
