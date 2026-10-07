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
    const dayLabel = opts.capitalize === false ? day : day[0].toUpperCase() + day.slice(1);
    return opts.noYear ? `${dayLabel} ${d.getDate()} ${month}` : `${dayLabel} ${d.getDate()} ${month} ${d.getFullYear()}`;
  }

  /**
   * "12/09/2026" et "14:32" pour un horodatage complet (ex: l'inscription).
   * Toujours à l'heure de Bruxelles, pas celle de l'appareil : c'est un moment
   * précis, pas une date de calendrier comme formatDateFr.
   */
  function formatTimestampDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Brussels' });
  }

  function formatTimestampTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function formatSigned(n) {
    return (n > 0 ? '+' : '') + n;
  }

  window.D1P.utils.format = { parseIsoDate, formatDateFr, formatTimestampDate, formatTimestampTime, clamp, formatSigned };
})();
