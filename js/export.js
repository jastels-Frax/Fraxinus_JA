// js/export.js — Multi-survey CSV / GeoJSON / KML export

import { speciesMarkers, mooseObservations, turtleObservations, habitatObservations } from './storageData.js';

// ─── Utilities ────────────────────────────────────────────────────────────
function todayString() {
  const d  = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function triggerDownload(content, filename, mime) {
  if (window.webkit?.messageHandlers?.fileExport) {
    window.webkit.messageHandlers.fileExport.postMessage({ filename, mime, content });
    return;
  }
  const blob = new Blob([content], { type: mime });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function csvRow(vals) {
  return vals.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
}

// Replaces undefined property values with null and strips non-serializable objects
// (Leaflet LatLng, DOM nodes, functions) so JSON.stringify produces clean output.
function sanitizeProps(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null || v === '') { out[k] = null; continue; }
    if (typeof v === 'function') { out[k] = null; continue; }
    if (typeof v === 'object') {
      // Leaflet LatLng has lat + lng
      if ('lat' in v && 'lng' in v) { out[k] = null; continue; }
      // DOM nodes
      if (typeof v.nodeType === 'number') { out[k] = null; continue; }
      // Leaflet markers / layers have _leaflet_id
      if ('_leaflet_id' in v) { out[k] = null; continue; }
      // Arrays are fine (e.g. criteria list)
      if (!Array.isArray(v)) { out[k] = null; continue; }
    }
    out[k] = v;
  }
  return out;
}

// Converts user-entered numeric fields to Number or null.
// Prevents empty strings from reaching Felt as type-ambiguous values.
function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return isFinite(n) ? n : null;
}

// Converts an empty string to null, passes non-empty strings through unchanged.
// Prevents "" from reaching Felt as a type-ambiguous value in GeoJSON properties.
function strOrNull(v) {
  if (v === '' || v == null) return null;
  return String(v);
}

// Combines date + time into an ISO-like datetime string, or null if either is missing.
// Prevents bare HH:MM values reaching Felt, which rejects them as unparseable time types.
function dateTimeOrNull(date, time) {
  if (!date || !time) return null;
  return `${date}T${time}`;
}

// Works for both live observations (Leaflet marker) and snapshot observations (plain latlng).
// Handles all coordinate storage formats that may appear across survey types.
function getLoc(obs) {
  // Format 1: Leaflet LatLng or plain {lat, lng}  (primary storage format)
  if (obs.latlng != null) {
    const lat = obs.latlng.lat      ?? obs.latlng.latitude;
    const lng = obs.latlng.lng      ?? obs.latlng.longitude;
    if (isFinite(lat) && isFinite(lng)) return { lat, lng };
  }
  // Format 2: GeolocationCoordinates stored directly on obs {latitude, longitude}
  if (obs.latitude != null && obs.longitude != null) {
    const lat = obs.latitude,  lng = obs.longitude;
    if (isFinite(lat) && isFinite(lng)) return { lat, lng };
  }
  // Format 3: flat lat/lng stored directly on obs
  if (obs.lat != null && obs.lng != null) {
    if (isFinite(obs.lat) && isFinite(obs.lng)) return { lat: obs.lat, lng: obs.lng };
  }
  // Format 4: live Leaflet marker fallback
  if (obs.marker?.getLatLng) {
    const ml = obs.marker.getLatLng();
    if (isFinite(ml.lat) && isFinite(ml.lng)) return { lat: ml.lat, lng: ml.lng };
  }
  console.error('[getLoc] no valid coordinates found for obs:', JSON.stringify({
    latlng: obs.latlng, hasMarker: !!obs.marker, keys: Object.keys(obs)
  }));
  return null;
}

// ─── BBS Exports ──────────────────────────────────────────────────────────
export function exportSpeciesCSV() {
  const date    = todayString();
  const headers = [
    'PROJECT_ID','POINT_ID','OBSERVER','SURVEY_TYPE','SURVEY_LENGTH',
    'WIND','WIND_DIR','TEMP_C','PRECIP','SITE_HABITAT',
    'SURVEY_LAT','SURVEY_LNG',
    'SPECIES','COUNT','RANGE','BEARING','PASS_HT','FLIGHT_DIR',
    'NOTE','TIMESTAMP','BREEDING'
  ];
  const rows = [headers, ...speciesMarkers.map(m => [
    m.projectID, m.pointID, m.observer, m.surveyType, m.surveyLength,
    m.wind, m.windDir, m.tempC, m.precip, m.siteHabitat,
    m.surveyLat, m.surveyLng,
    m.code, m.count, m.range, m.bearing, m.passHt, m.flightDir,
    m.note, m.timestamp, m.breeding
  ])];
  const csv = rows.map(csvRow).join('\n');
  triggerDownload(csv, `BBS_OBS_${date}_csv.csv`, 'text/csv');
}

export function buildSpeciesGeoJSON() {
  console.log('[buildSpeciesGeoJSON] total obs:', speciesMarkers.length);
  speciesMarkers.slice(0, 3).forEach((m, i) => {
    const loc = getLoc(m);
    console.log(`[buildSpeciesGeoJSON] obs[${i}] getLoc:`, loc, '| latlng:', JSON.stringify(m.latlng));
  });
  const features = speciesMarkers.filter(m => getLoc(m)).map(m => {
    const { lat, lng } = getLoc(m);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: sanitizeProps({
        PROJECT_ID:    strOrNull(m.projectID),  POINT_ID:   strOrNull(m.pointID),
        OBSERVER:      strOrNull(m.observer),   SURVEY_TYPE: strOrNull(m.surveyType),
        SURVEY_LENGTH: numOrNull(m.surveyLength),
        WIND:          strOrNull(m.wind),       WIND_DIR:    strOrNull(m.windDir),
        TEMP_C:        numOrNull(m.tempC),      PRECIP:      strOrNull(m.precip),
        SITE_HABITAT:  strOrNull(m.siteHabitat),
        SURVEY_LAT:    numOrNull(m.surveyLat),  SURVEY_LNG:  numOrNull(m.surveyLng),
        SPECIES:       strOrNull(m.code),       COUNT:       m.count,
        RANGE:         m.range,                 BEARING:     m.bearing,
        PASS_HT:       strOrNull(m.passHt),     FLIGHT_DIR:  strOrNull(m.flightDir),
        NOTE:          strOrNull(m.note),       TIMESTAMP:   strOrNull(m.timestamp),
        BREEDING:      strOrNull(m.breeding)
      })
    };
  });
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

export function exportSpeciesGeoJSON() {
  triggerDownload(buildSpeciesGeoJSON(), `BBS_OBS_${todayString()}_geojson.geojson`, 'application/json');
}

export function exportSpeciesKML() {
  const date   = todayString();
  const marks  = speciesMarkers.filter(m => getLoc(m));
  const pmarks = marks.map(m => {
    const { lat, lng } = getLoc(m);
    return `
  <Placemark>
    <name>${m.code || 'Species'}</name>
    <description><![CDATA[
<b>Observer:</b> ${m.observer || ''}<br/>
<b>Species:</b> ${m.code || ''}<br/>
<b>Count:</b> ${m.count || ''}<br/>
<b>Breeding:</b> ${m.breeding || ''}<br/>
<b>Survey Type:</b> ${m.surveyType || ''}<br/>
<b>Survey Length:</b> ${m.surveyLength || ''}<br/>
<b>Wind:</b> ${m.wind || ''}<br/>
<b>Wind Dir:</b> ${m.windDir || ''}<br/>
<b>Temp:</b> ${m.tempC || ''}<br/>
<b>Precip:</b> ${m.precip || ''}<br/>
<b>Habitat:</b> ${m.siteHabitat || ''}<br/>
<b>Range:</b> ${m.range || ''}<br/>
<b>Bearing:</b> ${m.bearing || ''}<br/>
<b>Pass Ht:</b> ${m.passHt || ''}<br/>
<b>Flight Dir:</b> ${m.flightDir || ''}<br/>
<b>Note:</b> ${m.note || ''}<br/>
<b>Timestamp:</b> ${m.timestamp || ''}
    ]]></description>
    <Point><coordinates>${lng},${lat},0</coordinates></Point>
  </Placemark>`;
  }).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>BBS Observations</name>
${pmarks}
  </Document>
</kml>`;
  triggerDownload(kml, `BBS_OBS_${date}_kml.kml`, 'application/vnd.google-earth.kml+xml');
}

// ─── Moose Exports ────────────────────────────────────────────────────────
export function exportMooseCSV() {
  const date    = todayString();
  const headers = [
    'PROJECT_ID','TRANSECT_ID','OBSERVER','SURVEY_DATE','SURVEY_START','SURVEY_END',
    'VISIBILITY','SNOW_COVER','TEMP_C','WIND_SPEED',
    'SPECIES','OBSERVATION_TYPE','HABITAT','PHOTO_REF',
    'LAT','LNG','NOTE','OBS_TIMESTAMP'
  ];
  const rows = [headers, ...mooseObservations.map(o => [
    o.projectID, o.transectID, o.observer, o.surveyDate, o.startTime, o.endTime,
    o.visibility, o.snowCover, o.tempC, o.windSpeed,
    o.species, o.obsType, o.habitat, o.photoRef,
    o.latlng?.lat ?? '', o.latlng?.lng ?? '',
    o.note, o.timestamp
  ])];
  const csv = rows.map(csvRow).join('\n');
  triggerDownload(csv, `MOOSE_OBS_${date}_csv.csv`, 'text/csv');
}

export function buildMooseGeoJSON() {
  console.log('[buildMooseGeoJSON] total obs:', mooseObservations.length);
  mooseObservations.forEach((o, i) => {
    const loc = getLoc(o);
    console.log(`[buildMooseGeoJSON] obs[${i}] getLoc:`, loc, '| latlng stored as:', JSON.stringify(o.latlng));
  });
  const features = mooseObservations.filter(o => getLoc(o)).map(o => {
    const { lat, lng } = getLoc(o);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: sanitizeProps({
        PROJECT_ID:       strOrNull(o.projectID),  TRANSECT_ID:      strOrNull(o.transectID),
        OBSERVER:         strOrNull(o.observer),   SURVEY_DATE:      strOrNull(o.surveyDate),
        SURVEY_START:     dateTimeOrNull(o.surveyDate, o.startTime),
        SURVEY_END:       dateTimeOrNull(o.surveyDate, o.endTime),
        VISIBILITY:       strOrNull(o.visibility),
        SNOW_COVER:       numOrNull(o.snowCover),
        TEMP_C:           numOrNull(o.tempC),      WIND_SPEED:       numOrNull(o.windSpeed),
        SPECIES:          strOrNull(o.species),    OBSERVATION_TYPE: strOrNull(o.obsType),
        HABITAT:          strOrNull(o.habitat),    PHOTO_REF:        strOrNull(o.photoRef),
        NOTE:             strOrNull(o.note),       OBS_TIMESTAMP:    strOrNull(o.timestamp)
      })
    };
  });
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

export function exportMooseGeoJSON() {
  triggerDownload(buildMooseGeoJSON(), `MOOSE_OBS_${todayString()}_geojson.geojson`, 'application/json');
}

export function exportMooseKML() {
  const date  = todayString();
  const marks = mooseObservations.filter(o => getLoc(o));
  const pmarks = marks.map(o => {
    const { lat, lng } = getLoc(o);
    return `
  <Placemark>
    <name>${o.species || 'Wildlife'} — ${o.obsType || ''}</name>
    <description><![CDATA[
<b>Observer:</b> ${o.observer || ''}<br/>
<b>Transect:</b> ${o.transectID || ''}<br/>
<b>Species:</b> ${o.species || ''}<br/>
<b>Obs Type:</b> ${o.obsType || ''}<br/>
<b>Habitat:</b> ${o.habitat || ''}<br/>
<b>Snow Cover:</b> ${o.snowCover || ''}<br/>
<b>Visibility:</b> ${o.visibility || ''}<br/>
<b>Temp:</b> ${o.tempC || ''}<br/>
<b>Photo Ref:</b> ${o.photoRef || ''}<br/>
<b>Note:</b> ${o.note || ''}<br/>
<b>Timestamp:</b> ${o.timestamp || ''}
    ]]></description>
    <Point><coordinates>${lng},${lat},0</coordinates></Point>
  </Placemark>`;
  }).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>General Wildlife Survey Observations</name>
${pmarks}
  </Document>
</kml>`;
  triggerDownload(kml, `MOOSE_OBS_${date}_kml.kml`, 'application/vnd.google-earth.kml+xml');
}

// ─── Turtle Exports ───────────────────────────────────────────────────────
export function exportTurtleCSV() {
  const date    = todayString();
  const headers = [
    'PROJECT_ID','SITE_NAME','OBSERVER','SURVEY_DATE','SURVEY_START','SURVEY_END',
    'WATER_TEMP_C','AIR_TEMP_C','WATER_LEVEL','WEATHER',
    'SPECIES','SEX','AGE_CLASS','ACTIVITY','HABITAT',
    'PHOTO_ID','LAT','LNG','NOTE','OBS_TIMESTAMP'
  ];
  const rows = [headers, ...turtleObservations.map(o => [
    o.projectID, o.siteName, o.observer, o.surveyDate, o.startTime, o.endTime,
    o.waterTemp, o.airTemp, o.waterLevel, o.weather,
    o.species || '', o.sex, o.ageClass, o.activity, o.habitat,
    o.photoID,
    o.latlng?.lat ?? '', o.latlng?.lng ?? '',
    o.note, o.timestamp
  ])];
  const csv = rows.map(csvRow).join('\n');
  triggerDownload(csv, `TURTLE_OBS_${date}_csv.csv`, 'text/csv');
}

export function buildTurtleGeoJSON() {
  console.log('[buildTurtleGeoJSON] total obs:', turtleObservations.length);
  turtleObservations.forEach((o, i) => {
    const loc = getLoc(o);
    console.log(`[buildTurtleGeoJSON] obs[${i}] getLoc:`, loc, '| latlng stored as:', JSON.stringify(o.latlng));
  });
  const features = turtleObservations.filter(o => getLoc(o)).map(o => {
    const { lat, lng } = getLoc(o);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: sanitizeProps({
        PROJECT_ID:    strOrNull(o.projectID),  SITE_NAME:    strOrNull(o.siteName),
        OBSERVER:      strOrNull(o.observer),   SURVEY_DATE:  strOrNull(o.surveyDate),
        SURVEY_START:  dateTimeOrNull(o.surveyDate, o.startTime),
        SURVEY_END:    dateTimeOrNull(o.surveyDate, o.endTime),
        WATER_TEMP_C:  numOrNull(o.waterTemp),  AIR_TEMP_C:   numOrNull(o.airTemp),
        WATER_LEVEL:   strOrNull(o.waterLevel), WEATHER:      strOrNull(o.weather),
        SPECIES:       strOrNull(o.species),    SEX:          strOrNull(o.sex),
        AGE_CLASS:     strOrNull(o.ageClass),   ACTIVITY:     strOrNull(o.activity),
        HABITAT:       strOrNull(o.habitat),    PHOTO_ID:     strOrNull(o.photoID),
        NOTE:          strOrNull(o.note),       OBS_TIMESTAMP: strOrNull(o.timestamp)
      })
    };
  });
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

export function exportTurtleGeoJSON() {
  triggerDownload(buildTurtleGeoJSON(), `TURTLE_OBS_${todayString()}_geojson.geojson`, 'application/json');
}

export function exportTurtleKML() {
  const date  = todayString();
  const marks = turtleObservations.filter(o => getLoc(o));
  const pmarks = marks.map(o => {
    const { lat, lng } = getLoc(o);
    const sexAbbr = o.sex === 'Male' ? 'M' : o.sex === 'Female' ? 'F' : 'U';
    const name    = `${o.species || 'Turtle'} — ${sexAbbr}${o.activity ? ' · ' + o.activity : ''}`;
    return `
  <Placemark>
    <name>${name}</name>
    <description><![CDATA[
<b>Species:</b> ${o.species || ''}<br/>
<b>Observer:</b> ${o.observer || ''}<br/>
<b>Site:</b> ${o.siteName || ''}<br/>
<b>Sex:</b> ${o.sex || ''}<br/>
<b>Age Class:</b> ${o.ageClass || ''}<br/>
<b>Activity:</b> ${o.activity || ''}<br/>
<b>Habitat:</b> ${o.habitat || ''}<br/>
<b>Photo ID:</b> ${o.photoID || ''}<br/>
<b>Water Temp:</b> ${o.waterTemp || ''}<br/>
<b>Air Temp:</b> ${o.airTemp || ''}<br/>
<b>Water Level:</b> ${o.waterLevel || ''}<br/>
<b>Weather:</b> ${o.weather || ''}<br/>
<b>Note:</b> ${o.note || ''}<br/>
<b>Timestamp:</b> ${o.timestamp || ''}
    ]]></description>
    <Point><coordinates>${lng},${lat},0</coordinates></Point>
  </Placemark>`;
  }).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>Wood Turtle Observations</name>
${pmarks}
  </Document>
</kml>`;
  triggerDownload(kml, `TURTLE_OBS_${date}_kml.kml`, 'application/vnd.google-earth.kml+xml');
}

// ─── Habitat / Feature Exports ────────────────────────────────────────────
export function exportHabitatCSV() {
  const date    = todayString();
  const headers = [
    'SURVEY_TYPE','FEATURE_TYPE','CRITERIA_MET',
    'CONDITION','SIZE_EXTENT','PHOTO_REF',
    'PROJECT_ID','OBSERVER',
    // BBS-specific
    'POINT_ID','SURVEY_LENGTH','WIND','WIND_DIR',
    'TEMP_C','PRECIP','SITE_HABITAT','SURVEY_LAT','SURVEY_LNG',
    // Moose-specific
    'TRANSECT_ID','SURVEY_DATE','SURVEY_START','SURVEY_END',
    'VISIBILITY','SNOW_COVER','WIND_SPEED',
    // Turtle-specific
    'SITE_NAME','WATER_TEMP_C','AIR_TEMP_C',
    'WATER_LEVEL','WEATHER',
    // Common
    'LAT','LNG','NOTE','TIMESTAMP'
  ];
  const rows = [headers, ...habitatObservations.map(o => {
    const loc     = getLoc(o);
    const isBBS   = o.surveyType === 'BBS';
    const isMoose = o.surveyType === 'MOOSE';
    const isTurtle= o.surveyType === 'TURTLE';
    return [
      o.surveyType, o.featureType,
      (o.criteria || []).join(' | '),
      o.condition || '', o.size || '', o.photoRef || '',
      o.projectID  || '', o.observer || '',
      // BBS
      isBBS ? (o.pointID      || '') : '',
      isBBS ? (o.surveyLength || '') : '',
      isBBS ? (o.wind         || '') : '',
      isBBS ? (o.windDir      || '') : '',
      isBBS ? (o.tempC        || '') : '',
      isBBS ? (o.precip       || '') : '',
      isBBS ? (o.siteHabitat  || '') : '',
      isBBS ? (o.surveyLat    || '') : '',
      isBBS ? (o.surveyLng    || '') : '',
      // Moose
      isMoose ? (o.transectID || '') : '',
      (isMoose || isTurtle) ? (o.surveyDate || '') : '',
      (isMoose || isTurtle) ? (o.surveyDate && o.startTime ? `${o.surveyDate}T${o.startTime}` : '') : '',
      (isMoose || isTurtle) ? (o.surveyDate && o.endTime   ? `${o.surveyDate}T${o.endTime}`   : '') : '',
      isMoose ? (o.visibility || '') : '',
      isMoose ? (o.snowCover  || '') : '',
      isMoose ? (o.windSpeed  || '') : '',
      // Turtle
      isTurtle ? (o.siteName   || '') : '',
      isTurtle ? (o.waterTemp  || '') : '',
      isTurtle ? (o.airTemp    || '') : '',
      isTurtle ? (o.waterLevel || '') : '',
      isTurtle ? (o.weather    || '') : '',
      // Common
      loc ? loc.lat : '', loc ? loc.lng : '',
      o.note || '', o.timestamp || ''
    ];
  })];
  const csv = rows.map(csvRow).join('\n');
  triggerDownload(csv, `HABITAT_OBS_${date}_csv.csv`, 'text/csv');
}

export function buildHabitatGeoJSON() {
  const features = habitatObservations.filter(o => getLoc(o)).map(o => {
    const { lat, lng } = getLoc(o);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: sanitizeProps({
        SURVEY_TYPE:  strOrNull(o.surveyType),
        FEATURE_TYPE: strOrNull(o.featureType),
        CRITERIA_MET: (o.criteria || []).join(' | ') || null,
        CONDITION:    strOrNull(o.condition),
        SIZE_EXTENT:  strOrNull(o.size),
        PHOTO_REF:    strOrNull(o.photoRef),
        NOTE:         strOrNull(o.note),
        TIMESTAMP:    strOrNull(o.timestamp),
        ...(o.surveyType === 'BBS' ? {
          PROJECT_ID:    strOrNull(o.projectID),
          POINT_ID:      strOrNull(o.pointID),
          OBSERVER:      strOrNull(o.observer),
          SURVEY_LENGTH: numOrNull(o.surveyLength),
          WIND:          strOrNull(o.wind),
          WIND_DIR:      strOrNull(o.windDir),
          TEMP_C:        numOrNull(o.tempC),
          PRECIP:        strOrNull(o.precip),
          SITE_HABITAT:  strOrNull(o.siteHabitat),
          SURVEY_LAT:    numOrNull(o.surveyLat),
          SURVEY_LNG:    numOrNull(o.surveyLng)
        } : {}),
        ...(o.surveyType === 'MOOSE' ? {
          PROJECT_ID:   strOrNull(o.projectID),
          TRANSECT_ID:  strOrNull(o.transectID),
          OBSERVER:     strOrNull(o.observer),
          SURVEY_DATE:  strOrNull(o.surveyDate),
          SURVEY_START: dateTimeOrNull(o.surveyDate, o.startTime),
          SURVEY_END:   dateTimeOrNull(o.surveyDate, o.endTime),
          VISIBILITY:   strOrNull(o.visibility),
          SNOW_COVER:   numOrNull(o.snowCover),
          TEMP_C:       numOrNull(o.tempC),
          WIND_SPEED:   numOrNull(o.windSpeed)
        } : {}),
        ...(o.surveyType === 'TURTLE' ? {
          PROJECT_ID:   strOrNull(o.projectID),
          SITE_NAME:    strOrNull(o.siteName),
          OBSERVER:     strOrNull(o.observer),
          SURVEY_DATE:  strOrNull(o.surveyDate),
          SURVEY_START: dateTimeOrNull(o.surveyDate, o.startTime),
          SURVEY_END:   dateTimeOrNull(o.surveyDate, o.endTime),
          WATER_TEMP_C: numOrNull(o.waterTemp),
          AIR_TEMP_C:   numOrNull(o.airTemp),
          WATER_LEVEL:  strOrNull(o.waterLevel),
          WEATHER:      strOrNull(o.weather)
        } : {})
      })
    };
  });
  return JSON.stringify({ type: 'FeatureCollection', features }, null, 2);
}

export function exportHabitatGeoJSON() {
  triggerDownload(buildHabitatGeoJSON(), `HABITAT_OBS_${todayString()}_geojson.geojson`, 'application/json');
}

export function exportHabitatKML() {
  const date  = todayString();
  const marks = habitatObservations.filter(o => getLoc(o));
  const pmarks = marks.map(o => {
    const { lat, lng } = getLoc(o);
    return `
  <Placemark>
    <name>${o.featureType || 'Habitat Feature'}</name>
    <description><![CDATA[
<b>Survey:</b> ${o.surveyType || ''}<br/>
<b>Feature:</b> ${o.featureType || ''}<br/>
<b>Criteria Met:</b> ${(o.criteria || []).join(', ') || ''}<br/>
<b>Condition:</b> ${o.condition || ''}<br/>
<b>Size/Extent:</b> ${o.size || ''}<br/>
<b>Photo Ref:</b> ${o.photoRef || ''}<br/>
<b>Note:</b> ${o.note || ''}<br/>
<b>Timestamp:</b> ${o.timestamp || ''}
    ]]></description>
    <Point><coordinates>${lng},${lat},0</coordinates></Point>
  </Placemark>`;
  }).join('\n');
  const kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document><name>Habitat Feature Observations</name>
${pmarks}
  </Document>
</kml>`;
  triggerDownload(kml, `HABITAT_OBS_${date}_kml.kml`, 'application/vnd.google-earth.kml+xml');
}
