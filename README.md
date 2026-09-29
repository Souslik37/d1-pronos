# D1 Pronos

Pronostics purs sur le championnat de Belgique de rugby D1 — qui gagne (ou
match nul) à chaque journée, avec les bonus offensif/défensif du vrai
classement, plus un pronostic complet de la saison entière (classement
final + champion) fait avant le coup d'envoi. Aucun système de points
compliqué : juste un compteur simple de qui devine le mieux.

Même architecture que La Hulpe 3 Fantasy Manager : HTML/CSS/JS vanilla, pas
de build, backend Supabase (Postgres + Auth + RLS), déployable gratuitement
sur GitHub Pages.

## Mise en route (à faire une fois)

### 1. Créer le projet Supabase

1. Va sur [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**.
2. Une fois créé : **Project Settings → API** → note l'**URL** et la clé **publishable** (`sb_publishable_...`).
3. Ouvre `data/supabaseConfig.js` et remplace les deux valeurs `REMPLACE_MOI`.
4. **Authentication → Providers → Email** : désactive **"Confirm email"** (sinon l'inscription ne connecte pas automatiquement).
5. **SQL Editor** → colle l'intégralité de `supabase/schema.sql` → **Run**. Ça crée les tables, les règles de sécurité, et les 10 équipes de D1.

### 2. Ajouter le vrai calendrier

Le schéma ne contient QUE les 10 équipes — pas de calendrier pré-rempli
(je n'avais pas le vrai calendrier officiel LBFR sous la main). Une fois
connecté en tant qu'admin (voir plus bas), va dans **Administration** et
ajoute les 18 journées × 5 matchs avec les vraies dates.

### 3. Se connecter et devenir admin

1. Ouvre `index.html` dans un navigateur (ou héberge le dossier, voir plus bas).
2. Crée ton profil (nom + code à 4 chiffres — pas de mot de passe classique).
3. Dans Supabase, **Table Editor → managers** → trouve ta ligne → change `role` de `player` à `admin`.
4. Recharge la page : le menu **Administration** apparaît.

### 4. Déployer (GitHub Pages)

1. Crée un nouveau repo GitHub (public ou privé).
2. `git remote add origin <url-du-repo>` puis `git push -u origin main`.
3. **Settings → Pages** → Source : la branche `main`, dossier `/ (root)`.
4. Le site est en ligne à `https://<ton-user>.github.io/<nom-du-repo>/`.

## Comment ça marche

- **Pronostics** (par journée) : pour chaque match, qui gagne (ou nul), et
  si l'une des deux équipes marque 4 essais ou plus (bonus offensif). Si le
  match se termine par un écart de 7 points ou moins, l'équipe perdante
  touche un bonus défensif — coché au pronostic si prévu. Tout se calcule
  automatiquement en points de classement (`services/scoringService.js`).
- **Ma saison** : un seul pronostic, avant le début de la saison —
  classement final des 10 équipes + qui remporte le titre (les playoffs
  peuvent désigner un champion différent du 1er de saison régulière).
  Verrouillé par l'admin une fois la saison lancée.
- **Classement** : le vrai classement du championnat (recalculé depuis les
  résultats encodés, jamais stocké séparément), et qui devine le mieux
  dans le groupe (compteur simple, aucun point compliqué).
- **Administration** : équipes, calendrier, encodage des résultats
  officiels (score + essais — les essais servent au bonus offensif),
  managers, verrouillage des pronostics de saison, et classement final réel
  à renseigner en toute fin de saison pour comparer aux pronostics de chacun.

## Format du championnat (voir `data/config.js`)

10 équipes, aller-retour (18 journées). Les 6 premiers accèdent aux
playoffs (1er-2e exemptés, direct en demi ; 3e-6e en quarts) → quarts →
demies → finale. Les 4 derniers jouent les play-downs : les 9e et 10e
descendent directement en D2, le 8e joue un barrage contre le 1er de D2.

## Pour la suite (pas fait dans cette première version)

- **Réinitialiser un code oublié** : pas encore de bouton admin pour ça
  (contrairement à La Hulpe 3). Le jour où quelqu'un perd son code, on peut
  reprendre exactement le même mécanisme (Edge Function Supabase) que sur
  La Hulpe 3 — demande-le simplement.
- **Vrais logos d'équipe** : actuellement des badges "initiales + couleur"
  générés automatiquement (`utils/avatar.js`). Fournir une image bascule
  automatiquement dessus si on veut les ajouter plus tard.
