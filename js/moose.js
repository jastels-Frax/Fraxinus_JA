// js/moose.js — Mainland Moose Survey module

import { mooseObservations } from './storageData.js';
import { syncMooseToIndexedDB } from './storage.js';
import { updateTable } from './ui.js';
import { map } from './map.js';
import * as G from './surveyGlobals.js';
import { capturePhoto } from './photo.js';

// ─── Modal State ──────────────────────────────────────────────────────────
let moosePlacingPoint = false;
let mooseCurrentLatLng = null;

export function isMoosePlacingPoint() { return moosePlacingPoint; }

// ─── Show / Close Modal ───────────────────────────────────────────────────
export function showMooseModal(latlng) {
  if (!G.mooseObserver || !G.mooseTransectID) {
    alert('Please complete survey metadata before placing observations.');
    return;
  }
  moosePlacingPoint = true;
  mooseCurrentLatLng = latlng;

  const modal = document.getElementById('mooseModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (!modal || !backdrop) return;

  // Reset fields
  modal.querySelector('#mooseSpeciesInput').value   = '';
  modal.querySelector('#mooseObsTypeInput').value   = '';
  modal.querySelector('#mooseHabitatInput').value   = '';
  modal.querySelector('#moosePhotoRefInput').value  = '';
  modal.querySelector('#mooseNoteInput').value      = '';
  ['mooseSpeciesOtherWrap','mooseObsTypeOtherWrap','mooseHabitatOtherWrap'].forEach(id => {
    const wrap = modal.querySelector(`#${id}`);
    if (wrap) { wrap.style.display = 'none'; wrap.querySelector('input').value = ''; }
  });

  modal.style.display = 'block';
  backdrop.style.display = 'block';
}

export function closeMooseModal() {
  moosePlacingPoint = false;
  mooseCurrentLatLng = null;
  document.getElementById('mooseModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
}

// ─── Save Observation ─────────────────────────────────────────────────────
export function saveMooseObservation() {
  const species  = _otherVal('mooseSpeciesInput',  'mooseSpeciesOther');
  const obsType  = _otherVal('mooseObsTypeInput',  'mooseObsTypeOther');
  const habitat  = _otherVal('mooseHabitatInput',  'mooseHabitatOther');
  const photoRef = document.getElementById('moosePhotoRefInput')?.value.trim();
  const note     = document.getElementById('mooseNoteInput')?.value.trim();

  if (!species || !obsType) {
    alert('Please select a species and observation type.');
    return;
  }
  if (!mooseCurrentLatLng) {
    alert('No location captured. Use the Record Observation button to geotag your current position.');
    return;
  }

  const latlng    = mooseCurrentLatLng;
  const timestamp = new Date().toLocaleString();
  const index     = mooseObservations.length;

  // Marker (orange)
  const marker = L.circleMarker(latlng, {
    radius: 15,
    color: 'orange',
    fillColor: 'white',
    fillOpacity: 0.6,
    weight: 2
  }).addTo(map);

  const labelText = `${species}, ${obsType}`;
  const label = L.marker([latlng.lat, latlng.lng + 0.0001], {
    icon: L.divIcon({
      className: 'marker-label',
      html: labelText,
      iconAnchor: [0, 20]
    })
  }).addTo(map);

  // Read current metadata from live-bound globals
  const pid = G.mooseProjectID,   tid = G.mooseTransectID, obs = G.mooseObserver;
  const sd  = G.mooseSurveyDate,  st  = G.mooseStartTime,  et  = G.mooseEndTime;
  const vis = G.mooseVisibility,  sc  = G.mooseSnowCover,   tc  = G.mooseTempC;
  const ws  = G.mooseWindSpeed;

  const obsRecord = {
    projectID:  pid,
    transectID: tid,
    observer:   obs,
    surveyDate: sd,
    startTime:  st,
    endTime:    et,
    visibility: vis,
    snowCover:  sc,
    tempC:      tc,
    windSpeed:  ws,
    species,
    obsType,
    habitat,
    photoRef,
    note,
    latlng,
    marker,
    label,
    timestamp
  };

  const popup = createMoosePopupHTML(index, obsRecord);
  marker.bindPopup(popup);

  mooseObservations.push(obsRecord);
  syncMooseToIndexedDB();
  updateTable();
  closeMooseModal();
}

// No snapshot needed — G.* are live ES-module bindings that always reflect current state.

// ─── Popup HTML ───────────────────────────────────────────────────────────
export function createMoosePopupHTML(index, obs) {
  const spcOther  = _customText(_SPECIES_LIST,  obs.species);
  const otOther   = _customText(_OBS_TYPE_LIST, obs.obsType);
  const habOther  = _customText(_HABITAT_LIST,  obs.habitat);
  const div = document.createElement('div');
  div.className = 'popup-content compact';
  div.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">
      ${obs.species || ''} — ${obs.obsType || ''}
    </div>
    <div class="form-row">
      <label>Species:</label>
      <select id="moosePopSpecies-${index}" onchange="handleOtherSelect(this,'moosePopSpeciesOtherRow-${index}')">
        ${_mooseSpeciesOptions(obs.species)}
      </select>
    </div>
    <div class="form-row" id="moosePopSpeciesOtherRow-${index}" style="${(spcOther || obs.species === 'Other') ? '' : 'display:none;'}">
      <label></label>
      <input type="text" id="moosePopSpeciesOther-${index}" value="${spcOther}" placeholder="Specify species…" style="flex:1;" />
    </div>
    <div class="form-row">
      <label>Obs. Type:</label>
      <select id="moosePopObsType-${index}" onchange="handleOtherSelect(this,'moosePopObsTypeOtherRow-${index}')">
        ${_mooseObsTypeOptions(obs.obsType)}
      </select>
    </div>
    <div class="form-row" id="moosePopObsTypeOtherRow-${index}" style="${(otOther || obs.obsType === 'Other') ? '' : 'display:none;'}">
      <label></label>
      <input type="text" id="moosePopObsTypeOther-${index}" value="${otOther}" placeholder="Specify observation type…" style="flex:1;" />
    </div>
    <div class="form-row">
      <label>Habitat:</label>
      <select id="moosePopHabitat-${index}" onchange="handleOtherSelect(this,'moosePopHabitatOtherRow-${index}')">
        ${_mooseHabitatOptions(obs.habitat)}
      </select>
    </div>
    <div class="form-row" id="moosePopHabitatOtherRow-${index}" style="${(habOther || obs.habitat === 'Other') ? '' : 'display:none;'}">
      <label></label>
      <input type="text" id="moosePopHabitatOther-${index}" value="${habOther}" placeholder="Specify habitat…" style="flex:1;" />
    </div>
    <div class="form-row">
      <label>Photo Ref:</label>
      <input type="text" id="moosePopPhoto-${index}" value="${obs.photoRef || ''}" placeholder="Photo filename or ID" style="flex:1;" />
      <button type="button" onclick="capturePopupPhoto(${obs.latlng?.lat ?? null}, ${obs.latlng?.lng ?? null}, 'moosePopPhoto-${index}')" title="Take Photo"><i class="fas fa-camera"></i></button>
    </div>
    <div class="form-row">
      <label>Notes:</label>
      <textarea id="moosePopNote-${index}" rows="2">${obs.note || ''}</textarea>
    </div>
    <div class="form-row" style="justify-content:space-between;">
      <button onclick="updateMooseObservation(${index})">Save</button>
      <button class="danger" onclick="deleteMooseMarker(${index})">Delete</button>
    </div>
  `;
  return div;
}

// ─── Popup Save / Delete ──────────────────────────────────────────────────
function updateMooseObservation(index) {
  const rec = mooseObservations[index];
  if (!rec) return;
  rec.species  = _otherVal(`moosePopSpecies-${index}`,  `moosePopSpeciesOther-${index}`)  || rec.species;
  rec.obsType  = _otherVal(`moosePopObsType-${index}`,  `moosePopObsTypeOther-${index}`)  || rec.obsType;
  rec.habitat  = _otherVal(`moosePopHabitat-${index}`,  `moosePopHabitatOther-${index}`)  || rec.habitat;
  rec.photoRef = document.getElementById(`moosePopPhoto-${index}`)?.value    || '';
  rec.note     = document.getElementById(`moosePopNote-${index}`)?.value     || '';

  rec.label.setIcon(L.divIcon({
    className: 'marker-label',
    html: `${rec.species}, ${rec.obsType}`,
    iconAnchor: [0, 10]
  }));
  syncMooseToIndexedDB();
  updateTable();
  rec.marker.closePopup();
}

function deleteMooseMarker(index) {
  const obs = mooseObservations[index];
  if (!obs) return;
  if (obs.marker) map.removeLayer(obs.marker);
  if (obs.label)  map.removeLayer(obs.label);
  mooseObservations.splice(index, 1);
  syncMooseToIndexedDB();
  updateTable();
}

window.updateMooseObservation = updateMooseObservation;
window.deleteMooseMarker      = deleteMooseMarker;
window.saveMooseObservation   = saveMooseObservation;
window.closeMooseModal        = closeMooseModal;
window.captureMoosePhoto      = () => capturePhoto(mooseCurrentLatLng, 'moosePhotoRefInput');

// ─── Option Generators ────────────────────────────────────────────────────
function _sel(val, cur) { return val === cur ? 'selected' : ''; }

// Known values for each field (without 'Other' — that's appended automatically)
const _SPECIES_LIST  = [
  'Moose', 'White-tailed Deer', 'Black Bear', 'Coyote',
  'Red Fox', 'Canada Lynx', 'Bobcat',
  'River Otter', 'Beaver', 'Mink', 'American Marten', 'Fisher',
  'Snowshoe Hare', 'Porcupine', 'Raccoon', 'Striped Skunk',
  'Unknown'
];
const _OBS_TYPE_LIST = [
  'Browse', 'Tracks', 'Scat', 'Rub', 'Wallow', 'Bed',
  'Direct Visual', 'Antler Shed', 'Carcass/Remains',
  'Trail Camera', 'Pellet Group', 'Unknown'
];
const _HABITAT_LIST  = [
  'Open Wetland', 'Riparian Shrub', 'Upland Forest',
  'Cutover/Regeneration', 'Lakeshore', 'Roadside',
  'Coniferous Forest', 'Deciduous Forest', 'Mixed Forest',
  'Bog/Fen', 'Agricultural Field'
];

// If stored value is not in the known list, pre-select "Other" in the dropdown.
function _selWithOther(known, cur) {
  return (cur && !known.includes(cur)) ? 'Other' : cur;
}
// Return the custom text if the stored value was free-form (not a known item or 'Other').
function _customText(known, stored) {
  if (!stored || stored === 'Other' || known.includes(stored)) return '';
  return stored;
}

function _mooseSpeciesOptions(cur = '') {
  const sel = _selWithOther(_SPECIES_LIST, cur);
  return `<option value="">-- Select --</option>` +
    [..._SPECIES_LIST, 'Other'].map(s => `<option value="${s}" ${_sel(s, sel)}>${s}</option>`).join('');
}

function _mooseObsTypeOptions(cur = '') {
  const sel = _selWithOther(_OBS_TYPE_LIST, cur);
  return `<option value="">-- Select --</option>` +
    [..._OBS_TYPE_LIST, 'Other'].map(s => `<option value="${s}" ${_sel(s, sel)}>${s}</option>`).join('');
}

function _mooseHabitatOptions(cur = '') {
  const sel = _selWithOther(_HABITAT_LIST, cur);
  return `<option value="">-- Select --</option>` +
    [..._HABITAT_LIST, 'Other'].map(s => `<option value="${s}" ${_sel(s, sel)}>${s}</option>`).join('');
}

// Read a select value, substituting the companion text input when "Other" is selected.
function _otherVal(selectId, otherId) {
  const sel = document.getElementById(selectId);
  if (!sel) return '';
  return sel.value === 'Other' ? (document.getElementById(otherId)?.value.trim() || '') : sel.value;
}

// ─── Inject modal HTML into DOM ───────────────────────────────────────────
export function injectMooseModal() {
  let el = document.getElementById('mooseModal');
  if (el) return;
  el = document.createElement('div');
  el.id = 'mooseModal';
  el.className = 'modal';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="modal-content">
      <h2>Wildlife Observation</h2>
      <label>Species:</label>
      <select id="mooseSpeciesInput" onchange="handleOtherSelect(this,'mooseSpeciesOtherWrap')">
        ${_mooseSpeciesOptions()}
      </select>
      <div id="mooseSpeciesOtherWrap" style="display:none; margin-top:4px;">
        <input type="text" id="mooseSpeciesOther" placeholder="Specify species…" style="width:100%;" />
      </div>
      <label>Observation Type:</label>
      <select id="mooseObsTypeInput" onchange="handleOtherSelect(this,'mooseObsTypeOtherWrap')">
        ${_mooseObsTypeOptions()}
      </select>
      <div id="mooseObsTypeOtherWrap" style="display:none; margin-top:4px;">
        <input type="text" id="mooseObsTypeOther" placeholder="Specify observation type…" style="width:100%;" />
      </div>
      <label>Habitat:</label>
      <select id="mooseHabitatInput" onchange="handleOtherSelect(this,'mooseHabitatOtherWrap')">
        ${_mooseHabitatOptions()}
      </select>
      <div id="mooseHabitatOtherWrap" style="display:none; margin-top:4px;">
        <input type="text" id="mooseHabitatOther" placeholder="Specify habitat…" style="width:100%;" />
      </div>
      <label>Photo Reference (filename / ID):</label>
      <div style="display:flex; gap:6px; align-items:center;">
        <input type="text" id="moosePhotoRefInput" placeholder="e.g. IMG_0042" style="flex:1;" />
        <button type="button" onclick="captureMoosePhoto()" title="Take Photo"><i class="fas fa-camera"></i></button>
      </div>
      <label>Notes:</label>
      <textarea id="mooseNoteInput" rows="3" placeholder="Optional notes..."></textarea>
      <div style="margin-top:10px; display:flex; gap:8px;">
        <button onclick="saveMooseObservation()">Save Observation</button>
        <button onclick="closeMooseModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
}
