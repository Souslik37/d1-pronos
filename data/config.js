/**
 * D1 Pronos — Configuration
 *
 * Format du championnat de Belgique de rugby D1 (10 équipes, aller-retour,
 * vérifié début saison 2025-2026 — voir la note ci-dessous si le format
 * change) : 18 journées de saison régulière, puis playoffs (top 6 : les 2
 * premiers exemptés vont direct en demi, les 3e à 6e jouent les quarts) et
 * play-downs (les 4 derniers ; le 10e descend direct, le 9e joue un barrage
 * contre le finaliste de D2). Rien de tout ça n'est en dur ailleurs que dans
 * ce fichier — si la Ligue Belge Francophone de Rugby change le format,
 * c'est ici que ça se met à jour.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.data = window.D1P.data || {};

  window.D1P.data.CONFIG = {
    season: {
      totalMatchdays: 18,
      teamsCount: 10,
      playoffSpots: 6, // 1er-2e : exemptés (demi direct) ; 3e-6e : quarts
      playdownSpots: 4, // les 4 derniers ; 10e = descente directe, 9e = barrage
    },

    // Système de points de classement standard (rugby à XV, bonus offensif/
    // défensif) — vérifié cohérent avec les vrais classements D1 en ligne
    // (ex: une équipe à 2 victoires avec bcp d'essais marqués a bien 10 pts
    // = 2 x (4 + 1 bonus)).
    points: {
      win: 4,
      draw: 2,
      loss: 0,
      tryBonusThreshold: 4, // 4 essais ou plus dans le match
      tryBonusPoints: 1,
      closeLossMargin: 7, // défaite par 7 points d'écart ou moins
      closeLossPoints: 1,
    },
  };
})();
