// js/ui/dom.js — Tiny DOM helpers: element builder, toasts, modal stack, dialogs.

export const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// h('button', { class: 'x', onclick: fn, title: 't' }, 'Label', childEl)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// ─── Toasts ───────────────────────────────────────────────────────────────
let _toastHost = null;
export function setToastHost(parent) {
  _toastHost = h('div', { class: 'fx-toasts', 'aria-live': 'polite' });
  parent.append(_toastHost);
}

function toastEl(type) {
  if (!_toastHost) setToastHost(document.body);
  const el = h('div', { class: `fx-toast fx-toast-${type}`, role: 'status' });
  _toastHost.append(el);
  requestAnimationFrame(() => el.classList.add('fx-show'));
  return el;
}
function removeToast(el) {
  el.classList.remove('fx-show');
  setTimeout(() => el.remove(), 300);
}

export function toast(message, type = 'info', ms = 3500) {
  const el = toastEl(type);
  el.textContent = message;
  setTimeout(() => removeToast(el), ms);
}

// Toast with an Undo button; onExpire runs if Undo isn't pressed in time.
export function undoToast(message, onUndo, onExpire, ms = 6000) {
  const el = toastEl('info');
  let done = false;
  const finish = undo => {
    if (done) return;
    done = true;
    removeToast(el);
    (undo ? onUndo : onExpire)?.();
  };
  el.append(message + ' ', h('button', { class: 'fx-toast-btn', onclick: () => finish(true) }, 'Undo'));
  setTimeout(() => finish(false), ms);
}

// ─── Modal stack (Escape / Android back close the top one) ────────────────
const _stack = [];
let _modalHost = null;
export function setModalHost(el) { _modalHost = el; }

// Returns { el (the sheet), close() }. onCancel runs on Escape / back / backdrop (if dismissible).
export function openModal({ className = '', onCancel, dismissible = false, wide = false } = {}) {
  const sheet = h('div', { class: `fx-sheet ${wide ? 'fx-wide' : ''} ${className}`, role: 'dialog', 'aria-modal': 'true' });
  const overlay = h('div', { class: 'fx-modal' }, sheet);
  const entry = { overlay, cancel: () => (onCancel ? onCancel() : close()) };
  function close() {
    const i = _stack.indexOf(entry);
    if (i >= 0) _stack.splice(i, 1);
    overlay.remove();
  }
  if (dismissible) overlay.addEventListener('click', e => { if (e.target === overlay) entry.cancel(); });
  _stack.push(entry);
  (_modalHost || document.body).append(overlay);
  return { el: sheet, close };
}

export function cancelTopModal() {
  const top = _stack[_stack.length - 1];
  if (!top) return false;
  top.cancel();
  return true;
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') cancelTopModal(); });

// choose({ title, message, choices: [{ label, value, kind }] }) → Promise<value | null>
export function choose({ title, message = '', icon = '', choices }) {
  return new Promise(resolve => {
    let m;
    const pick = v => { m.close(); resolve(v); };
    m = openModal({ dismissible: true, onCancel: () => pick(null), className: 'fx-dialog' });
    m.el.append(
      icon ? h('div', { class: 'fx-dialog-icon' }, icon) : '',
      h('h2', {}, title),
      message ? h('p', { class: 'fx-muted', html: message }) : '',
      h('div', { class: 'fx-dialog-btns' },
        choices.map(c => h('button', { class: `fx-btn ${c.kind ? 'fx-' + c.kind : ''}`, onclick: () => pick(c.value) }, c.label))));
  });
}

export const confirmDialog = (title, message, okLabel = 'OK', kind = 'danger') =>
  choose({ title, message, choices: [{ label: okLabel, value: true, kind }, { label: 'Cancel', value: false }] })
    .then(Boolean);

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: 'display:none' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
