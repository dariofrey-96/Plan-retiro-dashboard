// ── DESLIZAR CON EL DEDO PARA CAMBIAR DE SECCIÓN (sólo touch) ────────────────
// Recorre las secciones principales, las mismas de la barra de abajo.
// Deslizar ← va a la siguiente, → a la anterior. Las sub-pestañas de Proyección
// se siguen cambiando tocándolas, a propósito.
//
// El grueso del efecto lo hace el "pager" de transiciones.js: mientras arrastrás,
// la sección actual y la vecina se mueven juntas siguiendo el dedo. Acá se detecta
// el gesto (con los mismos guardas de siempre) y se le pasa el desplazamiento.
// En los bordes (no hay vecina) o con "reducir movimiento", se usa un modo simple:
// la sección se corre un poco con resistencia y, al soltar, cambia o vuelve.
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
  const MIN_COMMIT = 60;
  let x0 = null, y0 = null, valido = false, decidido = false,
      arrastrando = false, modo = null, el = null, anchoVista = 0;

  function limpiarSimple(elem) {
    if (!elem) return;
    elem.style.transition = '';
    elem.style.transform = '';
    elem.classList.remove('nav-arrastrando');
  }

  function bloqueadoPorPanel() {
    if (document.querySelector('#aside.open, #aside-presu.open')) return true;
    return [...document.querySelectorAll('.modal-overlay')]
      .some(m => getComputedStyle(m).display !== 'none');
  }

  document.addEventListener('touchstart', e => {
    valido = false; decidido = false; arrastrando = false; modo = null; el = null;
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
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decidido = true;
      if (Math.abs(dx) < Math.abs(dy) * 1.2) { valido = false; return; }  // es scroll vertical
      const pdir = dx < 0 ? 1 : -1;
      if (typeof pagerInicio === 'function' && pagerInicio(pdir)) {
        modo = 'pager';
      } else {
        // Modo simple (borde o motion reducido): arrastre con resistencia.
        modo = 'simple';
        el = (typeof pageElDe === 'function') ? pageElDe(seccionActual) : null;
        if (!el) { valido = false; return; }
        document.body.classList.add('nav-dragging');
        el.classList.add('nav-arrastrando');
      }
      arrastrando = true;
    }
    if (!arrastrando) return;
    e.preventDefault();
    if (modo === 'pager') {
      pagerMover(dx);
    } else if (el) {
      let d = dx;
      const idx = seccionActualIdx();
      if ((idx === 0 && dx > 0) || (idx === SECCIONES_APP.length - 1 && dx < 0)) d = dx * 0.32;
      else d = dx * 0.5;   // sin animación de vecina: se corre poco
      el.style.transition = 'none';
      el.style.transform = 'translateX(' + d + 'px)';
    }
  }, { passive: false });

  function terminar(e) {
    const arr = arrastrando, md = modo, elem = el;
    const t = (e.changedTouches && e.changedTouches[0]) || null;
    const dx = (arr && x0 != null && t) ? (t.clientX - x0) : 0;
    valido = false; decidido = false; arrastrando = false; modo = null; el = null;
    x0 = null; y0 = null;

    if (!arr) { if (typeof pagerActivo === 'function' && pagerActivo()) {} return; }

    const umbral = Math.min(120, anchoVista * 0.25) || MIN_COMMIT;

    if (md === 'pager') {
      pagerFin(dx, umbral);
      return;
    }
    // Modo simple:
    document.body.classList.remove('nav-dragging');
    const idx = seccionActualIdx();
    const objetivo = dx < 0 ? idx + 1 : idx - 1;
    const puede = objetivo >= 0 && objetivo < SECCIONES_APP.length;
    if (puede && Math.abs(dx) > umbral) {
      limpiarSimple(elem);
      irASeccion(objetivo);
    } else if (elem) {
      elem.style.transition = 'transform .22s cubic-bezier(.22,.61,.36,1)';
      elem.style.transform = 'translateX(0)';
      const fin = () => { limpiarSimple(elem); elem.removeEventListener('transitionend', fin); };
      elem.addEventListener('transitionend', fin);
      setTimeout(fin, 320);
    }
  }

  document.addEventListener('touchend', terminar, { passive: true });
  document.addEventListener('touchcancel', terminar, { passive: true });
})();

loadHistory();
