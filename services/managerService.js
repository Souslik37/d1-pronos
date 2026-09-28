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

  window.D1P.services.managerService = { getActiveManager, listManagers, setRole };
})();
