/**
 * D1 Pronos — Page Pronostics (journée par journée)
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;
  let currentMatchday = null; // numéro affiché ; null = pas encore initialisé

  /** Permet à une autre page (ex: Accueil) de forcer la journée affichée avant de naviguer ici — sinon currentMatchday reste sur la dernière journée parcourue. */
  function goTo(matchday) {
    currentMatchday = matchday;
  }

  function teamLabel(teamId) {
    const team = window.D1P.services.seasonService.getTeam(teamId);
    return team ? team.name : '—';
  }

  function teamBadge(teamId, size) {
    const team = window.D1P.services.seasonService.getTeam(teamId);
    const wrap = el('span', {});
    wrap.innerHTML = window.D1P.utils.avatar.renderAvatar(team ? team.name : '—', team && team.logoUrl, size || 28, { square: true });
    return wrap;
  }

  function buildNav(matches) {
    const maxMatchday = matches.reduce((max, m) => Math.max(max, m.matchday), 1);
    return el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' } }, [
      el('button', { className: 'btn btn-sm', disabled: currentMatchday <= 1, onClick: () => { currentMatchday -= 1; render(document.getElementById('page-root')); } }, ['← Journée précédente']),
      el('div', { className: 'muted small' }, [`Journée ${currentMatchday} / ${maxMatchday}`]),
      el('button', { className: 'btn btn-sm', disabled: currentMatchday >= maxMatchday, onClick: () => { currentMatchday += 1; render(document.getElementById('page-root')); } }, ['Journée suivante →']),
    ]);
  }

  // ── Un match "ouvert" : formulaire de pronostic (vainqueur + bonus) ─────
  function buildOpenMatchCard(match, manager, formState) {
    const existing = window.D1P.services.predictionService.getPrediction(match.id, manager.id);
    if (formState.winner === undefined) {
      formState.winner = existing.winner;
      formState.bonusHome = existing.bonusHome;
      formState.bonusAway = existing.bonusAway;
      formState.closeMargin = existing.closeMargin;
    }

    const preview = el('div', { className: 'muted small', style: { marginTop: '6px' } });
    function refreshPreview() {
      if (!formState.winner) { preview.textContent = ''; return; }
      const points = window.D1P.services.scoringService.computePoints({
        winner: formState.winner, bonusHome: formState.bonusHome, bonusAway: formState.bonusAway, closeMargin: formState.closeMargin,
      });
      preview.textContent = `Points prévus au classement : ${teamLabel(match.homeTeamId)} ${points.home} · ${teamLabel(match.awayTeamId)} ${points.away}`;
    }

    function winnerOption(value, label) {
      return el('div', {
        className: 'pick-item' + (formState.winner === value ? ' active' : ''),
        onClick: () => {
          formState.winner = value;
          if (value === 'draw') formState.closeMargin = false;
          rerenderCard();
        },
      }, [label]);
    }

    const card = el('div', { className: 'card', style: { marginBottom: '12px' } });
    function rerenderCard() {
      card.innerHTML = '';
      card.appendChild(el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '750' } }, [teamBadge(match.homeTeamId), teamLabel(match.homeTeamId), el('span', { className: 'muted' }, ['vs']), teamLabel(match.awayTeamId), teamBadge(match.awayTeamId)]),
        el('div', { className: 'muted small' }, [window.D1P.utils.format.formatDateFr(match.date, { short: true })]),
      ]));
      card.appendChild(el('div', { className: 'single-picker' }, [
        winnerOption('home', teamLabel(match.homeTeamId)),
        winnerOption('draw', 'Match nul'),
        winnerOption('away', teamLabel(match.awayTeamId)),
      ]));
      card.appendChild(el('div', { style: { display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '10px' } }, [
        el('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' } }, [
          el('input', { type: 'checkbox', checked: formState.bonusHome, onChange: (e) => { formState.bonusHome = e.target.checked; refreshPreview(); } }),
          teamLabel(match.homeTeamId) + ' marque 4 essais ou plus',
        ]),
        el('label', { style: { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' } }, [
          el('input', { type: 'checkbox', checked: formState.bonusAway, onChange: (e) => { formState.bonusAway = e.target.checked; refreshPreview(); } }),
          teamLabel(match.awayTeamId) + ' marque 4 essais ou plus',
        ]),
      ]));
      const closeMarginRow = closeMarginRowFor();
      if (closeMarginRow) card.appendChild(closeMarginRow);
      card.appendChild(preview);
      refreshPreview();
    }
    /**
     * Le bonus défensif n'existe que s'il y a un perdant (jamais sur un
     * match nul, voir formState.winner === 'draw' plus haut) — c'est
     * justement le seul cas où le cumul avec le bonus offensif est possible,
     * donc le petit ⓘ qui explique la règle vit ici : il disparaît de
     * lui-même sur un nul, pas besoin de condition séparée.
     */
    function closeMarginRowFor() {
      if (!formState.winner || formState.winner === 'draw') return null;
      const row = el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' } }, [
        el('label', { className: 'field-hint', style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 } }, [
          el('input', { type: 'checkbox', checked: formState.closeMargin, onChange: (e) => { formState.closeMargin = e.target.checked; refreshPreview(); } }),
          'Écart serré (7 points ou moins) — bonus défensif pour ' + teamLabel(formState.winner === 'home' ? match.awayTeamId : match.homeTeamId),
        ]),
        el('span', {
          className: 'muted', title: 'Une équipe ne cumule jamais bonus offensif et bonus défensif sur un même match (règle belge) — max +1 point de bonus, même si les deux sont cochés.',
          style: { cursor: 'pointer', fontSize: '13px', flexShrink: '0' },
          onClick: () => { formState.showBonusInfo = !formState.showBonusInfo; rerenderCard(); },
        }, ['ⓘ']),
      ]);
      const wrap = el('div', {}, [row]);
      if (formState.showBonusInfo) {
        wrap.appendChild(el('div', { className: 'field-hint', style: { marginTop: '4px' } }, [
          '⚠️ Une équipe ne cumule jamais bonus offensif et bonus défensif sur un même match (règle belge) — max +1 point de bonus, même si les deux sont cochés.',
        ]));
      }
      return wrap;
    }
    rerenderCard();
    return card;
  }

  // ── Un match verrouillé/terminé : lecture seule (mon pronostic + le résultat si connu) ─
  function buildReadOnlyMatchCard(match, manager) {
    const prediction = window.D1P.services.predictionService.getPrediction(match.id, manager.id);
    const hasPrediction = prediction.winner !== null;
    const graded = match.status === 'termine' && match.result;

    const rows = [];
    rows.push(el('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' } }, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '750' } }, [teamBadge(match.homeTeamId), teamLabel(match.homeTeamId), el('span', { className: 'muted' }, ['vs']), teamLabel(match.awayTeamId), teamBadge(match.awayTeamId)]),
      graded
        ? el('div', { style: { fontWeight: '800' } }, [match.result.winner === 'draw' ? 'Match nul' : 'Victoire ' + teamLabel(match.result.winner === 'home' ? match.homeTeamId : match.awayTeamId)])
        : el('div', { className: 'muted small' }, [window.D1P.utils.format.formatDateFr(match.date, { short: true }), window.D1P.services.seasonService.isMatchOpen(match) ? '' : ' · 🔒']),
    ]));

    if (!hasPrediction) {
      rows.push(el('div', { className: 'muted small' }, ['Tu n\'avais pas pronostiqué ce match.']));
    } else {
      const predictedPoints = window.D1P.services.scoringService.computePoints(prediction);
      rows.push(el('div', { className: 'boost-row' }, [
        el('div', { className: 'boost-label' }, ['Ton pronostic']),
        el('div', {}, [prediction.winner === 'draw' ? 'Match nul' : 'Victoire ' + teamLabel(prediction.winner === 'home' ? match.homeTeamId : match.awayTeamId)]),
      ]));
      rows.push(el('div', { className: 'muted small' }, [
        `Points prévus : ${teamLabel(match.homeTeamId)} ${predictedPoints.home} · ${teamLabel(match.awayTeamId)} ${predictedPoints.away}`,
      ]));
      if (graded) {
        const exact = window.D1P.services.scoringService.isPredictionExact(prediction, match.result);
        const winnerCorrect = window.D1P.services.scoringService.isPredictionCorrect(prediction, match.result);
        const actualPoints = window.D1P.services.scoringService.computePoints(match.result);
        // "Qui devine le mieux" ne compte que l'exact (vainqueur + bonus) — un vainqueur juste avec un bonus raté ne rapporte rien, d'où le badge intermédiaire plutôt qu'un simple bon/mauvais.
        const badgeClass = exact ? 'badge-green' : winnerCorrect ? 'badge-yellow' : 'badge-red';
        const badgeText = exact ? '✅ Pronostic exact (vainqueur + bonus)' : winnerCorrect ? '🟡 Bon vainqueur, mais bonus raté' : '❌ Mauvais vainqueur';
        rows.push(el('div', { className: 'badge ' + badgeClass, style: { marginTop: '8px' } }, [badgeText]));
        rows.push(el('div', { className: 'muted small', style: { marginTop: '4px' } }, [
          `Points réels : ${teamLabel(match.homeTeamId)} ${actualPoints.home} · ${teamLabel(match.awayTeamId)} ${actualPoints.away}`,
        ]));
      }
    }

    // Une fois la journée fermée, on peut voir ce que les autres ont mis (RLS l'autorise).
    if (match.status !== 'ouvert') {
      const others = window.D1P.services.predictionService.predictionsForMatch(match.id);
      const managers = window.D1P.services.managerService.listManagers();
      const list = managers
        .map((m) => ({ m, p: others[m.id] }))
        .filter(({ p }) => p && p.winner !== null);
      if (list.length) {
        rows.push(el('div', { className: 'muted small', style: { marginTop: '12px', marginBottom: '4px' } }, ['Pronostics du groupe']));
        list.forEach(({ m, p }) => {
          const label = p.winner === 'draw' ? 'Nul' : teamLabel(p.winner === 'home' ? match.homeTeamId : match.awayTeamId);
          const exact = graded ? window.D1P.services.scoringService.isPredictionExact(p, match.result) : null;
          rows.push(el('div', { className: 'boost-row' }, [
            el('div', { className: 'boost-label' }, [m.name]),
            el('div', {}, [exact === null ? label : (exact ? '✅ ' : '❌ ') + label]),
          ]));
        });
      }
    }

    return el('div', { className: 'card', style: { marginBottom: '12px' } }, rows);
  }

  function render(root) {
    const manager = window.D1P.services.managerService.getActiveManager();
    const allMatches = window.D1P.services.seasonService.listMatches();

    if (currentMatchday === null) currentMatchday = window.D1P.services.seasonService.currentMatchday();
    const maxMatchday = allMatches.reduce((max, m) => Math.max(max, m.matchday), 1);
    currentMatchday = window.D1P.utils.format.clamp(currentMatchday, 1, maxMatchday);
    const matches = window.D1P.services.seasonService.matchesForMatchday(currentMatchday);

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Pronostics']),
      el('p', {}, ['Pour chaque match : qui gagne (ou match nul), et les bonus offensif/défensif — exactement comme au vrai classement.']),
    ]));
    root.appendChild(buildNav(allMatches));

    if (!matches.length) {
      root.appendChild(el('div', { className: 'empty-state' }, [el('div', { className: 'ic' }, ['📅']), el('div', {}, ['Aucun match programmé pour cette journée.'])]));
      return;
    }

    const isOpen = window.D1P.services.seasonService.isMatchOpen(matches[0]);
    if (isOpen) {
      const formStates = matches.map(() => ({}));
      const cards = matches.map((m, i) => buildOpenMatchCard(m, manager, formStates[i]));
      cards.forEach((c) => root.appendChild(c));
      root.appendChild(el('button', {
        className: 'btn btn-primary btn-block', style: { marginTop: '8px' },
        onClick: async (e) => {
          const btn = e.target;
          const toSave = matches.map((m, i) => ({ match: m, data: formStates[i] })).filter(({ data }) => data.winner);
          if (!toSave.length) { window.D1P.components.toast.show('Choisis au moins un vainqueur avant d\'enregistrer.', 'error'); return; }
          btn.disabled = true; btn.textContent = 'Enregistrement...';
          let allOk = true;
          for (const { match, data } of toSave) {
            const res = window.D1P.services.predictionService.savePrediction(match.id, data);
            if (!res.ok) { allOk = false; window.D1P.components.toast.show(res.reason, 'error'); }
          }
          btn.disabled = false; btn.textContent = 'Enregistrer mes pronostics';
          if (allOk) { window.D1P.components.toast.show('Pronostics enregistrés ✅', 'success'); render(root); }
        },
      }, ['Enregistrer mes pronostics']));
    } else {
      const graded = matches.filter((m) => m.status === 'termine' && m.result);
      if (graded.length) {
        const exactCount = graded.filter((m) => window.D1P.services.scoringService.isPredictionExact(
          window.D1P.services.predictionService.getPrediction(m.id, manager.id), m.result
        )).length;
        root.appendChild(el('div', { className: 'badge badge-green', style: { marginBottom: '12px' } }, [`${exactCount}/${graded.length} pronostics exacts cette journée`]));
      }
      matches.forEach((m) => root.appendChild(buildReadOnlyMatchCard(m, manager)));
    }
  }

  window.D1P.pages.matchday = { render, goTo };
})();
