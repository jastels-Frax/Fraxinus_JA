// js/turtle.js — Wood Turtle Survey module

import { turtleObservations } from './storageData.js';
import { syncTurtleToIndexedDB } from './storage.js';
import { updateTable } from './ui.js';
import { map } from './map.js';
import * as G from './surveyGlobals.js';
import { capturePhoto } from './photo.js';

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

  ['turtleObsTypeOtherWrap','turtleConditionOtherWrap','turtleActivityOtherWrap','turtleHabitatOtherWrap'].forEach(id => {
    const wrap = modal.querySelector(`#${id}`);
    if (wrap) { wrap.style.display = 'none'; wrap.querySelector('input').value = ''; }
  });

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
  const obsType       = _otherVal('turtleObsTypeInput',   'turtleObsTypeOther');
  const sex           = document.getElementById('turtleSexInput')?.value.trim()       || '';
  const ageClass      = document.getElementById('turtleAgeClassInput')?.value.trim()  || '';
  const carapace      = document.getElementById('turtleCarapaceInput')?.value.trim()  || '';
  const condition     = _otherVal('turtleConditionInput', 'turtleConditionOther');
  const basking       = document.getElementById('turtleBaskingInput')?.value.trim()   || '';
  const substrate     = document.getElementById('turtleSubstrateInput')?.value.trim() || '';
  const activity      = _otherVal('turtleActivityInput',  'turtleActivityOther');
  const habitat       = _otherVal('turtleHabitatInput',   'turtleHabitatOther');
  const photoID       = document.getElementById('turtlePhotoIDInput')?.value.trim()   || '';
  const note          = document.getElementById('turtleNoteInput')?.value.trim()       || '';

  if (!obsType) {
    alert('Please select an observation type.');
    return;
  }
  if (!turtleCurrentLatLng) {
    alert('No location captured. Use the Record Observation button to geotag your current position.');
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
  const isDirect   = obs.obsType === 'Direct Species Observation';
  const isHabitat  = obs.obsType === 'Habitat Observation';
  const otOther    = _customText(_TURTLE_OBS_TYPES,  obs.obsType);
  const condOther  = _customText(_TURTLE_CONDITIONS, obs.condition);
  const actOther   = _customText(_TURTLE_ACTIVITIES, obs.activity);
  const habOther   = _customText(_TURTLE_HABITATS,   obs.habitat);
  const div = document.createElement('div');
  div.className = 'popup-content compact';
  div.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">${obs.obsType || 'Turtle Observation'}</div>
    <div class="form-row">
      <label>Obs. Type:</label>
      <select id="turtlePopObsType-${index}" onchange="refreshTurtlePopup(${index})">
        ${_turtleObsTypeOptions(obs.obsType)}
      </select>
    </div>
    <div class="form-row" id="turtlePopObsTypeOtherRow-${index}" style="${(otOther || obs.obsType === 'Other') ? '' : 'display:none;'}">
      <label></label>
      <input type="text" id="turtlePopObsTypeOther-${index}" value="${otOther}" placeholder="Specify observation type…" style="flex:1;" />
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
        <select id="turtlePopCondition-${index}" onchange="handleOtherSelect(this,'turtlePopConditionOtherRow-${index}')">
          ${_turtleConditionOptions(obs.condition)}
        </select>
      </div>
      <div class="form-row" id="turtlePopConditionOtherRow-${index}" style="${(condOther || obs.condition === 'Other') ? '' : 'display:none;'}">
        <label></label>
        <input type="text" id="turtlePopConditionOther-${index}" value="${condOther}" placeholder="Specify condition…" style="flex:1;" />
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
        <select id="turtlePopActivity-${index}" onchange="handleOtherSelect(this,'turtlePopActivityOtherRow-${index}')">
          ${_turtleActivityOptions(obs.activity)}
        </select>
      </div>
      <div class="form-row" id="turtlePopActivityOtherRow-${index}" style="${(actOther || obs.activity === 'Other') ? '' : 'display:none;'}">
        <label></label>
        <input type="text" id="turtlePopActivityOther-${index}" value="${actOther}" placeholder="Specify activity…" style="flex:1;" />
      </div>
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

// ─── Popup refresh on type change ─────────────────────────────────────────
function refreshTurtlePopup(index) {
  const type      = document.getElementById(`turtlePopObsType-${index}`)?.value;
  const isDirect  = type === 'Direct Species Observation';
  const isHabitat = type === 'Habitat Observation';
  document.getElementById(`turtlePopDirect-${index}`).style.display       = isDirect  ? 'block' : 'none';
  document.getElementById(`turtlePopHabitat-${index}`).style.display      = isHabitat ? 'block' : 'none';
  const otherRow = document.getElementById(`turtlePopObsTypeOtherRow-${index}`);
  if (otherRow) otherRow.style.display = type === 'Other' ? '' : 'none';
}

// ─── Popup Save / Delete ──────────────────────────────────────────────────
function updateTurtleObservation(index) {
  const rec = turtleObservations[index];
  if (!rec) return;

  rec.obsType        = _otherVal(`turtlePopObsType-${index}`,     `turtlePopObsTypeOther-${index}`)   || rec.obsType;
  rec.sex            = document.getElementById(`turtlePopSex-${index}`)?.value                         || '';
  rec.ageClass       = document.getElementById(`turtlePopAge-${index}`)?.value                         || '';
  rec.carapaceLength = document.getElementById(`turtlePopCarapace-${index}`)?.value                    || '';
  rec.condition      = _otherVal(`turtlePopCondition-${index}`,  `turtlePopConditionOther-${index}`)   || '';
  rec.basking        = document.getElementById(`turtlePopBasking-${index}`)?.value                     || '';
  rec.substrate      = document.getElementById(`turtlePopSubstrate-${index}`)?.value                   || '';
  rec.activity       = _otherVal(`turtlePopActivity-${index}`,   `turtlePopActivityOther-${index}`)    || '';
  rec.habitat        = _otherVal(`turtlePopHabitatType-${index}`, `turtlePopHabitatOther-${index}`)    || '';
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
window.captureTurtlePhoto      = () => capturePhoto(turtleCurrentLatLng, 'turtlePhotoIDInput');

// ─── Option Generators ────────────────────────────────────────────────────
function _sel(val, cur) { return val === cur ? 'selected' : ''; }

const _TURTLE_OBS_TYPES  = ['Direct Species Observation', 'Habitat Observation'];
const _TURTLE_CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Injured', 'Dead'];
const _TURTLE_ACTIVITIES = ['Basking', 'Foraging', 'Overwintering', 'Nesting', 'Travelling', 'Refuge/Shelter', 'Unknown'];
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

function _turtleObsTypeOptions(cur = '') {
  const sel = _selWithOther(_TURTLE_OBS_TYPES, cur);
  return [..._TURTLE_OBS_TYPES, 'Other'].map(s => `<option value="${s}" ${_sel(s, sel)}>${s}</option>`).join('');
}

function _turtleConditionOptions(cur = '') {
  const sel = _selWithOther(_TURTLE_CONDITIONS, cur);
  return `<option value="">-- Select --</option>` +
    [..._TURTLE_CONDITIONS, 'Other'].map(s => `<option value="${s}" ${_sel(s, sel)}>${s}</option>`).join('');
}

// Read a select value, substituting the companion text input when "Other" is selected.
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

      <label>Observation Type:</label>
      <select id="turtleObsTypeInput" onchange="turtleModalTypeChange()">
        ${_turtleObsTypeOptions()}
      </select>
      <div id="turtleObsTypeOtherWrap" style="display:none; margin-top:4px;">
        <input type="text" id="turtleObsTypeOther" placeholder="Specify observation type…" style="width:100%;" />
      </div>

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
        <select id="turtleConditionInput" onchange="handleOtherSelect(this,'turtleConditionOtherWrap')">
          ${_turtleConditionOptions()}
        </select>
        <div id="turtleConditionOtherWrap" style="display:none; margin-top:4px;">
          <input type="text" id="turtleConditionOther" placeholder="Specify condition…" style="width:100%;" />
        </div>

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
        <select id="turtleActivityInput" onchange="handleOtherSelect(this,'turtleActivityOtherWrap')">
          ${_turtleActivityOptions()}
        </select>
        <div id="turtleActivityOtherWrap" style="display:none; margin-top:4px;">
          <input type="text" id="turtleActivityOther" placeholder="Specify activity…" style="width:100%;" />
        </div>
        <p style="color:#aaa; font-size:0.85em; margin:4px 0;">
          📷 Prompt: Capture a photo if possible and record the ID below.
        </p>
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

// Modal type-change handler (global for inline onchange)
window.turtleModalTypeChange = function () {
  const modal = document.getElementById('turtleModal');
  if (modal) _refreshTurtleModalVisibility(modal);
  const sel  = document.getElementById('turtleObsTypeInput');
  const wrap = document.getElementById('turtleObsTypeOtherWrap');
  if (sel && wrap) wrap.style.display = sel.value === 'Other' ? '' : 'none';
};
