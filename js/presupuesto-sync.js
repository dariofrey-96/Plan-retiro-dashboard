// Sincronización de presupuesto.json. Comparte repositorio y token con la
// cartera, pero es otro archivo y otra marca de versión, así que las funciones
// llevan apellido. ghLeerJson() y LS_GH_TOKEN son los de sincronizacion.js.
// ── SINCRONIZACIÓN CON GITHUB ─────────────────────────────────────────────
// Los datos de esta app viajan al MISMO repositorio privado donde el Plan de
// Retiro guarda la cartera (`Plan-retiro-datos`), pero en un archivo aparte:
// presupuesto.json. Las dos apps se publican bajo dariofrey-96.github.io, así
// que para el navegador son el mismo sitio y comparten localStorage — por eso
// se reusa el token que ya está pegado ahí y no hay nada nuevo que configurar.
//
// Es "gana el último que sube", a propósito: si se edita en dos dispositivos a
// la vez, queda la versión del que guardó al final. Resolver conflictos de
// verdad no vale la pena para un presupuesto personal.
// El repositorio y la rama salen de sincronizacion.js: las dos mitades guardan
// en el MISMO repo privado, sólo que en archivos distintos. Tenerlo declarado
// dos veces era pedir que algún día se cambie uno y quede el otro apuntando a
// otro lado.
const GH_RAMA  = GH_BRANCH;
const GH_PATH_PRESUPUESTO = 'presupuesto.json';
// LS_GH_TOKEN lo declara sincronizacion.js: es la misma llave para las dos
// mitades, guardada bajo la misma clave del navegador.
const LS_SYNC_MARCA_PRESU  = 'presupuesto_sync_v1';       // con qué versión de GitHub quedamos iguales
const LS_SYNC_HUELLA = 'presupuesto_sync_huella_v1';// qué datos llegaron a subirse de verdad
const LS_PREVIO      = 'presupuesto_previo_v1';     // copia de lo que había antes de adoptar lo remoto
const SYNC_RETARDO = 2000;   // ms: junta varios cambios seguidos en un solo commit

function ghToken() { try { return localStorage.getItem(LS_GH_TOKEN); } catch (e) { return null; } }
function marcaSync() { try { return localStorage.getItem(LS_SYNC_MARCA_PRESU); } catch (e) { return null; } }
// La marca es lo que después permite distinguir "otro dispositivo cambió algo"
// de "esto lo cambié yo". Se anota tanto al subir como al adoptar.
function marcarSincronizadoPresu(updatedAt) {
  try { if (updatedAt) localStorage.setItem(LS_SYNC_MARCA_PRESU, updatedAt); } catch (e) {}
}

// ── qué se guarda ─────────────────────────────────────────────────────────
// Exactamente lo mismo que arma el backup manual (BACKUP_KEYS), para que un
// archivo sirva para las dos cosas y no haya dos formatos distintos.
function datosPresupuesto() {
  const data = {};
  BACKUP_KEYS.forEach(k => { try { const v = localStorage.getItem(k); if (v != null) data[k] = v; } catch (e) {} });
  return data;
}
function hayDatosLocales() {
  return BACKUP_KEYS.some(k => {
    let v = null; try { v = localStorage.getItem(k); } catch (e) {}
    if (v == null) return false;
    const s = v.trim();
    return s !== '' && s !== '{}' && s !== '[]' && s !== 'null';
  });
}
// Huella corta de los datos: sirve para no generar un commit cuando en realidad
// no cambió nada, y para darse cuenta al abrir de que quedaron cambios sin
// subir (por ejemplo, editados sin conexión).
function huellaDe(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0) + '.' + str.length;
}
// Siempre en el orden de BACKUP_KEYS: dos copias con los mismos datos pero las
// claves en distinto orden tienen que dar la misma huella, si no la app cree
// que cambió algo cuando no cambió nada.
function huellaDeDatos(data) {
  const ordenado = {};
  BACKUP_KEYS.forEach(k => { if (data[k] != null) ordenado[k] = data[k]; });
  return huellaDe(JSON.stringify(ordenado));
}
function huellaActual() { return huellaDeDatos(datosPresupuesto()); }
function huellaGuardada() { try { return localStorage.getItem(LS_SYNC_HUELLA); } catch (e) { return null; } }
function guardarHuella(h) { try { localStorage.setItem(LS_SYNC_HUELLA, h); } catch (e) {} }

// ── cartel de estado ──────────────────────────────────────────────────────
const SYNC_ETIQUETAS = { ok: 'Guardado', loading: 'Guardando…', error: 'Sin guardar', '': 'Local' };
function setSyncEstado(estado, detalle) {
  [$('sync-dot'), $('sync-dot-2')].forEach(d => { if (d) d.className = 'sync-dot ' + estado; });
  const lbl = $('sync-msg'); if (lbl) lbl.textContent = SYNC_ETIQUETAS[estado] || 'Local';
  const det = $('sync-detalle'); if (det) det.textContent = detalle;
  const chip = $('sync-chip'); if (chip) chip.title = detalle;
}
function horaCorta() { return new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }); }

// ── leer de GitHub ────────────────────────────────────────────────────────
// Pide el contenido "crudo": el JSON de la API devuelve el archivo empaquetado
// y deja de servirlo arriba de 1 MB.


// ── subir a GitHub ────────────────────────────────────────────────────────
function b64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  bytes.forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

let syncTimer = null, subiendo = false;

// Se llama en cada cambio de datos, pero no sube al toque: espera un momento
// para no generar un commit por tecla.
function programarSync() {
  if (!ghToken()) return;
  clearTimeout(syncTimer);
  setSyncEstado('loading', 'Cambios sin guardar todavía…');
  syncTimer = setTimeout(() => subirPresupuesto(), SYNC_RETARDO);
}

async function subirPresupuesto(manual) {
  const token = ghToken();
  if (!token) { setSyncEstado('', 'Falta la llave: los datos quedan sólo en este dispositivo.'); return false; }
  // Nunca pisar el archivo bueno de GitHub con un dispositivo vacío. Vale
  // también para el botón manual: un clic sin querer no puede borrar meses de
  // carga hechos en otro lado.
  if (!hayDatosLocales()) {
    if (manual) setSyncEstado('', 'No hay datos en este dispositivo para guardar.');
    return false;
  }
  const datos = datosPresupuesto();
  const huella = huellaDeDatos(datos);
  if (!manual && huella === huellaGuardada()) return false;   // no cambió nada de verdad
  if (subiendo) {                                   // ya hay una subida en curso: se reintenta después
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => subirPresupuesto(manual), SYNC_RETARDO);
    return false;
  }

  subiendo = true;
  setSyncEstado('loading', 'Guardando en GitHub…');
  const api = `https://api.github.com/repos/${GH_DATA_OWNER}/${GH_DATA_REPO}/contents/${GH_PATH_PRESUPUESTO}`;
  try {
    let sha = null;
    const getRes = await fetch(api + `?ref=${GH_RAMA}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });
    if (getRes.ok) { const cur = await getRes.json(); sha = cur.sha; }
    else if (getRes.status !== 404) {               // 404 = todavía no existe, se crea abajo
      setSyncEstado('error', 'No pude leer el archivo en GitHub (revisá el token).');
      return false;
    }

    const payload = { app: 'presupuesto_personal', updatedAt: new Date().toISOString(), data: datos };
    const body = {
      message: 'Actualizar presupuesto desde la app',
      content: b64Utf8(JSON.stringify(payload, null, 2)),
      branch: GH_RAMA
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(api, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (putRes.ok) {
      marcarSincronizadoPresu(payload.updatedAt);
      guardarHuella(huella);
      setSyncEstado('ok', 'Guardado en GitHub · ' + horaCorta());
      return true;
    }
    if (putRes.status === 409) {                    // otro dispositivo escribió en el medio
      setSyncEstado('loading', 'Otro dispositivo guardó recién, reintentando…');
      clearTimeout(syncTimer);
      syncTimer = setTimeout(() => subirPresupuesto(manual), SYNC_RETARDO);
      return false;
    }
    const err = await putRes.json().catch(() => ({}));
    setSyncEstado('error', 'No se pudo guardar' + (err.message ? ': ' + err.message : '.'));
    return false;
  } catch (e) {
    setSyncEstado('error', 'Sin conexión: los cambios quedaron sólo en este dispositivo.');
    return false;
  } finally { subiendo = false; }
}

// ── traer lo de GitHub a la app ───────────────────────────────────────────
function escribirDatos(data) {
  // Se borra lo que la versión remota no trae: si allá se borró algo, acá
  // también tiene que desaparecer.
  BACKUP_KEYS.forEach(k => {
    try { if (data[k] != null) localStorage.setItem(k, data[k]); else localStorage.removeItem(k); } catch (e) {}
  });
}
// Vuelve a leer todo de la memoria del navegador y repinta. Los datos cambiaron
// abajo de la app, así que hay que refrescar sliders, tipo de cambio y pantallas.
function recargarPantallas() {
  try {
    loadParamsPresu();
    Object.keys(sliders).forEach(id => {
      const el = $(id), vEl = $('v-' + id);
      if (el && vEl) vEl.textContent = sliders[id](parseFloat(el.value));
    });
    let tcGuardado = '';
    try { tcGuardado = localStorage.getItem(LS_TC) || ''; } catch (e) {}
    $('tipoCambio').value = tcGuardado;
    mesVisible = monthKey();
    renderResumen();
    renderGastos();
  } catch (e) {}
}

// Sólo actúa si no hay absolutamente nada guardado en este navegador; si no,
// pisaría datos buenos. Es un camino de ida, de GitHub hacia la app.
async function restaurarPresupuestoSiEstaVacio() {
  if (hayDatosLocales()) return false;
  let remota;
  try { remota = await ghLeerJson(GH_PATH_PRESUPUESTO); }
  catch (e) { setSyncEstado('error', 'No pude leer los datos guardados en GitHub.'); return false; }
  if (!remota || !remota.data) return false;
  escribirDatos(remota.data);
  marcarSincronizadoPresu(remota.updatedAt);
  guardarHuella(huellaActual());
  recargarPantallas();
  setSyncEstado('ok', 'Datos restaurados desde GitHub.');
  return true;
}

// Si la versión de GitHub no es la misma con la que quedamos iguales la última
// vez, es porque la tocó otro dispositivo y hay que adoptarla.
async function traerCambiosPresu() {
  let remota;
  try { remota = await ghLeerJson(GH_PATH_PRESUPUESTO); } catch (e) { return false; }
  if (!remota || !remota.data || !remota.updatedAt) return false;
  if (remota.updatedAt === marcaSync()) return false;          // ya estamos al día

  // Los datos son idénticos: no hay nada que traer, sólo anotar que quedamos
  // iguales. Sin esto se repintaría la pantalla al pedo cada vez.
  if (huellaDeDatos(remota.data) === huellaActual()) {
    marcarSincronizadoPresu(remota.updatedAt);
    guardarHuella(huellaActual());
    setSyncEstado('ok', 'Al día con GitHub.');
    return false;
  }

  // PRIMER ENCUENTRO: este dispositivo tiene datos propios pero nunca vio el
  // archivo de GitHub, así que no hay ninguna marca para comparar y no hay
  // forma de saber cuál de los dos lados es el bueno. Adivinar mal borra meses
  // de carga, así que se pregunta. Pasa una sola vez por dispositivo.
  if (!marcaSync() && hayDatosLocales()) {
    const traer = confirm(
      'Es la primera vez que este dispositivo se conecta con la copia de GitHub.\n\n' +
      'ACÁ tenés: ' + fraseDatos(datosPresupuesto()) + '\n' +
      'EN GITHUB hay: ' + fraseDatos(remota.data) + '\n' +
      '(guardado el ' + fechaLegible(remota.updatedAt) + ')\n\n' +
      'ACEPTAR → traer lo de GitHub y reemplazar lo de este dispositivo.\n' +
      'CANCELAR → dejar lo de este dispositivo y subirlo a GitHub.'
    );
    if (!traer) { await subirPresupuesto(true); return false; }
  }

  // Antes de pisar nada se guarda lo que había: si algo se editó sin conexión y
  // no llegó a subirse, queda recuperable en vez de perdido.
  try {
    localStorage.setItem(LS_PREVIO, JSON.stringify({ guardadoEl: new Date().toISOString(), data: datosPresupuesto() }));
  } catch (e) {}

  escribirDatos(remota.data);
  // Se anota la versión adoptada y NO se vuelve a subir: subir generaría un
  // updatedAt nuevo, el otro dispositivo lo bajaría y lo volvería a subir, y se
  // estarían pisando en círculo para siempre.
  marcarSincronizadoPresu(remota.updatedAt);
  guardarHuella(huellaActual());
  recargarPantallas();
  mostrarBotonRecuperar();
  setSyncEstado('ok', 'Actualizado con los cambios de otro dispositivo.');
  return true;
}

// ── la llave, acá mismo ───────────────────────────────────────────────────
// El token se guarda en una clave compartida con el Plan de Retiro (las dos
// apps viven en el mismo dominio), pero el usuario NO tiene por qué saberlo ni
// tiene que abrir la otra app para configurar ésta. Se pega acá.
function pintarZonaToken() {
  const z = $('gh-token-zona');
  if (!z) return;
  if (ghToken() && !z.dataset.editando) {
    z.innerHTML = '<div class="sync-nota">🔑 La llave ya está puesta en este dispositivo.</div>' +
                  '<button class="sync-btn" onclick="verLlave()">👁 Ver la llave (para copiarla a otro dispositivo)</button>' +
                  '<button class="sync-btn" onclick="editarToken()">Cambiar la llave</button>';
  } else {
    z.innerHTML = '<div class="sync-nota">Pegá acá tu llave de GitHub para que lo que cargues se guarde y aparezca en tus otros dispositivos. Se guarda sólo en este navegador.</div>' +
                  '<input type="password" id="gh-token-input" class="sync-input" placeholder="Pegá la llave acá" autocomplete="off" spellcheck="false">' +
                  '<button class="sync-btn" onclick="guardarToken()">Guardar llave</button>';
  }
}
// La llave se guarda oculta en los dos lados, así que sin esto no había forma
// de pasarla de un dispositivo a otro: había que crear una nueva en GitHub.
// Se muestra sólo si el usuario la pide a propósito.
function verLlave() {
  const z = $('gh-token-zona');
  z.innerHTML = '<div class="sync-nota">Esta es tu llave. Copiala y pegala en el otro dispositivo. Es como una contraseña: no se la pases a nadie.</div>' +
                '<input class="sync-input" id="gh-token-ver" readonly>' +
                '<button class="sync-btn" onclick="copiarLlave()">📋 Copiar la llave</button>' +
                '<button class="sync-btn" onclick="pintarZonaToken()">Ocultar</button>';
  const i = $('gh-token-ver');
  i.value = ghToken() || '';
  i.focus(); i.select();
}
async function copiarLlave() {
  const i = $('gh-token-ver');
  if (!i) return;
  i.select(); i.setSelectionRange(0, 99999);
  try { await navigator.clipboard.writeText(i.value); alert('Llave copiada ✓'); return; } catch (e) {}
  try { document.execCommand('copy'); alert('Llave copiada ✓'); }
  catch (e) { alert('No pude copiarla sola. Marcá el texto con el dedo (o el mouse) y copialo a mano.'); }
}

function editarToken() {
  const z = $('gh-token-zona');
  z.dataset.editando = '1';
  pintarZonaToken();
  const i = $('gh-token-input');
  if (i) i.focus();
}
async function guardarToken() {
  const el = $('gh-token-input'), z = $('gh-token-zona');
  if (!el) return;
  const t = el.value.trim();
  el.value = '';
  delete z.dataset.editando;
  if (!t) {
    try { localStorage.removeItem(LS_GH_TOKEN); } catch (e) {}
    pintarZonaToken();
    setSyncEstado('', 'Sin llave: los datos quedan sólo en este dispositivo.');
    return;
  }
  try { localStorage.setItem(LS_GH_TOKEN, t); }
  catch (e) { alert('No pude guardar la llave en este navegador.'); return; }
  pintarZonaToken();
  setSyncEstado('loading', 'Llave guardada, probando…');
  await arrancarSync();
}

// ── volver atrás si se trajo lo que no era ────────────────────────────────
// Cada vez que se adopta una versión remota queda guardado lo que había antes.
// Este botón lo devuelve, y guarda lo actual en su lugar: se puede ir y volver.
function fraseDatos(data) {
  let gastos = 0, meses = 0, ingreso = 0;
  try {
    const g = JSON.parse(data['presupuesto_gastos_v1'] || '{}');
    const claves = Object.keys(g);
    meses = claves.length;
    claves.forEach(k => { gastos += (g[k] || []).length; });
  } catch (e) {}
  try {
    const p = JSON.parse(data['presupuesto_params_v1'] || '{}');
    ingreso = parseFloat((p.sliders || {}).salario) || 0;
  } catch (e) {}
  const partes = [];
  partes.push(gastos ? gastos + (gastos === 1 ? ' gasto' : ' gastos') + ' en ' + meses + (meses === 1 ? ' mes' : ' meses') : 'ningún gasto cargado');
  if (ingreso) partes.push('ingreso de ' + fmtARS(ingreso));
  return partes.join(', ');
}
function fechaLegible(iso) {
  try { return new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return iso; }
}
function copiaPrevia() {
  try { const r = JSON.parse(localStorage.getItem(LS_PREVIO) || 'null'); return (r && r.data) ? r : null; }
  catch (e) { return null; }
}
function mostrarBotonRecuperar() {
  const b = $('btn-recuperar');
  if (!b) return;
  const c = copiaPrevia();
  if (!c) { b.style.display = 'none'; return; }
  b.style.display = '';
  b.textContent = '⟲ Recuperar lo que había antes (' + fraseDatos(c.data) + ')';
}
async function recuperarDatosPrevios() {
  const c = copiaPrevia();
  if (!c) { alert('No hay ninguna copia anterior guardada en este dispositivo.'); return; }
  if (!confirm(
    'Esto vuelve a los datos que había en este dispositivo antes de la última sincronización:\n\n' +
    fraseDatos(c.data) + '\n(guardados el ' + fechaLegible(c.guardadoEl) + ')\n\n' +
    'Se suben a GitHub reemplazando lo que hay ahí. Lo que tenés ahora queda guardado, así que podés volver.\n\n¿Seguimos?'
  )) return;
  const actual = datosPresupuesto();
  escribirDatos(c.data);
  try { localStorage.setItem(LS_PREVIO, JSON.stringify({ guardadoEl: new Date().toISOString(), data: actual })); } catch (e) {}
  recargarPantallas();
  mostrarBotonRecuperar();
  await subirPresupuesto(true);
}

// ── enganches ─────────────────────────────────────────────────────────────
// Se sincroniza cuando cambian los datos de verdad. El estado de las alertas
// (cuáles ya se mostraron) queda afuera a propósito: es ruido de pantalla, y
// viaja igual pegado al próximo cambio real.
(function () {
  const _saveParams = saveParamsPresu, _saveGastosAll = saveGastosAll, _saveTC = saveTC,
        _saveAlertasCfg = saveAlertasCfg, _saveRecurrentes = saveRecurrentes,
        _saveReglasImport = saveReglasImport;
  saveParamsPresu       = function (...a) { const r = _saveParams(...a);       programarSync(); return r; };
  saveGastosAll    = function (...a) { const r = _saveGastosAll(...a);    programarSync(); return r; };
  saveTC           = function (...a) { const r = _saveTC(...a);           programarSync(); return r; };
  saveAlertasCfg   = function (...a) { const r = _saveAlertasCfg(...a);   programarSync(); return r; };
  saveRecurrentes  = function (...a) { const r = _saveRecurrentes(...a);  programarSync(); return r; };
  saveReglasImport = function (...a) { const r = _saveReglasImport(...a); programarSync(); return r; };
})();

// El botón manual: primero mira si otro dispositivo tiene algo más nuevo y, si
// no, sube lo de acá.
async function sincronizarAhora() {
  if (!ghToken()) {
    alert('Falta la llave de GitHub en este dispositivo.\n\nPegala acá abajo, en "Copia en GitHub", y tus datos empiezan a guardarse solos.');
    editarToken();
    return;
  }
  const restaurado = await restaurarPresupuestoSiEstaVacio();
  if (restaurado) return;
  const adoptado = await traerCambiosPresu();
  if (!adoptado) await subirPresupuesto(true);
}

let ultimaMirada = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Si quedó un cambio esperando el retardo, se sube antes de irse.
    if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; subirPresupuesto(); }
    return;
  }
  // Al volver a la app se mira si otro dispositivo cambió algo, pero no más de
  // una vez por minuto.
  if (Date.now() - ultimaMirada < 60000) return;
  ultimaMirada = Date.now();
  traerCambiosPresu();
});

// ── arranque ──────────────────────────────────────────────────────────────
// Primero se intenta restaurar (dispositivo vacío) y si no, traer lo que haya
// cambiado en otro lado: una sola de las dos hace algo. Al final, si quedaron
// cambios locales que nunca llegaron a subirse, se suben.
async function arrancarSync() {
  mostrarBotonRecuperar();
  pintarZonaToken();
  if (!ghToken()) {
    setSyncEstado('', 'Falta la llave: los datos quedan sólo en este dispositivo.');
    return;
  }
  const restaurado = await restaurarPresupuestoSiEstaVacio();
  const adoptado = restaurado ? false : await traerCambiosPresu();
  if (restaurado || adoptado) return;
  if (!hayDatosLocales()) { setSyncEstado('', 'Todavía no hay nada que guardar.'); return; }
  // Quedaron cambios que nunca llegaron a subirse (por ejemplo, editados sin
  // conexión): se suben ahora.
  if (huellaActual() !== huellaGuardada()) { await subirPresupuesto(); return; }
  setSyncEstado('ok', 'Al día con GitHub.');
}
arrancarSync();
