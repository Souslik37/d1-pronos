/**
 * D1 Pronos — Persistance Supabase
 *
 * Seul module autorisé à parler au réseau/à Supabase. Tout le reste de
 * l'app passe par stateService, qui garde une copie en mémoire à jour.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.services = window.D1P.services || {};

  function client() {
    return window.D1P.services.authService.getClient();
  }

  function managerRowToApp(row) {
    return { id: row.id, name: row.name, role: row.role };
  }

  function teamRowToApp(row) {
    return { id: row.id, name: row.name, logoUrl: row.logo_url };
  }

  function matchRowToApp(row) {
    return {
      id: row.id, matchday: row.matchday, homeTeamId: row.home_team_id, awayTeamId: row.away_team_id,
      date: row.date, status: row.status, result: row.result || null,
    };
  }

  function predictionRowToApp(row) {
    return {
      managerId: row.manager_id, matchId: row.match_id, winner: row.winner,
      bonusHome: row.bonus_home, bonusAway: row.bonus_away, closeMargin: row.close_margin,
      submittedAt: row.submitted_at,
    };
  }

  function seasonPredictionRowToApp(row) {
    return {
      managerId: row.manager_id, predictedOrder: row.predicted_order || [],
      predictedBracket: row.predicted_bracket || null, locked: !!row.locked, submittedAt: row.submitted_at,
    };
  }

  function profileRowToApp(row) {
    return { firstName: row.first_name || '', lastName: row.last_name || '', supportedClub: row.supported_club || '' };
  }

  /**
   * Charge tout ce dont l'app a besoin pour démarrer. Les pronostics
   * hebdomadaires de TOUS les managers sont chargés (contrairement à La
   * Hulpe 3) : RLS ne renvoie de toute façon que les siens propres + ceux
   * des journées verrouillées/terminées pour les autres (voir schema.sql),
   * donc pas de fuite possible d'un pronostic encore "en jeu".
   */
  async function loadInitialState(activeManagerId) {
    const [managersRes, teamsRes, matchesRes, predictionsRes, seasonPredictionsRes, settingsRes, profilesRes] = await Promise.all([
      client().from('managers').select('*'),
      client().from('teams').select('*'),
      client().from('matches').select('*').order('matchday'),
      client().from('predictions').select('*'),
      client().from('season_predictions').select('*'),
      client().from('season_settings').select('*').eq('id', 1).maybeSingle(),
      client().from('profiles').select('*'),
    ]);

    for (const res of [managersRes, teamsRes, matchesRes, predictionsRes, seasonPredictionsRes]) {
      if (res.error) throw res.error;
    }
    // Les profils sont un ajout après le lancement : pas dans la boucle ci-dessus — si la table n'existe pas encore (SQL pas encore collé), l'app doit démarrer quand même, juste sans profils.
    if (profilesRes.error) console.warn('[storageService] profils indisponibles', profilesRes.error);

    const managers = {};
    managersRes.data.forEach((row) => { managers[row.id] = managerRowToApp(row); });

    const predictions = {}; // matchId -> managerId -> prediction
    predictionsRes.data.forEach((row) => {
      const p = predictionRowToApp(row);
      predictions[p.matchId] = predictions[p.matchId] || {};
      predictions[p.matchId][p.managerId] = p;
    });

    const seasonPredictions = {}; // managerId -> prediction
    (seasonPredictionsRes.data || []).forEach((row) => {
      const p = seasonPredictionRowToApp(row);
      seasonPredictions[p.managerId] = p;
    });

    const profiles = {}; // managerId -> { firstName, lastName, supportedClub }
    (profilesRes.data || []).forEach((row) => { profiles[row.manager_id] = profileRowToApp(row); });

    return {
      version: 1,
      activeManagerId,
      managers,
      profiles,
      teams: teamsRes.data.map(teamRowToApp),
      matches: matchesRes.data.map(matchRowToApp),
      predictions,
      seasonPredictions,
      seasonLocked: !!(settingsRes.data && settingsRes.data.predictions_locked),
      // Renseignés par l'admin seulement en toute fin de saison (voir
      // seasonPredictionService.scoreSeasonPrediction) — null tant que la
      // saison n'est pas terminée.
      seasonActualOrder: (settingsRes.data && settingsRes.data.actual_order) || null,
      seasonActualBracket: (settingsRes.data && settingsRes.data.actual_bracket) || null,
      // Ordre réglé à la main par l'admin pour départager les égalités de points du vrai classement (voir scoringService.computeStandingsTable) — null tant qu'il n'en a pas fixé.
      standingsOrder: (settingsRes.data && settingsRes.data.standings_order) || null,
    };
  }

  async function saveManagerRole(managerId, role) {
    const { error } = await client().from('managers').update({ role }).eq('id', managerId);
    if (error) console.error('[storageService] échec changement de rôle', error);
    return !error;
  }

  /** Upsert du profil d'UN manager (le sien, ou n'importe lequel pour un admin — voir schema.sql profiles_*). */
  async function saveProfileRow(managerId, profile) {
    const { error } = await client().from('profiles').upsert({
      manager_id: managerId, first_name: profile.firstName || null, last_name: profile.lastName || null,
      supported_club: profile.supportedClub || null, updated_at: new Date().toISOString(),
    });
    if (error) console.error('[storageService] échec sauvegarde du profil', error);
    return !error;
  }

  /** Supprime le profil manager (cascade : ses pronostics disparaissent avec). Ne supprime pas le compte Auth sous-jacent — voir schema.sql. */
  async function deleteManager(managerId) {
    const { error } = await client().from('managers').delete().eq('id', managerId);
    if (error) console.error('[storageService] échec suppression manager', error);
    return !error;
  }

  async function insertTeam(team) {
    const { error } = await client().from('teams').insert({ id: team.id, name: team.name, logo_url: team.logoUrl || null });
    if (error) console.error('[storageService] échec ajout équipe', error);
    return !error;
  }

  async function updateTeam(team) {
    const { error } = await client().from('teams').update({ name: team.name, logo_url: team.logoUrl || null }).eq('id', team.id);
    if (error) console.error('[storageService] échec modification équipe', error);
    return !error;
  }

  async function insertMatch(match) {
    const { error } = await client().from('matches').insert({
      id: match.id, matchday: match.matchday, home_team_id: match.homeTeamId, away_team_id: match.awayTeamId,
      date: match.date, status: match.status,
    });
    if (error) console.error('[storageService] échec ajout match', error);
    return !error;
  }

  async function updateMatch(match) {
    const { error } = await client().from('matches').update({
      home_team_id: match.homeTeamId, away_team_id: match.awayTeamId, date: match.date,
      status: match.status, result: match.result,
    }).eq('id', match.id);
    if (error) console.error('[storageService] échec modification match', error);
    return !error;
  }

  async function deleteMatch(id) {
    const { error } = await client().from('matches').delete().eq('id', id);
    if (error) console.error('[storageService] échec suppression match', error);
    return !error;
  }

  /** Admin uniquement : bascule le statut de TOUS les matchs d'une journée d'un coup (voir schema.sql matches_admin_write). */
  async function setMatchdayStatus(matchday, status) {
    const { error } = await client().from('matches').update({ status }).eq('matchday', matchday);
    if (error) console.error('[storageService] échec changement de statut de journée', error);
    return !error;
  }

  /** Upsert (marche pour soi-même, ou pour un autre manager si admin — voir schema.sql predictions_insert_own_or_admin). */
  async function savePredictionRow(managerId, matchId, prediction) {
    const { error } = await client().from('predictions').upsert({
      manager_id: managerId, match_id: matchId, winner: prediction.winner,
      bonus_home: prediction.bonusHome, bonus_away: prediction.bonusAway, close_margin: prediction.closeMargin,
      submitted_at: prediction.submittedAt,
    });
    if (error) console.error('[storageService] échec sauvegarde pronostic', error);
    return !error;
  }

  async function loadPredictionsForMatch(matchId) {
    const { data, error } = await client().from('predictions').select('*').eq('match_id', matchId);
    if (error) throw error;
    return data;
  }

  async function saveSeasonPredictionRow(managerId, prediction) {
    const { error } = await client().from('season_predictions').upsert({
      manager_id: managerId, predicted_order: prediction.predictedOrder,
      predicted_bracket: prediction.predictedBracket, locked: !!prediction.locked, submitted_at: prediction.submittedAt,
    });
    if (error) console.error('[storageService] échec sauvegarde pronostic de saison', error);
    return !error;
  }

  async function setSeasonLocked(locked) {
    const { error } = await client().from('season_settings').update({ predictions_locked: locked }).eq('id', 1);
    if (error) console.error('[storageService] échec verrouillage saison', error);
    return !error;
  }

  /** Admin uniquement : ordre manuel qui départage les égalités de points du vrai classement. */
  async function setStandingsOrder(order) {
    const { error } = await client().from('season_settings').update({ standings_order: order }).eq('id', 1);
    if (error) console.error('[storageService] échec enregistrement de l\'ordre du classement', error);
    return !error;
  }

  /** Admin uniquement, en toute fin de saison : classement final réel + tableau des playoffs réel, pour pouvoir comparer les pronostics de saison. */
  async function setSeasonFinalResult(actualOrder, actualBracket) {
    const { error } = await client().from('season_settings').update({ actual_order: actualOrder, actual_bracket: actualBracket }).eq('id', 1);
    if (error) console.error('[storageService] échec enregistrement du classement final', error);
    return !error;
  }

  window.D1P.services.storageService = {
    loadInitialState, saveManagerRole, deleteManager, saveProfileRow,
    insertTeam, updateTeam,
    insertMatch, updateMatch, deleteMatch, setMatchdayStatus,
    savePredictionRow, loadPredictionsForMatch,
    saveSeasonPredictionRow, setSeasonLocked, setSeasonFinalResult, setStandingsOrder,
  };
})();
