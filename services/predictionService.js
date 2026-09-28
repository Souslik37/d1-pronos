/**
 * D1 Pronos — Pronostics hebdomadaires (un par manager par match)
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.services = window.D1P.services || {};

  function emptyPrediction() {
    return { winner: null, bonusHome: false, bonusAway: false, closeMargin: false, submittedAt: null };
  }

  function getPrediction(matchId, managerId) {
    const state = window.D1P.services.stateService.getState();
    return (state.predictions[matchId] && state.predictions[matchId][managerId]) || emptyPrediction();
  }

  /** Tous les pronostics déjà connus localement pour un match (voir storageService.loadInitialState — RLS filtre déjà les journées encore "ouvertes"). */
  function predictionsForMatch(matchId) {
    const state = window.D1P.services.stateService.getState();
    return state.predictions[matchId] || {};
  }

  /**
   * Enregistre le pronostic du manager ACTIF pour un match. Contrairement à
   * La Hulpe 3, le score n'existe même pas comme concept ici — juste
   * vainqueur/nul + les deux bonus (voir scoringService.computePoints).
   */
  function savePrediction(matchId, data) {
    const match = window.D1P.services.seasonService.getMatch(matchId);
    if (!match || match.status !== 'ouvert') {
      return { ok: false, reason: 'Les pronostics sont fermés pour ce match.' };
    }
    if (!['home', 'away', 'draw'].includes(data.winner)) {
      return { ok: false, reason: 'Choisis qui gagne (ou un match nul).' };
    }

    const manager = window.D1P.services.managerService.getActiveManager();
    const prediction = {
      winner: data.winner,
      bonusHome: !!data.bonusHome,
      bonusAway: !!data.bonusAway,
      // Un match nul n'a pas de "perdant" à qui donner un bonus défensif.
      closeMargin: data.winner !== 'draw' && !!data.closeMargin,
      submittedAt: new Date().toISOString(),
    };

    const state = window.D1P.services.stateService.getState();
    state.predictions[matchId] = state.predictions[matchId] || {};
    state.predictions[matchId][manager.id] = prediction;

    window.D1P.services.storageService.savePredictionRow(manager.id, matchId, prediction).then((ok) => {
      if (!ok) window.D1P.components.toast.show('Pronostic gardé localement mais pas encore synchronisé — vérifie ta connexion.', 'error');
    });
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  window.D1P.services.predictionService = { emptyPrediction, getPrediction, predictionsForMatch, savePrediction };
})();
