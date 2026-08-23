// ── TRANSICIONES FLUIDAS ENTRE SECCIONES ────────────────────────────────────
// navegacion.js muestra/oculta cada sección al instante (con `display`). Acá se
// le suma, SIN tocarla, una animación de entrada: la sección que aparece se
// desliza desde el costado hacia donde vas (avanzás = entra por la derecha;
// retrocedés = por la izquierda). Vale igual para el toque en la barra que para
// el deslizar con el dedo (deslizar.js).
//
// Se hace envolviendo irASeccionApp: se guarda la original y se la reemplaza por
// una que la llama y después anima. Es el mismo truco aditivo que ya se usa con
// recalc en el preview; ninguna función original se edita.
(function () {
  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function idxDe(id) { return SECCIONES_APP.findIndex(s => s.id === id); }

  // El elemento "página" de cada sección: es lo que se mueve en la animación y
  // lo que sigue al dedo durante el arrastre.
  function pageElDe(id) {
    switch (id) {
      case 'inicio':  return document.querySelector('#mitad-inicio .view');
      case 'resumen': return document.getElementById('view-resumen');
      case 'gastos':  return document.getElementById('view-gastos');
      case 'retiro':  return document.getElementById('view-retiro');
      case 'cartera': return document.getElementById('view-cartera');
    }
    return null;
  }
  window.pageElDe = pageElDe;

  // dir: +1 la sección entra desde la derecha, -1 desde la izquierda.
  // desde: px opcionales donde el dedo soltó, para que el arranque de la
  // animación sea continuo con el gesto en vez de empezar de cero.
  function animarEntrada(el, dir, desde) {
    if (!el || !dir || reduce) return;
    const x0 = (typeof desde === 'number' && desde !== 0) ? desde : dir * 34;
    try {
      el.animate(
        [{ transform: 'translateX(' + x0 + 'px)', opacity: 0.2 },
         { transform: 'translateX(0)', opacity: 1 }],
        { duration: 300, easing: 'cubic-bezier(.22,.61,.36,1)' }
      );
    } catch (e) {}
  }
  window.animarEntradaSeccion = animarEntrada;

  const _ir = irASeccionApp;
  irASeccionApp = function (id) {
    const desde = idxDe(seccionActual);   // índice ANTES de cambiar
    _ir(id);
    const hasta = idxDe(id);
    const dir = (desde < 0 || hasta < 0 || desde === hasta) ? 0 : (hasta > desde ? 1 : -1);
    animarEntrada(pageElDe(id), dir);
  };
})();
