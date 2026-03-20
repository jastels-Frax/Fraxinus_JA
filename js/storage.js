// js/storage.js — Multi-survey IndexedDB persistence

import { updateTable } from './ui.js';
import { map } from './map.js';
import { speciesMarkers, mooseObservations, turtleObservations, habitatObservations } from './storageData.js';
import { createSpeciesPopupHTML } from './species.js';
import { createMoosePopupHTML } from './moose.js';
import { createTurtlePopupHTML } from './turtle.js';
import { createHabitatPopupHTML } from './habitat.js';

const DB_NAME    = 'SpeciesSurveyDB';
const DB_VERSION = 5; // v5: ensure sessions store exists on all clients

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
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
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
    projectID:  o.projectID,
    siteName:   o.siteName,
    observer:   o.observer,
    surveyDate: o.surveyDate,
    startTime:  o.startTime,
    endTime:    o.endTime,
    waterTemp:  o.waterTemp,
    airTemp:    o.airTemp,
    waterLevel: o.waterLevel,
    weather:    o.weather,
    species:    o.species  || '',
    sex:        o.sex      || '',
    ageClass:   o.ageClass || '',
    activity:   o.activity || '',
    habitat:    o.habitat  || '',
    photoID:    o.photoID  || '',
    note:       o.note     || '',
    latlng:     { lat: o.latlng.lat, lng: o.latlng.lng },
    timestamp:  o.timestamp
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
      const labelText = data.activity ? `${sexAbbr} · ${data.activity}` : sexAbbr;
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

// ─── Session Records ──────────────────────────────────────────────────────
export async function saveSessionRecord(session) {
  if (!db) await openDatabase();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    const req   = store.put(session);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

export async function loadAllSessions() {
  if (!db) await openDatabase();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('sessions', 'readonly');
    const store = tx.objectStore('sessions');
    const req   = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = e => reject(e.target.error);
  });
}

export async function deleteSessionRecord(id) {
  if (!db) await openDatabase();
  return new Promise((resolve, reject) => {
    const tx    = db.transaction('sessions', 'readwrite');
    const store = tx.objectStore('sessions');
    const req   = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  });
}

// ─── Clear all 4 observation stores in parallel ───────────────────────────
export async function clearObservationStores() {
  if (!db) await openDatabase();
  const names = ['speciesMarkers', 'mooseObservations', 'turtleObservations', 'habitatObservations'];
  await Promise.all(names.map(name => new Promise((resolve, reject) => {
    const tx  = db.transaction(name, 'readwrite');
    const req = tx.objectStore(name).clear();
    req.onsuccess = () => resolve();
    req.onerror   = e => reject(e.target.error);
  })));
}

// ─── Restore a snapshot back into the 4 observation stores in parallel ────
export async function restoreSnapshot(snapshot) {
  if (!db) await openDatabase();
  const storeMap = {
    speciesMarkers:     snapshot.speciesMarkers     || [],
    mooseObservations:  snapshot.mooseObservations  || [],
    turtleObservations: snapshot.turtleObservations || [],
    habitatObservations:snapshot.habitatObservations|| []
  };
  await Promise.all(Object.entries(storeMap).map(([name, records]) => new Promise((resolve, reject) => {
    const tx    = db.transaction(name, 'readwrite');
    const store = tx.objectStore(name);
    store.clear();
    records.forEach(rec => { const { id, ...rest } = rec; store.add(rest); });
    tx.oncomplete = () => resolve();
    tx.onerror    = e => reject(e.target.error);
  })));
}

export { openDatabase };
