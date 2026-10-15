// tests/e2e.mjs — Drives the real app in Chromium through every survey type:
// metadata, records with photos, edit, delete+undo, submit, zip + PDF export,
// plus migration of a seeded v1 database. Fails on any console/page error.
//
// Run: node tests/e2e.mjs [path-to-leaflet-dist]
// Needs Playwright (global) and python3 (zip validation). CDN/imagery requests
// are served locally so the test runs offline.

import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LEAFLET = process.argv[2];
const PORT = 8123;
const BASE = `http://127.0.0.1:${PORT}/`;
const PNG = readFileSync(join(ROOT, 'img/icon-192.png'));
const tmp = mkdtempSync(join(tmpdir(), 'frax-e2e-'));

const errors = [];
const log = (...a) => console.log('  ', ...a);
const SHOTS = process.env.SHOTS;
const shot = async (name, pg = page) => { if (SHOTS) await pg.screenshot({ path: join(SHOTS, name + '.png'), timeout: 8000 }).catch(e => log('(screenshot skipped:', name, e.message.split('\n')[0] + ')')); };
const assert = (cond, msg) => { if (!cond) throw new Error('ASSERT: ' + msg); };

const server = spawn(process.execPath, [require.resolve('/opt/node22/lib/node_modules/http-server/bin/http-server'),
  ROOT, '-p', String(PORT), '-c-1', '-s'], { stdio: 'ignore' });
await new Promise(r => setTimeout(r, 1200));

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 412, height: 860 }, isMobile: true, hasTouch: true,
  geolocation: { latitude: 44.65, longitude: -63.57, accuracy: 6 }, permissions: ['geolocation'],
  acceptDownloads: true, serviceWorkers: 'block',
});

await context.route(/unpkg\.com/, route => {
  const file = new URL(route.request().url()).pathname.split('/dist/')[1];
  if (LEAFLET && file && existsSync(join(LEAFLET, file))) {
    return route.fulfill({ path: join(LEAFLET, file), headers: { 'access-control-allow-origin': '*' } });
  }
  return route.fulfill({ status: 404, body: '' });
});
await context.route(/arcgisonline|openstreetmap/, route =>
  route.fulfill({ body: PNG, contentType: 'image/png', headers: { 'access-control-allow-origin': '*' } }));
await context.route(/fonts\.(googleapis|gstatic)/, route => route.fulfill({ body: '', contentType: 'text/css' }));

const page = await context.newPage();
page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
page.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) errors.push(`console: ${m.text()}`); });
page.on('dialog', d => { errors.push(`native dialog: ${d.message()}`); d.dismiss(); });

// ─── Seed a v1 database so migration runs on first load ───────────────────
await page.route(`${BASE}seed`, r => r.fulfill({ body: '<!doctype html><title>seed</title>', contentType: 'text/html' }));
await page.goto(`${BASE}seed`);
await page.evaluate(() => new Promise((resolve, reject) => {
  const r = indexedDB.open('SpeciesSurveyDB', 6);
  r.onupgradeneeded = () => {
    const db = r.result;
    db.createObjectStore('sessions', { keyPath: 'id' });
    for (const s of ['speciesMarkers', 'mooseObservations', 'turtleObservations', 'nestObservations', 'habitatObservations']) {
      db.createObjectStore(s, { keyPath: 'id', autoIncrement: true });
    }
  };
  r.onsuccess = () => {
    const db = r.result;
    const tx = db.transaction(['sessions', 'turtleObservations'], 'readwrite');
    tx.objectStore('sessions').put({ id: 'MOOSE_1', type: 'MOOSE', status: 'submitted', label: 'old',
      createdAt: '2026-05-01T10:00:00.000Z', updatedAt: '2026-05-01T11:00:00.000Z',
      metadata: { mooseTransectID: 'LEGACY-T1', mooseObserver: 'Old Observer' },
      snapshot: { mooseObservations: [{ species: 'Moose', obsType: 'Tracks', projectID: 'x', latlng: { lat: 44.6, lng: -63.5 }, timestamp: '5/1/2026, 10:30:00 AM' }] } });
    tx.objectStore('turtleObservations').add({ siteName: 'CRASHED-REACH', observer: 'K', species: 'Wood Turtle', latlng: { lat: 44.61, lng: -63.51 } });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error);
  };
  r.onerror = () => reject(r.error);
}));

await page.goto(BASE);
await page.waitForSelector('.fx-card');
const homeText = await page.textContent('.fx-home');
await shot('01-home');
assert(homeText.includes('LEGACY-T1'), 'migrated v1 session shown in archive');
assert(homeText.includes('CRASHED-REACH'), 'recovered unsaved v1 data shown in drafts');
log('✓ v1 migration + crash recovery');

// ─── Helpers ──────────────────────────────────────────────────────────────
const field = key => page.locator(`.fx-modal .fx-field[data-key="${key}"]`);
const fill = (key, val) => field(key).locator('input, textarea').first().fill(String(val));
const pick = (key, val) => field(key).locator('select').selectOption(val);
const tap = (key, label) => field(key).getByRole('button', { name: label, exact: true }).click();
const save = () => page.locator('.fx-modal .fx-form-foot').getByRole('button', { name: 'Save', exact: true }).click();
const tool = name => page.getByRole('button', { name, exact: true });
const waitClosed = () => page.waitForFunction(() => !document.querySelector('.fx-modal .fx-form-foot'));

async function addPhoto() {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.fx-modal').getByRole('button', { name: '📷 Camera' }).click()]);
  await chooser.setFiles({ name: 'field.png', mimeType: 'image/png', buffer: PNG });
  await page.locator('.fx-modal .fx-thumb').first().waitFor();
}

async function startSurvey(name) {
  await page.getByRole('button', { name: new RegExp(name) }).first().click();
  const cont = page.getByRole('button', { name: '＋ Start new' });
  if (await cont.isVisible().catch(() => false)) await cont.click();
  await page.waitForSelector('.fx-survey');
  await page.waitForSelector('.fx-modal .fx-form-foot');   // details form opens automatically
}

async function finishAndExport(expect) {
  await tool('Submit survey').click();
  const anyway = page.getByRole('button', { name: 'Submit anyway' });
  if (await anyway.isVisible({ timeout: 800 }).catch(() => false)) await anyway.click();
  await page.waitForSelector('text=Survey submitted');
  await shot('05-submitted-' + expect[0].replace(/\W/g, ''));

  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '⬇ Data package (.zip)' }).click()]);
  const zipPath = join(tmp, download.suggestedFilename());
  await download.saveAs(zipPath);
  const listing = execFileSync('python3', ['-c', `
import sys, zipfile
z = zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None
for n in z.namelist():
    print('FILE', n)
    if n.endswith('observations.csv') or n.endswith('habitat.csv') or n.endswith('session.json'):
        print(z.read(n).decode('utf-8-sig'))
`, zipPath]).toString();
  for (const s of expect) assert(listing.includes(s), `zip missing "${s}"`);
  assert(/FILE .*photos\/OBS001_.*\.png/.test(listing), 'photo bundled in zip');

  const [report] = await Promise.all([context.waitForEvent('page'), page.getByRole('button', { name: '📄 PDF report' }).click()]);
  await report.waitForFunction(() => document.querySelector('.page h2'), null, { timeout: 15000 });
  await report.setViewportSize({ width: 900, height: 1300 });
  await shot('report-' + expect[0].replace(/\W/g, ''), report);
  if (SHOTS) writeFileSync(join(SHOTS, 'report-' + expect[0].replace(/\W/g, '') + '.html'), await report.content());
  if (SHOTS) execFileSync('cp', [zipPath, SHOTS]);
  await report.waitForFunction(() => { const l = document.getElementById('logo'); return l.complete && l.naturalWidth > 0; }, null, { timeout: 10000 });
  const reportText = await report.textContent('body');
  assert(reportText.includes('Recommendations') && reportText.includes('Photographs'), 'report sections rendered');
  assert(await report.locator('img.map').count() > 0, 'report map image rendered');
  await report.close();

  await page.getByRole('button', { name: 'Done' }).click();
  await page.waitForSelector('.fx-home');
  return listing;
}

// ─── Nest sweep ───────────────────────────────────────────────────────────
await startSurvey('Nest Sweep');
await fill('observer', 'E2E Observer');
await fill('siteName', 'Lot 42');
await shot('02-nest-meta');
await pick('province', 'NS');
await field('habitatTypes').getByRole('button', { name: 'Treed' }).click();
await save(); await waitClosed();

await tool('Add nest').click();
await save();                                   // required fields missing → stays open
assert(await page.locator('.fx-modal .fx-missing').count() >= 2, 'required fields flagged');
await tap('status', 'Active');
await pick('disposition', 'Buffer zone required');
await field('contents').getByRole('button', { name: 'Eggs' }).click();
await field('eggCount').getByRole('button', { name: 'increase' }).click();
await field('eggCount').getByRole('button', { name: 'increase' }).click();
await pick('substrate', 'Tree');
await fill('treeHeight', 7.5);
await fill('note', 'Robin cup nest, E2E');
await addPhoto();
await shot('03-nest-form');
await save(); await waitClosed();

await tool('Add habitat / feature').click();
await pick('featureType', 'Snag/Cavity');
await field('criteria').getByRole('button', { name: 'Cavity entrance visible' }).click();
await save(); await waitClosed();

// Edit via the records drawer; then delete + undo
await tool('Records').click();
await shot('04-drawer');
await page.locator('.fx-drawer .fx-item-main').first().click();
await fill('buffer', 30);
await save(); await waitClosed();
await page.locator('.fx-drawer .fx-item-main').first().click();
await page.locator('.fx-modal').getByRole('button', { name: 'Delete' }).click();
await page.getByRole('button', { name: 'Undo' }).click();
await page.waitForFunction(() => document.querySelectorAll('.fx-drawer .fx-item').length === 2);
await page.locator('.fx-drawer').getByRole('button', { name: '✕' }).click();
log('✓ nest: entry, validation, edit, delete/undo');

let out = await finishAndExport(['Lot 42', 'E2E Observer', 'Robin cup nest, E2E', 'Buffer zone required', 'Snag/Cavity',
  'Cavity entrance visible', 'TREE_HEIGHT_M', '7.5', 'EGG_COUNT', 'Treed', 'observations.geojson', 'survey.kml']);
assert(/BUFFER[^\n]*\n[^\n]*,30,/.test(out) || out.includes('"buffer": 30'), 'edited buffer value exported');
log('✓ nest: submit, zip (CSV/GeoJSON/KML/JSON/photos), PDF report');

// ─── BBS ──────────────────────────────────────────────────────────────────
await startSurvey('Breeding Bird');
await fill('observer', 'Birder');
await fill('pointID', 'PT-7');
await field('survey').getByRole('button', { name: '📍 GPS' }).click();
await save(); await waitClosed();
await page.locator('.fx-timer').getByRole('button', { name: '▶' }).click();

await tool('Add bird observation').click();
await field('species').locator('input[type=search]').fill('amro');
await field('species').locator('.fx-sp-item').first().click();
await pick('breeding', 'S');
await addPhoto();
await save(); await waitClosed();

// Tap the map to place a second bird away from the point; reuse the recent-species chip
await page.mouse.click(300, 600);
await page.waitForSelector('.fx-modal .fx-form-foot');
await shot('06-bbs-recent');
await field('species').getByRole('button', { name: 'AMRO' }).click();
await save(); await waitClosed();
await shot('07-bbs-map');
out = await finishAndExport(['PT-7', 'Birder', 'AMRO', 'American Robin', 'Turdus migratorius', 'SURVEY_LAT', 'BREEDING', 'RANGE_M', 'BEARING_DEG']);
const rangeRow = out.split('\n').find(l => l.includes('AMRO') && /,\d+,\d+,/.test(l));
assert(rangeRow, 'range/bearing computed for map-placed bird');
log('✓ bbs: GPS point, timer, species search, recent chip, tap-to-place, range/bearing');

// ─── Wildlife (with "Other" free text) ────────────────────────────────────
await startSurvey('General Wildlife');
await fill('observer', 'Tracker');
await fill('transectID', 'T-3');
await save(); await waitClosed();
await tool('Add wildlife observation').click();
await pick('species', '__other__');
await field('species').locator('input[type=text]').fill('Wolverine?');
await pick('obsType', 'Tracks');
await addPhoto();
await save(); await waitClosed();
await finishAndExport(['T-3', 'Wolverine?', 'Tracks']);
log('✓ wildlife: Other free-text value');

// ─── Turtle ───────────────────────────────────────────────────────────────
await startSurvey('Wood Turtle');
await fill('observer', 'Herp');
await fill('siteName', 'Reach 9');
await fill('waterTemp', 14.5);
await save(); await waitClosed();
await tool('Add turtle observation').click();
await tap('sex', 'Female');
await tap('ageClass', 'Adult');
await pick('activity', 'Basking');
await addPhoto();
await save(); await waitClosed();
await finishAndExport(['Reach 9', '14.5', 'Wood Turtle', 'Female', 'Basking']);
log('✓ turtle');

// ─── Blank survey is discarded; resumed draft keeps data ──────────────────
await startSurvey('Wood Turtle');
await page.locator('.fx-modal').getByRole('button', { name: 'Cancel' }).click();
await tool('Home (saves automatically)').click();
await page.waitForSelector('.fx-home');
const drafts = await page.locator('.fx-session:has-text("Untitled")').count();
assert(drafts === 0, 'blank session discarded on exit');
log('✓ blank sessions are not kept');

await browser.close();
server.kill();

if (errors.length) {
  console.error('\nErrors during run:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('\nE2E PASSED');
