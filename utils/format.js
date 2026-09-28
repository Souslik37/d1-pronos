/**
 * D1 Pronos — Formatage (dates, nombres)
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.utils = window.D1P.utils || {};

  const DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
  const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

  function parseIsoDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDateFr(iso, opts) {
    opts = opts || {};
    if (!iso) return '';
    const d = parseIsoDate(iso);
    const day = DAYS[d.getDay()];
    const month = MONTHS[d.getMonth()];
    if (opts.short) return `${d.getDate()} ${month.slice(0, 3)}`;
    return `${opts.capitalize === false ? day : day[0].toUpperCase() + day.slice(1)} ${d.getDate()} ${month} ${d.getFullYear()}`;
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function formatSigned(n) {
    return (n > 0 ? '+' : '') + n;
  }

  window.D1P.utils.format = { parseIsoDate, formatDateFr, clamp, formatSigned };
})();
