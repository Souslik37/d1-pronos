/**
 * D1 Pronos — Administration
 *
 * Équipes, calendrier, encodage des résultats officiels, managers, et
 * verrouillage/clôture de la saison. Réservée aux comptes role === 'admin'
 * (voir components/navbar.js pour le masquage du menu, et supabase/schema.sql
 * pour l'application réelle de la règle côté serveur).
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;

  function teamLabel(teamId) {
    const team = window.D1P.services.seasonService.getTeam(teamId);
    return team ? team.name : '—';
  }

  // ── Équipes ───────────────────────────────────────────────────────────
  function buildTeamsSection(root, rerender) {
    root.appendChild(el('div', { className: 'section-title' }, ['🏉 Équipes']));
    const idInput = el('input', { type: 'text', placeholder: 'identifiant (ex: dendermonde)' });
    const nameInput = el('input', { type: 'text', placeholder: 'Nom (ex: Dendermonde)' });
    const addBtn = el('button', {
      className: 'btn btn-sm',
      onClick: async () => {
        const res = await window.D1P.services.seasonService.addTeam(idInput.value.trim(), nameInput.value.trim());
        if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
        idInput.value = ''; nameInput.value = '';
        window.D1P.components.toast.show('Équipe ajoutée ✅', 'success');
        rerender();
      },
    }, ['Ajouter']);
    root.appendChild(el('div', { className: 'card', style: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', marginBottom: '10px' } }, [idInput, nameInput, addBtn]));

    const teams = window.D1P.services.seasonService.listTeams();
    const list = el('div', { className: 'card' });
    teams.forEach((t) => {
      const nameField = el('input', {
        type: 'text', value: t.name,
        onChange: async (e) => {
          const res = await window.D1P.services.seasonService.renameTeam(t.id, e.target.value);
          if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); e.target.value = t.name; }
        },
      });
      list.appendChild(el('div', { className: 'boost-row' }, [
        el('div', { className: 'muted small' }, [t.id]),
        nameField,
      ]));
    });
    root.appendChild(list);
  }

  // ── Calendrier ────────────────────────────────────────────────────────
  function openAddMatchModal(rerender) {
    const teams = window.D1P.services.seasonService.listTeams();
    const matchdayInput = el('input', { type: 'number', min: '1', placeholder: 'Ex : 3' });
    const homeSelect = el('select', {}, teams.map((t) => el('option', { value: t.id }, [t.name])));
    const awaySelect = el('select', {}, teams.map((t) => el('option', { value: t.id }, [t.name])));
    const dateInput = el('input', { type: 'date' });

    window.D1P.components.modal.open({
      title: 'Ajouter un match',
      body: el('div', {}, [
        el('div', { className: 'field' }, [el('label', {}, ['Journée']), matchdayInput]),
        el('div', { className: 'field' }, [el('label', {}, ['Équipe à domicile']), homeSelect]),
        el('div', { className: 'field' }, [el('label', {}, ['Équipe à l\'extérieur']), awaySelect]),
        el('div', { className: 'field' }, [el('label', {}, ['Date']), dateInput]),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Ajouter', className: 'btn-primary', closeOnClick: false,
          onClick: async (btn) => {
            btn.disabled = true; btn.textContent = 'Ajout...';
            const res = await window.D1P.services.seasonService.addMatch({
              matchday: matchdayInput.value, homeTeamId: homeSelect.value, awayTeamId: awaySelect.value, date: dateInput.value,
            });
            if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); btn.disabled = false; btn.textContent = 'Ajouter'; return; }
            window.D1P.components.toast.show('Match ajouté ✅', 'success');
            window.D1P.components.modal.close();
            rerender();
          },
        },
      ],
    });
  }

  function openResultModal(match, rerender) {
    const existing = match.result || {};
    const scoreHome = el('input', { type: 'number', min: '0', value: existing.scoreHome });
    const scoreAway = el('input', { type: 'number', min: '0', value: existing.scoreAway });
    const triesHome = el('input', { type: 'number', min: '0', value: existing.triesHome });
    const triesAway = el('input', { type: 'number', min: '0', value: existing.triesAway });

    window.D1P.components.modal.open({
      title: 'Résultat · ' + teamLabel(match.homeTeamId) + ' vs ' + teamLabel(match.awayTeamId),
      body: el('div', {}, [
        el('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' } }, [
          el('div', { className: 'field' }, [el('label', {}, ['Score ' + teamLabel(match.homeTeamId)]), scoreHome]),
          el('div', { className: 'field' }, [el('label', {}, ['Score ' + teamLabel(match.awayTeamId)]), scoreAway]),
          el('div', { className: 'field' }, [el('label', {}, ['Essais ' + teamLabel(match.homeTeamId)]), triesHome]),
          el('div', { className: 'field' }, [el('label', {}, ['Essais ' + teamLabel(match.awayTeamId)]), triesAway]),
        ]),
        el('div', { className: 'field-hint' }, ['Les essais servent à calculer le bonus offensif (4 ou plus) — nécessaires pour un vrai classement.']),
      ]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Valider le résultat', className: 'btn-primary', closeOnClick: false,
          onClick: async (btn) => {
            const result = {
              scoreHome: Number(scoreHome.value), scoreAway: Number(scoreAway.value),
              triesHome: Number(triesHome.value), triesAway: Number(triesAway.value),
            };
            if ([result.scoreHome, result.scoreAway, result.triesHome, result.triesAway].some((n) => Number.isNaN(n) || scoreHome.value === '' || scoreAway.value === '' || triesHome.value === '' || triesAway.value === '')) {
              window.D1P.components.toast.show('Renseigne les 4 champs (score et essais des deux équipes).', 'error');
              return;
            }
            btn.disabled = true; btn.textContent = 'Enregistrement...';
            const res = await window.D1P.services.seasonService.finalizeMatch(match.id, result);
            if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); btn.disabled = false; btn.textContent = 'Valider le résultat'; return; }
            window.D1P.components.toast.show('Résultat encodé ✅', 'success');
            window.D1P.components.modal.close();
            rerender();
          },
        },
      ],
    });
  }

  function confirmUnfinalize(match, rerender) {
    window.D1P.components.modal.open({
      title: 'Annuler le résultat ?',
      body: el('div', {}, [el('p', { className: 'small' }, ['Le match redevient verrouillé, pas de résultat. Les pronostics déjà soumis restent intacts.'])]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Confirmer', className: 'btn-primary', closeOnClick: false,
          onClick: async (btn) => {
            btn.disabled = true;
            const res = await window.D1P.services.seasonService.unfinalizeMatch(match.id);
            if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); btn.disabled = false; return; }
            window.D1P.components.modal.close();
            rerender();
          },
        },
      ],
    });
  }

  function confirmRemoveMatch(match, rerender) {
    window.D1P.components.modal.open({
      title: 'Supprimer ce match ?',
      body: el('div', {}, [el('p', { className: 'small' }, ['Les pronostics associés disparaissent définitivement.'])]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Supprimer', className: 'btn-primary', closeOnClick: false,
          onClick: async (btn) => {
            btn.disabled = true;
            const res = await window.D1P.services.seasonService.removeMatch(match.id);
            if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); btn.disabled = false; return; }
            window.D1P.components.modal.close();
            rerender();
          },
        },
      ],
    });
  }

  function buildMatchRow(match, rerender) {
    const teams = window.D1P.services.seasonService.listTeams();
    const homeSelect = el('select', {}, teams.map((t) => el('option', { value: t.id }, [t.name])));
    homeSelect.value = match.homeTeamId;
    homeSelect.addEventListener('change', (e) => window.D1P.services.seasonService.updateMatchInfo(match.id, { homeTeamId: e.target.value }));
    const awaySelect = el('select', {}, teams.map((t) => el('option', { value: t.id }, [t.name])));
    awaySelect.value = match.awayTeamId;
    awaySelect.addEventListener('change', (e) => window.D1P.services.seasonService.updateMatchInfo(match.id, { awayTeamId: e.target.value }));
    const dateInput = el('input', { type: 'date', value: match.date, onChange: (e) => window.D1P.services.seasonService.updateMatchInfo(match.id, { date: e.target.value }) });

    const actions = [el('button', { className: 'btn btn-sm', onClick: () => openResultModal(match, rerender) }, [match.result ? 'Modifier résultat' : 'Encoder résultat'])];
    if (match.status === 'termine') actions.push(el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmUnfinalize(match, rerender) }, ['Annuler résultat']));
    actions.push(el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmRemoveMatch(match, rerender) }, ['Supprimer']));

    const statusLabel = { ouvert: '🟢 Ouvert', verrouille: '🔒 Verrouillé', termine: '✅ Terminé' }[match.status];

    return el('div', { className: 'card', style: { display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr auto auto', gap: '10px', alignItems: 'center', padding: '10px 16px', marginBottom: '6px' } }, [
      homeSelect, awaySelect, dateInput,
      el('span', { className: 'muted small' }, [statusLabel]),
      el('div', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' } }, actions),
    ]);
  }

  function buildCalendarSection(root, rerender) {
    const matches = window.D1P.services.seasonService.listMatches();
    const matchdays = [...new Set(matches.map((m) => m.matchday))].sort((a, b) => a - b);

    root.appendChild(el('div', { className: 'section-title' }, [
      '📅 Calendrier',
      el('span', { className: 'see-all', onClick: () => openAddMatchModal(rerender) }, ['+ Ajouter un match']),
    ]));

    matchdays.forEach((matchday) => {
      const dayMatches = matches.filter((m) => m.matchday === matchday);
      const allOpen = dayMatches.every((m) => m.status === 'ouvert');
      const allLocked = dayMatches.every((m) => m.status !== 'ouvert');
      root.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '14px 0 6px' } }, [
        el('div', { style: { fontWeight: '750' } }, ['Journée ' + matchday]),
        el('div', { style: { display: 'flex', gap: '6px' } }, [
          el('button', {
            className: 'btn btn-sm' + (allOpen ? ' btn-primary' : ' btn-ghost'),
            onClick: async () => { await window.D1P.services.seasonService.setMatchdayStatus(matchday, 'ouvert'); rerender(); },
          }, ['🟢 Ouvrir la journée']),
          el('button', {
            className: 'btn btn-sm' + (allLocked ? ' btn-primary' : ' btn-ghost'),
            onClick: async () => { await window.D1P.services.seasonService.setMatchdayStatus(matchday, 'verrouille'); rerender(); },
          }, ['🔒 Verrouiller la journée']),
        ]),
      ]));
      dayMatches.forEach((m) => root.appendChild(buildMatchRow(m, rerender)));
    });
  }

  // ── Managers ──────────────────────────────────────────────────────────
  function buildManagersSection(root, rerender) {
    root.appendChild(el('div', { className: 'section-title' }, ['👥 Managers']));
    const managers = window.D1P.services.managerService.listManagers();
    const list = el('div', { className: 'card' });
    managers.forEach((m) => {
      list.appendChild(el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, [m.name]),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
          m.role === 'admin' ? el('span', { className: 'badge badge-yellow' }, ['Admin']) : null,
          el('button', {
            className: 'btn btn-sm btn-ghost',
            onClick: async () => {
              const res = await window.D1P.services.managerService.setRole(m.id, m.role === 'admin' ? 'player' : 'admin');
              if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
              rerender();
            },
          }, [m.role === 'admin' ? 'Retirer admin' : 'Rendre admin']),
        ]),
      ]));
    });
    root.appendChild(list);
  }

  // ── Saison ────────────────────────────────────────────────────────────
  function buildSeasonSection(root, rerender) {
    const locked = window.D1P.services.seasonPredictionService.isSeasonLocked();
    root.appendChild(el('div', { className: 'section-title' }, ['🔮 Pronostics de saison']));
    root.appendChild(el('div', { className: 'card', style: { marginBottom: '10px' } }, [
      el('p', { className: 'small', style: { marginBottom: '10px' } }, [
        locked
          ? 'Les pronostics de saison sont verrouillés — plus personne ne peut soumettre ou modifier le sien.'
          : 'Les pronostics de saison sont encore ouverts. Verrouille-les une fois la journée 1 lancée, pour que personne ne puisse encore changer d\'avis après coup.',
      ]),
      el('button', {
        className: 'btn btn-sm' + (locked ? ' btn-ghost' : ' btn-primary'),
        onClick: async () => {
          const res = await window.D1P.services.seasonPredictionService.setLocked(!locked);
          if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
          rerender();
        },
      }, [locked ? '🔓 Rouvrir les pronostics de saison' : '🔒 Verrouiller les pronostics de saison']),
    ]));

    // Classement final réel — à remplir seulement en toute fin de saison, pour comparer aux pronostics de chacun.
    const teams = window.D1P.services.seasonService.listTeams();
    const state = window.D1P.services.stateService.getState();
    const order = (state.seasonActualOrder && state.seasonActualOrder.length === teams.length ? state.seasonActualOrder : teams.map((t) => t.id)).slice();
    let champion = state.seasonActualChampion || order[0];

    const championSelect = el('select', {}, teams.map((t) => el('option', { value: t.id }, [t.name])));
    championSelect.value = champion;
    championSelect.addEventListener('change', (e) => { champion = e.target.value; });

    const list = el('div', { className: 'card' });
    function move(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      rerenderList();
    }
    function rerenderList() {
      list.innerHTML = '';
      order.forEach((teamId, i) => {
        list.appendChild(el('div', { className: 'boost-row' }, [
          el('div', {}, [(i + 1) + '. ' + teamLabel(teamId)]),
          el('div', { style: { display: 'flex', gap: '4px' } }, [
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === 0, onClick: () => move(i, -1) }, ['▲']),
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === order.length - 1, onClick: () => move(i, 1) }, ['▼']),
          ]),
        ]));
      });
    }
    rerenderList();

    root.appendChild(el('div', { className: 'section-title' }, ['🏁 Classement final réel (à remplir en fin de saison)']));
    root.appendChild(el('div', { className: 'card' }, [
      el('div', { className: 'field' }, [el('label', {}, ['🏆 Vrai champion']), championSelect]),
    ]));
    root.appendChild(list);
    root.appendChild(el('button', {
      className: 'btn btn-primary btn-block', style: { margin: '10px 0 20px' },
      onClick: async (e) => {
        const btn = e.target;
        btn.disabled = true; btn.textContent = 'Enregistrement...';
        const res = await window.D1P.services.seasonPredictionService.setFinalResult(order, champion);
        btn.disabled = false; btn.textContent = 'Enregistrer le classement final réel';
        if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
        window.D1P.components.toast.show('Classement final enregistré — les pronostics de saison sont maintenant comparés ✅', 'success');
        rerender();
      },
    }, ['Enregistrer le classement final réel']));
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Administration']),
      el('p', {}, ['Équipes, calendrier, résultats officiels, managers et saison.']),
    ]));

    function rerender() { render(root); }
    buildTeamsSection(root, rerender);
    buildCalendarSection(root, rerender);
    buildManagersSection(root, rerender);
    buildSeasonSection(root, rerender);
  }

  window.D1P.pages.admin = { render };
})();
