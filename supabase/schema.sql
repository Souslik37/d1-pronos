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
-- result : { scoreHome, scoreAway, triesHome, triesAway } — null tant que
-- le match n'est pas joué. Tout le reste (vainqueur, bonus, points de
-- classement) est recalculé à la volée depuis ces 4 nombres, jamais stocké.
create table matches (
  id text primary key,
  matchday int not null,
  home_team_id text not null references teams(id),
  away_team_id text not null references teams(id),
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
create table season_predictions (
  manager_id uuid primary key references managers(id) on delete cascade,
  predicted_order jsonb not null, -- [team_id, ...] du 1er au 10e
  predicted_champion text references teams(id),
  submitted_at timestamptz not null default now()
);

-- ── Réglages de saison : verrou global + classement final réel ──────────
-- Une seule ligne (id=1) : predictions_locked ferme les pronostics de
-- saison une fois la journée 1 lancée ; actual_order/actual_champion sont
-- renseignés par l'admin en toute fin de saison pour comparer aux
-- pronostics de chacun (voir seasonPredictionService.scoreSeasonPrediction).
create table season_settings (
  id int primary key default 1,
  predictions_locked boolean not null default false,
  actual_order jsonb,
  actual_champion text references teams(id),
  check (id = 1)
);
insert into season_settings (id, predictions_locked) values (1, false);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table managers enable row level security;
alter table teams enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;
alter table season_predictions enable row level security;
alter table season_settings enable row level security;

-- Managers : tout le monde peut lire les noms (classement, admin) ; on ne
-- modifie que sa propre ligne, sauf un admin qui peut aussi modifier celle
-- d'un autre (ex: accorder/retirer le rôle admin).
create policy "managers_select_all" on managers for select using (true);
create policy "managers_insert_own" on managers for insert with check (auth.uid() = id);
create policy "managers_update_own_or_admin" on managers for update using (
  auth.uid() = id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
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
-- existant). Une fois qu'un match n'est plus "ouvert", tout le monde peut
-- lire les pronostics de tout le monde pour CE match (jamais tant qu'il
-- est encore ouvert, pour ne pas pouvoir copier).
create policy "predictions_select_own_or_admin" on predictions for select using (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);
create policy "predictions_select_locked_matches" on predictions for select using (
  exists (select 1 from matches where id = predictions.match_id and status <> 'ouvert')
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
create policy "season_predictions_update_own_or_admin" on season_predictions for update using (
  auth.uid() = manager_id or exists (select 1 from managers where id = auth.uid() and role = 'admin')
);

-- Season settings : lecture publique (tout le monde doit savoir si c'est
-- verrouillé), écriture admin seulement.
create policy "season_settings_select_all" on season_settings for select using (true);
create policy "season_settings_admin_write" on season_settings for update using (
  exists (select 1 from managers where id = auth.uid() and role = 'admin')
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
grant insert, update on public.managers to authenticated;

grant select on public.teams to anon, authenticated;
grant insert, update, delete on public.teams to authenticated;

grant select on public.matches to anon, authenticated;
grant insert, update, delete on public.matches to authenticated;

grant select, insert, update on public.predictions to authenticated;

grant select, insert, update on public.season_predictions to authenticated;

grant select on public.season_settings to anon, authenticated;
grant update on public.season_settings to authenticated;

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
