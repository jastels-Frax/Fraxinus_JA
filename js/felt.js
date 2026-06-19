// js/felt.js — Felt GIS integration
// Ported from GPS2026felt/src/io/FeltService.ts and FeltExportDialog.ts

import { showToast } from './toast.js';
import { setActiveModal, clearActiveModal } from './modal.js';
import {
  buildSpeciesGeoJSON, buildMooseGeoJSON,
  buildTurtleGeoJSON, buildNestGeoJSON, buildHabitatGeoJSON
} from './export.js';
import { speciesMarkers, mooseObservations, turtleObservations, nestObservations, habitatObservations } from './storageData.js';

const FELT_API = 'https://felt.com/api/v2';

const DISPLAY_NAME = {
  BBS:     'BBS Survey',
  MOOSE:   'Wildlife Survey',
  TURTLE:  'Turtle Survey',
  NEST:    'Nest Sweep',
  HABITAT: 'Habitat Observations'
};

const SURVEY_EMOJI = { BBS: '🐦', MOOSE: '🦌', TURTLE: '🐢', NEST: '🪹', HABITAT: '🌿' };

// ── Module-level state ────────────────────────────────────────────────────
let _overlay           = null;
let _primaryGeoJSONStr = '';
let _habitatGeoJSONStr = '';
let _habitatCount      = 0;
let _surveyTarget      = '';
let _onClose           = null;
let _apiKey            = '';
let _workspaces        = [];
let _selectedWorkspace = '';
let _maps              = [];

// ── Utilities ─────────────────────────────────────────────────────────────
function _todayDate() {
  return new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
}

function _todayString() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function _esc(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _getObsCount(target) {
  if (target === 'BBS')     return speciesMarkers.length     + habitatObservations.length;
  if (target === 'MOOSE')   return mooseObservations.length  + habitatObservations.length;
  if (target === 'TURTLE')  return turtleObservations.length + habitatObservations.length;
  if (target === 'NEST')    return nestObservations.length   + habitatObservations.length;
  if (target === 'HABITAT') return habitatObservations.length;
  return 0;
}

function _buildPrimaryGeoJSON(target) {
  if (target === 'BBS')    return buildSpeciesGeoJSON();
  if (target === 'MOOSE')  return buildMooseGeoJSON();
  if (target === 'TURTLE') return buildTurtleGeoJSON();
  if (target === 'NEST')   return buildNestGeoJSON();
  return JSON.stringify({ type: 'FeatureCollection', features: [] });
}

// ── GeoJSON validation ────────────────────────────────────────────────────
/**
 * Returns null if valid, or an error string describing the first problem found.
 */
function validateGeoJSON(geojson) {
  if (!geojson || geojson.type !== 'FeatureCollection') {
    return `Root is not a FeatureCollection (got type: ${geojson?.type})`;
  }
  if (!Array.isArray(geojson.features)) {
    return 'features is not an array';
  }
  if (geojson.features.length === 0) {
    return 'FeatureCollection has 0 features — nothing to upload';
  }
  for (let i = 0; i < geojson.features.length; i++) {
    const f = geojson.features[i];
    if (!f || f.type !== 'Feature') {
      return `features[${i}].type is not "Feature" (got: ${f?.type})`;
    }
    if (!f.geometry || f.geometry.type !== 'Point') {
      return `features[${i}].geometry is not a Point (got: ${f?.geometry?.type})`;
    }
    const coords = f.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      return `features[${i}].geometry.coordinates is missing or too short`;
    }
    const [lng, lat] = coords;
    if (!isFinite(lng) || !isFinite(lat)) {
      return `features[${i}] has non-finite coordinates: [${lng}, ${lat}]`;
    }
    if (lat < -90 || lat > 90) {
      return `features[${i}] latitude out of range (${lat}) — coordinates may be swapped`;
    }
    if (lng < -180 || lng > 180) {
      return `features[${i}] longitude out of range (${lng})`;
    }
    // Detect likely lat/lng swap: lng in [-90,90] but lat outside [-90,90]
    if (Math.abs(lng) <= 90 && Math.abs(lat) > 90) {
      return `features[${i}] coordinates appear swapped — expected [lng, lat] but got [${lng}, ${lat}]`;
    }
  }
  return null; // valid
}

// ── Modal lifecycle ───────────────────────────────────────────────────────
// feltModal is pre-created in index.html so it is always in the DOM,
// regardless of whether a survey has been entered yet.
function _openModal() {
  if (!_overlay) {
    _overlay = document.getElementById('feltModal');
    _overlay.addEventListener('click', e => {
      if (e.target === _overlay) _closeModal();
    });
  }
  _overlay.style.display = 'flex';
  setActiveModal('felt');
}

function _closeModal() {
  clearActiveModal();
  if (_overlay) _overlay.style.display = 'none';
  if (_onClose) {
    const cb = _onClose;
    _onClose = null;
    cb();
  }
}

function _header() {
  return `
    <div class="felt-dialog-header">
      <div class="felt-dialog-title">${SURVEY_EMOJI[_surveyTarget] || ''} Upload to Felt</div>
      <button class="felt-close-x" id="feltClose">✕</button>
    </div>`;
}

// ── Step renderers ────────────────────────────────────────────────────────
function _renderLoading(message) {
  _overlay.innerHTML = `
    <div class="felt-dialog">
      ${_header()}
      <div class="felt-dialog-body">
        <div style="text-align:center;padding:32px 8px;opacity:0.6">${_esc(message)}</div>
      </div>
      <div class="felt-dialog-footer">
        <button class="felt-btn-cancel" id="feltCancel">Cancel</button>
      </div>
    </div>`;
  _overlay.querySelector('#feltClose').addEventListener('click', _closeModal);
  _overlay.querySelector('#feltCancel').addEventListener('click', _closeModal);
}

function _renderStep1() {
  const opts = _workspaces.map(w =>
    `<option value="${_esc(w.id)}" ${w.id === _selectedWorkspace ? 'selected' : ''}>${_esc(w.name)}</option>`
  ).join('');

  _overlay.innerHTML = `
    <div class="felt-dialog">
      ${_header()}
      <div class="felt-dialog-body">
        <div class="felt-field">
          <label>Step 1 of 2 — Select Workspace</label>
          <select id="feltWorkspaceSelect">
            <option value="">— Personal / No Workspace —</option>
            ${opts}
          </select>
        </div>
      </div>
      <div class="felt-dialog-footer">
        <button class="felt-btn-cancel" id="feltCancel">Cancel</button>
        <button class="felt-btn-primary" id="feltNext">Next →</button>
      </div>
    </div>`;

  _overlay.querySelector('#feltClose').addEventListener('click', _closeModal);
  _overlay.querySelector('#feltCancel').addEventListener('click', _closeModal);
  _overlay.querySelector('#feltNext').addEventListener('click', async () => {
    _selectedWorkspace = _overlay.querySelector('#feltWorkspaceSelect').value;
    _renderLoading('Loading maps…');
    try {
      _maps = await _fetchMaps(_selectedWorkspace);
    } catch (err) {
      showToast(`Failed to load maps — ${err.message}`, 'error');
      _renderStep1();
      return;
    }
    _renderStep2();
  });
}

function _renderStep2() {
  const hasMaps    = _maps.length > 0;
  const defaultTitle = `${DISPLAY_NAME[_surveyTarget] || 'Survey'} ${_todayDate()}`;
  const mapOpts    = _maps.map(m =>
    `<option value="${_esc(m.id)}">${_esc(m.title)}</option>`
  ).join('');

  _overlay.innerHTML = `
    <div class="felt-dialog">
      ${_header()}
      <div class="felt-dialog-body">
        <div class="felt-field">
          <label>Step 2 of 2 — Destination Map</label>
          <div class="felt-radio-group">
            <label class="felt-radio ${!hasMaps ? 'felt-radio-disabled' : ''}">
              <input type="radio" name="feltMapMode" value="existing"
                ${hasMaps ? 'checked' : ''} ${!hasMaps ? 'disabled' : ''} />
              <span>${hasMaps ? 'Upload to existing map' : 'Upload to existing map (none found in workspace)'}</span>
            </label>
            <label class="felt-radio">
              <input type="radio" name="feltMapMode" value="new" ${!hasMaps ? 'checked' : ''} />
              <span>Create new map</span>
            </label>
          </div>
        </div>
        <div id="feltExistingMapField" class="felt-field" style="${!hasMaps ? 'display:none' : ''}">
          <label>Select Map</label>
          <select id="feltMapSelect">${mapOpts}</select>
        </div>
        <div id="feltNewMapField" class="felt-field" style="${hasMaps ? 'display:none' : ''}">
          <label>New Map Title</label>
          <input type="text" id="feltNewTitle" value="${_esc(defaultTitle)}" />
        </div>
        <div class="felt-field">
          <label>Layer Name</label>
          <input type="text" id="feltLayerName" value="${_esc(DISPLAY_NAME[_surveyTarget] || 'Survey Data')}" />
        </div>
      </div>
      <div class="felt-dialog-footer">
        <button class="felt-btn-cancel" id="feltBack">← Back</button>
        <button class="felt-btn-primary" id="feltUpload">Upload</button>
      </div>
    </div>`;

  _overlay.querySelector('#feltClose').addEventListener('click', _closeModal);
  _overlay.querySelector('#feltBack').addEventListener('click', _renderStep1);

  // Toggle existing/new map fields when radio changes
  _overlay.querySelectorAll('input[name="feltMapMode"]').forEach(r => {
    r.addEventListener('change', () => {
      const isNew = r.value === 'new';
      _overlay.querySelector('#feltExistingMapField').style.display = isNew ? 'none' : '';
      _overlay.querySelector('#feltNewMapField').style.display       = isNew ? ''     : 'none';
    });
  });

  _overlay.querySelector('#feltUpload').addEventListener('click', async () => {
    const uploadBtn = _overlay.querySelector('#feltUpload');
    const mode      = (_overlay.querySelector('input[name="feltMapMode"]:checked')?.value) ?? 'new';
    const layerName = (_overlay.querySelector('#feltLayerName')?.value || '').trim()
                    || (DISPLAY_NAME[_surveyTarget] || 'Survey Data');

    uploadBtn.disabled    = true;
    uploadBtn.textContent = 'Working…';

    try {
      let mapId, mapUrl = '';

      if (mode === 'new') {
        const title = (_overlay.querySelector('#feltNewTitle')?.value || '').trim() || defaultTitle;
        uploadBtn.textContent = 'Creating map…';
        const newMap = await _createMap(title, _selectedWorkspace || undefined);
        mapId  = newMap.id;
        mapUrl = newMap.url;
      } else {
        mapId = _overlay.querySelector('#feltMapSelect')?.value ?? '';
        if (!mapId) throw new Error('No map selected');
        mapUrl = _maps.find(m => m.id === mapId)?.url ?? '';
      }

      // ── Upload primary observations ──────────────────────────────────
      if (_surveyTarget === 'HABITAT') {
        // HABITAT-only upload: use the habitat GeoJSON as the single layer
        const habitatObj = JSON.parse(_habitatGeoJSONStr);
        const habitatErr = validateGeoJSON(habitatObj);
        if (habitatErr) throw new Error(`Habitat GeoJSON invalid: ${habitatErr}`);
        console.log('[FELT GEOJSON] habitat features:', habitatObj.features.length);
        console.log('[FELT GEOJSON] sample:', JSON.stringify(habitatObj.features[0]));
        uploadBtn.textContent = 'Uploading…';
        await executeFeltUpload(mapId, _apiKey, _habitatGeoJSONStr, layerName);
      } else {
        // Primary survey: upload observations layer, then habitat layer separately
        const primaryObj = JSON.parse(_primaryGeoJSONStr);
        const primaryErr = validateGeoJSON(primaryObj);
        if (primaryErr) throw new Error(`Primary GeoJSON invalid: ${primaryErr}`);
        console.log('[FELT GEOJSON] primary features:', primaryObj.features.length);
        console.log('[FELT GEOJSON] sample:', JSON.stringify(primaryObj.features[0]));
        uploadBtn.textContent = 'Uploading observations…';
        await executeFeltUpload(mapId, _apiKey, _primaryGeoJSONStr, layerName);
        console.log('[FELT] primary upload complete ✓');

        // ── Upload habitat layer separately (only if observations exist) ─
        if (_habitatCount > 0) {
          const habitatObj = JSON.parse(_habitatGeoJSONStr);
          if (habitatObj.features.length > 0) {
            const habitatLayerName = layerName + ' — Habitat';
            console.log('[FELT GEOJSON] habitat features:', habitatObj.features.length);
            uploadBtn.textContent = 'Uploading habitat data…';
            await executeFeltUpload(mapId, _apiKey, _habitatGeoJSONStr, habitatLayerName);
            console.log('[FELT] habitat upload complete ✓');
          }
        }
      }

      _closeModal();
      const feltMapUrl = mapUrl || `https://felt.com/map/${mapId}`;
      showToast(
        `Uploaded to Felt — <a href="${_esc(feltMapUrl)}" target="_blank" rel="noopener">Open map</a>`,
        'success',
        8000
      );
    } catch (err) {
      console.error('[felt.js] Upload error:', err);
      showToast(`Upload failed — ${err.message}`, 'error', 6000);
      uploadBtn.textContent = 'Upload';
      uploadBtn.disabled    = false;
    }
  });
}

// ── Felt API calls ─────────────────────────────────────────────────────────
function _authHeaders() {
  return {
    'Authorization': `Bearer ${_apiKey}`,
    'Content-Type':  'application/json'
  };
}

async function _fetchWorkspaces() {
  const res = await fetch(`${FELT_API}/projects`, { headers: _authHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const raw  = Array.isArray(data) ? data : (data.projects ?? data.data ?? []);
  return raw.map(p => ({ id: p.id, name: p.name ?? p.id }));
}

async function _fetchMaps(workspaceId) {
  if (!workspaceId) return [];
  const res = await fetch(`${FELT_API}/projects/${encodeURIComponent(workspaceId)}`, {
    headers: _authHeaders()
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const project = await res.json();
  return (project.maps ?? []).map(m => ({ id: m.id, title: m.title ?? m.id, url: m.url ?? '' }));
}

async function _createMap(title, workspaceId) {
  const res = await fetch(`${FELT_API}/maps`, {
    method:  'POST',
    headers: _authHeaders(),
    body:    JSON.stringify({ title })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  const newMap = await res.json();
  const mapId  = newMap.id;
  if (workspaceId) {
    await fetch(`${FELT_API}/maps/${mapId}/move`, {
      method:  'POST',
      headers: _authHeaders(),
      body:    JSON.stringify({ project_id: workspaceId })
    }).catch(() => undefined);
  }
  return { id: mapId, title: newMap.title ?? title, url: newMap.url ?? '' };
}

/**
 * Executes the Felt upload — translated directly from
 * GPS2026felt@d1d09a5/FeltService.ts and FELT/server.js.
 * Both sources agree on this exact flow.
 */
async function executeFeltUpload(mapId, apiKey, geojsonStr, layerName) {

  const fileName = layerName.replace(/[^a-z0-9_\-]/gi, '_') + '.geojson';

  console.log('[FELT UPLOAD] starting —', 'map:', mapId,
    'layer:', layerName, 'file:', fileName,
    'geojson chars:', geojsonStr.length);

  // ── Step 1: Request presigned S3 URL from Felt ──────────────────────────
  const feltRes = await fetch(
    `https://felt.com/api/v2/maps/${mapId}/upload`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: layerName })
    }
  );

  console.log('[FELT UPLOAD] step 1 status:', feltRes.status);

  if (!feltRes.ok) {
    const text = await feltRes.text();
    throw new Error(`Felt upload init failed (${feltRes.status}): ${text}`);
  }

  const presigned = await feltRes.json();
  console.log('[FELT UPLOAD] presigned response:', JSON.stringify(presigned));

  const { url, presigned_attributes } = presigned;

  if (!url || !presigned_attributes) {
    throw new Error(
      'Felt API did not return presigned upload details. ' +
      'Check API key permissions. Response: ' +
      JSON.stringify(presigned)
    );
  }

  // ── Step 2: POST file to S3 ──────────────────────────────────────────────
  // presigned_attributes fields MUST be appended before the file (AWS rule)
  const formData = new FormData();
  for (const [k, v] of Object.entries(presigned_attributes)) {
    // Felt's presigned key contains "${filename}" as a literal placeholder —
    // substitute it with the actual filename before sending to S3.
    const resolved = typeof v === 'string' ? v.replace('${filename}', fileName) : v;
    if (k === 'key') console.log('[FELT UPLOAD] resolved S3 key:', resolved);
    formData.append(k, resolved);
  }
  formData.append(
    'file',
    new Blob([geojsonStr], { type: 'application/octet-stream' }),
    fileName
  );

  console.log('[FELT UPLOAD] step 2 S3 url domain:',
    new URL(url).hostname);
  console.log('[FELT UPLOAD] formData keys:', [...formData.keys()]);

  const s3Res = await fetch(url, {
    method: 'POST',
    body: formData
    // NO Content-Type header — browser must set multipart boundary
  });

  console.log('[FELT UPLOAD] step 2 S3 status:', s3Res.status);

  if (s3Res.status !== 204) {
    const s3Body = await s3Res.text().catch(() => '');
    throw new Error(`S3 upload failed (${s3Res.status}): ${s3Body}`);
  }

  // Upload complete — no finish_upload step needed
  console.log('[FELT UPLOAD] complete ✓');
}

// ── Console test helper ───────────────────────────────────────────────────
// Upload a hardcoded single-point GeoJSON to isolate whether the issue is
// content vs. upload mechanics. Call from the browser console:
//   feltTestUpload('YOUR_MAP_ID')
window.feltTestUpload = async function feltTestUpload(mapId) {
  const apiKey = (localStorage.getItem('feltApiKey') || '').trim();
  if (!apiKey) { console.error('[FELT TEST] no API key in localStorage'); return; }
  if (!mapId)  { console.error('[FELT TEST] usage: feltTestUpload("<map_id>")'); return; }

  const minimalGeoJSON = JSON.stringify({
    type: 'FeatureCollection',
    features: [{
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [-63.5752, 44.6488]   // Halifax, NS — known valid lng,lat
      },
      properties: {
        NAME: 'Test Point',
        SURVEY_TYPE: 'TEST',
        COUNT: 1
      }
    }]
  });

  console.log('[FELT TEST] uploading minimal 1-point GeoJSON to map:', mapId);
  console.log('[FELT TEST] geojson:', minimalGeoJSON);
  try {
    await executeFeltUpload(mapId, apiKey, minimalGeoJSON, 'felt_test_minimal');
    console.log('[FELT TEST] ✅ Felt accepted the minimal GeoJSON — upload pipeline is fine, issue is in buildGeoJSON()');
  } catch (err) {
    console.error('[FELT TEST] ❌ Minimal GeoJSON rejected:', err.message);
    console.error('[FELT TEST] Issue is in the upload pipeline itself, NOT in buildGeoJSON()');
  }
};

// ── Public entry point ────────────────────────────────────────────────────
export function uploadToFelt(surveyTarget, onClose) {
  console.log('[FELT 1] uploadToFelt entry | surveyTarget:', surveyTarget);
  console.log('[FELT 2] observations | speciesMarkers:', speciesMarkers.length, '| moose:', mooseObservations.length, '| turtle:', turtleObservations.length, '| habitat:', habitatObservations.length);
  const obsCount = _getObsCount(surveyTarget);
  console.log('[FELT 3] obsCount for target:', obsCount);
  _apiKey = (localStorage.getItem('feltApiKey') || '').trim();
  console.log('[FELT 4] apiKey present:', !!_apiKey);
  if (!_apiKey) {
    showToast('No Felt API key. Add one in Settings.', 'error');
    return;
  }

  if (obsCount === 0) {
    showToast('No observations to upload.', 'error');
    return;
  }

  console.log('[Felt] surveyType:', surveyTarget, '| obs count:', obsCount, '| speciesMarkers.length:', speciesMarkers.length, '| array ref:', speciesMarkers);

  // Build GeoJSON now (synchronously) before any async modal interaction
  _primaryGeoJSONStr = _surveyTarget === 'HABITAT' ? '' : _buildPrimaryGeoJSON(surveyTarget);
  _habitatGeoJSONStr = buildHabitatGeoJSON();
  _habitatCount      = habitatObservations.length;
  _surveyTarget      = surveyTarget;

  const pCount = surveyTarget === 'HABITAT' ? 0 : JSON.parse(_primaryGeoJSONStr).features.length;
  const hCount = JSON.parse(_habitatGeoJSONStr).features.length;
  console.log('[FELT G] primary features:', pCount, '| habitat features:', hCount);
  _onClose           = onClose || null;
  _workspaces        = [];
  _selectedWorkspace = '';
  _maps              = [];

  console.log('[FELT 5] opening feltModal');
  console.log('[FELT 5] feltModal element:', document.getElementById('feltModal'));
  _openModal();
  _renderLoading('Loading workspaces…');

  _fetchWorkspaces()
    .then(ws => {
      _workspaces = ws;
      if (ws.length > 0) _selectedWorkspace = ws[0].id;
      console.log('[FELT 6] populating workspace select with', ws?.length, 'workspaces');
      _renderStep1();
    })
    .catch(err => {
      showToast(`Failed to fetch Felt workspaces — ${err.message}`, 'error');
      _closeModal();
    });
}

export function cancelFeltModal() {
  const uploadBtn = _overlay?.querySelector('#feltUpload');
  if (uploadBtn?.disabled) return;
  _closeModal();
}
window.cancelFeltModal = cancelFeltModal;
