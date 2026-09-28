/**
 * D1 Pronos — Connexion / Création de profil
 *
 * L'utilisateur ne voit jamais "email" ni "mot de passe" : uniquement un
 * nom et un code à 4 chiffres (voir services/authService.js).
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;

  function mount(root) {
    let mode = 'signup'; // 'signup' | 'login'
    let busy = false;
    let name = '';
    let pin = '';
    let pinConfirm = '';

    function buildModeTabs() {
      return el('div', { className: 'tabs', style: { marginBottom: '20px' } }, [
        el('div', { className: 'tab-btn' + (mode === 'signup' ? ' active' : ''), onClick: () => { mode = 'signup'; renderAll(); } }, ['Créer mon profil']),
        el('div', { className: 'tab-btn' + (mode === 'login' ? ' active' : ''), onClick: () => { mode = 'login'; renderAll(); } }, ['J\'ai déjà un profil']),
      ]);
    }

    function pinInput(value, onInput, placeholder) {
      return el('input', {
        type: 'text', inputmode: 'numeric', maxlength: '4', placeholder: placeholder || '••••', value,
        onInput: (e) => {
          const filtered = e.target.value.replace(/\D/g, '').slice(0, 4);
          e.target.value = filtered;
          onInput(filtered);
        },
      });
    }

    function buildLogin() {
      const nameInput = el('input', { type: 'text', placeholder: 'Ton nom', value: name, onInput: (e) => { name = e.target.value; } });
      const pinField = pinInput(pin, (v) => { pin = v; });

      const submitBtn = el('button', {
        className: 'btn btn-primary btn-block',
        onClick: async () => {
          if (busy) return;
          if (!name.trim() || pin.length !== 4) {
            window.D1P.components.toast.show('Renseigne ton nom et ton code à 4 chiffres.', 'error');
            return;
          }
          busy = true; submitBtn.disabled = true; submitBtn.textContent = 'Connexion...';
          try {
            const res = await window.D1P.services.authService.signIn(name, pin);
            if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
            window.D1P.app.boot();
          } catch (e) {
            console.error('[onboarding] erreur inattendue à la connexion', e);
            window.D1P.components.toast.show('Une erreur inattendue est survenue — réessaie.', 'error');
          } finally {
            busy = false; submitBtn.disabled = false; submitBtn.textContent = 'Se connecter';
          }
        },
      }, ['Se connecter']);

      return el('div', { className: 'onboard-card' }, [
        buildModeTabs(),
        el('div', { className: 'onboard-logo' }, ['🏉']),
        el('h1', {}, ['Content de te revoir']),
        el('p', { className: 'sub' }, ['Retape ton nom et ton code à 4 chiffres.']),
        el('div', { className: 'field' }, [el('label', {}, ['Ton nom']), nameInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Ton code à 4 chiffres']), pinField]),
        submitBtn,
      ]);
    }

    function buildSignup() {
      const nameInput = el('input', { type: 'text', placeholder: 'Ex : Fred', value: name, onInput: (e) => { name = e.target.value; } });
      const pinField = pinInput(pin, (v) => { pin = v; }, '4 chiffres');
      const pinConfirmField = pinInput(pinConfirm, (v) => { pinConfirm = v; }, 'Retape le code');

      const submitBtn = el('button', {
        className: 'btn btn-primary btn-block',
        onClick: async () => {
          if (busy) return;
          if (!name.trim()) { window.D1P.components.toast.show('Choisis un nom.', 'error'); return; }
          if (pin.length !== 4) { window.D1P.components.toast.show('Le code doit faire 4 chiffres.', 'error'); return; }
          if (pin !== pinConfirm) { window.D1P.components.toast.show('Les deux codes ne correspondent pas.', 'error'); return; }
          busy = true; submitBtn.disabled = true; submitBtn.textContent = 'Création en cours...';
          try {
            const res = await window.D1P.services.authService.signUp(name, pin);
            if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
            window.D1P.components.toast.show('Bienvenue ' + name + ' 👋', 'success');
            window.D1P.app.boot();
          } catch (e) {
            console.error('[onboarding] erreur inattendue à l\'inscription', e);
            window.D1P.components.toast.show('Une erreur inattendue est survenue — réessaie.', 'error');
          } finally {
            busy = false; submitBtn.disabled = false; submitBtn.textContent = 'Entrer dans la compétition 🏉';
          }
        },
      }, ['Entrer dans la compétition 🏉']);

      return el('div', { className: 'onboard-card' }, [
        buildModeTabs(),
        el('div', { className: 'onboard-logo' }, ['🏉']),
        el('h1', {}, ['D1 Pronos']),
        el('p', { className: 'sub' }, ['Pronostics sur tout le championnat de Belgique — choisis un nom et un code à 4 chiffres.']),
        el('div', { className: 'field' }, [el('label', {}, ['Ton nom']), nameInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Ton code à 4 chiffres']), pinField]),
        el('div', { className: 'field' }, [el('label', {}, ['Confirme le code']), pinConfirmField]),
        el('div', { className: 'field-hint', style: { marginBottom: '14px' } }, ['Retiens bien ce code : il n\'y a pas de mail de récupération, il faudra demander à l\'admin de le réinitialiser si tu l\'oublies.']),
        submitBtn,
      ]);
    }

    function renderAll() {
      root.innerHTML = '';
      root.appendChild(el('div', { className: 'onboard-shell' }, [mode === 'login' ? buildLogin() : buildSignup()]));
    }

    renderAll();
  }

  window.D1P.pages.onboarding = { mount };
})();
