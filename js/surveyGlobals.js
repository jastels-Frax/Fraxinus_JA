// js/surveyGlobals.js — Shared global state for all survey modules

// ─── Active Survey Type ────────────────────────────────────────────────────
// Values: 'BBS' | 'MOOSE' | 'TURTLE'
export let activeSurvey = null;

export function setActiveSurvey(type) {
  activeSurvey = type;
}

// ─── Current Session ID ───────────────────────────────────────────────────
export let currentSessionId = null;
export function setCurrentSessionId(id) { currentSessionId = id; }

// ─── Metadata snapshot / restore helpers ──────────────────────────────────
export function getMetadataSnapshot() {
  if (activeSurvey === 'BBS') return {
    projectID, pointID, observer, surveyType, surveyLength,
    wind, windDir, tempC, precip, siteHabitat,
    surveyLat, surveyLng,
    surveyStartTime, surveyEndTime, surveyRemainingSeconds,
    surveySubmittedAt, surveyResubmittedAt
  };
  if (activeSurvey === 'MOOSE') return {
    mooseProjectID, mooseObserver, mooseTransectID, mooseSurveyDate,
    mooseStartTime, mooseEndTime, mooseVisibility, mooseSnowCover,
    mooseTempC, mooseWindSpeed, mooseNotes,
    mooseSubmittedAt, mooseResubmittedAt
  };
  return {
    turtleProjectID, turtleObserver, turtleSiteName, turtleSurveyDate,
    turtleStartTime, turtleEndTime, turtleWaterTemp, turtleAirTemp,
    turtleWaterLevel, turtleWeather, turtleNotes,
    turtleSubmittedAt, turtleResubmittedAt
  };
}

export function restoreMetadata(type, meta) {
  if (type === 'BBS')   setSurveyMetadata(meta);
  else if (type === 'MOOSE') setMooseMetadata(meta);
  else setTurtleMetadata(meta);
}

// Returns true if the active survey has at least one non-blank key field.
export function hasAnyMetadata() {
  if (activeSurvey === 'BBS')   return [projectID, pointID, observer].some(v => v && v.trim());
  if (activeSurvey === 'MOOSE') return [mooseProjectID, mooseObserver, mooseTransectID].some(v => v && v.trim());
  return [turtleProjectID, turtleObserver, turtleSiteName].some(v => v && v.trim());
}

// Clears all metadata for the given survey type, preserving the surveyor name
// and applying any global defaults set in Settings.
export function resetMetadata(type) {
  const defObs = localStorage.getItem('defaultObserver')  || '';
  const defPrj = localStorage.getItem('defaultProjectID') || '';
  if (type === 'BBS') {
    localStorage.removeItem('surveySubmittedAt');
    localStorage.removeItem('surveyResubmittedAt');
    localStorage.removeItem('surveyStartTime');
    localStorage.removeItem('surveyEndTime');
    localStorage.removeItem('surveyRemainingSeconds');
    setSurveyMetadata({ observer: observer || defObs, projectID: projectID || defPrj });
  } else if (type === 'MOOSE') {
    localStorage.removeItem('mooseSubmittedAt');
    localStorage.removeItem('mooseResubmittedAt');
    setMooseMetadata({ mooseObserver: mooseObserver || defObs, mooseProjectID: mooseProjectID || defPrj });
  } else {
    localStorage.removeItem('turtleSubmittedAt');
    localStorage.removeItem('turtleResubmittedAt');
    setTurtleMetadata({ turtleObserver: turtleObserver || defObs, turtleProjectID: turtleProjectID || defPrj });
  }
}

// ─── BBS Metadata ─────────────────────────────────────────────────────────
export let projectID          = localStorage.getItem('projectID')          || '';
export let pointID            = localStorage.getItem('pointID')            || '';
export let observer           = localStorage.getItem('observer')           || '';
export let surveyType         = localStorage.getItem('surveyType')         || '';
export let surveyLength       = localStorage.getItem('surveyLength')       || '';
export let wind               = localStorage.getItem('wind')               || '';
export let windDir            = localStorage.getItem('windDir')            || '';
export let tempC              = localStorage.getItem('tempC')              || '';
export let precip             = localStorage.getItem('precip')             || '';
export let siteHabitat        = localStorage.getItem('siteHabitat')        || '';
export let surveyLat          = localStorage.getItem('surveyLat')          || '';
export let surveyLng          = localStorage.getItem('surveyLng')          || '';
export let surveyStartTime        = localStorage.getItem('surveyStartTime')        || '';
export let surveyEndTime          = localStorage.getItem('surveyEndTime')          || '';
export let surveyRemainingSeconds = parseInt(localStorage.getItem('surveyRemainingSeconds')) || 0;
export let surveySubmittedAt  = localStorage.getItem('surveySubmittedAt')  || '';
export let surveyResubmittedAt= localStorage.getItem('surveyResubmittedAt')|| '';

export function setSurveyMetadata(data) {
  projectID           = data.projectID           || '';
  pointID             = data.pointID             || '';
  observer            = data.observer            || '';
  surveyType          = data.surveyType          || '';
  surveyLength        = data.surveyLength        || '';
  wind                = data.wind                || '';
  windDir             = data.windDir             || '';
  tempC               = data.tempC               || '';
  precip              = data.precip              || '';
  siteHabitat         = data.siteHabitat         || '';
  surveyLat           = data.surveyLat           || '';
  surveyLng           = data.surveyLng           || '';
  surveyStartTime       = data.surveyStartTime       || '';
  surveyEndTime         = data.surveyEndTime         || '';
  surveyRemainingSeconds = data.surveyRemainingSeconds ?? surveyRemainingSeconds;
  surveySubmittedAt   = data.surveySubmittedAt   || '';
  surveyResubmittedAt = data.surveyResubmittedAt || '';
  localStorage.setItem('projectID',           projectID);
  localStorage.setItem('pointID',             pointID);
  localStorage.setItem('observer',            observer);
  localStorage.setItem('surveyType',          surveyType);
  localStorage.setItem('surveyLength',        surveyLength);
  localStorage.setItem('wind',                wind);
  localStorage.setItem('windDir',             windDir);
  localStorage.setItem('tempC',               tempC);
  localStorage.setItem('precip',              precip);
  localStorage.setItem('siteHabitat',         siteHabitat);
  localStorage.setItem('surveyLat',           surveyLat);
  localStorage.setItem('surveyLng',           surveyLng);
  localStorage.setItem('surveyStartTime',        surveyStartTime);
  localStorage.setItem('surveyEndTime',          surveyEndTime);
  localStorage.setItem('surveyRemainingSeconds', surveyRemainingSeconds);
  localStorage.setItem('surveySubmittedAt',   surveySubmittedAt);
  localStorage.setItem('surveyResubmittedAt', surveyResubmittedAt);
}

// ─── Moose Metadata ────────────────────────────────────────────────────────
export let mooseProjectID      = localStorage.getItem('mooseProjectID')      || '';
export let mooseObserver       = localStorage.getItem('mooseObserver')       || '';
export let mooseTransectID     = localStorage.getItem('mooseTransectID')     || '';
export let mooseSurveyDate     = localStorage.getItem('mooseSurveyDate')     || '';
export let mooseStartTime      = localStorage.getItem('mooseStartTime')      || '';
export let mooseEndTime        = localStorage.getItem('mooseEndTime')        || '';
export let mooseVisibility     = localStorage.getItem('mooseVisibility')     || '';
export let mooseSnowCover      = localStorage.getItem('mooseSnowCover')      || '';
export let mooseTempC          = localStorage.getItem('mooseTempC')          || '';
export let mooseWindSpeed      = localStorage.getItem('mooseWindSpeed')      || '';
export let mooseNotes          = localStorage.getItem('mooseNotes')          || '';
export let mooseSubmittedAt    = localStorage.getItem('mooseSubmittedAt')    || '';
export let mooseResubmittedAt  = localStorage.getItem('mooseResubmittedAt')  || '';

export function setMooseMetadata(data) {
  mooseProjectID     = data.mooseProjectID     || '';
  mooseObserver      = data.mooseObserver      || '';
  mooseTransectID    = data.mooseTransectID    || '';
  mooseSurveyDate    = data.mooseSurveyDate    || '';
  mooseStartTime     = data.mooseStartTime     || '';
  mooseEndTime       = data.mooseEndTime       || '';
  mooseVisibility    = data.mooseVisibility    || '';
  mooseSnowCover     = data.mooseSnowCover     || '';
  mooseTempC         = data.mooseTempC         || '';
  mooseWindSpeed     = data.mooseWindSpeed     || '';
  mooseNotes         = data.mooseNotes         || '';
  mooseSubmittedAt   = data.mooseSubmittedAt   || '';
  mooseResubmittedAt = data.mooseResubmittedAt || '';
  localStorage.setItem('mooseProjectID',     mooseProjectID);
  localStorage.setItem('mooseObserver',      mooseObserver);
  localStorage.setItem('mooseTransectID',    mooseTransectID);
  localStorage.setItem('mooseSurveyDate',    mooseSurveyDate);
  localStorage.setItem('mooseStartTime',     mooseStartTime);
  localStorage.setItem('mooseEndTime',       mooseEndTime);
  localStorage.setItem('mooseVisibility',    mooseVisibility);
  localStorage.setItem('mooseSnowCover',     mooseSnowCover);
  localStorage.setItem('mooseTempC',         mooseTempC);
  localStorage.setItem('mooseWindSpeed',     mooseWindSpeed);
  localStorage.setItem('mooseNotes',         mooseNotes);
  localStorage.setItem('mooseSubmittedAt',   mooseSubmittedAt);
  localStorage.setItem('mooseResubmittedAt', mooseResubmittedAt);
}

// ─── Turtle Metadata ───────────────────────────────────────────────────────
export let turtleProjectID      = localStorage.getItem('turtleProjectID')      || '';
export let turtleObserver       = localStorage.getItem('turtleObserver')       || '';
export let turtleSiteName       = localStorage.getItem('turtleSiteName')       || '';
export let turtleSurveyDate     = localStorage.getItem('turtleSurveyDate')     || '';
export let turtleStartTime      = localStorage.getItem('turtleStartTime')      || '';
export let turtleEndTime        = localStorage.getItem('turtleEndTime')        || '';
export let turtleWaterTemp      = localStorage.getItem('turtleWaterTemp')      || '';
export let turtleAirTemp        = localStorage.getItem('turtleAirTemp')        || '';
export let turtleWaterLevel     = localStorage.getItem('turtleWaterLevel')     || '';
export let turtleWeather        = localStorage.getItem('turtleWeather')        || '';
export let turtleNotes          = localStorage.getItem('turtleNotes')          || '';
export let turtleSubmittedAt    = localStorage.getItem('turtleSubmittedAt')    || '';
export let turtleResubmittedAt  = localStorage.getItem('turtleResubmittedAt')  || '';

export function setTurtleMetadata(data) {
  turtleProjectID     = data.turtleProjectID     || '';
  turtleObserver      = data.turtleObserver      || '';
  turtleSiteName      = data.turtleSiteName      || '';
  turtleSurveyDate    = data.turtleSurveyDate    || '';
  turtleStartTime     = data.turtleStartTime     || '';
  turtleEndTime       = data.turtleEndTime       || '';
  turtleWaterTemp     = data.turtleWaterTemp      || '';
  turtleAirTemp       = data.turtleAirTemp        || '';
  turtleWaterLevel    = data.turtleWaterLevel     || '';
  turtleWeather       = data.turtleWeather        || '';
  turtleNotes         = data.turtleNotes          || '';
  turtleSubmittedAt   = data.turtleSubmittedAt    || '';
  turtleResubmittedAt = data.turtleResubmittedAt  || '';
  localStorage.setItem('turtleProjectID',      turtleProjectID);
  localStorage.setItem('turtleObserver',       turtleObserver);
  localStorage.setItem('turtleSiteName',       turtleSiteName);
  localStorage.setItem('turtleSurveyDate',     turtleSurveyDate);
  localStorage.setItem('turtleStartTime',      turtleStartTime);
  localStorage.setItem('turtleEndTime',        turtleEndTime);
  localStorage.setItem('turtleWaterTemp',      turtleWaterTemp);
  localStorage.setItem('turtleAirTemp',        turtleAirTemp);
  localStorage.setItem('turtleWaterLevel',     turtleWaterLevel);
  localStorage.setItem('turtleWeather',        turtleWeather);
  localStorage.setItem('turtleNotes',          turtleNotes);
  localStorage.setItem('turtleSubmittedAt',    turtleSubmittedAt);
  localStorage.setItem('turtleResubmittedAt',  turtleResubmittedAt);
}
