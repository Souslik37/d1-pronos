/**
 * D1 Pronos — Toasts (notifications éphémères)
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.components = window.D1P.components || {};

  function show(message, type) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const toast = window.D1P.utils.dom.el('div', { className: 'toast ' + (type || '') }, [message]);
    root.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  window.D1P.components.toast = { show };
})();
