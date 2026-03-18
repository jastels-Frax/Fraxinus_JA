// js/habitat.js — Habitat / General Feature observation module
// Applies to all three survey types (BBS, MOOSE, TURTLE).
// Inspired by the Wood Turtle Habitat Collector prototype — habitat-criteria
// checklist toggled contextually per feature type.

import { habitatObservations } from './storageData.js';
import { syncHabitatToIndexedDB } from './storage.js';
import { updateTable } from './ui.js';
import { map } from './map.js';
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
    'Large-diameter tree or structure',
    'Entrance diameter ≥3 cm',
    'No direct human disturbance',
    'Near water or forest edge'
  ],
  'Snag': [
    'Standing dead wood present',
    'Visible cavities or excavations',
    'Height >5 m',
    'Edge or riparian setting'
  ],
  'Wetland': [
    'Standing or slow-moving water',
    'Emergent vegetation present',
    'Potential amphibian breeding habitat',
    'Adequate buffer from disturbance'
  ],
  'Hedgerow/Edge': [
    'Linear shrub/tree structure',
    'Adjacent to open habitat',
    'Dense enough for nesting cover',
    'Fruit- or mast-producing species present'
  ],
  'Riparian Buffer': [
    'Adjacent to watercourse',
    'Canopy cover ≥50%',
    'Minimal invasive species',
    'Buffer width ≥10 m'
  ],
  'Grassland': [
    'Unimproved or native grass species',
    'Minimal shrub encroachment',
    'Evidence of ground-nesting activity',
    'Low disturbance level'
  ],
  'Woodland': [
    'Closed canopy present',
    'Understory structure present',
    'Evidence of breeding activity',
    'Mixed-age tree cohort'
  ],
  'Pond/Water Body': [
    'Open water surface',
    'Aquatic vegetation present',
    'Adjacent marsh or vegetated buffer',
    'Low turbidity'
  ],
  // — MOOSE —
  'Wallow': [
    'Muddy or wet depression',
    'Evidence of digging or rolling',
    'Hair or scent markers present',
    'Recent tracks in vicinity'
  ],
  'Mineral Lick': [
    'Exposed soil or clay substrate',
    'Heavy browsing sign nearby',
    'Visible trails converging',
    'Seasonal use evidence'
  ],
  'Water Crossing': [
    'Shallow ford or bank entry point',
    'Worn trail leading to water',
    'Tracks in soft substrate',
    'Adequate overhead clearance'
  ],
  'Bedding Area': [
    'Flattened or compressed vegetation',
    'Sheltered microsite',
    'Pellets or hair present',
    'Nearby food source'
  ],
  'Browse Corridor': [
    'Dense early-successional shrubs',
    'Evidence of stem clipping',
    'Multiple converging trails',
    'Proximity to water'
  ],
  'Riparian Zone': [
    'Within 50 m of watercourse',
    'Willow or alder present',
    'Soft bank substrate',
    'Seasonally flooded'
  ],
  'Salt Lick': [
    'Soil excavation visible',
    'Tracks converging on site',
    'Chemical or mineral odour',
    'Evidence of repeated use'
  ],
  // — TURTLE —
  'Basking Site': [
    'Downed logs in or near water',
    'Exposed rocks near/in water',
    'Sunny open bank',
    'Low disturbance level'
  ],
  'Nesting Area': [
    'Sandy or gravelly substrate',
    'Full sun exposure',
    'Proximity to water (<250 m)',
    'Disturbed or open ground'
  ],
  'Overwintering Site': [
    'Flowing water with oxygenation',
    'Water depth 0.5–1.5 m',
    'Sandy or gravelly streambed',
    'Cover: undercut banks, roots, or logs'
  ],
  'Foraging Area': [
    'Floodplain meadow or wetland',
    'Alder thickets or shrubby edge',
    'Open trails or corridors',
    'Evidence of invertebrate or plant food'
  ],
  'Riparian Corridor': [
    'Contiguous riparian vegetation',
    'Potential turtle movement corridor',
    'Low road or barrier fragmentation',
    'Connects two or more aquatic habitats'
  ],
  'Water Feature': [
    'Lentic or lotic water body',
    'Adequate depth for overwintering',
    'Vegetated margins',
    'Evidence of turtle use'
  ]
};

const CONDITION_LIST = ['Excellent', 'Good', 'Fair', 'Poor'];

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
  modal.querySelector('#habitatConditionInput').value = '';
  modal.querySelector('#habitatSizeInput').value      = '';
  modal.querySelector('#habitatPhotoInput').value     = '';
  modal.querySelector('#habitatNoteInput').value      = '';

  modal.style.display    = 'block';
  backdrop.style.display = 'block';
}

export function closeHabitatModal() {
  habitatPlacingPoint  = false;
  habitatCurrentLatLng = null;
  document.getElementById('habitatModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
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
export function saveHabitatObservation() {
  const sel         = document.getElementById('habitatFeatureTypeInput');
  const featureType = sel?.value === 'Other'
    ? (document.getElementById('habitatFeatureTypeOther')?.value.trim() || '')
    : (sel?.value || '');

  const criteria  = Array.from(
    document.querySelectorAll('#habitatCriteriaList input:checked')
  ).map(cb => cb.value);
  const condition = document.getElementById('habitatConditionInput')?.value.trim() || '';
  const size      = document.getElementById('habitatSizeInput')?.value.trim()      || '';
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

  const survey    = G.activeSurvey;
  const latlng    = habitatCurrentLatLng;
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
    surveyType: survey, featureType, criteria,
    condition, size, photoRef, note,
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
      <label>Feature Type:</label>
      <select id="habPopFeature-${index}" onchange="handleOtherSelect(this,'habPopFeatureOtherRow-${index}')">
        ${[...known, 'Other'].map(f => `<option value="${f}" ${f === selVal ? 'selected' : ''}>${f}</option>`).join('')}
      </select>
    </div>
    <div class="form-row" id="habPopFeatureOtherRow-${index}" style="${isOther ? '' : 'display:none;'}">
      <label></label>
      <input type="text" id="habPopFeatureOther-${index}" value="${otherTx}" placeholder="Specify feature type…" style="flex:1;" />
    </div>
    <div class="form-row">
      <label>Condition:</label>
      <select id="habPopCondition-${index}">
        <option value="">-- Select --</option>
        ${CONDITION_LIST.map(c => `<option value="${c}" ${c === obs.condition ? 'selected' : ''}>${c}</option>`).join('')}
      </select>
    </div>
    <div class="form-row">
      <label>Size/Extent:</label>
      <input type="text" id="habPopSize-${index}" value="${obs.size || ''}" placeholder="e.g. 5 m diameter" style="flex:1;" />
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
  rec.condition = document.getElementById(`habPopCondition-${index}`)?.value || '';
  rec.size      = document.getElementById(`habPopSize-${index}`)?.value      || '';
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
  el.style.display = 'none';

  const features = FEATURE_TYPES[surveyType] || [];
  el.innerHTML = `
    <div class="modal-content">
      <h2>Habitat / Feature Observation</h2>

      <label>Feature Type:</label>
      <select id="habitatFeatureTypeInput" onchange="habitatFeatureTypeChange()">
        <option value="">-- Select --</option>
        ${features.map(f => `<option value="${f}">${f}</option>`).join('')}
        <option value="Other">Other</option>
      </select>
      <div id="habitatFeatureTypeOtherWrap" style="display:none; margin-top:4px;">
        <input type="text" id="habitatFeatureTypeOther" placeholder="Specify feature type…" style="width:100%;" />
      </div>

      <div id="habitatCriteriaSection">
        <label style="margin-top:12px; display:block;">
          Habitat Criteria <span style="font-size:0.8em; opacity:0.65;">(check all that apply)</span>
        </label>
        <div id="habitatCriteriaList"></div>
      </div>

      <label>Condition:</label>
      <select id="habitatConditionInput">
        <option value="">-- Select --</option>
        ${CONDITION_LIST.map(c => `<option value="${c}">${c}</option>`).join('')}
      </select>

      <label>Size / Extent:</label>
      <input type="text" id="habitatSizeInput" placeholder="e.g. 5 m diameter, 200 m stretch" />

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
