/**
 * D1 Pronos — Bootstrap & routeur
 *
 * Routeur minimal basé sur location.hash (pas de framework, pas de build).
 * Chaque page expose `render(rootElement)` dans window.D1P.pages.<clé>.
 */
(function () {
  window.D1P = window.D1P || {};

  const DEFAULT_ROUTE = 'home';

  function currentRouteKey() {
    const hash = window.location.hash.replace('#', '');
    const known = window.D1P.components.navbar.NAV_ITEMS.map((i) => i.key);
    let key = known.includes(hash) ? hash : DEFAULT_ROUTE;

    // Garde-fou côté client (la vraie protection est dans les règles
    // Supabase) : une page normale ne doit jamais afficher l'Administration.
    if (key === 'admin') {
      const manager = window.D1P.services.managerService.getActiveManager();
      if (!manager || manager.role !== 'admin') key = DEFAULT_ROUTE;
    }
    return key;
  }

  function renderApp() {
    const key = currentRouteKey();
    if (window.location.hash !== '#' + key) {
      window.history.replaceState(null, '', '#' + key);
    }
    window.D1P.components.navbar.render(key);
    const root = document.getElementById('page-root');
    root.className = 'page-root fade-page';
    window.D1P.pages[key].render(root);
  }

  function showOnboarding() {
    document.getElementById('boot-loading').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    const onboardRoot = document.getElementById('onboarding-root');
    onboardRoot.classList.remove('hidden');
    window.D1P.pages.onboarding.mount(onboardRoot);
  }

  function showApp() {
    document.getElementById('boot-loading').classList.add('hidden');
    document.getElementById('onboarding-root').classList.add('hidden');
    document.getElementById('onboarding-root').innerHTML = '';
    document.getElementById('app').classList.remove('hidden');
    renderApp();
  }

  function showBootLoading() {
    document.getElementById('app').classList.add('hidden');
    document.getElementById('onboarding-root').classList.add('hidden');
    document.getElementById('boot-loading').classList.remove('hidden');
  }

  /**
   * Sans ça, une config Supabase non remplie (voir data/supabaseConfig.js)
   * fait planter `createClient` en plein milieu d'un clic quelconque, plus
   * tard, loin de tout écran d'accueil — un bouton reste bloqué "..." pour
   * toujours, sans aucun message. Autant le détecter ICI, une fois, avec un
   * message qui dit exactement quoi faire.
   */
  function supabaseConfigLooksValid() {
    const cfg = window.D1P.data.SUPABASE_CONFIG;
    return !!(cfg && /^https?:\/\//.test(cfg.url) && cfg.publishableKey && !cfg.publishableKey.includes('REMPLACE_MOI'));
  }

  function showConfigError() {
    document.getElementById('boot-loading').classList.add('hidden');
    document.getElementById('app').classList.add('hidden');
    const onboardRoot = document.getElementById('onboarding-root');
    onboardRoot.classList.remove('hidden');
    onboardRoot.innerHTML = '';
    onboardRoot.appendChild(window.D1P.utils.dom.el('div', { className: 'onboard-shell' }, [
      window.D1P.utils.dom.el('div', { className: 'onboard-card' }, [
        window.D1P.utils.dom.el('div', { className: 'onboard-logo' }, ['⚙️']),
        window.D1P.utils.dom.el('h1', {}, ['Configuration manquante']),
        window.D1P.utils.dom.el('p', { className: 'sub' }, [
          'data/supabaseConfig.js n\'est pas encore rempli — crée un projet sur supabase.com, colle son URL et sa clé publishable dans ce fichier (voir README.md), puis recharge cette page.',
        ]),
      ]),
    ]));
  }

  /** Point d'entrée unique, ré-appelé après connexion/inscription/déconnexion. */
  async function boot() {
    showBootLoading();

    if (!supabaseConfigLooksValid()) {
      showConfigError();
      return;
    }

    let session = null;
    try {
      session = await window.D1P.services.authService.getSession();
    } catch (e) {
      console.error('[script] vérification de session impossible', e);
    }

    if (!session) {
      showOnboarding();
      return;
    }

    try {
      const state = await window.D1P.services.stateService.init(session.user.id);
      if (!state.managers[session.user.id]) {
        throw new Error('PROFILE_NOT_FOUND');
      }
    } catch (e) {
      console.error('[script] chargement des données impossible', e);
      const message = e.message === 'PROFILE_NOT_FOUND'
        ? 'Ce profil a été supprimé — contacte l\'admin si c\'est une erreur.'
        : 'Connexion au serveur impossible — vérifie ta connexion internet et réessaie.';
      window.D1P.components.toast && window.D1P.components.toast.show(message, 'error');
      await window.D1P.services.authService.signOut();
      showOnboarding();
      return;
    }

    showApp();
  }

  window.addEventListener('hashchange', () => {
    if (window.D1P.services.managerService.getActiveManager()) renderApp();
  });

  window.D1P.app = { boot };

  document.addEventListener('DOMContentLoaded', boot);
})();
