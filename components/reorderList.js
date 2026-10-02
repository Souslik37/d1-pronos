/**
 * D1 Pronos — Liste réordonnable (glisser-déposer + flèches ▲▼)
 *
 * Partagée par "Ma saison" (classement pronostiqué) et Administration
 * (ordre du championnat). Glisser-déposer codé à la main avec les Pointer
 * Events — pas l'API drag-and-drop native du navigateur, peu fiable au
 * tactile — donc souris et doigt passent par exactement le même code.
 * Pendant le glissement seul un aperçu visuel (translateY) bouge ; `order`
 * n'est modifié qu'au relâchement, puis un rerender complet remet tout au
 * propre.
 */
(function () {
  window.D1P = window.D1P || {};
  window.D1P.components = window.D1P.components || {};

  const { el } = window.D1P.utils.dom;

  /**
   * order : tableau d'ids, modifié SUR PLACE (c'est celui de l'appelant).
   * opts.renderContent(id, index) -> Node[] : ce qui s'affiche entre la poignée et les flèches.
   * opts.background(index) -> string|null : couleur de fond de la ligne (facultatif).
   * opts.onChange() : appelé après chaque réordonnancement, `order` déjà à jour (facultatif).
   */
  function build(order, opts) {
    const list = el('div', { className: 'card', style: { position: 'relative' } });

    function move(i, dir) {
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      rerender();
      if (opts.onChange) opts.onChange();
    }

    /** Décale visuellement les autres lignes pour ouvrir un espace à l'endroit où la ligne draguée atterrirait si on lâchait maintenant. */
    function previewShift(fromIndex, targetIndex, draggedRow, pitch) {
      Array.from(list.children).forEach((r, idx) => {
        if (r === draggedRow) return;
        let shift = 0;
        if (fromIndex < targetIndex && idx > fromIndex && idx <= targetIndex) shift = -1;
        else if (fromIndex > targetIndex && idx < fromIndex && idx >= targetIndex) shift = 1;
        r.style.transition = 'transform .12s ease';
        r.style.transform = shift ? `translateY(${shift * pitch}px)` : '';
      });
    }

    function attachDrag(row, handle, getIndex) {
      let dragging = false;
      let startY = 0;
      let pitch = 0;
      let fromIndex = 0;

      function targetFor(clientY) {
        const shift = Math.round((clientY - startY) / pitch);
        return Math.max(0, Math.min(order.length - 1, fromIndex + shift));
      }

      handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        dragging = true;
        fromIndex = getIndex();
        startY = e.clientY;
        // Distance réelle jusqu'à la ligne voisine, marges comprises — offsetHeight seul les ignore et fausse les longs déplacements.
        const rows = Array.from(list.children);
        const neighbor = rows[fromIndex + 1] || rows[fromIndex - 1];
        pitch = neighbor ? Math.abs(neighbor.offsetTop - row.offsetTop) : row.offsetHeight;
        try { handle.setPointerCapture(e.pointerId); } catch (err) { /* pas bloquant — le reorder marche même sans capture */ }
        row.style.position = 'relative';
        row.style.zIndex = '10';
        row.style.boxShadow = '0 6px 16px rgba(35,30,15,.18)';
      });

      handle.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        row.style.transform = `translateY(${e.clientY - startY}px)`;
        previewShift(fromIndex, targetFor(e.clientY), row, pitch);
      });

      function endDrag(e) {
        if (!dragging) return;
        dragging = false;
        try { handle.releasePointerCapture(e.pointerId); } catch (err) { /* idem */ }
        const targetIndex = targetFor(e.clientY);
        if (targetIndex !== fromIndex) {
          const [id] = order.splice(fromIndex, 1);
          order.splice(targetIndex, 0, id);
          if (opts.onChange) opts.onChange();
        }
        rerender();
      }
      handle.addEventListener('pointerup', endDrag);
      handle.addEventListener('pointercancel', endDrag);
    }

    function rerender() {
      list.innerHTML = '';
      order.forEach((id, i) => {
        const bg = opts.background ? opts.background(i) : null;
        const handle = el('span', {
          style: {
            cursor: 'grab', fontSize: '18px', color: 'var(--text-3)', touchAction: 'none',
            padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          },
        }, ['⠿']);
        const row = el('div', {
          className: 'boost-row', style: bg ? { background: bg, borderRadius: '8px', margin: '2px 0', padding: '10px 8px' } : {},
        }, [
          el('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } }, [handle, ...opts.renderContent(id, i)]),
          el('div', { style: { display: 'flex', gap: '4px' } }, [
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === 0, onClick: () => move(i, -1) }, ['▲']),
            el('button', { className: 'btn btn-sm btn-ghost', disabled: i === order.length - 1, onClick: () => move(i, 1) }, ['▼']),
          ]),
        ]);
        attachDrag(row, handle, () => Array.from(list.children).indexOf(row));
        list.appendChild(row);
      });
    }
    rerender();
    return list;
  }

  window.D1P.components.reorderList = { build };
})();
