/**
 * D1 Pronos — Configuration Supabase
 *
 * L'URL et la clé "publishable" (anciennement "anon key") sont prévues pour
 * être publiques — elles sont visibles dans le code envoyé au navigateur de
 * chacun. La sécurité réelle vient des règles Row Level Security définies
 * dans supabase/schema.sql, pas du secret de ces valeurs.
 * Ne JAMAIS mettre ici une clé "service_role" (celle-là doit rester secrète).
 *
 * ⚠️ À REMPLIR : crée un nouveau projet sur https://supabase.com/dashboard,
 * puis colle son URL et sa clé publishable ci-dessous (Project Settings →
 * API). Voir README.md pour la procédure complète.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.data = window.D1P.data || {};

  window.D1P.data.SUPABASE_CONFIG = {
    url: 'https://rgonsyjgkycmyhztpuyv.supabase.co',
    publishableKey: 'sb_publishable_Stfi2D0xyEHyxforXbBcUg_5VT0yqg9',
  };
})();
