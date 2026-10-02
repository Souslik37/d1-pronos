/**
 * D1 Pronos — Managers (les gens qui pronostiquent)
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.services = window.D1P.services || {};

  function getActiveManager() {
    const state = window.D1P.services.stateService.getState();
    if (!state) return null;
    return state.managers[state.activeManagerId] || null;
  }

  function listManagers() {
    const state = window.D1P.services.stateService.getState();
    return Object.values(state.managers).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  /** Admin uniquement (RLS managers_admin_write) : retire ou accorde le rôle admin à un manager. */
  async function setRole(managerId, role) {
    const state = window.D1P.services.stateService.getState();
    const manager = state.managers[managerId];
    if (!manager) return { ok: false, reason: 'Manager introuvable.' };
    const ok = await window.D1P.services.storageService.saveManagerRole(managerId, role);
    if (!ok) return { ok: false, reason: 'Écriture impossible — vérifie ta connexion et réessaie.' };
    manager.role = role;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /** Admin uniquement (RLS managers_delete_admin) : retire un manager du jeu — ses pronostics et son profil disparaissent avec (cascade). */
  async function removeManager(managerId) {
    const state = window.D1P.services.stateService.getState();
    if (!state.managers[managerId]) return { ok: false, reason: 'Manager introuvable.' };
    const ok = await window.D1P.services.storageService.deleteManager(managerId);
    if (!ok) return { ok: false, reason: 'Suppression impossible — vérifie ta connexion et réessaie.' };
    delete state.managers[managerId];
    Object.keys(state.predictions).forEach((matchId) => { delete state.predictions[matchId][managerId]; });
    delete state.seasonPredictions[managerId];
    if (state.profiles) delete state.profiles[managerId];
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  /** Profil d'un manager (prénom, nom, club supporté) — champs vides tant que la personne ne l'a pas rempli. */
  function getProfile(managerId) {
    const state = window.D1P.services.stateService.getState();
    return (state.profiles && state.profiles[managerId]) || { firstName: '', lastName: '', supportedClub: '' };
  }

  /** "Prénom Nom" (ou seulement ce qui est renseigné) ; chaîne vide si rien. */
  function fullName(profile) {
    return [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  }

  /**
   * Prénom, nom et club sont obligatoires (à l'inscription comme dans "Mon
   * profil"). Pour qui ne supporte aucun club, "Aucun club" est une réponse
   * valable — sinon on récolterait des clubs bidon. Renvoie le message
   * d'erreur à afficher, ou null si c'est bon.
   */
  function validateProfile(profile) {
    if (!(profile.firstName || '').trim()) return 'Renseigne ton prénom.';
    if (!(profile.lastName || '').trim()) return 'Renseigne ton nom.';
    if (!(profile.supportedClub || '').trim()) return 'Choisis le club que tu supportes (ou « Aucun club en particulier »).';
    return null;
  }

  function isProfileComplete(profile) {
    return validateProfile(profile) === null;
  }

  /** Nettoie (espaces, longueurs max alignées sur les contraintes de la table profiles). */
  function cleanProfile(data) {
    return {
      firstName: (data.firstName || '').trim().slice(0, 60),
      lastName: (data.lastName || '').trim().slice(0, 80),
      supportedClub: (data.supportedClub || '').trim().slice(0, 80),
    };
  }

  /** Chacun enregistre SON profil (RLS : un admin peut aussi corriger celui d'un autre). */
  async function saveProfile(managerId, data) {
    const state = window.D1P.services.stateService.getState();
    if (!state.managers[managerId]) return { ok: false, reason: 'Manager introuvable.' };
    const profile = cleanProfile(data);
    const invalid = validateProfile(profile);
    if (invalid) return { ok: false, reason: invalid };
    const ok = await window.D1P.services.storageService.saveProfileRow(managerId, profile);
    if (!ok) return { ok: false, reason: 'Enregistrement impossible — vérifie ta connexion et réessaie.' };
    state.profiles = state.profiles || {};
    state.profiles[managerId] = profile;
    window.D1P.services.stateService.notify();
    return { ok: true };
  }

  window.D1P.services.managerService = {
    getActiveManager, listManagers, setRole, removeManager,
    getProfile, fullName, validateProfile, isProfileComplete, cleanProfile, saveProfile,
  };
})();
