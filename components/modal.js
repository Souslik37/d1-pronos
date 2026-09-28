/**
 * D1 Pronos — Modal générique
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.components = window.D1P.components || {};

  const { el, clear } = window.D1P.utils.dom;

  function close() {
    const root = document.getElementById('modal-root');
    clear(root);
  }

  /** open({ title, body: Node|string, actions: [{label, className, onClick, closeOnClick}], onClose, wide }) */
  function open(opts) {
    const root = document.getElementById('modal-root');
    clear(root);

    function closeThis() {
      close();
      if (opts.onClose) opts.onClose();
    }

    const bodyWrap = el('div', { className: 'modal-body' });
    if (typeof opts.body === 'string') bodyWrap.innerHTML = opts.body;
    else if (opts.body instanceof Node) bodyWrap.appendChild(opts.body);

    const actionsWrap = el('div', { className: 'modal-actions' },
      (opts.actions || []).map((a) => {
        const btn = el('button', {
          className: 'btn ' + (a.className || ''),
          onClick: () => {
            if (a.onClick) a.onClick(btn);
            if (a.closeOnClick !== false) closeThis();
          },
        }, [a.label]);
        return btn;
      })
    );

    const box = el('div', { className: 'modal-box' + (opts.wide ? ' modal-wide' : '') }, [
      el('div', { className: 'modal-head' }, [
        el('h2', {}, [opts.title || '']),
        el('button', { className: 'modal-close', onClick: closeThis }, ['✕']),
      ]),
      bodyWrap,
      actionsWrap,
    ]);

    const overlay = el('div', {
      className: 'modal-overlay',
      onClick: (e) => { if (e.target === overlay && opts.dismissable !== false) closeThis(); },
    }, [box]);

    root.appendChild(overlay);
    return { close: closeThis, box };
  }

  window.D1P.components.modal = { open, close };
})();
