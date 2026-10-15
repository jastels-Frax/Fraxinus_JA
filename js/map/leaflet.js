// js/map/leaflet.js — Standalone map adapter (Leaflet). The survey module talks to
// the map only through this interface, so a host mapping app can supply its own:
//
//   createMap(container, { onSelect(id), onTap({lat,lng}) }) → {
//     setFeatures([{ id, lat, lng, label, color, dashed }]),  // full redraw
//     setPosition({ lat, lng, accuracy } | null),               // user's GPS
//     focus(id), fitTo([{lat,lng}]), center() → {lat,lng},
//     toggleFollow?() → bool, toggleRings?(center) → bool,      // optional extras
//     destroy()
//   }

import { destination } from '../core/geo.js';

export function createLeafletMap(container, { onSelect, onTap } = {}) {
  const L = window.L;
  if (!L) throw new Error('Leaflet failed to load — check your connection and reload.');

  const map = L.map(container, { zoomControl: false, doubleClickZoom: false }).setView([44.65, -63.57], 8);
  const sat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 20, maxNativeZoom: 19, attribution: 'Esri' }).addTo(map);
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20, maxNativeZoom: 19, attribution: '© OSM' });
  L.control.layers({ Satellite: sat, Streets: osm }, null, { position: 'topright' }).addTo(map);
  L.control.zoom({ position: 'topright' }).addTo(map);
  requestAnimationFrame(() => map.invalidateSize());

  const features = L.layerGroup().addTo(map);
  const byId = new Map();
  let me = null, meAcc = null, follow = false, rings = null, centred = false;

  if (onTap) map.on('click', e => onTap({ lat: e.latlng.lat, lng: e.latlng.lng }));

  return {
    setFeatures(list) {
      features.clearLayers();
      byId.clear();
      for (const f of list) {
        if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) continue;
        const marker = L.circleMarker([f.lat, f.lng], {
          radius: 11, color: f.color, weight: 3, fillColor: '#fff', fillOpacity: 0.55,
          dashArray: f.dashed ? '5 4' : null,
        }).addTo(features);
        marker.bindTooltip(f.label, { permanent: true, direction: 'right', offset: [10, 0], className: 'fx-map-label' });
        marker.on('click', e => { L.DomEvent.stopPropagation(e); onSelect?.(f.id); });
        byId.set(f.id, marker);
      }
    },
    setPosition(p) {
      if (!p) return;
      const ll = [p.lat, p.lng];
      if (!me) {
        meAcc = L.circle(ll, { radius: p.accuracy, color: '#3a86ff', weight: 1, fillOpacity: 0.12, interactive: false }).addTo(map);
        me = L.circleMarker(ll, { radius: 7, color: '#fff', weight: 2, fillColor: '#3a86ff', fillOpacity: 1, interactive: false }).addTo(map);
      } else {
        me.setLatLng(ll);
        meAcc.setLatLng(ll).setRadius(p.accuracy);
      }
      if (!centred) { centred = true; map.setView(ll, Math.max(map.getZoom(), 17)); }
      else if (follow) map.panTo(ll);
    },
    focus(id) {
      const m = byId.get(id);
      if (m) map.setView(m.getLatLng(), Math.max(map.getZoom(), 18));
    },
    fitTo(points) {
      if (!points.length) return;
      centred = true;
      map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lng])).pad(0.3), { maxZoom: 18 });
    },
    center() { const c = map.getCenter(); return { lat: c.lat, lng: c.lng }; },
    toggleFollow() {
      follow = !follow;
      if (follow && me) map.panTo(me.getLatLng());
      return follow;
    },
    // 50–200 m distance rings with N/E/S/W spokes around a point (BBS point counts)
    toggleRings(center) {
      if (rings) { map.removeLayer(rings); rings = null; return false; }
      if (!center) return false;
      rings = L.layerGroup();
      for (const r of [50, 100, 150, 200]) {
        L.circle([center.lat, center.lng], { radius: r, color: '#ff5252', weight: 2, dashArray: '5', fill: false, interactive: false }).addTo(rings);
        const p = destination(center, 0, r);
        L.marker([p.lat, p.lng], { interactive: false, icon: L.divIcon({ className: 'fx-ring-label', html: `${r} m` }) }).addTo(rings);
      }
      for (const [txt, b] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]]) {
        const end = destination(center, b, 200), lbl = destination(center, b, 220);
        L.polyline([[center.lat, center.lng], [end.lat, end.lng]], { color: '#ffd54f', weight: 1, dashArray: '4', interactive: false }).addTo(rings);
        L.marker([lbl.lat, lbl.lng], { interactive: false, icon: L.divIcon({ className: 'fx-ring-label fx-ring-dir', html: txt }) }).addTo(rings);
      }
      rings.addTo(map);
      return true;
    },
    destroy() { map.remove(); },
  };
}
