// js/map.js — Leaflet map initialisation, geolocation, overlay
// initializeMap() is called by main.js AFTER survey type is selected.

import { loadSpeciesMarkers, loadMooseObservations, loadTurtleObservations, loadHabitatObservations } from './storage.js';
import { speciesMarkers } from './storageData.js';
import { updateTable, openSurveyModal, openDrawer } from './ui.js';
import { showSpeciesModal, isPlacingPoint } from './modal.js';
import { activeSurvey } from './surveyGlobals.js';
import { stampOffload } from './export.js';

// ─── Shared map state ─────────────────────────────────────────────────────
export let map              = null;
export let observerLocation = null;

let userLocationMarker = null;
let userAccuracyCircle = null;
let overlayGroup       = null;
let geoWatchId         = null;
let _autoFollow        = false;

// Counts how many overlays/modals are currently open.  The map stays locked
// until every caller has released its lock, preventing an early unlock when
// multiple panels are stacked (e.g. instructions opened while drawer is open).
let _lockCount = 0;

// ─── Main Initialiser ─────────────────────────────────────────────────────
export function initializeMap() {
  map = L.map('map', { zoomControl: false });
  // Default view (Nova Scotia) so tiles render before GPS locks
  map.setView([44.65, -63.57], 8);
  map.doubleClickZoom.disable();

  // Ensure Leaflet recalculates after the container becomes visible
  requestAnimationFrame(() => { map && map.invalidateSize(); });

  // Base layers
  const osm       = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  ).addTo(map);
  // Layer switcher top-right, zoom control directly below it
  L.control.layers({ OSM: osm, Satellite: satellite }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Map click → BBS modal only; Moose/Turtle use the geotag button instead
  map.on('click', e => {
    if (activeSurvey === 'BBS' && !isPlacingPoint()) showSpeciesModal(e.latlng);
  });

  // Live geolocation
  geoWatchId = navigator.geolocation.watchPosition(
    position => {
      const latlng   = [position.coords.latitude, position.coords.longitude];
      const accuracy = position.coords.accuracy;
      observerLocation = L.latLng(latlng);
      const _badge = document.getElementById('gpsAccuracyBadge');
      if (_badge) {
        _badge.textContent = `\u00b1${Math.round(accuracy)}m`;
        _badge.style.display = '';
        _badge.style.color = accuracy <= 10 ? '#4caf50' : accuracy <= 30 ? '#ffc107' : '#e57373';
        _badge.title = accuracy > 30 ? 'Low accuracy \u2014 move to open sky' : '';
      }

      if (userLocationMarker) {
        userLocationMarker.setLatLng(latlng);
        userAccuracyCircle.setLatLng(latlng).setRadius(accuracy);
        if (_autoFollow) map.setView(latlng, map.getZoom());
      } else {
        userLocationMarker = L.circleMarker(latlng, {
          radius: 6, color: '#00f', fillColor: 'white', fillOpacity: 1, weight: 1
        }).addTo(map);
        userAccuracyCircle = L.circle(latlng, {
          radius: accuracy, color: '#00f', fillColor: '#00f', fillOpacity: 0.2, weight: 1
        }).addTo(map);
        map.setView(latlng, 17);
      }
    },
    err => console.error('Geolocation error:', err),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 10000 }
  );

  // Master buttons
  addMasterButtons();

  // Load stored data for the active survey
  const survey = activeSurvey;
  if (survey === 'BBS') {
    loadSpeciesMarkers();
  } else if (survey === 'MOOSE') {
    loadMooseObservations();
  } else if (survey === 'TURTLE') {
    loadTurtleObservations();
  }
  loadHabitatObservations();
}

// ─── Master Buttons ───────────────────────────────────────────────────────
function addMasterButtons() {
  const container = document.getElementById('masterButton');
  if (!container) return;

  const survey = activeSurvey;

  // Per-survey species emoji and label
  const speciesEmoji = survey === 'BBS' ? '🐦' : survey === 'MOOSE' ? '🦌' : '🐢';
  const speciesTitle = survey === 'BBS'   ? 'Record Bird Species (or tap map)'
                     : survey === 'MOOSE' ? 'Record Wildlife Species Observation'
                     :                      'Record Turtle Observation';

  container.innerHTML = `
    <button onclick="goBackToSelection()" title="Back to Survey Selection"><i class="fas fa-arrow-left fa-2x"></i></button>
    <button onclick="showInstructions()" title="Help"><i class="fas fa-circle-question fa-2x"></i></button>
    <button id="btnSurvey" title="Survey Metadata"><i class="fas fa-clipboard-list fa-2x"></i></button>
    <button id="btnDrawer" title="Observations"><i class="fas fa-rectangle-list fa-2x"></i></button>
    ${survey === 'BBS' ? `<button id="btnOverlay" title="Distance/Bearing Overlay"><i class="fas fa-life-ring fa-2x"></i></button>` : ''}
    <button id="btnSpecies" title="${speciesTitle}" class="btn-survey-icon">${speciesEmoji}</button>
    <button id="btnHabitat" title="Record Habitat / Feature Observation" class="btn-survey-icon">🌿</button>
    <button id="btnGPS"    title="GPS Auto-Follow" class="btn-session-action"><i class="fas fa-location-crosshairs"></i></button>
    <div id="gpsAccuracyBadge" style="display:none; font-size:0.7rem; text-align:center; font-weight:600; padding:2px 6px; border-radius:4px; background:rgba(0,0,0,0.55); min-width:52px;"></div>
    <button id="btnDraft"  title="Save to Drafts"  class="btn-session-action">💾</button>
    <button id="btnSubmit" title="Save and Submit" class="btn-session-action">✅</button>
  `;
  container.style.cssText = `
    position:absolute; top:16px; left:16px; z-index:2000;
    display:flex; flex-direction:column; gap:12px;
  `;

  document.getElementById('btnSurvey')?.addEventListener('click', openSurveyModal);
  document.getElementById('btnDrawer')?.addEventListener('click', openDrawer);
  document.getElementById('btnDraft')?.addEventListener('click', () => {
    window.saveDraftAndGoHome?.();
    if (activeSurvey) stampOffload(activeSurvey);
  });
  document.getElementById('btnSubmit')?.addEventListener('click', () => {
    window.submitAndShowExport?.();
    if (activeSurvey) stampOffload(activeSurvey);
  });
  if (survey === 'BBS') {
    document.getElementById('btnOverlay')?.addEventListener('click', toggleOverlay);
  }

  // Species button
  document.getElementById('btnSpecies')?.addEventListener('click', () => {
    if (survey === 'BBS') {
      if (!isPlacingPoint()) showSpeciesModal(observerLocation || map.getCenter());
    } else {
      if (!observerLocation) {
        alert('GPS location not yet available. Please wait for a location fix.');
        return;
      }
      if (survey === 'MOOSE') {
        import('./moose.js').then(m => { if (!m.isMoosePlacingPoint()) m.showMooseModal(observerLocation); });
      } else if (survey === 'TURTLE') {
        import('./turtle.js').then(m => { if (!m.isTurtlePlacingPoint()) m.showTurtleModal(observerLocation); });
      }
    }
  });

  // GPS auto-follow toggle
  document.getElementById('btnGPS')?.addEventListener('click', () => {
    _autoFollow = !_autoFollow;
    document.getElementById('btnGPS')?.classList.toggle('gps-follow-active', _autoFollow);
    if (_autoFollow && observerLocation && map) map.setView(observerLocation, map.getZoom());
  });

  // Habitat button (all surveys — uses GPS if available, map centre as fallback)
  document.getElementById('btnHabitat')?.addEventListener('click', () => {
    const loc = observerLocation || map.getCenter();
    import('./habitat.js').then(m => {
      if (!m.isHabitatPlacingPoint()) m.showHabitatModal(loc);
    });
  });
}

// ─── Map interaction lock (used while any modal/overlay is open) ──────────
export function lockMap() {
  _lockCount++;
  if (!map || _lockCount > 1) return;   // already locked — just bump the counter
  map.dragging.disable();
  map.touchZoom.disable();
  map.scrollWheelZoom.disable();
  document.getElementById('masterButton')?.classList.add('ui-locked');
}

export function unlockMap() {
  _lockCount = Math.max(0, _lockCount - 1);
  if (!map || _lockCount > 0) return;   // other overlays still open
  map.dragging.enable();
  map.touchZoom.enable();
  map.scrollWheelZoom.enable();
  document.getElementById('masterButton')?.classList.remove('ui-locked');
}

// ─── Destroy map (called when returning to survey selection) ──────────────
export function destroyMap() {
  if (geoWatchId != null) { navigator.geolocation.clearWatch(geoWatchId); geoWatchId = null; }
  if (map) { map.remove(); map = null; }
  _lockCount = 0;
  _autoFollow = false;
  observerLocation = null;
  userLocationMarker = null;
  userAccuracyCircle = null;
  overlayGroup = null;
  const container = document.getElementById('masterButton');
  if (container) container.innerHTML = '';
}

// ─── Distance/Bearing Overlay ─────────────────────────────────────────────
function destinationPoint(latlng, bearing, distance) {
  const R  = 6378137;
  const δ  = distance / R;
  const θ  = bearing * Math.PI / 180;
  const φ1 = latlng.lat * Math.PI / 180;
  const λ1 = latlng.lng * Math.PI / 180;
  const φ2 = Math.asin(
    Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ)
  );
  const λ2 = λ1 + Math.atan2(
    Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
    Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2)
  );
  return L.latLng(φ2 * 180 / Math.PI, λ2 * 180 / Math.PI);
}

function toggleOverlay() {
  if (overlayGroup) {
    map.removeLayer(overlayGroup);
    overlayGroup = null;
    return;
  }
  if (!observerLocation) return;

  const center = observerLocation;
  overlayGroup = L.layerGroup();

  [50, 100, 150, 200].forEach(radius => {
    L.circle(center, { radius, color: 'red', dashArray: '5', weight: 2, fillOpacity: 0 })
      .addTo(overlayGroup);
    const labelPos = destinationPoint(center, 0, radius);
    L.marker(labelPos, {
      icon: L.divIcon({ className: 'circle-label', html: `<span>${radius} m</span>`, iconAnchor: [0, 0] })
    }).addTo(overlayGroup);
  });

  [0, 45, 90, 135, 180, 225, 270, 315].forEach(angle => {
    L.polyline([center, destinationPoint(center, angle, 200)], {
      color: 'yellow', dashArray: '5', weight: 0.5
    }).addTo(overlayGroup);
  });

  const dirs = { N: 0, E: 90, S: 180, W: 270 };
  for (const [txt, angle] of Object.entries(dirs)) {
    L.marker(destinationPoint(center, angle, 215), {
      icon: L.divIcon({ className: 'target-label', html: txt })
    }).addTo(overlayGroup);
  }

  overlayGroup.addTo(map);
}

window.toggleOverlay = toggleOverlay;
