// ── SINCRONIZACIÓN CON GITHUB (para el historial automático) ───────────────
const GH_BRANCH = 'main'; // si tu repo usa "master", cambiá esto
const GH_PATH_CARTERA = 'cartera.json';
const GH_PATH_HISTORY = 'history.json';
const LS_GH_TOKEN = 'planRetiro_gh_token';

// Dónde viven los DATOS (cartera, historial, ventas): un repositorio PRIVADO,
// separado del repo público que publica esta página. La página tiene que ser
// pública para que GitHub la sirva gratis, pero la cartera no: mientras estuvo
// en el mismo repo, cualquiera podía leer los activos, las cantidades y el
// patrimonio hora por hora sin necesidad de permiso alguno.
//
// Consecuencia esperada: sin token no se lee nada y la app se ve vacía. Es el
// precio de que nadie más la vea, y hay que pegar el token una vez por
// dispositivo (se guarda sólo en la memoria de ese navegador).
const GH_DATA_OWNER = 'dariofrey-96';
const GH_DATA_REPO = 'Plan-retiro-datos';

// Lee un JSON del repo de datos. Si hay token guardado usa la API (única forma
// de leer un repo privado); si no, cae al archivo público, que es lo que hacía
// antes. Pide el contenido "crudo" en vez del JSON de la API porque ésta
// devuelve el archivo empaquetado y se planta arriba de 1 MB — y el historial
// va camino a pasarlo.
async function ghLeerJson(path) {
  const token = (() => { try { return localStorage.getItem(LS_GH_TOKEN); } catch (e) { return null; } })();
  if (token) {
    const api = `https://api.github.com/repos/${GH_DATA_OWNER}/${GH_DATA_REPO}/contents/${path}?ref=${GH_BRANCH}`;
    const res = await fetch(api, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw' }
    });
    if (res.status === 404) return null;   // todavía no existe: no es un error
    if (!res.ok) throw new Error('GitHub respondió ' + res.status);
    return res.json();
  }
  const pub = `https://raw.githubusercontent.com/${GH_DATA_OWNER}/${GH_DATA_REPO}/${GH_BRANCH}/${path}`;
  const res = await fetch(pub, { cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('GitHub respondió ' + res.status);
  return res.json();
}

function setGhStatus(state, msg) {
  const dot = $('gh-status-dot'), m = $('gh-status-msg');
  if (dot) dot.className = 'status-dot ' + state;
  if (m) m.textContent = msg;
}

function saveGhToken() {
  const token = $('gh-token').value.trim();
  try {
    if (token) { localStorage.setItem(LS_GH_TOKEN, token); setGhStatus('ok', 'Token guardado. Sincronizando...'); syncCarteraToGitHub(true); }
    else { localStorage.removeItem(LS_GH_TOKEN); setGhStatus('', 'Sin configurar todavía.'); }
  } catch (e) { setGhStatus('error', 'No se pudo guardar el token.'); }
}

// UTF-8 seguro para btoa (nombres de activos pueden tener tildes)
function b64EncodeUtf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

async function syncCarteraToGitHub(manual) {
  const token = (() => { try { return localStorage.getItem(LS_GH_TOKEN); } catch (e) { return null; } })();
  if (!token) { if (manual) setGhStatus('error', 'Pegá un token primero.'); return; }

  setGhStatus('loading', 'Sincronizando...');
  const apiUrl = `https://api.github.com/repos/${GH_DATA_OWNER}/${GH_DATA_REPO}/contents/${GH_PATH_CARTERA}`;
  try {
    let sha = null;
    const getRes = await fetch(apiUrl + `?ref=${GH_BRANCH}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' }
    });
    if (getRes.ok) { const cur = await getRes.json(); sha = cur.sha; }
    else if (getRes.status !== 404) { setGhStatus('error', 'Error al leer el archivo (revisá el token / nombre del repo).'); return; }

    // Se guardan también el nombre y el precio de compra: el robot no los usa,
    // pero sin ellos una restauración pierde cómo se llama cada activo y toda
    // la ganancia/pérdida, que es la mitad de la pantalla de Cartera.
    const limpiar = a => {
      const o = { ticker: a.ticker, cat: a.cat, qty: a.qty, name: a.name, costBasis: a.costBasis };
      // El id de CoinGecko viaja resuelto para que el robot no tenga que
      // averiguarlo cada hora (y no dependa de acertarle al buscar).
      const cg = a.cgId || cgIdDe(a.ticker);
      if (a.cat === 'crypto' && cg) o.cgId = cg;
      return o;
    };
    // `assets` sigue estando por compatibilidad: es la suma de todas las
    // carteras, que es exactamente lo que el robot necesitaba antes. Así una
    // versión vieja de la app o del robot lo sigue leyendo sin romperse.
    const payload = {
      carteras: carteras.map(c => ({ id: c.id, nombre: c.nombre, assets: c.assets.map(limpiar) })),
      assets: carteras.flatMap(c => c.assets).map(limpiar),
      updatedAt: new Date().toISOString()
    };
    const body = {
      message: 'Actualizar cartera desde la app',
      content: b64EncodeUtf8(JSON.stringify(payload, null, 2)),
      branch: GH_BRANCH
    };
    if (sha) body.sha = sha;

    const putRes = await fetch(apiUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (putRes.ok) {
      // Queda anotado con qué versión quedamos iguales. Es lo que después
      // permite darse cuenta de que otro dispositivo tocó algo.
      marcarSincronizado(payload.updatedAt);
      setGhStatus('ok', 'Sincronizado · ' + new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }));
    }
    else {
      const errBody = await putRes.json().catch(() => ({}));
      setGhStatus('error', 'Error al sincronizar' + (errBody.message ? ': ' + errBody.message : '.'));
    }
  } catch (e) {
    setGhStatus('error', 'Sin conexión, no se sincronizó.');
  }
}

// Se engancha SOLO a los cambios de composición de la cartera (agregar,
// borrar, editar cantidad/costo) — no a cada actualización de precio, para
// no generar commits de más. No se toca ninguna función original: se
// reemplaza la referencia global por una versión que además sincroniza.
(function () {
  const _addAsset = addAsset, _removeAsset = removeAsset, _saveModal = saveModal;
  addAsset = function (...args) { const r = _addAsset(...args); syncCarteraToGitHub(); return r; };
  removeAsset = function (...args) { const r = _removeAsset(...args); syncCarteraToGitHub(); return r; };
  saveModal = function (...args) { const r = _saveModal(...args); syncCarteraToGitHub(); return r; };
})();

// Precarga el token guardado en el campo al abrir Ajustes
(function () {
  try {
    const saved = localStorage.getItem(LS_GH_TOKEN);
    if (saved && $('gh-token')) { $('gh-token').value = saved; setGhStatus('ok', 'Token configurado.'); }
  } catch (e) {}
})();

// ── TRAER LO QUE CAMBIÓ EN OTRO DISPOSITIVO ─────────────────────────────────
// La sincronización era de ida nomás: cada dispositivo subía sus cambios, pero
// ninguno los bajaba. Lo único que bajaba era la restauración, y sólo si el
// dispositivo estaba vacío — así que armar una cartera nueva en la notebook no
// aparecía jamás en el celular, que ya tenía datos propios.
//
// `updatedAt` dice cuándo se guardó la última versión en GitHub. Se anota con
// cuál quedamos iguales, y si al abrir la de GitHub es otra, es porque la tocó
// otro dispositivo y hay que adoptarla.
const LS_SYNC_MARCA = 'planRetiro_cartera_sync_v1';
const LS_CARTERA_PREVIA = 'planRetiro_cartera_previa_v1';

function marcarSincronizado(updatedAt) {
  try { if (updatedAt) localStorage.setItem(LS_SYNC_MARCA, updatedAt); } catch (e) {}
}
function marcaSincronizacion() {
  try { return localStorage.getItem(LS_SYNC_MARCA); } catch (e) { return null; }
}

async function traerCambiosDeOtroDispositivo() {
  if (!carteras.some(c => c.assets.length)) return; // vacío: de eso se encarga la restauración
  let remota;
  try { remota = await ghLeerJson(GH_PATH_CARTERA); } catch (e) { return; }
  if (!remota || !remota.updatedAt) return;
  if (remota.updatedAt === marcaSincronizacion()) return; // ya estamos al día

  const gruposRemotos = (remota.carteras && remota.carteras.length)
    ? remota.carteras
    : (remota.assets && remota.assets.length)
      ? [{ id: 1, nombre: 'Principal', assets: remota.assets }]
      : [];
  if (!gruposRemotos.length) return;

  // Antes de pisar nada se guarda lo que había. Si algo se hubiera editado sin
  // conexión y no llegó a subirse, queda recuperable en vez de perdido.
  try { localStorage.setItem(LS_CARTERA_PREVIA, localStorage.getItem(LS1) || ''); } catch (e) {}

  // Los precios ya cargados se reaprovechan por ticker para no dejar la
  // pantalla en cero hasta que vuelvan las cotizaciones.
  const preciosPrevios = {};
  carteras.forEach(c => c.assets.forEach(a => { if (a.price) preciosPrevios[a.ticker] = a; }));

  assetIdCounter = 0;
  carteras = gruposRemotos.map((c, i) => {
    const id = Number(c.id) || i + 1;
    return {
      id, nombre: c.nombre || 'Principal',
      assets: (c.assets || []).map(a => {
        const prev = preciosPrevios[a.ticker] || {};
        return {
          id: ++assetIdCounter, cId: id,
          name: a.name || a.ticker, ticker: a.ticker, cat: a.cat, qty: a.qty,
          cgId: a.cgId || prev.cgId || undefined,
          price: prev.price || 0,
          costBasis: a.costBasis != null ? a.costBasis : null,
          change24h: prev.change24h ?? null, lastUpdate: prev.lastUpdate || null,
          boughtDate: a.boughtDate || null
        };
      })
    };
  });
  carteraActiva = carteras.some(c => c.id === carteraActiva) ? carteraActiva : carteras[0].id;
  assets = assetsVisibles();
  // Se anota la versión adoptada SIN volver a subir: si se subiera, se generaría
  // un updatedAt nuevo y los dispositivos se estarían pisando en círculo.
  marcarSincronizado(remota.updatedAt);
  try { localStorage.setItem(LS1, JSON.stringify({ carteras, carteraActiva, assetIdCounter })); } catch (e) {}

  renderSelectorCarteras();
  renderCartera();
  if (typeof populateHistSeriesSelect === 'function') populateHistSeriesSelect();
  if (typeof renderHistChart === 'function') renderHistChart();
  if (typeof renderMonthlySummary === 'function') renderMonthlySummary();
  if (typeof renderSalesHistory === 'function') renderSalesHistory();
  setGhStatus('ok', 'Actualizado con los cambios de otro dispositivo.');
  if (assets.some(a => !a.price)) refreshPrices();
}

// ── RESTAURAR LA CARTERA DESDE GITHUB ───────────────────────────────────────
// La app guardaba la cartera en dos lados (memoria del navegador y cartera.json
// en GitHub) pero al abrir leía SÓLO la memoria del navegador. O sea: había
// copia de seguridad pero no había forma de volver de ella. Cambiar de celular,
// borrar los datos del navegador o entrar desde otra computadora mostraba la
// cartera vacía con el archivo intacto en GitHub.
//
// Sólo actúa si no hay nada guardado localmente, así que nunca puede pisar lo
// que ya tenés. Como no pasa por addAsset(), tampoco dispara una sincronización
// de vuelta: es un camino de ida, de GitHub hacia la app.
async function restaurarCarteraSiEstaVacia() {
  // Se mira si hay algo en CUALQUIER cartera, no sólo en la que estás viendo:
  // mirando `assets` a secas, pararse en una cartera vacía teniendo otra con
  // datos gatillaría una restauración que las pisa a todas.
  if (carteras.some(c => c.assets.length)) return;
  let remota;
  try {
    remota = await ghLeerJson(GH_PATH_CARTERA);
  } catch (e) {
    setGhStatus('error', 'No se pudo leer la cartera guardada (' + (e.message || 'error') + ').');
    return;
  }
  // Archivos nuevos traen `carteras`; los viejos, una lista suelta que se
  // restaura como una única cartera "Principal".
  const gruposRemotos = (remota && remota.carteras && remota.carteras.length)
    ? remota.carteras
    : (remota && remota.assets && remota.assets.length)
      ? [{ id: 1, nombre: 'Principal', assets: remota.assets }]
      : [];
  if (!gruposRemotos.length) return;

  const rehidratar = (a, cId) => ({
    id: ++assetIdCounter,
    cId,
    name: a.name || a.ticker,
    ticker: a.ticker,
    cat: a.cat,
    qty: a.qty,
    cgId: a.cgId || undefined,
    // El precio real lo trae refreshPrices() enseguida; costBasis sólo está en
    // los archivos guardados por la app nueva, así que en los viejos se cae al
    // precio de mercado y la ganancia arranca en cero en vez de mentir.
    price: 0,
    costBasis: a.costBasis != null ? a.costBasis : null,
    change24h: null, lastUpdate: null, boughtDate: a.boughtDate || null
  });

  carteras = gruposRemotos.map((c, i) => {
    const id = Number(c.id) || i + 1;
    return { id, nombre: c.nombre || 'Principal', assets: (c.assets || []).map(a => rehidratar(a, id)) };
  });
  carteraActiva = carteras[0].id;
  assets = assetsVisibles();
  saveAssets();
  renderSelectorCarteras();
  renderCartera();
  setStatus('loading', 'Cartera restaurada desde GitHub. Cargando precios...');
  await refreshPrices();
  // Se recorren todas las carteras, no sólo la visible: los precios los trae
  // refreshPrices() sobre lo que se ve, pero el costo por defecto hay que
  // dejarlo puesto en todas para que ninguna quede con la ganancia en blanco.
  carteras.forEach(c => c.assets.forEach(a => { if (a.costBasis == null) a.costBasis = a.price || 0; }));
  saveAssets();
  // Se restauró tal cual lo que había en GitHub, así que estamos iguales: sin
  // esta marca, el arranque siguiente creería que otro dispositivo tocó algo.
  marcarSincronizado(remota && remota.updatedAt);
  renderCartera();
}

// Primero se intenta restaurar (dispositivo vacío) y si no, traer lo que haya
// cambiado en otro lado. Una sola de las dos hace algo: la restauración exige
// que no haya nada, y traer cambios exige que haya.
(async () => {
  await restaurarCarteraSiEstaVacia();
  await traerCambiosDeOtroDispositivo();
})();

