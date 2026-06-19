// js/nest.js — Nest Sweep survey module (MBCA / MBR 2022 pre-disturbance surveys)

import { nestObservations } from './storageData.js';
import { syncNestToIndexedDB } from './storage.js';
import { updateTable } from './ui.js';
import { map, lockMap, unlockMap } from './map.js';
import * as G from './surveyGlobals.js';
import { showUndoToast, showToast } from './toast.js';
import { setActiveModal, clearActiveModal } from './modal.js';
import { updateSpeciesList } from './species.js';

// ─── Modal State ──────────────────────────────────────────────────────────
let nestPlacingPoint  = false;
let nestCurrentLatLng = null;

export function isNestPlacingPoint() { return nestPlacingPoint; }

// ─── Status colours ───────────────────────────────────────────────────────
const STATUS_COLOUR = { Active: '#CC0000', Inactive: '#888888', Unknown: '#E69138' };

// ─── Species search IDs (parallel to BBS modal, but scoped to nestModal) ──
const NEST_SP_IDS = {
  searchId:  'nestSpeciesSearch',
  listId:    'nestSpeciesList',
  displayId: 'nestSelectedSpeciesDisplay',
  modalId:   'nestModal',
  legendId:  'nestRarityLegend'
};
const UNKNOWN_SP = { name: 'Unknown', code: 'UNKN', rarity: '', soci: false, sara: '' };

// Populate species list for nest modal; always prepend Unknown so it stays selectable.
function _updateNestList(filter) {
  updateSpeciesList(filter, NEST_SP_IDS);

  const list = document.getElementById('nestSpeciesList');
  if (!list) return;
  if (!filter || 'unknown'.includes(filter.toLowerCase())) {
    const li = document.createElement('li');
    li.innerHTML = `<span style="display:inline-block;width:8px;margin-right:6px;"></span><em style="color:#aaa;">Unknown</em>`;
    li.style.cursor = 'pointer';
    li.onclick = () => {
      const modal   = document.getElementById('nestModal');
      const search  = document.getElementById('nestSpeciesSearch');
      const display = document.getElementById('nestSelectedSpeciesDisplay');
      if (modal)   modal._selectedSpecies = UNKNOWN_SP;
      if (search)  { search.style.display = 'none'; search.value = ''; }
      if (display) {
        display.innerHTML = `<span style="display:inline-block;width:8px;margin-right:6px;"></span><strong>Unknown</strong><span style="float:right;font-size:0.8rem;opacity:0.6;margin-top:1px;">tap to change ✕</span>`;
        display.style.display = 'block';
      }
      list.innerHTML = '';
      list.style.display = 'none';
    };
    list.insertBefore(li, list.firstChild);
    list.style.display = '';
  }
}

// ─── Show / Close Modal ───────────────────────────────────────────────────
export function showNestModal(latlng) {
  if (!G.nestObserver || !G.nestSiteName) {
    showToast('Metadata incomplete — tap 📋 to fill in.', 'warning', 3000);
  }

  const modal    = document.getElementById('nestModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (!modal || !backdrop) {
    console.error('[showNestModal] modal not found — injectNestModal() may not have been called');
    showToast('Observation form not ready. Please restart the survey.', 'error', 5000);
    return;
  }

  nestPlacingPoint  = true;
  nestCurrentLatLng = latlng;

  // Reset all fields
  // ── Species search: reset to Unknown default ──
  modal._selectedSpecies = UNKNOWN_SP;
  const _search  = modal.querySelector('#nestSpeciesSearch');
  const _display = modal.querySelector('#nestSelectedSpeciesDisplay');
  const _list    = modal.querySelector('#nestSpeciesList');
  if (_search)  { _search.value = ''; _search.style.display = 'none'; }
  if (_list)    { _list.innerHTML = ''; _list.style.display = 'none'; }
  if (_display) {
    _display.innerHTML = `<span style="display:inline-block;width:8px;margin-right:6px;"></span><strong>Unknown</strong><span style="float:right;font-size:0.8rem;opacity:0.6;margin-top:1px;">tap to change ✕</span>`;
    _display.style.display = 'block';
  }
  // Wire tap-to-change (once only per element lifetime)
  if (_display && !_display.dataset.wired) {
    _display.dataset.wired = 'true';
    _display.addEventListener('click', () => {
      modal._selectedSpecies = null;
      if (_search)  { _search.style.display = ''; _search.value = ''; _search.focus(); }
      if (_display) { _display.style.display = 'none'; _display.innerHTML = ''; }
      _updateNestList('');
    });
  }
  if (_search && !_search.dataset.wired) {
    _search.dataset.wired = 'true';
    _search.addEventListener('input', e => _updateNestList(e.target.value));
  }
  modal.querySelectorAll('input[name="nestStatus"]').forEach(r => { r.checked = false; });
  ['nestContentsFlushed','nestContentsEggs','nestContentsChicks','nestContentsEmpty','nestContentsUnknown'].forEach(id => {
    const el = modal.querySelector(`#${id}`);
    if (el) el.checked = false;
  });
  const eggCount   = modal.querySelector('#nestEggCount');
  const chickCount = modal.querySelector('#nestChickCount');
  if (eggCount)   eggCount.value   = '0';
  if (chickCount) chickCount.value = '0';
  modal.querySelector('#nestEggRow').style.display   = 'none';
  modal.querySelector('#nestChickRow').style.display = 'none';
  modal.querySelector('#nestSubstrate').value    = '';
  modal.querySelector('#nestTreeHeightRow').style.display = 'none';
  modal.querySelector('#nestTreeHeight').value   = '';
  modal.querySelector('#nestSched1').value       = '';
  modal.querySelector('#nestSAR').value          = '';
  modal.querySelector('#nestBuffer').value       = '';
  modal.querySelector('#nestDisposition').value  = '';
  modal.querySelector('#nestPhotos').checked     = false;
  modal.querySelector('#nestNotes').value        = '';

  modal.style.display    = 'block';
  backdrop.style.display = 'block';
  setActiveModal('nest');
  lockMap();
}

export function closeNestModal() {
  nestPlacingPoint  = false;
  nestCurrentLatLng = null;
  const _m = document.getElementById('nestModal');
  if (_m) {
    _m._selectedSpecies = null;
    const _s = _m.querySelector('#nestSpeciesSearch');
    const _d = _m.querySelector('#nestSelectedSpeciesDisplay');
    const _l = _m.querySelector('#nestSpeciesList');
    if (_s) { _s.style.display = 'none'; _s.value = ''; }
    if (_d) { _d.style.display = 'none'; _d.innerHTML = ''; }
    if (_l) { _l.innerHTML = ''; _l.style.display = 'none'; }
  }
  document.getElementById('nestModal')?.style.setProperty('display', 'none');
  document.getElementById('modalBackdrop')?.style.setProperty('display', 'none');
  clearActiveModal();
  unlockMap();
}

// ─── Save Observation ─────────────────────────────────────────────────────
export function saveNestObservation() {
  const status = document.querySelector('input[name="nestStatus"]:checked')?.value || '';
  if (!status) {
    alert('Please select a nest status (Active, Inactive, or Unknown).');
    return;
  }

  const disposition = document.getElementById('nestDisposition')?.value || '';
  if (!disposition) {
    alert('Please select a disposition.');
    return;
  }

  if (!nestCurrentLatLng) {
    alert('No location captured. Use the Record Observation button to geotag your current position.');
    return;
  }

  const rawLL  = nestCurrentLatLng;
  const latlng = {
    lat: rawLL.lat ?? rawLL.latitude  ?? rawLL[0],
    lng: rawLL.lng ?? rawLL.longitude ?? rawLL[1]
  };
  if (!isFinite(latlng.lat) || !isFinite(latlng.lng)) {
    alert('Invalid GPS coordinates — please try again.');
    return;
  }

  if (status === 'Active') {
    showToast('Active nest detected — confirm disposition before saving.', 'warning', 4000);
  }

  const _nestModal = document.getElementById('nestModal');
  const species    = _nestModal?._selectedSpecies?.name || 'Unknown';
  const contentsIds = ['nestContentsFlushed','nestContentsEggs','nestContentsChicks','nestContentsEmpty','nestContentsUnknown'];
  const contents  = contentsIds
    .filter(id => document.getElementById(id)?.checked)
    .map(id => document.getElementById(id).value);
  const eggCount  = parseInt(document.getElementById('nestEggCount')?.value  || '0', 10) || 0;
  const chickCount= parseInt(document.getElementById('nestChickCount')?.value || '0', 10) || 0;
  const substrate = document.getElementById('nestSubstrate')?.value  || '';
  const treeHeight= document.getElementById('nestTreeHeight')?.value || '';
  const sched1    = document.getElementById('nestSched1')?.value     || '';
  const sar       = document.getElementById('nestSAR')?.value        || '';
  const buffer    = document.getElementById('nestBuffer')?.value     || '';
  const photos    = document.getElementById('nestPhotos')?.checked   ?? false;
  const note      = document.getElementById('nestNotes')?.value.trim() || '';

  const timestamp = new Date().toLocaleString();
  const index     = nestObservations.length;

  const statusAbbr  = status === 'Active' ? 'A' : status === 'Inactive' ? 'I' : 'U';
  const labelText   = `${species} [${statusAbbr}]`;
  const markerColor = STATUS_COLOUR[status] || '#888888';

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
      html:      labelText,
      iconAnchor:[0, 20]
    })
  }).addTo(map);

  const _startTime = localStorage.getItem('nestStartTime') || '';
  const _endTime   = localStorage.getItem('nestEndTime')   || '';

  const obsRecord = {
    projectID:        G.nestProjectID       || '',
    observer:         G.nestObserver        || '',
    client:           G.nestClient          || '',
    siteName:         G.nestSiteName        || '',
    municipality:     G.nestMunicipality    || '',
    surveyDate:       G.nestSurveyDate      || '',
    startTime:        _startTime,
    endTime:          _endTime,
    proposedActivity: G.nestProposedActivity || '',
    habitatTypes:     G.nestHabitatTypes     || '',
    surveyMethod:     G.nestSurveyMethod     || '',
    areaHa:           G.nestAreaHa           || '',
    tempC:            G.nestTempC            || '',
    wind:             G.nestWind             || '',
    precip:           G.nestPrecip           || '',
    province:         G.nestProvince         || '',
    species, status, contents, eggCount, chickCount,
    substrate, treeHeight, sched1, sar, buffer, disposition,
    photos, note,
    latlng, marker, label,
    timestamp,
    nestSubmittedAt:   G.nestSubmittedAt   || '',
    nestResubmittedAt: G.nestResubmittedAt || ''
  };

  const popup = createNestPopupHTML(index, obsRecord);
  marker.bindPopup(popup);

  nestObservations.push(obsRecord);
  syncNestToIndexedDB();
  updateTable();
  closeNestModal();
}

// ─── Popup HTML ───────────────────────────────────────────────────────────
export function createNestPopupHTML(index, obs) {
  const statusColour = STATUS_COLOUR[obs.status] || '#888';
  const contentsSummary = (obs.contents || []).join(', ') || '—';
  const div = document.createElement('div');
  div.className = 'popup-content compact';
  div.innerHTML = `
    <div style="font-weight:600; margin-bottom:6px;">
      ${obs.species || 'Unknown'}
      <span style="font-size:0.72rem; font-weight:700; padding:1px 6px; border-radius:3px;
        background:${statusColour}; color:#fff; margin-left:6px;">${obs.status || '?'}</span>
    </div>
    <div style="font-size:0.78rem; color:#aaa; margin-bottom:8px;">
      ${obs.substrate || ''}${obs.substrate && obs.treeHeight ? ` · ${obs.treeHeight} m` : ''}
      ${contentsSummary !== '—' ? ' · ' + contentsSummary : ''}
    </div>
    <div class="form-row">
      <label>Status:</label>
      <select id="nestPopStatus-${index}">
        <option value="Active"   ${obs.status==='Active'   ?'selected':''}>Active</option>
        <option value="Inactive" ${obs.status==='Inactive' ?'selected':''}>Inactive</option>
        <option value="Unknown"  ${obs.status==='Unknown'  ?'selected':''}>Unknown</option>
      </select>
    </div>
    <div class="form-row">
      <label>Sched. 1:</label>
      <select id="nestPopSched1-${index}">
        <option value="">-- Select --</option>
        <option value="Yes"     ${obs.sched1==='Yes'     ?'selected':''}>Yes</option>
        <option value="No"      ${obs.sched1==='No'      ?'selected':''}>No</option>
        <option value="Unknown" ${obs.sched1==='Unknown' ?'selected':''}>Unknown</option>
      </select>
    </div>
    <div class="form-row">
      <label>SAR:</label>
      <select id="nestPopSAR-${index}">
        <option value="">-- Select --</option>
        <option value="Yes"     ${obs.sar==='Yes'     ?'selected':''}>Yes</option>
        <option value="No"      ${obs.sar==='No'      ?'selected':''}>No</option>
        <option value="Unknown" ${obs.sar==='Unknown' ?'selected':''}>Unknown</option>
      </select>
    </div>
    <div class="form-row">
      <label>Buffer (m):</label>
      <input type="number" id="nestPopBuffer-${index}" value="${obs.buffer || ''}" style="width:80px;" />
    </div>
    <div class="form-row">
      <label>Disposition:</label>
      <select id="nestPopDisposition-${index}">
        <option value="">-- Select --</option>
        <option value="Work can proceed"                  ${obs.disposition==='Work can proceed'                  ?'selected':''}>Work can proceed</option>
        <option value="Delay required (active nest)"      ${obs.disposition==='Delay required (active nest)'      ?'selected':''}>Delay required (active nest)</option>
        <option value="Buffer zone required"              ${obs.disposition==='Buffer zone required'              ?'selected':''}>Buffer zone required</option>
        <option value="ECCC/SARA consultation required"   ${obs.disposition==='ECCC/SARA consultation required'   ?'selected':''}>ECCC/SARA consultation required</option>
        <option value="Pending assessment"                ${obs.disposition==='Pending assessment'                ?'selected':''}>Pending assessment</option>
      </select>
    </div>
    <div class="form-row">
      <label>Notes:</label>
      <textarea id="nestPopNotes-${index}" rows="2">${obs.note || ''}</textarea>
    </div>
    <div style="font-size:0.72rem; color:#888; margin-top:4px;">${obs.timestamp || ''}</div>
    <div class="form-row" style="justify-content:space-between; margin-top:8px;">
      <button onclick="updateNestObservation(${index})">Save</button>
      <button class="danger" onclick="deleteNestMarker(${index})">Delete</button>
    </div>
  `;
  return div;
}

// ─── Popup Save / Delete ──────────────────────────────────────────────────
function updateNestObservation(index) {
  const rec = nestObservations[index];
  if (!rec) return;

  rec.status      = document.getElementById(`nestPopStatus-${index}`)?.value      || rec.status;
  rec.sched1      = document.getElementById(`nestPopSched1-${index}`)?.value      || '';
  rec.sar         = document.getElementById(`nestPopSAR-${index}`)?.value         || '';
  rec.buffer      = document.getElementById(`nestPopBuffer-${index}`)?.value      || '';
  rec.disposition = document.getElementById(`nestPopDisposition-${index}`)?.value || '';
  rec.note        = document.getElementById(`nestPopNotes-${index}`)?.value       || '';

  const statusAbbr  = rec.status === 'Active' ? 'A' : rec.status === 'Inactive' ? 'I' : 'U';
  const markerColor = STATUS_COLOUR[rec.status] || '#888888';

  rec.label.setIcon(L.divIcon({
    className: 'marker-label',
    html:      `${rec.species} [${statusAbbr}]`,
    iconAnchor:[0, 10]
  }));
  rec.marker.setStyle({ color: markerColor });

  syncNestToIndexedDB();
  updateTable();
  rec.marker.closePopup();
}

let _pendingDeleteNest = null;

function deleteNestMarker(index) {
  const obs = nestObservations[index];
  if (!obs) return;

  if (_pendingDeleteNest) {
    clearTimeout(_pendingDeleteNest.timeoutId);
    _pendingDeleteNest.dismissToast?.();
    syncNestToIndexedDB();
    _pendingDeleteNest = null;
  }
  if (obs.marker) map.removeLayer(obs.marker);
  if (obs.label)  map.removeLayer(obs.label);
  nestObservations.splice(index, 1);
  updateTable();

  const timeoutId = setTimeout(() => {
    if (_pendingDeleteNest?.timeoutId === timeoutId) {
      _pendingDeleteNest.dismissToast?.();
      syncNestToIndexedDB();
      _pendingDeleteNest = null;
    }
  }, 5000);

  const dismissToast = showUndoToast('Observation deleted.', () => {
    if (_pendingDeleteNest?.timeoutId !== timeoutId) return;
    clearTimeout(timeoutId);
    nestObservations.splice(index, 0, obs);
    if (obs.marker) map.addLayer(obs.marker);
    if (obs.label)  map.addLayer(obs.label);
    _pendingDeleteNest = null;
    updateTable();
  });

  _pendingDeleteNest = { timeoutId, dismissToast };
}

window.saveNestObservation   = saveNestObservation;
window.closeNestModal        = closeNestModal;
window.updateNestObservation = updateNestObservation;
window.deleteNestMarker      = deleteNestMarker;

// ─── Conditional field visibility (called from inline onchange) ───────────
window.handleNestSubstrate = function (sel) {
  const row = document.getElementById('nestTreeHeightRow');
  if (row) row.style.display = sel.value === 'Tree' ? '' : 'none';
};

window.handleNestContents = function () {
  const eggsChecked  = document.getElementById('nestContentsEggs')?.checked;
  const chicksChecked= document.getElementById('nestContentsChicks')?.checked;
  const eggRow   = document.getElementById('nestEggRow');
  const chickRow = document.getElementById('nestChickRow');
  if (eggRow)   eggRow.style.display   = eggsChecked  ? '' : 'none';
  if (chickRow) chickRow.style.display = chicksChecked ? '' : 'none';
};

// ─── Inject modal HTML into DOM ───────────────────────────────────────────
export function injectNestModal() {
  let el = document.getElementById('nestModal');
  if (el) return;
  el = document.createElement('div');
  el.id = 'nestModal';
  el.className = 'modal';
  el.style.display = 'none';
  el.innerHTML = `
    <div class="modal-content">
      <h2>Nest Observation</h2>

      <label>Species / Suspected Species:</label>
      <div id="nestSelectedSpeciesDisplay" style="display:none; padding:8px 10px; margin:4px 0 6px; background:#2a2a2a; border:1px solid #4caf50; border-radius:6px; cursor:pointer; font-size:0.95rem; color:#fff;"></div>
      <input type="text" id="nestSpeciesSearch" placeholder="Search species…" autocomplete="off" style="display:none;" />
      <ul id="nestSpeciesList" style="max-height:220px; overflow-y:auto; list-style:none; margin:0 0 6px; padding:4px 0; display:none; background:#1e1e1e; border:1px solid #444; border-radius:4px;"></ul>

      <label>Nest Status: <span style="color:red;">*</span></label>
      <div style="display:flex; gap:16px; margin:4px 0 8px; flex-wrap:wrap;">
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="radio" name="nestStatus" id="nestStatus_active"   value="Active" />
          <span style="color:#CC0000; font-weight:600;">Active</span>
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="radio" name="nestStatus" id="nestStatus_inactive" value="Inactive" />
          <span style="color:#aaa;">Inactive</span>
        </label>
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
          <input type="radio" name="nestStatus" id="nestStatus_unknown"  value="Unknown" />
          <span style="color:#E69138;">Unknown</span>
        </label>
      </div>

      <label>Nest Contents:</label>
      <div style="display:flex; flex-direction:column; gap:4px; margin:4px 0 8px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="nestContentsFlushed" value="Adult/bird flushed" /> Adult/bird flushed
        </label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="nestContentsEggs" value="Eggs" onchange="handleNestContents()" /> Eggs
        </label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="nestContentsChicks" value="Chicks/nestlings" onchange="handleNestContents()" /> Chicks/nestlings
        </label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="nestContentsEmpty" value="Empty" /> Empty
        </label>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
          <input type="checkbox" id="nestContentsUnknown" value="Unknown" /> Unknown
        </label>
      </div>
      <div id="nestEggRow" style="display:none; margin-bottom:6px;">
        <label>Egg count:</label>
        <input type="number" id="nestEggCount" min="0" max="20" value="0" style="width:80px;" />
      </div>
      <div id="nestChickRow" style="display:none; margin-bottom:6px;">
        <label>Chick count:</label>
        <input type="number" id="nestChickCount" min="0" max="20" value="0" style="width:80px;" />
      </div>

      <label>Nest Type / Substrate:</label>
      <select id="nestSubstrate" onchange="handleNestSubstrate(this)">
        <option value="">-- Select --</option>
        <option value="Tree">Tree</option>
        <option value="Shrub">Shrub</option>
        <option value="Ground">Ground</option>
        <option value="Structure">Structure</option>
        <option value="Cliff/Bank">Cliff/Bank</option>
        <option value="Cavity">Cavity</option>
        <option value="Platform/Stick nest">Platform/Stick nest</option>
        <option value="Unknown">Unknown</option>
      </select>
      <div id="nestTreeHeightRow" style="display:none; margin-top:4px;">
        <label>Tree Height (m):</label>
        <input type="number" id="nestTreeHeight" min="0" max="60" step="0.5" style="width:100px;" />
      </div>

      <label>Schedule 1 Species?
        <span style="font-size:0.75rem; color:#888; font-weight:300;">(year-round nest protection)</span>
      </label>
      <select id="nestSched1">
        <option value="">-- Select --</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
        <option value="Unknown">Unknown</option>
      </select>

      <label>SAR Species?</label>
      <select id="nestSAR">
        <option value="">-- Select --</option>
        <option value="Yes">Yes</option>
        <option value="No">No</option>
        <option value="Unknown">Unknown</option>
      </select>

      <label>Recommended Buffer (m):</label>
      <input type="number" id="nestBuffer" min="0" placeholder="e.g. 30" />

      <label>Disposition: <span style="color:red;">*</span></label>
      <select id="nestDisposition">
        <option value="">-- Select --</option>
        <option value="Work can proceed">Work can proceed</option>
        <option value="Delay required (active nest)">Delay required (active nest)</option>
        <option value="Buffer zone required">Buffer zone required</option>
        <option value="ECCC/SARA consultation required">ECCC/SARA consultation required</option>
        <option value="Pending assessment">Pending assessment</option>
      </select>

      <label style="display:flex; align-items:center; gap:8px; margin-top:8px; cursor:pointer;">
        <input type="checkbox" id="nestPhotos" /> Photos taken
      </label>

      <label>Notes:</label>
      <textarea id="nestNotes" rows="3" placeholder="Optional notes..."></textarea>

      <div style="margin-top:10px; display:flex; gap:8px;">
        <button onclick="saveNestObservation()">Save Observation</button>
        <button onclick="closeNestModal()">Cancel</button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
}
