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
    const matchday = window.D1P.services.seasonService.currentMatchday();
    const matches = window.D1P.services.seasonService.matchesForMatchday(matchday);
    const openMatches = matches.filter((m) => m.status === 'ouvert');
    // Ce qu'il reste VRAIMENT à faire pour CE manager — pas juste "combien de
    // matchs sont ouverts" (ça resterait affiché même après avoir tout
    // soumis, tant que l'admin n'a pas verrouillé la journée).
    const remainingCount = openMatches.filter((m) => window.D1P.services.predictionService.getPrediction(m.id, manager.id).winner === null).length;
    const matchdayText = !openMatches.length
      ? 'Pronostics fermés — voir les résultats'
      : remainingCount
        ? remainingCount + ' match' + (remainingCount > 1 ? 's' : '') + ' à pronostiquer'
        : 'Tous tes pronostics sont faits ✅';
    const seasonLocked = window.D1P.services.seasonPredictionService.isSeasonLocked();
    const seasonPrediction = window.D1P.services.seasonPredictionService.getSeasonPrediction(manager.id);

    root.innerHTML = '';
    root.appendChild(el('div', { className: 'page-header' }, [
      el('h1', {}, ['Salut ' + manager.name + ' 👋']),
      el('p', {}, ['Pronostics purs sur tout le championnat de Belgique D1 — pas de points compliqués, juste qui gagne.']),
    ]));

    const grid = el('div', { className: 'dash-grid' }, [
      quickCard('🎯', 'Journée ' + matchday, matchdayText, () => { window.D1P.pages.matchday.goTo(matchday); window.location.hash = '#matchday'; }),
      quickCard('🔮', 'Ma saison', seasonLocked ? (seasonPrediction ? 'Pronostic verrouillé — voir le détail' : 'Saison commencée, trop tard') : (seasonPrediction ? 'Modifier mon pronostic' : 'Pas encore fait — à faire avant le coup d\'envoi !'), () => { window.location.hash = '#season'; }),
      quickCard('🏆', 'Classement', 'Le vrai classement du championnat, et qui devine le mieux', () => { window.location.hash = '#standings'; }),
    ]);
    root.appendChild(grid);
  }

  window.D1P.pages.home = { render };
})();
