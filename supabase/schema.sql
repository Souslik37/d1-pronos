-- ============================================================
-- D1 Pronos — Schéma Supabase complet
-- À coller intégralement dans le SQL Editor d'un NOUVEAU projet Supabase
-- (supabase.com/dashboard → New project), une seule fois.
-- ============================================================

-- ── Managers (les gens qui pronostiquent) ───────────────────────────────
create table managers (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null unique,
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now()
);

-- ── Équipes de D1 ────────────────────────────────────────────────────────
create table teams (
  id text primary key,
  name text not null,
  logo_url text
);

-- ── Calendrier ───────────────────────────────────────────────────────────
-- result : { winner: 'home'|'away'|'draw', bonusHome, bonusAway, closeMargin }
-- — la même forme qu'un pronostic, saisie telle quelle par l'admin (pas de
-- score brut ni d'essais) ; null tant que le match n'est pas joué. Les
-- points de classement sont recalculés à la volée depuis ça, jamais stockés.
-- home_team_id/away_team_id : nullable — un match de playoff peut être
-- réservé (journée + date) avant que les deux qualifiés soient connus (voir
-- pages/admin.js buildMatchRow, qui affiche "À déterminer" et laisse les
-- compléter plus tard ; scoringService.computeStandingsTable ignore déjà
-- tout match sans résultat, donc rien d'autre à adapter).
create table matches (
  id text primary key,
  matchday int not null,
  home_team_id text references teams(id),
  away_team_id text references teams(id),
  date date,
  status text not null default 'verrouille' check (status in ('ouvert', 'verrouille', 'termine')),
  result jsonb
);

-- ── Pronostics hebdomadaires (un par manager par match) ─────────────────
-- Pas de score à deviner : juste qui gagne (ou nul) + les deux bonus —
-- voir services/scoringService.js pour le calcul des points à partir de ça.
create table predictions (
  manager_id uuid not null references managers(id) on delete cascade,
  match_id text not null references matches(id) on delete cascade,
  winner text check (winner in ('home', 'away', 'draw')),
  bonus_home boolean not null default false,
  bonus_away boolean not null default false,
  close_margin boolean not null default false,
  submitted_at timestamptz,
  primary key (manager_id, match_id)
);

-- ── Pronostic de saison (un seul par manager, avant le coup d'envoi) ─────
-- predicted_bracket : { qf1Winner, qf2Winner, sf1Winner, sf2Winner,
-- finalWinner } (id d'équipe ou null) — le champion est finalWinner, pas un
-- champ à part (voir seasonPredictionService.bracketMatchups). locked :
-- verrouillé par le manager lui-même en validant définitivement (pas
-- seulement par le verrou global season_settings.predictions_locked) —
-- seul un admin peut le repasser à false (voir la policy update plus bas).
create table season_predictions (
  manager_id uuid primary key references managers(id) on delete cascade,
  predicted_order jsonb not null, -- [team_id, ...] du 1er au 10e
  predicted_bracket jsonb,
  locked boolean not null default false,
  submitted_at timestamptz not null default now()
);

-- ── Réglages de saison : verrou global + classement final réel ──────────
-- Une seule ligne (id=1) : predictions_locked ferme les pronostics de
-- saison une fois la journée 1 lancée ; actual_order/actual_bracket sont
-- renseignés par l'admin en toute fin de saison pour comparer aux
-- pronostics de chacun (voir seasonPredictionService.scoreSeasonPrediction).
-- standings_order : [team_id, ...] réglé à la main par l'admin, ne sert qu'à
-- départager les égalités de POINTS du vrai classement (voir
-- scoringService.computeStandingsTable) — l'appli ne suit pas le différentiel
-- de points marqués que le classement officiel utilise pour ça.
create table season_settings (
  id int primary key default 1,
  predictions_locked boolean not null default false,
  actual_order jsonb,
  actual_bracket jsonb,
  standings_order jsonb,
  check (id = 1)
);
insert into season_settings (id, predictions_locked) values (1, false);

-- ── Profils (prénom, nom, club supporté) ─────────────────────────────────
-- Obligatoires à l'inscription et dans "Mon profil" (vérifié côté appli,
-- managerService.validateProfile) mais colonnes nullables : les premiers
-- inscrits, d'avant l'obligation, n'ont pas de profil.
-- Dans une table À PART et pas des colonnes de `managers` : managers est
-- lisible par n'importe qui (même sans compte, avec la clé publique du
-- site), alors qu'un vrai nom ne doit être lisible que par les comptes
-- connectés — voir les policies et les grants plus bas.
-- supported_club : nom d'un club de D1 (tel que dans teams.name), texte
-- libre, ou "Aucun club" pour qui n'en supporte pas.
create table profiles (
  manager_id uuid primary key references managers(id) on delete cascade,
  first_name text check (char_length(first_name) <= 60),
  last_name text check (char_length(last_name) <= 80),
  supported_club text check (char_length(supported_club) <= 80),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table managers enable row level security;
alter table teams enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table season_predictions enable row level security;
alter table season_settings enable row level security;
alter table profiles enable row level security;

-- Managers : tout le monde peut lire les noms (classement, admin) ; on ne
-- modifie que sa propre ligne, sauf un admin qui peut aussi modifier celle
-- d'un autre (ex: accorder/retirer le rôle admin). Suppression : admin
-- seulement — retire aussi en cascade ses pronostics (voir les tables
-- predictions/season_predictions, `on delete cascade`). Ça ne supprime PAS
-- le compte Supabase Auth sous-jacent (pas de service_role côté client) :
-- s'il tente de se reconnecter, script.js boot() détecte l'absence de
-- profil manager et le renvoie proprement vers l'écran de connexion.
create policy "managers_select_all" on managers for select using (true);
create policy "managers_insert_own" on managers for insert with check (auth.uid() = id);
create policy "managers_update_own_or_admin" on managers for update using (
  auth.uid() = id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
create policy "managers_delete_admin" on managers for delete using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Teams : lecture publique, écriture admin seulement.
create policy "teams_select_all" on teams for select using (true);
create policy "teams_admin_write" on teams for all using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Matches : lecture publique (calendrier/résultats), écriture admin seulement.
create policy "matches_select_all" on matches for select using (true);
create policy "matches_admin_write" on matches for all using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Predictions : chacun lit/écrit les siens ; un admin peut tout lire et
-- tout écrire (y compris INSÉRER pour un AUTRE manager — sert à rattraper
-- un pronostic jamais soumis correctement, pas seulement à corriger un
-- existant). Les pronostics de tout le monde deviennent lisibles par tous
-- pour CE match dès qu'il n'est plus "ouvert" OU que son coup d'envoi est
-- passé (jamais avant, pour ne pas pouvoir copier). Le second critère évite
-- de dépendre de l'admin : à 15h le jour du match, les pronos se dévoilent
-- seuls, sans attendre qu'il pense à cliquer "Verrouiller". Le 15:00 est écrit
-- en dur : à garder aligné avec CONFIG.season.kickoffHour (data/config.js),
-- qui fait le même calcul côté appli (seasonService.isMatchOpen). Heure de
-- Bruxelles. Sans date (playoff pas encore programmé), seul le statut compte.
create policy "predictions_select_own_or_admin" on predictions for select using (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
create policy "predictions_select_locked_matches" on predictions for select using (
  exists (
    select 1 from matches
    where matches.id = predictions.match_id
      and (
        matches.status <> 'ouvert'
        or (matches.date is not null and matches.date + time '15:00' <= (now() at time zone 'Europe/Brussels'))
      )
  )
);
create policy "predictions_insert_own_or_admin" on predictions for insert with check (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
create policy "predictions_update_own_or_admin" on predictions for update using (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Season predictions : chacun lit/écrit le sien ; un admin peut tout
-- lire/écrire ; une fois les pronostics de saison verrouillés
-- (season_settings.predictions_locked), tout le monde peut voir ceux des
-- autres (jamais avant, pour ne pas influencer/copier).
create policy "season_predictions_select_own_or_admin" on season_predictions for select using (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
create policy "season_predictions_select_locked" on season_predictions for select using (
  exists (select 1 from season_settings where id = 1 and predictions_locked = true)
);
create policy "season_predictions_insert_own_or_admin" on season_predictions for insert with check (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
-- Un manager ne peut modifier SA ligne que si elle n'est pas verrouillée
-- (par lui-même en validant définitivement, voir la colonne `locked`) ;
-- un admin peut toujours modifier n'importe laquelle, y compris pour la
-- déverrouiller (WITH CHECK ne revérifie pas `locked` sur la ligne écrite,
-- sinon un manager ne pourrait jamais passer SA propre ligne à locked=true).
create policy "season_predictions_update_own_unlocked_or_admin" on season_predictions for update
  using (
    (auth.uid() = manager_id and locked = false) or exists (select 1 from managers where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
  );

-- Season settings : lecture publique (tout le monde doit savoir si c'est
-- verrouillé), écriture admin seulement.
create policy "season_settings_select_all" on season_settings for select using (true);
create policy "season_settings_admin_write" on season_settings for update using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Profils : lisibles par les comptes connectés seulement. Aucune policy ne
-- s'applique à `anon` (les requêtes sans compte) : RLS lui renvoie zéro
-- ligne. C'est ça qui protège — pas les grants : sur Supabase, `anon` reçoit
-- des droits par défaut sur toute nouvelle table, d'où le `revoke` plus bas
-- qui lui ferme aussi l'accès à la table elle-même. Chacun écrit son profil,
-- un admin peut corriger celui d'un autre.
create policy "profiles_select_authenticated" on profiles for select to authenticated using (true);
create policy "profiles_insert_own_or_admin" on profiles for insert to authenticated with check (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
create policy "profiles_update_own_or_admin" on profiles for update to authenticated
  using (
    auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
  )
  with check (
    auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- Droits Postgres de base — SÉPARÉS des règles RLS ci-dessus. RLS filtre
-- QUELLES lignes sont visibles/modifiables, mais le rôle doit d'abord avoir
-- le droit d'accéder à la table du tout (sinon : "permission denied for
-- table ..."). `anon` = requêtes non connectées, `authenticated` = une fois
-- un manager connecté.
-- ============================================================
grant usage on schema public to anon, authenticated;

grant select on public.managers to anon, authenticated;
grant insert, update, delete on public.managers to authenticated;

grant select on public.teams to anon, authenticated;
grant insert, update, delete on public.teams to authenticated;

grant select on public.matches to anon, authenticated;
grant insert, update, delete on public.matches to authenticated;

grant select, insert, update on public.predictions to authenticated;

grant select, insert, update on public.season_predictions to authenticated;

grant select on public.season_settings to anon, authenticated;
grant update on public.season_settings to authenticated;

grant select, insert, update on public.profiles to authenticated;
revoke all on public.profiles from anon;

-- service_role — utilisé UNIQUEMENT côté serveur (une future Edge Function,
-- ex: réattribuer un code perdu — voir La Hulpe 3 pour le modèle exact le
-- jour où le besoin se présente). Contourne déjà RLS par nature ; ces GRANT
-- sont là dès maintenant (même sans Edge Function pour l'instant) pour ne
-- jamais retomber sur l'erreur "permission denied for table" rencontrée
-- sur La Hulpe 3 le jour où on en ajoutera une.
grant usage on schema public to service_role;
grant select, insert, update, delete on all tables in schema public to service_role;
alter default privileges in schema public grant select, insert, update, delete on tables to service_role;

-- ============================================================
-- Seed : les 10 équipes de D1 (championnat de Belgique, saison 2025-2026)
-- Pas de calendrier pré-rempli : les vrais matchs (journée, adversaires,
-- dates) sont à ajouter depuis Administration une fois en ligne, avec le
-- vrai calendrier officiel LBFR.
-- ============================================================
insert into teams (id, name) values
  ('dendermonde', 'Dendermonde'),
  ('soignies', 'Soignies'),
  ('asub', 'ASUB'),
  ('kituro', 'Kituro'),
  ('boitsfort', 'Boitsfort'),
  ('roc', 'R.O.C.'),
  ('frameries', 'Frameries'),
  ('liege', 'Liège'),
  ('buc', 'BUC'),
  ('lahulpe', 'La Hulpe');
