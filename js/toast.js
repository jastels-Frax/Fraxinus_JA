// js/toast.js — Toast notification system
// Ported from GPS2026felt/src/ui/Toast.ts

export function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add('show'));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Shows a toast with an Undo button. Returns a dismiss callback the caller
// must invoke when the undo window closes (commit or timeout). The toast
// has no auto-dismiss timer — the caller owns the lifetime.
export function showUndoToast(message, onUndo) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast toast-info';

  const msgNode = document.createTextNode(message + '\u00a0 ');
  toast.appendChild(msgNode);

  const btn = document.createElement('button');
  btn.textContent = 'Undo';
  btn.style.cssText = 'padding:3px 12px; margin-left:6px; font-size:0.85rem; cursor:pointer;' +
    ' background:rgba(255,255,255,0.15); border:1px solid rgba(255,255,255,0.4);' +
    ' border-radius:4px; color:inherit; font-family:inherit; vertical-align:middle;';
  btn.onclick = () => { dismiss(); onUndo(); };
  toast.appendChild(btn);

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  const dismiss = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };
  return dismiss;
}
