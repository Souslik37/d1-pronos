/**
 * D1 Pronos — Génération d'identifiants
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.utils = window.D1P.utils || {};

  function uid(prefix) {
    const rand = Math.random().toString(36).slice(2, 9);
    const time = Date.now().toString(36);
    return (prefix ? prefix + '-' : '') + time + rand;
  }

  /** Pour les colonnes Postgres de type `uuid` — uid() ne convient pas, son format n'est pas un UUID valide. */
  function uuid() {
    return crypto.randomUUID();
  }

  window.D1P.utils.id = { uid, uuid };
})();
