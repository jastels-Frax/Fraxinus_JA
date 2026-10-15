// js/ui/form.js — One form renderer for metadata, observations and habitat records.
// Used for both entry and editing, so every field is editable after capture.

import { h, openModal, toast } from './dom.js';
import { optionList, isVisible, fieldKeys, nowHM } from '../core/fields.js';
import { missingFields } from '../core/session.js';

const OTHER = '__other__';
const RARITY_COLOUR = { rare: '#e05252', infrequent: '#E69138' };

/**
 * openForm({
 *   title, icon, fields, values,
 *   location?:   { lat, lng, accuracy }   → shows an editable location block
 *   getPosition?: () => pos | null         → "Use GPS" buttons
 *   photos?:     { ids, add(file)→id, remove(id), url(id)→objectURL }
 *   speciesList?, recentSpecies?,
 *   enforceRequired?: true (records) | false (metadata: warn only)
 *   onSave(values, { location, photoIds }), onDelete?()
 * }) → Promise<'saved' | 'deleted' | null>
 */
export function openForm(opts) {
  const { fields, getPosition } = opts;
  const v = structuredClone(opts.values || {});
  const loc = opts.location ? { ...opts.location } : null;
  const photoIds = [...(opts.photos?.ids || [])];
  const added = [], removed = [];
  const wraps = new Map();

  return new Promise(resolve => {
    const m = openModal({ onCancel: () => cancel(), wide: true });
    const body = h('div', { class: 'fx-form-body' });
    m.el.append(
      h('div', { class: 'fx-form-head' }, h('h2', {}, `${opts.icon ? opts.icon + ' ' : ''}${opts.title}`)),
      body);

    const refresh = () => {
      for (const f of fields) {
        const w = wraps.get(f);
        if (!w) continue;
        w.el.hidden = !isVisible(f, v);
        if (typeof f.options === 'function') {
          const sig = JSON.stringify(optionList(f, v));
          if (sig !== w.sig) { w.sig = sig; w.el.replaceChildren(...fieldInner(f)); }
        }
      }
    };
    const changed = () => refresh();

    function fieldInner(f) {
      return [h('label', { class: 'fx-label' }, f.label, f.required ? h('span', { class: 'fx-req' }, ' *') : ''),
              control(f, v, changed, opts)];
    }

    for (const f of fields) {
      if (f.hidden) continue;
      const el = h('div', { class: 'fx-field', 'data-key': f.key }, ...fieldInner(f));
      wraps.set(f, { el, sig: typeof f.options === 'function' ? JSON.stringify(optionList(f, v)) : '' });
      body.append(el);
    }
    if (loc) body.append(locationBlock(loc, getPosition));
    if (opts.photos) body.append(photoBlock(opts.photos, photoIds, added, removed));
    refresh();

    const finish = result => { m.close(); resolve(result); };
    async function cancel() {
      for (const id of added) await opts.photos.remove(id).catch(() => {});
      finish(null);
    }
    async function save() {
      for (const f of fields) {               // drop values of fields that are no longer shown
        if (!f.hidden && !isVisible(f, v)) fieldKeys(f).forEach(k => delete v[k]);
      }
      const missing = missingFields(fields, v);
      body.querySelectorAll('.fx-missing').forEach(e => e.classList.remove('fx-missing'));
      if (missing.length && opts.enforceRequired !== false) {
        for (const f of fields) {
          if (missing.includes(f.label)) wraps.get(f)?.el.classList.add('fx-missing');
        }
        body.querySelector('.fx-missing')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        toast(`Required: ${missing.join(', ')}`, 'error');
        return;
      }
      if (loc && !(Number.isFinite(loc.lat) && Number.isFinite(loc.lng))) {
        toast('Location required — tap “Use GPS” or enter coordinates.', 'error');
        return;
      }
      saveBtn.disabled = true;
      try {
        await opts.onSave(v, { location: loc, photoIds });
        for (const id of removed) await opts.photos.remove(id).catch(() => {});
        finish('saved');
      } catch (err) {
        console.error(err);
        toast(`Could not save: ${err.message || err}`, 'error', 6000);
        saveBtn.disabled = false;
      }
    }

    const saveBtn = h('button', { class: 'fx-btn fx-primary', onclick: save }, 'Save');
    m.el.append(h('div', { class: 'fx-form-foot' },
      opts.onDelete ? h('button', { class: 'fx-btn fx-danger', onclick: async () => {
        for (const id of added) await opts.photos.remove(id).catch(() => {});   // unsaved additions
        await opts.onDelete();
        finish('deleted');
      } }, 'Delete') : '',
      h('span', { class: 'fx-spacer' }),
      h('button', { class: 'fx-btn', onclick: cancel }, 'Cancel'),
      saveBtn));
  });
}

// ─── Controls ─────────────────────────────────────────────────────────────
function control(f, v, changed, opts) {
  const set = val => { v[f.key] = val; changed(); };
  switch (f.type) {
    case 'textarea':
      return h('textarea', { rows: 3, placeholder: f.placeholder || '', value: v[f.key] ?? '',
        oninput: e => set(e.target.value) });
    case 'number':
      return h('input', { type: 'number', inputmode: 'decimal', step: f.step ?? 'any', min: f.min, max: f.max,
        placeholder: f.placeholder || '', value: v[f.key] ?? '',
        oninput: e => set(e.target.value === '' ? '' : +e.target.value) });
    case 'time': {
      const inp = h('input', { type: 'time', value: v[f.key] ?? '', oninput: e => set(e.target.value) });
      return h('div', { class: 'fx-row' }, inp,
        h('button', { type: 'button', class: 'fx-btn fx-small', onclick: () => { inp.value = nowHM(); set(inp.value); } }, 'Now'));
    }
    case 'date': case 'text':
      return h('input', { type: f.type, placeholder: f.placeholder || '', value: v[f.key] ?? '',
        autocomplete: 'off', oninput: e => set(e.target.value) });
    case 'select': return selectControl(f, v, set);
    case 'radio':  return radioControl(f, v, set);
    case 'checks': return checksControl(f, v, set);
    case 'counter': return counterControl(f, v, set);
    case 'species': return speciesControl(f, v, changed, opts);
    case 'point':  return pointControl(f, v, changed, opts.getPosition);
    default: return h('div', {}, `Unknown field type ${f.type}`);
  }
}

function selectControl(f, v, set) {
  const opts = optionList(f, v);
  const cur = v[f.key] ?? '';
  const known = opts.some(o => o.value === cur);
  const sel = h('select', {}, h('option', { value: '' }, '— Select —'),
    opts.map(o => h('option', { value: o.value }, o.label)));
  if (cur && !known && !f.other) sel.append(h('option', { value: cur }, cur));   // keep legacy values visible
  if (f.other) sel.append(h('option', { value: OTHER }, 'Other…'));
  const other = h('input', { type: 'text', placeholder: 'Specify…', value: cur && !known ? cur : '',
    oninput: () => set(other.value.trim()) });
  sel.value = cur && !known && f.other ? OTHER : cur;
  other.hidden = sel.value !== OTHER;
  sel.addEventListener('change', () => {
    other.hidden = sel.value !== OTHER;
    if (sel.value === OTHER) { other.focus(); set(other.value.trim()); } else set(sel.value);
  });
  return h('div', { class: 'fx-col' }, sel, other);
}

function radioControl(f, v, set) {
  const wrap = h('div', { class: 'fx-seg', role: 'radiogroup' });
  const opts = optionList(f, v);
  if (v[f.key] && !opts.some(o => o.value === v[f.key])) opts.push({ value: v[f.key], label: v[f.key] });
  const paint = () => wrap.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.value === v[f.key])));
  opts.forEach(o => wrap.append(h('button', { type: 'button', value: o.value,
    onclick: () => { set(v[f.key] === o.value && !f.required ? '' : o.value); paint(); } }, o.label)));
  paint();
  return wrap;
}

function checksControl(f, v, set) {
  const wrap = h('div', { class: 'fx-chips' });
  const opts = optionList(f, v);
  const cur = Array.isArray(v[f.key]) ? v[f.key] : (v[f.key] ? [v[f.key]] : []);
  cur.filter(c => !opts.some(o => o.value === c)).forEach(c => opts.push({ value: c, label: c }));
  const selected = new Set(cur);
  opts.forEach(o => {
    const b = h('button', { type: 'button', class: 'fx-chip', 'aria-pressed': String(selected.has(o.value)),
      onclick: () => {
        selected.has(o.value) ? selected.delete(o.value) : selected.add(o.value);
        b.setAttribute('aria-pressed', String(selected.has(o.value)));
        set(opts.map(x => x.value).filter(x => selected.has(x)));
      } }, o.label);
    wrap.append(b);
  });
  return wrap;
}

function counterControl(f, v, set) {
  const min = f.min ?? 0;
  const inp = h('input', { type: 'number', inputmode: 'numeric', min, value: v[f.key] ?? min,
    oninput: () => set(inp.value === '' ? '' : Math.max(min, parseInt(inp.value, 10) || min)) });
  if (v[f.key] == null) v[f.key] = min;
  const step = d => { inp.value = Math.max(min, (parseInt(inp.value, 10) || 0) + d); set(+inp.value); };
  return h('div', { class: 'fx-counter' },
    h('button', { type: 'button', onclick: () => step(-1), 'aria-label': 'decrease' }, '−'),
    inp,
    h('button', { type: 'button', onclick: () => step(1), 'aria-label': 'increase' }, '+'));
}

function speciesControl(f, v, changed, opts) {
  const list = opts.speciesList || [];
  const wrap = h('div', { class: 'fx-species' });
  const unknown = { code: 'UNKN', name: 'Unknown', scientific: '', sara: '', srank: '' };

  const choose = sp => {
    v[f.key] = sp.name; v[f.key + 'Code'] = sp.code; v[f.key + 'Sci'] = sp.scientific || '';
    v[f.key + 'Sara'] = sp.sara || ''; v[f.key + 'Srank'] = sp.srank || '';
    render(); changed();
  };
  const badges = sp => [
    sp.sara ? h('span', { class: 'fx-badge fx-sar' }, `SAR-${sp.sara}`) : '',
    sp.soci ? h('span', { class: 'fx-badge fx-soci' }, 'SOCI') : '',
    sp.srank ? h('span', { class: 'fx-srank' }, sp.srank) : '',
  ];
  const item = sp => h('button', { type: 'button', class: 'fx-sp-item', onclick: () => choose(sp) },
    h('span', { class: 'fx-dot', style: `background:${RARITY_COLOUR[sp.rarity] || '#666'}` }),
    h('b', {}, sp.code), ' ', sp.name, ...badges(sp));

  function results(q) {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const code = list.filter(sp => sp.code.toLowerCase().startsWith(s));
    const name = list.filter(sp => !code.includes(sp) && sp.name.toLowerCase().includes(s));
    return [...code, ...name].slice(0, 30);
  }

  function render() {
    wrap.replaceChildren();
    if (v[f.key]) {
      const sp = list.find(x => x.code === v[f.key + 'Code']) || { name: v[f.key], code: v[f.key + 'Code'] || '', sara: v[f.key + 'Sara'] };
      wrap.append(h('button', { type: 'button', class: 'fx-sp-selected', onclick: () => { delete v[f.key]; render(); wrap.querySelector('input')?.focus(); } },
        h('span', {}, h('b', {}, sp.name), sp.code ? ` (${sp.code})` : '', ...badges(sp)), h('span', { class: 'fx-muted' }, 'change')));
      return;
    }
    const out = h('div', { class: 'fx-sp-results' });
    const search = h('input', { type: 'search', placeholder: 'Type code or name…', autocomplete: 'off',
      oninput: () => out.replaceChildren(...results(search.value).map(item)) });
    const quick = [...(opts.recentSpecies || []), ...(f.allowUnknown ? [unknown] : [])];
    wrap.append(
      quick.length ? h('div', { class: 'fx-chips fx-recent' }, quick.map(sp =>
        h('button', { type: 'button', class: 'fx-chip', onclick: () => choose(sp) }, sp.code === 'UNKN' ? 'Unknown' : sp.code))) : '',
      search, out);
  }
  if (!v[f.key] && f.allowUnknown) choose(unknown);
  render();
  return wrap;
}

function pointControl(f, v, changed, getPosition) {
  const lat = h('input', { type: 'number', step: 'any', inputmode: 'decimal', placeholder: 'Latitude', value: v[f.key + 'Lat'] ?? '' });
  const lng = h('input', { type: 'number', step: 'any', inputmode: 'decimal', placeholder: 'Longitude', value: v[f.key + 'Lng'] ?? '' });
  const sync = () => {
    v[f.key + 'Lat'] = lat.value === '' ? '' : +lat.value;
    v[f.key + 'Lng'] = lng.value === '' ? '' : +lng.value;
    changed();
  };
  lat.oninput = lng.oninput = sync;
  return h('div', { class: 'fx-row' }, lat, lng, getPosition ? h('button', { type: 'button', class: 'fx-btn fx-small', onclick: () => {
    const p = getPosition();
    if (!p) return toast('No GPS fix yet — move to open sky and try again.', 'error');
    lat.value = p.lat.toFixed(6); lng.value = p.lng.toFixed(6); sync();
    toast(`Point set (±${Math.round(p.accuracy)} m)`, 'success', 2000);
  } }, '📍 GPS') : '');
}

function locationBlock(loc, getPosition) {
  const lat = h('input', { type: 'number', step: 'any', inputmode: 'decimal', value: Number.isFinite(loc.lat) ? loc.lat.toFixed(6) : '' });
  const lng = h('input', { type: 'number', step: 'any', inputmode: 'decimal', value: Number.isFinite(loc.lng) ? loc.lng.toFixed(6) : '' });
  const acc = h('span', { class: 'fx-muted' });
  const paint = () => { acc.textContent = Number.isFinite(loc.accuracy) ? `±${Math.round(loc.accuracy)} m` : 'manual'; };
  lat.oninput = lng.oninput = () => {
    loc.lat = lat.value === '' ? NaN : +lat.value;
    loc.lng = lng.value === '' ? NaN : +lng.value;
    loc.accuracy = null; paint();
  };
  paint();
  return h('div', { class: 'fx-field' },
    h('label', { class: 'fx-label' }, 'Location ', acc),
    h('div', { class: 'fx-row' }, lat, lng,
      getPosition ? h('button', { type: 'button', class: 'fx-btn fx-small', onclick: () => {
        const p = getPosition();
        if (!p) return toast('No GPS fix yet.', 'error');
        Object.assign(loc, { lat: p.lat, lng: p.lng, accuracy: p.accuracy });
        lat.value = p.lat.toFixed(6); lng.value = p.lng.toFixed(6); paint();
      } }, '📍 GPS') : ''));
}

function photoBlock(api, ids, added, removed) {
  const grid = h('div', { class: 'fx-photos' });
  const thumb = id => {
    const img = h('img', { alt: '' });
    api.url(id).then(u => { if (u) img.src = u; });
    return h('div', { class: 'fx-thumb' }, img,
      h('button', { type: 'button', 'aria-label': 'Remove photo', onclick: () => {
        ids.splice(ids.indexOf(id), 1);
        if (added.includes(id)) { added.splice(added.indexOf(id), 1); api.remove(id); } else removed.push(id);
        paint();
      } }, '✕'));
  };
  const paint = () => grid.replaceChildren(...ids.map(thumb));
  const picker = capture => {
    const input = h('input', { type: 'file', accept: 'image/*', multiple: !capture, style: 'display:none' });
    if (capture) input.setAttribute('capture', 'environment');
    input.onchange = async () => {
      for (const file of input.files) {
        try {
          const id = await api.add(file);
          ids.push(id); added.push(id);
        } catch (err) { toast(`Photo not saved: ${err.message}`, 'error'); }
      }
      paint();
      input.remove();
    };
    document.body.append(input);
    input.click();
  };
  paint();
  return h('div', { class: 'fx-field' }, h('label', { class: 'fx-label' }, 'Photos'), grid,
    h('div', { class: 'fx-row' },
      h('button', { type: 'button', class: 'fx-btn', onclick: () => picker(true) }, '📷 Camera'),
      h('button', { type: 'button', class: 'fx-btn', onclick: () => picker(false) }, '🖼 Gallery')));
}
