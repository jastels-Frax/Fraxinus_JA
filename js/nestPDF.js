// js/nestPDF.js — Nest Sweep PDF report generator (print-to-PDF via new window)

import { nestObservations, habitatObservations } from './storageData.js';
import {
  nestProjectID, nestObserver, nestClient, nestSiteName, nestMunicipality,
  nestSurveyDate, nestStartTime, nestEndTime,
  nestProposedActivity, nestHabitatTypes, nestSurveyMethod, nestAreaHa,
  nestTempC, nestWind, nestPrecip, nestProvince
} from './surveyGlobals.js';

const STATUS_COLOUR = { Active: '#CC0000', Inactive: '#888888', Unknown: '#E69138' };

export async function exportNestPDF() {
  const obs     = nestObservations;
  const habObs  = habitatObservations.filter(o => o.surveyType === 'NEST');
  if (!obs.length && !habObs.length) {
    alert('No nest observations to export.');
    return;
  }

  const meta = {
    projectID:        nestProjectID,
    observer:         nestObserver,
    client:           nestClient,
    siteName:         nestSiteName,
    municipality:     nestMunicipality,
    surveyDate:       nestSurveyDate,
    startTime:        nestStartTime,
    endTime:          nestEndTime,
    proposedActivity: nestProposedActivity,
    habitatTypes:     nestHabitatTypes,
    surveyMethod:     nestSurveyMethod,
    areaHa:           nestAreaHa,
    tempC:            nestTempC,
    wind:             nestWind,
    precip:           nestPrecip,
    province:         nestProvince,
  };

  const total          = obs.length;
  const active         = obs.filter(o => o.status === 'Active').length;
  const inactive       = obs.filter(o => o.status === 'Inactive').length;
  const unknown        = obs.filter(o => o.status === 'Unknown').length;
  const requiresAction = obs.filter(o =>
    o.disposition && o.disposition !== 'Work can proceed'
  ).length;
  const speciesSet = [...new Set(obs.map(o => o.species).filter(Boolean))];

  const allObs  = [...obs, ...habObs];
  const lats    = allObs.map(o => o.latlng?.lat).filter(Number.isFinite);
  const lngs    = allObs.map(o => o.latlng?.lng).filter(Number.isFinite);

  let mapImgSrc = null;
  if (lats.length > 0) {
    const pad    = 0.003;
    const rawS   = Math.min(...lats) - pad;
    const rawN   = Math.max(...lats) + pad;
    const rawW   = Math.min(...lngs) - pad;
    const rawE   = Math.max(...lngs) + pad;
    const minD   = 0.006;
    const midLat = (rawS + rawN) / 2;
    const midLng = (rawW + rawE) / 2;
    const bboxS  = Math.min(rawS, midLat - minD / 2);
    const bboxN  = Math.max(rawN, midLat + minD / 2);
    const bboxW  = Math.min(rawW, midLng - minD / 2);
    const bboxE  = Math.max(rawE, midLng + minD / 2);
    const mapW   = 760, mapH = 380;
    const arcgisURL = `https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/export?bbox=${bboxW},${bboxS},${bboxE},${bboxN}&bboxSR=4326&size=${mapW},${mapH}&f=image`;
    mapImgSrc = await _buildMapImage(arcgisURL, obs, habObs, bboxW, bboxS, bboxE, bboxN, mapW, mapH);
  }

  const stats = { total, active, inactive, unknown, requiresAction, speciesSet };
  const html  = _buildHTML(meta, obs, habObs, stats, mapImgSrc);

  const w = window.open('', '_blank', 'width=960,height=750,scrollbars=yes');
  if (!w) {
    alert('Pop-up blocked — please allow pop-ups for this app, then try again.');
    return;
  }
  w.document.write(html);
  w.document.close();
}

// ─── Draw basemap tiles + coloured observation points onto a canvas ─────────
async function _buildMapImage(arcgisURL, obs, habObs, west, south, east, north, mapW, mapH) {
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = mapW;
        canvas.height = mapH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const lngSpan = east  - west;
        const latSpan = north - south;

        const plot = (latlng, colour, radius, dash) => {
          if (!Number.isFinite(latlng?.lat)) return;
          const x = ((latlng.lng - west)  / lngSpan) * mapW;
          const y = (1 - (latlng.lat - south) / latSpan) * mapH;
          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);
          ctx.fillStyle   = colour;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth   = 2.5;
          if (dash) ctx.setLineDash([4, 3]);
          ctx.fill();
          ctx.stroke();
          ctx.setLineDash([]);
        };

        habObs.forEach(o => plot(o.latlng, '#0f7abf', 7, true));
        obs.forEach(o   => plot(o.latlng, STATUS_COLOUR[o.status] || '#888888', 9, false));

        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = arcgisURL;
  });
}

// ─── Report HTML ──────────────────────────────────────────────────────────────
function _buildHTML(meta, obs, habObs, stats, mapImgSrc) {
  const today   = new Date().toLocaleDateString('en-CA');
  const logoSrc = new URL('img/fraxinus-logo-mark.jpg', window.location.href).href;

  const tableRows = obs.map((o, i) => {
    const colour   = STATUS_COLOUR[o.status] || '#888';
    const contents = (o.contents || []).join(', ');
    const coords   = (Number.isFinite(o.latlng?.lat))
      ? `${o.latlng.lat.toFixed(5)}, ${o.latlng.lng.toFixed(5)}`
      : '';
    return `<tr>
      <td>${i + 1}</td>
      <td>${_esc(o.species || 'Unknown')}</td>
      <td style="color:${colour};font-weight:600;">${_esc(o.status || '')}</td>
      <td>${_esc(o.disposition || '')}</td>
      <td>${_esc(contents)}</td>
      <td>${_esc(o.substrate || '')}</td>
      <td>${o.buffer ? _esc(String(o.buffer)) + ' m' : ''}</td>
      <td>${_esc(o.note || '')}</td>
      <td style="font-size:0.7rem;color:#555;">${coords}</td>
    </tr>`;
  }).join('');

  const mapSection = mapImgSrc
    ? `<img src="${mapImgSrc}" style="width:100%;max-width:760px;border:1px solid #ccc;border-radius:4px;" alt="Observation locations map" />`
    : `<p style="color:#888;font-style:italic;font-size:0.85rem;">Map unavailable — no GPS data recorded or device is offline.</p>`;

  const habRows = habObs.map((o, i) => {
    const coords = Number.isFinite(o.latlng?.lat)
      ? `${o.latlng.lat.toFixed(5)}, ${o.latlng.lng.toFixed(5)}` : '';
    return `<tr>
      <td>${i + 1}</td>
      <td>${_esc(o.featureType || '')}</td>
      <td>${_esc((o.criteria || []).join(', '))}</td>
      <td>${_esc(o.note || '')}</td>
      <td style="font-size:0.7rem;color:#555;">${coords}</td>
    </tr>`;
  }).join('');

  const habSection = habObs.length ? `
  <h2>6. Habitat Features</h2>
  <table>
    <thead><tr><th>#</th><th>Feature Type</th><th>Criteria Met</th><th>Notes</th><th>Coordinates</th></tr></thead>
    <tbody>${habRows}</tbody>
  </table>` : '';

  const speciesHtml = stats.speciesSet.length
    ? stats.speciesSet.map(s => `<span class="sp-chip">${_esc(s)}</span>`).join('')
    : '<em>None recorded</em>';

  const condParts = [
    meta.tempC ? meta.tempC + '°C' : null,
    meta.wind  || null,
    meta.precip || null,
  ].filter(Boolean).join(', ');

  const weatherLine = condParts || 'not recorded';

  const metaItems = [
    ['Project ID',        meta.projectID],
    ['Client',            meta.client],
    ['Site Name',         meta.siteName],
    ['Municipality',      meta.municipality],
    ['Province',          meta.province],
    ['Survey Date',       meta.surveyDate],
    ['Observer',          meta.observer],
    ['Start / End',       [meta.startTime, meta.endTime].filter(Boolean).join(' – ')],
    ['Proposed Activity', meta.proposedActivity],
    ['Survey Area',       meta.areaHa ? meta.areaHa + ' ha' : null],
    ['Survey Method',     meta.surveyMethod],
    ['Habitat Types',     meta.habitatTypes],
  ].filter(([, v]) => v).map(([l, v]) =>
    `<div class="mi"><div class="ml">${l}</div><div class="mv">${_esc(v)}</div></div>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Nest Sweep Report — ${_esc(meta.siteName || 'Site')}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    body{font-family:'Oswald','Segoe UI',sans-serif;color:#1a1a1a;background:#fff;font-size:10.5pt;line-height:1.55;}
    @page{margin:14mm 14mm 14mm 14mm;size:A4;}
    @media print{.no-print{display:none!important;} body{font-size:9.5pt;}}
    .page{max-width:780px;margin:0 auto;padding:28px 28px 36px;}

    /* Header */
    .hdr{display:flex;align-items:center;gap:16px;padding-bottom:14px;border-bottom:3px solid #2d6b2d;margin-bottom:22px;}
    .hdr img{height:54px;width:auto;border-radius:4px;}
    .hdr-wm{font-size:1.35rem;font-weight:700;letter-spacing:0.12em;color:#2d6b2d;text-transform:uppercase;}
    .hdr-tg{font-size:0.72rem;font-weight:300;color:#666;letter-spacing:0.06em;margin-bottom:4px;}
    .hdr-rt{font-size:1.2rem;font-weight:600;color:#111;letter-spacing:0.03em;}
    .hdr-rd{font-size:0.74rem;color:#888;font-weight:300;margin-top:2px;}

    /* Meta grid */
    .mg{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:22px;padding:14px 16px;background:#f8faf8;border:1px solid #cde8cd;border-radius:6px;}
    .mi{}
    .ml{font-size:0.67rem;text-transform:uppercase;letter-spacing:0.08em;color:#2d6b2d;font-weight:600;}
    .mv{font-size:0.87rem;font-weight:400;}

    /* Section heading */
    h2{font-size:0.85rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#2d6b2d;border-bottom:1px solid #cde8cd;padding-bottom:3px;margin:20px 0 10px;}
    p{margin-bottom:10px;font-size:0.87rem;font-weight:300;}

    /* Stat chips */
    .sr{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;}
    .sc{background:#f0f7f0;border:1px solid #cde8cd;border-radius:6px;padding:6px 14px;text-align:center;min-width:72px;}
    .sv{font-size:1.5rem;font-weight:700;color:#2d6b2d;line-height:1.2;}
    .sl{font-size:0.66rem;text-transform:uppercase;letter-spacing:0.05em;color:#666;}
    .sc.act .sv{color:#CC0000;} .sc.ina .sv{color:#888;} .sc.unk .sv{color:#E69138;} .sc.req .sv{color:#CC0000;}

    /* Species chips */
    .sp-chip{display:inline-block;background:#e8f5e9;border:1px solid #2d6b2d;border-radius:3px;padding:1px 7px;font-size:0.78rem;margin:2px;}

    /* Table */
    table{width:100%;border-collapse:collapse;font-size:0.76rem;margin-top:6px;}
    th{background:#2d6b2d;color:#fff;font-weight:600;padding:5px 6px;text-align:left;letter-spacing:0.04em;font-size:0.7rem;}
    td{padding:4px 6px;border-bottom:1px solid #eee;vertical-align:top;}
    tr:nth-child(even) td{background:#f9fbf9;}

    /* Map */
    .map-legend{display:flex;gap:16px;margin-top:8px;font-size:0.76rem;}
    .ld{display:flex;align-items:center;gap:5px;}
    .dot{width:11px;height:11px;border-radius:50%;border:1.5px solid #fff;box-shadow:0 0 0 1px #999;display:inline-block;flex-shrink:0;}

    /* Footer */
    .ft{margin-top:28px;padding-top:10px;border-top:1px solid #cde8cd;display:flex;align-items:center;justify-content:space-between;font-size:0.7rem;color:#999;font-weight:300;}

    /* Print button */
    .pbtn{display:block;margin:20px auto 28px;background:#2d6b2d;color:#fff;border:none;border-radius:6px;padding:11px 28px;font-family:'Oswald',sans-serif;font-size:1rem;letter-spacing:0.08em;cursor:pointer;text-transform:uppercase;}
    .pbtn:hover{background:#3d8f3d;}
  </style>
</head>
<body>
<div class="page">

  <div class="hdr">
    <img src="${logoSrc}" alt="Fraxinus logo" onerror="this.style.display='none'" />
    <div>
      <div class="hdr-wm">Fraxinus</div>
      <div class="hdr-tg">Environmental &amp; Geomatics</div>
      <div class="hdr-rt">Pre-Disturbance Nest Survey Report</div>
      <div class="hdr-rd">Generated: ${today}</div>
    </div>
  </div>

  <div class="mg">${metaItems}</div>

  <h2>1. Introduction</h2>
  <p>This pre-disturbance nest survey was conducted at ${_esc(meta.siteName || 'the project site')}${meta.municipality ? ', ' + _esc(meta.municipality) : ''}${meta.province ? ' (' + _esc(meta.province) + ')' : ''} in accordance with the <em>Migratory Birds Convention Act</em> (MBCA) and the <em>Migratory Bird Regulations, 2022</em> (MBR 2022). The purpose of the survey was to identify, assess, and document active or recently active bird nests within or adjacent to the area potentially affected by ${_esc(meta.proposedActivity || 'the proposed activity')}, prior to any vegetation removal or ground disturbance.</p>

  <h2>2. Methods</h2>
  <p>The survey was conducted by ${_esc(meta.observer || 'a qualified biologist')} on behalf of ${_esc(meta.client || 'the client')} (Project ${_esc(meta.projectID || 'N/A')}) on ${_esc(meta.surveyDate || 'the survey date')}${meta.startTime ? ', from ' + _esc(meta.startTime) + (meta.endTime ? ' to ' + _esc(meta.endTime) : '') : ''}. The survey area encompassed approximately ${meta.areaHa ? _esc(meta.areaHa) + ' ha' : 'the project footprint'} and was assessed using ${_esc(meta.surveyMethod || 'standard pedestrian sweep methods')}. Habitat types present included: ${_esc(meta.habitatTypes || 'mixed vegetation')}. Nest status (Active / Inactive / Unknown), contents, nest type, and the presence of Schedule&nbsp;1 or SAR species were recorded for each observation. Weather conditions at time of survey: ${weatherLine}.</p>

  <h2>3. Findings</h2>
  <div class="sr">
    <div class="sc"><div class="sv">${stats.total}</div><div class="sl">Total</div></div>
    <div class="sc act"><div class="sv">${stats.active}</div><div class="sl">Active</div></div>
    <div class="sc ina"><div class="sv">${stats.inactive}</div><div class="sl">Inactive</div></div>
    <div class="sc unk"><div class="sv">${stats.unknown}</div><div class="sl">Unknown</div></div>
    <div class="sc req"><div class="sv">${stats.requiresAction}</div><div class="sl">Action Req.</div></div>
  </div>
  <p>A total of <strong>${stats.total}</strong> nest${stats.total !== 1 ? 's were' : ' was'} recorded during the survey${stats.total > 0 ? ': <strong>' + stats.active + '</strong> active, <strong>' + stats.inactive + '</strong> inactive, and <strong>' + stats.unknown + '</strong> of unknown status' : ''}. ${stats.requiresAction > 0 ? '<strong>' + stats.requiresAction + '</strong> observation' + (stats.requiresAction !== 1 ? 's require' : ' requires') + ' a work delay, buffer zone, or regulatory consultation.' : 'No work restrictions are required based on the survey findings.'}</p>
  <p><strong>Species detected:</strong> ${speciesHtml}</p>

  <h2>4. Observation Summary</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Species</th><th>Status</th><th>Disposition</th>
        <th>Contents</th><th>Substrate</th><th>Buffer</th>
        <th>Notes</th><th>Coordinates</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <h2>5. Observation Locations</h2>
  ${mapSection}
  <div class="map-legend" style="margin-top:8px;">
    <div class="ld"><span class="dot" style="background:#CC0000;"></span> Active</div>
    <div class="ld"><span class="dot" style="background:#888;"></span> Inactive</div>
    <div class="ld"><span class="dot" style="background:#E69138;"></span> Unknown</div>
    ${habObs.length ? `<div class="ld"><span class="dot" style="background:#0f7abf;border:1px dashed #0f7abf;"></span> Habitat Feature</div>` : ''}
  </div>

  ${habSection}

  <div class="ft">
    <span>Fraxinus Environmental &amp; Geomatics</span>
    <span>NTB Wildlife App — Pre-Disturbance Nest Survey</span>
    <span>${_esc(meta.projectID || '')} · ${today}</span>
  </div>

</div>
<button class="pbtn no-print" onclick="window.print()">Print / Save as PDF</button>
</body>
</html>`;
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
