/**
 * D1 Pronos — Roster de secours des 10 équipes de D1
 *
 * Comme data/matches.js dans La Hulpe 3 : sert de seed initial pour
 * supabase/schema.sql. Les VRAIES équipes vivent dans Supabase une fois en
 * ligne (gérées depuis Administration) — ce fichier n'est qu'une référence.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.data = window.D1P.data || {};

  window.D1P.data.TEAMS = [
    { id: 'dendermonde', name: 'Dendermonde' },
    { id: 'soignies', name: 'Soignies' },
    { id: 'asub', name: 'ASUB' },
    { id: 'kituro', name: 'Kituro' },
    { id: 'boitsfort', name: 'Boitsfort' },
    { id: 'roc', name: 'R.O.C.' },
    { id: 'frameries', name: 'Frameries' },
    { id: 'liege', name: 'Liège' },
    { id: 'buc', name: 'BUC' },
    { id: 'lahulpe', name: 'La Hulpe' },
  ];
})();
