// js/app.js — Module entry point.
//
//   import { mount } from './js/app.js';
//   mount(document.getElementById('app'), {
//     createMap,   // optional: (container, { onSelect, onTap }) → map adapter (see js/map/leaflet.js)
//     location,    // optional: { start, stop, current, subscribe } GPS provider (see js/location.js)
//     logoSrc,     // optional: home-screen logo
//   });
//
// Everything renders inside `container`; no globals are created.

import { setToastHost, setModalHost, cancelTopModal, toast } from './ui/dom.js';
import { renderHome, sessionDefaults, getProvince } from './ui/home.js';
import { openSurvey } from './ui/survey.js';
import { createSession } from './core/session.js';
import * as store from './core/store.js';
import { createLeafletMap } from './map/leaflet.js';
import { createBrowserLocation } from './location.js';
import SPECIES_BY_PROVINCE from '../data/species_list.js';

export async function mount(container, options = {}) {
  const createMap = options.createMap || createLeafletMap;
  const location = options.location || createBrowserLocation();
  const logoSrc = options.logoSrc ?? new URL('../img/LOGO w TEXT black bg.jpg', import.meta.url).href;

  container.classList.add('fx-app');
  const view = document.createElement('div');
  const overlays = document.createElement('div');
  overlays.className = 'fx-overlays';
  container.replaceChildren(view, overlays);
  setModalHost(overlays);
  setToastHost(overlays);

  let survey = null;

  // Android/browser back: close the top dialog, otherwise leave the survey
  const onPop = () => {
    if (!survey) return;
    history.pushState({ fx: true }, '');
    if (!cancelTopModal()) survey.exit();
  };
  window.addEventListener('popstate', onPop);

  const showHome = () => renderHome(view, { logoSrc, onStart: start });

  async function start(def, existing) {
    const session = existing || createSession(def, sessionDefaults());
    if (!existing) await store.putSession(session);
    history.pushState({ fx: true }, '');
    view.replaceChildren();
    survey = openSurvey(view, {
      def, session, createMap, location,
      speciesList: SPECIES_BY_PROVINCE[getProvince()] || SPECIES_BY_PROVINCE.NS,
      onExit: () => { survey = null; showHome(); },
    });
  }

  store.requestPersistence();
  try {
    const n = await store.migrateFromV1();
    if (n) toast(`Imported ${n} survey${n !== 1 ? 's' : ''} from the previous app version`, 'success', 6000);
  } catch (err) {
    console.error('Migration failed', err);
    toast('Could not import surveys from the previous version — they remain on this device untouched.', 'error', 8000);
  }
  await showHome();

  return {
    destroy() {
      window.removeEventListener('popstate', onPop);
      survey?.close();
      container.replaceChildren();
    },
  };
}
