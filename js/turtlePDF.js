// js/turtlePDF.js — Wood Turtle Survey PDF report: interactive editor before print

import { turtleObservations, habitatObservations } from './storageData.js';
import {
  turtleProjectID, turtleObserver, turtleSiteName, turtleSurveyDate,
  turtleStartTime, turtleEndTime, turtleWaterTemp, turtleAirTemp,
  turtleWaterLevel, turtleWeather, turtleNotes
} from './surveyGlobals.js';

const ACTIVITY_COLOUR = {
  Basking: '#E69138', Moving: '#4caf50', Nesting: '#CC0000',
  Swimming: '#0f7abf', Captured: '#9b59b6'
};

// ─── Preset text library ──────────────────────────────────────────────────────
const PRESETS = {
  intro: {
    'SARA Schedule 1 — Baseline Survey':
      'This Wood Turtle (<em>Glyptemys insculpta</em>) survey was conducted as a baseline assessment in support of project planning and environmental impact evaluation. <em>Glyptemys insculpta</em> is assessed as Threatened by the Committee on the Status of Endangered Wildlife in Canada (COSEWIC) and is listed on Schedule 1 of the <em>Species at Risk Act</em> (SARA). The survey was designed to detect the presence of Wood Turtles and characterize habitat use within the study reach to inform project-specific impact assessment and mitigation planning.',
    'Mitigation / Project-Impact Survey':
      'This Wood Turtle (<em>Glyptemys insculpta</em>) survey was conducted to assess potential project-related impacts on a documented or suspected Wood Turtle population within the study reach. <em>Glyptemys insculpta</em> is listed as Threatened under Schedule 1 of the <em>Species at Risk Act</em> (SARA) and is subject to prohibitions against killing, harming, harassing, capturing, or taking individuals without a permit. The survey results will be used to support required regulatory consultations and to develop species-specific mitigation measures.',
    'Long-Term Population Monitoring':
      'This survey is part of a long-term Wood Turtle (<em>Glyptemys insculpta</em>) population monitoring program established to track population trends, demographic parameters, and habitat use over time. As a COSEWIC Threatened species listed on Schedule 1 of the <em>Species at Risk Act</em> (SARA), long-term monitoring data for <em>Glyptemys insculpta</em> are essential for evaluating recovery progress and informing adaptive management decisions.',
    'Restoration Effectiveness Survey':
      'This Wood Turtle (<em>Glyptemys insculpta</em>) survey was conducted to evaluate the effectiveness of habitat restoration measures implemented within the study reach. Restoration objectives targeted key habitat features known to support <em>Glyptemys insculpta</em>, including riparian buffer enhancement, gravel bar creation, and the removal of barriers to movement. This survey documents population response to restoration activities and provides data to assess recovery trajectory.',
  },
  methods: {
    'Standard Riparian Pedestrian Sweep':
      'The survey was conducted using standard riparian pedestrian sweep methods. The surveyor walked both banks of the watercourse systematically, inspecting all habitat features known to be used by Wood Turtles, including basking sites, gravel bars, emergent shorelines, and upland nesting areas. All turtles detected were approached carefully; individuals accessible on land were captured for morphometric data collection where applicable. All observations were recorded with GPS coordinates, activity, sex, age class, habitat association, and photo documentation.',
    'Aquatic Search Protocol':
      'The aquatic search protocol combined wading transects and visual scanning from the bank to detect Wood Turtles in aquatic habitats. The surveyor waded systematically along sections of the watercourse at depths permitting safe access, visually scanning the substrate for turtles resting on the bottom or moving through the water column. Sections too deep for wading were visually scanned from the bank using binoculars. All detections were recorded with GPS coordinates, activity, and individual identification data where possible.',
    'Nesting Area Survey':
      'This survey focused on known or suspected Wood Turtle nesting areas within the study reach, including sandy or gravelly upland sites adjacent to the watercourse. The surveyor searched for nesting females, nest scrapes, and egg shells indicative of hatching or predation. Observations were conducted during the peak nesting period to maximize detection probability. All nesting activity detected was recorded with GPS coordinates, individual identification, and documentation of nest condition.',
    'Multi-Reach Systematic Survey':
      'The survey was conducted along multiple stream reaches within the study area using systematic pedestrian methods. Each reach was walked in its entirety by the surveyor, covering both banks and accessible aquatic habitat. Search effort was documented as survey distance per reach to allow standardization of detection rates across reaches and survey years. All Wood Turtle detections were recorded with GPS coordinates, reach identifier, habitat type, activity, sex, and age class.',
  },
  findings: {
    'No Turtles Detected':
      'No Wood Turtles were detected during the survey. The study reach was searched in its entirety under conditions suitable for Wood Turtle detection. The absence of detections does not conclusively indicate the absence of Wood Turtles from the reach; detection probability varies with season, weather, water temperature, and observer experience. The habitat assessment confirmed the presence of [describe habitat features] within the reach that may support Wood Turtles.',
    'Turtles Detected — Incidental':
      'A small number of Wood Turtle detections were recorded during the survey, representing incidental observations rather than evidence of an established population centre within the study reach. The detections indicate that Wood Turtles use or transit the reach; the distribution and density of observations does not suggest that the reach functions as a primary population core. Further survey effort is recommended to characterize population status more fully.',
    'Turtles Detected — Active Population':
      'Wood Turtles were detected throughout the survey reach, including individuals of multiple sex and age classes, indicating the presence of an active, reproducing population. The distribution of detections and diversity of observed activities (basking, moving, foraging) indicate that the reach provides essential habitat for a local Wood Turtle population. These findings have significant implications for project planning and regulatory compliance.',
    'Nesting Activity Confirmed':
      'Nesting activity was confirmed during the survey, with one or more females observed in or adjacent to nesting habitat. Nesting is the most energetically demanding and habitat-specific behaviour exhibited by Wood Turtles and indicates that the survey area supports critical reproductive habitat for the population. All nesting activity was documented and is reported in detail in the Observation Records section of this report.',
  },
  recommendations: {
    'No Immediate Concerns':
      'Based on the results of this Wood Turtle survey, no immediate concerns have been identified that would preclude the proposed activity from proceeding, subject to the following standard conditions:\n\n1. All work must comply with the prohibitions applicable to Wood Turtle under SARA Schedule 1.\n2. If Wood Turtles are encountered during work activities, all work within 30 m must halt immediately and Fraxinus Environmental &amp; Geomatics must be notified.\n3. Any vegetation clearing adjacent to the watercourse should be conducted outside the nesting season (June 1 to August 31) where possible.\n4. Riparian buffers should be maintained in accordance with applicable provincial standards.',
    'Riparian Buffer Required':
      'The Wood Turtle detections recorded during this survey indicate that the riparian zone within the project area supports an active Wood Turtle population. The following mitigation measures are required:\n\n1. A minimum [X]-metre undisturbed riparian buffer must be established from the high-water mark of the watercourse on both banks.\n2. The buffer boundary must be clearly delineated with high-visibility flagging tape or temporary fencing prior to the commencement of any work.\n3. No vegetation clearing, grading, or other ground-disturbing activities shall occur within the buffer during the active season (April 1 to October 31) without a SARA permit.\n4. A qualified biologist must be present during any work within 100 m of the watercourse to monitor for Wood Turtle activity.',
    'Avoid Active Nesting Season':
      'Nesting activity was confirmed or is likely based on the survey results. To protect nesting females and nest sites, the following restrictions apply:\n\n1. All work within [X] m of confirmed or suspected nesting habitat must be suspended from June 1 to August 31.\n2. Upland nesting habitat (sandy or gravelly areas within 500 m of the watercourse) must be surveyed by a qualified biologist prior to any ground disturbance.\n3. Confirmed nest sites must be flagged and a minimum 15-m no-disturbance buffer established around each nest until all hatchlings have dispersed.\n4. If project scheduling requires work during the nesting season, a SARA permit or equivalent provincial authorization must be obtained prior to commencing work.',
    'ECCC Notification Required':
      'The survey results indicate that the project may affect Wood Turtles or their habitat in a manner requiring notification of Environment and Climate Change Canada (ECCC). The following steps must be completed prior to proceeding:\n\n1. ECCC Wildlife Service must be notified of the survey results and proposed project activities as soon as reasonably practicable.\n2. Consultation with ECCC must be completed and any conditions or requirements issued by ECCC must be incorporated into the project environmental management plan.\n3. A Reasonable Worst Case Scenario assessment may be required to document potential effects on the species and its critical habitat.\n4. Fraxinus Environmental &amp; Geomatics should be retained to prepare the ECCC notification package and coordinate the consultation process.',
    'SAR Permit / Authorization Required':
      'Based on the survey results, the proposed activity is likely to affect Wood Turtles or their habitat in a manner that may constitute a SARA prohibited activity. The following regulatory steps are required before work may proceed:\n\n1. An Authorization under Section 73 of SARA or a provincial Species at Risk permit equivalent must be obtained from ECCC before any work that may affect Wood Turtles or their habitat commences.\n2. The permit application must include a detailed assessment of project impacts on Wood Turtle individuals, habitat, and population viability, prepared by a qualified biologist.\n3. Compensatory habitat measures acceptable to ECCC must be proposed as a condition of the permit.\n4. All permit conditions must be fully implemented and documented throughout the project.\n5. Post-construction monitoring of the Wood Turtle population should be conducted as specified in the permit.',
  },
};

// ─── Auto-select the most relevant Recommendations preset ─────────────────────
function _autoRecKey(obs) {
  if (obs.some(o => o.activity === 'Nesting')) return 'Avoid Active Nesting Season';
  if (obs.length > 3) return 'Riparian Buffer Required';
  if (obs.length > 0) return 'No Immediate Concerns';
  return 'No Immediate Concerns';
}

// ─── Main export entry point ──────────────────────────────────────────────────
export async function exportTurtlePDF() {
  const obs    = [...turtleObservations];
  const habObs = [...habitatObservations].filter(o => o.surveyType === 'TURTLE');
  if (!obs.length && !habObs.length) {
    alert('No Wood Turtle observations to export.');
    return;
  }

  const meta = {
    projectID:  turtleProjectID, observer:   turtleObserver,
    siteName:   turtleSiteName,  surveyDate: turtleSurveyDate,
    startTime:  turtleStartTime, endTime:    turtleEndTime,
    waterTemp:  turtleWaterTemp, airTemp:    turtleAirTemp,
    waterLevel: turtleWaterLevel, weather:   turtleWeather,
    notes:      turtleNotes,
  };

  const total    = obs.length;
  const males    = obs.filter(o => o.sex === 'Male'   || o.sex === 'M').length;
  const females  = obs.filter(o => o.sex === 'Female' || o.sex === 'F').length;
  const juveniles= obs.filter(o => o.ageClass === 'Juvenile' || o.ageClass === 'J').length;
  const unknown  = total - males - females - juveniles;
  const stats = { total, males, females, juveniles, unknown: Math.max(0, unknown) };

  const allPts = [...obs, ...habObs];
  const lats = allPts.map(o => o.latlng?.lat).filter(Number.isFinite);
  const lngs = allPts.map(o => o.latlng?.lng).filter(Number.isFinite);

  let mapImgSrc = null;
  if (lats.length > 0) {
    const pad = 0.003, minD = 0.006;
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const bboxS = Math.min(Math.min(...lats) - pad, midLat - minD / 2);
    const bboxN = Math.max(Math.max(...lats) + pad, midLat + minD / 2);
    const bboxW = Math.min(Math.min(...lngs) - pad, midLng - minD / 2);
    const bboxE = Math.max(Math.max(...lngs) + pad, midLng + minD / 2);
    const mapW = 760, mapH = 380;
    const url = `https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bboxW},${bboxS},${bboxE},${bboxN}&bboxSR=4326&size=${mapW},${mapH}&f=image`;
    mapImgSrc = await _buildMapImage(url, obs, habObs, bboxW, bboxS, bboxE, bboxN, mapW, mapH);
  }

  const detailMaps = lats.length > 0 ? await _buildDetailMaps(obs, habObs) : [];

  const w = window.open('', '_blank', 'width=980,height=800,scrollbars=yes');
  if (!w) { alert('Pop-up blocked — please allow pop-ups for this app, then try again.'); return; }
  w.document.write(_buildHTML(meta, obs, habObs, stats, mapImgSrc, detailMaps));
  w.document.close();
}

// ─── Satellite basemap + plotted points ───────────────────────────────────────
async function _buildMapImage(arcgisURL, obs, habObs, west, south, east, north, mapW, mapH) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = mapW; canvas.height = mapH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const lngSpan = east - west, latSpan = north - south;
        const plot = (ll, colour, r, dash, label) => {
          if (!Number.isFinite(ll?.lat)) return;
          const x = ((ll.lng - west) / lngSpan) * mapW;
          const y = (1 - (ll.lat - south) / latSpan) * mapH;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = colour; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
          if (dash) ctx.setLineDash([4, 3]);
          ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
          if (label != null) {
            ctx.fillStyle = '#fff';
            ctx.font = `bold ${Math.round(r * 0.85)}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(String(label), x, y);
          }
        };
        habObs.forEach(o => plot(o.latlng, '#0f7abf', 7, true, null));
        obs.forEach((o, i) => plot(o.latlng, ACTIVITY_COLOUR[o.activity] || '#888', 11, false, o._origIdx ?? i + 1));
        resolve(canvas.toDataURL('image/png'));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = arcgisURL;
  });
}

// ─── Cluster observations within ~150 m of each other ─────────────────────────
function _clusterObs(obs, threshDeg) {
  const geo = obs.map((o, i) => ({ o, i })).filter(({ o }) => Number.isFinite(o.latlng?.lat));
  const used = new Set();
  const clusters = [];
  for (const { o: seed, i: si } of geo) {
    if (used.has(si)) continue;
    const cluster = [{ ...seed, _origIdx: si + 1 }];
    used.add(si);
    for (const { o: other, i: oi } of geo) {
      if (used.has(oi)) continue;
      if (Math.abs(seed.latlng.lat - other.latlng.lat) < threshDeg &&
          Math.abs(seed.latlng.lng - other.latlng.lng) < threshDeg) {
        cluster.push({ ...other, _origIdx: oi + 1 });
        used.add(oi);
      }
    }
    clusters.push(cluster);
  }
  return clusters;
}

// ─── Build tight detail map per cluster ───────────────────────────────────────
async function _buildDetailMaps(obs, habObs) {
  const clusters = _clusterObs(obs, 0.0014);
  const results = [];
  for (const cluster of clusters) {
    const lats = cluster.map(o => o.latlng.lat);
    const lngs = cluster.map(o => o.latlng.lng);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const midLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;
    const pad = 0.0003;
    const halfLat = Math.max((Math.max(...lats) - Math.min(...lats)) / 2 + pad, 0.0006);
    const halfLng = Math.max((Math.max(...lngs) - Math.min(...lngs)) / 2 + pad, 0.0010);
    const bboxS = midLat - halfLat, bboxN = midLat + halfLat;
    const bboxW = midLng - halfLng, bboxE = midLng + halfLng;
    const nearHab = habObs.filter(h =>
      Number.isFinite(h.latlng?.lat) &&
      h.latlng.lat >= bboxS && h.latlng.lat <= bboxN &&
      h.latlng.lng >= bboxW && h.latlng.lng <= bboxE
    );
    const mapW = 760, mapH = 400;
    const url = `https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bboxW},${bboxS},${bboxE},${bboxN}&bboxSR=4326&size=${mapW},${mapH}&f=image`;
    const imgSrc = await _buildMapImage(url, cluster, nearHab, bboxW, bboxS, bboxE, bboxN, mapW, mapH);
    results.push({ imgSrc, indices: cluster.map(o => o._origIdx) });
  }
  return results;
}

// ─── Build full HTML for the editor/report window ─────────────────────────────
function _buildHTML(meta, obs, habObs, stats, mapImgSrc, detailMaps) {
  const today        = new Date().toLocaleDateString('en-CA');
  const colorLogoSrc = new URL('img/LOGO w TEXT white and green.jpg', window.location.href).href;
  const bwLogoSrc    = new URL('img/LOGO w TEXT black bg.jpg', window.location.href).href;
  const logoSrc      = colorLogoSrc;

  const presetsJSON = JSON.stringify(PRESETS);

  // Habitat observation table rows
  const habRows = habObs.map((h, i) => {
    const coords = Number.isFinite(h.latlng?.lat)
      ? `${h.latlng.lat.toFixed(5)}, ${h.latlng.lng.toFixed(5)}` : '';
    return `<tr>
      <td>${i + 1}</td>
      <td contenteditable="true">${_esc(h.featureType || '')}</td>
      <td contenteditable="true">${_esc((h.criteria || []).join(', '))}</td>
      <td contenteditable="true">${_esc(h.condition || '')}</td>
      <td contenteditable="true">${_esc(h.note || '')}</td>
      <td contenteditable="true" style="font-size:0.7rem;color:#555;">${coords}</td>
    </tr>`;
  }).join('');

  // Observation table rows
  const tableRows = obs.map((o, i) => {
    const colour = ACTIVITY_COLOUR[o.activity] || '#888';
    const coords = Number.isFinite(o.latlng?.lat)
      ? `${o.latlng.lat.toFixed(5)}, ${o.latlng.lng.toFixed(5)}` : '';
    return `<tr>
      <td>${i + 1}</td>
      <td contenteditable="true">${_esc(o.species || 'Wood Turtle')}</td>
      <td contenteditable="true">${_esc(o.sex || '')}</td>
      <td contenteditable="true">${_esc(o.ageClass || '')}</td>
      <td contenteditable="true" style="color:${colour};font-weight:600;">${_esc(o.activity || '')}</td>
      <td contenteditable="true">${_esc(o.habitat || '')}</td>
      <td contenteditable="true">${_esc(o.photoID || '')}</td>
      <td contenteditable="true">${_esc(o.note || '')}</td>
      <td contenteditable="true" style="font-size:0.7rem;color:#555;">${coords}</td>
    </tr>`;
  }).join('');

  const metaItems = [
    ['Project ID', meta.projectID],  ['Observer', meta.observer],
    ['Site Name', meta.siteName],    ['Survey Date', meta.surveyDate],
    ['Start / End', [meta.startTime, meta.endTime].filter(Boolean).join(' – ')],
    ['Water Temp', meta.waterTemp ? meta.waterTemp + '°C' : null],
    ['Air Temp',   meta.airTemp   ? meta.airTemp   + '°C' : null],
    ['Water Level', meta.waterLevel], ['Weather', meta.weather],
  ].filter(([, v]) => v)
   .map(([l, v]) => {
     const ed = (l === 'Project ID' || l === 'Observer') ? ' contenteditable="true"' : '';
     return `<div class="mi"><div class="ml">${l}</div><div class="mv"${ed}>${_esc(v)}</div></div>`;
   })
   .join('');

  // Survey Conditions grid (non-editable)
  const conditionItems = [
    ['Water Temp',  meta.waterTemp  ? meta.waterTemp  + '°C' : '—'],
    ['Air Temp',    meta.airTemp    ? meta.airTemp    + '°C' : '—'],
    ['Water Level', meta.waterLevel || '—'],
    ['Weather',     meta.weather    || '—'],
    ['Notes',       meta.notes      || '—'],
  ].map(([l, v]) =>
    `<div class="cg-item"><div class="cg-lbl">${l}</div><div class="cg-val">${_esc(v)}</div></div>`
  ).join('');

  // Auto-generated section text
  const introAuto = `This Wood Turtle (<em>Glyptemys insculpta</em>) survey was conducted at ${_esc(meta.siteName || 'the survey site')} by ${_esc(meta.observer || 'a qualified biologist')} (Project ${_esc(meta.projectID || 'N/A')}) on ${_esc(meta.surveyDate || 'the survey date')}. <em>Glyptemys insculpta</em> is assessed as Threatened by the Committee on the Status of Endangered Wildlife in Canada (COSEWIC) and is listed on Schedule 1 of the <em>Species at Risk Act</em> (SARA). The survey was designed to detect Wood Turtle presence and document individual capture records, activity, and habitat use within the study reach.`;

  const methodsAuto = `The survey was conducted from ${_esc(meta.startTime || 'start time')}${meta.endTime ? ' to ' + _esc(meta.endTime) : ''}. Water temperature was ${meta.waterTemp ? _esc(meta.waterTemp) + '°C' : 'not recorded'}, air temperature was ${meta.airTemp ? _esc(meta.airTemp) + '°C' : 'not recorded'}, and water level was ${_esc(meta.waterLevel || 'not recorded')}. Weather conditions were ${_esc(meta.weather || 'not recorded')}. All turtles detected were recorded with GPS coordinates, sex, age class, activity, habitat association, photo documentation, and individual identification where possible.`;

  const findingsAuto = `A total of <strong>${stats.total}</strong> Wood Turtle${stats.total !== 1 ? 's were' : ' was'} recorded during the survey. Of the individuals detected: <strong>${stats.males}</strong> male${stats.males !== 1 ? 's' : ''}, <strong>${stats.females}</strong> female${stats.females !== 1 ? 's' : ''}, <strong>${stats.juveniles}</strong> juvenile${stats.juveniles !== 1 ? 's' : ''}, and <strong>${stats.unknown}</strong> of unknown sex or age. ${obs.some(o => o.activity === 'Nesting') ? '<strong>Nesting activity was confirmed during the survey.</strong>' : ''}`;

  const _mapImg = (src, alt) => src
    ? `<img src="${src}" style="width:100%;max-width:760px;border:1px solid #ccc;border-radius:4px;" alt="${alt}" />`
    : `<p style="color:#888;font-style:italic;font-size:0.85rem;">Map unavailable — no GPS data or satellite imagery could not be loaded.</p>`;

  const detailSection = detailMaps.length ? detailMaps.map(dm => {
    const label = dm.indices.length === 1
      ? `Observation #${dm.indices[0]}`
      : `Observations #${dm.indices.join(', #')}`;
    return `<div style="margin-bottom:18px;">
      <div style="font-size:0.76rem;font-weight:600;color:var(--ca);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">${label}</div>
      ${_mapImg(dm.imgSrc, label)}
    </div>`;
  }).join('') : '';

  const toolbar = (group, targetId) => `
    <div class="ptb no-print">
      <span class="ptb-lbl">Preset:</span>
      <select id="sel-${targetId}" onchange="">
        <option value="">— select template —</option>
        ${Object.keys(PRESETS[group]).map(k =>
          `<option value="${_esc(k)}">${_esc(k)}</option>`
        ).join('')}
      </select>
      <button onclick="insertPreset('${group}','sel-${targetId}','${targetId}','replace')">↩ Replace</button>
      <button onclick="insertPreset('${group}','sel-${targetId}','${targetId}','append')">+ Append</button>
      <span class="ptb-hint">✏ Click text below to edit directly</span>
    </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Wood Turtle Survey Report — ${_esc(meta.siteName || meta.projectID || 'Survey')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root{--ca:#2d6b2d;--cal:#4caf50;--ct:#f8faf8;--cb:#cde8cd;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Oswald','Segoe UI',sans-serif;color:#1a1a1a;background:#f4f4f4;font-size:10.5pt;line-height:1.55;}
    @page{margin:8mm 12mm;size:A4;}
    @media print{
      *{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      .no-print{display:none!important;}
      body{background:#fff;font-size:9.5pt;}
      .page{box-shadow:none!important;margin:0!important;padding:0!important;max-width:100%!important;}
      .editable{border:none!important;background:transparent!important;padding:0!important;}
      [contenteditable]{outline:none!important;background:transparent!important;}
    }

    .topbar{position:fixed;top:0;left:0;right:0;background:#111;border-bottom:3px solid var(--ca);z-index:999;padding:10px 20px;}
    .topbar-inner{max-width:940px;margin:0 auto;display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;}
    .topbar-text{color:#d6d6d6;font-size:0.85rem;font-weight:400;flex:1;min-width:160px;}
    .topbar-hint{display:block;font-size:0.7rem;font-weight:300;color:#666;margin-top:1px;}
    .topbar-controls{display:flex;align-items:center;gap:8px;flex-shrink:0;}
    .ctrl-lbl{color:#aaa;font-size:0.72rem;text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;}
    .ctrl-sel{font-family:'Oswald',sans-serif;font-size:0.78rem;padding:4px 7px;border:1px solid #444;border-radius:4px;background:#222;color:#eee;cursor:pointer;}
    .ctrl-sel:focus{outline:1px solid var(--ca);}
    .topbar-btn{background:var(--ca);color:#fff;border:1px solid var(--cal);border-radius:6px;padding:9px 22px;font-family:'Oswald',sans-serif;font-size:0.9rem;letter-spacing:0.08em;cursor:pointer;text-transform:uppercase;white-space:nowrap;}
    .topbar-btn:hover{background:var(--cal);border-color:var(--cal);}

    .page{max-width:780px;margin:72px auto 40px;padding:28px 32px 36px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.12);}

    .hdr{display:flex;align-items:center;gap:20px;padding-bottom:14px;border-bottom:3px solid var(--ca);margin-bottom:22px;}
    .hdr img{height:72px;width:auto;}
    .hdr-rt{font-size:1.2rem;font-weight:600;color:#111;letter-spacing:0.03em;border-bottom:1px dashed transparent;border-radius:2px;outline:none;transition:border-color 0.15s,background 0.15s;}
    .hdr-rt:hover{border-bottom-color:var(--cb);}
    .hdr-rt:focus{border-bottom-color:var(--ca);background:var(--ct);}
    .hdr-rd{font-size:0.74rem;color:#888;font-weight:300;margin-top:2px;}

    .mg{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:22px;padding:14px 16px;background:var(--ct);border:1px solid var(--cb);border-radius:6px;}
    .ml{font-size:0.67rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--ca);font-weight:600;}
    .mv{font-size:0.87rem;}

    .conditions-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:6px 16px;margin-bottom:16px;padding:12px 14px;background:var(--ct);border:1px solid var(--cb);border-radius:6px;}
    .cg-item{display:flex;flex-direction:column;gap:2px;}
    .cg-lbl{font-size:0.65rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--ca);font-weight:600;}
    .cg-val{font-size:0.82rem;}

    h2{font-size:0.85rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--ca);border-bottom:1px solid var(--cb);padding-bottom:3px;margin:22px 0 8px;}

    .editable{border:1px solid transparent;border-radius:4px;padding:6px 8px;outline:none;transition:border-color 0.15s,background 0.15s;font-size:0.87rem;font-weight:300;line-height:1.6;min-height:1.6em;}
    .editable:hover{border-color:var(--cb);background:var(--ct);}
    .editable:focus{border-color:var(--ca);background:var(--ct);outline:2px solid rgba(45,107,45,0.12);}

    .ptb{display:flex;flex-wrap:wrap;align-items:center;gap:7px;background:#f0f0f0;border:1px solid #ddd;border-radius:4px 4px 0 0;padding:7px 10px;margin-bottom:0;}
    .ptb-lbl{font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#555;white-space:nowrap;}
    .ptb select{font-family:'Oswald',sans-serif;font-size:0.8rem;padding:4px 8px;border:1px solid #ccc;border-radius:4px;flex:1;min-width:180px;max-width:340px;background:#fff;}
    .ptb button{font-family:'Oswald',sans-serif;font-size:0.75rem;padding:4px 11px;border-radius:4px;cursor:pointer;white-space:nowrap;}
    .ptb button:first-of-type{background:var(--ca);color:#fff;border:1px solid var(--ca);}
    .ptb button:first-of-type:hover{background:var(--cal);border-color:var(--cal);}
    .ptb button:last-of-type{background:#fff;color:var(--ca);border:1px solid var(--ca);}
    .ptb button:last-of-type:hover{background:var(--ct);}
    .ptb-hint{font-size:0.68rem;color:#aaa;font-style:italic;margin-left:auto;}
    .ptb + .editable{border-top-left-radius:0;border-top-right-radius:0;}

    .sr{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;}
    .sc{background:var(--ct);border:1px solid var(--cb);border-radius:6px;padding:6px 14px;text-align:center;min-width:72px;}
    .sv{font-size:1.5rem;font-weight:700;color:var(--ca);line-height:1.2;}
    .sl{font-size:0.66rem;text-transform:uppercase;letter-spacing:0.05em;color:#666;}

    table{width:100%;border-collapse:collapse;font-size:0.76rem;margin-top:6px;}
    th{background:var(--ca);color:#fff;font-weight:600;padding:5px 6px;text-align:left;letter-spacing:0.04em;font-size:0.7rem;}
    td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top;}
    tr:nth-child(even) td{background:#f9fbf9;}

    .map-legend{display:flex;gap:16px;margin-top:8px;font-size:0.76rem;flex-wrap:wrap;}
    .ld{display:flex;align-items:center;gap:5px;}
    .dot{width:11px;height:11px;border-radius:50%;border:1.5px solid #fff;box-shadow:0 0 0 1px #999;display:inline-block;flex-shrink:0;}

    .ft{margin-top:28px;padding-top:10px;border-top:1px solid var(--cb);display:flex;align-items:center;justify-content:space-between;font-size:0.7rem;color:#999;font-weight:300;}
    .ft span[contenteditable]:hover{color:#555;background:var(--ct);border-radius:2px;padding:1px 3px;}
    .ft span[contenteditable]:focus{outline:1px dashed var(--ca);border-radius:2px;padding:1px 3px;color:#1a1a1a;}

    h2[contenteditable]:hover{background:var(--ct);padding-left:4px;cursor:text;}
    h2[contenteditable]:focus{background:var(--ct);outline:1px dashed var(--ca);padding-left:4px;}

    .mv[contenteditable]:hover{background:var(--ct);border-radius:2px;padding:1px 4px;cursor:text;}
    .mv[contenteditable]:focus{background:var(--ct);outline:1px dashed var(--ca);border-radius:2px;padding:1px 4px;}

    td[contenteditable]:hover{background:var(--ct)!important;cursor:text;}
    td[contenteditable]:focus{background:var(--ct)!important;outline:1px dashed var(--ca);outline-offset:-1px;}

    .pbtn-wrap{text-align:center;margin:28px 0 8px;}
    .pbtn{background:var(--ca);color:#fff;border:1px solid var(--cal);border-radius:6px;padding:11px 28px;font-family:'Oswald',sans-serif;font-size:1rem;letter-spacing:0.08em;cursor:pointer;text-transform:uppercase;}
    .pbtn:hover{background:var(--cal);}
  </style>
</head>
<body>

<div class="topbar no-print">
  <div class="topbar-inner">
    <div class="topbar-text">
      <strong>Wood Turtle Survey Report</strong>${meta.siteName ? ' — ' + _esc(meta.siteName) : ''}
      <span class="topbar-hint">Edit any section directly · Use Presets for standard language · <strong style="color:#f0c040;">Before printing:</strong> Chrome/Edge → More settings → uncheck <em>Headers and footers</em></span>
    </div>
    <div class="topbar-controls">
      <span class="ctrl-lbl">Logo</span>
      <select id="selLogo" class="ctrl-sel" onchange="switchLogo(this.value)">
        <option value="color">Colour</option>
        <option value="bw">B&amp;W</option>
      </select>
      <span class="ctrl-lbl">Theme</span>
      <select id="selTheme" class="ctrl-sel" onchange="switchTheme(this.value)">
        <option value="green">Fraxinus Green</option>
        <option value="navy">Navy &amp; Gold</option>
        <option value="slate">Slate &amp; Teal</option>
        <option value="charcoal">Charcoal &amp; Rust</option>
        <option value="midnight">Midnight Blue</option>
      </select>
      <button class="topbar-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
    </div>
  </div>
</div>

<div class="page">

  <div class="hdr">
    <img id="hdr-logo" src="${logoSrc}" alt="Fraxinus Environmental &amp; Geomatics" onerror="this.style.display='none'" />
    <div>
      <div class="hdr-rt" contenteditable="true" title="Click to edit report title">Wood Turtle Survey Report</div>
      <div class="hdr-rd">Created: ${today}</div>
    </div>
  </div>

  <div class="mg">${metaItems}</div>

  <h2 contenteditable="true">1. Introduction</h2>
  ${toolbar('intro', 'ed-intro')}
  <div id="ed-intro" class="editable" contenteditable="true">${introAuto}</div>

  <h2 contenteditable="true">2. Methods</h2>
  ${toolbar('methods', 'ed-methods')}
  <div id="ed-methods" class="editable" contenteditable="true">${methodsAuto}</div>

  <h2 contenteditable="true">3. Survey Conditions</h2>
  <div class="conditions-grid">${conditionItems}</div>

  <h2 contenteditable="true">4. Findings</h2>
  <div class="sr">
    <div class="sc"><div class="sv">${stats.total}</div><div class="sl">Total Captures</div></div>
    <div class="sc"><div class="sv">${stats.males}</div><div class="sl">Males</div></div>
    <div class="sc"><div class="sv">${stats.females}</div><div class="sl">Females</div></div>
    <div class="sc"><div class="sv">${stats.juveniles}</div><div class="sl">Juveniles</div></div>
    <div class="sc"><div class="sv">${stats.unknown}</div><div class="sl">Unknown Sex</div></div>
  </div>
  ${toolbar('findings', 'ed-findings')}
  <div id="ed-findings" class="editable" contenteditable="true">${findingsAuto}</div>

  <h2 contenteditable="true">5. Individual Capture Records</h2>
  <table>
    <thead><tr>
      <th>#</th><th>Species</th><th>Sex</th><th>Age Class</th><th>Activity</th>
      <th>Habitat</th><th>Photo ID</th><th>Notes</th><th>Coordinates</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2 contenteditable="true">6. Observation Locations</h2>
  <div style="font-size:0.76rem;font-weight:600;color:var(--ca);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">Overview</div>
  ${mapImgSrc
    ? `<img src="${mapImgSrc}" style="width:100%;max-width:760px;border:1px solid #ccc;border-radius:4px;" alt="Observation locations overview" />`
    : `<p style="color:#888;font-style:italic;font-size:0.85rem;">Map unavailable — no GPS data or satellite imagery could not be loaded.</p>`}
  <div class="map-legend">
    <div class="ld"><span class="dot" style="background:#E69138;"></span> Basking</div>
    <div class="ld"><span class="dot" style="background:#4caf50;"></span> Moving</div>
    <div class="ld"><span class="dot" style="background:#CC0000;"></span> Nesting</div>
    <div class="ld"><span class="dot" style="background:#0f7abf;"></span> Swimming</div>
    <div class="ld"><span class="dot" style="background:#9b59b6;"></span> Captured</div>
    ${habObs.length ? '<div class="ld"><span style="width:11px;height:11px;border-radius:50%;border:2px dashed #0f7abf;background:rgba(15,122,191,0.15);display:inline-block;flex-shrink:0;"></span> Habitat Feature</div>' : ''}
  </div>

  ${detailSection ? `<div style="font-size:0.76rem;font-weight:600;color:var(--ca);text-transform:uppercase;letter-spacing:0.07em;margin-top:18px;margin-bottom:10px;padding-top:12px;border-top:1px solid var(--cb);">Detail Views</div>
  ${detailSection}` : ''}

  <h2 contenteditable="true">7. Recommendations</h2>
  ${toolbar('recommendations', 'ed-recs')}
  <div id="ed-recs" class="editable" contenteditable="true"></div>

  ${habObs.length ? `<h2 contenteditable="true">8. Habitat Features</h2>
  <table>
    <thead><tr>
      <th>#</th><th>Feature Type</th><th>Criteria / Attributes</th><th>Condition</th><th>Notes</th><th>Coordinates</th>
    </tr></thead>
    <tbody>${habRows}</tbody>
  </table>` : ''}

  <div class="ft">
    <span contenteditable="true">Fraxinus Environmental &amp; Geomatics</span>
    <span contenteditable="true">NTB Wildlife App — Wood Turtle Survey</span>
    <span contenteditable="true">${_esc(meta.projectID || '')} · ${today}</span>
  </div>

</div>

<div class="pbtn-wrap no-print">
  <button class="pbtn" onclick="window.print()">Print / Save as PDF</button>
</div>

<script>
const _LOGOS = { color: '${colorLogoSrc}', bw: '${bwLogoSrc}' };
const _THEMES = {
  green:    { ca:'#2d6b2d', cal:'#4caf50', ct:'#f8faf8', cb:'#cde8cd' },
  navy:     { ca:'#1a3560', cal:'#c9a227', ct:'#f5f7fb', cb:'#b8c8df' },
  slate:    { ca:'#2c3e50', cal:'#1abc9c', ct:'#f4f8f8', cb:'#a8d5cb' },
  charcoal: { ca:'#2f2f2f', cal:'#c0392b', ct:'#f9f8f8', cb:'#d5b0ad' },
  midnight: { ca:'#0d1b2a', cal:'#3a86ff', ct:'#f4f6fb', cb:'#9ab4d8' },
};
function switchLogo(v) {
  const el = document.getElementById('hdr-logo');
  if (el) el.src = _LOGOS[v] || _LOGOS.color;
}
function switchTheme(v) {
  const t = _THEMES[v] || _THEMES.green;
  const r = document.documentElement.style;
  r.setProperty('--ca',  t.ca);
  r.setProperty('--cal', t.cal);
  r.setProperty('--ct',  t.ct);
  r.setProperty('--cb',  t.cb);
}

const _P = ${presetsJSON};

function insertPreset(group, selectId, targetId, mode) {
  const key = document.getElementById(selectId)?.value;
  if (!key) return;
  const raw  = _P[group]?.[key];
  if (!raw) return;
  const html = raw.replace(/\\n\\n/g, '<br><br>').replace(/\\n/g, '<br>');
  const el   = document.getElementById(targetId);
  if (!el) return;
  if (mode === 'append') {
    el.innerHTML += (el.innerHTML.trim() ? '<br><br>' : '') + html;
  } else {
    el.innerHTML = html;
  }
  el.focus();
}

(function () {
  const autoKey = ${JSON.stringify(_autoRecKey(obs))};
  const el  = document.getElementById('ed-recs');
  const raw = _P.recommendations?.[autoKey];
  if (el && raw) {
    el.innerHTML = raw.replace(/\\n\\n/g, '<br><br>').replace(/\\n/g, '<br>');
    const sel = document.getElementById('sel-ed-recs');
    if (sel) {
      for (const opt of sel.options) { if (opt.value === autoKey) { sel.value = autoKey; break; } }
    }
  }
})();
</script>
</body>
</html>`;
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
