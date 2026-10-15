// js/surveys/turtle.js — Wood turtle survey (SARA Schedule 1, COSEWIC Threatened)

import { projectID, observer, surveyDate, startTime, endTime, notes, note, photoRef, habitatDef } from './common.js';

const ACTIVITY_COLOUR = {
  Basking: '#E69138', Swimming: '#0f7abf', Foraging: '#4caf50',
  Travelling: '#9b59b6', Nesting: '#CC0000', Other: '#888888',
};
const isJuvenile = o => o.ageClass === 'Juvenile' || o.ageClass === 'Hatchling';

export default {
  id: 'TURTLE',
  name: 'Wood Turtle Survey',
  icon: '🐢',
  blurb: 'Individual turtle capture data, habitat observations, and riparian reach metadata for stream surveys.',
  labelKey: 'siteName',

  meta: [
    projectID, observer,
    { key: 'siteName', label: 'Site name / stream reach ID', type: 'text', required: true },
    surveyDate, startTime, endTime,
    { key: 'waterTemp',  col: 'WATER_TEMP_C', label: 'Water temperature (°C)', type: 'number', step: 0.1 },
    { key: 'airTemp',    col: 'AIR_TEMP_C', label: 'Air temperature (°C)', type: 'number', step: 0.1 },
    { key: 'waterLevel', label: 'Water level', type: 'select', options: ['Low', 'Normal', 'High', 'Flood'] },
    { key: 'weather',    label: 'Weather', type: 'select', options: ['Sunny', 'Partly Cloudy', 'Overcast', 'Rainy'] },
    notes,
  ],

  obs: {
    title: 'Turtle Observation',
    icon: '🐢',
    fields: [
      { key: 'species', label: 'Species', type: 'select', required: true, default: () => 'Wood Turtle', options: [
        { value: 'Wood Turtle',            label: 'Wood Turtle (Glyptemys insculpta) — S2' },
        { value: "Blanding's Turtle",      label: "Blanding's Turtle (Emydoidea blandingii) — S2" },
        { value: 'Snapping Turtle',        label: 'Snapping Turtle (Chelydra serpentina) — S4' },
        { value: 'Eastern Painted Turtle', label: 'Eastern Painted Turtle (Chrysemys picta picta) — S5' },
      ] },
      { key: 'sex',      label: 'Sex',       type: 'radio', options: ['Male', 'Female', 'Unknown'] },
      { key: 'ageClass', label: 'Age class', type: 'radio', options: ['Adult', 'Juvenile', 'Hatchling', 'Unknown'] },
      { key: 'activity', label: 'Activity',  type: 'select', other: true,
        options: ['Basking', 'Swimming', 'Foraging', 'Travelling', 'Nesting', 'Refuge/Shelter', 'Unknown'] },
      { key: 'habitat',  label: 'Riparian habitat', type: 'select', other: true, options: [
        'Marsh', 'Riparian Forest', 'Upland Forest', 'Rocky Shore', 'Sandy Bank', 'Agricultural Field',
        'Road/Path', 'Open Water', 'Gravel Bar', 'Shrub/Scrub'] },
      photoRef, note,
    ],
    label: r => {
      const sp = (r.species || '?').split(' ').map(w => w[0]).join('');
      return `${sp} ${(r.sex || 'U')[0]}${r.activity ? ' · ' + r.activity : ''}`;
    },
    summary: r => [r.sex, r.ageClass, r.habitat].filter(Boolean).join(' · '),
    color: r => ACTIVITY_COLOUR[r.activity] || ACTIVITY_COLOUR.Other,
  },

  habitat: habitatDef('TURTLE', [
    'Basking Site', 'Nesting Area', 'Overwintering Site', 'Foraging Area', 'Riparian Corridor', 'Water Feature']),

  help: `
    <h3>Before you start</h3>
    <p>Tap 📋 and fill in the reach ID, observer, water and air temperatures.</p>
    <h3>Recording turtles</h3>
    <p>Tap 🐢 at each turtle. Record sex, age class and activity, and take carapace/plastron photos.</p>
    <h3>Habitat</h3>
    <p>Tap 🌿 to log basking, nesting and overwintering sites.</p>`,

  report: {
    title: 'Wood Turtle Survey Report',
    footer: 'Wood Turtle Survey',
    columns: ['species', 'sex', 'ageClass', 'activity', 'habitat', 'photoRef', 'note'],
    legend: Object.entries(ACTIVITY_COLOUR),
    stats: obs => [
      { label: 'Turtles', value: obs.length },
      { label: 'Males', value: obs.filter(o => o.sex === 'Male').length },
      { label: 'Females', value: obs.filter(o => o.sex === 'Female').length },
      { label: 'Juveniles', value: obs.filter(isJuvenile).length },
      { label: 'Nesting', value: obs.filter(o => o.activity === 'Nesting').length, color: '#CC0000' },
    ],
    intro: ({ meta: m, esc }) =>
      `This Wood Turtle (<em>Glyptemys insculpta</em>) survey was conducted at ${esc(m.siteName || 'the survey site')} by ${esc(m.observer || 'a qualified biologist')} (Project ${esc(m.projectID || 'N/A')}) on ${esc(m.surveyDate || 'the survey date')}. <em>Glyptemys insculpta</em> is assessed as Threatened by the Committee on the Status of Endangered Wildlife in Canada (COSEWIC) and is listed on Schedule 1 of the <em>Species at Risk Act</em> (SARA). The survey was designed to detect Wood Turtle presence and document individual records, activity, and habitat use within the study reach.`,
    methods: ({ meta: m, esc }) => {
      const v = (x, u = '') => (x !== '' && x != null ? esc(x) + u : 'not recorded');
      return `The survey was conducted${m.startTime ? ' from ' + esc(m.startTime) + (m.endTime ? ' to ' + esc(m.endTime) : '') : ''}. Water temperature was ${v(m.waterTemp, '°C')}, air temperature was ${v(m.airTemp, '°C')}, water level was ${esc((m.waterLevel || 'not recorded').toLowerCase())} and weather was ${esc((m.weather || 'not recorded').toLowerCase())}. All turtles detected were recorded with GPS coordinates, species, sex, age class, activity, habitat association and photographs.`;
    },
    findings: ({ obs }) => {
      const n = f => obs.filter(f).length;
      const unknownSex = obs.length - n(o => o.sex === 'Male') - n(o => o.sex === 'Female');
      return `A total of <strong>${obs.length}</strong> turtle${obs.length !== 1 ? 's were' : ' was'} recorded: <strong>${n(o => o.sex === 'Male')}</strong> male, <strong>${n(o => o.sex === 'Female')}</strong> female and <strong>${unknownSex}</strong> of unknown sex, including <strong>${n(isJuvenile)}</strong> juvenile or hatchling individual${n(isJuvenile) !== 1 ? 's' : ''}.${n(o => o.activity === 'Nesting') ? ' <strong>Nesting activity was confirmed during the survey.</strong>' : ''}`;
    },
    autoRec: ({ obs }) => {
      if (obs.some(o => o.activity === 'Nesting')) return 'Avoid Active Nesting Season';
      if (obs.length > 3) return 'Riparian Buffer Required';
      return 'No Immediate Concerns';
    },
    presets: {
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
    },
  },
};
