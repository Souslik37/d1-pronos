/**
 * D1 Pronos — Avatars/badges "initiales + couleur"
 *
 * Sert à la fois pour les managers ET pour les équipes (badge coloré avec
 * les initiales du nom) — fournir `avatarUrl`/`logoUrl` bascule sur une
 * vraie image le jour où on veut ajouter les vrais logos des clubs.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.utils = window.D1P.utils || {};

  const PALETTE = [
    '#22c55e', '#16a34a', '#0ea5e9', '#6366f1', '#a855f7',
    '#ec4899', '#f59e0b', '#ef4444', '#14b8a6', '#84cc16',
  ];

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  function initials(name) {
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function colorFromString(str) {
    return PALETTE[hashString(str) % PALETTE.length];
  }

  /**
   * Renvoie un fragment HTML (chaîne) prêt à insérer. `opts.square` : à
   * utiliser pour des logos de club plutôt que des visages — les crests
   * réels ne sont pas tous carrés/ronds (wordmarks très larges, écussons...,
   * voir logos club/), donc pas de recadrage en cercle qui couperait le
   * contenu : coins arrondis + image entière visible (object-fit: contain,
   * voir styles.css `.team-logo`).
   */
  function renderAvatar(name, avatarUrl, size, opts) {
    size = size || 48;
    opts = opts || {};
    const esc = window.D1P.utils.dom.escapeHtml;
    const cls = 'avatar' + (opts.square ? ' team-logo' : '');
    if (avatarUrl) {
      return `<img class="${cls}" src="${esc(avatarUrl)}" alt="${esc(name)}" style="width:${size}px;height:${size}px" />`;
    }
    const bg = colorFromString(name || '?');
    return `<div class="${cls} avatar-placeholder" style="width:${size}px;height:${size}px;background:${bg};font-size:${Math.round(size * 0.4)}px">${esc(initials(name || '?'))}</div>`;
  }

  window.D1P.utils.avatar = { initials, colorFromString, renderAvatar };
})();
