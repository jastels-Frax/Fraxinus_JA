// js/ui/home.js — Home screen: survey picker, drafts, archive, settings.

import { h, toast, choose, confirmDialog, openModal, downloadBlob } from './dom.js';
import { showExportDialog } from './exporter.js';
import { SURVEYS, getSurvey } from '../surveys/index.js';
import { sessionLabel, recordCount, photoCount } from '../core/session.js';
import * as store from '../core/store.js';

const K = { observer: 'fraxinus.defaultObserver', project: 'fraxinus.defaultProjectID',
            lastObserver: 'fraxinus.lastObserver', lastProject: 'fraxinus.lastProjectID', province: 'fraxinus.province' };
const ls = {
  get: k => { try { return localStorage.getItem(k) || ''; } catch { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch { /* private mode */ } },
};

// Prefill for new sessions: Settings defaults first, else whoever surveyed last.
export function sessionDefaults() {
  return {
    observer: ls.get(K.observer) || ls.get(K.lastObserver),
    projectID: ls.get(K.project) || ls.get(K.lastProject),
  };
}
export function rememberDefaults(meta) {
  if (meta.observer) ls.set(K.lastObserver, meta.observer);
  if (meta.projectID) ls.set(K.lastProject, meta.projectID);
}
export const getProvince = () => ls.get(K.province) || 'NS';

/**
 * renderHome(root, { logoSrc, onStart(def, session|null) })
 * onStart(def, null) → start a new session; onStart(def, session) → resume.
 */
export async function renderHome(root, { logoSrc, onStart }) {
  const sessions = await store.listSessions().catch(err => {
    toast(`Cannot open local storage: ${err.message}`, 'error', 8000);
    return [];
  });
  const drafts = sessions.filter(s => s.status === 'draft' && getSurvey(s.type));
  const archive = sessions.filter(s => s.status === 'submitted' && getSurvey(s.type));

  const start = async def => {
    const mine = drafts.filter(s => s.type === def.id);
    if (!mine.length) return onStart(def, null);
    const latest = mine[0];
    const c = await choose({ title: 'Survey in progress', icon: def.icon,
      message: `${sessionLabel(def, latest)}<br><small>${recordCount(latest)} records · updated ${fmt(latest.updatedAt)}</small>`,
      choices: [{ label: '▶ Continue', value: 'continue', kind: 'primary' }, { label: '＋ Start new', value: 'new' }, { label: 'Cancel', value: null }] });
    if (c === 'continue') onStart(def, latest);
    if (c === 'new') onStart(def, null);
  };

  const item = s => {
    const def = getSurvey(s.type);
    const p = photoCount(s);
    return h('div', { class: 'fx-session' },
      h('span', { class: 'fx-session-icon' }, def.icon),
      h('div', { class: 'fx-session-text' },
        h('b', {}, sessionLabel(def, s), s.recovered ? h('span', { class: 'fx-badge fx-soci' }, 'Recovered') : ''),
        h('small', {}, `${recordCount(s)} records${p ? ` · ${p} photos` : ''} · ${fmt(s.updatedAt)}`)),
      h('div', { class: 'fx-session-actions' },
        h('button', { class: 'fx-btn fx-primary fx-small', onclick: () => onStart(def, s) }, s.status === 'draft' ? '▶ Resume' : '✏ Open'),
        h('button', { class: 'fx-btn fx-small', onclick: () => showExportDialog(def, s) }, '⬇ Export'),
        h('button', { class: 'fx-btn fx-danger fx-small', 'aria-label': 'Delete', onclick: async () => {
          if (!await confirmDialog('Delete survey?', `${sessionLabel(def, s)}<br>This removes its records and photos from this device.`, 'Delete')) return;
          await store.deleteSession(s.id);
          renderHome(root, { logoSrc, onStart });
        } }, '✕')));
  };

  root.replaceChildren(h('div', { class: 'fx-home' },
    h('button', { class: 'fx-settings', title: 'Settings', 'aria-label': 'Settings',
      onclick: () => openSettings(() => renderHome(root, { logoSrc, onStart })) }, '⚙'),
    logoSrc ? h('img', { class: 'fx-logo', src: logoSrc, alt: 'Fraxinus Environmental & Geomatics' }) : '',
    h('h1', {}, 'NTB Wildlife App'),
    h('p', { class: 'fx-muted' }, 'Select a survey type to begin'),
    h('div', { class: 'fx-cards' }, SURVEYS.map(def =>
      h('button', { class: 'fx-card', onclick: () => start(def) },
        h('span', { class: 'fx-card-icon' }, def.icon),
        h('b', {}, def.name),
        h('small', {}, def.blurb)))),
    drafts.length ? h('section', {}, h('h2', {}, '✎ Drafts'), drafts.map(item)) : '',
    h('section', {}, h('h2', {}, '🗄 Survey archive'),
      archive.length ? archive.map(item) : h('p', { class: 'fx-muted' }, 'No submitted surveys yet.')),
    h('p', { class: 'fx-credit' }, 'Fraxinus Environmental & Geomatics')));
}

const fmt = iso => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso || '') : d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

// ─── Settings ─────────────────────────────────────────────────────────────
async function openSettings(onChanged) {
  const m = openModal({ dismissible: true, className: 'fx-dialog fx-settings-sheet' });
  const input = (label, key, placeholder) => {
    const el = h('input', { type: 'text', value: ls.get(key), placeholder, autocomplete: 'off' });
    return { el, key, row: h('div', { class: 'fx-field' }, h('label', { class: 'fx-label' }, label), el) };
  };
  const obs = input('Default observer', K.observer, 'e.g. J. Smith');
  const prj = input('Default project ID', K.project, 'e.g. NTB-2026');
  const prov = h('select', {}, ['NS', 'NB', 'PEI', 'NL'].map(p => h('option', { value: p }, p)));
  prov.value = getProvince();

  let usage = '';
  try {
    const est = await navigator.storage?.estimate?.();
    if (est) usage = `Using ${(est.usage / 1e6).toFixed(1)} MB of ~${(est.quota / 1e6).toFixed(0)} MB available.`;
  } catch { /* unsupported */ }

  const importInput = h('input', { type: 'file', accept: 'application/json,.json', style: 'display:none', onchange: async e => {
    try {
      const data = JSON.parse(await e.target.files[0].text());
      const n = await store.importSessions(Array.isArray(data.sessions) ? data.sessions : []);
      toast(`Restored ${n} survey${n !== 1 ? 's' : ''}`, 'success');
      onChanged();
    } catch (err) { toast(`Restore failed: ${err.message}`, 'error'); }
  } });

  m.el.append(
    h('h2', {}, '⚙ Settings'),
    obs.row, prj.row,
    h('div', { class: 'fx-field' }, h('label', { class: 'fx-label' }, 'Bird species list (province)'), prov),
    h('h3', {}, 'Data'),
    h('p', { class: 'fx-muted fx-small-text' }, usage),
    h('div', { class: 'fx-dialog-btns' },
      h('button', { class: 'fx-btn', onclick: async () => {
        const sessions = await store.listSessions();
        downloadBlob(new Blob([JSON.stringify({ format: 'fraxinus-wildlife-backup', version: 2, exportedAt: new Date().toISOString(), sessions }, null, 2)],
          { type: 'application/json' }), `fraxinus_backup_${new Date().toISOString().slice(0, 10)}.json`);
        toast('Backup downloaded (photos are included in each survey’s zip export)', 'success', 5000);
      } }, '⬇ Back up all surveys (JSON)'),
      h('button', { class: 'fx-btn', onclick: () => importInput.click() }, '⬆ Restore from backup'),
      importInput,
      h('button', { class: 'fx-btn fx-danger', onclick: async () => {
        const archived = (await store.listSessions()).filter(s => s.status === 'submitted');
        if (!archived.length) return toast('No archived surveys.');
        if (!await confirmDialog('Delete archive?', `Delete ${archived.length} submitted survey(s) and their photos from this device? Export them first if needed.`, 'Delete all')) return;
        for (const s of archived) await store.deleteSession(s.id);
        toast(`${archived.length} archived surveys deleted`, 'success');
        onChanged();
      } }, '🗑 Delete all archived surveys')),
    h('div', { class: 'fx-form-foot' }, h('span', { class: 'fx-spacer' }),
      h('button', { class: 'fx-btn', onclick: () => m.close() }, 'Cancel'),
      h('button', { class: 'fx-btn fx-primary', onclick: () => {
        ls.set(obs.key, obs.el.value.trim());
        ls.set(prj.key, prj.el.value.trim());
        ls.set(K.province, prov.value);
        toast('Settings saved', 'success');
        m.close();
      } }, 'Save')));
}
