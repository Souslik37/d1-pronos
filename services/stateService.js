/**
 * D1 Pronos — État central de l'application
 *
 * Au démarrage (après connexion), tout ce qu'il faut est chargé UNE fois
 * depuis Supabase dans un objet `state` en mémoire. Le reste de l'app lit
 * cet objet de façon synchrone ; chaque service qui écrit met à jour l'état
 * local IMMÉDIATEMENT (l'UI n'attend jamais le réseau) puis envoie le
 * changement à Supabase en tâche de fond via storageService, et appelle
 * notify() pour re-déclencher le rendu.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.services = window.D1P.services || {};

  let state = null;
  const listeners = [];

  async function init(activeManagerId) {
    state = await window.D1P.services.storageService.loadInitialState(activeManagerId);
    return state;
  }

  function getState() {
    return state;
  }

  function subscribe(fn) {
    listeners.push(fn);
    return () => {
      const idx = listeners.indexOf(fn);
      if (idx > -1) listeners.splice(idx, 1);
    };
  }

  function notify() {
    listeners.forEach((fn) => {
      try { fn(state); } catch (e) { console.error('[stateService] listener error', e); }
    });
  }

  window.D1P.services.stateService = { init, getState, subscribe, notify };
})();
