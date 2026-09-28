/**
 * D1 Pronos — Pronostic de saison (classement final + champion)
 *
 * Un seul pronostic par manager, fait UNE fois avant le début de la saison
 * régulière puis verrouillé (admin) — comparé au classement/champion réels
 * seulement une fois que l'admin les a renseignés en fin de saison.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.services = window.D1P.services || {};

  function isSeasonLocked() {
    return !!window.D1P.services.stateService.getState().seasonLocked;
  }

  function getSeasonPrediction(managerId) {
    const state = window.D1P.services.stateService.getState();
    return state.seasonPredictions[managerId] || null;
  }

  function listSeasonPredictions() {
    const state = window.D1P.services.stateService.getState();
    return Object.values(state.seasonPredictions);
  }

  /**
   * `predictedOrder` : tableau des 10 id d'équipes, du 1er au 10e pronostiqué.
   * Doit être une permutation exacte des équipes existantes — sinon la
   * comparaison en fin de saison n'aurait aucun sens.
   */
  async function saveSeasonPrediction(predictedOrder, predictedChampion) {
    if (isSeasonLocked()) return { ok: false, reason: 'Les pronostics de saison sont fermés — la saison a commencé.' };

    const teams = window.D1P.services.seasonService.listTeams();
    const teamIds = new Set(teams.map((t) => t.id));
    const uniqueOrder = new Set(predictedOrder);
    if (predictedOrder.length !== teams.length || uniqueOrder.size !== teams.length || [...uniqueOrder].some((id) => !teamIds.has(id))) {
      return { ok: false, reason: 'Le classement doit contenir chaque équipe exactement une fois.' };
    }
    if (!predictedChampion || !teamIds.has(predictedChampion)) {
      return { ok: false, reason: 'Choisis qui remporte le titre.' };
    }

    const manager = window.D1P.services.managerService.getActiveManager();
    const prediction = { managerId: manager.id, predictedOrder, predictedChampion, submittedAt: new Date().toISOString() };

    const ok = await window.D1P.services.storageService.saveSeasonPredictionRow(manager.id, prediction);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    const state = window.D1P.services.stateService.getState();
    state.seasonPredictions[manager.id] = prediction;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /** Admin uniquement (RLS season_settings_admin_write) : ferme/rouvre les pronostics de saison. */
  async function setLocked(locked) {
    const ok = await window.D1P.services.storageService.setSeasonLocked(locked);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    window.D1P.services.stateService.getState().seasonLocked = locked;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /**
   * Compare un pronostic de saison au classement final RÉEL — un compteur
   * simple comme pour les pronostics hebdo, pas un système de points :
   * nombre d'équipes placées EXACTEMENT au bon rang, et champion deviné ou
   * non. `actualChampion` est un argument À PART (pas forcément l'équipe
   * classée 1ère de saison régulière : c'est le vainqueur de la finale des
   * playoffs, ce peut être n'importe laquelle des 6 équipes qualifiées).
   */
  function scoreSeasonPrediction(prediction, actualOrder, actualChampion) {
    if (!prediction || !actualOrder || !actualOrder.length) return null;
    const exactRanks = prediction.predictedOrder.filter((teamId, i) => actualOrder[i] === teamId).length;
    return {
      exactRanks,
      totalTeams: actualOrder.length,
      championCorrect: !!actualChampion && prediction.predictedChampion === actualChampion,
    };
  }

  /** Admin uniquement, en toute fin de saison : renseigne le classement final réel + le champion, pour que scoreSeasonPrediction puisse comparer. */
  async function setFinalResult(actualOrder, actualChampion) {
    const teams = window.D1P.services.seasonService.listTeams();
    const teamIds = new Set(teams.map((t) => t.id));
    const uniqueOrder = new Set(actualOrder);
    if (actualOrder.length !== teams.length || uniqueOrder.size !== teams.length || [...uniqueOrder].some((id) => !teamIds.has(id))) {
      return { ok: false, reason: 'Le classement doit contenir chaque équipe exactement une fois.' };
    }
    if (!actualChampion || !teamIds.has(actualChampion)) {
      return { ok: false, reason: 'Choisis le vrai champion.' };
    }
    const ok = await window.D1P.services.storageService.setSeasonFinalResult(actualOrder, actualChampion);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    const state = window.D1P.services.stateService.getState();
    state.seasonActualOrder = actualOrder;
    state.seasonActualChampion = actualChampion;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  window.D1P.services.seasonPredictionService = {
    isSeasonLocked, getSeasonPrediction, listSeasonPredictions, saveSeasonPrediction, setLocked,
    scoreSeasonPrediction, setFinalResult,
  };
})();
