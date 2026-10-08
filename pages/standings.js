/**
 * D1 Pronos — Page Classement
 *
 * Trois vues : le VRAI classement du championnat (recalculé à partir des
 * matchs joués, jamais stocké — voir scoringService.computeStandingsTable),
 * le compteur de qui devine le mieux — "X pronostics exacts sur Y" : un
 * match ne compte que si TOUT est juste (vainqueur + les deux bonus), voir
 * scoringService.isPredictionExact pour pourquoi (sinon cocher les bonus
 * "au cas où" ne coûterait jamais rien) — et son détail "Par match" : pour
 * chaque match noté, qui avait tout juste, qui avait le bon vainqueur sans
 * les bonus, qui s'est trompé.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;
  let activeTab = 'guessers';
  let selectedMatchday = null; // journée affichée dans "Par match" ; null = la dernière journée notée

  function rankBadge(i) {
    const cls = i === 0 ? 'r1' : i === 1 ? 'r2' : i === 2 ? 'r3' : '';
    return el('span', { className: 'rank-badge ' + cls }, [String(i + 1)]);
  }

  function teamCell(team) {
    const wrap = el('span', {});
    wrap.innerHTML = window.D1P.utils.avatar.renderAvatar(team.name, team.logoUrl, 26, { square: true });
    // Souligné en pointillés comme les pseudos du classement des pronostics : le nom se clique.
    const name = el('span', { style: { textDecoration: 'underline dotted', textUnderlineOffset: '3px' } }, [team.name]);
    return el('td', {}, [el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '700' } }, [wrap, name])]);
  }

  const ordinal = (n) => (n === 1 ? '1er' : n + 'e');
  const plural = (n, word) => n + ' ' + word + (n > 1 ? 's' : '');
  const OUTCOME_BADGE = { W: ['Victoire', 'badge-green'], D: ['Match nul', 'badge-yellow'], L: ['Défaite', 'badge-red'] };

  /** "4 + 1 bonus offensif" — au plus UN bonus compté (règle belge), même si l'équipe remplissait les deux conditions. null s'il n'y a pas de bonus. */
  function pointsDetail(res) {
    if (!res.bonus) return null;
    const label = res.offensiveBonus && res.defensiveBonus ? 'bonus offensif ou défensif (un seul compte)'
      : res.offensiveBonus ? 'bonus offensif' : 'bonus défensif';
    return res.base + ' + ' + res.bonus + ' ' + label;
  }

  /** Une ligne de la fiche d'une équipe : l'adversaire et où ça se jouait, le résultat, les points marqués. */
  function teamResultRow(res) {
    const S = window.D1P.services;
    const opponent = S.seasonService.getTeam(res.opponentId);
    const [label, cls] = OUTCOME_BADGE[res.outcome];
    const detail = pointsDetail(res);
    const when = [
      'J' + res.match.matchday,
      res.match.date ? window.D1P.utils.format.formatDateFr(res.match.date, { short: true }) : null,
      res.side === 'home' ? 'à domicile' : 'à l\'extérieur',
    ].filter(Boolean).join(' · ');
    return el('div', { className: 'boost-row', style: { alignItems: 'flex-start' } }, [
      el('div', {}, [
        el('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '650' } }, [opponent ? teamLogo(opponent, 22) : null, 'vs ' + (opponent ? opponent.name : '—')]),
        el('div', { className: 'muted small', style: { marginTop: '2px' } }, [when]),
      ]),
      el('div', { style: { textAlign: 'right' } }, [
        el('span', { className: 'badge ' + cls }, [label]),
        el('div', { style: { fontWeight: '800', color: 'var(--green-text)', marginTop: '4px' } }, [plural(res.points, 'pt')]),
        detail ? el('div', { className: 'muted small' }, [detail]) : null,
      ]),
    ]);
  }

  /**
   * La fiche d'une équipe : son rang et son bilan, puis ses matchs déjà joués,
   * du plus récent au plus ancien. Ce sont des résultats "vainqueur + bonus"
   * (aucun score n'est saisi dans ce jeu, voir scoringService) ; tous les matchs
   * notés comptent, J1 et J2 compris, comme dans le tableau.
   */
  function openTeamResults(row, rank) {
    const S = window.D1P.services;
    const results = S.scoringService.computeTeamResults(row.team.id, S.seasonService.listMatches());
    const body = el('div', {}, [
      el('div', { style: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' } }, [
        teamLogo(row.team, 44),
        el('div', {}, [
          el('div', { style: { fontWeight: '800' } }, [ordinal(rank) + ' · ' + plural(row.points, 'pt')]),
          el('div', { className: 'muted small' }, [[plural(row.played, 'match'), plural(row.won, 'victoire'), plural(row.drawn, 'nul'), plural(row.lost, 'défaite')].join(' · ')]),
        ]),
      ]),
      results.length
        ? el('div', {}, results.map(teamResultRow))
        : el('p', { className: 'muted small', style: { marginTop: '8px' } }, ['Aucun match joué pour l\'instant.']),
    ]);
    window.D1P.components.modal.open({ title: row.team.name, body, actions: [{ label: 'Fermer', className: 'btn-ghost' }] });
  }

  function buildRealStandings() {
    const teams = window.D1P.services.seasonService.listTeams();
    const matches = window.D1P.services.seasonService.listMatches();
    const table = window.D1P.services.scoringService.computeStandingsTable(matches, teams, window.D1P.services.seasonService.getStandingsOrder());

    if (!table.length) return el('div', { className: 'empty-state' }, [el('div', { className: 'ic' }, ['🏆']), el('div', {}, ['Aucune équipe pour le moment.'])]);

    const headers = ['#', 'Équipe', 'Pts', 'J', 'G', 'N', 'P'];
    return el('div', {}, [
      el('p', { className: 'field-hint', style: { marginBottom: '10px' } }, ['Clique sur une équipe pour voir ses résultats, match par match.']),
      // Sur un très petit écran, le tableau défile dans sa carte plutôt que de faire défiler toute la page.
      el('div', { style: { overflowX: 'auto' } }, [el('table', { className: 'standings-table' }, [
        el('thead', {}, [el('tr', {}, headers.map((h) => el('th', {}, [h])))]),
        el('tbody', {}, table.map((r, i) => el('tr', {
          className: 'clickable', title: 'Voir les résultats de ' + r.team.name, onClick: () => openTeamResults(r, i + 1),
        }, [
          el('td', {}, [rankBadge(i)]),
          teamCell(r.team),
          el('td', { style: { fontWeight: '800', color: 'var(--green-text)' } }, [String(r.points)]),
          el('td', {}, [String(r.played)]),
          el('td', {}, [String(r.won)]),
          el('td', {}, [String(r.drawn)]),
          el('td', {}, [String(r.lost)]),
        ]))),
      ])]),
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

  /** Une pastille par joueur, cliquable : sa fiche (profil + pronostics). */
  function nameChips(managers, cls) {
    return el('div', { className: 'pm-names' }, managers.map((m) => el('span', {
      className: 'badge ' + (cls || ''), title: 'Voir le profil',
      onClick: () => window.D1P.components.profile.openCard(m.id),
    }, [m.name])));
  }

  /** Volet repliable "Libellé (N)" — fermé d'office : avec ~70 joueurs, tout déplier ferait un mur de noms. null s'il n'y a personne. */
  function nameGroup(label, managers, cls) {
    if (!managers.length) return null;
    return el('details', { className: 'pm-group' }, [
      el('summary', {}, [label + ' (' + managers.length + ')']),
      nameChips(managers, cls),
    ]);
  }

  function teamLogo(team, size) {
    const wrap = el('span', {});
    wrap.innerHTML = window.D1P.utils.avatar.renderAvatar(team.name, team.logoUrl, size || 24, { square: true });
    return wrap;
  }

  /**
   * Un match noté : le résultat, puis qui avait tout juste (visible d'office,
   * c'est ce qui compte au classement), qui avait le bon vainqueur seulement,
   * qui s'est trompé, qui n'a pas pronostiqué. Mêmes définitions que le
   * classement : scoringService.isPredictionExact / isPredictionCorrect.
   */
  function matchVerdictCard(match, managers) {
    const S = window.D1P.services;
    const home = S.seasonService.getTeam(match.homeTeamId);
    const away = S.seasonService.getTeam(match.awayTeamId);
    if (!home || !away) return null;

    const groups = { exact: [], winner: [], miss: [], none: [] };
    managers.forEach((m) => {
      const prediction = S.predictionService.getPrediction(match.id, m.id);
      if (prediction.winner === null || prediction.winner === undefined) groups.none.push(m);
      else if (S.scoringService.isPredictionExact(prediction, match.result)) groups.exact.push(m);
      else if (S.scoringService.isPredictionCorrect(prediction, match.result)) groups.winner.push(m);
      else groups.miss.push(m);
    });
    const played = managers.length - groups.none.length;
    const exact = groups.exact.length;
    // Même arrondi que scoringService.computeGuesserStats, pour que les pourcentages concordent partout.
    const summary = played
      ? `✅ ${exact} exact${exact > 1 ? 's' : ''} sur ${played} pronostic${played > 1 ? 's' : ''} (${Math.round((exact / played) * 100)}%)`
      : 'Personne n\'avait pronostiqué ce match.';

    return el('div', { className: 'card pm-card' }, [
      el('div', { className: 'pm-head' }, [teamLogo(home), home.name, el('span', { className: 'pm-vs' }, ['–']), teamLogo(away), away.name]),
      el('div', { className: 'muted small', style: { marginTop: '4px' } }, ['Résultat : ' + window.D1P.components.profile.describeOutcome(match.result, match)]),
      el('div', { style: { fontWeight: '700', marginTop: '10px' } }, [summary]),
      exact ? nameChips(groups.exact, 'badge-green')
        : played ? el('div', { className: 'muted small', style: { marginTop: '4px' } }, ['Personne n\'avait tout juste.']) : null,
      nameGroup('🟡 Bon vainqueur, bonus raté', groups.winner, 'badge-yellow'),
      nameGroup('❌ Raté', groups.miss),
      nameGroup('Pas de pronostic', groups.none),
    ]);
  }

  /**
   * "Par match" : le détail du classement "Qui devine le mieux". Même
   * périmètre (matchs notés, à partir de la journée de départ — voir
   * seasonService.listCountedMatches), donc les chiffres concordent. Un match
   * n'apparaît qu'une fois noté, donc plus "en jeu" : rien à copier.
   */
  function buildByMatch(rerender) {
    const S = window.D1P.services;
    const counted = S.seasonService.listCountedMatches();
    if (!counted.length) {
      return el('div', { className: 'card' }, [el('div', { className: 'empty-state' }, [
        el('div', { className: 'ic' }, ['🧩']),
        el('div', {}, [`Rien de noté pour l'instant — le détail démarre à la journée ${window.D1P.data.CONFIG.season.leaderboardFromMatchday}.`]),
      ])]);
    }

    const matchdays = [...new Set(counted.map((m) => m.matchday))].sort((a, b) => a - b);
    if (selectedMatchday === null || !matchdays.includes(selectedMatchday)) selectedMatchday = matchdays[matchdays.length - 1];

    const dateOf = (md) => {
      const first = counted.find((m) => m.matchday === md);
      return first && first.date ? ' — ' + window.D1P.utils.format.formatDateFr(first.date, { short: true }) : '';
    };
    const select = el('select', {
      style: { maxWidth: '260px' },
      onChange: (e) => { selectedMatchday = Number(e.target.value); rerender(); },
    }, matchdays.map((md) => el('option', { value: md, selected: md === selectedMatchday }, ['Journée ' + md + dateOf(md)])));

    const managers = S.managerService.listManagers();
    const cards = counted.filter((m) => m.matchday === selectedMatchday).map((m) => matchVerdictCard(m, managers));
    const pending = S.seasonService.matchesForMatchday(selectedMatchday).filter((m) => !(m.status === 'termine' && m.result)).length;
    return el('div', {}, [
      el('div', { style: { marginBottom: '12px' } }, [select]),
      pending ? el('p', { className: 'field-hint', style: { marginBottom: '10px' } }, [pending + ' match' + (pending > 1 ? 's' : '') + ' de cette journée pas encore noté' + (pending > 1 ? 's' : '') + ' — ' + (pending > 1 ? 'ils apparaîtront' : 'il apparaîtra') + ' ici dès que le résultat sera encodé.']) : null,
      el('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, cards),
    ]);
  }

  function render(root) {
    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['🏆 Classement']),
      el('p', {}, ['Le vrai classement du championnat, et qui devine le mieux dans le groupe.']),
    ]));

    const tabDefs = [['guessers', '🎯', 'Qui devine le mieux'], ['byMatch', '🧩', 'Par match'], ['real', '🏉', 'Championnat']];
    root.appendChild(el('div', { className: 'tabs' }, tabDefs.map(([key, icon, label]) => el('div', {
      className: 'tab-btn' + (activeTab === key ? ' active' : ''),
      onClick: () => { activeTab = key; render(root); },
    }, [el('span', { className: 'tab-ic' }, [icon + ' ']), label]))));
    // "Par match" dessine ses propres cartes (une par match) : pas de grande carte autour.
    if (activeTab === 'byMatch') root.appendChild(buildByMatch(() => render(root)));
    else root.appendChild(el('div', { className: 'card standings-card' }, [activeTab === 'real' ? buildRealStandings() : buildGuessersLeaderboard()]));
  }

  window.D1P.pages.standings = { render };
})();
