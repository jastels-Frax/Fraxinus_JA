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

// Works for both live observations (Leaflet marker) and snapshot observations (plain latlng).
function getLoc(obs) {
  if (obs.latlng?.lat != null) return obs.latlng;
  if (obs.marker?.getLatLng) return obs.marker.getLatLng();
  return null;
}

// ─── BBS Exports ──────────────────────────────────────────────────────────
export function exportSpeciesCSV() {
  const date    = todayString();
  const headers = [
    'PROJECT_ID','POINT_ID','OBSERVER','SURVEY_TYPE','SURVEY_LENGTH',
    'WIND','WIND_DIR','TEMP_C','PRECIP','SITE_HABITAT',
    'SPECIES','COUNT','RANGE','BEARING','PASS_HT','FLIGHT_DIR',
    'NOTE','TIMESTAMP','BREEDING'
  ];
  const rows = [headers, ...speciesMarkers.map(m => [
    m.projectID, m.pointID, m.observer, m.surveyType, m.surveyLength,
    m.wind, m.windDir, m.tempC, m.precip, m.siteHabitat,
    m.code, m.count, m.range, m.bearing, m.passHt, m.flightDir,
    m.note, m.timestamp, m.breeding
  ])];
  const csv = rows.map(csvRow).join('\n');
  triggerDownload(csv, `BBS_OBS_${date}_csv.csv`, 'text/csv');
}

export function exportSpeciesGeoJSON() {
  const date     = todayString();
  const features = speciesMarkers.filter(m => getLoc(m)).map(m => {
    const { lat, lng } = getLoc(m);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        PROJECT_ID: m.projectID, POINT_ID: m.pointID, OBSERVER: m.observer,
        SURVEY_TYPE: m.surveyType, SURVEY_LENGTH: m.surveyLength,
        WIND: m.wind, WIND_DIR: m.windDir, TEMP_C: m.tempC,
        PRECIP: m.precip, SITE_HABITAT: m.siteHabitat,
        SPECIES: m.code, COUNT: m.count, RANGE: m.range, BEARING: m.bearing,
        PASS_HT: m.passHt, FLIGHT_DIR: m.flightDir,
        NOTE: m.note, TIMESTAMP: m.timestamp, BREEDING: m.breeding
      }
    };
  });
  triggerDownload(
    JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    `BBS_OBS_${date}_geojson.geojson`, 'application/json'
  );
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
    'PROJECT_ID','TRANSECT_ID','OBSERVER','SURVEY_DATE','START_TIME','END_TIME',
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

export function exportMooseGeoJSON() {
  const date     = todayString();
  const features = mooseObservations.filter(o => getLoc(o)).map(o => {
    const { lat, lng } = getLoc(o);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        PROJECT_ID: o.projectID, TRANSECT_ID: o.transectID, OBSERVER: o.observer,
        SURVEY_DATE: o.surveyDate, START_TIME: o.startTime, END_TIME: o.endTime,
        VISIBILITY: o.visibility, SNOW_COVER: o.snowCover, TEMP_C: o.tempC, WIND_SPEED: o.windSpeed,
        SPECIES: o.species, OBSERVATION_TYPE: o.obsType, HABITAT: o.habitat,
        PHOTO_REF: o.photoRef, NOTE: o.note, OBS_TIMESTAMP: o.timestamp
      }
    };
  });
  triggerDownload(
    JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    `MOOSE_OBS_${date}_geojson.geojson`, 'application/json'
  );
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
    'PROJECT_ID','SITE_NAME','OBSERVER','SURVEY_DATE','START_TIME','END_TIME',
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

export function exportTurtleGeoJSON() {
  const date     = todayString();
  const features = turtleObservations.filter(o => getLoc(o)).map(o => {
    const { lat, lng } = getLoc(o);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        PROJECT_ID: o.projectID, SITE_NAME: o.siteName, OBSERVER: o.observer,
        SURVEY_DATE: o.surveyDate, START_TIME: o.startTime, END_TIME: o.endTime,
        WATER_TEMP_C: o.waterTemp, AIR_TEMP_C: o.airTemp,
        WATER_LEVEL: o.waterLevel, WEATHER: o.weather,
        SPECIES: o.species || '',
        SEX: o.sex, AGE_CLASS: o.ageClass, ACTIVITY: o.activity, HABITAT: o.habitat,
        PHOTO_ID: o.photoID, NOTE: o.note, OBS_TIMESTAMP: o.timestamp
      }
    };
  });
  triggerDownload(
    JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    `TURTLE_OBS_${date}_geojson.geojson`, 'application/json'
  );
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
    'SURVEY_TYPE','FEATURE_TYPE','CRITERIA_MET','CONDITION',
    'SIZE_EXTENT','PHOTO_REF','LAT','LNG','NOTE','TIMESTAMP'
  ];
  const rows = [headers, ...habitatObservations.map(o => [
    o.surveyType, o.featureType,
    (o.criteria || []).join(' | '),
    o.condition, o.size, o.photoRef,
    o.latlng?.lat ?? '', o.latlng?.lng ?? '',
    o.note, o.timestamp
  ])];
  const csv = rows.map(csvRow).join('\n');
  triggerDownload(csv, `HABITAT_OBS_${date}_csv.csv`, 'text/csv');
}

export function exportHabitatGeoJSON() {
  const date     = todayString();
  const features = habitatObservations.filter(o => getLoc(o)).map(o => {
    const { lat, lng } = getLoc(o);
    return {
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        SURVEY_TYPE:  o.surveyType,
        FEATURE_TYPE: o.featureType,
        CRITERIA_MET: (o.criteria || []).join(' | '),
        CONDITION:    o.condition,
        SIZE_EXTENT:  o.size,
        PHOTO_REF:    o.photoRef,
        NOTE:         o.note,
        TIMESTAMP:    o.timestamp
      }
    };
  });
  triggerDownload(
    JSON.stringify({ type: 'FeatureCollection', features }, null, 2),
    `HABITAT_OBS_${date}_geojson.geojson`, 'application/json'
  );
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
