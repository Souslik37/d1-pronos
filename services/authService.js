/**
 * D1 Pronos — Authentification (nom + code à 4 chiffres)
 *
 * Même principe que La Hulpe 3 Fantasy Manager : un vrai compte Supabase
 * Auth email/mot de passe en coulisses, mais l'utilisateur ne voit jamais
 * "email"/"mot de passe" — uniquement son nom et un code à 4 chiffres.
 *
 * ⚠️ Sécurité légère et assumée : adapté à un groupe d'amis, pas à des
 * données sensibles.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.services = window.D1P.services || {};

  const EMAIL_DOMAIN = 'players.d1pronos.local';
  const PASSWORD_PREFIX = 'D1P';

  let client = null;
  function getClient() {
    if (!client) {
      const cfg = window.D1P.data.SUPABASE_CONFIG;
      client = window.supabase.createClient(cfg.url, cfg.publishableKey);
    }
    return client;
  }

  function slugify(name) {
    return String(name)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  function isValidPin(pin) {
    return /^\d{4}$/.test(pin);
  }

  function deriveEmail(name) {
    return `${slugify(name)}@${EMAIL_DOMAIN}`;
  }

  function derivePassword(name, pin) {
    return `${PASSWORD_PREFIX}-${slugify(name)}-${pin}`;
  }

  async function nameIsTaken(name) {
    const { data, error } = await getClient()
      .from('managers')
      .select('id')
      .eq('name', name.trim())
      .maybeSingle();
    if (error) throw error;
    return !!data;
  }

  /**
   * Crée un nouveau profil. Renvoie { ok, reason?, session?, profileSaved? } —
   * NE REJETTE JAMAIS (try/catch large), pour ne jamais bloquer le bouton du
   * formulaire. `profile` (prénom, nom, club — obligatoires, voir
   * managerService.validateProfile) est vérifié AVANT de créer quoi que ce
   * soit, puis enregistré en dernier : si cet enregistrement échoue (table
   * pas encore créée, réseau...), le compte existe déjà et on ne va pas
   * l'annuler pour ça — profileSaved vaut false et l'Accueil redemandera.
   */
  async function signUp(name, pin, profile) {
    name = name.trim();
    if (!name) return { ok: false, reason: 'Choisis un nom.' };
    if (!isValidPin(pin)) return { ok: false, reason: 'Le code doit être composé de 4 chiffres.' };
    const managers = window.D1P.services.managerService;
    const cleanProfile = managers.cleanProfile(profile || {});
    const profileError = managers.validateProfile(cleanProfile);
    if (profileError) return { ok: false, reason: profileError };

    try {
      if (await nameIsTaken(name)) {
        return { ok: false, reason: 'Ce nom est déjà pris — choisis-en un autre.' };
      }

      const email = deriveEmail(name);
      const password = derivePassword(name, pin);
      const { data, error } = await getClient().auth.signUp({ email, password });
      if (error) return { ok: false, reason: error.message };

      const userId = data.user && data.user.id;
      if (!userId) {
        return { ok: false, reason: 'Compte créé mais session absente — vérifie que "Confirm email" est désactivé dans Supabase (Authentication → Providers → Email).' };
      }
      if (!data.session) {
        return { ok: false, reason: 'Compte créé mais pas encore connecté — vérifie que "Confirm email" est désactivé dans Supabase (Authentication → Providers → Email), puis reconnecte-toi.' };
      }

      const { error: insertError } = await getClient().from('managers').insert({
        id: userId, name, role: 'player',
      });
      if (insertError) return { ok: false, reason: insertError.message };

      // Son propre try/catch : une exception ici ne doit surtout pas remonter au catch général, qui afficherait "connexion impossible" alors que le compte vient d'être créé (un nouvel essai dirait "nom déjà pris").
      let profileSaved = false;
      try {
        profileSaved = await window.D1P.services.storageService.saveProfileRow(userId, cleanProfile);
      } catch (e) {
        console.warn('[authService] profil non enregistré à l\'inscription', e);
      }
      return { ok: true, session: data.session, profileSaved };
    } catch (e) {
      console.error('[authService] signUp a échoué de façon inattendue', e);
      return { ok: false, reason: 'Connexion au serveur impossible — vérifie ta connexion internet et réessaie.' };
    }
  }

  /** Connecte un profil existant. Renvoie { ok, reason? }. Ne rejette jamais (voir signUp). */
  async function signIn(name, pin) {
    name = name.trim();
    if (!name || !isValidPin(pin)) {
      return { ok: false, reason: 'Renseigne ton nom et ton code à 4 chiffres.' };
    }
    try {
      const email = deriveEmail(name);
      const password = derivePassword(name, pin);
      const { data, error } = await getClient().auth.signInWithPassword({ email, password });
      if (error) return { ok: false, reason: 'Nom ou code incorrect.' };
      return { ok: true, session: data.session };
    } catch (e) {
      console.error('[authService] signIn a échoué de façon inattendue', e);
      return { ok: false, reason: 'Connexion au serveur impossible — vérifie ta connexion internet et réessaie.' };
    }
  }

  async function signOut() {
    await getClient().auth.signOut();
  }

  async function getSession() {
    const { data } = await getClient().auth.getSession();
    return data.session;
  }

  window.D1P.services.authService = { getClient, signUp, signIn, signOut, getSession, isValidPin };
})();
