/**
 * D1 Pronos — Barre latérale + barre supérieure
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.components = window.D1P.components || {};

  const NAV_ITEMS = [
    { key: 'home', icon: '🏠', label: 'Accueil' },
    { key: 'season', icon: '🔮', label: 'Ma saison' },
    { key: 'matchday', icon: '🎯', label: 'Pronostics' },
    { key: 'standings', icon: '🏆', label: 'Classement' },
    { key: 'rules', icon: '📖', label: 'Règles' },
    { key: 'admin', icon: '⚙️', label: 'Administration' },
  ];

  const PAGE_TITLES = NAV_ITEMS.reduce((acc, i) => { acc[i.key] = i.label; return acc; }, {});

  function visibleItems(manager) {
    const isAdmin = manager && manager.role === 'admin';
    return NAV_ITEMS.filter((item) => item.key !== 'admin' || isAdmin);
  }

  function renderSidebar(currentKey, manager) {
    const { el } = window.D1P.utils.dom;
    const sidebar = document.getElementById('sidebar');
    sidebar.innerHTML = '';
    sidebar.appendChild(el('div', { className: 'brand' }, [
      el('div', { className: 'brand-badge' }, ['🏉']),
      el('div', { className: 'brand-text' }, [
        el('div', { className: 't1' }, ['D1 Pronos']),
        el('div', { className: 't2' }, ['Championnat de Belgique']),
      ]),
    ]));

    const list = el('div', { className: 'nav-list' },
      visibleItems(manager).map((item) => el('div', {
        className: 'nav-item' + (item.key === currentKey ? ' active' : ''),
        onClick: () => { window.location.hash = '#' + item.key; },
      }, [
        el('span', { className: 'ic' }, [item.icon]),
        el('span', {}, [item.label]),
      ]))
    );
    sidebar.appendChild(list);
  }

  function renderTopbar(currentKey) {
    const { el } = window.D1P.utils.dom;
    const topbar = document.getElementById('topbar');
    topbar.innerHTML = '';

    const manager = window.D1P.services.managerService.getActiveManager();
    topbar.appendChild(el('div', { className: 'topbar-title' }, [PAGE_TITLES[currentKey] || '']));

    const right = el('div', { className: 'topbar-right' });
    if (manager) {
      right.appendChild(el('div', { className: 'manager-pill' }, [
        (() => {
          const wrap = el('span', {});
          wrap.innerHTML = window.D1P.utils.avatar.renderAvatar(manager.name, null, 26);
          return wrap;
        })(),
        el('span', { className: 'name' }, [manager.name]),
        manager.role === 'admin' ? el('span', { className: 'badge badge-yellow', style: { marginLeft: '8px' } }, ['Admin']) : null,
      ]));
    }
    topbar.appendChild(right);
  }

  function render(currentKey) {
    const manager = window.D1P.services.managerService.getActiveManager();
    renderSidebar(currentKey, manager);
    renderTopbar(currentKey);
  }

  window.D1P.components.navbar = { render, NAV_ITEMS, PAGE_TITLES, visibleItems };
})();
