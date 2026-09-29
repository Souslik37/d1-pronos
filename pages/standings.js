/**
 * D1 Pronos — Page Classement
 *
 * Deux vues : le VRAI classement du championnat (recalculé à partir des
 * matchs joués, jamais stocké — voir scoringService.computeStandingsTable),
 * et le compteur simple de qui devine le mieux (aucun système de points,
 * juste "X bons pronostics sur Y").
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;
  let activeTab = 'real';

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
    const table = window.D1P.services.scoringService.computeStandingsTable(matches, teams);

    if (!table.length) return el('div', { className: 'empty-state' }, [el('div', { className: 'ic' }, ['🏆']), el('div', {}, ['Aucune équipe pour le moment.'])]);

    const headers = ['#', 'Équipe', 'Pts', 'J', 'G', 'N', 'P', 'Pour', 'Contre', 'Diff'];
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
        el('td', { className: 'muted' }, [String(r.pointsFor)]),
        el('td', { className: 'muted' }, [String(r.pointsAgainst)]),
        el('td', { className: 'muted' }, [window.D1P.utils.format.formatSigned(r.diff)]),
      ]))),
    ]);
  }

  function buildGuessersLeaderboard() {
    const managers = window.D1P.services.managerService.listManagers();
    const matches = window.D1P.services.seasonService.listMatches().filter((m) => m.status === 'termine' && m.result);

    const rows = managers.map((m) => {
      let correct = 0, total = 0;
      matches.forEach((match) => {
        const p = window.D1P.services.predictionService.getPrediction(match.id, m.id);
        if (p.winner === null) return;
        total += 1;
        if (window.D1P.services.scoringService.isPredictionCorrect(p, match.result)) correct += 1;
      });
      return { manager: m, correct, total, pct: total ? Math.round((correct / total) * 100) : null };
    }).sort((a, b) => b.correct - a.correct || (b.pct || 0) - (a.pct || 0));

    if (!matches.length) {
      return el('div', { className: 'empty-state' }, [el('div', { className: 'ic' }, ['🎯']), el('div', {}, ['Aucun match noté pour le moment — revenez après la première journée jouée.'])]);
    }

    return el('table', { className: 'standings-table' }, [
      el('thead', {}, [el('tr', {}, ['#', 'Manager', 'Bons pronostics', '%'].map((h) => el('th', {}, [h])))]),
      el('tbody', {}, rows.map((r, i) => el('tr', {}, [
        el('td', {}, [rankBadge(i)]),
        el('td', { style: { fontWeight: '700' } }, [r.manager.name]),
        el('td', { style: { fontWeight: '800', color: 'var(--green-text)' } }, [`${r.correct} / ${r.total}`]),
        el('td', { className: 'muted' }, [r.pct === null ? '—' : r.pct + '%']),
      ]))),
    ]);
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['🏆 Classement']),
      el('p', {}, ['Le vrai classement du championnat, et qui devine le mieux dans le groupe.']),
    ]));

    const tabs = el('div', { className: 'tabs' }, [
      el('div', { className: 'tab-btn' + (activeTab === 'real' ? ' active' : ''), onClick: () => { activeTab = 'real'; render(root); } }, ['🏉 Championnat']),
      el('div', { className: 'tab-btn' + (activeTab === 'guessers' ? ' active' : ''), onClick: () => { activeTab = 'guessers'; render(root); } }, ['🎯 Qui devine le mieux']),
    ]);
    root.appendChild(tabs);
    root.appendChild(el('div', { className: 'card' }, [activeTab === 'real' ? buildRealStandings() : buildGuessersLeaderboard()]));
  }

  window.D1P.pages.standings = { render };
})();
