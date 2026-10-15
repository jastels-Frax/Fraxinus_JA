# Fraxinus Wildlife Survey Module

Offline-first field survey tool: **Breeding Bird point counts, General Wildlife, Wood Turtle, and Nest Sweep** surveys, with habitat/feature records, photos, a data-package export and an editable PDF report.

Runs standalone (open `index.html` from any static host) or embedded in a host app.

## Layout

```
js/app.js            mount(container, options) — the only entry point
js/surveys/*.js      one definition per survey: fields, map colours, report text
js/core/             pure logic (no DOM): session model, IndexedDB store,
                     v1 migration, CSV/GeoJSON/KML/JSON export, zip writer
js/ui/               forms, home screen, survey screen, export dialog
js/report.js         editable print-to-PDF report
js/map/leaflet.js    standalone map adapter (replace when embedding)
js/location.js       browser GPS provider (replace to share host GPS)
```

## Embedding in a host app

```js
import { mount } from './survey-module/js/app.js';

const app = await mount(document.getElementById('surveys'), {
  createMap: (container, { onSelect, onTap }) => ({
    setFeatures(features) {},  // [{ id, lat, lng, label, color, dashed }] — full redraw
    setPosition(pos) {},       // { lat, lng, accuracy } — user's GPS
    focus(id) {},              // centre on a record
    fitTo(points) {},          // [{ lat, lng }]
    center() { return { lat, lng }; },
    destroy() {},
    // optional: toggleFollow() → bool, toggleRings(center) → bool
  }),
  location: hostGps,           // optional: { start, stop, current(), subscribe(fn) → unsubscribe }
});
// app.destroy() to unmount
```

Call `onSelect(recordId)` when the user taps a survey marker, and `onTap({ lat, lng })` for map taps (BBS uses it to place birds). All UI is scoped under `.fx-app`; the module creates no globals. Leaflet is only needed by the bundled adapter.

## Data

- **One record per survey visit** (`session`), saved to IndexedDB on every change. Photos are stored as blobs alongside it.
- **Export** (✅ Submit, or ⬇ Export from the record list or home screen) downloads one `.zip`:
  `observations.csv/.geojson`, `habitat.csv/.geojson`, `survey.kml`, `session.json` (lossless) and `photos/`.
  Every row carries all survey metadata + every record field, so each file stands alone.
- Data from the previous app version (`SpeciesSurveyDB`) is imported automatically on first launch, including any unsaved survey left in progress. The old database is left untouched.
- Settings → *Back up all surveys* / *Restore* moves surveys between devices (photos travel in each survey's zip).

## Adding or changing a survey

Edit or add a file in `js/surveys/` and register it in `js/surveys/index.js`. Forms, map styling, exports and the report all follow the definition; the tests below check every field reaches every export format.

## Tests

```sh
npm test                                   # data layer: exports, zip, migration, offline cache list
node tests/e2e.mjs path/to/leaflet/dist    # drives the app in Chromium through every survey type
```

The end-to-end test needs Playwright and a local copy of Leaflet 1.9.4 (`npm pack leaflet@1.9.4`); network requests are stubbed so it runs offline.

When releasing a change, bump `CACHE` in `sw.js` so installed copies pick it up.
