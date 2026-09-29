/**
 * D1 Pronos — Pronostic de saison (classement final + tableau de phase finale)
 *
 * Un seul pronostic par manager : le classement final des 10 équipes, ET le
 * vainqueur de chaque tour de playoffs (quarts, demies, finale) — déduits du
 * classement pronostiqué (voir bracketMatchups). Peut être enregistré comme
 * brouillon à volonté, puis VALIDÉ définitivement par le manager lui-même
 * (verrouille sa propre ligne, indépendamment du verrou global de saison) —
 * l'admin peut le déverrouiller en cas d'erreur (voir unlockPrediction).
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

  /** Un manager ne peut plus toucher à son pronostic si LUI l'a validé, OU si l'admin a fermé toute la saison. */
  function isPredictionLocked(managerId) {
    if (isSeasonLocked()) return true;
    const p = getSeasonPrediction(managerId);
    return !!(p && p.locked);
  }

  function emptyBracket() {
    return { qf1Winner: null, qf2Winner: null, sf1Winner: null, sf2Winner: null, finalWinner: null };
  }

  /**
   * Qui affronte qui à chaque tour, déduit du classement (1-6) et des
   * vainqueurs déjà choisis — voir data/config.js pour le format exact
   * (1er-2e exemptés, 3e-6e en quarts). `away` reste `null` tant que le
   * tour précédent n'a pas de vainqueur choisi (ex: SF1 attend qf2Winner).
   */
  function bracketMatchups(order, bracket) {
    bracket = bracket || emptyBracket();
    const seed = (rank) => order[rank - 1] || null;
    return {
      qf1: { home: seed(3), away: seed(6) },
      qf2: { home: seed(4), away: seed(5) },
      sf1: { home: seed(1), away: bracket.qf2Winner || null },
      sf2: { home: seed(2), away: bracket.qf1Winner || null },
      final: { home: bracket.sf1Winner || null, away: bracket.sf2Winner || null },
    };
  }

  /**
   * Retire tout choix qui ne correspond plus à un participant valide — ex:
   * si on réordonne le classement et que le 3e n'est plus le même, un
   * qf1Winner qui pointait vers l'ancien 3e doit disparaître, et tout ce
   * qui en dépendait en cascade (sf2Winner, finalWinner) avec lui.
   */
  function sanitizeBracket(order, bracket) {
    bracket = bracket || emptyBracket();
    const seed = (rank) => order[rank - 1] || null;
    const next = emptyBracket();

    if ([seed(3), seed(6)].includes(bracket.qf1Winner)) next.qf1Winner = bracket.qf1Winner;
    if ([seed(4), seed(5)].includes(bracket.qf2Winner)) next.qf2Winner = bracket.qf2Winner;
    if (next.qf2Winner && [seed(1), next.qf2Winner].includes(bracket.sf1Winner)) next.sf1Winner = bracket.sf1Winner;
    if (next.qf1Winner && [seed(2), next.qf1Winner].includes(bracket.sf2Winner)) next.sf2Winner = bracket.sf2Winner;
    if (next.sf1Winner && next.sf2Winner && [next.sf1Winner, next.sf2Winner].includes(bracket.finalWinner)) next.finalWinner = bracket.finalWinner;

    return next;
  }

  function bracketIsComplete(bracket) {
    return !!(bracket && bracket.qf1Winner && bracket.qf2Winner && bracket.sf1Winner && bracket.sf2Winner && bracket.finalWinner);
  }

  /**
   * `predictedOrder` : tableau des 10 id d'équipes, du 1er au 10e pronostiqué.
   * `predictedBracket` : voir bracketMatchups — doit être COMPLET si `lock`
   * est demandé (une validation définitive doit porter sur un pronostic
   * entier, pas à moitié rempli), sinon peut être partiel (brouillon).
   */
  async function saveSeasonPrediction(predictedOrder, predictedBracket, opts) {
    opts = opts || {};
    const manager = window.D1P.services.managerService.getActiveManager();
    if (isPredictionLocked(manager.id)) {
      return { ok: false, reason: isSeasonLocked() ? 'Les pronostics de saison sont fermés — la saison a commencé.' : 'Ton pronostic est déjà validé — demande à l\'admin de le déverrouiller si tu dois le corriger.' };
    }

    const teams = window.D1P.services.seasonService.listTeams();
    const teamIds = new Set(teams.map((t) => t.id));
    const uniqueOrder = new Set(predictedOrder);
    if (predictedOrder.length !== teams.length || uniqueOrder.size !== teams.length || [...uniqueOrder].some((id) => !teamIds.has(id))) {
      return { ok: false, reason: 'Le classement doit contenir chaque équipe exactement une fois.' };
    }

    const bracket = sanitizeBracket(predictedOrder, predictedBracket);
    if (opts.lock && !bracketIsComplete(bracket)) {
      return { ok: false, reason: 'Complète tout le tableau des playoffs (jusqu\'au champion) avant de valider définitivement.' };
    }

    const prediction = {
      managerId: manager.id, predictedOrder, predictedBracket: bracket,
      locked: !!opts.lock, submittedAt: new Date().toISOString(),
    };

    const ok = await window.D1P.services.storageService.saveSeasonPredictionRow(manager.id, prediction);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };

    const state = window.D1P.services.stateService.getState();
    state.seasonPredictions[manager.id] = prediction;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /** Admin uniquement (RLS season_settings_admin_write) : ferme/rouvre les pronostics de saison POUR TOUT LE MONDE d'un coup. */
  async function setLocked(locked) {
    const ok = await window.D1P.services.storageService.setSeasonLocked(locked);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    window.D1P.services.stateService.getState().seasonLocked = locked;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /** Admin uniquement (RLS season_predictions_update_own_unlocked_or_admin) : déverrouille le pronostic d'UN manager précis (erreur de validation, veut corriger). */
  async function unlockPrediction(managerId) {
    const state = window.D1P.services.stateService.getState();
    const prediction = state.seasonPredictions[managerId];
    if (!prediction) return { ok: false, reason: 'Aucun pronostic à déverrouiller.' };
    const next = { ...prediction, locked: false };
    const ok = await window.D1P.services.storageService.saveSeasonPredictionRow(managerId, next);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    state.seasonPredictions[managerId] = next;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /**
   * Compare un pronostic de saison au classement + tableau final RÉELS — un
   * compteur simple, pas un système de points : nombre d'équipes placées
   * EXACTEMENT au bon rang, et combien de tours de playoffs (sur 5 :
   * QF1/QF2/SF1/SF2/Finale) correctement devinés.
   */
  function scoreSeasonPrediction(prediction, actualOrder, actualBracket) {
    if (!prediction || !actualOrder || !actualOrder.length) return null;
    const exactRanks = prediction.predictedOrder.filter((teamId, i) => actualOrder[i] === teamId).length;
    const rounds = ['qf1Winner', 'qf2Winner', 'sf1Winner', 'sf2Winner', 'finalWinner'];
    const bracketCorrect = actualBracket
      ? rounds.filter((k) => actualBracket[k] && prediction.predictedBracket && prediction.predictedBracket[k] === actualBracket[k]).length
      : 0;
    return {
      exactRanks, totalTeams: actualOrder.length,
      bracketCorrect, totalRounds: rounds.length,
      championCorrect: !!(actualBracket && actualBracket.finalWinner && prediction.predictedBracket && prediction.predictedBracket.finalWinner === actualBracket.finalWinner),
    };
  }

  /** Admin uniquement, en toute fin de saison : renseigne le classement final réel + le tableau des playoffs réel, pour que scoreSeasonPrediction puisse comparer. */
  async function setFinalResult(actualOrder, actualBracket) {
    const teams = window.D1P.services.seasonService.listTeams();
    const teamIds = new Set(teams.map((t) => t.id));
    const uniqueOrder = new Set(actualOrder);
    if (actualOrder.length !== teams.length || uniqueOrder.size !== teams.length || [...uniqueOrder].some((id) => !teamIds.has(id))) {
      return { ok: false, reason: 'Le classement doit contenir chaque équipe exactement une fois.' };
    }
    if (!bracketIsComplete(actualBracket)) {
      return { ok: false, reason: 'Complète tout le tableau des playoffs réel (jusqu\'au champion).' };
    }
    const ok = await window.D1P.services.storageService.setSeasonFinalResult(actualOrder, actualBracket);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    const state = window.D1P.services.stateService.getState();
    state.seasonActualOrder = actualOrder;
    state.seasonActualBracket = actualBracket;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  window.D1P.services.seasonPredictionService = {
    isSeasonLocked, isPredictionLocked, getSeasonPrediction, listSeasonPredictions,
    emptyBracket, bracketMatchups, sanitizeBracket, bracketIsComplete,
    saveSeasonPrediction, setLocked, unlockPrediction, scoreSeasonPrediction, setFinalResult,
  };
})();
