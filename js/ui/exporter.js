// js/ui/exporter.js — Export dialog: data package (.zip) and PDF report.

import { h, openModal, toast, downloadBlob } from './dom.js';
import { packageFiles, photoFileNames, baseName } from '../core/export.js';
import { makeZip } from '../core/zip.js';
import { sessionLabel, recordCount, photoCount } from '../core/session.js';
import { openReport } from '../report.js';
import * as store from '../core/store.js';

// One .zip: CSV + GeoJSON (observations, habitat), KML, lossless JSON, and photos/.
export async function downloadPackage(def, session) {
  const referenced = new Set([...session.obs, ...session.habitat].flatMap(r => r.photos || []));
  const photos = (await store.photosForSession(session.id)).filter(p => referenced.has(p.id));
  const types = Object.fromEntries(photos.map(p => [p.id, p.type]));
  const names = photoFileNames(session, types);
  const files = packageFiles(def, session, names);
  for (const p of photos) {
    files.push({ name: `photos/${names[p.id]}`, data: new Uint8Array(await p.blob.arrayBuffer()) });
  }
  const missing = referenced.size - photos.length;
  const name = baseName(def, session);
  downloadBlob(new Blob([makeZip(files.map(f => ({ ...f, name: `${name}/${f.name}` })))], { type: 'application/zip' }), `${name}.zip`);
  return { files: files.length, photos: photos.length, missing };
}

export function showExportDialog(def, session, { title = 'Export', icon = '⬇' } = {}) {
  return new Promise(resolve => {
    const m = openModal({ dismissible: true, onCancel: () => done(), className: 'fx-dialog' });
    const done = () => { m.close(); resolve(); };
    const n = recordCount(session), p = photoCount(session);

    const zipBtn = h('button', { class: 'fx-btn fx-primary', onclick: async () => {
      zipBtn.disabled = true; zipBtn.textContent = 'Packaging…';
      try {
        const r = await downloadPackage(def, session);
        toast(`Downloaded ${r.files} files${r.missing ? ` — ${r.missing} photo(s) missing on this device` : ''}`, r.missing ? 'error' : 'success', 5000);
      } catch (err) {
        console.error(err);
        toast(`Export failed: ${err.message}`, 'error', 6000);
      }
      zipBtn.disabled = false; zipBtn.textContent = '⬇ Data package (.zip)';
    } }, '⬇ Data package (.zip)');

    const pdfBtn = h('button', { class: 'fx-btn fx-primary', onclick: () => {
      openReport(def, session, { loadPhoto: store.getPhoto })
        .catch(err => { console.error(err); toast(`Report failed: ${err.message}`, 'error', 6000); });
    } }, '📄 PDF report');

    m.el.append(
      h('div', { class: 'fx-dialog-icon' }, icon),
      h('h2', {}, title),
      h('p', { class: 'fx-muted' }, sessionLabel(def, session)),
      h('p', { class: 'fx-muted fx-small-text' }, `${n} record${n !== 1 ? 's' : ''} · ${p} photo${p !== 1 ? 's' : ''}`),
      h('div', { class: 'fx-dialog-btns' }, zipBtn, pdfBtn,
        h('p', { class: 'fx-hint' }, 'The zip holds CSV, GeoJSON, KML, full JSON and all photos.'),
        h('button', { class: 'fx-btn fx-ghost', onclick: done }, 'Done')));
  });
}
