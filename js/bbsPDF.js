// js/bbsPDF.js — Breeding Bird Survey PDF report: interactive editor before print

import { speciesMarkers, habitatObservations } from './storageData.js';
import {
  projectID as bbsProjectID, pointID, observer as bbsObserver,
  surveyLength, wind as bbsWind, windDir, tempC as bbsTempC,
  precip as bbsPrecip, siteHabitat, surveyLat, surveyLng,
  surveyStartTime, surveyEndTime
} from './surveyGlobals.js';

// Breeding evidence code colours
const BREEDING_COLOUR = {
  C: '#CC0000', P: '#E69138', H: '#4caf50', S: '#4caf50',
  T: '#E69138', X: '#0f7abf'
};

// ─── Preset text library ──────────────────────────────────────────────────────
const PRESETS = {
  intro: {
    'EIA Avian Baseline Survey':
      'This avian baseline survey was conducted as part of an Environmental Impact Assessment (EIA) to characterize the breeding bird community within and adjacent to the project area. The survey was designed to document species composition, relative abundance, and habitat associations of breeding birds, with emphasis on detecting Species at Risk (SAR) and species sensitive to the proposed development activities.',
    'Breeding Bird Inventory':
      'This breeding bird inventory was conducted to document the diversity and distribution of bird species using the project area during the breeding season. Standardized point count methods were used to provide a systematic and repeatable record of avian species presence and activity, which will serve as a baseline for subsequent monitoring and impact assessment.',
    'Pre-Clearance Avian Survey':
      'This pre-clearance avian survey was conducted prior to proposed vegetation clearing to assess the potential for impacts on nesting birds and Species at Risk. The survey was designed to detect species of conservation concern and to confirm or rule out the presence of sensitive breeding activity within the proposed work area before clearing operations commence.',
    'Long-Term Monitoring Point Count':
      'This survey is part of a long-term avian monitoring program using standardized point count methods to track trends in bird species richness, abundance, and breeding activity over time. Consistent survey methods, timing, and observer effort enable year-over-year comparisons of community composition and the detection of population-level changes in response to habitat change or management interventions.',
  },
  methods: {
    'Standard 5-Minute Point Count':
      'The survey was conducted using the standard 5-minute unlimited-distance point count method. The observer stood quietly at the survey point for a full 5 minutes, recording all birds detected by sight or sound within the count period. All species, estimated count, distance range, bearing from point, and breeding evidence code were recorded. Detections during the first minute (fly-overs) were recorded separately. Survey was conducted during optimal conditions: within 4 hours of sunrise, under calm (&lt;Beaufort 3) and precipitation-free conditions.',
    '10-Minute Unlimited Distance Count':
      'The survey was conducted using a 10-minute unlimited-distance point count. The observer recorded all birds detected by sight or sound throughout the full count period, without applying a fixed-distance cutoff. All species, count, estimated distance range, bearing, and breeding evidence were recorded. This extended count duration increases detection probability for species present at low density or with infrequent vocalization.',
    'Fixed-Radius 50 m Point Count':
      'The survey was conducted using a fixed-radius 50-metre point count method. All birds detected within 50 m of the survey point were recorded during a 5-minute count period. Birds detected beyond 50 m were recorded separately as out-of-sample detections. The fixed-radius method facilitates density estimation and enables standardized comparison of bird abundance across survey points and years.',
    'Roadside Point Count Survey':
      'The survey was conducted at roadside point count stations using standard 3-minute roadside count methods, with the observer stationed at the road edge. All birds detected by sight or sound were recorded for each station. Station locations were pre-determined using a systematic sampling design along the road network within the study area. Roadside counts supplement off-road point count data and provide landscape-scale context for site-level findings.',
  },
  findings: {
    'Low Species Richness':
      'The breeding bird survey recorded a low level of species richness relative to available habitat within the study area. The species assemblage detected is dominated by generalist and edge-tolerant species. The limited diversity may reflect habitat conditions, survey timing, or the characteristics of the study area. No species of particular conservation concern were identified during the survey, though absence of detections does not conclusively rule out their presence.',
    'Moderate Species Richness':
      'The breeding bird survey recorded moderate species richness, with a community composition consistent with the habitat types present within and adjacent to the survey point. Both forest interior and edge-associated species were represented. Survey conditions were suitable for detection of most expected species. The diversity and abundance of species detected indicates that the survey area provides functional habitat for a typical regional breeding bird assemblage.',
    'High Species Richness':
      'The breeding bird survey recorded high species richness, indicating that the survey area supports a diverse and productive breeding bird community. The species assemblage included representatives of multiple habitat guilds, suggesting structural habitat complexity and ecological value. Several species with sensitivity to disturbance were detected, and the results warrant detailed review in the context of project-specific impact assessment.',
    'Species at Risk Detected':
      'One or more Species at Risk (SAR) were detected during the breeding bird survey. Species listed under Schedule 1 of the Species at Risk Act (SARA) and/or species of provincial conservation concern were recorded during the count period. The detection of SAR or potentially sensitive species has implications for project planning and regulatory compliance, and targeted follow-up surveys are recommended to confirm status and assess potential project impacts.',
  },
  recommendations: {
    'No Concerns — Proceed':
      'Based on the results of this breeding bird survey, no significant avian concerns have been identified that would preclude the proposed activity from proceeding. Standard conditions apply:\n\n1. All work must comply with the Migratory Birds Convention Act (MBCA) and provincial wildlife legislation.\n2. Pre-clearance nest surveys must be completed within 48 hours prior to any vegetation clearing during the nesting season.\n3. The contractor must cease work immediately if a Species at Risk is encountered and contact Fraxinus Environmental &amp; Geomatics within 24 hours.\n4. Cleared vegetation should be removed promptly to discourage opportunistic nesting on debris piles.',
    'Pre-Clearance Survey Required':
      'The species diversity and breeding activity detected during this survey indicate that a pre-clearance survey is required prior to vegetation removal. The following steps are required:\n\n1. A qualified biologist must conduct a nest sweep of the full work area within 48 hours immediately prior to any clearing.\n2. If active nests are found at pre-clearance, clearing must be postponed and Fraxinus Environmental &amp; Geomatics notified within 24 hours.\n3. All pre-clearance survey records must be retained as part of the project environmental file for a minimum of two years.\n4. The contractor must maintain a copy of this report and all pre-clearance monitoring records on-site throughout clearing operations.',
    'Habitat Enhancement Recommended':
      'The survey results indicate that the project area and adjacent lands support a productive breeding bird community that may benefit from targeted habitat enhancement measures. The following actions are recommended:\n\n1. Retention of mature trees and snags within or adjacent to the work area should be maximized where practicable.\n2. Native plant species should be used in any revegetation or landscaping associated with the project to maximize habitat value for breeding birds.\n3. The establishment of a riparian or hedgerow buffer along the project perimeter should be considered to provide movement corridors and nesting habitat.\n4. Nest boxes for cavity-nesting species may be installed as part of a habitat compensation strategy where habitat loss cannot be avoided.',
    'SARA Consultation Required':
      'One or more Species at Risk listed under SARA Schedule 1 were detected during this survey, and the proposed project may affect these species or their habitat. The following steps are required prior to proceeding:\n\n1. Environment and Climate Change Canada (ECCC) must be consulted regarding the potential impacts of the project on detected SAR species.\n2. A species-specific assessment of potential project impacts should be prepared by a qualified biologist with SAR expertise.\n3. A Section 73 SARA permit or equivalent authorization may be required if the project cannot avoid impacting the species or its critical habitat.\n4. Fraxinus Environmental &amp; Geomatics should be engaged to coordinate regulatory consultations and prepare required technical documentation.\n5. No work in areas where SAR were detected should proceed until all regulatory requirements have been met.',
  },
};

// ─── Auto-select the most relevant Recommendations preset ─────────────────────
function _autoRecKey(obs) {
  const speciesSet = [...new Set(obs.map(o => o.code).filter(Boolean))];
  if (speciesSet.length > 20) return 'High Species Richness';
  if (speciesSet.length > 10) return 'Moderate Species Richness';
  if (obs.some(o => o.breeding === 'C')) return 'Pre-Clearance Survey Required';
  return 'Low Species Richness';
}

// ─── Main export entry point ──────────────────────────────────────────────────
export async function exportBBSPDF() {
  const obs    = [...speciesMarkers];
  const habObs = [...habitatObservations].filter(o => o.surveyType === 'BBS');
  if (!obs.length && !habObs.length) {
    alert('No bird observations to export.');
    return;
  }

  const meta = {
    projectID:   bbsProjectID, observer:    bbsObserver,
    pointID:     pointID,      surveyLength: surveyLength,
    wind:        bbsWind,      windDir:      windDir,
    tempC:       bbsTempC,     precip:       bbsPrecip,
    siteHabitat: siteHabitat,  surveyLat:    surveyLat,
    surveyLng:   surveyLng,    startTime:    surveyStartTime,
    endTime:     surveyEndTime,
  };

  const speciesSet = [...new Set(obs.map(o => o.code).filter(Boolean))];
  const totalIndividuals = obs.reduce((sum, o) => sum + (parseInt(o.count) || 1), 0);
  const confirmedBreeding = obs.filter(o => o.breeding === 'C').length;
  const stats = {
    speciesCount: speciesSet.length,
    totalIndividuals,
    confirmedBreeding,
    surveyLength: surveyLength || '',
    speciesSet,
  };

  const allPts = [...obs, ...habObs];
  const lats = allPts.map(o => o.latlng?.lat).filter(Number.isFinite);
  const lngs = allPts.map(o => o.latlng?.lng).filter(Number.isFinite);

  // Include survey point in bbox if defined
  const surveyLatF = parseFloat(surveyLat);
  const surveyLngF = parseFloat(surveyLng);
  if (Number.isFinite(surveyLatF)) { lats.push(surveyLatF); lngs.push(surveyLngF); }

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
    mapImgSrc = await _buildMapImage(url, obs, habObs, bboxW, bboxS, bboxE, bboxN, mapW, mapH, surveyLatF, surveyLngF);
  }

  const detailMaps = lats.length > 0 ? await _buildDetailMaps(obs, habObs, surveyLatF, surveyLngF) : [];

  const w = window.open('', '_blank', 'width=980,height=800,scrollbars=yes');
  if (!w) { alert('Pop-up blocked — please allow pop-ups for this app, then try again.'); return; }
  w.document.write(_buildHTML(meta, obs, habObs, stats, mapImgSrc, detailMaps));
  w.document.close();
}

// ─── Satellite basemap + plotted points ───────────────────────────────────────
async function _buildMapImage(arcgisURL, obs, habObs, west, south, east, north, mapW, mapH, surveyLatF, surveyLngF) {
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
        obs.forEach((o, i) => plot(o.latlng, BREEDING_COLOUR[o.breeding] || '#0f7abf', 11, false, o._origIdx ?? i + 1));
        // Plot survey point as large gold star
        if (Number.isFinite(surveyLatF) && Number.isFinite(surveyLngF)) {
          plot({ lat: surveyLatF, lng: surveyLngF }, '#c9a227', 14, false, '★');
        }
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
async function _buildDetailMaps(obs, habObs, surveyLatF, surveyLngF) {
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
    const imgSrc = await _buildMapImage(url, cluster, nearHab, bboxW, bboxS, bboxE, bboxN, mapW, mapH, surveyLatF, surveyLngF);
    results.push({ imgSrc, indices: cluster.map(o => o._origIdx) });
  }
  return results;
}

// ─── Build full HTML for the editor/report window ─────────────────────────────
function _buildHTML(meta, obs, habObs, stats, mapImgSrc, detailMaps) {
  const today        = new Date().toLocaleDateString('en-CA');
  const colorLogoSrc = new URL('img/LOGO w TEXT white and green.jpg', window.location.href).href;
  const bwLogoSrc    = new URL('img/LOGO w TEXT black.jpg', window.location.href).href;
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

  // Breeding code label map
  const BREEDING_LABEL = {
    C: 'Confirmed', P: 'Probable', H: 'Possible', S: 'Possible',
    T: 'Probable', X: 'Observed', '': 'Not coded'
  };

  // Observation table rows (detail)
  const tableRows = obs.map((o, i) => {
    const colour = BREEDING_COLOUR[o.breeding] || '#0f7abf';
    const coords = Number.isFinite(o.latlng?.lat)
      ? `${o.latlng.lat.toFixed(5)}, ${o.latlng.lng.toFixed(5)}` : '';
    return `<tr>
      <td>${i + 1}</td>
      <td contenteditable="true">${_esc(o.code || '')}</td>
      <td contenteditable="true">${_esc(String(o.count || ''))}</td>
      <td contenteditable="true">${_esc(o.range || '')}</td>
      <td contenteditable="true">${_esc(o.bearing || '')}</td>
      <td contenteditable="true" style="color:${colour};font-weight:600;">${_esc(o.breeding || '')}${o.breeding ? ' — ' + (BREEDING_LABEL[o.breeding] || '') : ''}</td>
      <td contenteditable="true">${_esc(o.note || '')}</td>
      <td contenteditable="true" style="font-size:0.7rem;color:#555;">${coords}</td>
    </tr>`;
  }).join('');

  // Species summary: one row per unique species, total count, highest breeding code
  const BREEDING_ORDER = ['C', 'P', 'T', 'S', 'H', 'X', ''];
  const summaryMap = {};
  obs.forEach(o => {
    const sp = o.code || 'Unknown';
    if (!summaryMap[sp]) summaryMap[sp] = { count: 0, breeding: '' };
    summaryMap[sp].count += (parseInt(o.count) || 1);
    const cur = summaryMap[sp].breeding;
    const newB = o.breeding || '';
    if (BREEDING_ORDER.indexOf(newB) < BREEDING_ORDER.indexOf(cur)) {
      summaryMap[sp].breeding = newB;
    }
  });
  const summaryRows = Object.entries(summaryMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([sp, d]) => {
      const colour = BREEDING_COLOUR[d.breeding] || '#0f7abf';
      return `<tr>
        <td>${_esc(sp)}</td>
        <td style="text-align:center;">${d.count}</td>
        <td style="color:${colour};font-weight:600;">${_esc(d.breeding || '—')}${d.breeding ? ' — ' + (BREEDING_LABEL[d.breeding] || '') : ''}</td>
      </tr>`;
    }).join('');

  const metaItems = [
    ['Project ID', meta.projectID],    ['Observer', meta.observer],
    ['Point ID', meta.pointID],        ['Survey Length', meta.surveyLength ? meta.surveyLength + ' min' : null],
    ['Start / End', [meta.startTime, meta.endTime].filter(Boolean).join(' – ')],
    ['Wind', meta.wind],               ['Wind Dir', meta.windDir],
    ['Temperature', meta.tempC ? meta.tempC + '°C' : null],
    ['Precipitation', meta.precip],    ['Site Habitat', meta.siteHabitat],
    ['Survey Location', (meta.surveyLat && meta.surveyLng)
      ? `${parseFloat(meta.surveyLat).toFixed(6)}, ${parseFloat(meta.surveyLng).toFixed(6)}` : null],
  ].filter(([, v]) => v)
   .map(([l, v]) => {
     const ed = (l === 'Project ID' || l === 'Observer') ? ' contenteditable="true"' : '';
     return `<div class="mi"><div class="ml">${l}</div><div class="mv"${ed}>${_esc(v)}</div></div>`;
   })
   .join('');

  // Auto-generated section text
  const surveyLocStr = (meta.surveyLat && meta.surveyLng)
    ? ` at survey point (${parseFloat(meta.surveyLat).toFixed(5)}, ${parseFloat(meta.surveyLng).toFixed(5)})` : '';

  const introAuto = `This breeding bird survey was conducted${surveyLocStr} by ${_esc(meta.observer || 'a qualified biologist')} (Project ${_esc(meta.projectID || 'N/A')}, Point ${_esc(meta.pointID || 'N/A')}). The survey was designed to document breeding bird species composition, relative abundance, and evidence of breeding activity within and adjacent to the project area.`;

  const methodsAuto = `The survey was conducted from ${_esc(meta.startTime || 'start time')}${meta.endTime ? ' to ' + _esc(meta.endTime) : ''} using a ${meta.surveyLength ? _esc(meta.surveyLength) + '-minute' : 'timed'} unlimited-distance point count. Weather conditions: wind ${_esc(meta.wind || 'not recorded')} (${_esc(meta.windDir || 'dir. not recorded')}), temperature ${meta.tempC ? _esc(meta.tempC) + '°C' : 'not recorded'}, precipitation ${_esc(meta.precip || 'none')}. Site habitat: ${_esc(meta.siteHabitat || 'not recorded')}. Breeding evidence was coded using the standardized North American Breeding Bird Atlas protocol (X/H/S/T/P/C).`;

  const findingsAuto = `The survey recorded <strong>${stats.speciesCount}</strong> species and <strong>${stats.totalIndividuals}</strong> individual birds. Confirmed breeding evidence (code C) was recorded for <strong>${stats.confirmedBreeding}</strong> species. ${stats.speciesCount > 20 ? 'Species richness was high for this survey type and habitat.' : stats.speciesCount > 10 ? 'Species richness was moderate and consistent with available habitat.' : 'Species richness was low.'}`;

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
  <title>Breeding Bird Survey Report — ${_esc(meta.pointID || meta.projectID || 'Survey')}</title>
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
    .star-dot{width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px #999;display:inline-block;flex-shrink:0;font-size:0.9rem;text-align:center;line-height:14px;}

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
      <strong>Breeding Bird Survey Report</strong>${meta.pointID ? ' — Point ' + _esc(meta.pointID) : ''}
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
      <div class="hdr-rt" contenteditable="true" title="Click to edit report title">Breeding Bird Survey Report</div>
      <div class="hdr-rd">Created: ${today}</div>
    </div>
  </div>

  <div class="mg">${metaItems}</div>

  <h2 contenteditable="true">1. Introduction</h2>
  ${toolbar('intro', 'ed-intro')}
  <div id="ed-intro" class="editable" contenteditable="true">${introAuto}</div>

  <h2 contenteditable="true">2. Methods &amp; Survey Conditions</h2>
  ${toolbar('methods', 'ed-methods')}
  <div id="ed-methods" class="editable" contenteditable="true">${methodsAuto}</div>

  <h2 contenteditable="true">3. Findings</h2>
  <div class="sr">
    <div class="sc"><div class="sv">${stats.speciesCount}</div><div class="sl">Total Species</div></div>
    <div class="sc"><div class="sv">${stats.totalIndividuals}</div><div class="sl">Total Individuals</div></div>
    <div class="sc"><div class="sv">${stats.confirmedBreeding}</div><div class="sl">Confirmed Breeding</div></div>
    <div class="sc"><div class="sv">${stats.surveyLength ? stats.surveyLength + ' min' : '—'}</div><div class="sl">Survey Duration</div></div>
  </div>
  ${toolbar('findings', 'ed-findings')}
  <div id="ed-findings" class="editable" contenteditable="true">${findingsAuto}</div>

  <h2 contenteditable="true">4. Species Summary</h2>
  <table>
    <thead><tr>
      <th>Species</th><th>Total Count</th><th>Highest Breeding Code</th>
    </tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>

  <h2 contenteditable="true">5. Observation Detail</h2>
  <table>
    <thead><tr>
      <th>#</th><th>Species</th><th>Count</th><th>Range</th><th>Bearing</th>
      <th>Breeding Evidence</th><th>Notes</th><th>Coordinates</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2 contenteditable="true">6. Observation Locations</h2>
  <div style="font-size:0.76rem;font-weight:600;color:var(--ca);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">Overview</div>
  ${mapImgSrc
    ? `<img src="${mapImgSrc}" style="width:100%;max-width:760px;border:1px solid #ccc;border-radius:4px;" alt="Observation locations overview" />`
    : `<p style="color:#888;font-style:italic;font-size:0.85rem;">Map unavailable — no GPS data or satellite imagery could not be loaded.</p>`}
  <div class="map-legend">
    <div class="ld"><span class="dot" style="background:#CC0000;"></span> Confirmed (C)</div>
    <div class="ld"><span class="dot" style="background:#E69138;"></span> Probable (P/T)</div>
    <div class="ld"><span class="dot" style="background:#4caf50;"></span> Possible (H/S)</div>
    <div class="ld"><span class="dot" style="background:#0f7abf;"></span> Observed (X)</div>
    <div class="ld"><span class="star-dot" style="background:#c9a227;">★</span> Survey Point</div>
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
    <span contenteditable="true">NTB Wildlife App — Breeding Bird Survey</span>
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
