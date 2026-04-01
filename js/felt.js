// js/felt.js — Felt GIS integration
// Ported from GPS2026felt/src/io/FeltService.ts and FeltExportDialog.ts

import { showToast } from './toast.js';
import {
  buildSpeciesGeoJSON, buildMooseGeoJSON,
  buildTurtleGeoJSON, buildHabitatGeoJSON
} from './export.js';
import { speciesMarkers, mooseObservations, turtleObservations, habitatObservations } from './storageData.js';

const FELT_API = 'https://felt.com/api/v2';

const DISPLAY_NAME = {
  BBS:     'BBS Survey',
  MOOSE:   'Wildlife Survey',
  TURTLE:  'Turtle Survey',
  HABITAT: 'Habitat Observations'
};

const SURVEY_EMOJI = { BBS: '🐦', MOOSE: '🦌', TURTLE: '🐢', HABITAT: '🌿' };

// ── Module-level state ────────────────────────────────────────────────────
let _overlay           = null;
let _geojsonStr        = '';
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
  if (target === 'HABITAT') return habitatObservations.length;
  return 0;
}

function _buildGeoJSON(target) {
  console.log('[FELT G] _buildGeoJSON target:', target);
  if (target === 'HABITAT') {
    const r = buildHabitatGeoJSON();
    console.log('[FELT G] habitat-only features:', JSON.parse(r).features.length);
    return r;
  }
  let primaryFeatures;
  if (target === 'BBS')         primaryFeatures = JSON.parse(buildSpeciesGeoJSON()).features;
  else if (target === 'MOOSE')  primaryFeatures = JSON.parse(buildMooseGeoJSON()).features;
  else if (target === 'TURTLE') primaryFeatures = JSON.parse(buildTurtleGeoJSON()).features;
  else return JSON.stringify({ type: 'FeatureCollection', features: [] });
  const habitatFeatures = JSON.parse(buildHabitatGeoJSON()).features;
  console.log('[FELT G] primary features:', primaryFeatures.length, '| habitat features:', habitatFeatures.length);
  return JSON.stringify({ type: 'FeatureCollection', features: [...primaryFeatures, ...habitatFeatures] }, null, 2);
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
}

function _closeModal() {
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

      uploadBtn.textContent = 'Uploading…';
      await _uploadGeoJSON(mapId, _geojsonStr, layerName, _surveyTarget);

      _closeModal();
      showToast(
        mapUrl
          ? `Uploaded to Felt — <a href="${_esc(mapUrl)}" target="_blank" rel="noopener">Open map</a>`
          : 'Uploaded to Felt successfully!',
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

async function _uploadGeoJSON(mapId, geojsonStr, layerName, surveyTarget) {
  const filename = `${surveyTarget}_OBS_${_todayString()}.geojson`;
  console.log('[FELT 5] _uploadGeoJSON mapId:', mapId, '| layerName:', layerName, '| filename:', filename, '| geojsonStr length:', geojsonStr.length);

  // Step A — upload init: POST flat object { name } — no id, no array
  console.log('[FELT 6] Step A — POST', `${FELT_API}/maps/${mapId}/upload`);
  const initRes = await fetch(`${FELT_API}/maps/${mapId}/upload`, {
    method:  'POST',
    headers: { ..._authHeaders(), 'Accept': '*/*' },
    body:    JSON.stringify({ name: layerName })
  });
  console.log('[FELT 7] Step A response status:', initRes.status);
  if (!initRes.ok) {
    const text = await initRes.text();
    throw new Error(`Upload init failed (HTTP ${initRes.status}): ${text}`);
  }
  const initData = await initRes.json();
  console.log('[FELT 8] full init response:', JSON.stringify(initData));
  const { layer_group_id, layer_id, url, presigned_attributes } = initData;
  console.log('[FELT 8] layer_group_id:', layer_group_id, '| layer_id:', layer_id, '| url domain:', url ? new URL(url).hostname : 'MISSING');
  console.log('[FELT 8] presigned keys:', presigned_attributes ? Object.keys(presigned_attributes) : 'MISSING');
  if (!url) throw new Error(`Felt API did not return presigned URL. Full response: ${JSON.stringify(initData)}`);

  // Step B — S3 multipart POST: presigned fields first, file last, no Content-Type header
  const formData = new FormData();
  Object.entries(presigned_attributes).forEach(([k, v]) =>
    formData.append(k, k === 'key' ? v.replace('${filename}', filename) : v)
  );
  formData.append('file', new Blob([geojsonStr], { type: 'application/json' }), filename);
  console.log('[FELT 9] Step B — S3 POST to:', url, '| FormData keys:', [...formData.keys()]);
  console.log('[FELT 9] GeoJSON:', geojsonStr);
  const s3Res = await fetch(url, { method: 'POST', body: formData });
  console.log('[FELT 10] Step B S3 response status:', s3Res.status);
  if (!s3Res.ok) {
    const body = await s3Res.text().catch(() => '(unreadable)');
    throw new Error(`S3 upload failed (HTTP ${s3Res.status}): ${body}`);
  }

  // Step C — finish_upload skipped: Felt processes the layer automatically via S3
  // event notifications triggered by x-amz-meta-feature-flags in the presigned upload.
  // Both /layers/{id}/finish_upload and /layer_groups/{id}/finish_upload return 404.
  console.log('[FELT 11] S3 upload complete — layer processing triggered automatically via S3 events | layer_group_id:', layer_group_id);
}

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
  _geojsonStr        = _buildGeoJSON(surveyTarget);
  _surveyTarget      = surveyTarget;
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
