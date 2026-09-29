/**
 * D1 Pronos — Page "Ma saison" (pronostic de saison complète)
 *
 * Un seul pronostic par manager, avant le début de la saison régulière :
 * classement final des 10 équipes + tableau complet des playoffs (voir
 * seasonPredictionService.bracketMatchups pour le format exact). Peut être
 * enregistré comme brouillon à volonté, puis validé DÉFINITIVEMENT par le
 * manager lui-même — verrouille sa propre ligne (indépendamment du verrou
 * global de saison, activé par l'admin une fois la journée 1 lancée).
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;
  const ROUND_LABELS = { qf1Winner: 'Quart 1', qf2Winner: 'Quart 2', sf1Winner: 'Demi 1', sf2Winner: 'Demi 2', finalWinner: 'Finale' };

  function teamLabel(teamId) {
    const team = window.D1P.services.seasonService.getTeam(teamId);
    return team ? team.name : '—';
  }

  function teamBadge(teamId, size) {
    const team = teamId ? window.D1P.services.seasonService.getTeam(teamId) : null;
    const wrap = el('span', {});
    wrap.innerHTML = window.D1P.utils.avatar.renderAvatar(team ? team.name : '?', team && team.logoUrl, size || 28, { square: true });
    return wrap;
  }

  /** Couleur de fond selon ce que cette place du classement implique (voir data/config.js) : vert = playoffs, bleu = barrage D1-D2, rouge = descente directe, sinon neutre (maintien tranquille). */
  function rankBg(rank) {
    const S = window.D1P.data.CONFIG.season;
    if (rank <= S.playoffSpots) return 'var(--green-bg)';
    if (rank === S.barrageRank) return 'rgba(94, 158, 214, 0.15)';
    if (rank >= S.relegatedFromRank) return 'rgba(214, 94, 94, 0.13)';
    return null;
  }

  function rankHint(rank) {
    const S = window.D1P.data.CONFIG.season;
    if (rank <= 2) return 'Exempté, direct en demi';
    if (rank <= S.playoffSpots) return 'Playoffs (quart de finale)';
    if (rank === S.barrageRank) return 'Barrage contre le 1er de D2';
    if (rank >= S.relegatedFromRank) return 'Descente directe en D2';
    return 'Maintien tranquille';
  }

  /**
   * Liste réordonnable par glisser-déposer (poignée ⠿, Pointer Events — pas
   * l'API drag-and-drop native du navigateur, peu fiable au tactile) + les
   * flèches ▲▼ en secours. Pendant le glissement, seul un aperçu visuel
   * (translateY) bouge ; `order` n'est modifié qu'au relâchement, puis un
   * rerender complet remet tout au propre.
   */
  function buildReorderList(order, onChange) {
    const list = el('div', { className: 'card', style: { position: 'relative' } });

    function move(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      rerender();
      onChange();
    }

    /** Décale visuellement les autres lignes pour ouvrir un espace à l'endroit où la ligne draguée atterrirait si on lâchait maintenant. */
    function previewShift(fromIndex, targetIndex, draggedRow, rowHeight) {
      Array.from(list.children).forEach((r, idx) => {
        if (r === draggedRow) return;
        let shift = 0;
        if (fromIndex < targetIndex && idx > fromIndex && idx <= targetIndex) shift = -1;
        else if (fromIndex > targetIndex && idx < fromIndex && idx >= targetIndex) shift = 1;
        r.style.transition = 'transform .12s ease';
        r.style.transform = shift ? `translateY(${shift * rowHeight}px)` : '';
      });
    }

    function attachDrag(row, handle, getIndex) {
      let dragging = false;
      let startY = 0;
      let rowHeight = 0;
      let fromIndex = 0;

      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dragging = true;
        fromIndex = getIndex();
        startY = e.clientY;
        rowHeight = row.offsetHeight;
        try { handle.setPointerCapture(e.pointerId); } catch (err) { /* pas bloquant — le reorder marche même sans capture */ }
        row.style.position = 'relative';
        row.style.zIndex = '10';
        row.style.boxShadow = '0 6px 16px rgba(35,30,15,.18)';
      });

      handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const deltaY = e.clientY - startY;
        row.style.transform = `translateY(${deltaY}px)`;
        const shift = Math.round(deltaY / rowHeight);
        const targetIndex = Math.max(0, Math.min(order.length - 1, fromIndex + shift));
        previewShift(fromIndex, targetIndex, row, rowHeight);
      });

      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch (err) { /* idem */ }
        const deltaY = e.clientY - startY;
        const shift = Math.round(deltaY / rowHeight);
        const targetIndex = Math.max(0, Math.min(order.length - 1, fromIndex + shift));
        if (targetIndex !== fromIndex) {
          const [teamId] = order.splice(fromIndex, 1);
          order.splice(targetIndex, 0, teamId);
          onChange();
        }
        rerender();
      }
      handle.addEventListener('pointerup', endDrag);
      handle.addEventListener('pointercancel', endDrag);
    }

    function rerender() {
      list.innerHTML = '';
      order.forEach((teamId, i) => {
        const rank = i + 1;
        const bg = rankBg(rank);
        const handle = el('span', {
          style: {
            cursor: 'grab', fontSize: '18px', color: 'var(--text-3)', touchAction: 'none',
            padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, ['⠿']);
        const row = el('div', {
          className: 'boost-row', style: bg ? { background: bg, borderRadius: '8px', margin: '2px 0', padding: '10px 8px' } : {},
        }, [
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [
            handle,
            el('div', { className: 'rank-badge' + (rank === 1 ? ' r1' : rank === 2 ? ' r2' : rank === 3 ? ' r3' : '') }, [String(rank)]),
            teamBadge(teamId),
            el('div', {}, [
              el('div', { style: { fontWeight: '700' } }, [teamLabel(teamId)]),
              el('div', { className: 'muted small' }, [rankHint(rank)]),
            ]),
          ]),
          el('div', { style: { display: 'flex', gap: '4px' } }, [
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === 0, onClick: () => move(i, -1) }, ['▲']),
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === order.length - 1, onClick: () => move(i, 1) }, ['▼']),
          ]),
        ]);
        attachDrag(row, handle, () => Array.from(list.children).indexOf(row));
        list.appendChild(row);
      });
    }
    rerender();
    list.__rerender = rerender; // ré-exposé pour que le parent puisse forcer un refresh après un changement de bracket qui ne vient pas d'ici
    return list;
  }

  /**
   * Les 5 cartes du tableau de phase finale — chacune cliquable pour choisir
   * un vainqueur UNE FOIS que ses deux participants sont connus (sinon
   * affichée grisée avec "?", voir seasonPredictionService.bracketMatchups).
   */
  function buildBracket(order, bracket, onPick, readOnly) {
    const S = window.D1P.services.seasonPredictionService;
    const wrap = el('div', {});
    // `order`/`bracket` sont pris en paramètres à CHAQUE appel de rerender (pas
    // capturés une fois pour toutes à la construction) — sinon, dès que
    // l'appelant réaffecte sa variable `bracket` (sanitizeBracket renvoie un
    // NOUVEL objet, il ne mute pas l'existant), ce rerender continuerait de
    // lire l'ancienne référence figée et l'affichage resterait bloqué après
    // le tout premier clic.
    function rerender(currentOrder, currentBracket) {
      wrap.innerHTML = '';
      const m = S.bracketMatchups(currentOrder, currentBracket);
      const rows = [
        ['qf1', 'Quart 1 (3e vs 6e)'], ['qf2', 'Quart 2 (4e vs 5e)'],
        ['sf1', 'Demi 1 (1er vs vainqueur Q2)'], ['sf2', 'Demi 2 (2e vs vainqueur Q1)'],
        ['final', 'Finale'],
      ];
      const grid = el('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '10px' } });
      rows.forEach(([key, label]) => {
        const matchup = m[key];
        const winnerKey = key + 'Winner';
        const ready = matchup.home && matchup.away;
        const card = el('div', { className: 'card', style: { padding: '12px', opacity: ready ? '1' : '.55' } }, [
          el('div', { className: 'muted small', style: { marginBottom: '8px', fontWeight: '750', textTransform: 'uppercase', fontSize: '10px' } }, [label]),
          el('div', { className: 'single-picker' }, ['home', 'away'].map((side) => {
            const teamId = matchup[side];
            const isWinner = teamId && currentBracket[winnerKey] === teamId;
            return el('div', {
              className: 'pick-item' + (isWinner ? ' active' : ''),
              style: { opacity: teamId ? '1' : '.5', cursor: readOnly || !ready ? 'default' : 'pointer' },
              onClick: (readOnly || !ready) ? null : () => onPick(key + 'Winner', teamId),
            }, [teamBadge(teamId, 20), ' ', teamId ? teamLabel(teamId) : 'En attente...']);
          })),
        ]);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);
    }
    rerender(order, bracket);
    wrap.__rerender = rerender;
    return wrap;
  }

  function buildEditableForm(root) {
    const teams = window.D1P.services.seasonService.listTeams();
    const S = window.D1P.services.seasonPredictionService;
    const manager = window.D1P.services.managerService.getActiveManager();
    const existing = S.getSeasonPrediction(manager.id);
    const order = existing && existing.predictedOrder.length === teams.length
      ? existing.predictedOrder.slice()
      : teams.map((t) => t.id);
    let bracket = S.sanitizeBracket(order, (existing && existing.predictedBracket) || S.emptyBracket());

    root.appendChild(el('div', { className: 'card', style: { marginBottom: '16px' } }, [
      el('p', { className: 'small' }, [
        'Classe les 10 équipes du 1er au 10e, puis choisis le vainqueur de chaque tour des playoffs juste en dessous — les demies et la finale se débloquent au fur et à mesure. Réordonner le classement peut invalider des choix de playoffs déjà faits si les qualifiés changent.',
      ]),
    ]));

    root.appendChild(el('div', { className: 'section-title' }, ['Classement final pronostiqué']));
    const reorderList = buildReorderList(order, () => {
      bracket = S.sanitizeBracket(order, bracket);
      bracketEl.__rerender(order, bracket);
    });
    root.appendChild(reorderList);

    root.appendChild(el('div', { className: 'section-title' }, ['🏆 Tableau des playoffs']));
    const bracketEl = buildBracket(order, bracket, (key, teamId) => {
      bracket[key] = bracket[key] === teamId ? null : teamId;
      bracket = S.sanitizeBracket(order, bracket);
      bracketEl.__rerender(order, bracket);
    }, false);
    root.appendChild(bracketEl);

    const draftBtn = el('button', {
      className: 'btn btn-block', style: { marginTop: '20px' },
      onClick: async (e) => {
        const btn = e.target;
        btn.disabled = true; btn.textContent = 'Enregistrement...';
        const res = await S.saveSeasonPrediction(order, bracket);
        btn.disabled = false; btn.textContent = 'Enregistrer (brouillon, modifiable)';
        if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
        window.D1P.components.toast.show('Brouillon enregistré ✅', 'success');
      },
    }, ['Enregistrer (brouillon, modifiable)']);

    const lockBtn = el('button', {
      className: 'btn btn-primary btn-block', style: { marginTop: '10px' },
      onClick: async (e) => {
        const btn = e.target;
        if (!window.confirm('Valider définitivement ton pronostic de saison ? Tu ne pourras plus le modifier toi-même après ça — seul l\'admin pourra le déverrouiller en cas d\'erreur.')) return;
        btn.disabled = true; btn.textContent = 'Validation...';
        const res = await S.saveSeasonPrediction(order, bracket, { lock: true });
        btn.disabled = false; btn.textContent = '🔒 Valider définitivement mon pronostic';
        if (!res.ok) { window.D1P.components.toast.show(res.reason, 'error'); return; }
        window.D1P.components.toast.show('Pronostic validé et verrouillé 🔒', 'success');
        render(root);
      },
    }, ['🔒 Valider définitivement mon pronostic']);

    root.appendChild(draftBtn);
    root.appendChild(lockBtn);
    root.appendChild(el('div', { className: 'field-hint', style: { marginTop: '10px' } }, [
      '⚠️ Une fois validé définitivement, impossible de revenir en arrière toi-même — il faudra demander à l\'admin de déverrouiller ton pronostic si tu dois le corriger. Le tableau des playoffs doit être complet (jusqu\'au champion) pour pouvoir valider.',
    ]));
  }

  function buildLockedView(root) {
    const manager = window.D1P.services.managerService.getActiveManager();
    const S = window.D1P.services.seasonPredictionService;
    const prediction = S.getSeasonPrediction(manager.id);
    const state = window.D1P.services.stateService.getState();
    const score = prediction ? S.scoreSeasonPrediction(prediction, state.seasonActualOrder, state.seasonActualBracket) : null;

    if (!prediction) {
      root.appendChild(el('div', { className: 'empty-state' }, [
        el('div', { className: 'ic' }, ['😅']),
        el('div', {}, ['La saison a commencé et tu n\'avais pas fait de pronostic — ce sera pour la saison prochaine !']),
      ]));
      return;
    }

    const reasons = [];
    if (window.D1P.services.seasonPredictionService.isSeasonLocked()) reasons.push('la saison a commencé');
    if (prediction.locked) reasons.push('tu l\'as validé définitivement');

    root.appendChild(el('div', { className: 'card', style: { marginBottom: '16px' } }, [
      el('p', { className: 'small' }, ['Pronostics fermés (' + reasons.join(' et ') + ') — voici ce que tu avais prédit.']),
      score ? el('div', { className: 'badge badge-green', style: { marginTop: '8px', display: 'inline-block' } }, [
        `${score.exactRanks}/${score.totalTeams} équipes à la bonne place · ${score.bracketCorrect}/${score.totalRounds} tours de playoffs devinés · champion ${score.championCorrect ? 'deviné ✅' : 'raté ❌'}`,
      ]) : null,
    ]));

    root.appendChild(el('div', { className: 'section-title' }, ['Classement pronostiqué']));
    const list = el('div', { className: 'card' });
    prediction.predictedOrder.forEach((teamId, i) => {
      const rank = i + 1;
      const actualRank = state.seasonActualOrder ? state.seasonActualOrder.indexOf(teamId) + 1 : null;
      const exact = actualRank === rank;
      const bg = rankBg(rank);
      list.appendChild(el('div', { className: 'boost-row', style: bg ? { background: bg, borderRadius: '8px', margin: '2px 0', padding: '10px 8px' } : {} }, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } }, [
          el('div', { className: 'rank-badge' + (rank === 1 ? ' r1' : rank === 2 ? ' r2' : rank === 3 ? ' r3' : '') }, [String(rank)]),
          teamBadge(teamId), el('span', { style: { fontWeight: '700' } }, [teamLabel(teamId)]),
        ]),
        actualRank ? el('span', { className: 'badge ' + (exact ? 'badge-green' : 'badge') }, [exact ? '✅ pile' : 'réel : ' + actualRank + 'e']) : null,
      ]));
    });
    root.appendChild(list);

    root.appendChild(el('div', { className: 'section-title' }, ['🏆 Tableau des playoffs pronostiqué']));
    root.appendChild(buildBracket(prediction.predictedOrder, prediction.predictedBracket || {}, null, true));

    if (state.seasonActualBracket) {
      root.appendChild(el('div', { className: 'section-title' }, ['Résultat réel']));
      const cmpList = el('div', { className: 'card' });
      Object.keys(ROUND_LABELS).forEach((key) => {
        const predicted = prediction.predictedBracket && prediction.predictedBracket[key];
        const actual = state.seasonActualBracket[key];
        const correct = predicted && actual && predicted === actual;
        cmpList.appendChild(el('div', { className: 'boost-row' }, [
          el('div', { className: 'boost-label' }, [ROUND_LABELS[key]]),
          el('div', {}, [(actual ? teamLabel(actual) : '—') + (predicted ? ' ' + (correct ? '✅' : '❌ (toi : ' + teamLabel(predicted) + ')') : '')]),
        ]));
      });
      root.appendChild(cmpList);
    }
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['🔮 Ma saison']),
      el('p', {}, ['Un seul pronostic, avant le coup d\'envoi — le classement final complet et le tableau des playoffs.']),
    ]));

    const manager = window.D1P.services.managerService.getActiveManager();
    if (window.D1P.services.seasonPredictionService.isPredictionLocked(manager.id)) buildLockedView(root);
    else buildEditableForm(root);
  }

  window.D1P.pages.season = { render };
})();
