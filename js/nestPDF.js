// js/nestPDF.js — Nest Sweep PDF report: interactive editor before print

import { nestObservations, habitatObservations } from './storageData.js';
import {
  nestProjectID, nestObserver, nestClient, nestSiteName, nestMunicipality,
  nestSurveyDate, nestStartTime, nestEndTime,
  nestProposedActivity, nestHabitatTypes, nestSurveyMethod, nestAreaHa,
  nestTempC, nestWind, nestPrecip, nestProvince
} from './surveyGlobals.js';

const STATUS_COLOUR = { Active: '#CC0000', Inactive: '#888888', Unknown: '#E69138' };

// ─── Preset text library ──────────────────────────────────────────────────────
const PRESETS = {
  intro: {
    'MBCA & MBR 2022 (Standard)':
      'This pre-disturbance nest survey was conducted in accordance with the <em>Migratory Birds Convention Act</em> (MBCA) and the <em>Migratory Bird Regulations, 2022</em> (MBR 2022). The purpose of the survey was to identify, assess, and document active or recently active bird nests within or adjacent to the area potentially affected by the proposed activity, prior to any vegetation removal or ground disturbance.',
    'MBCA + Provincial ESA':
      'This pre-disturbance nest survey was conducted in accordance with the <em>Migratory Birds Convention Act</em> (MBCA), the <em>Migratory Bird Regulations, 2022</em> (MBR 2022), and applicable provincial endangered species legislation. The survey was designed to detect and protect both migratory bird nests and nests associated with provincially listed species at risk.',
    'Demolition / Structure Removal':
      'This pre-disturbance nest survey was conducted prior to the planned demolition or modification of structures in accordance with the <em>Migratory Birds Convention Act</em> (MBCA) and MBR 2022. Structures (buildings, bridges, culverts, towers) were inspected for evidence of active or recently active nesting by migratory birds, including ledge nests, cavity nests, and mud nests on interior surfaces.',
    'Linear / Infrastructure Corridor':
      'This pre-disturbance nest survey was conducted along the proposed infrastructure corridor in accordance with the <em>Migratory Birds Convention Act</em> (MBCA) and MBR 2022. The survey assessed vegetation communities, utility structures, and ground cover within the proposed right-of-way for evidence of active nesting activity prior to clearing.',
  },
  methods: {
    'Standard Pedestrian Sweep':
      'The survey area was assessed on foot using standard pedestrian sweep methods. The surveyor walked systematic transects spaced approximately 5–10 m apart across the project footprint, scanning vegetation at all heights for evidence of nesting activity including nest structures, flushed adults, and distress calls. Dense shrub and canopy were probed carefully; elevated structures were visually inspected from ground level.',
    'Vehicle-Assisted Transect':
      'The survey was conducted using vehicle-assisted methods along accessible roads and trails, supplemented by on-foot transects through areas not accessible by vehicle. Slow vehicle speeds (&lt;10 km/h) were maintained to allow thorough visual inspection of roadside vegetation. The surveyor exited the vehicle to investigate potential nest areas detected during the drive.',
    'Ladder / Elevated Structure Inspection':
      'The survey included elevated structure inspections using an extendable ladder and/or bucket truck to access nest boxes, building ledges, bridge overhangs, and large-diameter tree cavities above 2 m. All accessible elevated features were physically inspected for nest contents. Ground-level pedestrian sweeps were also conducted throughout the project footprint.',
    'Boat-Based Riparian Survey':
      'The riparian survey area was assessed from a canoe/small watercraft along the watercourse at low speed, supplemented by on-foot transects along both banks. Overhanging banks, root mats, streamside shrubs, and riparian tree cavities were inspected for nest structures and nesting activity. All accessible nest sites were approached carefully to minimize flush events.',
    'Drone-Assisted Overview (Supplementary)':
      'In addition to ground-based pedestrian sweeps, a drone (UAV) equipped with a high-resolution camera was used to supplement nest detection in areas with dense canopy or restricted access. Drone flights were conducted at low altitude (&lt;30 m AGL) with the gimbal angled to inspect canopy surfaces. Ground-truthing was conducted for all potential nest sites identified by drone.',
  },
  findings: {
    'No Nests Detected':
      'No active or recently active bird nests were detected within the project footprint during the survey. Survey conditions were [good/adequate] and the entire project area was covered systematically. While the absence of nests cannot be guaranteed for the full breeding season, the survey results support proceeding with the proposed activity subject to the conditions outlined in Section 5.',
    'Active Nests Present':
      'Active nests were detected within or immediately adjacent to the project footprint. Nest status was confirmed by direct observation of eggs, chicks, or incubating/brooding adults. The active nests are mapped in Section 6 and detailed in the Observation Summary. Work restrictions are in effect for the affected areas until nesting is complete.',
    'Inactive Nests Only':
      'Only inactive (empty) nests were detected within the project footprint. No eggs, chicks, or incubating adults were observed. While nest structures were present, no nesting activity was underway at the time of the survey. Nest activity can change rapidly during the breeding season; the conditions outlined in Section 5 should be followed throughout the work period.',
    'Mixed Active and Inactive':
      'Both active and inactive nests were detected within and adjacent to the project footprint. Active nests require immediate work restrictions as detailed in Section 5. Inactive nest structures were recorded for reference but do not independently trigger restrictions under the MBCA unless they become active.',
  },
  recommendations: {
    'No Restrictions — Work Can Proceed':
      'Based on the results of this pre-disturbance nest survey, no active nests were detected within or immediately adjacent to the project footprint. Work may proceed as planned, subject to the following standard conditions:\n\n1. The contractor must maintain awareness of nesting bird activity throughout the duration of clearing operations.\n2. Work must halt immediately if an active nest is discovered, and Fraxinus Environmental &amp; Geomatics must be notified within 24 hours.\n3. If the work schedule extends beyond [DATE], a follow-up nest survey is recommended prior to resuming vegetation clearing.\n4. Cleared material should be removed from site promptly to discourage opportunistic nesting on debris piles.',
    'Active Nest — Work Delay Required':
      'One or more active nests were detected within the proposed work area. In accordance with the <em>Migratory Birds Convention Act</em> (MBCA) and MBR 2022, the following restrictions apply:\n\n1. All work within [X] m of the active nest(s) must be suspended until nesting is complete and young have fledged.\n2. The anticipated fledging date is approximately [DATE]. A qualified biologist must conduct a follow-up inspection prior to resuming work in the affected area.\n3. If project timelines require work before the fledging date, an Environment and Climate Change Canada (ECCC) permit under Section 5.1 of the MBCA may be required.\n4. The active nest locations must be physically delineated with flagging tape or temporary fencing prior to any nearby work.\n5. Fraxinus Environmental &amp; Geomatics should be notified immediately of any changes in nest status.',
    'Buffer Zone Required':
      'A no-disturbance buffer zone is recommended around the nest location(s) identified in this report. Work may proceed outside the established buffer subject to the following conditions:\n\n1. A [X]-metre buffer must be physically delineated with high-visibility flagging tape or temporary construction fencing prior to the start of any ground disturbance or vegetation clearing.\n2. No vegetation clearing, heavy equipment operation, stockpiling, or other high-disturbance activities shall occur within the buffer until the nest is confirmed inactive.\n3. A qualified biologist must inspect the buffer zone boundary prior to any encroachment to confirm nest status.\n4. Buffer dimensions may be adjusted based on species sensitivity and site conditions, subject to approval by Fraxinus Environmental &amp; Geomatics.',
    'Schedule 1 / SAR Consultation Required':
      'One or more nest observations may involve species listed under Schedule 1 of the <em>Species at Risk Act</em> (SARA) and/or the applicable provincial endangered species legislation. The following additional requirements apply:\n\n1. Consultation with Environment and Climate Change Canada (ECCC) Wildlife Service is required prior to any work that could affect these species or their nests, eggs, or young.\n2. A Recovery Strategy or Action Plan for the species may specify additional habitat protections beyond those afforded by the MBCA.\n3. A Section 73 SARA permit or provincial equivalent may be required if the project cannot avoid impacting the species or its critical habitat.\n4. Fraxinus Environmental &amp; Geomatics recommends retaining a qualified species-at-risk biologist to assess cumulative impacts and prepare any required regulatory submissions.\n5. Work in affected areas must not proceed until all federal and provincial regulatory requirements are satisfied.',
    'Pre-Clearance Monitoring Protocol':
      'A pre-clearance monitoring protocol is required for this project. The following steps must be completed prior to and during vegetation clearing:\n\n1. A qualified biologist must conduct a nest check within 48 hours immediately prior to any vegetation clearing or ground disturbance. This inspection must cover the full work area, not only areas where nests were previously detected.\n2. If active nests are found at pre-clearance, work must be postponed and Fraxinus Environmental &amp; Geomatics notified within 24 hours.\n3. All pre-clearance monitoring visits must be documented (date, time, observer name, weather, findings) and records retained as part of the project environmental file for a minimum of two years.\n4. The contractor must maintain a copy of this report and all pre-clearance monitoring records on-site throughout clearing operations and make them available to regulatory inspectors upon request.',
    'Conditional Proceed (Inactive Season)':
      'Vegetation clearing may proceed subject to the following conditions applicable to work scheduled outside the core breeding season:\n\n1. All clearing must be completed before [START DATE] or commenced after [END DATE] to avoid the peak nesting period for species detected during this survey.\n2. If work cannot be completed within the inactive season window, a qualified biologist must conduct a pre-clearance nest survey within 48 hours prior to resuming clearing.\n3. Any nest detected at pre-clearance must be assessed for activity status before work continues.\n4. The contractor must have contact information for Fraxinus Environmental &amp; Geomatics on-site at all times during clearing to facilitate rapid response if nesting activity is observed.',
  },
};

// ─── Auto-select the most relevant Recommendations preset ─────────────────────
function _autoRecKey(obs, stats) {
  if (obs.some(o => o.sched1 === 'Yes' || o.sar === 'Yes'))
    return 'Schedule 1 / SAR Consultation Required';
  if (stats.active > 0 && obs.some(o => o.disposition?.toLowerCase().includes('delay')))
    return 'Active Nest — Work Delay Required';
  if (stats.requiresAction > 0)
    return 'Buffer Zone Required';
  if (stats.total > 0)
    return 'No Restrictions — Work Can Proceed';
  return 'No Restrictions — Work Can Proceed';
}

// ─── Main export entry point ──────────────────────────────────────────────────
export async function exportNestPDF() {
  const obs    = [...nestObservations];
  const habObs = [...habitatObservations].filter(o => o.surveyType === 'NEST');
  if (!obs.length && !habObs.length) {
    alert('No nest observations to export.');
    return;
  }

  const meta = {
    projectID:        nestProjectID,  observer:   nestObserver,
    client:           nestClient,     siteName:   nestSiteName,
    municipality:     nestMunicipality, province: nestProvince,
    surveyDate:       nestSurveyDate, startTime:  nestStartTime,
    endTime:          nestEndTime,    proposedActivity: nestProposedActivity,
    habitatTypes:     nestHabitatTypes, surveyMethod: nestSurveyMethod,
    areaHa:           nestAreaHa,     tempC:      nestTempC,
    wind:             nestWind,       precip:     nestPrecip,
  };

  const total          = obs.length;
  const active         = obs.filter(o => o.status === 'Active').length;
  const inactive       = obs.filter(o => o.status === 'Inactive').length;
  const unknown        = obs.filter(o => o.status === 'Unknown').length;
  const requiresAction = obs.filter(o =>
    o.disposition && o.disposition !== 'Work can proceed'
  ).length;
  const speciesSet = [...new Set(obs.map(o => o.species).filter(Boolean))];
  const stats = { total, active, inactive, unknown, requiresAction, speciesSet };

  const allPts = [...obs, ...habObs];
  const lats   = allPts.map(o => o.latlng?.lat).filter(Number.isFinite);
  const lngs   = allPts.map(o => o.latlng?.lng).filter(Number.isFinite);

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

  const w = window.open('', '_blank', 'width=980,height=800,scrollbars=yes');
  if (!w) { alert('Pop-up blocked — please allow pop-ups for this app, then try again.'); return; }
  w.document.write(_buildHTML(meta, obs, habObs, stats, mapImgSrc));
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
        const plot = (ll, colour, r, dash) => {
          if (!Number.isFinite(ll?.lat)) return;
          const x = ((ll.lng - west) / lngSpan) * mapW;
          const y = (1 - (ll.lat - south) / latSpan) * mapH;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = colour; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
          if (dash) ctx.setLineDash([4, 3]);
          ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
        };
        habObs.forEach(o => plot(o.latlng, '#0f7abf', 7, true));
        obs.forEach(o   => plot(o.latlng, STATUS_COLOUR[o.status] || '#888', 9, false));
        resolve(canvas.toDataURL('image/png'));
      } catch { resolve(null); }
    };
    img.onerror = () => resolve(null);
    img.src = arcgisURL;
  });
}

// ─── Build full HTML for the editor/report window ─────────────────────────────
function _buildHTML(meta, obs, habObs, stats, mapImgSrc) {
  const today   = new Date().toLocaleDateString('en-CA');
  const colorLogoSrc = new URL('img/LOGO w TEXT white and green.jpg', window.location.href).href;
  const bwLogoSrc    = new URL('img/LOGO w TEXT black.jpg', window.location.href).href;
  const logoSrc      = colorLogoSrc;

  // Auto-select best-fit recommendation
  const autoRec = PRESETS.recommendations[_autoRecKey(obs, stats)] || '';

  // Serialize PRESETS for embedding in the window script
  const presetsJSON = JSON.stringify(PRESETS);

  // Observation table rows
  const tableRows = obs.map((o, i) => {
    const colour   = STATUS_COLOUR[o.status] || '#888';
    const contents = (o.contents || []).join(', ');
    const coords   = Number.isFinite(o.latlng?.lat)
      ? `${o.latlng.lat.toFixed(5)}, ${o.latlng.lng.toFixed(5)}` : '';
    return `<tr>
      <td>${i + 1}</td>
      <td contenteditable="true">${_esc(o.species || 'Unknown')}</td>
      <td contenteditable="true" style="color:${colour};font-weight:600;">${_esc(o.status || '')}</td>
      <td contenteditable="true">${_esc(o.disposition || '')}</td>
      <td contenteditable="true">${_esc(contents)}</td>
      <td contenteditable="true">${_esc(o.substrate || '')}</td>
      <td contenteditable="true">${o.buffer ? _esc(String(o.buffer)) + ' m' : ''}</td>
      <td contenteditable="true">${_esc(o.note || '')}</td>
      <td contenteditable="true" style="font-size:0.7rem;color:#555;">${coords}</td>
    </tr>`;
  }).join('');

  const habRows = habObs.map((o, i) => {
    const coords = Number.isFinite(o.latlng?.lat)
      ? `${o.latlng.lat.toFixed(5)}, ${o.latlng.lng.toFixed(5)}` : '';
    return `<tr>
      <td>${i + 1}</td><td>${_esc(o.featureType || '')}</td>
      <td>${_esc((o.criteria || []).join(', '))}</td>
      <td>${_esc(o.note || '')}</td>
      <td style="font-size:0.7rem;color:#555;">${coords}</td>
    </tr>`;
  }).join('');

  const habSection = habObs.length ? `
    <h2 contenteditable="true">7. Habitat Features</h2>
    <table>
      <thead><tr><th>#</th><th>Feature Type</th><th>Criteria Met</th><th>Notes</th><th>Coordinates</th></tr></thead>
      <tbody>${habRows}</tbody>
    </table>` : '';

  const speciesHtml = stats.speciesSet.length
    ? stats.speciesSet.map(s => `<span class="sp-chip">${_esc(s)}</span>`).join('')
    : '<em>None recorded</em>';

  const weatherLine = [
    meta.tempC ? meta.tempC + '°C' : null, meta.wind || null, meta.precip || null,
  ].filter(Boolean).join(', ') || 'not recorded';

  const editableMetaFields = new Set(['Project ID', 'Observer']);
  const metaItems = [
    ['Project ID', meta.projectID], ['Client', meta.client],
    ['Site Name', meta.siteName],   ['Municipality', meta.municipality],
    ['Province', meta.province],    ['Survey Date', meta.surveyDate],
    ['Observer', meta.observer],    ['Start / End', [meta.startTime, meta.endTime].filter(Boolean).join(' – ')],
    ['Proposed Activity', meta.proposedActivity], ['Survey Area', meta.areaHa ? meta.areaHa + ' ha' : null],
    ['Survey Method', meta.surveyMethod], ['Habitat Types', meta.habitatTypes],
  ].filter(([, v]) => v)
   .map(([l, v]) => {
     const ed = editableMetaFields.has(l) ? ' contenteditable="true"' : '';
     return `<div class="mi"><div class="ml">${l}</div><div class="mv"${ed}>${_esc(v)}</div></div>`;
   })
   .join('');

  // Auto-generated intro / methods initial text
  const introAuto = `This pre-disturbance nest survey was conducted at ${_esc(meta.siteName || 'the project site')}${meta.municipality ? ', ' + _esc(meta.municipality) : ''}${meta.province ? ' (' + _esc(meta.province) + ')' : ''} in accordance with the <em>Migratory Birds Convention Act</em> (MBCA) and the <em>Migratory Bird Regulations, 2022</em> (MBR 2022). The purpose of the survey was to identify, assess, and document active or recently active bird nests within or adjacent to the area potentially affected by ${_esc(meta.proposedActivity || 'the proposed activity')}, prior to any vegetation removal or ground disturbance.`;

  const methodsAuto = `The survey was conducted by ${_esc(meta.observer || 'a qualified biologist')} on behalf of ${_esc(meta.client || 'the client')} (Project ${_esc(meta.projectID || 'N/A')}) on ${_esc(meta.surveyDate || 'the survey date')}${meta.startTime ? ', from ' + _esc(meta.startTime) + (meta.endTime ? ' to ' + _esc(meta.endTime) : '') : ''}. The survey area encompassed approximately ${meta.areaHa ? _esc(meta.areaHa) + ' ha' : 'the project footprint'} and was assessed using ${_esc(meta.surveyMethod || 'standard pedestrian sweep methods')}. Habitat types present included: ${_esc(meta.habitatTypes || 'mixed vegetation')}. Nest status (Active / Inactive / Unknown), contents, nest type, and the presence of Schedule&nbsp;1 or SAR species were recorded for each observation. Weather conditions: ${weatherLine}.`;

  const findingsAuto = `A total of <strong>${stats.total}</strong> nest${stats.total !== 1 ? 's were' : ' was'} recorded during the survey${stats.total > 0 ? ': <strong>${stats.active}</strong> active, <strong>${stats.inactive}</strong> inactive, and <strong>${stats.unknown}</strong> of unknown status' : ''}. ${stats.requiresAction > 0 ? `<strong>${stats.requiresAction}</strong> observation${stats.requiresAction !== 1 ? 's require' : ' requires'} a work delay, buffer zone, or regulatory consultation.` : 'No work restrictions are required based on the survey findings.'} Species detected during the survey included: ${speciesHtml}.`;

  const mapSection = mapImgSrc
    ? `<img src="${mapImgSrc}" style="width:100%;max-width:760px;border:1px solid #ccc;border-radius:4px;" alt="Observation locations" />`
    : `<p style="color:#888;font-style:italic;font-size:0.85rem;">Map unavailable — no GPS data or device is offline.</p>`;

  // Helper to build a preset toolbar
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
  <title>Nest Sweep Report — ${_esc(meta.siteName || 'Site')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    :root{--ca:#2d6b2d;--cal:#4caf50;--ct:#f8faf8;--cb:#cde8cd;}
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Oswald','Segoe UI',sans-serif;color:#1a1a1a;background:#f4f4f4;font-size:10.5pt;line-height:1.55;}
    @page{margin:14mm 14mm 14mm 14mm;size:A4;}
    @media print{
      .no-print{display:none!important;}
      body{background:#fff;font-size:9.5pt;}
      .page{box-shadow:none;margin-top:0;}
      .editable{border:none!important;background:transparent!important;padding:0!important;}
      [contenteditable]{outline:none!important;background:transparent!important;}
    }

    /* Sticky top bar */
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

    /* Page */
    .page{max-width:780px;margin:72px auto 40px;padding:28px 32px 36px;background:#fff;box-shadow:0 2px 12px rgba(0,0,0,0.12);}

    /* Branding header */
    .hdr{display:flex;align-items:center;gap:20px;padding-bottom:14px;border-bottom:3px solid var(--ca);margin-bottom:22px;}
    .hdr img{height:72px;width:auto;}
    .hdr-rt{font-size:1.2rem;font-weight:600;color:#111;letter-spacing:0.03em;border-bottom:1px dashed transparent;border-radius:2px;outline:none;transition:border-color 0.15s,background 0.15s;}
    .hdr-rt:hover{border-bottom-color:var(--cb);}
    .hdr-rt:focus{border-bottom-color:var(--ca);background:var(--ct);}
    .hdr-rd{font-size:0.74rem;color:#888;font-weight:300;margin-top:2px;}

    /* Meta grid */
    .mg{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:22px;padding:14px 16px;background:var(--ct);border:1px solid var(--cb);border-radius:6px;}
    .ml{font-size:0.67rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--ca);font-weight:600;}
    .mv{font-size:0.87rem;}

    /* Section headings */
    h2{font-size:0.85rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:var(--ca);border-bottom:1px solid var(--cb);padding-bottom:3px;margin:22px 0 8px;}

    /* Editable sections */
    .editable{border:1px solid transparent;border-radius:4px;padding:6px 8px;outline:none;transition:border-color 0.15s,background 0.15s;font-size:0.87rem;font-weight:300;line-height:1.6;min-height:1.6em;}
    .editable:hover{border-color:var(--cb);background:var(--ct);}
    .editable:focus{border-color:var(--ca);background:var(--ct);outline:2px solid rgba(45,107,45,0.12);}
    .editable p, .editable br+br{margin-bottom:0.5em;}

    /* Preset toolbar */
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

    /* Stat chips */
    .sr{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;}
    .sc{background:var(--ct);border:1px solid var(--cb);border-radius:6px;padding:6px 14px;text-align:center;min-width:72px;}
    .sv{font-size:1.5rem;font-weight:700;color:var(--ca);line-height:1.2;}
    .sl{font-size:0.66rem;text-transform:uppercase;letter-spacing:0.05em;color:#666;}
    .sc.act .sv{color:#CC0000;}.sc.ina .sv{color:#888;}.sc.unk .sv{color:#E69138;}.sc.req .sv{color:#CC0000;}

    /* Species chips */
    .sp-chip{display:inline-block;background:var(--ct);border:1px solid var(--ca);border-radius:3px;padding:1px 7px;font-size:0.78rem;margin:2px;}

    /* Table */
    table{width:100%;border-collapse:collapse;font-size:0.76rem;margin-top:6px;}
    th{background:var(--ca);color:#fff;font-weight:600;padding:5px 6px;text-align:left;letter-spacing:0.04em;font-size:0.7rem;}
    td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top;}
    tr:nth-child(even) td{background:#f9fbf9;}

    /* Map legend */
    .map-legend{display:flex;gap:16px;margin-top:8px;font-size:0.76rem;flex-wrap:wrap;}
    .ld{display:flex;align-items:center;gap:5px;}
    .dot{width:11px;height:11px;border-radius:50%;border:1.5px solid #fff;box-shadow:0 0 0 1px #999;display:inline-block;flex-shrink:0;}

    /* Footer */
    .ft{margin-top:28px;padding-top:10px;border-top:1px solid var(--cb);display:flex;align-items:center;justify-content:space-between;font-size:0.7rem;color:#999;font-weight:300;}
    .ft span[contenteditable]:hover{color:#555;background:var(--ct);border-radius:2px;padding:1px 3px;}
    .ft span[contenteditable]:focus{outline:1px dashed var(--ca);border-radius:2px;padding:1px 3px;color:#1a1a1a;}

    /* Editable headings */
    h2[contenteditable]:hover{background:var(--ct);padding-left:4px;cursor:text;}
    h2[contenteditable]:focus{background:var(--ct);outline:1px dashed var(--ca);padding-left:4px;}

    /* Editable meta values */
    .mv[contenteditable]:hover{background:var(--ct);border-radius:2px;padding:1px 4px;cursor:text;}
    .mv[contenteditable]:focus{background:var(--ct);outline:1px dashed var(--ca);border-radius:2px;padding:1px 4px;}

    /* Editable table cells */
    td[contenteditable]:hover{background:var(--ct)!important;cursor:text;}
    td[contenteditable]:focus{background:var(--ct)!important;outline:1px dashed var(--ca);outline-offset:-1px;}

    /* Bottom print button */
    .pbtn-wrap{text-align:center;margin:28px 0 8px;}
    .pbtn{background:var(--ca);color:#fff;border:1px solid var(--cal);border-radius:6px;padding:11px 28px;font-family:'Oswald',sans-serif;font-size:1rem;letter-spacing:0.08em;cursor:pointer;text-transform:uppercase;}
    .pbtn:hover{background:var(--cal);}
  </style>
</head>
<body>

<!-- ── Sticky top bar ──────────────────────────────────────────────── -->
<div class="topbar no-print">
  <div class="topbar-inner">
    <div class="topbar-text">
      <strong>Nest Sweep Report</strong>${meta.siteName ? ' — ' + _esc(meta.siteName) : ''}
      <span class="topbar-hint">Edit any text section directly · Use Preset dropdowns to insert standard language · Click Print when ready</span>
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

  <!-- Header -->
  <div class="hdr">
    <img id="hdr-logo" src="${logoSrc}" alt="Fraxinus Environmental &amp; Geomatics" onerror="this.style.display='none'" />
    <div>
      <div class="hdr-rt" contenteditable="true" title="Click to edit report title">Pre-Disturbance Nest Survey Report</div>
      <div class="hdr-rd">Created: ${today}</div>
    </div>
  </div>

  <!-- Meta summary -->
  <div class="mg">${metaItems}</div>

  <!-- 1. Introduction -->
  <h2 contenteditable="true">1. Introduction</h2>
  ${toolbar('intro', 'ed-intro')}
  <div id="ed-intro" class="editable" contenteditable="true">${introAuto}</div>

  <!-- 2. Methods -->
  <h2 contenteditable="true">2. Methods</h2>
  ${toolbar('methods', 'ed-methods')}
  <div id="ed-methods" class="editable" contenteditable="true">${methodsAuto}</div>

  <!-- 3. Findings -->
  <h2 contenteditable="true">3. Findings</h2>
  <div class="sr">
    <div class="sc"><div class="sv">${stats.total}</div><div class="sl">Total</div></div>
    <div class="sc act"><div class="sv">${stats.active}</div><div class="sl">Active</div></div>
    <div class="sc ina"><div class="sv">${stats.inactive}</div><div class="sl">Inactive</div></div>
    <div class="sc unk"><div class="sv">${stats.unknown}</div><div class="sl">Unknown</div></div>
    <div class="sc req"><div class="sv">${stats.requiresAction}</div><div class="sl">Action Req.</div></div>
  </div>
  ${toolbar('findings', 'ed-findings')}
  <div id="ed-findings" class="editable" contenteditable="true">${findingsAuto}</div>

  <!-- 4. Observation Summary -->
  <h2 contenteditable="true">4. Observation Summary</h2>
  <table>
    <thead><tr>
      <th>#</th><th>Species</th><th>Status</th><th>Disposition</th>
      <th>Contents</th><th>Substrate</th><th>Buffer</th><th>Notes</th><th>Coordinates</th>
    </tr></thead>
    <tbody>${tableRows}</tbody>
  </table>

  <!-- 5. Recommendations -->
  <h2 contenteditable="true">5. Recommendations</h2>
  ${toolbar('recommendations', 'ed-recs')}
  <div id="ed-recs" class="editable" contenteditable="true"></div>

  <!-- 6. Observation Locations -->
  <h2 contenteditable="true">6. Observation Locations</h2>
  ${mapSection}
  <div class="map-legend">
    <div class="ld"><span class="dot" style="background:#CC0000;"></span> Active</div>
    <div class="ld"><span class="dot" style="background:#888;"></span> Inactive</div>
    <div class="ld"><span class="dot" style="background:#E69138;"></span> Unknown</div>
    ${habObs.length ? '<div class="ld"><span class="dot" style="background:#0f7abf;"></span> Habitat Feature</div>' : ''}
  </div>

  ${habSection}

  <!-- Footer -->
  <div class="ft">
    <span contenteditable="true">Fraxinus Environmental &amp; Geomatics</span>
    <span contenteditable="true">NTB Wildlife App — Pre-Disturbance Nest Survey</span>
    <span contenteditable="true">${_esc(meta.projectID || '')} · ${today}</span>
  </div>

</div><!-- end .page -->

<div class="pbtn-wrap no-print">
  <button class="pbtn" onclick="window.print()">Print / Save as PDF</button>
</div>

<script>
// ── Logo and theme data (injected from app) ────────────────────────────────
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

// ── Preset data (injected from app) ────────────────────────────────────────
const _P = ${presetsJSON};

// ── Insert a preset into a contenteditable section ─────────────────────────
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

// ── Auto-populate Recommendations on load ──────────────────────────────────
(function () {
  const autoKey = ${JSON.stringify(_autoRecKey(obs, stats))};
  const el  = document.getElementById('ed-recs');
  const raw = _P.recommendations?.[autoKey];
  if (el && raw) {
    el.innerHTML = raw.replace(/\\n\\n/g, '<br><br>').replace(/\\n/g, '<br>');
    // Pre-select the matching option in the dropdown
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
