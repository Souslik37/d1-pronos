/**
 * D1 Pronos — Calcul des points de classement (bonus offensif/défensif)
 *
 * Tout est PUR ici : aucune écriture, aucun état. "Un pronostic était bon
 * ou pas" ne se stocke jamais — ça se recalcule à l'affichage en comparant
 * le pronostic (déjà en base) au résultat officiel (déjà en base). Voir
 * seasonService.finalizeMatch pour pourquoi il n'y a rien d'autre à faire
 * une fois un résultat encodé.
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
   * bonusHome, bonusAway, closeMargin }.
   */
  function computePoints(outcome) {
    const P = CONFIG().points;
    let home, away;
    if (outcome.winner === 'draw') {
      home = P.draw;
      away = P.draw;
    } else if (outcome.winner === 'home') {
      home = P.win;
      away = P.loss + (outcome.closeMargin ? P.closeLossPoints : 0);
    } else {
      away = P.win;
      home = P.loss + (outcome.closeMargin ? P.closeLossPoints : 0);
    }
    if (outcome.bonusHome) home += P.tryBonusPoints;
    if (outcome.bonusAway) away += P.tryBonusPoints;
    return { home, away };
  }

  /**
   * Déduit le "type de résultat" (pour computePoints) à partir d'un score
   * officiel réel { scoreHome, scoreAway, triesHome, triesAway } — utilisé
   * UNIQUEMENT pour un résultat officiel (l'admin entre un vrai score, on en
   * déduit tout le reste). Un pronostic, lui, choisit directement ce
   * "type de résultat" sans passer par un score (voir predictionService).
   */
  function deriveOutcomeFromResult(result) {
    const P = CONFIG().points;
    const diff = result.scoreHome - result.scoreAway;
    const winner = diff > 0 ? 'home' : diff < 0 ? 'away' : 'draw';
    return {
      winner,
      bonusHome: (result.triesHome || 0) >= P.tryBonusThreshold,
      bonusAway: (result.triesAway || 0) >= P.tryBonusThreshold,
      closeMargin: winner !== 'draw' && Math.abs(diff) <= P.closeLossMargin,
    };
  }

  /** Un pronostic est "bon" si le vainqueur (ou nul) deviné est le bon — le seul critère du compteur simple demandé (pas de points compliqués). */
  function isPredictionCorrect(prediction, result) {
    if (!prediction || prediction.winner === null || prediction.winner === undefined || !result) return false;
    return prediction.winner === deriveOutcomeFromResult(result).winner;
  }

  /**
   * Le classement réel, entièrement recalculé à partir des matchs déjà
   * joués (jamais stocké nulle part — une seule source de vérité : les
   * résultats des matchs) : points, joués, victoires/nuls/défaites,
   * essais pour/contre, différentiel. Trié comme un vrai classement de
   * rugby : points d'abord, différentiel ensuite.
   */
  function computeStandingsTable(matches, teams) {
    const rows = {};
    teams.forEach((t) => {
      rows[t.id] = { team: t, points: 0, played: 0, won: 0, drawn: 0, lost: 0, pointsFor: 0, pointsAgainst: 0 };
    });

    matches.filter((m) => m.status === 'termine' && m.result).forEach((m) => {
      const home = rows[m.homeTeamId];
      const away = rows[m.awayTeamId];
      if (!home || !away) return; // équipe supprimée depuis — n'arrête pas le calcul du reste
      const outcome = deriveOutcomeFromResult(m.result);
      const pts = computePoints(outcome);

      home.played += 1; away.played += 1;
      home.points += pts.home; away.points += pts.away;
      home.pointsFor += m.result.scoreHome; home.pointsAgainst += m.result.scoreAway;
      away.pointsFor += m.result.scoreAway; away.pointsAgainst += m.result.scoreHome;
      if (outcome.winner === 'draw') { home.drawn += 1; away.drawn += 1; }
      else if (outcome.winner === 'home') { home.won += 1; away.lost += 1; }
      else { away.won += 1; home.lost += 1; }
    });

    return Object.values(rows)
      .map((r) => ({ ...r, diff: r.pointsFor - r.pointsAgainst }))
      .sort((a, b) => b.points - a.points || b.diff - a.diff || a.team.name.localeCompare(b.team.name, 'fr'));
  }

  window.D1P.services.scoringService = { computePoints, deriveOutcomeFromResult, isPredictionCorrect, computeStandingsTable };
})();
