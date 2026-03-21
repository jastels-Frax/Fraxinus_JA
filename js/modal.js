// js/modal.js — BBS species observation modal + shared instructions modal

import { updateSpeciesList, adjustCount, saveSpeciesObservation } from './species.js';
import { observer, pointID, activeSurvey } from './surveyGlobals.js';
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
  lockMap();
}

function closeInstructions() {
  document.getElementById('instructionsModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
  unlockMap();
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
