/**
 * D1 Pronos — Page Classement
 *
 * Deux vues : le VRAI classement du championnat (recalculé à partir des
 * matchs joués, jamais stocké — voir scoringService.computeStandingsTable),
 * et le compteur de qui devine le mieux — "X pronostics exacts sur Y" : un
 * match ne compte que si TOUT est juste (vainqueur + les deux bonus), voir
 * scoringService.isPredictionExact pour pourquoi (sinon cocher les bonus
 * "au cas où" ne coûterait jamais rien).
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;
  let activeTab = 'guessers';

  function rankBadge(i) {
    const cls = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    return el('span', { className: 'rank-badge ' + cls }, [String(i + 1)]);
  }

  function teamCell(team) {
    const wrap = el('span', {});
    wrap.innerHTML = window.D1P.utils.avatar.renderAvatar(team.name, team.logoUrl, 26, { square: true });
    return el('td', {}, [el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' } }, [wrap, team.name])]);
  }

  function buildRealStandings() {
    const teams = window.D1P.services.seasonService.listTeams();
    const matches = window.D1P.services.seasonService.listMatches();
    const table = window.D1P.services.scoringService.computeStandingsTable(matches, teams, window.D1P.services.seasonService.getStandingsOrder());

    if (!table.length) return el('div', { className: 'empty-state' }, [el('div', { className: 'ic' }, ['🏆']), el('div', {}, ['Aucune équipe pour le moment.'])]);

    const headers = ['#', 'Équipe', 'Pts', 'J', 'G', 'N', 'P'];
    return el('table', { className: 'standings-table' }, [
      el('thead', {}, [el('tr', {}, headers.map((h) => el('th', {}, [h])))]),
      el('tbody', {}, table.map((r, i) => el('tr', {}, [
        el('td', {}, [rankBadge(i)]),
        teamCell(r.team),
        el('td', { style: { fontWeight: '800', color: 'var(--green-text)' } }, [String(r.points)]),
        el('td', {}, [String(r.played)]),
        el('td', {}, [String(r.won)]),
        el('td', {}, [String(r.drawn)]),
        el('td', {}, [String(r.lost)]),
      ]))),
    ]);
  }

  /** Médaille seulement si le rang est mérité : sans aucun match compté, ou à 0 pronostic exact, un rang 1-2-3 n'a pas de sens (ex æquo à 0). */
  function guesserRankBadge(row, anyScored) {
    if (!anyScored) return el('span', { className: 'rank-badge' }, ['–']);
    const medal = row.exact > 0 ? (row.rank === 1 ? ' r1' : row.rank === 2 ? ' r2' : row.rank === 3 ? ' r3' : '') : '';
    return el('span', { className: 'rank-badge' + medal }, [String(row.rank)]);
  }

  /**
   * Affiché dès le départ (tout le monde à 0) plutôt que masqué tant
   * qu'aucun match n'est noté, et ne compte que les matchs à partir de
   * CONFIG.season.leaderboardFromMatchday — tout le monde repart de zéro à
   * cette journée, même si des pronostics plus anciens existent ou si les
   * résultats de J1/J2 sont encodés pour le vrai classement du championnat.
   */
  function buildGuessersLeaderboard() {
    const startMatchday = window.D1P.data.CONFIG.season.leaderboardFromMatchday;
    const managers = window.D1P.services.managerService.listManagers();
    const matches = window.D1P.services.seasonService.listCountedMatches();

    const rows = managers.map((m) => ({
      manager: m,
      ...window.D1P.services.scoringService.computeGuesserStats(matches, (matchId) => window.D1P.services.predictionService.getPrediction(matchId, m.id)),
    })).sort((a, b) => b.exact - a.exact || (b.pct || 0) - (a.pct || 0));

    // Ex æquo = même rang.
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      r.rank = prev && prev.exact === r.exact && (prev.pct || 0) === (r.pct || 0) ? prev.rank : i + 1;
    });

    return el('div', {}, [
      el('p', { className: 'field-hint', style: { marginBottom: '10px' } }, [
        `Le classement démarre à la journée ${startMatchday} : tout le monde repart de zéro. Un match ne compte que si tout est deviné juste — vainqueur ET bonus (voir l'onglet Règles).`,
      ]),
      el('table', { className: 'standings-table' }, [
        el('thead', {}, [el('tr', {}, ['#', 'Manager', 'Pronostics exacts', '%'].map((h) => el('th', {}, [h])))]),
        el('tbody', {}, rows.map((r) => el('tr', {}, [
          el('td', {}, [guesserRankBadge(r, matches.length > 0)]),
          el('td', { style: { fontWeight: '700' } }, [el('span', {
            title: 'Voir le profil', style: { cursor: 'pointer', textDecoration: 'underline dotted', textUnderlineOffset: '3px' },
            onClick: () => window.D1P.components.profile.openCard(r.manager.id),
          }, [r.manager.name])]),
          el('td', { style: { fontWeight: '800', color: 'var(--green-text)' } }, [`${r.exact} / ${r.total}`]),
          el('td', { className: 'muted' }, [r.pct === null ? '—' : r.pct + '%']),
        ]))),
      ]),
    ]);
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['🏆 Classement']),
      el('p', {}, ['Le vrai classement du championnat, et qui devine le mieux dans le groupe.']),
    ]));

    const tabs = el('div', { className: 'tabs' }, [
      el('div', { className: 'tab-btn' + (activeTab === 'guessers' ? ' active' : ''), onClick: () => { activeTab = 'guessers'; render(root); } }, ['🎯 Qui devine le mieux']),
      el('div', { className: 'tab-btn' + (activeTab === 'real' ? ' active' : ''), onClick: () => { activeTab = 'real'; render(root); } }, ['🏉 Championnat']),
    ]);
    root.appendChild(tabs);
    root.appendChild(el('div', { className: 'card' }, [activeTab === 'real' ? buildRealStandings() : buildGuessersLeaderboard()]));
  }

  window.D1P.pages.standings = { render };
})();
