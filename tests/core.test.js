// tests/core.test.js — Data-layer guarantees: every captured field reaches every
// export format, columns are unambiguous, zips are valid, v1 data migrates.
// Run: npm test   (Node 18+, no dependencies)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { SURVEYS } from '../js/surveys/index.js';
import { fieldColumns, optionList } from '../js/core/fields.js';
import { createSession, newRecord, missingFields, isBlank, sessionLabel } from '../js/core/session.js';
import { buildTable, toCSV, toGeoJSON, toKML, toJSON, packageFiles, photoFileNames } from '../js/core/export.js';
import { makeZip } from '../js/core/zip.js';
import { migrateSession, recoverLiveStores } from '../js/core/migrate.js';

// A distinctive sample value for every field so we can find it in the output
function sampleValues(fields, tag) {
  const v = {};
  for (const f of fields) {
    const s = `${tag}_${f.key}`;
    switch (f.type) {
      case 'number': case 'counter': v[f.key] = 1000 + f.key.length; break;
      case 'checks': v[f.key] = [`${s}_a`, `${s}_b`]; break;
      case 'species':
        Object.assign(v, { [f.key]: s, [f.key + 'Code']: s + 'C', [f.key + 'Sci']: s + 'S',
                           [f.key + 'Sara']: s + 'R', [f.key + 'Srank']: s + 'K' });
        break;
      case 'point': v[f.key + 'Lat'] = 44.111111; v[f.key + 'Lng'] = -63.222222; break;
      default: v[f.key] = s;
    }
  }
  return v;
}

function fullSession(def) {
  const s = createSession(def, {});
  Object.assign(s.meta, sampleValues(def.meta, 'META'));
  s.obs.push(Object.assign(newRecord(def.obs.fields, sampleValues(def.obs.fields, 'OBS')),
    { lat: 44.5, lng: -63.5, accuracy: 4, time: '2026-10-15T10:00:00-03:00', photos: ['p1', 'p2'] }));
  s.habitat.push(Object.assign(newRecord(def.habitat.fields, sampleValues(def.habitat.fields, 'HAB')),
    { lat: 44.6, lng: -63.6, time: '2026-10-15T10:05:00-03:00', photos: [] }));
  s.status = 'submitted';
  s.submittedAt = '2026-10-15T12:00:00-03:00';
  return s;
}

const expectedStrings = (def, s, kind) => {
  const fields = kind === 'obs' ? def.obs.fields : def.habitat.fields;
  const out = [];
  for (const src of [[def.meta, s.meta], [fields, s[kind][0]]]) {
    for (const f of src[0]) for (const c of fieldColumns(f)) {
      const v = src[1][c.key];
      out.push(...(Array.isArray(v) ? v : [String(v)]));
    }
  }
  return out;
};

for (const def of SURVEYS) {
  test(`${def.id}: definition is well-formed`, () => {
    for (const f of [...def.meta, ...def.obs.fields, ...def.habitat.fields]) {
      assert.ok(f.key && f.label && f.type, `field missing key/label/type: ${JSON.stringify(f)}`);
      if (['select', 'radio'].includes(f.type)) assert.ok(optionList(f, {}).length, `${f.key} has no options`);
    }
    for (const k of def.report.columns) assert.ok(def.obs.fields.some(f => f.key === k), `report column ${k}`);
    for (const g of ['intro', 'methods', 'findings', 'recommendations']) assert.ok(Object.keys(def.report.presets[g]).length);
  });

  test(`${def.id}: column names are unique`, () => {
    const s = fullSession(def);
    for (const kind of ['obs', 'habitat']) {
      const cols = buildTable(def, s, kind).columns.map(c => c.col);
      assert.equal(new Set(cols).size, cols.length, `duplicate columns: ${cols.filter((c, i) => cols.indexOf(c) !== i)}`);
    }
  });

  test(`${def.id}: every captured value reaches CSV, GeoJSON, KML and JSON`, () => {
    const s = fullSession(def);
    const names = photoFileNames(s);
    for (const kind of ['obs', 'habitat']) {
      const csv = toCSV(buildTable(def, s, kind, names));
      const geo = toGeoJSON(def, s, kind, names);
      const kml = toKML(def, s, names);
      const json = toJSON(def, s, names);
      for (const v of expectedStrings(def, s, kind)) {
        assert.ok(csv.includes(v), `CSV (${kind}) missing ${v}`);
        assert.ok(geo.includes(v), `GeoJSON (${kind}) missing ${v}`);
        assert.ok(kml.includes(v), `KML missing ${v}`);
        assert.ok(json.includes(v), `JSON missing ${v}`);
      }
      for (const v of ['44.5', '-63.5']) if (kind === 'obs') assert.ok(csv.includes(v), `CSV missing coord ${v}`);
    }
    assert.ok(toCSV(buildTable(def, s, 'obs', names)).includes(names.p1), 'photo filename in CSV');
    assert.match(names.p1, /^OBS001_44\.50000_-63\.50000_1\.jpg$/);
  });

  test(`${def.id}: GeoJSON is valid with numeric types`, () => {
    const s = fullSession(def);
    const fc = JSON.parse(toGeoJSON(def, s, 'obs'));
    assert.equal(fc.type, 'FeatureCollection');
    assert.deepEqual(fc.features[0].geometry.coordinates, [-63.5, 44.5]);
    assert.equal(typeof fc.features[0].properties.LAT, 'number');
    assert.equal(fc.features[0].properties.SUBMITTED_AT, s.submittedAt);
  });

  test(`${def.id}: required fields and blank detection`, () => {
    const s = createSession(def, { observer: 'J. Smith' });
    assert.ok(isBlank(def, s), 'new session with only defaults is blank');
    assert.ok(missingFields(def.meta, s.meta).length > 0);
    s.meta[def.labelKey] = 'X1';
    assert.ok(!isBlank(def, s));
    assert.match(sessionLabel(def, s), /X1/);
  });

  test(`${def.id}: report hooks run on empty and full sessions`, () => {
    for (const s of [createSession(def), fullSession(def)]) {
      const ctx = { meta: s.meta, obs: s.obs, habitat: s.habitat, esc: x => String(x ?? '') };
      for (const fn of ['intro', 'methods', 'findings']) assert.equal(typeof def.report[fn](ctx), 'string');
      assert.ok(def.report.presets.recommendations[def.report.autoRec(ctx)], 'autoRec names a real preset');
      assert.ok(Array.isArray(def.report.stats(s.obs)));
    }
  });
}

test('service worker pre-caches every app file (offline launch)', async () => {
  const { readFileSync, readdirSync, existsSync } = await import('node:fs');
  const root = new URL('..', import.meta.url).pathname;
  const sw = readFileSync(join(root, 'sw.js'), 'utf8');
  const listed = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]).filter(Boolean);
  const walk = dir => readdirSync(join(root, dir), { withFileTypes: true })
    .flatMap(e => e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]);
  for (const f of [...walk('js'), 'data/species_list.js', 'css/style.css', 'index.html']) {
    assert.ok(listed.includes(f), `sw.js APP list is missing ${f}`);
  }
  for (const f of listed) assert.ok(existsSync(join(root, f)), `sw.js lists missing file ${f}`);
});

test('legacy extras are exported, not dropped', () => {
  const def = SURVEYS.find(d => d.id === 'NEST');
  const s = fullSession(def);
  s.obs[0].photosTaken = 'Yes';
  const csv = toCSV(buildTable(def, s, 'obs'));
  assert.ok(csv.split('\r\n')[0].includes('PHOTOS_TAKEN'));
});

test('package zip is a valid archive', () => {
  const def = SURVEYS[0];
  const s = fullSession(def);
  const files = packageFiles(def, s, photoFileNames(s));
  files.push({ name: 'photos/OBS001_1.jpg', data: new Uint8Array([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]) });
  const zip = makeZip(files);
  const dir = mkdtempSync(join(tmpdir(), 'frax-'));
  const path = join(dir, 'test.zip');
  writeFileSync(path, zip);
  const out = execFileSync('python3', ['-c',
    'import sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;print("\\n".join(z.namelist()))', path]).toString();
  for (const f of files) assert.ok(out.includes(f.name), `zip missing ${f.name}`);
});

test('v1 session migrates metadata, records and stamps', () => {
  const old = {
    id: 'NEST_1700000000000', type: 'NEST', status: 'submitted', label: 'x',
    createdAt: '2026-06-01T12:00:00.000Z', updatedAt: '2026-06-01T13:00:00.000Z',
    metadata: { nestProjectID: 'P-1', nestObserver: 'J', nestSiteName: 'Lot 7', nestHabitatTypes: 'Treed, Shrub',
                nestProvince: 'NS', nestSubmittedAt: '6/1/2026, 1:00:00 PM' },
    snapshot: {
      nestObservations: [{ species: 'Robin', status: 'Active', contents: ['Eggs'], eggCount: 3, photos: true,
        projectID: 'P-1', observer: 'J', latlng: { lat: 44.1, lng: -63.1 }, timestamp: '6/1/2026, 12:30:00 PM',
        nestSubmittedAt: 'x' }],
      habitatObservations: [{ surveyType: 'NEST', featureType: 'Snag/Cavity', criteria: ['a'], condition: '', size: '',
        latlng: { lat: 44.2, lng: -63.2 }, timestamp: 't' }],
    },
  };
  const s = migrateSession(old);
  assert.equal(s.type, 'NEST');
  assert.equal(s.status, 'submitted');
  assert.deepEqual(s.meta.habitatTypes, ['Treed', 'Shrub']);
  assert.equal(s.meta.siteName, 'Lot 7');
  assert.equal(s.meta.surveyDate, '2026-06-01');
  assert.equal(s.submittedAt, '6/1/2026, 1:00:00 PM');
  const r = s.obs[0];
  assert.equal(r.lat, 44.1);
  assert.equal(r.species, 'Robin');
  assert.equal(r.photosTaken, 'Yes');
  assert.ok(!('projectID' in r) && !('observer' in r) && !('nestSubmittedAt' in r), 'copied metadata dropped');
  assert.ok(!('condition' in s.habitat[0]), 'empty legacy fields dropped');
  assert.equal(s.habitat[0].time, 't', 'unparseable timestamps kept verbatim');
});

test('v1 MOOSE and BBS types map correctly', () => {
  const m = migrateSession({ id: 'MOOSE_1', type: 'MOOSE', metadata: { mooseTransectID: 'T9', mooseNotes: 'n' },
    snapshot: { mooseObservations: [{ species: 'Moose', obsType: 'Tracks', latlng: { lat: 1, lng: 2 } }] } });
  assert.equal(m.type, 'WILDLIFE');
  assert.equal(m.meta.transectID, 'T9');
  assert.equal(m.meta.notes, 'n');
  const b = migrateSession({ id: 'BBS_1', type: 'BBS', metadata: { pointID: 'P', surveyLat: '44', surveyLng: '-63',
    surveyStartTime: '06:00', surveyType: 'Breeding Bird Survey' },
    snapshot: { speciesMarkers: [{ code: 'AMRO', name: 'American Robin', count: '2', breeding: 'C', latlng: { lat: 1, lng: 2 } }] } });
  assert.equal(b.meta.startTime, '06:00');
  assert.ok(!('surveyType' in b.meta));
  assert.equal(b.obs[0].speciesCode, 'AMRO');
  assert.equal(b.obs[0].species, 'American Robin');
  assert.equal(b.obs[0].count, 2);
  assert.equal(b.obs[0].breeding, 'C');
});

test('unsaved v1 live-store data is recovered as drafts', () => {
  const sessions = recoverLiveStores({
    turtleObservations: [{ siteName: 'Reach 4', observer: 'K', species: 'Wood Turtle', latlng: { lat: 1, lng: 2 } }],
    habitatObservations: [{ surveyType: 'TURTLE', featureType: 'Basking Site', latlng: { lat: 1, lng: 2 } }],
  });
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].type, 'TURTLE');
  assert.equal(sessions[0].meta.siteName, 'Reach 4');
  assert.equal(sessions[0].obs.length, 1);
  assert.equal(sessions[0].habitat.length, 1);
  assert.equal(sessions[0].status, 'draft');
});
