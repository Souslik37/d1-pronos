/**
 * D1 Pronos — Règles du jeu
 *
 * Page purement explicative, accessible à tous (pas de logique, pas
 * d'écriture). Les nombres viennent de data/config.js plutôt que d'être
 * écrits en dur ici, pour ne jamais désynchroniser cette page du vrai
 * comportement du jeu si la config change un jour.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;

  function section(icon, title, children) {
    return el('div', {}, [
      el('div', { className: 'section-title' }, [icon + ' ' + title]),
      el('div', { className: 'card' }, children),
    ]);
  }

  function p(text) {
    return el('p', { className: 'small', style: { marginBottom: '10px' } }, [text]);
  }

  function render(root) {
    const S = window.D1P.data.CONFIG.season;
    const P = window.D1P.data.CONFIG.points;

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['📖 Règles du jeu']),
      el('p', {}, ['Tout ce qu\'il faut savoir pour jouer — pas de points compliqués, promis.']),
    ]));

    const wrap = el('div', { style: { display: 'flex', flexDirection: 'column', gap: '20px' } });

    wrap.appendChild(section('🏉', 'Le principe', [
      p('D1 Pronos, c\'est du pronostic pur sur tout le championnat de Belgique D1 — pas de fantasy, pas de joueurs à choisir : juste deviner qui va gagner, semaine après semaine.'),
      p('Deux jeux en un : les pronostics de chaque journée (ci-dessous), et un pronostic unique pour toute la saison à faire avant le coup d\'envoi (voir "Ma saison").'),
    ]));

    wrap.appendChild(section('📅', 'Le championnat', [
      p(`${S.teamsCount} équipes, ${S.totalMatchdays} journées en aller-retour (chaque équipe affronte toutes les autres deux fois — une fois à domicile, une fois à l'extérieur).`),
      p(`À la fin de la saison régulière : les 2 premiers sont exemptés et vont directement en demi-finale, les 3e à ${S.playoffSpots}e jouent les quarts de finale.`),
      p(`En bas de tableau : le ${S.barrageRank}e joue un barrage contre le 1er de D2 pour rester en D1. Les ${S.relegatedFromRank}e et ${S.teamsCount}e descendent directement en D2.`),
    ]));

    wrap.appendChild(section('🎯', 'Tes pronostics chaque semaine', [
      p('Pour chaque match d\'une journée ouverte : tu choisis qui gagne (ou match nul), puis tu peux cocher deux cases si tu penses qu\'elles vont se réaliser — "l\'équipe marque 4 essais ou plus" (bonus offensif, possible pour les deux équipes) et "écart serré de 7 points ou moins" (bonus défensif, seulement pour l\'équipe qui perd).'),
      p('L\'admin ouvre une journée quand c\'est le moment de pronostiquer, puis la verrouille avant le coup d\'envoi — une fois verrouillée, tu ne peux plus rien changer, mais tu peux voir ce que le reste du groupe avait mis.'),
    ]));

    wrap.appendChild(section('🏆', 'Le vrai classement du championnat', [
      p(`Système de points standard du rugby : victoire = ${P.win} points, match nul = ${P.draw} points, défaite = ${P.loss} point. Une équipe qui marque ${P.tryBonusThreshold} essais ou plus dans le match gagne ${P.tryBonusPoints} point de bonus (bonus offensif), et une équipe qui perd par ${P.closeLossMargin} points d\'écart ou moins gagne aussi ${P.closeLossPoints} point (bonus défensif).`),
      p('⚠️ Règle belge : une équipe ne cumule jamais les deux bonus sur le même match. Même si elle remplit les deux conditions (elle marque assez d\'essais ET perd de peu), elle ne gagne qu\'un seul point de bonus au maximum.'),
    ]));

    wrap.appendChild(section('🎯', 'Classement "Qui devine le mieux"', [
      p('Ce classement compte tes pronostics EXACTS — pas juste "as-tu deviné qui gagne". Pour qu\'un match compte, il faut avoir deviné le vainqueur (ou le nul) ET les bonus, exactement comme le vrai résultat. Rien de tout ou une partie : un match mal deviné sur un seul point (même juste un bonus) ne rapporte rien pour celui-là.'),
      p('Exemple : La Hulpe bat le R.O.C. avec le bonus offensif. Si tu avais prédit "La Hulpe gagne + bonus offensif", ce match compte pour toi. Si tu avais juste prédit "La Hulpe gagne" sans le bonus (ou avec le mauvais bonus), ce match ne compte pas — même si tu avais le bon vainqueur.'),
      p('Pourquoi aussi strict ? Pour qu\'il n\'y ait aucun intérêt à cocher les cases bonus "au cas où" — une case bonus cochée à tort te fait perdre le match, donc autant réfléchir avant de cocher.'),
      p('Le classement trie par nombre de pronostics exacts, puis par pourcentage de réussite en cas d\'égalité.'),
    ]));

    wrap.appendChild(section('🔮', 'Ma saison', [
      p('Avant le début de la saison (ou tant que l\'admin n\'a pas fermé les pronostics de saison), tu pronostiques UNE FOIS le classement final complet des 10 équipes, puis le tableau des playoffs qui en découle (quarts, demies, finale).'),
      p('Tu peux enregistrer un brouillon et le modifier autant que tu veux, jusqu\'à ce que tu valides définitivement — à partir de là, c\'est verrouillé, seul l\'admin peut le débloquer en cas d\'erreur.'),
      p('En fin de saison, l\'admin encode le vrai classement final et le vrai tableau des playoffs, et ton pronostic est comparé automatiquement : nombre d\'équipes placées exactement au bon rang, nombre de tours de playoffs correctement devinés, et si tu avais le bon champion.'),
    ]));

    root.appendChild(wrap);
  }

  window.D1P.pages.rules = { render };
})();
