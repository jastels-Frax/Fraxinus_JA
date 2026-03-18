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
  modal.querySelector('#mooseSpeciesInput').value = '';
  modal.querySelector('#mooseObsTypeInput').value = '';
  modal.querySelector('#mooseHabitatInput').value = '';
  modal.querySelector('#moosePhotoRefInput').value = '';
  modal.querySelector('#mooseNoteInput').value = '';

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
  const species  = document.getElementById('mooseSpeciesInput')?.value.trim();
  const obsType  = document.getElementById('mooseObsTypeInput')?.value.trim();
  const habitat  = document.getElementById('mooseHabitatInput')?.value.trim();
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
  const div = document.createElement('div');
  div.className = 'popup-content compact';
  div.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">
      ${obs.species || ''} — ${obs.obsType || ''}
    </div>
    <div class="form-row">
      <label>Species:</label>
      <select id="moosePopSpecies-${index}">
        ${_mooseSpeciesOptions(obs.species)}
      </select>
    </div>
    <div class="form-row">
      <label>Obs. Type:</label>
      <select id="moosePopObsType-${index}">
        ${_mooseObsTypeOptions(obs.obsType)}
      </select>
    </div>
    <div class="form-row">
      <label>Habitat:</label>
      <select id="moosePopHabitat-${index}">
        ${_mooseHabitatOptions(obs.habitat)}
      </select>
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
  rec.species  = document.getElementById(`moosePopSpecies-${index}`)?.value  || rec.species;
  rec.obsType  = document.getElementById(`moosePopObsType-${index}`)?.value  || rec.obsType;
  rec.habitat  = document.getElementById(`moosePopHabitat-${index}`)?.value  || rec.habitat;
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

function _mooseSpeciesOptions(cur = '') {
  const list = [
    'Moose', 'White-tailed Deer', 'Black Bear', 'Coyote', 'Eastern Wolf',
    'Red Fox', 'Canada Lynx', 'Bobcat', 'River Otter', 'Beaver',
    'Snowshoe Hare', 'Porcupine', 'Mink', 'American Marten', 'Fisher',
    'Short-tailed Weasel', 'Long-tailed Weasel', 'Raccoon', 'Striped Skunk',
    'Red Squirrel', 'Muskrat', 'Unknown'
  ];
  return `<option value="">-- Select --</option>` +
    list.map(s => `<option value="${s}" ${_sel(s, cur)}>${s}</option>`).join('');
}

function _mooseObsTypeOptions(cur = '') {
  const list = [
    'Browse', 'Tracks', 'Scat', 'Rub', 'Wallow', 'Bed',
    'Direct Visual', 'Antler Shed', 'Carcass/Remains',
    'Trail Camera', 'Pellet Group', 'Unknown'
  ];
  return `<option value="">-- Select --</option>` +
    list.map(s => `<option value="${s}" ${_sel(s, cur)}>${s}</option>`).join('');
}

function _mooseHabitatOptions(cur = '') {
  const list = [
    'Open Wetland', 'Riparian Shrub', 'Upland Forest',
    'Cutover/Regeneration', 'Lakeshore', 'Roadside',
    'Coniferous Forest', 'Deciduous Forest', 'Mixed Forest',
    'Bog/Fen', 'Agricultural Field', 'Other'
  ];
  return `<option value="">-- Select --</option>` +
    list.map(s => `<option value="${s}" ${_sel(s, cur)}>${s}</option>`).join('');
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
      <select id="mooseSpeciesInput">
        ${_mooseSpeciesOptions()}
      </select>
      <label>Observation Type:</label>
      <select id="mooseObsTypeInput">
        ${_mooseObsTypeOptions()}
      </select>
      <label>Habitat:</label>
      <select id="mooseHabitatInput">
        ${_mooseHabitatOptions()}
      </select>
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
