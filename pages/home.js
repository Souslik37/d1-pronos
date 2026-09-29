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

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Salut ' + manager.name + ' 👋']),
      el('p', {}, ['Pronostics purs sur tout le championnat de Belgique D1 — pas de points compliqués, juste qui gagne.']),
    ]));

    const grid = el('div', { className: 'dash-grid' }, [
      quickCard('🎯', 'Journée ' + targetMatchday, matchdayText, () => { window.D1P.pages.matchday.goTo(targetMatchday); window.location.hash = '#matchday'; }),
      quickCard('🔮', 'Ma saison', seasonLocked ? (seasonPrediction ? 'Pronostic verrouillé — voir le détail' : 'Saison commencée, trop tard') : (seasonPrediction ? 'Modifier mon pronostic' : 'Pas encore fait — à faire avant le coup d\'envoi !'), () => { window.location.hash = '#season'; }),
      quickCard('🏆', 'Classement', 'Le vrai classement du championnat, et qui devine le mieux', () => { window.location.hash = '#standings'; }),
    ]);
    root.appendChild(grid);
  }

  window.D1P.pages.home = { render };
})();
