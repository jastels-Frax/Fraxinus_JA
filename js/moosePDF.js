// js/moosePDF.js — General Wildlife Survey PDF report: interactive editor before print

import { mooseObservations } from './storageData.js';
import {
  mooseProjectID, mooseObserver, mooseTransectID, mooseSurveyDate,
  mooseStartTime, mooseEndTime, mooseVisibility, mooseSnowCover,
  mooseTempC, mooseWindSpeed, mooseNotes
} from './surveyGlobals.js';

const OBS_COLOUR = { Sighting: '#4caf50', Track: '#E69138', Heard: '#0f7abf', Sign: '#9b59b6' };

// ─── Preset text library ──────────────────────────────────────────────────────
const PRESETS = {
  intro: {
    'General Wildlife Inventory':
      'This general wildlife inventory was conducted to document the presence, relative abundance, and distribution of wildlife species within and adjacent to the study area. The survey was designed to record all vertebrate wildlife observations including mammals, birds, reptiles, and amphibians, with particular emphasis on species indicative of habitat quality and ecological connectivity.',
    'Winter Track Survey':
      'This winter track survey was conducted to assess wildlife activity within the study corridor during the winter season. Snow-tracking methods were used to identify species presence by recording tracks, trails, beds, and other sign in fresh snow. Winter track surveys provide valuable data on habitat use patterns, movement corridors, and relative activity levels for mammals that are otherwise cryptic or difficult to observe directly.',
    'Population & Habitat Index (PGI)':
      'This Population and Habitat Index (PGI) survey was conducted to assess wildlife community composition and habitat suitability within the project area. The survey methodology combined transect-based observation with habitat assessment to generate an index of wildlife activity relative to habitat structure, providing a basis for evaluating potential project impacts on local wildlife populations.',
    'Linear Corridor Assessment':
      'This wildlife survey was conducted along a linear project corridor to document species presence and identify potential wildlife movement pathways that may be affected by the proposed development. Survey effort was concentrated within the proposed right-of-way and within a 100-metre buffer on either side to capture species that use the corridor for movement, foraging, and cover.',
  },
  methods: {
    'Vehicle-Assisted Transect':
      'The survey was conducted using vehicle-assisted transect methods along accessible roads and tracks within the project area. The surveyor travelled at slow speed (&lt;20 km/h) to allow thorough scanning of roadside vegetation and adjacent habitats. Observations were recorded from the vehicle; areas of potential importance were investigated on foot. All wildlife observations were recorded with GPS coordinates, species identification, observation type, habitat association, and relevant behavioural notes.',
    'Snowtrack Transect Survey':
      'The survey was conducted using snowtrack transect methods following a period of fresh snowfall to maximize track detectability. Systematic transects were walked at a pace that allowed thorough inspection of the snow surface for mammal tracks, trails, beds, scat, and other sign. Track identification was made to species level where possible; photographs were taken of all significant finds. Track age was estimated based on snow condition and weather history.',
    'Pedestrian Area Search':
      'The survey was conducted using systematic pedestrian area search methods. The surveyor walked parallel transects spaced approximately 10–20 m apart across the project footprint, scanning all vegetation strata and substrates for wildlife and sign. Search effort was distributed proportionally across all habitat types present. All observations were recorded with GPS coordinates, time, species, observation type, and associated habitat notes.',
    'Camera-Supplemented Survey':
      'The survey combined systematic pedestrian transects with remote camera traps deployed at strategic locations to capture cryptic or nocturnal species. Camera stations were established at wildlife trails, riparian crossings, and habitat edges for a minimum deployment period prior to the survey date. All pedestrian observations and camera detections were combined in the final dataset to provide a comprehensive record of wildlife use within the study area.',
  },
  findings: {
    'No Wildlife Detected':
      'No wildlife observations or sign were recorded during the survey. The project area showed limited evidence of current wildlife activity. Habitat conditions within the footprint were assessed as low to moderate suitability for the target species assemblage. The absence of detections does not preclude occasional wildlife use of the area; however, based on survey effort and conditions, significant wildlife activity is not indicated at this time.',
    'Wildlife Detected — Moderate Activity':
      'Wildlife observations and/or sign were recorded within the project area, indicating moderate levels of wildlife activity. The species detected are consistent with the habitat types present and represent a typical assemblage for the region. Observations were distributed across the survey area. Survey conditions were adequate for detection of wildlife activity.',
    'High Wildlife Activity':
      'Significant wildlife activity was recorded throughout the survey area. The diversity and abundance of species and sign detected indicate that the project footprint and adjacent habitats provide important resources for local wildlife populations. These findings warrant careful consideration in project planning and impact assessment.',
    'Low Wildlife Activity':
      'Limited wildlife activity was detected during the survey. Observations were sparse and restricted to generalist species tolerant of disturbed conditions. The low detection rate may reflect seasonal or temporal factors, and it is acknowledged that actual wildlife use may be higher than indicated by this single survey.',
  },
  recommendations: {
    'No Concerns — Standard Practice':
      'Based on the results of this wildlife survey, no significant wildlife concerns have been identified within the project footprint. The proposed activity may proceed in accordance with applicable wildlife regulations, subject to the following standard conditions:\n\n1. All work must comply with the Migratory Birds Convention Act (MBCA) and provincial wildlife legislation.\n2. Pre-clearance nest surveys must be conducted prior to any vegetation clearing during the nesting season.\n3. The contractor must halt work immediately if a Species at Risk is observed and notify Fraxinus Environmental &amp; Geomatics within 24 hours.\n4. Wildlife movement across the project footprint should be maintained to the extent practicable throughout construction.',
    'Follow-Up Survey Recommended':
      'Based on the wildlife activity documented during this survey, a follow-up survey is recommended to confirm seasonal patterns of use and to assess potential project impacts more fully. The following actions are recommended:\n\n1. A second survey should be conducted during the appropriate season to capture peak activity for key species detected.\n2. Survey effort should focus on habitat features and locations identified as important during this survey.\n3. Results of the follow-up survey should be reviewed prior to finalizing project design and mitigation measures.\n4. Contact Fraxinus Environmental &amp; Geomatics to schedule follow-up survey timing relative to project timelines.',
    'Habitat Buffer Recommended':
      'Wildlife activity patterns documented during this survey indicate that habitat features within or adjacent to the project footprint support regular use by wildlife. The following habitat protection measures are recommended:\n\n1. A no-disturbance buffer of [X] metres should be established around high-value wildlife habitat features during construction.\n2. The buffer boundary must be physically delineated with high-visibility flagging tape or temporary fencing prior to the start of any ground disturbance.\n3. Vegetation clearing within the buffer zone should be avoided or minimized; any required clearing must be approved by a qualified biologist.\n4. Post-construction habitat restoration should be considered for disturbed areas within or adjacent to the identified high-value habitat.',
    'Species Management Plan Required':
      'One or more observations during this survey indicate the potential presence of Species at Risk (SAR) or species requiring specific management consideration. The following actions are required prior to proceeding with the proposed activity:\n\n1. A targeted Species at Risk assessment must be conducted by a qualified SAR biologist to confirm species presence and assess potential project impacts.\n2. Consultation with Environment and Climate Change Canada (ECCC) and/or the applicable provincial wildlife authority is required.\n3. A Species Management Plan or equivalent regulatory submission may be required before project approvals can be obtained.\n4. Fraxinus Environmental &amp; Geomatics should be engaged to coordinate regulatory consultations and prepare required technical documentation.\n5. No work that may affect the identified species or its habitat should proceed until all regulatory requirements have been satisfied.',
  },
};

// ─── Auto-select the most relevant Recommendations preset ─────────────────────
function _autoRecKey(obs) {
  const speciesLower = obs.map(o => (o.species || '').toLowerCase());
  if (speciesLower.some(s => s.includes('bear') || s.includes('moose') || s.includes('wolf') || s.includes('lynx')))
    return 'Species Management Plan Required';
  if (obs.length > 15) return 'Habitat Buffer Recommended';
  if (obs.length > 0)  return 'Follow-Up Survey Recommended';
  return 'No Concerns — Standard Practice';
}

// ─── Main export entry point ──────────────────────────────────────────────────
export async function exportMoosePDF() {
  const obs = [...mooseObservations];
  if (!obs.length) {
    alert('No wildlife observations to export.');
    return;
  }

  const meta = {
    projectID:   mooseProjectID,  observer:   mooseObserver,
    transectID:  mooseTransectID, surveyDate: mooseSurveyDate,
    startTime:   mooseStartTime,  endTime:    mooseEndTime,
    visibility:  mooseVisibility, snowCover:  mooseSnowCover,
    tempC:       mooseTempC,      windSpeed:  mooseWindSpeed,
    notes:       mooseNotes,
  };

  const total      = obs.length;
  const sightings  = obs.filter(o => o.obsType === 'Sighting').length;
  const tracks     = obs.filter(o => o.obsType === 'Track').length;
  const speciesSet = [...new Set(obs.map(o => o.species).filter(Boolean))];
  const stats = { total, sightings, tracks, speciesSet };

  const lats = obs.map(o => o.latlng?.lat).filter(Number.isFinite);
  const lngs = obs.map(o => o.latlng?.lng).filter(Number.isFinite);

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
    mapImgSrc = await _buildMapImage(url, obs, bboxW, bboxS, bboxE, bboxN, mapW, mapH);
  }

  const detailMaps = lats.length > 0 ? await _buildDetailMaps(obs) : [];

  const w = window.open('', '_blank', 'width=980,height=800,scrollbars=yes');
  if (!w) { alert('Pop-up blocked — please allow pop-ups for this app, then try again.'); return; }
  w.document.write(_buildHTML(meta, obs, stats, mapImgSrc, detailMaps));
  w.document.close();
}

// ─── Satellite basemap + plotted points ───────────────────────────────────────
async function _buildMapImage(arcgisURL, obs, west, south, east, north, mapW, mapH) {
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
        obs.forEach((o, i) => plot(o.latlng, OBS_COLOUR[o.obsType] || '#888', 11, false, o._origIdx ?? i + 1));
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
async function _buildDetailMaps(obs) {
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
    const mapW = 760, mapH = 400;
    const url = `https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bboxW},${bboxS},${bboxE},${bboxN}&bboxSR=4326&size=${mapW},${mapH}&f=image`;
    const imgSrc = await _buildMapImage(url, cluster, bboxW, bboxS, bboxE, bboxN, mapW, mapH);
    results.push({ imgSrc, indices: cluster.map(o => o._origIdx) });
  }
  return results;
}

// ─── Build full HTML for the editor/report window ─────────────────────────────
function _buildHTML(meta, obs, stats, mapImgSrc, detailMaps) {
  const today        = new Date().toLocaleDateString('en-CA');
  const colorLogoSrc = new URL('img/LOGO w TEXT white and green.jpg', window.location.href).href;
  const bwLogoSrc    = new URL('img/LOGO w TEXT black bg.jpg', window.location.href).href;
  const logoSrc      = colorLogoSrc;

  const presetsJSON = JSON.stringify(PRESETS);

  // Observation table rows
  const tableRows = obs.map((o, i) => {
    const colour = OBS_COLOUR[o.obsType] || '#888';
    const coords = Number.isFinite(o.latlng?.lat)
      ? `${o.latlng.lat.toFixed(5)}, ${o.latlng.lng.toFixed(5)}` : '';
    return `<tr>
      <td>${i + 1}</td>
      <td contenteditable="true">${_esc(o.species || '')}</td>
      <td contenteditable="true" style="color:${colour};font-weight:600;">${_esc(o.obsType || '')}</td>
      <td contenteditable="true">${_esc(o.habitat || '')}</td>
      <td contenteditable="true">${_esc(o.photoRef || '')}</td>
      <td contenteditable="true">${_esc(o.note || '')}</td>
      <td contenteditable="true" style="font-size:0.7rem;color:#555;">${coords}</td>
    </tr>`;
  }).join('');

  const speciesHtml = stats.speciesSet.length
    ? stats.speciesSet.map(s => `<span class="sp-chip">${_esc(s)}</span>`).join('')
    : '<em>None recorded</em>';

  // Most observed species
  const speciesCounts = {};
  obs.forEach(o => { if (o.species) speciesCounts[o.species] = (speciesCounts[o.species] || 0) + 1; });
  const topSpecies = Object.entries(speciesCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  const metaItems = [
    ['Project ID', meta.projectID],   ['Observer', meta.observer],
    ['Transect ID', meta.transectID], ['Survey Date', meta.surveyDate],
    ['Start / End', [meta.startTime, meta.endTime].filter(Boolean).join(' – ')],
    ['Visibility', meta.visibility],  ['Snow Cover', meta.snowCover ? meta.snowCover + '%' : null],
    ['Temperature', meta.tempC ? meta.tempC + '°C' : null],
    ['Wind Speed', meta.windSpeed],
  ].filter(([, v]) => v)
   .map(([l, v]) => {
     const ed = (l === 'Project ID' || l === 'Observer') ? ' contenteditable="true"' : '';
     return `<div class="mi"><div class="ml">${l}</div><div class="mv"${ed}>${_esc(v)}</div></div>`;
   })
   .join('');

  // Survey Conditions grid (non-editable)
  const conditionItems = [
    ['Temperature', meta.tempC ? meta.tempC + '°C' : '—'],
    ['Wind Speed',  meta.windSpeed || '—'],
    ['Visibility',  meta.visibility || '—'],
    ['Snow Cover',  meta.snowCover ? meta.snowCover + '%' : '—'],
    ['Notes',       meta.notes || '—'],
  ].map(([l, v]) =>
    `<div class="cg-item"><div class="cg-lbl">${l}</div><div class="cg-val">${_esc(v)}</div></div>`
  ).join('');

  // Auto-generated section text
  const introAuto = `This general wildlife survey was conducted along Transect ${_esc(meta.transectID || 'N/A')} by ${_esc(meta.observer || 'a qualified biologist')} (Project ${_esc(meta.projectID || 'N/A')}) on ${_esc(meta.surveyDate || 'the survey date')}. The purpose of the survey was to document wildlife species presence, activity, and habitat associations within the study area in the context of the proposed project activities.`;

  const methodsAuto = `The survey was conducted using transect-based observation methods from ${_esc(meta.startTime || 'start time')}${meta.endTime ? ' to ' + _esc(meta.endTime) : ''}. Survey conditions included visibility rated as ${_esc(meta.visibility || 'not recorded')} and snow cover of approximately ${meta.snowCover ? _esc(meta.snowCover) + '%' : 'not recorded'}. All wildlife observations and sign were recorded with GPS coordinates, species identification, observation type (Sighting, Track, Heard, or Sign), habitat association, and relevant notes.`;

  const findingsAuto = `A total of <strong>${stats.total}</strong> wildlife observation${stats.total !== 1 ? 's were' : ' was'} recorded during the survey, comprising <strong>${stats.speciesSet.length}</strong> unique species or taxa. Sightings accounted for <strong>${stats.sightings}</strong> observation${stats.sightings !== 1 ? 's' : ''} and tracks for <strong>${stats.tracks}</strong>. ${topSpecies ? `The most frequently observed taxon was <em>${_esc(topSpecies)}</em>.` : ''} Species detected: ${speciesHtml}.`;

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
  <title>General Wildlife Survey Report — ${_esc(meta.transectID || meta.projectID || 'Survey')}</title>
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

    .sp-chip{display:inline-block;background:var(--ct);border:1px solid var(--ca);border-radius:3px;padding:1px 7px;font-size:0.78rem;margin:2px;}

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
      <strong>General Wildlife Survey Report</strong>${meta.transectID ? ' — ' + _esc(meta.transectID) : ''}
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
      <div class="hdr-rt" contenteditable="true" title="Click to edit report title">General Wildlife Survey Report</div>
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
    <div class="sc"><div class="sv">${stats.total}</div><div class="sl">Total Obs.</div></div>
    <div class="sc"><div class="sv">${stats.speciesSet.length}</div><div class="sl">Unique Species</div></div>
    <div class="sc"><div class="sv">${stats.sightings}</div><div class="sl">Sightings</div></div>
    <div class="sc"><div class="sv">${stats.tracks}</div><div class="sl">Tracks</div></div>
  </div>
  ${toolbar('findings', 'ed-findings')}
  <div id="ed-findings" class="editable" contenteditable="true">${findingsAuto}</div>

  <h2 contenteditable="true">5. Wildlife Observations</h2>
  <table>
    <thead><tr>
      <th>#</th><th>Species</th><th>Type</th><th>Habitat</th>
      <th>Photo Ref</th><th>Notes</th><th>Coordinates</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2 contenteditable="true">6. Observation Locations</h2>
  <div style="font-size:0.76rem;font-weight:600;color:var(--ca);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:5px;">Overview</div>
  ${mapImgSrc
    ? `<img src="${mapImgSrc}" style="width:100%;max-width:760px;border:1px solid #ccc;border-radius:4px;" alt="Observation locations overview" />`
    : `<p style="color:#888;font-style:italic;font-size:0.85rem;">Map unavailable — no GPS data or satellite imagery could not be loaded.</p>`}
  <div class="map-legend">
    <div class="ld"><span class="dot" style="background:#4caf50;"></span> Sighting</div>
    <div class="ld"><span class="dot" style="background:#E69138;"></span> Track</div>
    <div class="ld"><span class="dot" style="background:#0f7abf;"></span> Heard</div>
    <div class="ld"><span class="dot" style="background:#9b59b6;"></span> Sign</div>
  </div>

  ${detailSection ? `<div style="font-size:0.76rem;font-weight:600;color:var(--ca);text-transform:uppercase;letter-spacing:0.07em;margin-top:18px;margin-bottom:10px;padding-top:12px;border-top:1px solid var(--cb);">Detail Views</div>
  ${detailSection}` : ''}

  <h2 contenteditable="true">7. Recommendations</h2>
  ${toolbar('recommendations', 'ed-recs')}
  <div id="ed-recs" class="editable" contenteditable="true"></div>

  <div class="ft">
    <span contenteditable="true">Fraxinus Environmental &amp; Geomatics</span>
    <span contenteditable="true">NTB Wildlife App — General Wildlife Survey</span>
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
