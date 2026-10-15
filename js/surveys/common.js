// js/surveys/common.js — Fields and habitat definitions shared by every survey type.

import { today, nowHM } from '../core/fields.js';

// ─── Shared metadata fields ───────────────────────────────────────────────
export const projectID  = { key: 'projectID',  label: 'Project ID',  type: 'text' };
export const observer   = { key: 'observer',   label: 'Observer',    type: 'text', required: true };
export const surveyDate = { key: 'surveyDate', label: 'Survey date', type: 'date', required: true, default: () => today() };
export const startTime  = { key: 'startTime',  label: 'Start time',  type: 'time', default: () => nowHM() };
export const endTime    = { key: 'endTime',    label: 'End time',    type: 'time' };
export const notes      = { key: 'notes',      label: 'Survey notes', type: 'textarea', col: 'SURVEY_NOTES' };

// ─── Shared observation fields ────────────────────────────────────────────
export const note     = { key: 'note',     label: 'Notes', type: 'textarea' };
export const photoRef = { key: 'photoRef', label: 'External photo ref', type: 'text',
                          placeholder: 'Separate camera / trail-cam file ID' };

// ─── Habitat / feature observations (available in every survey) ───────────
const CRITERIA = {
  // BBS
  'Nesting Cavity/Box':  ['Active use signs present', 'Large-diameter tree or structure', 'No direct human disturbance'],
  'Snag':                ['Fresh excavation sign visible', 'Multiple cavities present', 'Standing in open or edge position'],
  'Wetland':             ['Emergent vegetation present', 'Open water visible', 'Upland buffer intact'],
  'Hedgerow/Edge':       ['Berry or fruit-producing species present', 'Adequate height for nesting cover', 'Connects to forest or woodlot'],
  'Riparian Buffer':     ['Canopy continuous along watercourse', 'Invasive species absent', 'Understory intact'],
  'Grassland':           ['Native grass or forb dominant', 'Evidence of ground-nesting activity', 'Low shrub encroachment'],
  'Woodland':            ['Canopy cover adequate', 'Coarse woody debris present', 'Multiple tree age classes'],
  'Pond/Water Body':     ['Vegetated shoreline margins', 'Aquatic vegetation present', 'Evidence of waterfowl or amphibian use'],
  // General wildlife
  'Wallow':              ['Mud still moist', 'Hair present', 'Rubs on nearby trees'],
  'Mineral Lick':        ['Soil or clay excavation visible', 'Tracks converging on site', 'Evidence of repeated use'],
  'Water Crossing':      ['Worn entry/exit trail visible', 'Tracks in substrate', 'Shallow and accessible'],
  'Bedding Area':        ['Depressions or flattened vegetation', 'Pellets present', 'Sheltered from wind'],
  'Browse Corridor':     ['Preferred species present (fir, birch, willow)', 'Stem clipping evident', 'Multiple use trails visible'],
  'Riparian Zone':       ['Willow or alder present', 'Seasonally flooded evidence', 'Soft bank substrate'],
  'Salt Lick':           ['Soil excavation visible', 'Tracks converging', 'Evidence of repeated use'],
  // Turtle
  'Basking Site':        ['Logs or rocks at water surface', 'South-facing or open aspect', 'Unobstructed water access'],
  'Nesting Area':        ['Sandy or gravelly substrate', 'Open canopy', 'Within visible distance of water'],
  'Overwintering Site':  ['Flowing water present', 'Sufficient depth', 'Undercut banks, roots, or log cover'],
  'Foraging Area':       ['Floodplain or wetland adjacent', 'Alder or shrubby edge present', 'Open movement corridors'],
  'Riparian Corridor':   ['Contiguous riparian vegetation', 'Low road or barrier fragmentation', 'Connects two or more water bodies'],
  'Water Feature':       ['Vegetated margins', 'Evidence of turtle use', 'Low disturbance level'],
  // Nest sweep
  'Dense Canopy/Woodland': ['Canopy cover adequate for nesting', 'Understorey shrub layer present', 'Coarse woody debris present'],
  'Shrub/Thicket':         ['Dense shrub cover present', 'Suitable nest-support structure', 'Low human disturbance'],
  'Grassland/Open Area':   ['Ground cover suitable for ground nesters', 'Low mowing/disturbance risk', 'Adjacent to cover or edge'],
  'Structure/Building':    ['Ledges, beams, or eaves accessible', 'No recent disturbance to surface', 'Historical use signs present'],
  'Cliff/Bank':            ['Suitable crevices or ledges present', 'Adequate vertical relief', 'Low predator access'],
  'Snag/Cavity':           ['Cavity entrance visible', 'Sufficient DBH for cavity species', 'No active logging or clearing nearby'],
  'Wetland/Water Edge':    ['Emergent vegetation at water edge', 'Floating or overhanging nest support', 'Low disturbance to water margin'],
};

// Nest sweep's edge criteria differ from BBS's for the same feature name
const NEST_CRITERIA = {
  'Hedgerow/Edge': ['Dense shrub or tree hedgerow present', 'Suitable vertical structure for cup nests', 'Low disturbance along edge'],
};

export const HABITAT_COLOUR = '#0f7abf';

// Builds the habitat record definition for one survey type.
export function habitatDef(surveyId, featureTypes) {
  const criteriaFor = v => (surveyId === 'NEST' && NEST_CRITERIA[v.featureType]) || CRITERIA[v.featureType] || [];
  return {
    title: 'Habitat / Feature',
    icon: '🌿',
    fields: [
      { key: 'featureType', label: 'Feature type', type: 'select', options: featureTypes, other: true, required: true },
      { key: 'criteria', label: 'Criteria met', type: 'checks', options: criteriaFor,
        showIf: v => criteriaFor(v).length > 0 },
      photoRef,
      note,
    ],
    label: r => `🌿 ${r.featureType || 'Feature'}`,
    summary: r => (r.criteria || []).join(', '),
    color: () => HABITAT_COLOUR,
  };
}
