// js/surveys/index.js — Registry of survey types. Add a definition here to add a survey.

import bbs from './bbs.js';
import wildlife from './wildlife.js';
import turtle from './turtle.js';
import nest from './nest.js';

export const SURVEYS = [wildlife, turtle, bbs, nest];
export const SURVEY_BY_ID = Object.fromEntries(SURVEYS.map(s => [s.id, s]));
export const getSurvey = id => SURVEY_BY_ID[id];
