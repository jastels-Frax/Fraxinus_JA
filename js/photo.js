// js/photo.js — Camera capture: saves photo to device with GPS-encoded filename
//   Filename format: OBS_<lat>_<lng>_<YYYYMMDD_HHMMSS>.<ext>
//   The filename is written into the observation form's photo reference field.

export function capturePhoto(latlng, inputId) {
  const input    = document.createElement('input');
  input.type     = 'file';
  input.accept   = 'image/*';
  input.capture  = 'environment';   // opens rear camera on mobile

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;

    // Build GPS-encoded filename
    const now = new Date();
    const ts  = String(now.getFullYear()) +
                String(now.getMonth() + 1).padStart(2, '0') +
                String(now.getDate()).padStart(2, '0') + '_' +
                String(now.getHours()).padStart(2, '0') +
                String(now.getMinutes()).padStart(2, '0') +
                String(now.getSeconds()).padStart(2, '0');
    const lat  = latlng ? latlng.lat.toFixed(6) : 'NOLAT';
    const lng  = latlng ? latlng.lng.toFixed(6) : 'NOLNG';
    const ext  = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : 'jpg';
    const filename = `OBS_${lat}_${lng}_${ts}.${ext}`;

    // Save to device
    const url = URL.createObjectURL(file);
    const a   = document.createElement('a');
    a.href          = url;
    a.download      = filename;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Auto-fill photo reference field
    const el = document.getElementById(inputId);
    if (el) el.value = filename;
  });

  input.click();
}

// Window-exposed helper for popup edit buttons where latlng comes from stored obs
window.capturePopupPhoto = function(lat, lng, inputId) {
  const latlng = (lat != null && lng != null) ? { lat, lng } : null;
  capturePhoto(latlng, inputId);
};

// Show/hide the companion "other" row/input based on the current select value.
// otherId can be the text input itself or a wrapper row element.
// Called via onchange="handleOtherSelect(this, 'someId')" in HTML.
window.handleOtherSelect = function(sel, otherId) {
  const el = document.getElementById(otherId);
  if (el) el.style.display = sel.value === 'Other' ? '' : 'none';
};
