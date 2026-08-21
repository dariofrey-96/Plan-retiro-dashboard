// ── NAVEGACIÓN ENTRE LAS CUATRO SECCIONES ───────────────────────────────────
// La app tiene dos mitades que antes eran aplicaciones separadas, cada una con
// su propia forma de cambiar de pantalla: la de presupuesto usa setTab() y la
// de retiro/cartera usa switchView(). Acá arriba de las dos hay una sola barra
// que decide qué mitad se muestra y después le pide a esa mitad que cambie de
// pantalla. Ninguna de las dos funciones originales se toca.

// Hay tres mitades (contenedores de nivel superior): inicio, presupuesto y
// retiro. Inicio es la portada que resume las otras dos.
const MITADES = ['inicio', 'presupuesto', 'retiro'];

const SECCIONES_APP = [
  { id: 'inicio',  mitad: 'inicio',      ir: () => { if (typeof renderInicio === 'function') renderInicio(); } },
  { id: 'resumen', mitad: 'presupuesto', ir: () => setTab('resumen') },
  { id: 'gastos',  mitad: 'presupuesto', ir: () => setTab('gastos') },
  { id: 'retiro',  mitad: 'retiro',      ir: () => switchView('retiro') },
  { id: 'cartera', mitad: 'retiro',      ir: () => switchView('cartera') },
];

// El subtítulo del encabezado dice en qué sección estás. Antes ese lugar decía
// "USD · personal", que valía sólo para una de las dos mitades.
const NOMBRES_SECCION = {
  inicio:  'Tu resumen',
  resumen: 'Resumen del mes',
  gastos:  'Gastos del mes',
  retiro:  'Proyección de retiro · USD',
  cartera: 'Cartera de inversión · USD',
};

const LS_SECCION = 'app_seccion_v1';
let seccionActual = 'inicio';

function seccionPorId(id) { return SECCIONES_APP.find(s => s.id === id); }

function irASeccionApp(id) {
  const s = seccionPorId(id);
  if (!s) return;
  seccionActual = id;
  try { localStorage.setItem(LS_SECCION, id); } catch (e) {}

  MITADES.forEach(m => {
    const el = document.getElementById('mitad-' + m);
    if (el) el.style.display = (s.mitad === m) ? '' : 'none';
  });

  // Cerrar cualquier panel de parámetros abierto: quedaba flotando encima al
  // saltar a la otra mitad.
  cerrarPanelesDeParametros();

  try { s.ir(); } catch (e) {}

  // Hay una sola navegación con dos presentaciones: la barra de abajo en
  // celular y las pestañas del encabezado en pantalla ancha. Se resaltan las
  // dos, así al cambiar de tamaño la app no queda mostrando otra cosa.
  document.querySelectorAll('#bottom-nav .bn-item[data-seccion], .nav-tabs .nav-tab[data-seccion]').forEach(b => {
    b.classList.toggle('active', b.dataset.seccion === id);
  });
  const nombre = $('seccion-actual-nombre');
  if (nombre) nombre.textContent = NOMBRES_SECCION[id] || '';

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

// El botón de ajustes abre el panel de la mitad que estés viendo. Inicio no
// tiene parámetros propios; abre los del presupuesto, que es de donde salen los
// objetivos de fondos y las alertas que muestra la portada.
function abrirAjustesDeLaSeccion() {
  const s = seccionPorId(seccionActual);
  if (s && s.mitad === 'retiro') { if (typeof toggleSidebar === 'function') toggleSidebar(); }
  else if (typeof toggleSidebarPresu === 'function') toggleSidebarPresu();
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

// La app SIEMPRE abre en Inicio: es la portada que resume todo. Dentro de la
// sesión el resto de la navegación funciona normal; sólo el arranque es fijo.
irASeccionApp('inicio');
