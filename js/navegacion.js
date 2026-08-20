// ── NAVEGACIÓN ENTRE LAS CUATRO SECCIONES ───────────────────────────────────
// La app tiene dos mitades que antes eran aplicaciones separadas, cada una con
// su propia forma de cambiar de pantalla: la de presupuesto usa setTab() y la
// de retiro/cartera usa switchView(). Acá arriba de las dos hay una sola barra
// que decide qué mitad se muestra y después le pide a esa mitad que cambie de
// pantalla. Ninguna de las dos funciones originales se toca.

const SECCIONES_APP = [
  { id: 'resumen', mitad: 'presupuesto', ir: () => setTab('resumen') },
  { id: 'gastos',  mitad: 'presupuesto', ir: () => setTab('gastos') },
  { id: 'retiro',  mitad: 'retiro',      ir: () => switchView('retiro') },
  { id: 'cartera', mitad: 'retiro',      ir: () => switchView('cartera') },
];

const LS_SECCION = 'app_seccion_v1';
let seccionActual = 'retiro';

function seccionPorId(id) { return SECCIONES_APP.find(s => s.id === id); }

function irASeccionApp(id) {
  const s = seccionPorId(id);
  if (!s) return;
  seccionActual = id;
  try { localStorage.setItem(LS_SECCION, id); } catch (e) {}

  const rt = document.getElementById('mitad-retiro');
  const pp = document.getElementById('mitad-presupuesto');
  if (rt) rt.style.display = s.mitad === 'retiro' ? '' : 'none';
  if (pp) pp.style.display = s.mitad === 'presupuesto' ? '' : 'none';

  // Cerrar cualquier panel de parámetros abierto: quedaba flotando encima al
  // saltar a la otra mitad.
  cerrarPanelesDeParametros();

  try { s.ir(); } catch (e) {}

  document.querySelectorAll('#bottom-nav .bn-item[data-seccion]').forEach(b => {
    b.classList.toggle('active', b.dataset.seccion === id);
  });

  // Los gráficos de una mitad oculta se dibujan con tamaño cero; al volver a
  // mostrarla hay que avisarles o quedan en blanco hasta que algo los toque.
  setTimeout(redibujarGraficosVisibles, 60);
}

function cerrarPanelesDeParametros() {
  ['aside', 'aside-presu'].forEach(id => {
    const a = document.getElementById(id);
    if (a) a.classList.remove('open');
  });
  ['sheet-backdrop', 'sheet-backdrop-presu'].forEach(id => {
    const b = document.getElementById(id);
    if (b) b.classList.remove('open');
  });
}

// El botón de ajustes abre el panel de la mitad que estés viendo.
function abrirAjustesDeLaSeccion() {
  const s = seccionPorId(seccionActual);
  if (s && s.mitad === 'presupuesto') { if (typeof toggleSidebarPresu === 'function') toggleSidebarPresu(); }
  else if (typeof toggleSidebar === 'function') toggleSidebar();
}

function redibujarGraficosVisibles() {
  if (typeof Chart === 'undefined' || !Chart.instances) return;
  Object.values(Chart.instances).forEach(c => {
    try {
      const lienzo = c.canvas;
      if (lienzo && lienzo.offsetParent !== null) c.resize();
    } catch (e) {}
  });
}

// Al abrir, volver a la última sección usada.
(function () {
  let guardada = null;
  try { guardada = localStorage.getItem(LS_SECCION); } catch (e) {}
  irASeccionApp(seccionPorId(guardada) ? guardada : 'retiro');
})();
