/**
 * D1 Pronos — Page "Ma saison" (pronostic de saison complète)
 *
 * Un seul pronostic par manager, avant le début de la saison régulière :
 * classement final des 10 équipes + qui remporte le titre (playoffs
 * compris — voir data/config.js pour le format exact). Verrouillé par
 * l'admin une fois la saison lancée (Administration).
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;

  function teamLabel(teamId) {
    const team = window.D1P.services.seasonService.getTeam(teamId);
    return team ? team.name : '—';
  }

  function teamBadge(teamId, size) {
    const wrap = el('span', {});
    wrap.innerHTML = window.D1P.utils.avatar.renderAvatar(teamLabel(teamId), null, size || 28);
    return wrap;
  }

  /** Liste réordonnable par flèches ▲▼ — plus fiable que le drag-and-drop natif, y compris au tactile. */
  function buildReorderList(order, onChange) {
    const list = el('div', { className: 'card' });
    function move(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      onChange();
      rerender();
    }
    function rerender() {
      list.innerHTML = '';
      order.forEach((teamId, i) => {
        list.appendChild(el('div', { className: 'boost-row' }, [
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
            el('div', { className: 'rank-badge' + (i === 0 ? ' r1' : i === 1 ? ' r2' : i === 2 ? ' r3' : '') }, [String(i + 1)]),
            teamBadge(teamId),
            el('span', { style: { fontWeight: '700' } }, [teamLabel(teamId)]),
          ]),
          el('div', { style: { display: 'flex', gap: '4px' } }, [
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === 0, onClick: () => move(i, -1) }, ['▲']),
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === order.length - 1, onClick: () => move(i, 1) }, ['▼']),
          ]),
        ]));
      });
    }
    rerender();
    return list;
  }

  function buildEditableForm(root) {
    const teams = window.D1P.services.seasonService.listTeams();
    const existing = window.D1P.services.seasonPredictionService.getSeasonPrediction(
      window.D1P.services.managerService.getActiveManager().id
    );
    const order = existing && existing.predictedOrder.length === teams.length
      ? existing.predictedOrder.slice()
      : teams.map((t) => t.id);
    let champion = (existing && existing.predictedChampion) || order[0];

    const championSelect = el('select', {}, teams.map((t) => el('option', { value: t.id }, [t.name])));
    championSelect.value = champion;
    championSelect.addEventListener('change', (e) => { champion = e.target.value; });

    const reorderList = buildReorderList(order, () => {});

    root.appendChild(el('div', { className: 'card', style: { marginBottom: '16px' } }, [
      el('p', { className: 'small' }, [
        'Classe les 10 équipes du 1er au 10e (les 2 premiers sont exemptés et vont direct en demi-finale ; les 3e à 6e jouent les quarts ; les 4 derniers jouent les play-downs, avec descente pour le 10e et barrage pour le 9e). Choisis aussi qui remporte le titre — ça peut être n\'importe laquelle des 6 équipes de playoffs, pas forcément ta 1ère place.',
      ]),
    ]));
    root.appendChild(el('div', { className: 'section-title' }, ['Classement final pronostiqué']));
    root.appendChild(reorderList);
    root.appendChild(el('div', { className: 'card', style: { margin: '16px 0' } }, [
      el('div', { className: 'field' }, [el('label', {}, ['🏆 Qui remporte le titre ?']), championSelect]),
    ]));
    root.appendChild(el('button', {
      className: 'btn btn-primary btn-block',
      onClick: async (e) => {
        const btn = e.target;
        btn.disabled = true; btn.textContent = 'Enregistrement...';
        const res = await window.D1P.services.seasonPredictionService.saveSeasonPrediction(order, champion);
        btn.disabled = false; btn.textContent = existing ? 'Mettre à jour mon pronostic de saison' : 'Valider mon pronostic de saison';
        if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
        window.D1P.components.toast.show('Pronostic de saison enregistré ✅', 'success');
        render(root);
      },
    }, [existing ? 'Mettre à jour mon pronostic de saison' : 'Valider mon pronostic de saison']));
  }

  function buildLockedView(root) {
    const manager = window.D1P.services.managerService.getActiveManager();
    const prediction = window.D1P.services.seasonPredictionService.getSeasonPrediction(manager.id);
    const state = window.D1P.services.stateService.getState();
    const score = prediction ? window.D1P.services.seasonPredictionService.scoreSeasonPrediction(prediction, state.seasonActualOrder, state.seasonActualChampion) : null;

    if (!prediction) {
      root.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'ic' }, ['😅']),
        el('div', {}, ['La saison a commencé et tu n\'avais pas fait de pronostic — ce sera pour la saison prochaine !']),
      ]));
      return;
    }

    root.appendChild(el('div', { className: 'card', style: { marginBottom: '16px' } }, [
      el('p', { className: 'small' }, ['Pronostics fermés — la saison a commencé. Voici ce que tu avais prédit.']),
      score ? el('div', { className: 'badge badge-green', style: { marginTop: '8px' } }, [
        `${score.exactRanks}/${score.totalTeams} équipes à la bonne place · champion ${score.championCorrect ? 'deviné ✅' : 'raté ❌'}`,
      ]) : null,
    ]));
    root.appendChild(el('div', { className: 'section-title' }, ['🏆 Champion pronostiqué : ' + teamLabel(prediction.predictedChampion)]));
    root.appendChild(el('div', { className: 'section-title' }, ['Classement pronostiqué']));
    const list = el('div', { className: 'card' });
    prediction.predictedOrder.forEach((teamId, i) => {
      const actualRank = state.seasonActualOrder ? state.seasonActualOrder.indexOf(teamId) + 1 : null;
      const exact = actualRank === i + 1;
      list.appendChild(el('div', { className: 'boost-row' }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
          el('div', { className: 'rank-badge' + (i === 0 ? ' r1' : i === 1 ? ' r2' : i === 2 ? ' r3' : '') }, [String(i + 1)]),
          teamBadge(teamId), el('span', { style: { fontWeight: '700' } }, [teamLabel(teamId)]),
        ]),
        actualRank ? el('span', { className: 'badge ' + (exact ? 'badge-green' : 'badge') }, [exact ? '✅ pile' : 'réel : ' + actualRank + 'e']) : null,
      ]));
    });
    root.appendChild(list);
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['🔮 Ma saison']),
      el('p', {}, ['Un seul pronostic, avant le coup d\'envoi — le classement final complet et le futur champion.']),
    ]));

    if (window.D1P.services.seasonPredictionService.isSeasonLocked()) buildLockedView(root);
    else buildEditableForm(root);
  }

  window.D1P.pages.season = { render };
})();
