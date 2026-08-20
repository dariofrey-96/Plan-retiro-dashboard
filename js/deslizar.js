// ── DESLIZAR CON EL DEDO PARA CAMBIAR DE VENTANA (sólo touch) ──────────────
// Recorre las ventanas principales, las mismas de la barra de abajo.
// Deslizar ← va a la siguiente, → a la anterior. Las sub-pestañas de
// Proyección se siguen cambiando tocándolas, a propósito.
// Al unir las dos apps pasaron de dos ventanas a cuatro. La lista sale de
// navegacion.js para que el dedo recorra exactamente lo mismo que la barra: si
// se duplicaba acá, agregar una sección dejaba el gesto desincronizado.
function seccionActualIdx() {
  return SECCIONES_APP.findIndex(s => s.id === seccionActual);
}

function irASeccion(idx) {
  const s = SECCIONES_APP[idx];
  if (!s || s.id === seccionActual) return;
  irASeccionApp(s.id);
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  let x0 = null, y0 = null, valido = false;
  const MIN_DESPLAZAMIENTO = 60; // px — evita disparar con toques temblorosos

  document.addEventListener('touchstart', e => {
    if (e.touches.length !== 1) { valido = false; return; }
    // Cualquiera de los dos paneles abierto bloquea el gesto: cada mitad tiene el suyo.
    const aside = document.querySelector('#aside.open, #aside-presu.open')
                || document.getElementById('aside');
    if (aside && aside.classList.contains('open')) { valido = false; return; } // sidebar abierto: tiene su propio gesto
    // Los modales de esta app se muestran/ocultan con `display` inline, no con una clase.
    const hayModal = [...document.querySelectorAll('.modal-overlay')]
      .some(m => getComputedStyle(m).display !== 'none');
    if (hayModal) { valido = false; return; }
    const t = e.touches[0];
    x0 = t.clientX; y0 = t.clientY;
    valido = !gestoBloqueado(e.target);
  }, { passive: true });

  document.addEventListener('touchend', e => {
    if (!valido || x0 == null) return;
    valido = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - x0, dy = t.clientY - y0;
    // Tiene que ser claramente horizontal, si no se confunde con scroll vertical.
    if (Math.abs(dx) < MIN_DESPLAZAMIENTO || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    const idx = seccionActualIdx();
    irASeccion(dx < 0 ? idx + 1 : idx - 1); // ← siguiente, → anterior
  }, { passive: true });
})();

loadHistory();
