// js/ui.js — Multi-survey UI: drawer, survey modal, table, timer

import {
  exportSpeciesCSV, exportSpeciesGeoJSON, exportSpeciesKML,
  exportMooseCSV,   exportMooseGeoJSON,   exportMooseKML,
  exportTurtleCSV,  exportTurtleGeoJSON,  exportTurtleKML,
  exportHabitatCSV, exportHabitatGeoJSON, exportHabitatKML
} from './export.js';
import { uploadToFelt } from './felt.js';
import { map, lockMap, unlockMap } from './map.js';
import { speciesMarkers, mooseObservations, turtleObservations, habitatObservations } from './storageData.js';
import { syncToIndexedDB, syncMooseToIndexedDB, syncTurtleToIndexedDB } from './storage.js';
import {
  activeSurvey,
  projectID, pointID, observer, surveyType, surveyLength,
  wind, windDir, tempC, precip, siteHabitat, surveyLat, surveyLng, setSurveyMetadata,
  mooseProjectID, mooseObserver, mooseTransectID, mooseSurveyDate,
  mooseStartTime, mooseEndTime, mooseVisibility, mooseSnowCover,
  mooseTempC, mooseWindSpeed, mooseNotes, setMooseMetadata,
  turtleProjectID, turtleObserver, turtleSiteName, turtleSurveyDate,
  turtleStartTime, turtleEndTime, turtleWaterTemp, turtleAirTemp,
  turtleWaterLevel, turtleWeather, turtleNotes, setTurtleMetadata
} from './surveyGlobals.js';

// ─── Drawer ───────────────────────────────────────────────────────────────
export function openDrawer() {
  updateTable();
  document.getElementById('dataDrawer').style.display = 'block';
  document.getElementById('modalBackdrop').style.display = 'block';
  lockMap();
}

export function closeDrawer() {
  document.getElementById('dataDrawer').style.display = 'none';
  document.getElementById('modalBackdrop').style.display = 'none';
  unlockMap();
}

// ─── Survey Metadata Modal ────────────────────────────────────────────────
export function openSurveyModal() {
  injectSurveyModal(); // rebuild for current survey type
  const modal    = document.getElementById('surveyModal');
  const backdrop = document.getElementById('modalBackdrop');
  if (!modal || !backdrop) return;
  prefillSurveyModal();
  modal.style.display    = 'block';
  backdrop.style.display = 'block';
  lockMap();
}

export function closeSurveyModal() {
  const survey = activeSurvey;
  if (survey === 'BBS') {
    const newSurveyLat = _val('surveyLatInput');
    const newSurveyLng = _val('surveyLngInput');
    if (!newSurveyLat || !newSurveyLng) {
      alert('Please capture a GPS location before saving the survey metadata.');
      return;
    }
    setSurveyMetadata({
      projectID:   _val('projectIDInput'),
      observer:    _val('observerInput'),
      pointID:     _val('pointIDInput'),
      surveyType:  'Breeding Bird Survey',
      surveyLength:_val('surveyLengthInput'),
      wind:        _val('windInput'),
      windDir:     _val('windDirInput'),
      tempC:       _val('tempCInput'),
      precip:      _val('precipInput'),
      siteHabitat: _val('siteHabitatInput'),
      surveyLat:   newSurveyLat,
      surveyLng:   newSurveyLng
    });
  } else if (survey === 'MOOSE') {
    const snap = {
      mooseProjectID:    _val('mooseProjectIDInput'),
      mooseObserver:     _val('mooseObserverInput'),
      mooseTransectID:   _val('mooseTransectIDInput'),
      mooseSurveyDate:   _val('mooseSurveyDateInput'),
      mooseStartTime:    _val('mooseStartTimeInput'),
      mooseEndTime:      _val('mooseEndTimeInput'),
      mooseVisibility:   _val('mooseVisibilityInput'),
      mooseSnowCover:    _val('mooseSnowCoverInput'),
      mooseTempC:        _val('mooseTempCInput'),
      mooseWindSpeed:    _val('mooseWindSpeedInput'),
      mooseNotes:        _val('mooseNotesInput')
    };
    setMooseMetadata(snap);
  } else if (survey === 'TURTLE') {
    const snap = {
      turtleProjectID:  _val('turtleProjectIDInput'),
      turtleObserver:   _val('turtleObserverInput'),
      turtleSiteName:   _val('turtleSiteNameInput'),
      turtleSurveyDate: _val('turtleSurveyDateInput'),
      turtleStartTime:  _val('turtleStartTimeInput'),
      turtleEndTime:    _val('turtleEndTimeInput'),
      turtleWaterTemp:  _val('turtleWaterTempInput'),
      turtleAirTemp:    _val('turtleAirTempInput'),
      turtleWaterLevel: _val('turtleWaterLevelInput'),
      turtleWeather:    _val('turtleWeatherInput'),
      turtleNotes:      _val('turtleNotesInput')
    };
    setTurtleMetadata(snap);
  }
  document.getElementById('surveyModal').style.display = 'none';
  document.getElementById('modalBackdrop').style.display = 'none';
  unlockMap();
}

function _val(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

// ─── Survey Modal Injection ───────────────────────────────────────────────
export function injectSurveyModal() {
  const container = document.getElementById('surveyModal');
  if (!container) return;

  const survey = activeSurvey;

  if (survey === 'BBS') {
    container.innerHTML = `
      <div class="modal-content">
        <h2>Survey Metadata — Breeding Bird Survey</h2>
        <label>Project ID:</label>
        <input type="text" id="projectIDInput" />
        <label>Observer:</label>
        <input type="text" id="observerInput" />
        <label>Survey Point ID:</label>
        <input type="text" id="pointIDInput" />
        <label>Survey Location: <span style="color:red;">*</span></label>
        <div style="display:flex; gap:6px; align-items:center;">
          <input type="text" id="surveyLocationDisplay" readonly placeholder="No GPS fix yet…" style="flex:1;" />
          <button type="button" id="getSurveyGPSBtn" onclick="getSurveyGPS()" style="background:#333333; border:1px solid #d6d6d6; color:#ffffff; border-radius:8px; padding:5px 10px;">Get GPS</button>
        </div>
        <input type="hidden" id="surveyLatInput" />
        <input type="hidden" id="surveyLngInput" />
        <label>Survey Length (min):</label>
        <input type="number" id="surveyLengthInput" />
        <label>Wind Speed:</label>
        <input type="text" id="windInput" />
        <label>Wind Direction:</label>
        <input type="text" id="windDirInput" />
        <label>Temperature (°C):</label>
        <input type="number" id="tempCInput" />
        <label>Precipitation:</label>
        <input type="text" id="precipInput" />
        <label>Site Habitat:</label>
        <input type="text" id="siteHabitatInput" />
        <br/>
        <button onclick="closeSurveyModal()">Save and Close</button>
      </div>`;
  } else if (survey === 'MOOSE') {
    container.innerHTML = `
      <div class="modal-content">
        <h2>Survey Metadata — General Wildlife Survey</h2>
        <label>Project ID:</label>
        <input type="text" id="mooseProjectIDInput" />
        <label>Observer:</label>
        <input type="text" id="mooseObserverInput" />
        <label>Transect ID:</label>
        <input type="text" id="mooseTransectIDInput" />
        <label>Survey Date:</label>
        <input type="date" id="mooseSurveyDateInput" />
        <label>Start Time:</label>
        <input type="time" id="mooseStartTimeInput" />
        <label>End Time:</label>
        <input type="time" id="mooseEndTimeInput" />
        <label>Visibility:</label>
        <select id="mooseVisibilityInput">
          <option value="">-- Select --</option>
          <option value="Good">Good</option>
          <option value="Moderate">Moderate</option>
          <option value="Poor">Poor</option>
        </select>
        <label>Snow Cover (%):</label>
        <input type="number" id="mooseSnowCoverInput" min="0" max="100" />
        <label>Temperature (°C):</label>
        <input type="number" id="mooseTempCInput" />
        <label>Wind Speed:</label>
        <input type="text" id="mooseWindSpeedInput" placeholder="Beaufort scale or km/h" />
        <label>Notes:</label>
        <textarea id="mooseNotesInput" rows="3"></textarea>
        <br/>
        <button onclick="closeSurveyModal()">Save and Close</button>
      </div>`;
  } else if (survey === 'TURTLE') {
    container.innerHTML = `
      <div class="modal-content">
        <h2>Survey Metadata — Wood Turtle Survey</h2>
        <label>Project ID:</label>
        <input type="text" id="turtleProjectIDInput" />
        <label>Observer:</label>
        <input type="text" id="turtleObserverInput" />
        <label>Site Name / Stream Reach ID:</label>
        <input type="text" id="turtleSiteNameInput" />
        <label>Survey Date:</label>
        <input type="date" id="turtleSurveyDateInput" />
        <label>Start Time:</label>
        <input type="time" id="turtleStartTimeInput" />
        <label>End Time:</label>
        <input type="time" id="turtleEndTimeInput" />
        <label>Water Temperature (°C):</label>
        <input type="number" id="turtleWaterTempInput" step="0.1" />
        <label>Air Temperature (°C):</label>
        <input type="number" id="turtleAirTempInput" step="0.1" />
        <label>Water Level:</label>
        <select id="turtleWaterLevelInput">
          <option value="">-- Select --</option>
          <option value="Low">Low</option>
          <option value="Normal">Normal</option>
          <option value="High">High</option>
          <option value="Flood">Flood</option>
        </select>
        <label>Weather:</label>
        <select id="turtleWeatherInput">
          <option value="">-- Select --</option>
          <option value="Sunny">Sunny</option>
          <option value="Partly Cloudy">Partly Cloudy</option>
          <option value="Overcast">Overcast</option>
          <option value="Rainy">Rainy</option>
        </select>
        <label>Notes:</label>
        <textarea id="turtleNotesInput" rows="3"></textarea>
        <br/>
        <button onclick="closeSurveyModal()">Save and Close</button>
      </div>`;
  } else {
    container.innerHTML = `
      <div class="modal-content">
        <h2>Survey Metadata</h2>
        <p>No survey selected.</p>
        <button onclick="closeSurveyModal()">Close</button>
      </div>`;
  }
}

function prefillSurveyModal() {
  const survey = activeSurvey;
  if (survey === 'BBS') {
    _setVal('projectIDInput',   projectID);
    _setVal('observerInput',    observer);
    _setVal('pointIDInput',     pointID);
    _setVal('surveyLengthInput',surveyLength);
    _setVal('windInput',        wind);
    _setVal('windDirInput',     windDir);
    _setVal('tempCInput',       tempC);
    _setVal('precipInput',      precip);
    _setVal('siteHabitatInput', siteHabitat);
    if (surveyLat && surveyLng) {
      _setVal('surveyLatInput',        surveyLat);
      _setVal('surveyLngInput',        surveyLng);
      _setVal('surveyLocationDisplay', `${parseFloat(surveyLat).toFixed(6)}, ${parseFloat(surveyLng).toFixed(6)}`);
    }
  } else if (survey === 'MOOSE') {
    _setVal('mooseProjectIDInput',    mooseProjectID);
    _setVal('mooseObserverInput',     mooseObserver);
    _setVal('mooseTransectIDInput',   mooseTransectID);
    _setVal('mooseSurveyDateInput',   mooseSurveyDate);
    _setVal('mooseStartTimeInput',    mooseStartTime);
    _setVal('mooseEndTimeInput',      mooseEndTime);
    _setVal('mooseVisibilityInput',   mooseVisibility);
    _setVal('mooseSnowCoverInput',    mooseSnowCover);
    _setVal('mooseTempCInput',        mooseTempC);
    _setVal('mooseWindSpeedInput',    mooseWindSpeed);
    _setVal('mooseNotesInput',        mooseNotes);
  } else if (survey === 'TURTLE') {
    _setVal('turtleProjectIDInput',  turtleProjectID);
    _setVal('turtleObserverInput',   turtleObserver);
    _setVal('turtleSiteNameInput',   turtleSiteName);
    _setVal('turtleSurveyDateInput', turtleSurveyDate);
    _setVal('turtleStartTimeInput',  turtleStartTime);
    _setVal('turtleEndTimeInput',    turtleEndTime);
    _setVal('turtleWaterTempInput',  turtleWaterTemp);
    _setVal('turtleAirTempInput',    turtleAirTemp);
    _setVal('turtleWaterLevelInput', turtleWaterLevel);
    _setVal('turtleWeatherInput',    turtleWeather);
    _setVal('turtleNotesInput',      turtleNotes);
  }
}

function _setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val || '';
}

// ─── Table Renderer ───────────────────────────────────────────────────────
export function updateTable() {
  const drawer = document.getElementById('dataDrawer');
  if (!drawer) return;

  const survey = activeSurvey;

  if (survey === 'BBS') {
    _renderBBSTable(drawer);
  } else if (survey === 'MOOSE') {
    _renderMooseTable(drawer);
  } else if (survey === 'TURTLE') {
    _renderTurtleTable(drawer);
  } else {
    drawer.innerHTML = '<div style="padding:12px; color:#aaa;">No survey active.</div>';
  }
}

function _renderBBSTable(drawer) {
  drawer.innerHTML = `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="closeDrawer()">✕ Close</button>
          <button onclick="exportSpeciesCSV()">CSV</button>
          <button onclick="exportSpeciesGeoJSON()">GeoJSON</button>
          <button onclick="exportSpeciesKML()">KML</button>
          <button class="felt-export-btn" onclick="uploadToFelt('BBS')">↑ Felt</button>
        </div>
      </div>
      <h2 style="margin-top:0;">Breeding Bird Survey Observations</h2>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Project ID</th><th>Point ID</th><th>Observer</th>
            <th>Survey Type</th><th>Survey Length</th><th>Wind</th>
            <th>Wind Dir</th><th>Temp °C</th><th>Precip</th>
            <th>Site Habitat</th><th>Survey Location</th>
            <th>Species</th><th>Count</th>
            <th>Range</th><th>Bearing</th><th>Pass Ht</th>
            <th>Flight Dir</th><th>Note</th><th>Timestamp</th>
            <th>Breeding</th><th>Actions</th>
          </tr></thead>
          <tbody id="obsTableBody"></tbody>
        </table>
      </div>
    </div>`;
  const tbody = document.getElementById('obsTableBody');
  speciesMarkers.forEach((obs, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${obs.projectID||''}</td><td>${obs.pointID||''}</td>
      <td>${obs.observer||''}</td><td>${obs.surveyType||''}</td>
      <td>${obs.surveyLength||''}</td><td>${obs.wind||''}</td>
      <td>${obs.windDir||''}</td><td>${obs.tempC||''}</td>
      <td>${obs.precip||''}</td><td>${obs.siteHabitat||''}</td>
      <td>${obs.surveyLat && obs.surveyLng
        ? parseFloat(obs.surveyLat).toFixed(4) + ', ' + parseFloat(obs.surveyLng).toFixed(4)
        : ''}</td>
      <td>${obs.code||''}</td><td>${obs.count||''}</td>
      <td>${obs.range||''}</td><td>${obs.bearing||''}</td>
      <td>${obs.passHt||''}</td><td>${obs.flightDir||''}</td>
      <td>${obs.note||''}</td><td>${obs.timestamp||''}</td>
      <td>${obs.breeding||''}</td>
      <td>
        <button onclick="zoomToMarker(${i})">🔍</button>
        <button onclick="deleteMarker(${i})" style="color:red;">❌</button>
      </td>`;
    tbody.appendChild(tr);
  });
  _appendHabitatSection(drawer);
}

function _renderMooseTable(drawer) {
  drawer.innerHTML = `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="closeDrawer()">✕ Close</button>
          <button onclick="exportMooseCSV()">CSV</button>
          <button onclick="exportMooseGeoJSON()">GeoJSON</button>
          <button onclick="exportMooseKML()">KML</button>
          <button class="felt-export-btn" onclick="uploadToFelt('MOOSE')">↑ Felt</button>
        </div>
      </div>
      <h2 style="margin-top:0;">General Wildlife Survey Observations</h2>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Project ID</th><th>Transect ID</th><th>Observer</th>
            <th>Survey Date</th><th>Start Time</th><th>End Time</th>
            <th>Visibility</th><th>Snow Cover</th><th>Temp °C</th>
            <th>Wind Speed</th><th>Species</th><th>Obs. Type</th>
            <th>Habitat</th><th>Photo Ref</th><th>Note</th>
            <th>Timestamp</th><th>Actions</th>
          </tr></thead>
          <tbody id="obsTableBody"></tbody>
        </table>
      </div>
    </div>`;
  const tbody = document.getElementById('obsTableBody');
  mooseObservations.forEach((obs, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${obs.projectID||''}</td><td>${obs.transectID||''}</td>
      <td>${obs.observer||''}</td><td>${obs.surveyDate||''}</td>
      <td>${obs.startTime||''}</td><td>${obs.endTime||''}</td>
      <td>${obs.visibility||''}</td><td>${obs.snowCover||''}</td>
      <td>${obs.tempC||''}</td><td>${obs.windSpeed||''}</td>
      <td>${obs.species||''}</td><td>${obs.obsType||''}</td>
      <td>${obs.habitat||''}</td><td>${obs.photoRef||''}</td>
      <td>${obs.note||''}</td><td>${obs.timestamp||''}</td>
      <td>
        <button onclick="zoomToMooseMarker(${i})">🔍</button>
        <button onclick="deleteMooseMarker(${i})" style="color:red;">❌</button>
      </td>`;
    tbody.appendChild(tr);
  });
  _appendHabitatSection(drawer);
}

function _renderTurtleTable(drawer) {
  drawer.innerHTML = `
    <div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          <button onclick="closeDrawer()">✕ Close</button>
          <button onclick="exportTurtleCSV()">CSV</button>
          <button onclick="exportTurtleGeoJSON()">GeoJSON</button>
          <button onclick="exportTurtleKML()">KML</button>
          <button class="felt-export-btn" onclick="uploadToFelt('TURTLE')">↑ Felt</button>
        </div>
      </div>
      <h2 style="margin-top:0;">Wood Turtle Survey Observations</h2>
      <div style="overflow-x:auto;">
        <table>
          <thead><tr>
            <th>Project ID</th><th>Site Name</th><th>Observer</th>
            <th>Survey Date</th><th>Start Time</th><th>End Time</th>
            <th>Water Temp °C</th><th>Air Temp °C</th>
            <th>Water Level</th><th>Weather</th>
            <th>Species</th><th>Sex</th><th>Age Class</th>
            <th>Activity</th><th>Habitat</th><th>Photo ID</th>
            <th>Note</th><th>Timestamp</th><th>Actions</th>
          </tr></thead>
          <tbody id="obsTableBody"></tbody>
        </table>
      </div>
    </div>`;
  const tbody = document.getElementById('obsTableBody');
  turtleObservations.forEach((obs, i) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${obs.projectID||''}</td><td>${obs.siteName||''}</td>
      <td>${obs.observer||''}</td><td>${obs.surveyDate||''}</td>
      <td>${obs.startTime||''}</td><td>${obs.endTime||''}</td>
      <td>${obs.waterTemp||''}</td><td>${obs.airTemp||''}</td>
      <td>${obs.waterLevel||''}</td><td>${obs.weather||''}</td>
      <td>${obs.species||''}</td><td>${obs.sex||''}</td>
      <td>${obs.ageClass||''}</td><td>${obs.activity||''}</td>
      <td>${obs.habitat||''}</td><td>${obs.photoID||''}</td>
      <td>${obs.note||''}</td><td>${obs.timestamp||''}</td>
      <td>
        <button onclick="zoomToTurtleMarker(${i})">🔍</button>
        <button onclick="deleteTurtleMarker(${i})" style="color:red;">❌</button>
      </td>`;
    tbody.appendChild(tr);
  });
  _appendHabitatSection(drawer);
}

// ─── Habitat Observations Section (appended to every survey's drawer) ─────
function _appendHabitatSection(drawer) {
  if (!habitatObservations.length) return;
  const section = document.createElement('div');
  section.style.marginTop = '24px';
  section.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
      <h2 style="margin:0;">🌿 Habitat / Feature Observations</h2>
      <div style="display:flex; gap:8px; flex-wrap:wrap;">
        <button onclick="exportHabitatCSV()">Habitat CSV</button>
        <button onclick="exportHabitatGeoJSON()">Habitat GeoJSON</button>
        <button onclick="exportHabitatKML()">Habitat KML</button>
        <button class="felt-export-btn" onclick="uploadToFelt('HABITAT')">↑ Habitat Felt</button>
      </div>
    </div>
    <div style="overflow-x:auto;">
      <table>
        <thead><tr>
          <th>Survey Type</th><th>Project ID</th><th>Survey ID</th>
          <th>Observer</th><th>Feature Type</th><th>Criteria Met</th>
          <th>Condition</th><th>Photo Ref</th>
          <th>Note</th><th>Timestamp</th><th>Actions</th>
        </tr></thead>
        <tbody id="habitatTableBody"></tbody>
      </table>
    </div>`;
  drawer.appendChild(section);
  const tbody = section.querySelector('#habitatTableBody');
  habitatObservations.forEach((obs, i) => {
    const sid = obs.pointID || obs.transectID || obs.siteName || '';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${obs.surveyType  ||''}</td>
      <td>${obs.projectID   ||''}</td>
      <td>${sid}</td>
      <td>${obs.observer    ||''}</td>
      <td>${obs.featureType ||''}</td>
      <td>${(obs.criteria||[]).join(', ')||''}</td>
      <td>${obs.condition   ||''}</td>
      <td>${obs.photoRef    ||''}</td>
      <td>${obs.note        ||''}</td>
      <td>${obs.timestamp   ||''}</td>
      <td>
        <button onclick="zoomToHabitatMarker(${i})">🔍</button>
        <button onclick="deleteHabitatMarker(${i})" style="color:red;">❌</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ─── Map Actions ──────────────────────────────────────────────────────────
export function zoomToMarker(index) {
  const obs = speciesMarkers[index];
  if (obs?.latlng) { map.setView(obs.latlng, 18); obs.marker.openPopup(); }
}

export function zoomToMooseMarker(index) {
  const obs = mooseObservations[index];
  if (obs?.latlng) { map.setView(obs.latlng, 18); obs.marker.openPopup(); }
}

export function zoomToTurtleMarker(index) {
  const obs = turtleObservations[index];
  if (obs?.latlng) { map.setView(obs.latlng, 18); obs.marker.openPopup(); }
}

export function zoomToHabitatMarker(index) {
  const obs = habitatObservations[index];
  if (obs?.latlng) { map.setView(obs.latlng, 18); obs.marker.openPopup(); }
}
window.zoomToHabitatMarker = zoomToHabitatMarker;

export function deleteMarker(index) {
  const obs = speciesMarkers[index];
  if (!obs) return;
  if (obs.marker) map.removeLayer(obs.marker);
  if (obs.label)  map.removeLayer(obs.label);
  speciesMarkers.splice(index, 1);
  syncToIndexedDB();
  updateTable();
}

// ─── Survey Timer ─────────────────────────────────────────────────────────
let surveyTotalSeconds     = 0;
let surveyRemainingSeconds = 0;
let surveyTimerInterval    = null;

function updateSurveyTimerDisplay() {
  const mins = Math.floor(surveyRemainingSeconds / 60).toString().padStart(2, '0');
  const secs = (surveyRemainingSeconds % 60).toString().padStart(2, '0');
  const el   = document.getElementById('timerDisplay');
  if (el) el.textContent = `${mins}:${secs}`;
}

function startSurveyTimer() {
  if (!surveyTimerInterval) {
    const minsInput = parseInt(document.getElementById('surveyLength')?.value || '10', 10);
    if (surveyRemainingSeconds === 0 || minsInput * 60 !== surveyTotalSeconds) {
      surveyTotalSeconds     = minsInput * 60;
      surveyRemainingSeconds = surveyTotalSeconds;
    }
    surveyTimerInterval = setInterval(() => {
      if (surveyRemainingSeconds > 0) {
        surveyRemainingSeconds--;
        updateSurveyTimerDisplay();
      } else {
        clearInterval(surveyTimerInterval);
        surveyTimerInterval = null;
        alert('Survey complete!');
      }
    }, 1000);
  }
}

function pauseSurveyTimer() {
  clearInterval(surveyTimerInterval);
  surveyTimerInterval = null;
}

function resetSurveyTimer() {
  pauseSurveyTimer();
  const minsInput        = parseInt(document.getElementById('surveyLength')?.value || '10', 10);
  surveyTotalSeconds     = minsInput * 60;
  surveyRemainingSeconds = surveyTotalSeconds;
  updateSurveyTimerDisplay();
}

export function initTimerBindings() {
  const startBtn = document.getElementById('startTimerBtn');
  const pauseBtn = document.getElementById('pauseTimerBtn');
  const resetBtn = document.getElementById('resetTimerBtn');
  if (startBtn) startBtn.addEventListener('click', startSurveyTimer);
  if (pauseBtn) pauseBtn.addEventListener('click', pauseSurveyTimer);
  if (resetBtn) resetBtn.addEventListener('click', resetSurveyTimer);
  resetSurveyTimer();
}

// ─── BBS Survey GPS Capture ───────────────────────────────────────────────
window.getSurveyGPS = function () {
  if (!navigator.geolocation) {
    alert('Geolocation is not supported by this browser.');
    return;
  }
  const btn = document.getElementById('getSurveyGPSBtn');
  if (btn) btn.textContent = 'Locating…';
  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      _setVal('surveyLatInput',        lat);
      _setVal('surveyLngInput',        lng);
      _setVal('surveyLocationDisplay', `${lat}, ${lng}`);
      if (btn) btn.textContent = 'Get GPS';
    },
    err => {
      alert('GPS error: ' + err.message);
      if (btn) btn.textContent = 'Get GPS';
    },
    { enableHighAccuracy: true, timeout: 15000 }
  );
};

// ─── Global Bindings ──────────────────────────────────────────────────────
window.closeSurveyModal      = closeSurveyModal;
window.closeDrawer           = closeDrawer;
window.openSurveyModal       = openSurveyModal;
window.zoomToMarker          = zoomToMarker;
window.zoomToMooseMarker     = zoomToMooseMarker;
window.zoomToTurtleMarker    = zoomToTurtleMarker;
window.deleteMarker          = deleteMarker;
window.exportSpeciesCSV      = exportSpeciesCSV;
window.exportSpeciesGeoJSON  = exportSpeciesGeoJSON;
window.exportSpeciesKML      = exportSpeciesKML;
window.exportMooseCSV        = exportMooseCSV;
window.exportMooseGeoJSON    = exportMooseGeoJSON;
window.exportMooseKML        = exportMooseKML;
window.exportTurtleCSV       = exportTurtleCSV;
window.exportTurtleGeoJSON   = exportTurtleGeoJSON;
window.exportTurtleKML       = exportTurtleKML;
window.exportHabitatCSV      = exportHabitatCSV;
window.exportHabitatGeoJSON  = exportHabitatGeoJSON;
window.exportHabitatKML      = exportHabitatKML;
window.uploadToFelt          = uploadToFelt;
