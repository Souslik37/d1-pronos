/**
 * D1 Pronos — Calcul des points de classement (bonus offensif/défensif)
 *
 * Tout est PUR ici : aucune écriture, aucun état. "Un pronostic était bon
 * ou pas" ne se stocke jamais — ça se recalcule à l'affichage en comparant
 * le pronostic (déjà en base) au résultat officiel (déjà en base). Voir
 * seasonService.finalizeMatch pour pourquoi il n'y a rien d'autre à faire
 * une fois un résultat encodé.
 *
 * Le résultat officiel a EXACTEMENT la même forme qu'un pronostic — { winner,
 * bonusHome, bonusAway, closeMargin } — pas un score brut : l'admin choisit
 * directement qui a gagné et les bonus, comme n'importe quel manager (voir
 * pages/admin.js openResultModal). Pas de score/essais bruts à suivre, donc
 * pas de "Pour/Contre/Diff" au classement réel non plus.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.services = window.D1P.services || {};

  const CONFIG = () => window.D1P.data.CONFIG;

  /**
   * Système de points standard du rugby à XV : victoire 4 pts, nul 2 pts,
   * défaite 0 pt, +1 pt de bonus offensif (4 essais ou plus, gagnant OU
   * perdant), +1 pt de bonus défensif pour le perdant seulement (défaite par
   * peu — voir CONFIG.points). `outcome` = { winner: 'home'|'away'|'draw',
   * bonusHome, bonusAway, closeMargin } — un pronostic ET un résultat
   * officiel ont tous les deux cette forme.
   *
   * Règle belge : une équipe ne cumule jamais les deux bonus sur un même
   * match — offensif OU défensif, jamais les deux, donc au plus +1 point de
   * bonus au total même si les deux conditions sont remplies (ex: perdant à
   * 5 points d'écart qui a aussi marqué 4 essais ou plus).
   */
  function computePoints(outcome) {
    const P = CONFIG().points;
    let home, away;
    if (outcome.winner === 'draw') {
      home = P.draw;
      away = P.draw;
    } else if (outcome.winner === 'home') {
      home = P.win;
      away = P.loss;
    } else {
      away = P.win;
      home = P.loss;
    }
    const homeHasBonus = outcome.bonusHome || (outcome.winner === 'away' && outcome.closeMargin);
    const awayHasBonus = outcome.bonusAway || (outcome.winner === 'home' && outcome.closeMargin);
    if (homeHasBonus) home += P.tryBonusPoints;
    if (awayHasBonus) away += P.tryBonusPoints;
    return { home, away };
  }

  /** Un pronostic est "bon" si le vainqueur (ou nul) deviné est le bon — utilisé pour l'indicateur par match, pas pour le classement "qui devine le mieux" (voir isPredictionExact). */
  function isPredictionCorrect(prediction, result) {
    if (!prediction || prediction.winner === null || prediction.winner === undefined || !result) return false;
    return prediction.winner === result.winner;
  }

  /**
   * Un pronostic est "exact" (donne un point au classement "qui devine le
   * mieux") s'il est intégralement juste : vainqueur ET les deux bonus,
   * case par case — pas seulement le total de points calculé. Comparer sur
   * les points calculés serait exploitable : le plafond à un seul bonus
   * (voir computePoints) fait que cocher les deux cases bonus "pour être
   * sûr" donnerait parfois le même total qu'en cochant la bonne case seule,
   * sans jamais risquer moins — la comparaison case par case retire cet
   * avantage : une case bonus cochée à tort fait rater le point, même si le
   * vainqueur était bon.
   */
  function isPredictionExact(prediction, result) {
    if (!prediction || prediction.winner === null || prediction.winner === undefined || !result) return false;
    return prediction.winner === result.winner
      && !!prediction.bonusHome === !!result.bonusHome
      && !!prediction.bonusAway === !!result.bonusAway
      && !!prediction.closeMargin === !!result.closeMargin;
  }

  /**
   * Le score d'UN manager au classement "qui devine le mieux" sur ces matchs
   * notés : { exact, total, pct }. `total` ne compte que les matchs qu'il a
   * pronostiqués (pas de pénalité pour un match sauté). `getPrediction(matchId)`
   * donne son pronostic — passé en paramètre pour que ce fichier reste pur.
   * Partagé par le classement et la fiche d'un manager : un seul calcul.
   */
  function computeGuesserStats(matches, getPrediction) {
    let exact = 0, total = 0;
    matches.forEach((match) => {
      const p = getPrediction(match.id);
      if (!p || p.winner === null) return;
      total += 1;
      if (isPredictionExact(p, match.result)) exact += 1;
    });
    return { exact, total, pct: total ? Math.round((exact / total) * 100) : null };
  }

  /**
   * Le classement réel, entièrement recalculé à partir des matchs déjà
   * joués (jamais stocké nulle part — une seule source de vérité : les
   * résultats des matchs) : points, joués, victoires/nuls/défaites. Pas de
   * différentiel de points (aucun score réel n'est saisi, voir le
   * commentaire en tête de fichier), donc le classement officiel — qui
   * départage les égalités avec — peut différer. `tiebreakOrder` (liste
   * d'ids d'équipes, réglée à la main par l'admin) sert à départager les
   * équipes à égalité de POINTS ; les points passent toujours avant, sinon
   * l'ordre deviendrait faux dès le résultat suivant. Sans ordre (ou pour
   * les équipes qui n'y figurent pas) : nombre de victoires, puis alphabétique.
   */
  function computeStandingsTable(matches, teams, tiebreakOrder) {
    const rows = {};
    teams.forEach((t) => {
      rows[t.id] = { team: t, points: 0, played: 0, won: 0, drawn: 0, lost: 0 };
    });

    matches.filter((m) => m.status === 'termine' && m.result).forEach((m) => {
      const home = rows[m.homeTeamId];
      const away = rows[m.awayTeamId];
      if (!home || !away) return; // équipe supprimée depuis — n'arrête pas le calcul du reste
      const pts = computePoints(m.result);

      home.played += 1; away.played += 1;
      home.points += pts.home; away.points += pts.away;
      if (m.result.winner === 'draw') { home.drawn += 1; away.drawn += 1; }
      else if (m.result.winner === 'home') { home.won += 1; away.lost += 1; }
      else { away.won += 1; home.lost += 1; }
    });

    const manualRank = new Map((tiebreakOrder || []).map((id, i) => [id, i]));
    const rankOf = (r) => (manualRank.has(r.team.id) ? manualRank.get(r.team.id) : Number.MAX_SAFE_INTEGER);

    return Object.values(rows)
      .sort((a, b) => b.points - a.points || rankOf(a) - rankOf(b) || b.won - a.won || a.team.name.localeCompare(b.team.name, 'fr'));
  }

  /**
   * Les résultats déjà joués d'UNE équipe, du plus récent au plus ancien : pour
   * chaque match noté, de quel côté elle jouait, qui elle affrontait, le
   * résultat ('W' victoire, 'D' nul, 'L' défaite) et les points qu'il lui a
   * rapportés au classement (base + éventuel bonus). Passe par computePoints,
   * comme computeStandingsTable, donc la somme des points d'ici est toujours
   * celle du tableau — y compris le plafond belge d'un seul bonus par match :
   * `offensiveBonus` / `defensiveBonus` disent quelles conditions l'équipe
   * remplissait, `bonus` (0 ou 1) ce qui lui a réellement été compté.
   */
  function computeTeamResults(teamId, matches) {
    const P = CONFIG().points;
    return matches
      .filter((m) => m.status === 'termine' && m.result && (m.homeTeamId === teamId || m.awayTeamId === teamId))
      .map((m) => {
        const side = m.homeTeamId === teamId ? 'home' : 'away';
        const outcome = m.result.winner === 'draw' ? 'D' : (m.result.winner === side ? 'W' : 'L');
        const base = outcome === 'W' ? P.win : outcome === 'D' ? P.draw : P.loss;
        const points = computePoints(m.result)[side];
        return {
          match: m, side, outcome, base, points, bonus: points - base,
          opponentId: side === 'home' ? m.awayTeamId : m.homeTeamId,
          offensiveBonus: !!(side === 'home' ? m.result.bonusHome : m.result.bonusAway),
          defensiveBonus: outcome === 'L' && !!m.result.closeMargin,
        };
      })
      .sort((a, b) => b.match.matchday - a.match.matchday || (b.match.date || '').localeCompare(a.match.date || '') || b.match.id.localeCompare(a.match.id));
  }

  window.D1P.services.scoringService = { computePoints, isPredictionCorrect, isPredictionExact, computeGuesserStats, computeStandingsTable, computeTeamResults };
})();
