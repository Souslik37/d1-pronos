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
  let selectedMatchday = null; // journée affichée dans Calendrier ; null = pas encore choisie

  function teamLabel(teamId) {
    const team = window.D1P.services.seasonService.getTeam(teamId);
    return team ? team.name : '—';
  }

  function teamChip(teamId) {
    const team = teamId ? window.D1P.services.seasonService.getTeam(teamId) : null;
    const wrap = el('span', {});
    wrap.innerHTML = window.D1P.utils.avatar.renderAvatar(team ? team.name : '?', team && team.logoUrl, 20, { square: true });
    return wrap;
  }

  /** Même code couleur que pages/season.js "Ma saison" — sert de repère visuel pendant la saisie du classement final réel. */
  function rankBg(rank) {
    const S = window.D1P.data.CONFIG.season;
    if (rank <= S.playoffSpots) return 'var(--green-bg)';
    if (rank === S.barrageRank) return 'rgba(94, 158, 214, 0.15)';
    if (rank >= S.relegatedFromRank) return 'rgba(214, 94, 94, 0.13)';
    return null;
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

    root.appendChild(el('p', { className: 'field-hint', style: { marginBottom: '10px' } }, [
      'Logo : chemin du fichier dans le projet (ex: assets/logos/dendermonde.png) ou une URL complète. Les fichiers vivent dans le dossier assets/logos/ du repo.',
    ]));

    const teams = window.D1P.services.seasonService.listTeams();
    const list = el('div', { className: 'card' });
    teams.forEach((t) => {
      const logoPreview = el('span', {});
      logoPreview.innerHTML = window.D1P.utils.avatar.renderAvatar(t.name, t.logoUrl, 36, { square: true });

      const nameField = el('input', {
        type: 'text', value: t.name,
        onChange: async (e) => {
          const res = await window.D1P.services.seasonService.renameTeam(t.id, e.target.value);
          if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); e.target.value = t.name; }
        },
      });
      const logoField = el('input', {
        type: 'text', value: t.logoUrl || '', placeholder: 'assets/logos/' + t.id + '.png',
        onChange: async (e) => {
          const res = await window.D1P.services.seasonService.setTeamLogo(t.id, e.target.value);
          if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); e.target.value = t.logoUrl || ''; return; }
          logoPreview.innerHTML = window.D1P.utils.avatar.renderAvatar(t.name, t.logoUrl, 36, { square: true });
        },
      });
      list.appendChild(el('div', {
        className: 'boost-row',
        style: { display: 'grid', gridTemplateColumns: 'auto auto 1fr 1.4fr', gap: '10px', alignItems: 'center' },
      }, [
        logoPreview,
        el('div', { className: 'muted small' }, [t.id]),
        nameField,
        logoField,
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

  /**
   * Même forme que le formulaire de pronostic (voir pages/matchday.js
   * buildOpenMatchCard) — l'admin choisit qui a gagné et les bonus, pas un
   * score brut : ni lui ni les managers ne suivent le score exact match par
   * match, seulement qui gagne et les bonus (voir scoringService.js).
   */
  function openResultModal(match, rerender) {
    const existing = match.result || {};
    const state = {
      winner: existing.winner || null,
      bonusHome: !!existing.bonusHome,
      bonusAway: !!existing.bonusAway,
      closeMargin: !!existing.closeMargin,
      showBonusInfo: false,
    };

    const body = el('div', {});
    function winnerOption(value, label) {
      return el('div', {
        className: 'pick-item' + (state.winner === value ? ' active' : ''),
        onClick: () => { state.winner = value; if (value === 'draw') state.closeMargin = false; rerenderBody(); },
      }, [label]);
    }
    function closeMarginBlockFor() {
      if (!state.winner || state.winner === 'draw') return null;
      const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' } }, [
        el('label', { className: 'field-hint', style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 } }, [
          el('input', { type: 'checkbox', checked: state.closeMargin, onChange: (e) => { state.closeMargin = e.target.checked; } }),
          'Écart serré (7 points ou moins) — bonus défensif pour ' + teamLabel(state.winner === 'home' ? match.awayTeamId : match.homeTeamId),
        ]),
        el('span', {
          className: 'muted', title: 'Une équipe ne cumule jamais bonus offensif et bonus défensif sur un même match (règle belge) — max +1 point de bonus, même si les deux sont cochés.',
          style: { cursor: 'pointer', fontSize: '13px', flexShrink: '0' },
          onClick: () => { state.showBonusInfo = !state.showBonusInfo; rerenderBody(); },
        }, ['ⓘ']),
      ]);
      const wrap = el('div', {}, [row]);
      if (state.showBonusInfo) {
        wrap.appendChild(el('div', { className: 'field-hint', style: { marginTop: '4px' } }, [
          '⚠️ Une équipe ne cumule jamais bonus offensif et bonus défensif sur un même match (règle belge) — max +1 point de bonus, même si les deux sont cochés.',
        ]));
      }
      return wrap;
    }
    function rerenderBody() {
      body.innerHTML = '';
      body.appendChild(el('div', { className: 'single-picker' }, [
        winnerOption('home', teamLabel(match.homeTeamId)),
        winnerOption('draw', 'Match nul'),
        winnerOption('away', teamLabel(match.awayTeamId)),
      ]));
      body.appendChild(el('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px' } }, [
        el('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' } }, [
          el('input', { type: 'checkbox', checked: state.bonusHome, onChange: (e) => { state.bonusHome = e.target.checked; } }),
          teamLabel(match.homeTeamId) + ' marque 4 essais ou plus',
        ]),
        el('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' } }, [
          el('input', { type: 'checkbox', checked: state.bonusAway, onChange: (e) => { state.bonusAway = e.target.checked; } }),
          teamLabel(match.awayTeamId) + ' marque 4 essais ou plus',
        ]),
      ]));
      const closeMarginBlock = closeMarginBlockFor();
      if (closeMarginBlock) body.appendChild(closeMarginBlock);
    }
    rerenderBody();

    window.D1P.components.modal.open({
      title: 'Résultat · ' + teamLabel(match.homeTeamId) + ' vs ' + teamLabel(match.awayTeamId),
      body,
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Valider le résultat', className: 'btn-primary', closeOnClick: false,
          onClick: async (btn) => {
            if (!state.winner) { window.D1P.components.toast.show('Choisis qui a gagné (ou un match nul).', 'error'); return; }
            const result = { winner: state.winner, bonusHome: state.bonusHome, bonusAway: state.bonusAway, closeMargin: state.winner !== 'draw' && state.closeMargin };
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
    const tbdOption = () => el('option', { value: '' }, ['— À déterminer —']);
    const homeSelect = el('select', {}, [tbdOption(), ...teams.map((t) => el('option', { value: t.id }, [t.name]))]);
    homeSelect.value = match.homeTeamId || '';
    homeSelect.addEventListener('change', (e) => window.D1P.services.seasonService.updateMatchInfo(match.id, { homeTeamId: e.target.value }));
    const awaySelect = el('select', {}, [tbdOption(), ...teams.map((t) => el('option', { value: t.id }, [t.name]))]);
    awaySelect.value = match.awayTeamId || '';
    awaySelect.addEventListener('change', (e) => window.D1P.services.seasonService.updateMatchInfo(match.id, { awayTeamId: e.target.value }));
    const dateInput = el('input', { type: 'date', value: match.date, onChange: (e) => window.D1P.services.seasonService.updateMatchInfo(match.id, { date: e.target.value }) });

    const actions = [el('button', { className: 'btn btn-sm', onClick: () => openResultModal(match, rerender) }, [match.result ? 'Modifier résultat' : 'Encoder résultat'])];
    if (match.status === 'termine') actions.push(el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmUnfinalize(match, rerender) }, ['Annuler résultat']));
    actions.push(el('button', { className: 'btn btn-sm btn-ghost', onClick: () => confirmRemoveMatch(match, rerender) }, ['Supprimer']));

    // Un match "ouvert" en base peut déjà être verrouillé pour de vrai si le coup d'envoi est passé (voir seasonService.isMatchOpen) — l'admin doit le voir, pas croire qu'il faut encore cliquer "Verrouiller".
    const autoLocked = match.status === 'ouvert' && !window.D1P.services.seasonService.isMatchOpen(match);
    const statusLabel = autoLocked ? '🔒 Coup d\'envoi passé' : { ouvert: '🟢 Ouvert', verrouille: '🔒 Verrouillé', termine: '✅ Terminé' }[match.status];

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

    if (!matchdays.length) {
      root.appendChild(el('div', { className: 'empty-state' }, [el('div', { className: 'ic' }, ['📅']), el('div', {}, ['Aucun match pour le moment.'])]));
      return;
    }
    if (selectedMatchday === null || !matchdays.includes(selectedMatchday)) selectedMatchday = matchdays[0];

    const select = el('select', {
      onChange: (e) => { selectedMatchday = Number(e.target.value); rerender(); },
    }, matchdays.map((md) => el('option', { value: md, selected: md === selectedMatchday }, ['Journée ' + md])));
    root.appendChild(el('div', { className: 'card', style: { marginBottom: '10px' } }, [select]));

    const dayMatches = matches.filter((m) => m.matchday === selectedMatchday);
    const allOpen = dayMatches.every((m) => m.status === 'ouvert');
    const allLocked = dayMatches.every((m) => m.status !== 'ouvert');
    root.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 0 6px' } }, [
      el('div', { style: { fontWeight: '750' } }, ['Journée ' + selectedMatchday]),
      el('div', { style: { display: 'flex', gap: '6px' } }, [
        el('button', {
          className: 'btn btn-sm' + (allOpen ? ' btn-primary' : ' btn-ghost'),
          onClick: async () => { await window.D1P.services.seasonService.setMatchdayStatus(selectedMatchday, 'ouvert'); rerender(); },
        }, ['🟢 Ouvrir la journée']),
        el('button', {
          className: 'btn btn-sm' + (allLocked ? ' btn-primary' : ' btn-ghost'),
          onClick: async () => { await window.D1P.services.seasonService.setMatchdayStatus(selectedMatchday, 'verrouille'); rerender(); },
        }, ['🔒 Verrouiller la journée']),
      ]),
    ]));
    dayMatches.forEach((m) => root.appendChild(buildMatchRow(m, rerender)));
  }

  // ── Managers ──────────────────────────────────────────────────────────
  function confirmRemoveManager(manager, rerender) {
    window.D1P.components.modal.open({
      title: 'Supprimer ' + manager.name + ' ?',
      body: el('div', {}, [el('p', { className: 'small' }, [
        'Retire ' + manager.name + ' du jeu — ses pronostics (journées et saison) disparaissent définitivement avec. Cette action est irréversible.',
      ])]),
      actions: [
        { label: 'Annuler', className: 'btn-ghost' },
        {
          label: 'Supprimer', className: 'btn-primary', closeOnClick: false,
          onClick: async (btn) => {
            btn.disabled = true; btn.textContent = 'Suppression...';
            const res = await window.D1P.services.managerService.removeManager(manager.id);
            if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); btn.disabled = false; btn.textContent = 'Supprimer'; return; }
            window.D1P.components.toast.show(manager.name + ' a été retiré du jeu ✅', 'success');
            window.D1P.components.modal.close();
            rerender();
          },
        },
      ],
    });
  }

  function buildManagersSection(root, rerender) {
    const activeManager = window.D1P.services.managerService.getActiveManager();
    const managers = window.D1P.services.managerService.listManagers();
    const withName = managers.filter((m) => window.D1P.services.managerService.fullName(window.D1P.services.managerService.getProfile(m.id))).length;
    root.appendChild(el('div', { className: 'section-title' }, ['👥 Managers (' + managers.length + ')']));
    const list = el('div', { className: 'card' }, [
      el('p', { className: 'muted small', style: { marginBottom: '6px' } }, [withName + ' sur ' + managers.length + ' ont renseigné leur nom (via "Mon profil", en haut à droite).']),
    ]);
    managers.forEach((m) => {
      const isSelf = m.id === activeManager.id;
      const profile = window.D1P.services.managerService.getProfile(m.id);
      const details = [window.D1P.services.managerService.fullName(profile), profile.supportedClub].filter(Boolean).join(' · ');
      list.appendChild(el('div', { className: 'boost-row' }, [
        el('div', {}, [
          el('div', { className: 'boost-label' }, [m.name]),
          details ? el('div', { className: 'muted small' }, [details]) : null,
        ]),
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
          isSelf ? null : el('button', {
            className: 'btn btn-sm btn-ghost',
            onClick: () => confirmRemoveManager(m, rerender),
          }, ['Supprimer']),
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

    // Classement final réel + tableau des playoffs réel — à remplir seulement en toute fin de saison, pour comparer aux pronostics de chacun.
    const S = window.D1P.services.seasonPredictionService;
    const teams = window.D1P.services.seasonService.listTeams();
    const state = window.D1P.services.stateService.getState();
    const order = (state.seasonActualOrder && state.seasonActualOrder.length === teams.length ? state.seasonActualOrder : teams.map((t) => t.id)).slice();
    let actualBracket = S.sanitizeBracket(order, state.seasonActualBracket || S.emptyBracket());

    const list = el('div', { className: 'card' });
    function move(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      actualBracket = S.sanitizeBracket(order, actualBracket);
      rerenderList();
      rerenderBracket();
    }
    function rerenderList() {
      list.innerHTML = '';
      order.forEach((teamId, i) => {
        const bg = rankBg(i + 1);
        list.appendChild(el('div', { className: 'boost-row', style: bg ? { background: bg, borderRadius: '8px', margin: '2px 0', padding: '8px' } : {} }, [
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } }, [teamChip(teamId), (i + 1) + '. ' + teamLabel(teamId)]),
          el('div', { style: { display: 'flex', gap: '4px' } }, [
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === 0, onClick: () => move(i, -1) }, ['▲']),
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === order.length - 1, onClick: () => move(i, 1) }, ['▼']),
          ]),
        ]));
      });
    }

    const bracketWrap = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' } });
    function rerenderBracket() {
      bracketWrap.innerHTML = '';
      const m = S.bracketMatchups(order, actualBracket);
      const rounds = [
        ['qf1', 'Quart 1 (3e vs 6e)'], ['qf2', 'Quart 2 (4e vs 5e)'],
        ['sf1', 'Demi 1'], ['sf2', 'Demi 2'], ['final', 'Finale'],
      ];
      rounds.forEach(([key, label]) => {
        const matchup = m[key];
        const winnerKey = key + 'Winner';
        const ready = matchup.home && matchup.away;
        bracketWrap.appendChild(el('div', { className: 'card', style: { padding: '10px', opacity: ready ? '1' : '.5' } }, [
          el('div', { className: 'muted small', style: { marginBottom: '6px', fontWeight: '750', fontSize: '10px', textTransform: 'uppercase' } }, [label]),
          el('div', { className: 'single-picker' }, ['home', 'away'].map((side) => {
            const teamId = matchup[side];
            const isWinner = teamId && actualBracket[winnerKey] === teamId;
            return el('div', {
              className: 'pick-item' + (isWinner ? ' active' : ''),
              style: { opacity: teamId ? '1' : '.5', cursor: ready ? 'pointer' : 'default' },
              onClick: !ready ? null : () => {
                actualBracket[winnerKey] = actualBracket[winnerKey] === teamId ? null : teamId;
                actualBracket = S.sanitizeBracket(order, actualBracket);
                rerenderBracket();
              },
            }, [teamChip(teamId), ' ', teamId ? teamLabel(teamId) : 'En attente...']);
          })),
        ]));
      });
    }
    rerenderList();
    rerenderBracket();

    root.appendChild(el('div', { className: 'section-title' }, ['🏁 Classement final réel (à remplir en fin de saison)']));
    root.appendChild(list);
    root.appendChild(el('div', { className: 'section-title' }, ['Tableau des playoffs réel']));
    root.appendChild(bracketWrap);
    root.appendChild(el('button', {
      className: 'btn btn-primary btn-block', style: { margin: '10px 0 20px' },
      onClick: async (e) => {
        const btn = e.target;
        btn.disabled = true; btn.textContent = 'Enregistrement...';
        const res = await S.setFinalResult(order, actualBracket);
        btn.disabled = false; btn.textContent = 'Enregistrer le classement final réel';
        if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
        window.D1P.components.toast.show('Classement final enregistré — les pronostics de saison sont maintenant comparés ✅', 'success');
        rerender();
      },
    }, ['Enregistrer le classement final réel']));

    // Verrouillage individuel — un manager qui a validé définitivement peut être débloqué ici s'il a fait une erreur.
    root.appendChild(el('div', { className: 'section-title' }, ['🔐 Pronostics individuels']));
    const predictions = S.listSeasonPredictions();
    const managers = window.D1P.services.managerService.listManagers();
    const predList = el('div', { className: 'card' });
    managers.forEach((mgr) => {
      const prediction = predictions.find((p) => p.managerId === mgr.id);
      let statusBadge;
      if (!prediction) statusBadge = el('span', { className: 'badge' }, ['Pas encore pronostiqué']);
      else if (prediction.locked) statusBadge = el('span', { className: 'badge badge-green' }, ['🔒 Validé']);
      else statusBadge = el('span', { className: 'badge' }, ['Brouillon']);

      predList.appendChild(el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, [mgr.name]),
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
          statusBadge,
          (prediction && prediction.locked) ? el('button', {
            className: 'btn btn-sm btn-ghost',
            onClick: async () => {
              const res = await S.unlockPrediction(mgr.id);
              if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
              window.D1P.components.toast.show('Pronostic déverrouillé — ' + mgr.name + ' peut à nouveau le modifier ✅', 'success');
              rerender();
            },
          }, ['🔓 Débloquer']) : null,
        ]),
      ]));
    });
    root.appendChild(predList);
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Administration']),
      el('p', {}, ['Équipes, calendrier, résultats officiels, managers et saison.']),
    ]));

    // Ordre par fréquence d'usage réelle : le calendrier (ouvrir/verrouiller
    // les journées) se touche chaque semaine, managers/saison occasionnellement,
    // équipes/logos quasi jamais une fois la saison lancée — donc tout en bas.
    function rerender() { render(root); }
    buildCalendarSection(root, rerender);
    buildManagersSection(root, rerender);
    buildSeasonSection(root, rerender);
    buildTeamsSection(root, rerender);
  }

  window.D1P.pages.admin = { render };
})();
