// js/surveys/nest.js — Pre-disturbance nest sweep (MBCA / MBR 2022)

import { projectID, observer, surveyDate, startTime, endTime, note, photoRef, habitatDef } from './common.js';

const STATUS_COLOUR = { Active: '#CC0000', Inactive: '#888888', Unknown: '#E69138' };
const YNU = ['Yes', 'No', 'Unknown'];

export default {
  id: 'NEST',
  name: 'Nest Sweep',
  icon: '🪹',
  blurb: 'Pre-disturbance nest survey (MBCA / MBR 2022). Locate, assess, and document active nests before vegetation clearing or demolition.',
  labelKey: 'siteName',

  meta: [
    projectID, observer,
    { key: 'client',       label: 'Client / proponent', type: 'text' },
    { key: 'siteName',     label: 'Site name / legal description', type: 'text', required: true },
    { key: 'municipality', label: 'Municipality / county', type: 'text' },
    { key: 'province',     label: 'Province', type: 'select', options: ['NS', 'NB', 'PEI', 'NL', 'QC', 'ON', 'Other'] },
    surveyDate, startTime, endTime,
    { key: 'proposedActivity', label: 'Proposed activity triggering sweep', type: 'text', placeholder: 'e.g. Vegetation clearing' },
    { key: 'habitatTypes', label: 'Habitat types surveyed', type: 'checks',
      options: ['Treed', 'Shrub', 'Grassland/Lawn', 'Structure', 'Cliff/Bank', 'Mixed', 'Other'] },
    { key: 'surveyMethod', label: 'Survey method', type: 'select',
      options: ['Systematic transects', 'Visual scan', 'Opportunistic'], other: true },
    { key: 'areaHa', label: 'Area surveyed (ha)', type: 'number', step: 'any' },
    { key: 'tempC',  label: 'Temperature (°C)', type: 'number', step: 0.1 },
    { key: 'wind',   col: 'WIND_BEAUFORT', label: 'Wind (Beaufort 0–7)', type: 'number', min: 0, max: 7 },
    { key: 'precip', label: 'Precipitation', type: 'select', options: ['None', 'Light', 'Moderate', 'Heavy'] },
  ],

  obs: {
    title: 'Nest',
    icon: '🪹',
    fields: [
      { key: 'species', label: 'Species / suspected species', type: 'species', allowUnknown: true },
      { key: 'status', label: 'Nest status', type: 'radio', required: true, options: ['Active', 'Inactive', 'Unknown'] },
      { key: 'disposition', label: 'Disposition', type: 'select', required: true, options: [
        'Work can proceed', 'Delay required (active nest)', 'Buffer zone required',
        'ECCC/SARA consultation required', 'Pending assessment'] },
      { key: 'contents', label: 'Nest contents', type: 'checks',
        options: ['Adult/bird flushed', 'Eggs', 'Chicks/nestlings', 'Empty', 'Unknown'] },
      { key: 'eggCount',   label: 'Egg count',   type: 'counter', min: 0, showIf: v => (v.contents || []).includes('Eggs') },
      { key: 'chickCount', label: 'Chick count', type: 'counter', min: 0, showIf: v => (v.contents || []).includes('Chicks/nestlings') },
      { key: 'substrate', label: 'Nest type / substrate', type: 'select', other: true, options: [
        'Tree', 'Shrub', 'Ground', 'Structure', 'Cliff/Bank', 'Cavity', 'Platform/Stick nest', 'Unknown'] },
      { key: 'treeHeight', col: 'TREE_HEIGHT_M', label: 'Tree height (m)', type: 'number', min: 0, step: 0.5, showIf: v => v.substrate === 'Tree' },
      { key: 'sched1', label: 'Schedule 1 species? (year-round nest protection)', type: 'select', options: YNU },
      { key: 'sar',    label: 'SAR species?', type: 'select', options: YNU },
      { key: 'buffer', col: 'BUFFER_M', label: 'Recommended buffer (m)', type: 'number', min: 0 },
      photoRef, note,
    ],
    label: r => `${r.species || 'Unknown'} [${(r.status || '?')[0]}]`,
    summary: r => [r.status, r.disposition, (r.contents || []).join(', ')].filter(Boolean).join(' · '),
    color: r => STATUS_COLOUR[r.status] || '#888888',
    onSave: r => {
      if (r.status === 'Active') return 'Active nest recorded — confirm disposition and buffer.';
    },
  },

  habitat: habitatDef('NEST', [
    'Dense Canopy/Woodland', 'Shrub/Thicket', 'Grassland/Open Area', 'Structure/Building',
    'Cliff/Bank', 'Hedgerow/Edge', 'Snag/Cavity', 'Wetland/Water Edge']),

  help: `
    <h3>Before you start</h3>
    <p>Tap 📋 and fill in the site, observer and proposed activity.</p>
    <h3>Recording nests</h3>
    <p>Stand at the nest and tap 🪹. Status and disposition are required. Add photos so the report can show which tree or structure holds the nest.</p>
    <h3>Habitat</h3>
    <p>Tap 🌿 to log suitable nesting habitat even where no nests are found.</p>`,

  report: {
    title: 'Pre-Disturbance Nest Survey Report',
    footer: 'Pre-Disturbance Nest Survey',
    columns: ['species', 'status', 'disposition', 'contents', 'substrate', 'buffer', 'note'],
    legend: Object.entries(STATUS_COLOUR),
    stats: obs => {
      const n = s => obs.filter(o => o.status === s).length;
      return [
        { label: 'Total', value: obs.length },
        { label: 'Active', value: n('Active'), color: '#CC0000' },
        { label: 'Inactive', value: n('Inactive'), color: '#888' },
        { label: 'Unknown', value: n('Unknown'), color: '#E69138' },
        { label: 'Action req.', value: obs.filter(o => o.disposition && o.disposition !== 'Work can proceed').length, color: '#CC0000' },
      ];
    },
    intro: ({ meta: m, esc }) =>
      `This pre-disturbance nest survey was conducted at ${esc(m.siteName || 'the project site')}${m.municipality ? ', ' + esc(m.municipality) : ''}${m.province ? ' (' + esc(m.province) + ')' : ''} in accordance with the <em>Migratory Birds Convention Act</em> (MBCA) and the <em>Migratory Bird Regulations, 2022</em> (MBR 2022). The purpose of the survey was to identify, assess, and document active or recently active bird nests within or adjacent to the area potentially affected by ${esc(m.proposedActivity || 'the proposed activity')}, prior to any vegetation removal or ground disturbance.`,
    methods: ({ meta: m, esc }) => {
      const weather = [m.tempC !== '' && m.tempC != null ? m.tempC + '°C' : '', m.wind !== '' && m.wind != null ? 'wind Beaufort ' + m.wind : '', m.precip ? 'precipitation ' + m.precip.toLowerCase() : '']
        .filter(Boolean).join(', ') || 'not recorded';
      return `The survey was conducted by ${esc(m.observer || 'a qualified biologist')}${m.client ? ' on behalf of ' + esc(m.client) : ''} (Project ${esc(m.projectID || 'N/A')}) on ${esc(m.surveyDate || 'the survey date')}${m.startTime ? ', from ' + esc(m.startTime) + (m.endTime ? ' to ' + esc(m.endTime) : '') : ''}. The survey area encompassed ${m.areaHa ? 'approximately ' + esc(m.areaHa) + ' ha' : 'the project footprint'} and was assessed using ${esc((m.surveyMethod || 'standard pedestrian sweep methods').toLowerCase())}. Habitat types present included: ${esc((m.habitatTypes || []).join(', ') || 'not recorded')}. Nest status, contents, nest type, and the presence of Schedule&nbsp;1 or SAR species were recorded for each observation. Weather conditions: ${esc(weather)}.`;
    },
    findings: ({ obs, esc }) => {
      const n = s => obs.filter(o => o.status === s).length;
      const action = obs.filter(o => o.disposition && o.disposition !== 'Work can proceed').length;
      const species = [...new Set(obs.map(o => o.species).filter(Boolean))];
      return `A total of <strong>${obs.length}</strong> nest${obs.length !== 1 ? 's were' : ' was'} recorded during the survey${obs.length ? `: <strong>${n('Active')}</strong> active, <strong>${n('Inactive')}</strong> inactive, and <strong>${n('Unknown')}</strong> of unknown status` : ''}. ${action ? `<strong>${action}</strong> observation${action !== 1 ? 's require' : ' requires'} a work delay, buffer zone, or regulatory consultation.` : 'No work restrictions are required based on the survey findings.'}${species.length ? ' Species detected: ' + species.map(esc).join(', ') + '.' : ''}`;
    },
    autoRec: ({ obs }) => {
      if (obs.some(o => o.sched1 === 'Yes' || o.sar === 'Yes')) return 'Schedule 1 / SAR Consultation Required';
      if (obs.some(o => o.status === 'Active' && /delay/i.test(o.disposition || ''))) return 'Active Nest — Work Delay Required';
      if (obs.some(o => o.disposition && o.disposition !== 'Work can proceed')) return 'Buffer Zone Required';
      return 'No Restrictions — Work Can Proceed';
    },
    presets: {
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
          'No active or recently active bird nests were detected within the project footprint during the survey. Survey conditions were [good/adequate] and the entire project area was covered systematically. While the absence of nests cannot be guaranteed for the full breeding season, the survey results support proceeding with the proposed activity subject to the conditions outlined under Recommendations.',
        'Active Nests Present':
          'Active nests were detected within or immediately adjacent to the project footprint. Nest status was confirmed by direct observation of eggs, chicks, or incubating/brooding adults. The active nests are mapped and detailed in the Observation Summary. Work restrictions are in effect for the affected areas until nesting is complete.',
        'Inactive Nests Only':
          'Only inactive (empty) nests were detected within the project footprint. No eggs, chicks, or incubating adults were observed. While nest structures were present, no nesting activity was underway at the time of the survey. Nest activity can change rapidly during the breeding season; the conditions outlined under Recommendations should be followed throughout the work period.',
        'Mixed Active and Inactive':
          'Both active and inactive nests were detected within and adjacent to the project footprint. Active nests require immediate work restrictions as detailed under Recommendations. Inactive nest structures were recorded for reference but do not independently trigger restrictions under the MBCA unless they become active.',
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
    },
  },
};
