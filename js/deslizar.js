// ── DESLIZAR CON EL DEDO PARA CAMBIAR DE SECCIÓN (sólo touch) ────────────────
// Recorre las secciones principales, las mismas de la barra de abajo.
// Deslizar ← va a la siguiente, → a la anterior. Las sub-pestañas de Proyección
// se siguen cambiando tocándolas, a propósito.
//
// El contenido sigue al dedo en vivo: mientras arrastrás se mueve con vos y, al
// soltar, o confirma el cambio (y la sección nueva entra deslizándose, vía
// transiciones.js) o vuelve a su lugar con un rebote. La lista de secciones sale
// de navegacion.js para que el dedo recorra exactamente lo mismo que la barra.
function seccionActualIdx() {
  return SECCIONES_APP.findIndex(s => s.id === seccionActual);
}

function irASeccion(idx) {
  const s = SECCIONES_APP[idx];
  if (!s || s.id === seccionActual) return;
  irASeccionApp(s.id);
  window.scrollTo({ top: 0, behavior: 'auto' });
}

// Un deslizamiento que arranca sobre algo que se mueve de costado (una tabla
// ancha, la tira de pestañas, la fila de KPIs) tiene que mover ESO, no cambiar
// de sección. Lo mismo sobre un gráfico (toca para ver el dato) o un slider.
function gestoBloqueado(el) {
  for (let n = el; n && n !== document.body; n = n.parentElement) {
    if (n.tagName === 'CANVAS' || n.tagName === 'SELECT' || n.tagName === 'TEXTAREA') return true;
    if (n.tagName === 'INPUT' && n.type === 'range') return true;
    if (n.id === 'aside' || n.id === 'aside-presu') return true;
    const est = getComputedStyle(n);
    if ((est.overflowX === 'auto' || est.overflowX === 'scroll') && n.scrollWidth > n.clientWidth + 4) return true;
  }
  return false;
}

(function () {
  const MIN_COMMIT = 60;   // respaldo mínimo en px si no se pudo medir el ancho
  let x0 = null, y0 = null, valido = false, decidido = false,
      arrastrando = false, el = null, anchoVista = 0;

  function limpiar(elem) {
    if (!elem) return;
    elem.style.transition = '';
    elem.style.transform = '';
    elem.classList.remove('nav-arrastrando');
  }

  // Cualquier panel o modal abierto tiene su propio gesto: soltamos éste.
  function bloqueadoPorPanel() {
    if (document.querySelector('#aside.open, #aside-presu.open')) return true;
    return [...document.querySelectorAll('.modal-overlay')]
      .some(m => getComputedStyle(m).display !== 'none');
  }

  document.addEventListener('touchstart', e => {
    valido = false; decidido = false; arrastrando = false; el = null;
    if (e.touches.length !== 1) return;
    if (bloqueadoPorPanel()) return;
    if (gestoBloqueado(e.target)) return;
    const t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY;
    anchoVista = window.innerWidth || document.documentElement.clientWidth || 0;
    valido = true;
  }, { passive: true });

  document.addEventListener('touchmove', e => {
    if (!valido || x0 == null) return;
    const t = e.touches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;

    if (!decidido) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;   // todavía indeciso
      decidido = true;
      // Más vertical que horizontal ⇒ es scroll: soltamos el gesto.
      if (Math.abs(dx) < Math.abs(dy) * 1.2) { valido = false; return; }
      el = (typeof pageElDe === 'function') ? pageElDe(seccionActual) : null;
      if (!el) { valido = false; return; }
      arrastrando = true;
      document.body.classList.add('nav-dragging');
      el.classList.add('nav-arrastrando');
    }
    if (!arrastrando || !el) return;
    e.preventDefault();   // evita que la página arranque un scroll horizontal raro
    const idx = seccionActualIdx();
    let d = dx;
    // Resistencia elástica en los extremos: si no hay a dónde ir, cuesta más.
    if ((idx === 0 && dx > 0) || (idx === SECCIONES_APP.length - 1 && dx < 0)) d = dx * 0.32;
    el.style.transition = 'none';
    el.style.transform = 'translateX(' + d + 'px)';
  }, { passive: false });

  function terminar(e) {
    const elem = el, arr = arrastrando;
    const t = (e.changedTouches && e.changedTouches[0]) || null;
    const dx = (arr && x0 != null && t) ? (t.clientX - x0) : 0;
    // Reset del estado antes de cualquier animación.
    valido = false; decidido = false; arrastrando = false;
    x0 = null; y0 = null; el = null;
    document.body.classList.remove('nav-dragging');
    if (!arr || !elem) { limpiar(elem); return; }

    const idx = seccionActualIdx();
    const objetivo = dx < 0 ? idx + 1 : idx - 1;
    const puede = objetivo >= 0 && objetivo < SECCIONES_APP.length;
    const umbral = Math.min(120, anchoVista * 0.25) || MIN_COMMIT;

    if (puede && Math.abs(dx) > umbral) {
      // Confirmar: cambiamos de sección (el saliente se oculta al instante) y
      // dejamos limpio su transform. La entrante aparece deslizándose sola.
      irASeccion(objetivo);
      limpiar(elem);
    } else {
      // Volver a su lugar con un rebote corto.
      elem.style.transition = 'transform .22s cubic-bezier(.22,.61,.36,1)';
      elem.style.transform = 'translateX(0)';
      const fin = () => { limpiar(elem); elem.removeEventListener('transitionend', fin); };
      elem.addEventListener('transitionend', fin);
      setTimeout(fin, 320);   // respaldo por si transitionend no dispara
    }
  }

  document.addEventListener('touchend', terminar, { passive: true });
  document.addEventListener('touchcancel', terminar, { passive: true });
})();

loadHistory();
