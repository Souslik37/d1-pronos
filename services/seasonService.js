/**
 * D1 Pronos — Équipes, calendrier, journées
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.services = window.D1P.services || {};

  function listTeams() {
    const state = window.D1P.services.stateService.getState();
    return state.teams.slice().sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  function getTeam(id) {
    const state = window.D1P.services.stateService.getState();
    return state.teams.find((t) => t.id === id) || null;
  }

  function listMatches() {
    const state = window.D1P.services.stateService.getState();
    return state.matches.slice().sort((a, b) => a.matchday - b.matchday || a.id.localeCompare(b.id));
  }

  function getMatch(id) {
    const state = window.D1P.services.stateService.getState();
    return state.matches.find((m) => m.id === id) || null;
  }

  function matchesForMatchday(matchday) {
    return listMatches().filter((m) => m.matchday === matchday);
  }

  /**
   * Un match n'est réellement ouvert aux pronostics que si l'admin l'a
   * ouvert ET que le coup d'envoi n'est pas encore passé (tous les matchs
   * démarrent à CONFIG.season.kickoffHour) — le verrouillage au coup d'envoi
   * est automatique, pas besoin que l'admin pense à cliquer "Verrouiller" à
   * temps. Sans date connue (playoff pas encore programmé), pas de coupure
   * automatique possible : seul le statut compte.
   */
  function isMatchOpen(match) {
    if (match.status !== 'ouvert') return false;
    if (!match.date) return true;
    const hour = window.D1P.data.CONFIG.season.kickoffHour;
    const [y, m, d] = match.date.split('-').map(Number);
    const kickoff = new Date(y, m - 1, d, hour, 0, 0);
    return new Date() < kickoff;
  }

  /** La journée "ouverte" s'il y en a une (voir isMatchOpen), sinon la première pas encore jouée, sinon la dernière. */
  function currentMatchday() {
    const matches = listMatches();
    if (!matches.length) return 1;
    const open = matches.find((m) => isMatchOpen(m));
    if (open) return open.matchday;
    const notPlayed = matches.find((m) => m.status !== 'termine');
    if (notPlayed) return notPlayed.matchday;
    return matches[matches.length - 1].matchday;
  }

  // ── Équipes (admin) ──────────────────────────────────────────────────────
  async function addTeam(id, name) {
    name = (name || '').trim();
    if (!id || !name) return { ok: false, reason: 'Renseigne un identifiant et un nom.' };
    const state = window.D1P.services.stateService.getState();
    if (state.teams.some((t) => t.id === id)) return { ok: false, reason: 'Cet identifiant existe déjà.' };
    const team = { id, name };
    const ok = await window.D1P.services.storageService.insertTeam(team);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    state.teams.push(team);
    window.D1P.services.stateService.notify();
    return { ok: true, team };
  }

  async function renameTeam(id, name) {
    name = (name || '').trim();
    if (!name) return { ok: false, reason: 'Le nom ne peut pas être vide.' };
    const team = getTeam(id);
    if (!team) return { ok: false, reason: 'Équipe introuvable.' };
    const ok = await window.D1P.services.storageService.updateTeam({ ...team, name });
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    team.name = name;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /** logoUrl : chemin relatif (ex: assets/logos/asub.png) ou URL complète — chaîne vide pour retirer le logo. */
  async function setTeamLogo(id, logoUrl) {
    logoUrl = (logoUrl || '').trim();
    const team = getTeam(id);
    if (!team) return { ok: false, reason: 'Équipe introuvable.' };
    const ok = await window.D1P.services.storageService.updateTeam({ ...team, logoUrl: logoUrl || null });
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    team.logoUrl = logoUrl || null;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /** Ordre réglé à la main pour départager les égalités de points du vrai classement (ids d'équipes), ou null. */
  function getStandingsOrder() {
    return window.D1P.services.stateService.getState().standingsOrder || null;
  }

  /** Admin uniquement (RLS season_settings_admin_write). `order` : ids d'équipes, chacune une seule fois. */
  async function setStandingsOrder(order) {
    const state = window.D1P.services.stateService.getState();
    const known = new Set(state.teams.map((t) => t.id));
    if (!Array.isArray(order) || new Set(order).size !== order.length || order.some((id) => !known.has(id))) {
      return { ok: false, reason: 'Ordre invalide : chaque équipe doit apparaître une seule fois.' };
    }
    const ok = await window.D1P.services.storageService.setStandingsOrder(order);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    state.standingsOrder = order.slice();
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  // ── Calendrier (admin) ───────────────────────────────────────────────────
  async function addMatch({ matchday, homeTeamId, awayTeamId, date }) {
    matchday = Number(matchday);
    if (!Number.isInteger(matchday) || matchday < 1) return { ok: false, reason: 'Numéro de journée invalide.' };
    if (!homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return { ok: false, reason: 'Choisis deux équipes différentes.' };
    if (!date) return { ok: false, reason: 'Renseigne une date.' };

    const state = window.D1P.services.stateService.getState();
    const match = {
      id: window.D1P.utils.id.uid('m'), matchday, homeTeamId, awayTeamId, date,
      status: 'verrouille', result: null,
    };
    const ok = await window.D1P.services.storageService.insertMatch(match);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    state.matches.push(match);
    window.D1P.services.stateService.notify();
    return { ok: true, match };
  }

  async function updateMatchInfo(id, { homeTeamId, awayTeamId, date }) {
    const match = getMatch(id);
    if (!match) return { ok: false, reason: 'Match introuvable.' };
    const next = {
      ...match,
      homeTeamId: homeTeamId !== undefined ? (homeTeamId || null) : match.homeTeamId,
      awayTeamId: awayTeamId !== undefined ? (awayTeamId || null) : match.awayTeamId,
      date: date !== undefined ? date : match.date,
    };
    const ok = await window.D1P.services.storageService.updateMatch(next);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    Object.assign(match, next);
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  async function removeMatch(id) {
    const ok = await window.D1P.services.storageService.deleteMatch(id);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };
    const state = window.D1P.services.stateService.getState();
    state.matches = state.matches.filter((m) => m.id !== id);
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /** Admin uniquement : ouvre/verrouille TOUS les matchs d'une journée d'un coup (les 5 se jouent le même week-end). */
  async function setMatchdayStatus(matchday, status) {
    const ok = await window.D1P.services.storageService.setMatchdayStatus(matchday, status);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    matchesForMatchday(matchday).forEach((m) => { m.status = status; });
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /**
   * Encode le résultat officiel d'UN match (les 4 autres de la journée
   * peuvent être encodés séparément au fur et à mesure). Réservé à l'admin
   * (seul rôle autorisé à écrire les matchs de tout le monde côté Supabase).
   *
   * Contrairement à La Hulpe 3, il n'y a rien à "noter" ni à persister ici :
   * aucun PE à distribuer, aucun total qui s'accumule. "Ce pronostic était
   * bon ou pas" est une simple comparaison calculée à l'affichage (voir
   * scoringService.computePoints/isPredictionCorrect) entre le pronostic
   * déjà en base et ce `result` — jamais stockée nulle part.
   */
  async function finalizeMatch(id, result) {
    const match = getMatch(id);
    if (!match) return { ok: false, reason: 'Match introuvable.' };
    const next = { ...match, result, status: 'termine' };
    const ok = await window.D1P.services.storageService.updateMatch(next);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    Object.assign(match, next);
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /** Admin uniquement : annule la notation d'un match déjà joué (essai, erreur de manipulation) — remet le match verrouillé, les pronostics restent intacts. */
  async function unfinalizeMatch(id) {
    const match = getMatch(id);
    if (!match) return { ok: false, reason: 'Match introuvable.' };
    const next = { ...match, result: null, status: 'verrouille' };
    const ok = await window.D1P.services.storageService.updateMatch(next);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    Object.assign(match, next);
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  window.D1P.services.seasonService = {
    listTeams, getTeam, listMatches, getMatch, matchesForMatchday, currentMatchday, isMatchOpen,
    getStandingsOrder, setStandingsOrder, addTeam, renameTeam, setTeamLogo, addMatch, updateMatchInfo, removeMatch, setMatchdayStatus,
    finalizeMatch, unfinalizeMatch,
  };
})();
