/**
 * D1 Pronos — Connexion / Création de profil
 *
 * L'utilisateur ne voit jamais "email" ni "mot de passe" : uniquement un
 * pseudo et un code à 4 chiffres (voir services/authService.js — en
 * interne c'est toujours "name", le mot "pseudo" n'est qu'un choix
 * d'affichage plus parlant que "nom"). À la création du compte on demande
 * aussi prénom, nom et club supporté, obligatoires (voir
 * components/profile.js buildFields).
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el, mailLink } = window.D1P.utils.dom;

  function mount(root) {
    let mode = 'signup'; // 'signup' | 'login'
    let busy = false;
    let name = '';
    let pin = '';
    let pinConfirm = '';
    // Prénom / nom / club saisis : renseignés avant chaque redessin pour ne pas être perdus quand on passe d'un onglet à l'autre.
    let profileDraft = { firstName: '', lastName: '', supportedClub: '' };
    let profileFields = null;

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
      const nameInput = el('input', { type: 'text', placeholder: 'Ton pseudo', value: name, onInput: (e) => { name = e.target.value; } });
      const pinField = pinInput(pin, (v) => { pin = v; });

      const submitBtn = el('button', {
        className: 'btn btn-primary btn-block',
        onClick: async () => {
          if (busy) return;
          if (!name.trim() || pin.length !== 4) {
            window.D1P.components.toast.show('Renseigne ton pseudo et ton code à 4 chiffres.', 'error');
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
        el('p', { className: 'sub' }, ['Retape ton pseudo et ton code à 4 chiffres.']),
        el('div', { className: 'field' }, [el('label', {}, ['Pseudo']), nameInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Ton code à 4 chiffres']), pinField]),
        submitBtn,
        // Quelqu'un qui a oublié son code ne peut pas ouvrir l'onglet Règles (il faut être connecté) : c'est ici qu'il doit trouver comment s'en sortir.
        el('p', { className: 'field-hint', style: { marginTop: '16px', textAlign: 'center' } }, ['Pseudo ou code oublié ? Écris à ', mailLink(window.D1P.data.CONFIG.contact.email), '.']),
      ]);
    }

    function buildSignup() {
      const nameInput = el('input', { type: 'text', placeholder: 'Ex : Fred', value: name, onInput: (e) => { name = e.target.value; } });
      const pinField = pinInput(pin, (v) => { pin = v; }, '4 chiffres');
      const pinConfirmField = pinInput(pinConfirm, (v) => { pinConfirm = v; }, 'Retape le code');
      // Pas encore connecté : l'état n'est pas chargé, donc les clubs viennent de la liste de référence (data/teams.js).
      profileFields = window.D1P.components.profile.buildFields(profileDraft, window.D1P.data.TEAMS.map((t) => t.name));

      const submitBtn = el('button', {
        className: 'btn btn-primary btn-block',
        onClick: async () => {
          if (busy) return;
          if (!name.trim()) { window.D1P.components.toast.show('Choisis un pseudo.', 'error'); return; }
          if (pin.length !== 4) { window.D1P.components.toast.show('Le code doit faire 4 chiffres.', 'error'); return; }
          if (pin !== pinConfirm) { window.D1P.components.toast.show('Les deux codes ne correspondent pas.', 'error'); return; }
          const profile = profileFields.read();
          const managers = window.D1P.services.managerService;
          const profileError = managers.validateProfile(managers.cleanProfile(profile));
          if (profileError) { window.D1P.components.toast.show(profileError, 'error'); return; }
          busy = true; submitBtn.disabled = true; submitBtn.textContent = 'Création en cours...';
          try {
            const res = await window.D1P.services.authService.signUp(name, pin, profile);
            if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
            if (res.profileSaved === false) {
              window.D1P.components.toast.show('Compte créé, mais ton profil n\'a pas pu être enregistré — complète-le via ta pastille, en haut à droite.', 'error');
            } else {
              window.D1P.components.toast.show('Bienvenue ' + name + ' 👋', 'success');
            }
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
        el('p', { className: 'sub' }, ['Pronostics sur tout le championnat de Belgique — choisis un pseudo et un code à 4 chiffres.']),
        el('div', { className: 'field' }, [el('label', {}, ['Pseudo *']), nameInput]),
        el('div', { className: 'field-hint', style: { marginTop: '-10px', marginBottom: '14px' } }, ['* à bien retenir : c\'est lui, avec ton code, qui te sert à te reconnecter.']),
        el('div', { className: 'field' }, [el('label', {}, ['Ton code à 4 chiffres']), pinField]),
        el('div', { className: 'field' }, [el('label', {}, ['Confirme le code']), pinConfirmField]),
        el('div', { className: 'field-hint', style: { marginBottom: '14px' } }, ['Retiens bien ce code : il n\'y a pas de mail de récupération. Si tu l\'oublies, écris à ', mailLink(window.D1P.data.CONFIG.contact.email), ' pour le réinitialiser.']),
        el('h2', { style: { fontSize: '14px', fontWeight: '800', margin: '18px 0 12px' } }, ['Et toi, c\'est qui ?']),
        ...profileFields.nodes,
        submitBtn,
      ]);
    }

    function renderAll() {
      if (profileFields) profileDraft = profileFields.read();
      root.innerHTML = '';
      root.appendChild(el('div', { className: 'onboard-shell' }, [mode === 'login' ? buildLogin() : buildSignup()]));
    }

    renderAll();
  }

  window.D1P.pages.onboarding = { mount };
})();
