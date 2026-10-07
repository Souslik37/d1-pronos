/**
 * D1 Pronos — Helpers DOM
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.utils = window.D1P.utils || {};

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }

  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

  // Attributs booléens HTML : leur simple PRÉSENCE veut dire "actif", donc
  // `setAttribute('disabled', false)` désactiverait quand même l'élément
  // (la valeur est ignorée, seule la présence compte). Il faut assigner la
  // propriété JS correspondante pour que `false` fonctionne comme attendu.
  const BOOLEAN_PROPS = ['disabled', 'checked', 'readOnly', 'required', 'selected', 'multiple', 'autofocus'];

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    attrs = attrs || {};
    Object.keys(attrs).forEach((key) => {
      const value = attrs[key];
      if (value === null || value === undefined) return;
      if (key === 'className') node.className = value;
      else if (key === 'value' || BOOLEAN_PROPS.includes(key)) {
        node[key] = value;
      } else if (key === 'dataset') {
        Object.keys(value).forEach((dk) => { node.dataset[dk] = value[dk]; });
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(node.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        node.addEventListener(key.slice(2).toLowerCase(), value);
      } else if (key === 'html') {
        node.innerHTML = value;
      } else {
        node.setAttribute(key, value);
      }
    });
    (children || []).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      if (Array.isArray(child)) {
        child.forEach((c) => c && node.appendChild(c instanceof Node ? c : document.createTextNode(c)));
      } else {
        node.appendChild(child instanceof Node ? child : document.createTextNode(child));
      }
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch]);
  }

  /** Lien "écrire un mail" — l'adresse vient de CONFIG.contact.email, jamais écrite en dur dans une page. */
  function mailLink(email, label) {
    return el('a', { href: 'mailto:' + email, className: 'mail-link' }, [label || email]);
  }

  window.D1P.utils.dom = { qs, qsa, el, clear, escapeHtml, mailLink };
})();
