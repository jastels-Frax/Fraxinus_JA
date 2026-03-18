// js/turtle.js — Wood Turtle Survey module

import { turtleObservations } from './storageData.js';
import { syncTurtleToIndexedDB } from './storage.js';
import { updateTable } from './ui.js';
import { map } from './map.js';
import * as G from './surveyGlobals.js';

// ─── Modal State ──────────────────────────────────────────────────────────
let turtlePlacingPoint = false;
let turtleCurrentLatLng = null;

export function isTurtlePlacingPoint() { return turtlePlacingPoint; }

// ─── Show / Close Modal ───────────────────────────────────────────────────
export function showTurtleModal(latlng) {
  if (!G.turtleObserver || !G.turtleSiteName) {
    alert('Please complete survey metadata before placing observations.');
    return;
  }
  turtlePlacingPoint = true;
  turtleCurrentLatLng = latlng;

  const modal    = document.getElementById('turtleModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (!modal || !backdrop) return;

  // Reset fields
  modal.querySelector('#turtleObsTypeInput').value    = 'Direct Species Observation';
  modal.querySelector('#turtleSexInput').value        = '';
  modal.querySelector('#turtleAgeClassInput').value   = '';
  modal.querySelector('#turtleCarapaceInput').value   = '';
  modal.querySelector('#turtleConditionInput').value  = '';
  modal.querySelector('#turtleBaskingInput').value    = '';
  modal.querySelector('#turtleSubstrateInput').value  = '';
  modal.querySelector('#turtleActivityInput').value   = '';
  modal.querySelector('#turtleHabitatInput').value    = '';
  modal.querySelector('#turtlePhotoIDInput').value    = '';
  modal.querySelector('#turtleNoteInput').value       = '';

  _refreshTurtleModalVisibility(modal);

  modal.style.display    = 'block';
  backdrop.style.display = 'block';
}

export function closeTurtleModal() {
  turtlePlacingPoint   = false;
  turtleCurrentLatLng  = null;
  document.getElementById('turtleModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
}

// Toggle field visibility based on observation type
function _refreshTurtleModalVisibility(modal) {
  const type      = modal.querySelector('#turtleObsTypeInput').value;
  const isDirect  = type === 'Direct Species Observation';
  const isHabitat = type === 'Habitat Observation';

  modal.querySelector('#turtleDirectFields').style.display  = isDirect  ? 'block' : 'none';
  modal.querySelector('#turtleHabitatFields').style.display = isHabitat ? 'block' : 'none';
}

// ─── Save Observation ─────────────────────────────────────────────────────
export function saveTurtleObservation() {
  const obsType       = document.getElementById('turtleObsTypeInput')?.value.trim();
  const sex           = document.getElementById('turtleSexInput')?.value.trim()       || '';
  const ageClass      = document.getElementById('turtleAgeClassInput')?.value.trim()  || '';
  const carapace      = document.getElementById('turtleCarapaceInput')?.value.trim()  || '';
  const condition     = document.getElementById('turtleConditionInput')?.value.trim() || '';
  const basking       = document.getElementById('turtleBaskingInput')?.value.trim()   || '';
  const substrate     = document.getElementById('turtleSubstrateInput')?.value.trim() || '';
  const activity      = document.getElementById('turtleActivityInput')?.value.trim()  || '';
  const habitat       = document.getElementById('turtleHabitatInput')?.value.trim()   || '';
  const photoID       = document.getElementById('turtlePhotoIDInput')?.value.trim()   || '';
  const note          = document.getElementById('turtleNoteInput')?.value.trim()       || '';

  if (!obsType) {
    alert('Please select an observation type.');
    return;
  }
  if (!turtleCurrentLatLng) {
    alert('No map location captured. Tap the map to place an observation.');
    return;
  }

  const latlng    = turtleCurrentLatLng;
  const timestamp = new Date().toLocaleString();
  const index     = turtleObservations.length;

  // Build label
  const sexAbbr   = sex === 'Male' ? 'M' : sex === 'Female' ? 'F' : 'U';
  const labelText = obsType === 'Direct Species Observation'
    ? `${sexAbbr} ${carapace || '?'}mm`
    : (activity || obsType);

  // Marker (green)
  const marker = L.circleMarker(latlng, {
    radius: 15,
    color: 'green',
    fillColor: 'white',
    fillOpacity: 0.6,
    weight: 2
  }).addTo(map);

  const label = L.marker([latlng.lat, latlng.lng + 0.0001], {
    icon: L.divIcon({
      className: 'marker-label',
      html: labelText,
      iconAnchor: [0, 20]
    })
  }).addTo(map);

  const obsRecord = {
    projectID:      G.turtleProjectID  || '',
    siteName:       G.turtleSiteName   || '',
    observer:       G.turtleObserver   || '',
    surveyDate:     G.turtleSurveyDate || '',
    startTime:      G.turtleStartTime  || '',
    endTime:        G.turtleEndTime    || '',
    waterTemp:      G.turtleWaterTemp  || '',
    airTemp:        G.turtleAirTemp    || '',
    waterLevel:     G.turtleWaterLevel || '',
    weather:        G.turtleWeather    || '',
    obsType,
    activity,
    habitat,
    sex,
    ageClass,
    carapaceLength: carapace,
    condition,
    basking,
    substrate,
    photoID,
    note,
    latlng,
    marker,
    label,
    timestamp
  };

  const popup = createTurtlePopupHTML(index, obsRecord);
  marker.bindPopup(popup);

  turtleObservations.push(obsRecord);
  syncTurtleToIndexedDB();
  updateTable();
  closeTurtleModal();
}

// ─── Popup HTML ───────────────────────────────────────────────────────────
export function createTurtlePopupHTML(index, obs) {
  const isDirect  = obs.obsType === 'Direct Species Observation';
  const isHabitat = obs.obsType === 'Habitat Observation';
  const div = document.createElement('div');
  div.className = 'popup-content compact';
  div.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">${obs.obsType || 'Turtle Observation'}</div>
    <div class="form-row">
      <label>Obs. Type:</label>
      <select id="turtlePopObsType-${index}" onchange="refreshTurtlePopup(${index})">
        <option value="Direct Species Observation" ${obs.obsType === 'Direct Species Observation' ? 'selected' : ''}>Direct Species Observation</option>
        <option value="Habitat Observation" ${obs.obsType === 'Habitat Observation' ? 'selected' : ''}>Habitat Observation</option>
      </select>
    </div>

    <div id="turtlePopDirect-${index}" style="display:${isDirect ? 'block' : 'none'};">
      <div class="form-row">
        <label>Sex:</label>
        <select id="turtlePopSex-${index}">
          <option value="">-- Select --</option>
          <option value="Male"    ${obs.sex === 'Male'    ? 'selected' : ''}>Male</option>
          <option value="Female"  ${obs.sex === 'Female'  ? 'selected' : ''}>Female</option>
          <option value="Unknown" ${obs.sex === 'Unknown' ? 'selected' : ''}>Unknown/Juvenile</option>
        </select>
      </div>
      <div class="form-row">
        <label>Age Class:</label>
        <select id="turtlePopAge-${index}">
          <option value="">-- Select --</option>
          <option value="Adult"     ${obs.ageClass === 'Adult'     ? 'selected' : ''}>Adult</option>
          <option value="Juvenile"  ${obs.ageClass === 'Juvenile'  ? 'selected' : ''}>Juvenile</option>
          <option value="Hatchling" ${obs.ageClass === 'Hatchling' ? 'selected' : ''}>Hatchling</option>
          <option value="Unknown"   ${obs.ageClass === 'Unknown'   ? 'selected' : ''}>Unknown</option>
        </select>
      </div>
      <div class="form-row">
        <label>Carapace (mm):</label>
        <input type="number" id="turtlePopCarapace-${index}" value="${obs.carapaceLength || ''}" />
      </div>
      <div class="form-row">
        <label>Condition:</label>
        <select id="turtlePopCondition-${index}">
          <option value="">-- Select --</option>
          <option value="Excellent" ${obs.condition === 'Excellent' ? 'selected' : ''}>Excellent</option>
          <option value="Good"      ${obs.condition === 'Good'      ? 'selected' : ''}>Good</option>
          <option value="Fair"      ${obs.condition === 'Fair'      ? 'selected' : ''}>Fair</option>
          <option value="Poor"      ${obs.condition === 'Poor'      ? 'selected' : ''}>Poor</option>
          <option value="Injured"   ${obs.condition === 'Injured'   ? 'selected' : ''}>Injured</option>
          <option value="Dead"      ${obs.condition === 'Dead'      ? 'selected' : ''}>Dead</option>
        </select>
      </div>
      <div class="form-row">
        <label>Basking:</label>
        <select id="turtlePopBasking-${index}">
          <option value="">-- Select --</option>
          <option value="Yes" ${obs.basking === 'Yes' ? 'selected' : ''}>Yes</option>
          <option value="No"  ${obs.basking === 'No'  ? 'selected' : ''}>No</option>
        </select>
      </div>
      <div class="form-row">
        <label>Substrate:</label>
        <input type="text" id="turtlePopSubstrate-${index}" value="${obs.substrate || ''}" placeholder="e.g. Rock, Log, Mud" />
      </div>
    </div>

    <div id="turtlePopHabitat-${index}" style="display:${isHabitat ? 'block' : 'none'};">
      <div class="form-row">
        <label>Activity:</label>
        <select id="turtlePopActivity-${index}">
          ${_turtleActivityOptions(obs.activity)}
        </select>
      </div>
    </div>

    <div class="form-row">
      <label>Riparian Habitat:</label>
      <select id="turtlePopHabitatType-${index}">
        ${_turtleHabitatOptions(obs.habitat)}
      </select>
    </div>
    <div class="form-row">
      <label>Photo ID:</label>
      <input type="text" id="turtlePopPhoto-${index}" value="${obs.photoID || ''}" placeholder="Photo filename or ID" />
    </div>
    <div class="form-row">
      <label>Notes:</label>
      <textarea id="turtlePopNote-${index}" rows="2">${obs.note || ''}</textarea>
    </div>
    <div class="form-row" style="justify-content:space-between;">
      <button onclick="updateTurtleObservation(${index})">Save</button>
      <button class="danger" onclick="deleteTurtleMarker(${index})">Delete</button>
    </div>
  `;
  return div;
}

// ─── Popup refresh on type change ─────────────────────────────────────────
function refreshTurtlePopup(index) {
  const type      = document.getElementById(`turtlePopObsType-${index}`)?.value;
  const isDirect  = type === 'Direct Species Observation';
  const isHabitat = type === 'Habitat Observation';
  document.getElementById(`turtlePopDirect-${index}`).style.display  = isDirect  ? 'block' : 'none';
  document.getElementById(`turtlePopHabitat-${index}`).style.display = isHabitat ? 'block' : 'none';
}

// ─── Popup Save / Delete ──────────────────────────────────────────────────
function updateTurtleObservation(index) {
  const rec = turtleObservations[index];
  if (!rec) return;

  rec.obsType        = document.getElementById(`turtlePopObsType-${index}`)?.value    || rec.obsType;
  rec.sex            = document.getElementById(`turtlePopSex-${index}`)?.value        || '';
  rec.ageClass       = document.getElementById(`turtlePopAge-${index}`)?.value        || '';
  rec.carapaceLength = document.getElementById(`turtlePopCarapace-${index}`)?.value   || '';
  rec.condition      = document.getElementById(`turtlePopCondition-${index}`)?.value  || '';
  rec.basking        = document.getElementById(`turtlePopBasking-${index}`)?.value    || '';
  rec.substrate      = document.getElementById(`turtlePopSubstrate-${index}`)?.value  || '';
  rec.activity       = document.getElementById(`turtlePopActivity-${index}`)?.value   || '';
  rec.habitat        = document.getElementById(`turtlePopHabitatType-${index}`)?.value|| '';
  rec.photoID        = document.getElementById(`turtlePopPhoto-${index}`)?.value      || '';
  rec.note           = document.getElementById(`turtlePopNote-${index}`)?.value       || '';

  const sexAbbr   = rec.sex === 'Male' ? 'M' : rec.sex === 'Female' ? 'F' : 'U';
  const labelText = rec.obsType === 'Direct Species Observation'
    ? `${sexAbbr} ${rec.carapaceLength || '?'}mm`
    : (rec.activity || rec.obsType);

  rec.label.setIcon(L.divIcon({
    className: 'marker-label',
    html: labelText,
    iconAnchor: [0, 10]
  }));

  syncTurtleToIndexedDB();
  updateTable();
  rec.marker.closePopup();
}

function deleteTurtleMarker(index) {
  const obs = turtleObservations[index];
  if (!obs) return;
  if (obs.marker) map.removeLayer(obs.marker);
  if (obs.label)  map.removeLayer(obs.label);
  turtleObservations.splice(index, 1);
  syncTurtleToIndexedDB();
  updateTable();
}

window.updateTurtleObservation = updateTurtleObservation;
window.deleteTurtleMarker      = deleteTurtleMarker;
window.saveTurtleObservation   = saveTurtleObservation;
window.closeTurtleModal        = closeTurtleModal;
window.refreshTurtlePopup      = refreshTurtlePopup;

// ─── Option Generators ────────────────────────────────────────────────────
function _sel(val, cur) { return val === cur ? 'selected' : ''; }

function _turtleActivityOptions(cur = '') {
  const list = ['Basking', 'Foraging', 'Overwintering', 'Nesting', 'Travelling', 'Refuge/Shelter', 'Unknown'];
  return `<option value="">-- Select --</option>` +
    list.map(s => `<option value="${s}" ${_sel(s, cur)}>${s}</option>`).join('');
}

function _turtleHabitatOptions(cur = '') {
  const list = [
    'Marsh', 'Riparian Forest', 'Upland Forest', 'Rocky Shore',
    'Sandy Bank', 'Agricultural Field', 'Road/Path',
    'Open Water', 'Gravel Bar', 'Shrub/Scrub', 'Other'
  ];
  return `<option value="">-- Select --</option>` +
    list.map(s => `<option value="${s}" ${_sel(s, cur)}>${s}</option>`).join('');
}

// ─── Inject modal HTML into DOM ───────────────────────────────────────────
export function injectTurtleModal() {
  let el = document.getElementById('turtleModal');
  if (el) return;
  el = document.createElement('div');
  el.id = 'turtleModal';
  el.className = 'modal';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="modal-content">
      <h2>Turtle Observation</h2>

      <label>Observation Type:</label>
      <select id="turtleObsTypeInput" onchange="turtleModalTypeChange()">
        <option value="Direct Species Observation">Direct Species Observation</option>
        <option value="Habitat Observation">Habitat Observation</option>
      </select>

      <!-- Direct Species fields -->
      <div id="turtleDirectFields">
        <label>Sex:</label>
        <select id="turtleSexInput">
          <option value="">-- Select --</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Unknown">Unknown/Juvenile</option>
        </select>

        <label>Age Class:</label>
        <select id="turtleAgeClassInput">
          <option value="">-- Select --</option>
          <option value="Adult">Adult</option>
          <option value="Juvenile">Juvenile</option>
          <option value="Hatchling">Hatchling</option>
          <option value="Unknown">Unknown</option>
        </select>

        <label>Carapace Length (mm):</label>
        <input type="number" id="turtleCarapaceInput" placeholder="e.g. 142" />

        <label>Condition:</label>
        <select id="turtleConditionInput">
          <option value="">-- Select --</option>
          <option value="Excellent">Excellent</option>
          <option value="Good">Good</option>
          <option value="Fair">Fair</option>
          <option value="Poor">Poor</option>
          <option value="Injured">Injured</option>
          <option value="Dead">Dead</option>
        </select>

        <label>Basking:</label>
        <select id="turtleBaskingInput">
          <option value="">-- Select --</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>

        <label>Substrate:</label>
        <input type="text" id="turtleSubstrateInput" placeholder="e.g. Rock, Log, Mud" />
      </div>

      <!-- Habitat Observation fields -->
      <div id="turtleHabitatFields" style="display:none;">
        <label>Activity:</label>
        <select id="turtleActivityInput">
          ${_turtleActivityOptions()}
        </select>
        <p style="color:#aaa; font-size:0.85em; margin:4px 0;">
          📷 Prompt: Capture a photo if possible and record the ID below.
        </p>
      </div>

      <label>Riparian Habitat Type:</label>
      <select id="turtleHabitatInput">
        ${_turtleHabitatOptions()}
      </select>

      <label>Photo ID (filename / reference):</label>
      <input type="text" id="turtlePhotoIDInput" placeholder="e.g. IMG_0042" />

      <label>Notes:</label>
      <textarea id="turtleNoteInput" rows="3" placeholder="Optional notes..."></textarea>

      <div style="margin-top:10px; display:flex; gap:8px;">
        <button onclick="saveTurtleObservation()">Save Observation</button>
        <button onclick="closeTurtleModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
}

// Modal type-change handler (global for inline onchange)
window.turtleModalTypeChange = function () {
  const modal = document.getElementById('turtleModal');
  if (modal) _refreshTurtleModalVisibility(modal);
};
