// js/surveys/bbs.js — Breeding bird point count

import { projectID, observer, surveyDate, endTime, notes, note, habitatDef } from './common.js';
import { distanceM, bearingDeg } from '../core/geo.js';

// Maritimes Breeding Bird Atlas evidence codes
const BREEDING = [
  ['X',  'Observed',  'Observed, no breeding evidence'],
  ['H',  'Possible',  'In suitable nesting habitat'],
  ['S',  'Possible',  'Singing male'],
  ['P',  'Probable',  'Pair in suitable habitat'],
  ['T',  'Probable',  'Permanent territory'],
  ['D',  'Probable',  'Courtship / display'],
  ['V',  'Probable',  'Visiting probable nest site'],
  ['A',  'Probable',  'Agitated behaviour'],
  ['B',  'Probable',  'Brood patch / cloacal protuberance'],
  ['N',  'Probable',  'Nest building / excavation'],
  ['NB', 'Confirmed', 'Carrying nest material'],
  ['DD', 'Confirmed', 'Distraction display'],
  ['NU', 'Confirmed', 'Used nest or eggshells'],
  ['FY', 'Confirmed', 'Recently fledged young'],
  ['AE', 'Confirmed', 'Adult entering/leaving nest site'],
  ['FS', 'Confirmed', 'Carrying fecal sac'],
  ['CF', 'Confirmed', 'Carrying food for young'],
  ['NE', 'Confirmed', 'Nest with eggs'],
  ['NY', 'Confirmed', 'Nest with young'],
];
const CATEGORY = Object.fromEntries(BREEDING.map(([c, cat]) => [c, cat]));
CATEGORY.C = 'Confirmed';  // legacy code from earlier app versions
const CAT_COLOUR = { Confirmed: '#CC0000', Probable: '#E69138', Possible: '#4caf50', Observed: '#0f7abf', 'No code': '#888888' };
const CAT_RANK = ['Confirmed', 'Probable', 'Possible', 'Observed', 'No code'];
export const breedingCategory = code => CATEGORY[code] || 'No code';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export default {
  id: 'BBS',
  name: 'Breeding Bird Survey',
  icon: '🐦',
  blurb: 'Point-count methodology with species search, breeding codes, distance/bearing overlay and countdown timer.',
  labelKey: 'pointID',
  tapToPlace: true,          // tapping the map places a bird at that spot
  timer: true,               // point-count countdown strip (uses surveyLength, startTime, endTime)

  meta: [
    projectID, observer,
    { key: 'pointID', label: 'Survey point ID', type: 'text', required: true },
    surveyDate,
    { key: 'survey', label: 'Survey point location', type: 'point', required: true },
    { key: 'surveyLength', col: 'SURVEY_LENGTH_MIN', label: 'Count length (min)', type: 'number', min: 1, default: () => 10 },
    { key: 'startTime', label: 'Start time (set by timer)', type: 'time' },
    endTime,
    { key: 'wind',    col: 'WIND_BEAUFORT', label: 'Wind (Beaufort)', type: 'select', options: ['0', '1', '2', '3', '4', '5', '6', '7'] },
    { key: 'windDir', label: 'Wind direction', type: 'select', options: COMPASS },
    { key: 'tempC',   label: 'Temperature (°C)', type: 'number', step: 0.1 },
    { key: 'precip',  label: 'Precipitation', type: 'select', options: ['None', 'Fog/Mist', 'Drizzle', 'Light rain', 'Heavy rain', 'Snow'] },
    { key: 'siteHabitat', label: 'Site habitat', type: 'text' },
    notes,
  ],

  obs: {
    title: 'Bird Observation',
    icon: '🐦',
    fields: [
      { key: 'species', label: 'Species', type: 'species', required: true },
      { key: 'count', label: 'Count', type: 'counter', min: 1, default: () => 1 },
      { key: 'breeding', label: 'Breeding evidence', type: 'select',
        options: BREEDING.map(([c, cat, d]) => ({ value: c, label: `${c} · ${cat} – ${d}` })) },
      { key: 'passHt', col: 'FLYOVER_HEIGHT', label: 'Flyover height', type: 'text', placeholder: 'e.g. 50 m (flyovers only)' },
      { key: 'flightDir', label: 'Flight direction', type: 'select', options: COMPASS },
      note,
      { key: 'range',   col: 'RANGE_M', label: 'Range (m)',   type: 'number', hidden: true },
      { key: 'bearing', col: 'BEARING_DEG', label: 'Bearing (°)', type: 'number', hidden: true },
    ],
    label: r => `${r.speciesCode || r.species || '?'} (${r.count || 1})${r.speciesSara ? ' ⚠' : ''}`,
    summary: r => [r.species, r.breeding && `${r.breeding} ${breedingCategory(r.breeding)}`,
                   r.range != null && r.range !== '' && `${r.range} m @ ${r.bearing}°`].filter(Boolean).join(' · '),
    color: r => CAT_COLOUR[breedingCategory(r.breeding)],
    // Range/bearing are measured from the survey point (point-count station);
    // falls back to the observer's GPS position if no point has been set.
    beforeSave: (r, { meta, position }) => {
      const origin = Number.isFinite(+meta.surveyLat) && meta.surveyLat !== ''
        ? { lat: +meta.surveyLat, lng: +meta.surveyLng } : position;
      if (!origin || !Number.isFinite(r.lat)) return;
      r.range = Math.round(distanceM(origin, r));
      r.bearing = Math.round(bearingDeg(origin, r));
    },
  },

  habitat: habitatDef('BBS', [
    'Nesting Cavity/Box', 'Snag', 'Wetland', 'Hedgerow/Edge', 'Riparian Buffer', 'Grassland', 'Woodland', 'Pond/Water Body']),

  help: `
    <h3>Before you start</h3>
    <p>Tap 📋, fill in the point ID and observer, and capture the survey point with <b>Use GPS</b>.</p>
    <h3>Counting</h3>
    <p>Start the timer. Tap the map where each bird is (use the ◎ distance rings) or tap 🐦 to log at the survey point. Recent species appear as one-tap chips.</p>
    <h3>Range &amp; bearing</h3>
    <p>Calculated automatically from the survey point to each bird.</p>`,

  report: {
    title: 'Breeding Bird Survey Report',
    footer: 'Breeding Bird Survey',
    columns: ['species', 'count', 'breeding', 'range', 'bearing', 'note'],
    legend: Object.entries(CAT_COLOUR),
    stats: obs => [
      { label: 'Species', value: new Set(obs.map(o => o.speciesCode || o.species)).size },
      { label: 'Individuals', value: obs.reduce((s, o) => s + (+o.count || 1), 0) },
      { label: 'Confirmed', value: obs.filter(o => breedingCategory(o.breeding) === 'Confirmed').length, color: CAT_COLOUR.Confirmed },
      { label: 'SAR', value: obs.filter(o => o.speciesSara).length, color: '#CC0000' },
    ],
    intro: ({ meta: m, esc }) =>
      `This breeding bird survey was conducted at survey point ${esc(m.pointID || 'N/A')}${m.surveyLat ? ` (${(+m.surveyLat).toFixed(5)}, ${(+m.surveyLng).toFixed(5)})` : ''} by ${esc(m.observer || 'a qualified biologist')} (Project ${esc(m.projectID || 'N/A')}) on ${esc(m.surveyDate || 'the survey date')}. The survey was designed to document breeding bird species composition, relative abundance, and evidence of breeding activity within and adjacent to the project area.`,
    methods: ({ meta: m, esc }) =>
      `The survey was conducted${m.startTime ? ' from ' + esc(m.startTime) + (m.endTime ? ' to ' + esc(m.endTime) : '') : ''} using a ${m.surveyLength ? esc(m.surveyLength) + '-minute' : 'timed'} unlimited-distance point count. Conditions: wind Beaufort ${esc(m.wind || 'not recorded')}${m.windDir ? ' from the ' + esc(m.windDir) : ''}, temperature ${m.tempC !== '' && m.tempC != null ? esc(m.tempC) + '°C' : 'not recorded'}, precipitation ${esc((m.precip || 'not recorded').toLowerCase())}. Site habitat: ${esc(m.siteHabitat || 'not recorded')}. Distance and bearing to each bird were measured from the survey point. Breeding evidence was coded using the Maritimes Breeding Bird Atlas protocol.`,
    findings: ({ obs }) => {
      const species = new Set(obs.map(o => o.speciesCode || o.species)).size;
      const ind = obs.reduce((s, o) => s + (+o.count || 1), 0);
      const conf = new Set(obs.filter(o => breedingCategory(o.breeding) === 'Confirmed').map(o => o.speciesCode)).size;
      const sar = [...new Set(obs.filter(o => o.speciesSara).map(o => `${o.species} (SARA ${o.speciesSara})`))];
      return `The survey recorded <strong>${species}</strong> species and <strong>${ind}</strong> individual birds. Confirmed breeding evidence was recorded for <strong>${conf}</strong> species.${sar.length ? ` Species at risk detected: <strong>${sar.join(', ')}</strong>.` : ' No SARA-listed species were detected.'}`;
    },
    extra: ({ obs, esc }) => {
      const by = {};
      obs.forEach(o => {
        const k = o.species || o.speciesCode || 'Unknown';
        const s = by[k] ||= { code: o.speciesCode || '', count: 0, best: 'No code', codes: new Set(), sara: o.speciesSara || '' };
        s.count += +o.count || 1;
        if (o.breeding) s.codes.add(o.breeding);
        const cat = breedingCategory(o.breeding);
        if (CAT_RANK.indexOf(cat) < CAT_RANK.indexOf(s.best)) s.best = cat;
      });
      const rows = Object.entries(by).sort((a, b) => a[0].localeCompare(b[0])).map(([name, s]) =>
        `<tr><td>${esc(name)}</td><td>${esc(s.code)}</td><td>${s.count}</td>
         <td style="color:${CAT_COLOUR[s.best]};font-weight:600">${esc(s.best)}${s.codes.size ? ' (' + esc([...s.codes].join(', ')) + ')' : ''}</td>
         <td>${esc(s.sara)}</td></tr>`).join('');
      return { title: 'Species Summary',
        html: `<table><thead><tr><th>Species</th><th>Code</th><th>Total count</th><th>Highest breeding evidence</th><th>SARA</th></tr></thead><tbody>${rows}</tbody></table>` };
    },
    autoRec: ({ obs }) => {
      if (obs.some(o => o.speciesSara)) return 'SARA Consultation Required';
      if (obs.some(o => ['Confirmed', 'Probable'].includes(breedingCategory(o.breeding)))) return 'Pre-Clearance Survey Required';
      return 'No Concerns — Proceed';
    },
    presets: {
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
          'The survey was conducted using the standard 5-minute unlimited-distance point count method. The observer stood quietly at the survey point for a full 5 minutes, recording all birds detected by sight or sound within the count period. All species, estimated count, distance, bearing from point, and breeding evidence code were recorded. Survey was conducted during optimal conditions: within 4 hours of sunrise, under calm (&lt;Beaufort 3) and precipitation-free conditions.',
        '10-Minute Unlimited Distance Count':
          'The survey was conducted using a 10-minute unlimited-distance point count. The observer recorded all birds detected by sight or sound throughout the full count period, without applying a fixed-distance cutoff. All species, count, estimated distance, bearing, and breeding evidence were recorded. This extended count duration increases detection probability for species present at low density or with infrequent vocalization.',
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
    },
  },
};
