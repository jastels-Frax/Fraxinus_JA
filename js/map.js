// js/map.js — Leaflet map initialisation, geolocation, overlay
// initializeMap() is called by main.js AFTER survey type is selected.

import { loadSpeciesMarkers, loadMooseObservations, loadTurtleObservations, loadHabitatObservations } from './storage.js';
import { speciesMarkers } from './storageData.js';
import { updateTable, openSurveyModal, openDrawer } from './ui.js';
import { showSpeciesModal, isPlacingPoint } from './modal.js';
import { activeSurvey } from './surveyGlobals.js';

// ─── Shared map state ─────────────────────────────────────────────────────
export let map              = null;
export let observerLocation = null;

let userLocationMarker = null;
let userAccuracyCircle = null;
let overlayGroup       = null;

// ─── Main Initialiser ─────────────────────────────────────────────────────
export function initializeMap() {
  map = L.map('map');
  map.doubleClickZoom.disable();

  // Base layers
  const osm       = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png');
  const satellite = L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  ).addTo(map);
  L.control.layers({ OSM: osm, Satellite: satellite }).addTo(map);

  // Map click → BBS modal only; Moose/Turtle use the geotag button instead
  map.on('click', e => {
    if (activeSurvey === 'BBS' && !isPlacingPoint()) showSpeciesModal(e.latlng);
  });

  // Live geolocation
  navigator.geolocation.watchPosition(
    position => {
      const latlng   = [position.coords.latitude, position.coords.longitude];
      const accuracy = position.coords.accuracy;
      observerLocation = L.latLng(latlng);

      if (userLocationMarker) {
        userLocationMarker.setLatLng(latlng);
        userAccuracyCircle.setLatLng(latlng).setRadius(accuracy);
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
    <button onclick="showInstructions()" title="Help"><i class="fas fa-circle-question fa-2x"></i></button>
    <button id="btnSurvey" title="Survey Metadata"><i class="fas fa-clipboard-list fa-2x"></i></button>
    <button id="btnDrawer" title="Observations"><i class="fas fa-rectangle-list fa-2x"></i></button>
    ${survey === 'BBS' ? `<button id="btnOverlay" title="Distance/Bearing Overlay"><i class="fas fa-life-ring fa-2x"></i></button>` : ''}
    <button id="btnSpecies" title="${speciesTitle}" class="btn-survey-icon">${speciesEmoji}</button>
    <button id="btnHabitat" title="Record Habitat / Feature Observation" class="btn-survey-icon">🌿</button>
  `;
  container.style.cssText = `
    position:absolute; top:100px; left:30px; z-index:2000;
    display:flex; flex-direction:column; gap:12px;
  `;

  document.getElementById('btnSurvey')?.addEventListener('click', openSurveyModal);
  document.getElementById('btnDrawer')?.addEventListener('click', openDrawer);
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

  // Habitat button (all surveys — always uses GPS location)
  document.getElementById('btnHabitat')?.addEventListener('click', () => {
    if (!observerLocation) {
      alert('GPS location not yet available. Please wait for a location fix.');
      return;
    }
    import('./habitat.js').then(m => {
      if (!m.isHabitatPlacingPoint()) m.showHabitatModal(observerLocation);
    });
  });
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
