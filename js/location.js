// js/location.js — Browser GPS provider. A host app can pass its own object with
// the same shape ({ start, stop, current, subscribe }) to share its GPS stream.

export function createBrowserLocation() {
  let watchId = null, pos = null;
  const subs = new Set();
  const emit = () => subs.forEach(fn => fn(pos));

  return {
    start() {
      if (watchId != null || !navigator.geolocation) return;
      watchId = navigator.geolocation.watchPosition(
        p => {
          pos = { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, time: p.timestamp };
          emit();
        },
        err => { pos = pos && { ...pos, stale: true }; subs.forEach(fn => fn(pos, err)); },
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    },
    stop() {
      if (watchId != null) navigator.geolocation.clearWatch(watchId);
      watchId = null;
    },
    // Latest fix, or null if none / older than 2 minutes
    current() {
      return pos && !pos.stale && Date.now() - pos.time < 120000 ? pos : null;
    },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
  };
}
