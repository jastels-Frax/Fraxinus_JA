// js/species.js — BBS species search, count, save, popup

import { speciesMarkers } from './storageData.js';
import { syncToIndexedDB } from './storage.js';
import { updateTable } from './ui.js';
import { closeModal, currentLatLng } from './modal.js';
import { map, observerLocation } from './map.js';
import {
  projectID, pointID, observer, surveyType,
  surveyLength, wind, windDir, tempC, precip, siteHabitat,
  surveyLat, surveyLng, surveyStartTime, surveyEndTime,
  surveySubmittedAt, surveyResubmittedAt
} from './surveyGlobals.js';

// ─── Species Search Autocomplete ──────────────────────────────────────────
export function updateSpeciesList(filter) {
  const list = document.getElementById('speciesList');
  if (!list || !window.speciesList) return;
  list.innerHTML = '';
  window.speciesList
    .filter(sp =>
      sp.code.includes(filter.toUpperCase()) ||
      sp.name.toLowerCase().includes(filter.toLowerCase())
    )
    .forEach(sp => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${sp.code}</strong> – ${sp.name}${sp.soci ? ' <span style="color:tomato;">(SOCI)</span>' : ''}`;
      li.style.cursor = 'pointer';
      li.onclick = () => {
        document.getElementById('speciesSearch').value = sp.code;
        list.innerHTML = '';
      };
      list.appendChild(li);
    });
}

// ─── Count Adjuster ───────────────────────────────────────────────────────
export function adjustCount(delta) {
  const display = document.getElementById('speciesCountDisplay');
  if (!display) return;
  let count = parseInt(display.textContent || '1', 10);
  if (isNaN(count)) count = 1;
  count = Math.max(1, count + delta);
  display.textContent = count;
}

// ─── Save Observation ─────────────────────────────────────────────────────
export function saveSpeciesObservation() {
  const code    = document.getElementById('speciesSearch')?.value.trim().toUpperCase();
  const species = window.speciesList?.find(sp => sp.code === code);
  if (!species || !currentLatLng) {
    alert('Invalid species or location.');
    return;
  }

  const count     = parseInt(document.getElementById('speciesCountDisplay')?.textContent) || 1;
  const breeding  = document.getElementById('breedingInput')?.value  || '';
  const note      = document.getElementById('noteInput')?.value      || '';
  const passHt    = document.getElementById('passHtInput')?.value    || '';    // BUG FIX: was 'passHt'
  const flightDir = document.getElementById('flightDirInput')?.value || '';    // BUG FIX: was 'flightDir'
  const latlng    = currentLatLng;
  const timestamp = new Date().toLocaleString();
  const index     = speciesMarkers.length;

  // Distance & bearing from observer
  let dist = 0, angle = 0;
  if (observerLocation) {
    dist  = latlng.distanceTo(observerLocation);
    angle = (Math.atan2(
      Math.sin((latlng.lng - observerLocation.lng) * Math.PI / 180) * Math.cos(latlng.lat * Math.PI / 180),
      Math.cos(observerLocation.lat * Math.PI / 180) * Math.sin(latlng.lat * Math.PI / 180) -
      Math.sin(observerLocation.lat * Math.PI / 180) * Math.cos(latlng.lat * Math.PI / 180) *
      Math.cos((latlng.lng - observerLocation.lng) * Math.PI / 180)
    ) * 180 / Math.PI + 360) % 360;
  }

  // Marker (white fill, SOCI = red border)
  const marker = L.circleMarker(latlng, {
    radius:      15,
    color:       species.soci ? 'red' : 'green',
    fillColor:   'white',
    fillOpacity: 0.6,
    weight:      2
  }).addTo(map);

  const label = L.marker([latlng.lat, latlng.lng + 0.0001], {
    icon: L.divIcon({
      className: 'marker-label',
      html:      `${species.code} (${count})`,
      iconAnchor:[0, 20]
    })
  }).addTo(map);

  const popup = createSpeciesPopupHTML(index, species.code, count, breeding, note, passHt, flightDir);
  marker.bindPopup(popup);

  speciesMarkers.push({
    code: species.code, name: species.name, soci: species.soci,
    latlng, observer, pointID, projectID, surveyType,
    surveyLength, wind, windDir, tempC, precip, siteHabitat,
    surveyLat, surveyLng, surveyStartTime, surveyEndTime,
    surveySubmittedAt, surveyResubmittedAt,
    count, breeding, note, passHt, flightDir,
    marker, label,
    range: Math.round(dist), bearing: Math.round(angle),
    timestamp
  });

  syncToIndexedDB();
  updateTable();
  closeModal();
}

// ─── Popup HTML ───────────────────────────────────────────────────────────
export function createSpeciesPopupHTML(index, code, count, breeding, note, passHeight = '', flightDir = '') {
  const popup = document.createElement('div');
  popup.className = 'popup-content compact';
  popup.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">${code}</div>
    <div class="form-row">
      <label>Count:</label>
      <div class="counter-inline">
        <button onclick="decrementCount(${index})">−</button>
        <span id="count-${index}">${count}</span>
        <button onclick="incrementCount(${index})">+</button>
      </div>
    </div>
    <div class="form-row">
      <label>Breeding:</label>
      <select id="breeding-${index}">
        <option value="">None</option>
        <option value="X"  ${breeding==='X'  ?'selected':''}>Observed – no breeding evidence (X)</option>
        <option value="H"  ${breeding==='H'  ?'selected':''}>Possible – Suitable habitat (H)</option>
        <option value="S"  ${breeding==='S'  ?'selected':''}>Possible – Singing male (S)</option>
        <option value="P"  ${breeding==='P'  ?'selected':''}>Probable – Pair observed (P)</option>
        <option value="T"  ${breeding==='T'  ?'selected':''}>Probable – Territorial (T)</option>
        <option value="D"  ${breeding==='D'  ?'selected':''}>Probable – Courtship/display (D)</option>
        <option value="V"  ${breeding==='V'  ?'selected':''}>Probable – Nest site visit (V)</option>
        <option value="A"  ${breeding==='A'  ?'selected':''}>Probable – Agitated behaviour (A)</option>
        <option value="B"  ${breeding==='B'  ?'selected':''}>Probable – Brood patch (B)</option>
        <option value="N"  ${breeding==='N'  ?'selected':''}>Probable – Nest building (N)</option>
        <option value="NB" ${breeding==='NB' ?'selected':''}>Confirmed – Carrying nest material (NB)</option>
        <option value="DD" ${breeding==='DD' ?'selected':''}>Confirmed – Distraction display (DD)</option>
        <option value="NU" ${breeding==='NU' ?'selected':''}>Confirmed – Used nest/eggshells (NU)</option>
        <option value="FY" ${breeding==='FY' ?'selected':''}>Confirmed – Fledged/downy young (FY)</option>
        <option value="AE" ${breeding==='AE' ?'selected':''}>Confirmed – Adult entering nest (AE)</option>
        <option value="FS" ${breeding==='FS' ?'selected':''}>Confirmed – Fecal sac (FS)</option>
        <option value="CF" ${breeding==='CF' ?'selected':''}>Confirmed – Carrying food (CF)</option>
        <option value="NE" ${breeding==='NE' ?'selected':''}>Confirmed – Nest with eggs (NE)</option>
      </select>
    </div>
    <div class="form-row">
      <label>Flyover Height:</label>
      <input type="text" id="passHeight-${index}" value="${passHeight}" placeholder="e.g. 50m" />
    </div>
    <div class="form-row">
      <label>Direction:</label>
      <select id="flightDir-${index}">
        <option value="">Select</option>
        <option value="N"  ${flightDir==='N'  ?'selected':''}>North</option>
        <option value="NE" ${flightDir==='NE' ?'selected':''}>NE</option>
        <option value="E"  ${flightDir==='E'  ?'selected':''}>East</option>
        <option value="SE" ${flightDir==='SE' ?'selected':''}>SE</option>
        <option value="S"  ${flightDir==='S'  ?'selected':''}>South</option>
        <option value="SW" ${flightDir==='SW' ?'selected':''}>SW</option>
        <option value="W"  ${flightDir==='W'  ?'selected':''}>West</option>
        <option value="NW" ${flightDir==='NW' ?'selected':''}>NW</option>
      </select>
    </div>
    <div class="form-row">
      <label>Notes:</label>
      <textarea id="note-${index}" rows="2">${note}</textarea>
    </div>
    <div class="form-row" style="justify-content:space-between;">
      <button onclick="updateCount(${index})">Save</button>
      <button class="danger" onclick="deleteMarker(${index})">Delete</button>
    </div>
  `;
  return popup;
}

// ─── Popup Count Adjusters ────────────────────────────────────────────────
function incrementCount(index) {
  const span = document.getElementById(`count-${index}`);
  if (span) span.textContent = parseInt(span.textContent || '1', 10) + 1;
}

function decrementCount(index) {
  const span = document.getElementById(`count-${index}`);
  if (!span) return;
  const val = parseInt(span.textContent || '1', 10);
  if (val > 1) span.textContent = val - 1;
}

function updateCount(index) {
  const countEl    = document.getElementById(`count-${index}`);
  const breedEl    = document.getElementById(`breeding-${index}`);
  const noteEl     = document.getElementById(`note-${index}`);
  const passHtEl   = document.getElementById(`passHeight-${index}`);
  const flightDirEl= document.getElementById(`flightDir-${index}`);
  const record     = speciesMarkers[index];
  if (!countEl || !breedEl || !record) return;

  record.count    = parseInt(countEl.textContent || '1', 10);
  record.breeding = breedEl.value;
  record.note     = noteEl?.value      || '';
  record.passHt   = passHtEl?.value    || '';
  record.flightDir= flightDirEl?.value || '';

  record.label.setIcon(L.divIcon({
    className: 'marker-label',
    html:      `${record.code} (${record.count})`,
    iconAnchor:[0, 10]
  }));
  syncToIndexedDB();
  updateTable();
  record.marker.closePopup();
}

// ─── Globals (for inline onclick handlers in popup HTML) ──────────────────
window.adjustCount          = adjustCount;
window.saveSpeciesObservation= saveSpeciesObservation;
window.incrementCount       = incrementCount;
window.decrementCount       = decrementCount;
window.updateCount          = updateCount;
