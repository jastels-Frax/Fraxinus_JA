// js/ui/survey.js — The in-survey screen: map, toolbar, record list, timer, submit.
// Every change is persisted immediately; there is no separate "save draft" step.

import { h, toast, undoToast, choose, confirmDialog } from './dom.js';
import { openForm } from './form.js';
import { showExportDialog } from './exporter.js';
import { newRecord, missingFields, isBlank, recordCount, sessionLabel } from '../core/session.js';
import { localISO, nowHM, uid } from '../core/fields.js';
import * as store from '../core/store.js';
import { rememberDefaults } from './home.js';

export function openSurvey(root, { def, session, createMap, location, speciesList = [], onExit }) {
  let drawerOpen = false, closed = false;

  // ─── Layout ─────────────────────────────────────────────────────────────
  const mapEl = h('div', { class: 'fx-map' });
  const title = h('div', { class: 'fx-title' });
  const gps = h('span', { class: 'fx-gps' }, 'GPS…');
  const saved = h('span', { class: 'fx-saved' });
  const count = h('span', { class: 'fx-count' });
  const metaDot = h('span', { class: 'fx-dot-alert', hidden: true });
  const drawer = h('div', { class: 'fx-drawer', hidden: true });

  const btn = (icon, label, onclick, extra = {}) =>
    h('button', { class: 'fx-tool', title: label, 'aria-label': label, onclick, ...extra }, icon);

  const tools = h('div', { class: 'fx-toolbar' },
    btn('←', 'Home (saves automatically)', () => exit()),
    btn(h('span', {}, '📋', metaDot), 'Survey details', () => editMeta()),
    btn(h('span', {}, '☰', count), 'Records', () => toggleDrawer()),
    btn(def.obs.icon, `Add ${def.obs.title.toLowerCase()}`, () => addRecord('obs'), { class: 'fx-tool fx-tool-big' }),
    btn(def.habitat.icon, 'Add habitat / feature', () => addRecord('habitat'), { class: 'fx-tool fx-tool-big' }),
    btn('✅', 'Submit survey', () => submit()),
    btn('?', 'Help', () => help()));

  const screen = h('div', { class: 'fx-survey' }, mapEl,
    h('div', { class: 'fx-topbar' }, title, h('span', { class: 'fx-status' }, gps, saved)),
    tools, drawer);
  root.append(screen);

  // ─── Map + GPS ──────────────────────────────────────────────────────────
  const map = createMap(mapEl, {
    onSelect: id => editRecord(id),
    onTap: def.tapToPlace ? latlng => addRecord('obs', latlng) : null,
  });
  if (map.toggleRings) {
    tools.insertBefore(btn('◎', 'Distance rings (50–200 m)', e => {
      const centre = surveyPoint() || location.current();
      if (!centre) return toast('Set the survey point or wait for GPS first.', 'error');
      e.currentTarget.classList.toggle('fx-on', map.toggleRings(centre));
    }), tools.children[5]);
  }
  if (map.toggleFollow) {
    tools.insertBefore(btn('⌖', 'Follow my position', e => e.currentTarget.classList.toggle('fx-on', map.toggleFollow())),
      tools.children[tools.children.length - 2]);
  }
  location.start();
  const unsub = location.subscribe(p => {
    if (!p) { gps.textContent = 'No GPS'; gps.className = 'fx-gps fx-bad'; return; }
    map.setPosition(p);
    gps.textContent = `±${Math.round(p.accuracy)} m`;
    gps.className = `fx-gps ${p.accuracy <= 10 ? 'fx-good' : p.accuracy <= 30 ? 'fx-ok' : 'fx-bad'}`;
  });
  const pts = [...session.obs, ...session.habitat].filter(r => Number.isFinite(r.lat));
  if (pts.length) map.fitTo(pts);

  const timer = def.timer ? createTimer() : null;
  if (timer) screen.append(timer.el);

  render();
  if (!recordCount(session) && missingFields(def.meta, session.meta).length) editMeta();

  // ─── Persistence ────────────────────────────────────────────────────────
  async function persist() {
    session.updatedAt = localISO();
    render();
    try {
      await store.putSession(session);
      saved.textContent = `Saved ${nowHM()}`;
      saved.classList.remove('fx-bad');
    } catch (err) {
      console.error(err);
      saved.textContent = 'NOT SAVED';
      saved.classList.add('fx-bad');
      toast(`Save failed: ${err.message || err}. Free up device storage and try again.`, 'error', 8000);
    }
  }

  function render() {
    title.textContent = sessionLabel(def, session);
    const n = recordCount(session);
    count.textContent = n ? String(n) : '';
    metaDot.hidden = !missingFields(def.meta, session.meta).length;
    map.setFeatures([
      ...session.obs.map((r, i) => ({ id: r.id, lat: r.lat, lng: r.lng, label: `${i + 1} ${def.obs.label(r)}`, color: def.obs.color(r) })),
      ...session.habitat.map((r, i) => ({ id: r.id, lat: r.lat, lng: r.lng, label: `H${i + 1} ${def.habitat.label(r)}`, color: def.habitat.color(r), dashed: true })),
    ]);
    if (drawerOpen) renderDrawer();
  }

  // ─── Records ────────────────────────────────────────────────────────────
  const kindDef = kind => (kind === 'obs' ? def.obs : def.habitat);
  const surveyPoint = () => (session.meta.surveyLat !== '' && Number.isFinite(+session.meta.surveyLat) && session.meta.surveyLat != null
    ? { lat: +session.meta.surveyLat, lng: +session.meta.surveyLng } : null);

  function find(id) {
    for (const kind of ['obs', 'habitat']) {
      const index = session[kind].findIndex(r => r.id === id);
      if (index >= 0) return { kind, index, rec: session[kind][index] };
    }
    return null;
  }

  function photoApi(recordId, ids) {
    return {
      ids,
      async add(file) {
        const id = uid('p');
        // Copy into a plain Blob: iOS camera File handles can go stale after capture
        const blob = new Blob([await file.arrayBuffer()], { type: file.type || 'image/jpeg' });
        await store.putPhoto({ id, sessionId: session.id, recordId, name: file.name, type: blob.type, blob, time: localISO() });
        return id;
      },
      remove: id => store.deletePhoto(id),
      url: async id => { const p = await store.getPhoto(id); return p ? URL.createObjectURL(p.blob) : ''; },
    };
  }

  function recentSpecies() {
    const seen = new Set(), out = [];
    for (const r of [...session.obs].reverse()) {
      if (!r.speciesCode || seen.has(r.speciesCode) || r.speciesCode === 'UNKN') continue;
      seen.add(r.speciesCode);
      out.push(speciesList.find(s => s.code === r.speciesCode) ||
        { code: r.speciesCode, name: r.species, scientific: r.speciesSci, sara: r.speciesSara, srank: r.speciesSrank });
      if (out.length >= 6) break;
    }
    return out;
  }

  function finalise(kind, rec) {
    kindDef(kind).beforeSave?.(rec, { meta: session.meta, position: location.current() });
  }

  function addRecord(kind, at) {
    const kd = kindDef(kind);
    let loc;
    if (at) loc = { ...at, accuracy: null };
    else {
      const p = (def.tapToPlace && kind === 'obs' && surveyPoint()) || location.current();
      if (p) loc = { lat: p.lat, lng: p.lng, accuracy: p.accuracy ?? null };
      else { loc = { ...map.center(), accuracy: null }; toast('No GPS fix — using map centre. Adjust the location if needed.', 'error', 5000); }
    }
    const rec = newRecord(kd.fields);
    return openForm({
      title: kd.title, icon: kd.icon, fields: kd.fields, values: rec, location: loc,
      getPosition: () => location.current(), photos: photoApi(rec.id, []),
      speciesList, recentSpecies: kind === 'obs' ? recentSpecies() : [],
      onSave: async (vals, { location: l, photoIds }) => {
        const r = { ...vals, lat: l.lat, lng: l.lng, accuracy: l.accuracy ?? null, time: localISO(), photos: photoIds };
        finalise(kind, r);
        session[kind].push(r);
        await persist();
        const msg = kd.onSave?.(r);
        toast(msg || `${kd.title} saved (#${kind === 'habitat' ? 'H' : ''}${session[kind].length})`, msg ? 'error' : 'success', msg ? 5000 : 2000);
      },
    });
  }

  function editRecord(id) {
    const found = find(id);
    if (!found) return;
    const { kind, rec } = found;
    const kd = kindDef(kind);
    return openForm({
      title: `${kd.title} #${kind === 'habitat' ? 'H' : ''}${found.index + 1}`, icon: kd.icon, fields: kd.fields,
      values: rec, location: { lat: rec.lat, lng: rec.lng, accuracy: rec.accuracy },
      getPosition: () => location.current(), photos: photoApi(rec.id, [...(rec.photos || [])]),
      speciesList, recentSpecies: kind === 'obs' ? recentSpecies() : [],
      onSave: async (vals, { location: l, photoIds }) => {
        const current = find(id);
        if (!current) throw new Error('Record no longer exists');
        const r = { ...vals, lat: l.lat, lng: l.lng, accuracy: l.accuracy ?? null, photos: photoIds, updated: localISO() };
        finalise(kind, r);
        session[kind][current.index] = r;
        await persist();
        toast('Changes saved', 'success', 1500);
      },
      onDelete: () => deleteRecord(id),
    });
  }

  async function deleteRecord(id) {
    const found = find(id);
    if (!found) return;
    session[found.kind].splice(found.index, 1);
    await persist();
    undoToast('Record deleted.', async () => {
      session[found.kind].splice(Math.min(found.index, session[found.kind].length), 0, found.rec);
      await persist();
    }, () => (found.rec.photos || []).forEach(pid => store.deletePhoto(pid).catch(() => {})));
  }

  // ─── Metadata ───────────────────────────────────────────────────────────
  function editMeta() {
    return openForm({
      title: 'Survey details', icon: '📋', fields: def.meta, values: session.meta,
      getPosition: () => location.current(), enforceRequired: false,
      onSave: async vals => {
        session.meta = vals;
        rememberDefaults(vals);
        timer?.reset();
        // BBS: range/bearing depend on the survey point — refresh them
        session.obs.forEach(r => finalise('obs', r));
        await persist();
        const missing = missingFields(def.meta, vals);
        if (missing.length) toast(`Still needed before submitting: ${missing.join(', ')}`, 'info', 4000);
      },
    });
  }

  // ─── Drawer (record list) ───────────────────────────────────────────────
  function toggleDrawer(force) {
    drawerOpen = force ?? !drawerOpen;
    drawer.hidden = !drawerOpen;
    if (drawerOpen) renderDrawer();
  }

  function renderDrawer() {
    const item = (kind, r, i) => {
      const kd = kindDef(kind);
      const n = r.photos?.length || 0;
      return h('div', { class: 'fx-item' },
        h('button', { class: 'fx-item-main', onclick: () => editRecord(r.id) },
          h('span', { class: 'fx-dot', style: `background:${kd.color(r)}` }),
          h('span', { class: 'fx-item-text' },
            h('b', {}, `${kind === 'habitat' ? 'H' : ''}${i + 1}. ${kd.label(r)}`),
            h('small', {}, [kd.summary?.(r), (r.time || '').slice(11, 16), n ? `📷${n}` : ''].filter(Boolean).join(' · ')))),
        h('button', { class: 'fx-btn fx-small', title: 'Show on map', onclick: () => { toggleDrawer(false); map.focus(r.id); } }, '⌖'));
    };
    const section = (kind, label) => session[kind].length
      ? [h('h3', {}, `${label} (${session[kind].length})`), ...session[kind].map((r, i) => item(kind, r, i))] : [];
    drawer.replaceChildren(
      h('div', { class: 'fx-drawer-head' },
        h('b', {}, 'Records'),
        h('span', { class: 'fx-spacer' }),
        h('button', { class: 'fx-btn fx-small', onclick: () => showExportDialog(def, session) }, '⬇ Export'),
        h('button', { class: 'fx-btn fx-small', onclick: () => toggleDrawer(false) }, '✕')),
      ...section('obs', def.obs.title + 's'),
      ...section('habitat', 'Habitat / features'),
      recordCount(session) ? '' : h('p', { class: 'fx-muted' }, `No records yet. Tap ${def.obs.icon} to add one${def.tapToPlace ? ', or tap the map where the bird is' : ''}.`));
  }

  // ─── Submit / exit ──────────────────────────────────────────────────────
  async function submit() {
    const missing = missingFields(def.meta, session.meta);
    if (missing.length) {
      const c = await choose({ title: 'Missing survey details', icon: '📋', message: missing.join(', '),
        choices: [{ label: 'Fill in now', value: 'fix', kind: 'primary' }, { label: 'Submit anyway', value: 'go' }] });
      if (c === 'fix') return editMeta();
      if (c !== 'go') return;
    }
    if (!recordCount(session) &&
        !await confirmDialog('No records', 'Submit this survey with no observations (a nil result)?', 'Submit', 'primary')) return;
    timer?.stop();
    if (session.submittedAt) session.resubmittedAt = localISO(); else session.submittedAt = localISO();
    session.status = 'submitted';
    await persist();
    await showExportDialog(def, session, { title: 'Survey submitted', icon: '✅' });
    close();
  }

  async function exit() {
    if (closed) return;
    if (isBlank(def, session)) {
      await store.deleteSession(session.id).catch(() => {});
    } else {
      await persist();
      if (session.status === 'draft') toast('Saved to drafts', 'success', 2000);
    }
    close();
  }

  function close() {
    if (closed) return;
    closed = true;
    timer?.stop();
    unsub();
    location.stop();
    map.destroy();
    screen.remove();
    onExit?.();
  }

  function help() {
    choose({ title: `${def.name} — help`, icon: '?', message: def.help +
      '<h3>Saving</h3><p>Everything saves automatically as you go. ← returns home and keeps the survey in Drafts. ✅ submits it and offers the data package and PDF report.</p>',
      choices: [{ label: 'Close', value: null }] });
  }

  // ─── Point-count timer (BBS) ────────────────────────────────────────────
  function createTimer() {
    const full = () => (+session.meta.surveyLength || 10) * 60000;
    let remaining = full(), endAt = null, iv = null;
    const display = h('span', { class: 'fx-timer-display' });
    const startBtn = h('button', { class: 'fx-btn fx-primary fx-small', onclick: () => (iv ? pause() : start()) }, '▶');
    const paint = () => {
      const s = Math.max(0, Math.ceil(remaining / 1000));
      display.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      startBtn.textContent = iv ? '❚❚' : '▶';
    };
    function start() {
      if (remaining === full()) {             // fresh count: stamp start time
        session.meta.startTime = nowHM();
        session.meta.endTime = '';
        persist();
      }
      endAt = Date.now() + remaining;           // wall-clock based: survives screen sleep
      iv = setInterval(tick, 250);
      paint();
    }
    function tick() {
      remaining = endAt - Date.now();
      if (remaining <= 0) {
        stop();
        remaining = 0;
        session.meta.endTime = nowHM();
        persist();
        navigator.vibrate?.([300, 150, 300]);
        toast('Point count complete', 'success', 5000);
      }
      paint();
    }
    function pause() { remaining = endAt - Date.now(); stop(); paint(); }
    function stop() { clearInterval(iv); iv = null; }
    function reset() { if (!iv) { remaining = full(); paint(); } }
    paint();
    const el = h('div', { class: 'fx-timer' }, '⏱', display, startBtn,
      h('button', { class: 'fx-btn fx-small', title: 'Reset', onclick: () => { stop(); remaining = full(); paint(); } }, '↺'));
    return { el, stop, reset };
  }

  return { exit, close };
}
