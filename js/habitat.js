// js/habitat.js — Habitat / General Feature observation module
// Applies to all three survey types (BBS, MOOSE, TURTLE).
// Inspired by the Wood Turtle Habitat Collector prototype — habitat-criteria
// checklist toggled contextually per feature type.

import { habitatObservations } from './storageData.js';
import { syncHabitatToIndexedDB } from './storage.js';
import { updateTable } from './ui.js';
import { map, lockMap, unlockMap } from './map.js';
import * as G from './surveyGlobals.js';
import { capturePhoto } from './photo.js';

let habitatPlacingPoint  = false;
let habitatCurrentLatLng = null;

export function isHabitatPlacingPoint() { return habitatPlacingPoint; }

// ─── Per-survey feature type lists ────────────────────────────────────────
const FEATURE_TYPES = {
  BBS: [
    'Nesting Cavity/Box', 'Snag', 'Wetland', 'Hedgerow/Edge',
    'Riparian Buffer', 'Grassland', 'Woodland', 'Pond/Water Body'
  ],
  MOOSE: [
    'Wallow', 'Mineral Lick', 'Water Crossing', 'Bedding Area',
    'Browse Corridor', 'Riparian Zone', 'Salt Lick'
  ],
  TURTLE: [
    'Basking Site', 'Nesting Area', 'Overwintering Site',
    'Foraging Area', 'Riparian Corridor', 'Water Feature'
  ]
};

// ─── Habitat criteria per feature type (checklist, from Wood Turtle app) ──
// Each feature type reveals survey-specific quality criteria as toggle switches.
const HABITAT_CRITERIA = {
  // — BBS —
  'Nesting Cavity/Box': [
    'Active use signs present',
    'Large-diameter tree or structure',
    'No direct human disturbance'
  ],
  'Snag': [
    'Fresh excavation sign visible',
    'Multiple cavities present',
    'Standing in open or edge position'
  ],
  'Wetland': [
    'Emergent vegetation present',
    'Open water visible',
    'Upland buffer intact'
  ],
  'Hedgerow/Edge': [
    'Berry or fruit-producing species present',
    'Adequate height for nesting cover',
    'Connects to forest or woodlot'
  ],
  'Riparian Buffer': [
    'Canopy continuous along watercourse',
    'Invasive species absent',
    'Understory intact'
  ],
  'Grassland': [
    'Native grass or forb dominant',
    'Evidence of ground-nesting activity',
    'Low shrub encroachment'
  ],
  'Woodland': [
    'Canopy cover adequate',
    'Coarse woody debris present',
    'Multiple tree age classes'
  ],
  'Pond/Water Body': [
    'Vegetated shoreline margins',
    'Aquatic vegetation present',
    'Evidence of waterfowl or amphibian use'
  ],
  // — MOOSE —
  'Wallow': [
    'Mud still moist',
    'Hair present',
    'Rubs on nearby trees'
  ],
  'Mineral Lick': [
    'Soil or clay excavation visible',
    'Tracks converging on site',
    'Evidence of repeated use'
  ],
  'Water Crossing': [
    'Worn entry/exit trail visible',
    'Tracks in substrate',
    'Shallow and accessible'
  ],
  'Bedding Area': [
    'Depressions or flattened vegetation',
    'Pellets present',
    'Sheltered from wind'
  ],
  'Browse Corridor': [
    'Preferred species present (fir, birch, willow)',
    'Stem clipping evident',
    'Multiple use trails visible'
  ],
  'Riparian Zone': [
    'Willow or alder present',
    'Seasonally flooded evidence',
    'Soft bank substrate'
  ],
  'Salt Lick': [
    'Soil excavation visible',
    'Tracks converging',
    'Evidence of repeated use'
  ],
  // — TURTLE —
  'Basking Site': [
    'Logs or rocks at water surface',
    'South-facing or open aspect',
    'Unobstructed water access'
  ],
  'Nesting Area': [
    'Sandy or gravelly substrate',
    'Open canopy',
    'Within visible distance of water'
  ],
  'Overwintering Site': [
    'Flowing water present',
    'Sufficient depth',
    'Undercut banks, roots, or log cover'
  ],
  'Foraging Area': [
    'Floodplain or wetland adjacent',
    'Alder or shrubby edge present',
    'Open movement corridors'
  ],
  'Riparian Corridor': [
    'Contiguous riparian vegetation',
    'Low road or barrier fragmentation',
    'Connects two or more water bodies'
  ],
  'Water Feature': [
    'Vegetated margins',
    'Evidence of turtle use',
    'Low disturbance level'
  ]
};

// Marker colours per survey — dashed outline to distinguish from species marks
const MARKER_COLOUR = { BBS: '#7c3aed', MOOSE: '#b45309', TURTLE: '#0d9488' };

// ─── Show / Close Modal ───────────────────────────────────────────────────
export function showHabitatModal(latlng) {
  habitatPlacingPoint  = true;
  habitatCurrentLatLng = latlng;

  const modal    = document.getElementById('habitatModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (!modal || !backdrop) return;

  modal.querySelector('#habitatFeatureTypeInput').value = '';
  modal.querySelector('#habitatCriteriaList').innerHTML  = '';
  const otherWrap = modal.querySelector('#habitatFeatureTypeOtherWrap');
  if (otherWrap) { otherWrap.style.display = 'none'; otherWrap.querySelector('input').value = ''; }
  modal.querySelector('#habitatPhotoInput').value     = '';
  modal.querySelector('#habitatNoteInput').value      = '';

  modal.style.display    = 'block';
  backdrop.style.display = 'block';
  lockMap();
}

export function closeHabitatModal() {
  habitatPlacingPoint  = false;
  habitatCurrentLatLng = null;
  document.getElementById('habitatModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
  unlockMap();
}

// ─── Feature type change — show criteria toggles ──────────────────────────
window.habitatFeatureTypeChange = function () {
  const sel  = document.getElementById('habitatFeatureTypeInput');
  const wrap = document.getElementById('habitatFeatureTypeOtherWrap');
  if (wrap) wrap.style.display = sel.value === 'Other' ? '' : 'none';

  const listDiv  = document.getElementById('habitatCriteriaList');
  const criteria = HABITAT_CRITERIA[sel.value] || [];
  listDiv.innerHTML = '';

  if (criteria.length) {
    criteria.forEach(item => {
      const id  = 'hc_' + item.replace(/[^a-z0-9]/gi, '_');
      const lbl = document.createElement('label');
      lbl.className = 'habitat-criteria-toggle';
      lbl.innerHTML = `
        <input type="checkbox" id="${id}" value="${item}" />
        <span class="toggle-track"></span>
        <span class="toggle-label">${item}</span>
      `;
      listDiv.appendChild(lbl);
    });
  }
};

// ─── Save Observation ─────────────────────────────────────────────────────
function _getActiveMeta() {
  const t = G.activeSurvey;
  if (t === 'BBS') return {
    projectID:        G.projectID,
    pointID:          G.pointID,
    observer:         G.observer,
    surveyType_label: G.surveyType,
    surveyLength:     G.surveyLength,
    wind:             G.wind,
    windDir:          G.windDir,
    tempC:            G.tempC,
    precip:           G.precip,
    siteHabitat:      G.siteHabitat,
    surveyLat:        G.surveyLat,
    surveyLng:        G.surveyLng
  };
  if (t === 'MOOSE') return {
    projectID:  G.mooseProjectID,
    transectID: G.mooseTransectID,
    observer:   G.mooseObserver,
    surveyDate: G.mooseSurveyDate,
    startTime:  G.mooseStartTime,
    endTime:    G.mooseEndTime,
    visibility: G.mooseVisibility,
    snowCover:  G.mooseSnowCover,
    tempC:      G.mooseTempC,
    windSpeed:  G.mooseWindSpeed
  };
  if (t === 'TURTLE') return {
    projectID:  G.turtleProjectID,
    siteName:   G.turtleSiteName,
    observer:   G.turtleObserver,
    surveyDate: G.turtleSurveyDate,
    startTime:  G.turtleStartTime,
    endTime:    G.turtleEndTime,
    waterTemp:  G.turtleWaterTemp,
    airTemp:    G.turtleAirTemp,
    waterLevel: G.turtleWaterLevel,
    weather:    G.turtleWeather
  };
  return {};
}

export function saveHabitatObservation() {
  const sel         = document.getElementById('habitatFeatureTypeInput');
  const featureType = sel?.value === 'Other'
    ? (document.getElementById('habitatFeatureTypeOther')?.value.trim() || '')
    : (sel?.value || '');

  const criteria  = Array.from(
    document.querySelectorAll('#habitatCriteriaList input:checked')
  ).map(cb => cb.value);
  const photoRef  = document.getElementById('habitatPhotoInput')?.value.trim()     || '';
  const note      = document.getElementById('habitatNoteInput')?.value.trim()      || '';

  if (!featureType) {
    alert('Please select a feature type.');
    return;
  }
  if (!habitatCurrentLatLng) {
    alert('No location captured.');
    return;
  }

  const survey = G.activeSurvey;

  // Normalise to plain {lat, lng} regardless of whether source was Leaflet LatLng,
  // GeolocationCoordinates {latitude, longitude}, or an array [lat, lng].
  const rawLL  = habitatCurrentLatLng;
  const latlng = {
    lat: rawLL.lat ?? rawLL.latitude  ?? rawLL[0],
    lng: rawLL.lng ?? rawLL.longitude ?? rawLL[1]
  };
  if (!isFinite(latlng.lat) || !isFinite(latlng.lng)) {
    alert('Invalid GPS coordinates — please try again.');
    return;
  }
  const timestamp = new Date().toLocaleString();
  const index     = habitatObservations.length;
  const colour    = MARKER_COLOUR[survey] || '#7c3aed';

  const marker = L.circleMarker(latlng, {
    radius: 12, color: colour,
    fillColor: 'white', fillOpacity: 0.75,
    weight: 2, dashArray: '6 3'
  }).addTo(map);

  const label = L.marker([latlng.lat, latlng.lng + 0.0001], {
    icon: L.divIcon({
      className: 'marker-label',
      html: `🌿 ${featureType}`,
      iconAnchor: [0, 10]
    })
  }).addTo(map);

  const obsRecord = {
    surveyType: G.activeSurvey,
    ..._getActiveMeta(),
    featureType, criteria,
    condition: '',
    size: '',
    photoRef, note,
    latlng, timestamp, marker, label
  };

  habitatObservations.push(obsRecord);
  marker.bindPopup(() => createHabitatPopupHTML(index, habitatObservations[index]));

  syncHabitatToIndexedDB();
  updateTable();
  closeHabitatModal();
}

// ─── Popup HTML ───────────────────────────────────────────────────────────
export function createHabitatPopupHTML(index, obs) {
  const survey  = obs.surveyType || G.activeSurvey;
  const known   = FEATURE_TYPES[survey] || [];
  const isOther = obs.featureType && !known.includes(obs.featureType);
  const selVal  = isOther ? 'Other' : (obs.featureType || '');
  const otherTx = isOther ? obs.featureType : '';

  const div = document.createElement('div');
  div.className = 'popup-content compact';
  div.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">🌿 ${obs.featureType || 'Habitat Feature'}</div>
    <div class="form-row">
      <label>Habitat Type:</label>
      <select id="habPopFeature-${index}" onchange="handleOtherSelect(this,'habPopFeatureOtherRow-${index}')">
        ${[...known, 'Other'].map(f => `<option value="${f}" ${f === selVal ? 'selected' : ''}>${f}</option>`).join('')}
      </select>
    </div>
    <div class="form-row" id="habPopFeatureOtherRow-${index}" style="${isOther ? '' : 'display:none;'}">
      <label></label>
      <input type="text" id="habPopFeatureOther-${index}" value="${otherTx}" placeholder="Specify feature type…" style="flex:1;" />
    </div>
<div class="form-row">
      <label>Photo Ref:</label>
      <input type="text" id="habPopPhoto-${index}" value="${obs.photoRef || ''}" placeholder="Filename or ID" style="flex:1;" />
      <button type="button" onclick="capturePopupPhoto(${obs.latlng?.lat ?? null}, ${obs.latlng?.lng ?? null}, 'habPopPhoto-${index}')" title="Take Photo"><i class="fas fa-camera"></i></button>
    </div>
    <div class="form-row">
      <label>Notes:</label>
      <textarea id="habPopNote-${index}" rows="2">${obs.note || ''}</textarea>
    </div>
    <div class="form-row" style="justify-content:space-between;">
      <button onclick="updateHabitatObservation(${index})">Save</button>
      <button class="danger" onclick="deleteHabitatMarker(${index})">Delete</button>
    </div>
  `;
  return div;
}

// ─── Popup Save / Delete ──────────────────────────────────────────────────
function updateHabitatObservation(index) {
  const rec = habitatObservations[index];
  if (!rec) return;

  const selEl = document.getElementById(`habPopFeature-${index}`);
  rec.featureType = selEl?.value === 'Other'
    ? (document.getElementById(`habPopFeatureOther-${index}`)?.value.trim() || 'Other')
    : (selEl?.value || rec.featureType);
rec.photoRef  = document.getElementById(`habPopPhoto-${index}`)?.value     || '';
  rec.note      = document.getElementById(`habPopNote-${index}`)?.value      || '';

  rec.label.setIcon(L.divIcon({
    className: 'marker-label',
    html: `🌿 ${rec.featureType}`,
    iconAnchor: [0, 10]
  }));
  syncHabitatToIndexedDB();
  updateTable();
  rec.marker.closePopup();
}

function deleteHabitatMarker(index) {
  const obs = habitatObservations[index];
  if (!obs) return;
  if (obs.marker) map.removeLayer(obs.marker);
  if (obs.label)  map.removeLayer(obs.label);
  habitatObservations.splice(index, 1);
  syncHabitatToIndexedDB();
  updateTable();
}

window.updateHabitatObservation = updateHabitatObservation;
window.deleteHabitatMarker      = deleteHabitatMarker;
window.saveHabitatObservation   = saveHabitatObservation;
window.closeHabitatModal        = closeHabitatModal;
window.captureHabitatPhoto      = () => capturePhoto(habitatCurrentLatLng, 'habitatPhotoInput');

// ─── Inject Modal HTML ────────────────────────────────────────────────────
export function injectHabitatModal(surveyType) {
  document.getElementById('habitatModal')?.remove();
  const el = document.createElement('div');
  el.id        = 'habitatModal';
  el.className = 'modal';
  el.style.cssText = 'display:none;';

  const features = FEATURE_TYPES[surveyType] || [];
  el.innerHTML = `
    <div class="modal-content">
      <h2>Habitat / Feature Observation</h2>

      <label>Habitat Type:</label>
      <select id="habitatFeatureTypeInput" onchange="habitatFeatureTypeChange()">
        <option value="">-- Select --</option>
        ${features.map(f => `<option value="${f}">${f}</option>`).join('')}
        <option value="Other">Other</option>
      </select>
      <div id="habitatFeatureTypeOtherWrap" style="display:none; margin-top:4px;">
        <input type="text" id="habitatFeatureTypeOther" placeholder="Specify habitat type…" style="width:100%;" />
      </div>

      <div id="habitatCriteriaSection">
        <label style="margin-top:12px; display:block;">
          Habitat Criteria <span style="font-size:0.8em; opacity:0.65;">(check all that apply)</span>
        </label>
        <div id="habitatCriteriaList"></div>
      </div>

<label>Photo Reference (filename / ID):</label>
      <div style="display:flex; gap:6px; align-items:center;">
        <input type="text" id="habitatPhotoInput" placeholder="e.g. IMG_0042" style="flex:1;" />
        <button type="button" onclick="captureHabitatPhoto()" title="Take Photo"><i class="fas fa-camera"></i></button>
      </div>

      <label>Notes:</label>
      <textarea id="habitatNoteInput" rows="3" placeholder="Optional notes…"></textarea>

      <div style="margin-top:10px; display:flex; gap:8px;">
        <button onclick="saveHabitatObservation()">Save Observation</button>
        <button onclick="closeHabitatModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
}
