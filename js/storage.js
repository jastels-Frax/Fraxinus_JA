// js/storage.js — Multi-survey IndexedDB persistence

import { updateTable } from './ui.js';
import { map } from './map.js';
import { speciesMarkers, mooseObservations, turtleObservations, habitatObservations } from './storageData.js';
import { createSpeciesPopupHTML } from './species.js';
import { createMoosePopupHTML } from './moose.js';
import { createTurtlePopupHTML } from './turtle.js';
import { createHabitatPopupHTML } from './habitat.js';

const DB_NAME    = 'SpeciesSurveyDB';
const DB_VERSION = 3; // bumped to add habitatObservations store

let db;

// ─── Open / Upgrade DB ────────────────────────────────────────────────────
function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = e => {
      console.error('IndexedDB error:', e.target.error);
      reject(e.target.error);
    };
    request.onsuccess = e => {
      db = e.target.result;
      resolve();
    };
    request.onupgradeneeded = e => {
      db = e.target.result;
      if (!db.objectStoreNames.contains('speciesMarkers')) {
        db.createObjectStore('speciesMarkers', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('mooseObservations')) {
        db.createObjectStore('mooseObservations', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('turtleObservations')) {
        db.createObjectStore('turtleObservations', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('habitatObservations')) {
        db.createObjectStore('habitatObservations', { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

// ─── Generic sync helper ──────────────────────────────────────────────────
async function syncStore(storeName, records, serializer) {
  if (!db) await openDatabase();
  const tx = db.transaction(storeName, 'readwrite');
  const store = tx.objectStore(storeName);
  const clearReq = store.clear();
  clearReq.onsuccess = () => {
    records.forEach(r => store.add(serializer(r)));
  };
  clearReq.onerror = e => console.error(`Failed to clear ${storeName}:`, e.target.error);
}

// ─── BBS Species Markers ──────────────────────────────────────────────────
export function syncToIndexedDB() {
  if (!db) { openDatabase().then(() => syncToIndexedDB()); return; }
  syncStore('speciesMarkers', speciesMarkers, m => ({
    code:        m.code,
    name:        m.name,
    soci:        m.soci,
    latlng:      { lat: m.latlng.lat, lng: m.latlng.lng },
    observer:    m.observer,
    pointID:     m.pointID,
    projectID:   m.projectID,
    surveyType:  m.surveyType,
    surveyLength:m.surveyLength,
    wind:        m.wind,
    windDir:     m.windDir,
    tempC:       m.tempC,
    precip:      m.precip,
    siteHabitat: m.siteHabitat,
    count:       m.count,
    breeding:    m.breeding,
    note:        m.note,
    range:       m.range,
    bearing:     m.bearing,
    timestamp:   m.timestamp,
    passHt:      m.passHt  || '',
    flightDir:   m.flightDir || ''
  }));
}

export async function loadSpeciesMarkers() {
  if (!db) await openDatabase();
  const tx = db.transaction('speciesMarkers', 'readonly');
  const store = tx.objectStore('speciesMarkers');
  const request = store.getAll();
  request.onsuccess = () => {
    request.result.forEach((data, index) => {
      const latlng = L.latLng(data.latlng.lat, data.latlng.lng);
      const marker = L.circleMarker(latlng, {
        radius: 6,
        color: data.soci ? 'red' : 'green',
        fillColor: 'black',
        fillOpacity: 0.6,
        weight: 2
      }).addTo(map);
      const labelMarker = L.marker([latlng.lat, latlng.lng + 0.0001], {
        icon: L.divIcon({
          className: 'DBmarker-label',
          html: `${data.code} (${data.count})`,
          iconAnchor: [0, 10]
        })
      }).addTo(map);
      const popup = createSpeciesPopupHTML(
        index, data.code, data.count,
        data.breeding || '', data.note || '',
        data.passHt || '', data.flightDir || ''
      );
      marker.bindPopup(popup);
      speciesMarkers.push({ ...data, latlng, marker, label: labelMarker });
    });
    updateTable();
  };
  request.onerror = e => console.error('Error loading species markers:', e.target.error);
}

// ─── Moose Observations ───────────────────────────────────────────────────
export function syncMooseToIndexedDB() {
  if (!db) { openDatabase().then(() => syncMooseToIndexedDB()); return; }
  syncStore('mooseObservations', mooseObservations, o => ({
    projectID:    o.projectID,
    transectID:   o.transectID,
    observer:     o.observer,
    surveyDate:   o.surveyDate,
    startTime:    o.startTime,
    endTime:      o.endTime,
    visibility:   o.visibility,
    snowCover:    o.snowCover,
    tempC:        o.tempC,
    windSpeed:    o.windSpeed,
    species:      o.species,
    obsType:      o.obsType,
    habitat:      o.habitat,
    photoRef:     o.photoRef   || '',
    note:         o.note       || '',
    latlng:       { lat: o.latlng.lat, lng: o.latlng.lng },
    timestamp:    o.timestamp
  }));
}

export async function loadMooseObservations() {
  if (!db) await openDatabase();
  const tx = db.transaction('mooseObservations', 'readonly');
  const store = tx.objectStore('mooseObservations');
  const request = store.getAll();
  request.onsuccess = () => {
    request.result.forEach((data, index) => {
      const latlng = L.latLng(data.latlng.lat, data.latlng.lng);
      const marker = L.circleMarker(latlng, {
        radius: 6,
        color: 'darkorange',
        fillColor: 'black',
        fillOpacity: 0.6,
        weight: 2
      }).addTo(map);
      const labelText = `${data.species}, ${data.obsType}`;
      const labelMarker = L.marker([latlng.lat, latlng.lng + 0.0001], {
        icon: L.divIcon({
          className: 'DBmarker-label',
          html: labelText,
          iconAnchor: [0, 10]
        })
      }).addTo(map);
      const popup = createMoosePopupHTML(index, data);
      marker.bindPopup(popup);
      mooseObservations.push({ ...data, latlng, marker, label: labelMarker });
    });
    updateTable();
  };
  request.onerror = e => console.error('Error loading moose observations:', e.target.error);
}

// ─── Turtle Observations ──────────────────────────────────────────────────
export function syncTurtleToIndexedDB() {
  if (!db) { openDatabase().then(() => syncTurtleToIndexedDB()); return; }
  syncStore('turtleObservations', turtleObservations, o => ({
    projectID:      o.projectID,
    siteName:       o.siteName,
    observer:       o.observer,
    surveyDate:     o.surveyDate,
    startTime:      o.startTime,
    endTime:        o.endTime,
    waterTemp:      o.waterTemp,
    airTemp:        o.airTemp,
    waterLevel:     o.waterLevel,
    weather:        o.weather,
    obsType:        o.obsType,
    activity:       o.activity       || '',
    habitat:        o.habitat        || '',
    sex:            o.sex            || '',
    ageClass:       o.ageClass       || '',
    carapaceLength: o.carapaceLength || '',
    condition:      o.condition      || '',
    basking:        o.basking        || '',
    substrate:      o.substrate      || '',
    photoID:        o.photoID        || '',
    note:           o.note           || '',
    latlng:         { lat: o.latlng.lat, lng: o.latlng.lng },
    timestamp:      o.timestamp
  }));
}

export async function loadTurtleObservations() {
  if (!db) await openDatabase();
  const tx = db.transaction('turtleObservations', 'readonly');
  const store = tx.objectStore('turtleObservations');
  const request = store.getAll();
  request.onsuccess = () => {
    request.result.forEach((data, index) => {
      const latlng = L.latLng(data.latlng.lat, data.latlng.lng);
      const marker = L.circleMarker(latlng, {
        radius: 6,
        color: 'darkgreen',
        fillColor: 'black',
        fillOpacity: 0.6,
        weight: 2
      }).addTo(map);
      const sexAbbr = data.sex === 'Male' ? 'M' : data.sex === 'Female' ? 'F' : 'U';
      const labelText = data.obsType === 'Direct Species Observation'
        ? `${sexAbbr} ${data.carapaceLength || '?'}mm`
        : (data.activity || data.obsType);
      const labelMarker = L.marker([latlng.lat, latlng.lng + 0.0001], {
        icon: L.divIcon({
          className: 'DBmarker-label',
          html: labelText,
          iconAnchor: [0, 10]
        })
      }).addTo(map);
      const popup = createTurtlePopupHTML(index, data);
      marker.bindPopup(popup);
      turtleObservations.push({ ...data, latlng, marker, label: labelMarker });
    });
    updateTable();
  };
  request.onerror = e => console.error('Error loading turtle observations:', e.target.error);
}

// ─── Habitat Observations ─────────────────────────────────────────────────
export function syncHabitatToIndexedDB() {
  if (!db) { openDatabase().then(() => syncHabitatToIndexedDB()); return; }
  syncStore('habitatObservations', habitatObservations, o => ({
    surveyType:  o.surveyType,
    featureType: o.featureType,
    criteria:    o.criteria     || [],
    condition:   o.condition    || '',
    size:        o.size         || '',
    photoRef:    o.photoRef     || '',
    note:        o.note         || '',
    latlng:      { lat: o.latlng.lat, lng: o.latlng.lng },
    timestamp:   o.timestamp
  }));
}

export async function loadHabitatObservations() {
  if (!db) await openDatabase();
  const tx    = db.transaction('habitatObservations', 'readonly');
  const store = tx.objectStore('habitatObservations');
  const req   = store.getAll();
  req.onsuccess = () => {
    const MARKER_COLOUR = { BBS: '#7c3aed', MOOSE: '#b45309', TURTLE: '#0d9488' };
    req.result.forEach((data, index) => {
      const latlng = L.latLng(data.latlng.lat, data.latlng.lng);
      const colour = MARKER_COLOUR[data.surveyType] || '#7c3aed';
      const marker = L.circleMarker(latlng, {
        radius: 8, color: colour,
        fillColor: 'white', fillOpacity: 0.75,
        weight: 2, dashArray: '6 3'
      }).addTo(map);
      const labelMarker = L.marker([latlng.lat, latlng.lng + 0.0001], {
        icon: L.divIcon({
          className: 'DBmarker-label',
          html: `🌿 ${data.featureType}`,
          iconAnchor: [0, 10]
        })
      }).addTo(map);
      const popup = createHabitatPopupHTML(index, data);
      marker.bindPopup(popup);
      habitatObservations.push({ ...data, latlng, marker, label: labelMarker });
    });
    updateTable();
  };
  req.onerror = e => console.error('Error loading habitat observations:', e.target.error);
}

export { openDatabase };
