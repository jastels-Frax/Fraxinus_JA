// js/turtle.js — Wood Turtle Survey module

import { turtleObservations } from './storageData.js';
import { syncTurtleToIndexedDB } from './storage.js';
import { updateTable } from './ui.js';
import { map, lockMap, unlockMap } from './map.js';
import * as G from './surveyGlobals.js';
import { capturePhoto } from './photo.js';
import { showUndoToast } from './toast.js';
import { setActiveModal, clearActiveModal } from './modal.js';

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
  if (!modal || !backdrop) {
    console.error('[showTurtleModal] modal not found — injectTurtleModal() may not have been called');
    showToast('Observation form not ready. Please restart the survey.', 'error', 5000);
    return;
  }

  // Reset fields
  modal.querySelector('#turtleSpeciesInput').value    = '';
  modal.querySelector('#turtleSexInput').value        = '';
  modal.querySelector('#turtleAgeClassInput').value   = '';
  modal.querySelector('#turtleActivityInput').value   = '';
  modal.querySelector('#turtleHabitatInput').value    = '';
  modal.querySelector('#turtlePhotoIDInput').value    = '';
  modal.querySelector('#turtleNoteInput').value       = '';

  ['turtleActivityOtherWrap','turtleHabitatOtherWrap'].forEach(id => {
    const wrap = modal.querySelector(`#${id}`);
    if (wrap) { wrap.style.display = 'none'; wrap.querySelector('input').value = ''; }
  });

  modal.style.display    = 'block';
  backdrop.style.display = 'block';
  setActiveModal('turtle');
  lockMap();
}

export function closeTurtleModal() {
  turtlePlacingPoint   = false;
  turtleCurrentLatLng  = null;
  document.getElementById('turtleModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
  clearActiveModal();
  unlockMap();
}

// ─── Save Observation ─────────────────────────────────────────────────────
export function saveTurtleObservation() {
  const species  = document.getElementById('turtleSpeciesInput')?.value.trim()  || '';
  const sex      = document.getElementById('turtleSexInput')?.value.trim()      || '';
  const ageClass = document.getElementById('turtleAgeClassInput')?.value.trim() || '';
  const activity = _otherVal('turtleActivityInput', 'turtleActivityOther');
  const habitat  = _otherVal('turtleHabitatInput',  'turtleHabitatOther');
  const photoID  = document.getElementById('turtlePhotoIDInput')?.value.trim()  || '';
  const note     = document.getElementById('turtleNoteInput')?.value.trim()     || '';

  if (!turtleCurrentLatLng) {
    alert('No location captured. Use the Record Observation button to geotag your current position.');
    return;
  }

  // Normalise to plain {lat, lng} regardless of whether source was Leaflet LatLng,
  // GeolocationCoordinates {latitude, longitude}, or an array [lat, lng].
  const rawLL  = turtleCurrentLatLng;
  const latlng = {
    lat: rawLL.lat ?? rawLL.latitude  ?? rawLL[0],
    lng: rawLL.lng ?? rawLL.longitude ?? rawLL[1]
  };
  if (!isFinite(latlng.lat) || !isFinite(latlng.lng)) {
    alert('Invalid GPS coordinates — please try again.');
    return;
  }
  const timestamp = new Date().toLocaleString();
  const index     = turtleObservations.length;

  // Build map label
  const sexAbbr   = sex === 'Male' ? 'M' : sex === 'Female' ? 'F' : 'U';
  const spAbbr    = species ? species.split(' ').map(w => w[0]).join('') : '?';
  const labelText = `${spAbbr} ${sexAbbr}${activity ? ' · ' + activity : ''}`;

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

  // Read start/end times fresh from localStorage — the modal may have updated
  // them after module load.
  const _startTime = localStorage.getItem('turtleStartTime') || '';
  const _endTime   = localStorage.getItem('turtleEndTime')   || '';

  const obsRecord = {
    projectID:  G.turtleProjectID  || '',
    siteName:   G.turtleSiteName   || '',
    observer:   G.turtleObserver   || '',
    surveyDate: G.turtleSurveyDate || '',
    startTime:  _startTime,
    endTime:    _endTime,
    waterTemp:  G.turtleWaterTemp  || null,
    airTemp:    G.turtleAirTemp    || null,
    waterLevel: G.turtleWaterLevel || '',
    weather:    G.turtleWeather    || '',
    species,
    sex,
    ageClass,
    activity,
    habitat,
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
  const actOther = _customText(_TURTLE_ACTIVITIES, obs.activity);
  const habOther = _customText(_TURTLE_HABITATS,   obs.habitat);
  const div = document.createElement('div');
  div.className = 'popup-content compact';
  div.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">Turtle Observation</div>
    <div class="form-row">
      <label>Species:</label>
      <select id="turtlePopSpecies-${index}">
        ${_turtleSpeciesOptions(obs.species || '')}
      </select>
    </div>
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
      <label>Activity:</label>
      <select id="turtlePopActivity-${index}" onchange="handleOtherSelect(this,'turtlePopActivityOtherRow-${index}')">
        ${_turtleActivityOptions(obs.activity)}
      </select>
    </div>
    <div class="form-row" id="turtlePopActivityOtherRow-${index}" style="${(actOther || obs.activity === 'Other') ? '' : 'display:none;'}">
      <label></label>
      <input type="text" id="turtlePopActivityOther-${index}" value="${actOther}" placeholder="Specify activity…" style="flex:1;" />
    </div>
    <div class="form-row">
      <label>Riparian Habitat:</label>
      <select id="turtlePopHabitatType-${index}" onchange="handleOtherSelect(this,'turtlePopHabitatOtherRow-${index}')">
        ${_turtleHabitatOptions(obs.habitat)}
      </select>
    </div>
    <div class="form-row" id="turtlePopHabitatOtherRow-${index}" style="${(habOther || obs.habitat === 'Other') ? '' : 'display:none;'}">
      <label></label>
      <input type="text" id="turtlePopHabitatOther-${index}" value="${habOther}" placeholder="Specify habitat…" style="flex:1;" />
    </div>
    <div class="form-row">
      <label>Photo ID:</label>
      <input type="text" id="turtlePopPhoto-${index}" value="${obs.photoID || ''}" placeholder="Photo filename or ID" style="flex:1;" />
      <button type="button" onclick="capturePopupPhoto(${obs.latlng?.lat ?? null}, ${obs.latlng?.lng ?? null}, 'turtlePopPhoto-${index}')" title="Take Photo"><i class="fas fa-camera"></i></button>
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

// ─── Popup Save / Delete ──────────────────────────────────────────────────
function updateTurtleObservation(index) {
  const rec = turtleObservations[index];
  if (!rec) return;

  rec.species  = document.getElementById(`turtlePopSpecies-${index}`)?.value      || '';
  rec.sex      = document.getElementById(`turtlePopSex-${index}`)?.value          || '';
  rec.ageClass = document.getElementById(`turtlePopAge-${index}`)?.value          || '';
  rec.activity = _otherVal(`turtlePopActivity-${index}`,    `turtlePopActivityOther-${index}`)   || '';
  rec.habitat  = _otherVal(`turtlePopHabitatType-${index}`, `turtlePopHabitatOther-${index}`)    || '';
  rec.photoID  = document.getElementById(`turtlePopPhoto-${index}`)?.value || '';
  rec.note     = document.getElementById(`turtlePopNote-${index}`)?.value  || '';

  const sexAbbr   = rec.sex === 'Male' ? 'M' : rec.sex === 'Female' ? 'F' : 'U';
  const spAbbr    = rec.species ? rec.species.split(' ').map(w => w[0]).join('') : '?';
  const labelText = `${spAbbr} ${sexAbbr}${rec.activity ? ' · ' + rec.activity : ''}`;

  rec.label.setIcon(L.divIcon({
    className: 'marker-label',
    html: labelText,
    iconAnchor: [0, 10]
  }));

  syncTurtleToIndexedDB();
  updateTable();
  rec.marker.closePopup();
}

let _pendingDeleteTurtle = null;

function deleteTurtleMarker(index) {
  const obs = turtleObservations[index];
  if (!obs) return;

  if (_pendingDeleteTurtle) {
    clearTimeout(_pendingDeleteTurtle.timeoutId);
    _pendingDeleteTurtle.dismissToast?.();
    syncTurtleToIndexedDB();
    _pendingDeleteTurtle = null;
  }
  if (obs.marker) map.removeLayer(obs.marker);
  if (obs.label)  map.removeLayer(obs.label);
  turtleObservations.splice(index, 1);
  updateTable();

  const timeoutId = setTimeout(() => {
    if (_pendingDeleteTurtle?.timeoutId === timeoutId) {
      _pendingDeleteTurtle.dismissToast?.();
      syncTurtleToIndexedDB();
      _pendingDeleteTurtle = null;
    }
  }, 5000);

  const dismissToast = showUndoToast('Observation deleted.', () => {
    if (_pendingDeleteTurtle?.timeoutId !== timeoutId) return;
    clearTimeout(timeoutId);
    turtleObservations.splice(index, 0, obs);
    if (obs.marker) map.addLayer(obs.marker);
    if (obs.label)  map.addLayer(obs.label);
    _pendingDeleteTurtle = null;
    updateTable();
  });

  _pendingDeleteTurtle = { timeoutId, dismissToast };
}

window.updateTurtleObservation = updateTurtleObservation;
window.deleteTurtleMarker      = deleteTurtleMarker;
window.saveTurtleObservation   = saveTurtleObservation;
window.closeTurtleModal        = closeTurtleModal;
window.captureTurtlePhoto      = () => capturePhoto(turtleCurrentLatLng, 'turtlePhotoIDInput');

// ─── Option Generators ────────────────────────────────────────────────────
function _sel(val, cur) { return val === cur ? 'selected' : ''; }

// Nova Scotia freshwater turtle species with provincial S-ranks
const _NS_TURTLE_SPECIES = [
  { name: 'Wood Turtle',              sci: 'Glyptemys insculpta',  srank: 'S2' },
  { name: "Blanding's Turtle",        sci: 'Emydoidea blandingii', srank: 'S2' },
  { name: 'Snapping Turtle',          sci: 'Chelydra serpentina',  srank: 'S4' },
  { name: 'Eastern Painted Turtle',   sci: 'Chrysemys picta picta',srank: 'S5' },
];

function _turtleSpeciesOptions(cur = '') {
  return `<option value="">-- Select Species --</option>` +
    _NS_TURTLE_SPECIES.map(s => {
      const val = s.name;
      return `<option value="${val}" ${_sel(val, cur)}>${s.name} (${s.sci}) — ${s.srank}</option>`;
    }).join('');
}

const _TURTLE_ACTIVITIES = ['Basking', 'Swimming', 'Foraging', 'Travelling', 'Nesting', 'Refuge/Shelter', 'Unknown'];
const _TURTLE_HABITATS   = ['Marsh', 'Riparian Forest', 'Upland Forest', 'Rocky Shore', 'Sandy Bank', 'Agricultural Field', 'Road/Path', 'Open Water', 'Gravel Bar', 'Shrub/Scrub'];

function _selWithOther(known, cur) {
  return (cur && !known.includes(cur)) ? 'Other' : cur;
}
function _customText(known, stored) {
  if (!stored || stored === 'Other' || known.includes(stored)) return '';
  return stored;
}

function _turtleActivityOptions(cur = '') {
  const sel = _selWithOther(_TURTLE_ACTIVITIES, cur);
  return `<option value="">-- Select --</option>` +
    [..._TURTLE_ACTIVITIES, 'Other'].map(s => `<option value="${s}" ${_sel(s, sel)}>${s}</option>`).join('');
}

function _turtleHabitatOptions(cur = '') {
  const sel = _selWithOther(_TURTLE_HABITATS, cur);
  return `<option value="">-- Select --</option>` +
    [..._TURTLE_HABITATS, 'Other'].map(s => `<option value="${s}" ${_sel(s, sel)}>${s}</option>`).join('');
}

function _otherVal(selectId, otherId) {
  const sel = document.getElementById(selectId);
  if (!sel) return '';
  return sel.value === 'Other' ? (document.getElementById(otherId)?.value.trim() || '') : sel.value;
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

      <label>Species:</label>
      <select id="turtleSpeciesInput">
        ${_turtleSpeciesOptions()}
      </select>

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

      <label>Activity:</label>
      <select id="turtleActivityInput" onchange="handleOtherSelect(this,'turtleActivityOtherWrap')">
        ${_turtleActivityOptions()}
      </select>
      <div id="turtleActivityOtherWrap" style="display:none; margin-top:4px;">
        <input type="text" id="turtleActivityOther" placeholder="Specify activity…" style="width:100%;" />
      </div>

      <label>Riparian Habitat Type:</label>
      <select id="turtleHabitatInput" onchange="handleOtherSelect(this,'turtleHabitatOtherWrap')">
        ${_turtleHabitatOptions()}
      </select>
      <div id="turtleHabitatOtherWrap" style="display:none; margin-top:4px;">
        <input type="text" id="turtleHabitatOther" placeholder="Specify habitat…" style="width:100%;" />
      </div>

      <label>Photo ID (filename / reference):</label>
      <div style="display:flex; gap:6px; align-items:center;">
        <input type="text" id="turtlePhotoIDInput" placeholder="e.g. IMG_0042" style="flex:1;" />
        <button type="button" onclick="captureTurtlePhoto()" title="Take Photo"><i class="fas fa-camera"></i></button>
      </div>

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
