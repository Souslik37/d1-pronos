/**
 * D1 Pronos — Profil des managers (prénom, nom, club supporté)
 *
 * buildFields() : les trois champs, partagés entre l'inscription et
 * "Mon profil" (obligatoires dans les deux — voir
 * managerService.validateProfile).
 * openEditor() : le formulaire "Mon profil", ouvert depuis le haut à droite.
 * openCard(managerId) : la fiche d'un manager — son profil et ses pronostics
 * dévoilés, journée par journée, avec le verdict de chacun — ouverte en
 * cliquant son pseudo dans le classement. Visible des comptes connectés
 * seulement, jamais du public (voir supabase/schema.sql profiles_*) — et
 * les formulaires le disent clairement avant d'enregistrer.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.components = window.D1P.components || {};

  const { el } = window.D1P.utils.dom;
  const OTHER = '__other__';
  // Enregistré tel quel (et affiché tel quel sur la fiche) : une réponse valable pour qui ne supporte aucun club.
  const NO_CLUB = 'Aucun club';

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
   * Les champs prénom / nom / club. `teamNames` : les clubs de D1 proposés
   * (à l'inscription on n'est pas encore connecté, donc la liste vient de
   * data/teams.js ; dans "Mon profil" elle vient de la base). Renvoie les
   * nœuds à insérer et read() pour récupérer ce qui est saisi.
   */
  function buildFields(profile, teamNames) {
    const current = (profile.supportedClub || '').trim();
    const matched = teamNames.find((n) => n.trim().toLowerCase() === current.toLowerCase());
    const initialChoice = matched || (current === NO_CLUB ? NO_CLUB : current ? OTHER : '');

    const firstName = el('input', { type: 'text', maxlength: '60', placeholder: 'Ton prénom', autocomplete: 'given-name', value: profile.firstName || '' });
    const lastName = el('input', { type: 'text', maxlength: '80', placeholder: 'Ton nom', autocomplete: 'family-name', value: profile.lastName || '' });
    const otherClub = el('input', { type: 'text', maxlength: '80', placeholder: 'Nom du club', value: initialChoice === OTHER ? current : '' });
    const otherField = el('div', { className: 'field', style: { display: initialChoice === OTHER ? '' : 'none' } }, [
      el('label', {}, ['Quel club ?']), otherClub,
    ]);
    const clubSelect = el('select', {
      onChange: () => { otherField.style.display = clubSelect.value === OTHER ? '' : 'none'; },
    }, [
      el('option', { value: '' }, ['— Choisis ton club —']),
      ...teamNames.map((n) => el('option', { value: n }, [n])),
      el('option', { value: OTHER }, ['Autre club…']),
      el('option', { value: NO_CLUB }, ['Aucun club en particulier']),
    ]);
    clubSelect.value = initialChoice;

    return {
      nodes: [
        el('div', { className: 'field' }, [el('label', {}, ['Prénom']), firstName]),
        el('div', { className: 'field' }, [el('label', {}, ['Nom']), lastName]),
        el('div', { className: 'field' }, [el('label', {}, ['Club que tu supportes']), clubSelect]),
        otherField,
        el('p', { className: 'field-hint' }, [
          'Obligatoire. Ces infos sont visibles par les autres joueurs connectés (en cliquant sur ton pseudo dans le classement) et par l\'admin.',
        ]),
      ],
      read: () => ({
        firstName: firstName.value,
        lastName: lastName.value,
        supportedClub: clubSelect.value === OTHER ? otherClub.value : clubSelect.value,
      }),
    };
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
    const fields = buildFields(svc().managerService.getProfile(manager.id), svc().seasonService.listTeams().map((t) => t.name));

    const body = el('div', {}, [
      el('p', { className: 'field-hint', style: { marginBottom: '14px' } }, [
        'Pseudo : ' + manager.name + ' — c\'est avec lui (et ton code) que tu te connectes, il ne change pas.',
      ]),
      ...fields.nodes,
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
            const res = await svc().managerService.saveProfile(manager.id, fields.read());
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

  function teamName(teamId) {
    const team = teamId ? svc().seasonService.getTeam(teamId) : null;
    return team ? team.name : '—';
  }

  /** "Victoire ASUB · bonus off. ASUB" — marche pour un pronostic comme pour un résultat officiel (même forme). */
  function describeOutcome(o, match) {
    const home = teamName(match.homeTeamId);
    const away = teamName(match.awayTeamId);
    const parts = [o.winner === 'draw' ? 'Match nul' : 'Victoire ' + (o.winner === 'home' ? home : away)];
    if (o.bonusHome) parts.push('bonus off. ' + home);
    if (o.bonusAway) parts.push('bonus off. ' + away);
    if (o.closeMargin && o.winner !== 'draw') parts.push('bonus déf. ' + (o.winner === 'home' ? away : home));
    return parts.join(' · ');
  }

  function predictionRow(match, prediction) {
    const scoring = svc().scoringService;
    const graded = match.status === 'termine' && match.result;
    const exact = graded && scoring.isPredictionExact(prediction, match.result);
    const winnerOk = graded && scoring.isPredictionCorrect(prediction, match.result);
    return el('div', { className: 'boost-row', style: { alignItems: 'flex-start' } }, [
      el('div', {}, [
        el('div', { style: { fontWeight: '650' } }, [teamName(match.homeTeamId) + ' – ' + teamName(match.awayTeamId)]),
        el('div', { className: 'muted small' }, [describeOutcome(prediction, match)]),
        graded && !exact ? el('div', { className: 'muted small' }, ['Réel : ' + describeOutcome(match.result, match)]) : null,
      ]),
      el('div', { style: { fontSize: '18px' } }, [graded ? (exact ? '✅' : winnerOk ? '🟡' : '❌') : '']),
    ]);
  }

  /**
   * Les pronostics d'un manager, journée par journée, du plus récent au plus
   * ancien. Un pronostic n'apparaît qu'une fois son match plus "ouvert"
   * (verrouillé, noté, ou coup d'envoi passé — voir seasonService.isMatchOpen)
   * : on ne dévoile jamais ce que quelqu'un a mis tant qu'on peut encore le
   * copier. Seulement les journées qui comptent au classement (J3 et après).
   */
  function buildPredictionHistory(managerId) {
    const S = svc();
    const viewer = S.managerService.getActiveManager();
    const state = S.stateService.getState();
    const start = window.D1P.data.CONFIG.season.leaderboardFromMatchday;
    const getPrediction = (matchId) => S.predictionService.getPrediction(matchId, managerId);

    const counted = S.seasonService.listCountedMatches();
    const stats = S.scoringService.computeGuesserStats(counted, getPrediction);
    const byDay = {};
    const hiddenDays = new Set();
    S.seasonService.listMatches().forEach((match) => {
      if (match.matchday < start || !match.homeTeamId || !match.awayTeamId) return;
      if (S.seasonService.isMatchOpen(match)) return;
      const prediction = getPrediction(match.id);
      if (prediction.winner !== null) {
        (byDay[match.matchday] = byDay[match.matchday] || []).push({ match, prediction });
        return;
      }
      // Pas de pronostic en mémoire : il n'en a pas fait, OU la base ne nous le montre pas encore. RLS dévoile un match dès que son statut stocké n'est plus 'ouvert' ou que son coup d'envoi est passé (schema.sql, predictions_select_locked_matches), mais l'état n'est chargé qu'une fois au démarrage : quelqu'un connecté avant le coup d'envoi ne les a pas reçus. On ne peut l'affirmer que si personne d'autre n'apparaît non plus.
      const othersVisible = Object.keys(state.predictions[match.id] || {}).some((id) => id !== viewer.id);
      if (match.status === 'ouvert' && viewer.role !== 'admin' && !othersVisible) hiddenDays.add(match.matchday);
    });

    const nodes = [
      el('div', { className: 'muted small', style: { margin: '18px 0 6px', fontWeight: '750', textTransform: 'uppercase', letterSpacing: '.5px' } }, ['Pronostics']),
      el('div', { style: { fontWeight: '700' } }, [
        stats.total
          ? `${stats.exact} exact${stats.exact > 1 ? 's' : ''} sur ${stats.total} (${stats.pct}%)`
          : counted.length
            ? 'Aucun pronostic sur les matchs déjà notés.'
            : `Rien de noté pour l'instant — le classement démarre à la journée ${start}.`,
      ]),
      el('div', { className: 'muted small', style: { marginBottom: '4px' } }, ['✅ exact · 🟡 bon vainqueur mais bonus raté · ❌ raté']),
    ];

    const days = Object.keys(byDay).map(Number).sort((a, b) => b - a);
    days.forEach((day) => {
      const rows = byDay[day];
      const gradedRows = rows.filter(({ match }) => match.status === 'termine' && match.result);
      const exactCount = gradedRows.filter(({ match, prediction }) => S.scoringService.isPredictionExact(prediction, match.result)).length;
      nodes.push(el('div', { className: 'muted small', style: { margin: '14px 0 2px', fontWeight: '750' } }, [
        'Journée ' + day + (gradedRows.length ? ` — ${exactCount} exact${exactCount > 1 ? 's' : ''} sur ${gradedRows.length}` : ''),
      ]));
      rows.forEach(({ match, prediction }) => nodes.push(predictionRow(match, prediction)));
    });

    if (!days.length) {
      nodes.push(el('p', { className: 'muted small', style: { marginTop: '8px' } }, ['Les pronostics d\'une journée apparaissent ici une fois la journée verrouillée ou notée.']));
    }
    if (hiddenDays.size) {
      const list = Array.from(hiddenDays).sort((a, b) => a - b).join(', ');
      nodes.push(el('p', { className: 'muted small', style: { marginTop: '10px' } }, [
        `Journée${hiddenDays.size > 1 ? 's' : ''} ${list} : les pronostics se dévoilent au coup d'envoi. Recharge la page pour les voir.`,
      ]));
    }
    return el('div', {}, nodes);
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

    rows.push(buildPredictionHistory(managerId));

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

  window.D1P.components.profile = { buildFields, openEditor, openCard, describeOutcome };
})();
