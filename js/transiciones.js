// ── TRANSICIONES FLUIDAS ENTRE SECCIONES ────────────────────────────────────
// navegacion.js muestra/oculta cada sección al instante (con `display`). Acá se
// le suman, SIN tocarla, dos cosas:
//
//  1) Al tocar la barra/pestañas: la sección que aparece se desliza desde el
//     costado hacia donde vas (animarEntrada, montada sobre irASeccionApp).
//
//  2) Al deslizar con el dedo (lo maneja deslizar.js, que llama al "pager" de
//     acá): las DOS secciones se mueven juntas: la que se va sale por un lado y
//     la que viene entra por el otro, en vivo, acompañando el dedo.
//
// El pager no mueve elementos de lugar (eso rompería los estilos encapsulados
// de la mitad de presupuesto y los de inicio): a la sección entrante la pone en
// `position:fixed` recortada al área de contenido, y desliza esa capa junto con
// la saliente. Si cruzás entre mitades (Gastos↔Proyección, Inicio↔Resumen)
// deslizan las mitades enteras; si es dentro de una misma mitad (Resumen↔Gastos,
// Proyección↔Cartera) deslizan sólo las vistas y lo de arriba queda fijo.
(function () {
  const reduce = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function idxDe(id) { return SECCIONES_APP.findIndex(s => s.id === id); }
  function mitadDe(id) { const s = SECCIONES_APP.find(x => x.id === id); return s ? s.mitad : null; }

  // El elemento "página" de cada sección (para la animación de entrada por toque).
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
  window.irSeccionSinAnimacion = function (id) { _ir(id); };
  irASeccionApp = function (id) {
    const desde = idxDe(seccionActual);
    _ir(id);
    const hasta = idxDe(id);
    const dir = (desde < 0 || hasta < 0 || desde === hasta) ? 0 : (hasta > desde ? 1 : -1);
    animarEntrada(pageElDe(id), dir);
  };

  // ════════════════ PAGER (deslizar con el dedo, dos secciones a la vez) ═════

  let P = null; // estado del arrastre en curso

  function renderFor(id) {
    const nom = { inicio: 'renderInicio', resumen: 'renderResumen', gastos: 'renderGastos', cartera: 'renderCartera' }[id];
    if (nom && typeof window[nom] === 'function') { try { window[nom](); } catch (e) {} }
  }

  // Ajusta qué sub-vista muestra una MITAD entrante (segura de tocar porque no es
  // la que estás viendo) y la dibuja.
  function ajustarSubvistaMitad(tgt) {
    const g = id => document.getElementById(id);
    if (tgt === 'cartera') { g('view-retiro') && g('view-retiro').classList.remove('active'); g('view-cartera') && g('view-cartera').classList.add('active'); }
    else if (tgt === 'retiro') { g('view-cartera') && g('view-cartera').classList.remove('active'); g('view-retiro') && g('view-retiro').classList.add('active'); }
    else if (tgt === 'resumen') { g('view-gastos') && (g('view-gastos').style.display = 'none'); g('view-resumen') && (g('view-resumen').style.display = ''); }
    else if (tgt === 'gastos') { g('view-resumen') && (g('view-resumen').style.display = 'none'); g('view-gastos') && (g('view-gastos').style.display = ''); }
    renderFor(tgt);
  }

  // Deja un elemento como capa fija recortada al área de contenido, corrida `tx`.
  function fijar(el, left, top, W, height, tx) {
    el.style.position = 'fixed';
    el.style.left = left + 'px';
    el.style.top = top + 'px';
    el.style.width = W + 'px';
    el.style.height = height + 'px';
    el.style.margin = '0';
    el.style.overflow = 'hidden';
    el.style.zIndex = '45';
    el.style.background = 'var(--bg)';
    el.style.transition = 'none';
    el.style.willChange = 'transform';
    el.style.display = el.classList.contains('view') ? 'flex' : '';
    el.style.transform = 'translateX(' + tx + 'px)';
  }

  function restaurarTodo(estado) {
    (estado.toques || []).forEach(t => {
      if (t.style === null) t.el.removeAttribute('style'); else t.el.setAttribute('style', t.style);
      t.el.className = t.cls;
    });
  }

  // pdir: +1 la vecina entra por la derecha (sección siguiente), -1 por la
  // izquierda (anterior). Devuelve true si armó el pager; false si no hay vecina
  // o si conviene el modo simple (bordes, motion reducido).
  window.pagerInicio = function (pdir) {
    if (reduce) return false;
    const toques = [];
    const snap = el => { if (el) toques.push({ el, style: el.getAttribute('style'), cls: el.className }); };
    try {
      const cur = seccionActual;
      const idx = idxDe(cur);
      const oi = idx + (pdir > 0 ? 1 : -1);
      if (oi < 0 || oi >= SECCIONES_APP.length) return false;
      const tgt = SECCIONES_APP[oi].id;

      const header = document.querySelector('header');
      const nav = document.getElementById('bottom-nav');
      const headerBottom = header ? Math.round(header.getBoundingClientRect().bottom) : 0;
      const navVisible = nav && getComputedStyle(nav).display !== 'none';
      const navTop = navVisible ? Math.round(nav.getBoundingClientRect().top) : window.innerHeight;

      let curLayer, inLayer, W, left, top, height;

      if (mitadDe(cur) === mitadDe(tgt)) {
        // Intra-mitad: deslizan sólo las vistas; lo de arriba queda fijo.
        curLayer = pageElDe(cur);
        inLayer = pageElDe(tgt);
        if (!curLayer || !inLayer) return false;
        const r = curLayer.getBoundingClientRect();
        W = Math.round(r.width); left = Math.round(r.left);
        top = Math.max(headerBottom, Math.round(r.top));
        height = navTop - top;
        snap(curLayer); snap(inLayer);
        fijar(inLayer, left, top, W, height, pdir * W);
        renderFor(tgt);
      } else {
        // Inter-mitad: deslizan las mitades enteras.
        curLayer = document.getElementById('mitad-' + mitadDe(cur));
        inLayer = document.getElementById('mitad-' + mitadDe(tgt));
        if (!curLayer || !inLayer) return false;
        W = Math.round(window.innerWidth); left = 0;
        top = headerBottom; height = navTop - top;
        snap(curLayer); snap(inLayer);
        ['view-retiro', 'view-cartera', 'view-resumen', 'view-gastos'].forEach(id => snap(document.getElementById(id)));
        inLayer.style.display = '';
        ajustarSubvistaMitad(tgt);
        fijar(inLayer, left, top, W, height, pdir * W);
      }

      if (height <= 0) { restaurarTodo({ toques }); return false; }

      curLayer.style.transition = 'none';
      curLayer.style.transform = 'translateX(0px)';
      curLayer.style.willChange = 'transform';

      P = { pdir, tgt, curLayer, inLayer, W, toques };
      document.body.classList.add('nav-dragging');
      return true;
    } catch (e) {
      try { restaurarTodo({ toques }); } catch (_) {}
      P = null;
      return false;
    }
  };

  window.pagerMover = function (dx) {
    if (!P) return;
    const d = P.pdir > 0 ? Math.min(0, dx) : Math.max(0, dx);  // sólo en la dirección comprometida
    P.curLayer.style.transform = 'translateX(' + d + 'px)';
    P.inLayer.style.transform = 'translateX(' + (P.pdir * P.W + d) + 'px)';
  };

  window.pagerFin = function (dx, umbral) {
    if (!P) return;
    const p = P; P = null;
    const d = p.pdir > 0 ? Math.min(0, dx) : Math.max(0, dx);
    const commit = Math.abs(d) > umbral;
    const dur = 220, ease = 'cubic-bezier(.22,.61,.36,1)';
    p.curLayer.style.transition = 'transform ' + dur + 'ms ' + ease;
    p.inLayer.style.transition = 'transform ' + dur + 'ms ' + ease;
    if (commit) {
      p.curLayer.style.transform = 'translateX(' + (-p.pdir * p.W) + 'px)';
      p.inLayer.style.transform = 'translateX(0px)';
    } else {
      p.curLayer.style.transform = 'translateX(0px)';
      p.inLayer.style.transform = 'translateX(' + (p.pdir * p.W) + 'px)';
    }
    let done = false;
    const fin = () => {
      if (done) return; done = true;
      restaurarTodo(p);
      document.body.classList.remove('nav-dragging');
      if (commit) {
        if (typeof window.irSeccionSinAnimacion === 'function') window.irSeccionSinAnimacion(p.tgt);
        else irASeccionApp(p.tgt);
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    };
    p.inLayer.addEventListener('transitionend', fin, { once: true });
    setTimeout(fin, dur + 90);
  };

  window.pagerActivo = function () { return !!P; };
})();
