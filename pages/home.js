/**
 * D1 Pronos — Accueil
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.pages = window.D1P.pages || {};

  const { el } = window.D1P.utils.dom;

  function quickCard(icon, title, text, action) {
    return el('div', { className: 'card', style: { cursor: 'pointer' }, onClick: action }, [
      el('div', { style: { fontSize: '28px', marginBottom: '8px' } }, [icon]),
      el('div', { style: { fontWeight: '750', marginBottom: '4px' } }, [title]),
      el('div', { className: 'muted small' }, [text]),
    ]);
  }

  /**
   * Bandeau jaune tant que le pronostic de saison n'est pas VALIDÉ : pas encore
   * fait, ou brouillon jamais verrouillé par son auteur. Il disparaît tout seul
   * dès qu'il est validé, ou quand l'admin ferme les pronostics de saison pour
   * tout le monde (trop tard pour tous, il n'y a plus rien à relancer).
   */
  function seasonBanner(prediction) {
    const go = () => { window.location.hash = '#season'; };
    const draft = !!prediction;
    // Date limite annoncée (CONFIG.season.seasonPredictionsDeadline) ; sans elle, ou une fois passée, un texte sans date.
    const deadline = window.D1P.services.seasonPredictionService.upcomingDeadline();
    const text = draft
      ? (deadline
        ? 'Il est enregistré en brouillon : valide-le avant le ' + deadline.long + ', date de fermeture des pronostics de saison.'
        : 'Il est enregistré en brouillon : valide-le avant que l\'admin ne ferme les pronostics de saison.')
      : (deadline
        ? 'Le classement final et les playoffs, c\'est rapide. Tu as jusqu\'au ' + deadline.long + ' : ensuite, les pronostics de saison seront fermés.'
        : 'Le classement final et les playoffs, c\'est rapide. À faire dès que possible : quand l\'admin fermera les pronostics de saison, il sera trop tard.');
    return el('div', { className: 'banner-warn', role: 'status', onClick: go }, [
      el('div', { className: 'banner-warn-icon' }, ['🔮']),
      el('div', { className: 'banner-warn-text' }, [
        el('div', { className: 'banner-warn-title' }, [draft ? 'Ton pronostic de saison n\'est pas encore validé' : 'Tu n\'as pas encore fait ton pronostic de saison']),
        el('div', {}, [text]),
      ]),
      el('button', { className: 'btn btn-sm btn-primary', onClick: (e) => { e.stopPropagation(); go(); } }, [draft ? 'Le valider' : 'Le faire maintenant']),
    ]);
  }

  function render(root) {
    const manager = window.D1P.services.managerService.getActiveManager();
    // Toutes les journées OUVERTES à la fois, pas juste "la" journée
    // courante — l'admin peut très bien en ouvrir plusieurs en parallèle
    // (ex: rattraper des pronostics rétroactifs), et la carte ne doit pas
    // dire "tout est fait" juste parce que la PREMIÈRE journée ouverte l'est,
    // en ignorant qu'une autre journée ouverte attend encore des pronostics.
    const openMatches = window.D1P.services.seasonService.listMatches().filter((m) => window.D1P.services.seasonService.isMatchOpen(m));
    const unpredicted = openMatches.filter((m) => window.D1P.services.predictionService.getPrediction(m.id, manager.id).winner === null);
    // Cible du clic : la première journée qui a encore quelque chose à faire ;
    // sinon la première journée ouverte (tout est fait mais on peut y jeter
    // un œil) ; sinon le calcul par défaut (calendrier fermé/à venir).
    const targetMatchday = unpredicted.length ? unpredicted[0].matchday
      : openMatches.length ? openMatches[0].matchday
      : window.D1P.services.seasonService.currentMatchday();
    const matchdayText = !openMatches.length
      ? 'Pronostics fermés — voir les résultats'
      : unpredicted.length
        ? unpredicted.length + ' match' + (unpredicted.length > 1 ? 's' : '') + ' à pronostiquer'
        : 'Tous tes pronostics sont faits ✅';
    const seasonLocked = window.D1P.services.seasonPredictionService.isSeasonLocked();
    const seasonPrediction = window.D1P.services.seasonPredictionService.getSeasonPrediction(manager.id);
    const seasonValidated = !!(seasonPrediction && seasonPrediction.locked);
    const deadline = window.D1P.services.seasonPredictionService.upcomingDeadline();
    const seasonText = seasonLocked
      ? (seasonPrediction ? 'Pronostic verrouillé — voir le détail' : 'Pronostics de saison fermés')
      : seasonValidated ? 'Pronostic validé ✅ — voir le détail'
      : seasonPrediction ? 'Brouillon — à valider' + (deadline ? ' avant le ' + deadline.short : '')
      : 'Pas encore fait — ' + (deadline ? 'jusqu\'au ' + deadline.short : 'à faire dès que possible');

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Salut ' + manager.name + ' 👋']),
      el('p', {}, ['Pronostics purs sur tout le championnat de Belgique D1 — pas de points compliqués, juste qui gagne.']),
    ]));
    if (!seasonLocked && !seasonValidated) root.appendChild(seasonBanner(seasonPrediction));

    const cards = [
      quickCard('🎯', 'Journée ' + targetMatchday, matchdayText, () => { window.D1P.pages.matchday.goTo(targetMatchday); window.location.hash = '#matchday'; }),
      quickCard('🔮', 'Ma saison', seasonText, () => { window.location.hash = '#season'; }),
      quickCard('🏆', 'Classement', 'Le vrai classement du championnat, et qui devine le mieux', () => { window.location.hash = '#standings'; }),
    ];
    // Les inscrits d'avant l'obligation n'ont pas de profil, et sans ce rappel personne ne devine que la pastille en haut à droite est cliquable : il disparaît dès que prénom, nom et club sont renseignés.
    const managers = window.D1P.services.managerService;
    if (!managers.isProfileComplete(managers.getProfile(manager.id))) {
      cards.push(quickCard('👤', 'Complète ton profil', 'Prénom, nom et club que tu supportes — visible des autres joueurs',
        () => window.D1P.components.profile.openEditor()));
    }
    root.appendChild(el('div', { className: 'dash-grid' }, cards));
  }

  window.D1P.pages.home = { render };
})();
