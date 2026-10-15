// js/surveys/wildlife.js — General wildlife survey (winter tracking, PGI, incidental)

import { projectID, observer, surveyDate, startTime, endTime, notes, note, photoRef, habitatDef } from './common.js';

const SIGN = ['Browse', 'Tracks', 'Scat', 'Rub', 'Wallow', 'Bed', 'Antler Shed', 'Carcass/Remains', 'Pellet Group'];
const GROUP_COLOUR = { 'Direct visual': '#4caf50', 'Sign': '#E69138', 'Trail camera': '#0f7abf', 'Other': '#9b59b6' };
const group = r => r.obsType === 'Direct Visual' ? 'Direct visual'
                 : r.obsType === 'Trail Camera'  ? 'Trail camera'
                 : SIGN.includes(r.obsType)      ? 'Sign' : 'Other';

export default {
  id: 'WILDLIFE',
  name: 'General Wildlife Survey',
  icon: '🦌',
  blurb: 'Winter tracking, PGI surveys, or general wildlife observations.',
  labelKey: 'transectID',

  meta: [
    projectID, observer,
    { key: 'transectID', label: 'Transect ID', type: 'text', required: true },
    surveyDate, startTime, endTime,
    { key: 'visibility', label: 'Visibility', type: 'select', options: ['Good', 'Moderate', 'Poor'] },
    { key: 'snowCover',  col: 'SNOW_COVER_PCT', label: 'Snow cover (%)', type: 'number', min: 0, max: 100 },
    { key: 'tempC',      label: 'Temperature (°C)', type: 'number', step: 0.1 },
    { key: 'windSpeed',  label: 'Wind speed', type: 'text', placeholder: 'Beaufort or km/h' },
    notes,
  ],

  obs: {
    title: 'Wildlife Observation',
    icon: '🦌',
    fields: [
      { key: 'species', label: 'Species', type: 'select', required: true, other: true, options: [
        'Moose', 'White-tailed Deer', 'Black Bear', 'Coyote', 'Red Fox', 'Canada Lynx', 'Bobcat',
        'River Otter', 'Beaver', 'Mink', 'American Marten', 'Fisher', 'Snowshoe Hare', 'Porcupine',
        'Raccoon', 'Striped Skunk', 'Unknown'] },
      { key: 'obsType', col: 'OBSERVATION_TYPE', label: 'Observation type', type: 'select', required: true, other: true,
        options: ['Direct Visual', ...SIGN, 'Trail Camera', 'Unknown'] },
      { key: 'count', label: 'Count', type: 'counter', min: 1, default: () => 1 },
      { key: 'habitat', label: 'Habitat', type: 'select', other: true, options: [
        'Open Wetland', 'Riparian Shrub', 'Upland Forest', 'Cutover/Regeneration', 'Lakeshore', 'Roadside',
        'Coniferous Forest', 'Deciduous Forest', 'Mixed Forest', 'Bog/Fen', 'Agricultural Field'] },
      photoRef, note,
    ],
    label: r => `${r.species || '?'}, ${r.obsType || '?'}`,
    summary: r => [r.count > 1 ? `×${r.count}` : '', r.habitat].filter(Boolean).join(' · '),
    color: r => GROUP_COLOUR[group(r)],
  },

  habitat: habitatDef('WILDLIFE', [
    'Wallow', 'Mineral Lick', 'Water Crossing', 'Bedding Area', 'Browse Corridor', 'Riparian Zone', 'Salt Lick']),

  help: `
    <h3>Before you start</h3>
    <p>Tap 📋 and fill in the transect, observer and conditions.</p>
    <h3>Recording wildlife</h3>
    <p>Stand at the sighting or sign and tap 🦌. Your GPS position is used; you can adjust it in the form.</p>
    <h3>Habitat</h3>
    <p>Tap 🌿 to log wallows, licks, crossings and other features.</p>`,

  report: {
    title: 'General Wildlife Survey Report',
    footer: 'General Wildlife Survey',
    columns: ['species', 'obsType', 'count', 'habitat', 'photoRef', 'note'],
    legend: Object.entries(GROUP_COLOUR),
    stats: obs => [
      { label: 'Observations', value: obs.length },
      { label: 'Species', value: new Set(obs.map(o => o.species).filter(Boolean)).size },
      { label: 'Direct sightings', value: obs.filter(o => group(o) === 'Direct visual').length, color: GROUP_COLOUR['Direct visual'] },
      { label: 'Sign', value: obs.filter(o => group(o) === 'Sign').length, color: GROUP_COLOUR.Sign },
    ],
    intro: ({ meta: m, esc }) =>
      `This general wildlife survey was conducted along Transect ${esc(m.transectID || 'N/A')} by ${esc(m.observer || 'a qualified biologist')} (Project ${esc(m.projectID || 'N/A')}) on ${esc(m.surveyDate || 'the survey date')}. The purpose of the survey was to document wildlife species presence, activity, and habitat associations within the study area in the context of the proposed project activities.`,
    methods: ({ meta: m, esc }) =>
      `The survey was conducted using transect-based observation methods${m.startTime ? ' from ' + esc(m.startTime) + (m.endTime ? ' to ' + esc(m.endTime) : '') : ''}. Visibility was rated as ${esc((m.visibility || 'not recorded').toLowerCase())}, snow cover was ${m.snowCover !== '' && m.snowCover != null ? esc(m.snowCover) + '%' : 'not recorded'}, temperature was ${m.tempC !== '' && m.tempC != null ? esc(m.tempC) + '°C' : 'not recorded'} and wind was ${esc(m.windSpeed || 'not recorded')}. All wildlife observations and sign were recorded with GPS coordinates, species, observation type, count, habitat association, and notes.`,
    findings: ({ obs, esc }) => {
      const species = [...new Set(obs.map(o => o.species).filter(Boolean))];
      const counts = {};
      obs.forEach(o => { if (o.species) counts[o.species] = (counts[o.species] || 0) + 1; });
      const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
      return `A total of <strong>${obs.length}</strong> wildlife observation${obs.length !== 1 ? 's were' : ' was'} recorded, comprising <strong>${species.length}</strong> species or taxa: <strong>${obs.filter(o => group(o) === 'Direct visual').length}</strong> direct sightings and <strong>${obs.filter(o => group(o) === 'Sign').length}</strong> records of sign.${top ? ` The most frequently recorded taxon was <em>${esc(top)}</em>.` : ''}${species.length ? ' Species detected: ' + species.map(esc).join(', ') + '.' : ''}`;
    },
    autoRec: ({ obs }) => {
      if (obs.some(o => /bear|moose|wolf|lynx/i.test(o.species || ''))) return 'Species Management Plan Required';
      if (obs.length > 15) return 'Habitat Buffer Recommended';
      if (obs.length > 0) return 'Follow-Up Survey Recommended';
      return 'No Concerns — Standard Practice';
    },
    presets: {
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
    },
  },
};
