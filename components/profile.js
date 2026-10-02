/**
 * D1 Pronos — Profil des managers (prénom, nom, club supporté)
 *
 * openEditor() : le formulaire "Mon profil", ouvert depuis le haut à droite.
 * openCard(managerId) : la fiche d'un manager, ouverte en cliquant son
 * pseudo dans le classement. Tout est facultatif ; visible des comptes
 * connectés seulement, jamais du public (voir supabase/schema.sql
 * profiles_*) — et le formulaire le dit clairement avant d'enregistrer.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.components = window.D1P.components || {};

  const { el } = window.D1P.utils.dom;
  const OTHER = '__other__';

  function svc() { return window.D1P.services; }

  /** L'équipe de D1 dont le nom correspond au club saisi (pour afficher son logo), sinon null. */
  function d1TeamByName(name) {
    if (!name) return null;
    const wanted = name.trim().toLowerCase();
    return svc().seasonService.listTeams().find((t) => t.name.trim().toLowerCase() === wanted) || null;
  }

  function teamLogo(team, size) {
    const wrap = el('span', {});
    wrap.innerHTML = window.D1P.utils.avatar.renderAvatar(team.name, team.logoUrl, size, { square: true });
    return wrap;
  }

  /**
   * Accueil (rappel "complète ton profil") et Administration (noms des
   * managers) affichent des données de profil : on les redessine après un
   * enregistrement. Pas les autres pages — redessiner Pronostics, par
   * exemple, effacerait des cases cochées pas encore enregistrées.
   */
  function refreshProfileDependentPage() {
    const page = window.location.hash.replace('#', '');
    if (page === 'home' || page === 'admin') window.D1P.app.refresh();
  }

  function openEditor() {
    const manager = svc().managerService.getActiveManager();
    const profile = svc().managerService.getProfile(manager.id);
    const teams = svc().seasonService.listTeams();

    const matchedTeam = d1TeamByName(profile.supportedClub);
    const initialChoice = matchedTeam ? matchedTeam.name : (profile.supportedClub ? OTHER : '');

    const firstName = el('input', { type: 'text', maxlength: '60', placeholder: 'Ton prénom', value: profile.firstName });
    const lastName = el('input', { type: 'text', maxlength: '80', placeholder: 'Ton nom', value: profile.lastName });
    const otherClub = el('input', { type: 'text', maxlength: '80', placeholder: 'Nom du club', value: matchedTeam ? '' : profile.supportedClub });
    const otherField = el('div', { className: 'field', style: { display: initialChoice === OTHER ? '' : 'none' } }, [
      el('label', {}, ['Quel club ?']), otherClub,
    ]);
    const clubSelect = el('select', {
      onChange: () => { otherField.style.display = clubSelect.value === OTHER ? '' : 'none'; },
    }, [
      el('option', { value: '' }, ['— Aucun / je ne sais pas —']),
      ...teams.map((t) => el('option', { value: t.name }, [t.name])),
      el('option', { value: OTHER }, ['Autre club…']),
    ]);
    clubSelect.value = initialChoice;

    const body = el('div', {}, [
      el('p', { className: 'field-hint', style: { marginBottom: '14px' } }, [
        'Pseudo : ' + manager.name + ' — c\'est avec lui (et ton code) que tu te connectes, il ne change pas.',
      ]),
      el('div', { className: 'field' }, [el('label', {}, ['Prénom']), firstName]),
      el('div', { className: 'field' }, [el('label', {}, ['Nom']), lastName]),
      el('div', { className: 'field' }, [el('label', {}, ['Club que tu supportes']), clubSelect]),
      otherField,
      el('p', { className: 'field-hint' }, [
        'Tout est facultatif. Ces infos sont visibles par les autres joueurs connectés (en cliquant sur ton pseudo dans le classement) et par l\'admin.',
      ]),
    ]);

    window.D1P.components.modal.open({
      title: 'Mon profil',
      body,
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Enregistrer', className: 'btn-primary', closeOnClick: false,
          onClick: async (btn) => {
            btn.disabled = true; btn.textContent = 'Enregistrement...';
            const supportedClub = clubSelect.value === OTHER ? otherClub.value : clubSelect.value;
            const res = await svc().managerService.saveProfile(manager.id, {
              firstName: firstName.value, lastName: lastName.value, supportedClub,
            });
            if (!res.ok) {
              window.D1P.components.toast.show(res.reason, 'error');
              btn.disabled = false; btn.textContent = 'Enregistrer';
              return;
            }
            window.D1P.components.toast.show('Profil enregistré ✅', 'success');
            window.D1P.components.modal.close();
            refreshProfileDependentPage();
          },
        },
      ],
    });
  }

  function infoRow(label, valueNode) {
    return el('div', { className: 'boost-row' }, [
      el('div', { className: 'boost-label' }, [label]),
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '650' } }, [valueNode]),
    ]);
  }

  function openCard(managerId) {
    const manager = svc().stateService.getState().managers[managerId];
    if (!manager) return;
    const profile = svc().managerService.getProfile(managerId);
    const name = svc().managerService.fullName(profile);
    const team = d1TeamByName(profile.supportedClub);
    const isSelf = managerId === svc().managerService.getActiveManager().id;

    const rows = [];
    if (!name && !profile.supportedClub) {
      rows.push(el('p', { className: 'muted small' }, [
        isSelf ? 'Tu n\'as pas encore complété ton profil.' : 'Cette personne n\'a pas encore complété son profil.',
      ]));
    } else {
      rows.push(infoRow('Nom', name || '—'));
      rows.push(infoRow('Club supporté', profile.supportedClub
        ? el('span', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [team ? teamLogo(team, 24) : null, profile.supportedClub])
        : '—'));
    }

    const actions = [{ label: 'Fermer', className: 'btn-ghost' }];
    if (isSelf) {
      // closeOnClick: false — sinon le modal se ferme APRÈS que l'éditeur vient de s'ouvrir, et l'efface aussitôt.
      actions.push({
        label: 'Modifier mon profil', className: 'btn-primary', closeOnClick: false,
        onClick: () => openEditor(),
      });
    }

    window.D1P.components.modal.open({ title: manager.name, body: el('div', {}, rows), actions });
  }

  window.D1P.components.profile = { openEditor, openCard };
})();
