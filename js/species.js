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
  surveySubmittedAt, surveyResubmittedAt,
  setLastBBSSpecies
} from './surveyGlobals.js';

// ─── Species Search Autocomplete ──────────────────────────────────────────
const RARITY_COLOUR = { rare: '#CC0000', infrequent: '#E69138' };
const SARA_LABEL    = { E: 'SAR-E', T: 'SAR-T', SC: 'SAR-SC' };
const SARA_COLOUR   = { E: '#CC0000', T: '#E69138', SC: '#F1C232' };

const RARITY_LEGEND_HTML = `
  <div id="rarityLegend" style="display:flex;flex-direction:column;gap:6px;font-size:0.75rem;opacity:0.6;margin-bottom:8px;padding:0 2px;">
    <div style="display:flex;gap:14px;align-items:center;">
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#CC0000;margin-right:4px;vertical-align:middle;"></span>Rare</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#E69138;margin-right:4px;vertical-align:middle;"></span>Infrequent</span>
      <span><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#888;margin-right:4px;vertical-align:middle;"></span>Regular</span>
    </div>
    <div style="display:flex;gap:10px;font-size:0.72rem;opacity:0.65;flex-wrap:wrap;">
      <span><span style="background:#CC0000;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.65rem;font-weight:700;">SAR-E</span> Endangered</span>
      <span><span style="background:#E69138;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.65rem;font-weight:700;">SAR-T</span> Threatened</span>
      <span><span style="background:#F1C232;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.65rem;font-weight:700;">SAR-SC</span> Special Concern</span>
      <span><span style="background:#674ea7;color:#fff;padding:1px 4px;border-radius:3px;font-size:0.65rem;font-weight:700;">SOCI</span> Prov. concern</span>
    </div>
    <span style="font-size:0.65rem;opacity:0.5;margin-top:3px;display:block;">Both may appear for provincially rare SARA species</span>
  </div>`;

// ids defaults to BBS modal elements; pass custom ids to drive any other modal's search.
export function updateSpeciesList(filter, ids = {}) {
  const searchId  = ids.searchId  || 'speciesSearch';
  const listId    = ids.listId    || 'speciesList';
  const displayId = ids.displayId || 'selectedSpeciesDisplay';
  const modalId   = ids.modalId   || 'speciesModal';
  const legendId  = ids.legendId  || 'rarityLegend';

  const list = document.getElementById(listId);
  if (!list || !window.speciesList) return;

  if (!document.getElementById(legendId)) {
    const searchInput = document.getElementById(searchId);
    if (searchInput) {
      const legend = document.createElement('div');
      legend.innerHTML = RARITY_LEGEND_HTML;
      legend.firstElementChild.id = legendId;
      searchInput.parentNode.insertBefore(legend.firstElementChild, searchInput);
    }
  }

  list.innerHTML = '';
  list.style.display = '';
  window.speciesList
    .filter(sp =>
      sp.code.includes(filter.toUpperCase()) ||
      sp.name.toLowerCase().includes(filter.toLowerCase())
    )
    .forEach(sp => {
      const colour = RARITY_COLOUR[sp.rarity] || '';
      const dot = colour
        ? `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${colour};margin-right:6px;flex-shrink:0;vertical-align:middle;"></span>`
        : `<span style="display:inline-block;width:8px;margin-right:6px;"></span>`;
      const srankText = (sp.srank && sp.code !== 'OTHER')
        ? `<span style="font-size:0.75rem;opacity:0.45;margin-left:4px;">${sp.srank}</span>`
        : '';
      const saraBadge = sp.sara
        ? `<span style="font-size:0.65rem;font-weight:700;padding:1px 5px;border-radius:3px;background:${SARA_COLOUR[sp.sara]};color:#fff;margin-left:6px;vertical-align:middle;letter-spacing:0.03em;">${SARA_LABEL[sp.sara]}</span>`
        : '';
      const sociBadge = sp.soci
        ? `<span style="font-size:0.65rem;font-weight:700;padding:1px 5px;border-radius:3px;background:#674ea7;color:#fff;margin-left:4px;vertical-align:middle;letter-spacing:0.03em;">SOCI</span>`
        : '';

      const li = document.createElement('li');
      li.innerHTML = `${dot}${sp.name}${saraBadge}${sociBadge}${srankText}`;
      li.style.cursor = 'pointer';
      li.onclick = () => {
        const modal   = document.getElementById(modalId);
        const search  = document.getElementById(searchId);
        const display = document.getElementById(displayId);
        if (modal)   modal._selectedSpecies = sp;
        if (search)  { search.style.display = 'none'; search.value = sp.code; }
        if (display) {
          display.innerHTML = `${dot}<strong>${sp.name}</strong>${saraBadge}${sociBadge}${srankText}`
            + `<span style="font-size:0.75rem;opacity:0.5;margin-left:8px;">(${sp.code})</span>`
            + `<span style="float:right;font-size:0.8rem;opacity:0.6;margin-top:1px;">tap to change ✕</span>`;
          display.style.display = 'block';
        }
        list.innerHTML = '';
        list.style.display = 'none';
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
  const modal   = document.getElementById('speciesModal');
  const code    = document.getElementById('speciesSearch')?.value.trim().toUpperCase();
  const species = modal?._selectedSpecies ?? window.speciesList?.find(sp => sp.code === code);
  if (!species || !currentLatLng) {
    alert('Invalid species or location.');
    return;
  }

  const count     = parseInt(document.getElementById('speciesCountDisplay')?.textContent) || 1;
  const breeding  = document.getElementById('breedingInput')?.value  || '';
  const note      = document.getElementById('noteInput')?.value      || '';
  const passHt    = document.getElementById('passHtInput')?.value    || '';
  const flightDir = document.getElementById('flightDirInput')?.value || '';
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

  // Marker colour: SARA listed = red, SOCI-only = purple, regular = green
  const markerColor = species.sara
    ? '#CC0000'
    : species.soci
      ? '#9900cc'
      : '#33a853';

  const marker = L.circleMarker(latlng, {
    radius:      15,
    color:       markerColor,
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

  // Read start/end times fresh from localStorage at save time — the timer may
  // have updated them after module load, or the user may not have started the
  // timer yet (in which case they remain empty strings).
  const _surveyStartTime = localStorage.getItem('surveyStartTime') || '';
  const _surveyEndTime   = localStorage.getItem('surveyEndTime')   || '';

  speciesMarkers.push({
    code: species.code, name: species.name, soci: species.soci,
    latlng, observer, pointID, projectID, surveyType,
    surveyLength, wind, windDir, tempC, precip, siteHabitat,
    surveyLat, surveyLng,
    surveyStartTime: _surveyStartTime, surveyEndTime: _surveyEndTime,
    surveySubmittedAt, surveyResubmittedAt,
    count, breeding, note, passHt, flightDir,
    marker, label,
    range: Math.round(dist), bearing: Math.round(angle),
    timestamp
  });

  setLastBBSSpecies(species.code, species.name);
  syncToIndexedDB();
  updateTable();
  closeModal();
}

// ─── Popup HTML ───────────────────────────────────────────────────────────
export function createSpeciesPopupHTML(index, code, count, breeding, note, passHeight = '', flightDir = '') {
  const info = window.speciesList?.find(s => s.code === code);
  const srankBadge = (info?.srank && info.srank !== 'SNA' && code !== 'OTHER')
    ? `<span style="font-size:0.7rem;background:#333;padding:1px 5px;border-radius:4px;opacity:0.7;margin-left:4px;">${info.srank}</span>`
    : '';
  const saraBadge = info?.sara
    ? `<span style="font-size:0.7rem;background:${SARA_COLOUR[info.sara]};color:#fff;padding:1px 5px;border-radius:4px;margin-left:4px;">${SARA_LABEL[info.sara]}</span>`
    : '';
  const sociBadge = info?.soci
    ? `<span style="font-size:0.7rem;background:#674ea7;color:#fff;padding:1px 5px;border-radius:4px;margin-left:4px;">SOCI</span>`
    : '';

  const popup = document.createElement('div');
  popup.className = 'popup-content compact';
  popup.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">${code}${srankBadge}${saraBadge}${sociBadge}</div>
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
