// ── SELECTOR UNIFICADO DE PARÁMETROS ────────────────────────────────────────
// Los dos paneles de parámetros (Inversión y Presupuesto) viven cada uno dentro
// de su sección, y una sección oculta esconde su panel. Para poder elegir
// cualquiera desde donde sea, se pone arriba de cada panel un selector; al
// cambiar de tipo la app va sola a la sección correspondiente (sin animación,
// por detrás del panel) y abre ese panel. Nada de la apertura/cierre original
// se reemplaza: se reusan toggleSidebar()/toggleSidebarPresu().

function _asideInv() { return document.getElementById('aside'); }
function _asidePresu() { return document.getElementById('aside-presu'); }
function _invAbierto() { const a = _asideInv(); return !!(a && a.classList.contains('open')); }
function _presuAbierto() { const a = _asidePresu(); return !!(a && a.classList.contains('open')); }

function marcarSelectorParametros(tipo) {
  document.querySelectorAll('.param-selector .ps-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tipo === tipo);
  });
}

function cambiarTipoParametros(tipo) {
  const enPresu = ['inicio', 'resumen', 'gastos'].includes(seccionActual);
  const irSin = id => {
    if (typeof irSeccionSinAnimacion === 'function') irSeccionSinAnimacion(id);
    else if (typeof irASeccionApp === 'function') irASeccionApp(id);
  };
  if (tipo === 'presu') {
    if (!enPresu) irSin('gastos');                 // muestra la mitad de presupuesto (cierra paneles)
    if (_invAbierto()) toggleSidebar();            // por las dudas, cerrar el de inversión
    if (!_presuAbierto()) toggleSidebarPresu();    // abrir el de presupuesto
  } else {
    if (enPresu) irSin('retiro');                  // muestra la mitad de retiro
    if (_presuAbierto()) toggleSidebarPresu();     // cerrar el de presupuesto
    if (!_invAbierto()) toggleSidebar();           // abrir el de inversión
  }
  marcarSelectorParametros(tipo);
}

(function () {
  const selectorHTML = tipoActivo =>
    '<div class="param-selector" style="display:flex;gap:6px;margin:2px 0 12px 0;">' +
    '<button class="ps-btn toggle-btn' + (tipoActivo === 'inv' ? ' active' : '') + '" data-tipo="inv" onclick="cambiarTipoParametros(\'inv\')" style="flex:1;">📈 Inversión</button>' +
    '<button class="ps-btn toggle-btn' + (tipoActivo === 'presu' ? ' active' : '') + '" data-tipo="presu" onclick="cambiarTipoParametros(\'presu\')" style="flex:1;">📊 Presupuesto</button>' +
    '</div>';

  function inyectar(aside, tipoActivo) {
    if (!aside || aside.querySelector('.param-selector')) return;
    const fila = aside.querySelector('.sheet-title-row');
    if (fila) fila.insertAdjacentHTML('afterend', selectorHTML(tipoActivo));
    else aside.insertAdjacentHTML('afterbegin', selectorHTML(tipoActivo));
  }

  inyectar(_asideInv(), 'inv');
  inyectar(_asidePresu(), 'presu');
})();
