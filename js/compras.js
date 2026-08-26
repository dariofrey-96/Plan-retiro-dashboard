// ── AGREGAR UNA COMPRA A UN ACTIVO QUE YA TENÉS ──────────────────────────────
// Para no recargar ticker/nombre a mano cada vez que comprás más de algo que ya
// está en la cartera. Sólo pedís cuánto invertiste (USD) y a qué precio compraste;
// de ahí sale la cantidad y se recalcula el PRECIO PROMEDIO ponderado, igual que
// hace addAsset() cuando el activo ya existe. NO toca el precio de mercado actual
// (a.price): una compra no cambia el precio de hoy, sólo tu posición y tu promedio.
// Aditivo: vive aparte y sólo agrega un botón en la fila; no cambia la lógica vieja.

let buyingId = null;

function openBuyModal(id) {
  const a = assets.find(x => x.id == id);
  if (!a) return;
  buyingId = id;
  $('buy-info').innerHTML =
    '<b>' + a.name + ' (' + a.ticker + ')</b><br>' +
    'Cantidad actual: <span>' + a.qty.toLocaleString('es-AR', { maximumFractionDigits: 6 }) + '</span><br>' +
    'Precio de mercado: <span>$' + a.price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + '</span><br>' +
    'Precio promedio actual: <span>$' + (a.costBasis || a.price).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + '</span>';
  $('buy-amount').value = '';
  // Prefill del precio con el de mercado (suele comprarse cerca); es editable.
  $('buy-price').value = a.price ? Math.round(a.price * 1e6) / 1e6 : '';
  if ($('buy-solo')) $('buy-solo').checked = false;
  if ($('buy-price-field')) $('buy-price-field').style.display = '';
  updateBuyPreview();
  $('buy-modal').style.display = 'flex';
  setTimeout(() => $('buy-amount').focus(), 100);
}

// Muestra en vivo qué va a pasar antes de confirmar: cuánta cantidad sumás y
// cuál queda el nuevo precio promedio.
function updateBuyPreview() {
  const a = assets.find(x => x.id == buyingId);
  const prev = $('buy-preview');
  if (!a || !prev) return;
  const amount = parseFloat($('buy-amount').value);
  const solo = $('buy-solo') && $('buy-solo').checked;
  // Modo "solo registrar aporte": no cambia la posición, sólo deja el registro.
  if (solo) {
    if ($('buy-price-field')) $('buy-price-field').style.display = 'none';
    prev.innerHTML = (amount > 0)
      ? 'Se registra un aporte de <span>$' + amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '</span> a ' + a.ticker + '.<br><span style="color:var(--muted)">No cambia tu cantidad ni tu promedio.</span>'
      : '<span style="color:var(--muted)">Poné cuánto aportaste para registrarlo.</span>';
    return;
  }
  if ($('buy-price-field')) $('buy-price-field').style.display = '';
  const price = parseFloat($('buy-price').value);
  if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) {
    prev.innerHTML = '<span style="color:var(--muted)">Completá monto y precio para ver el resultado.</span>';
    return;
  }
  const qtyAdded = amount / price;
  const oldQty = a.qty, oldCost = a.costBasis || a.price;
  const newQty = oldQty + qtyAdded;
  const newCost = (oldQty * oldCost + qtyAdded * price) / newQty;
  prev.innerHTML =
    'Sumás: <span>' + qtyAdded.toLocaleString('es-AR', { maximumFractionDigits: 6 }) + ' ' + a.ticker + '</span><br>' +
    'Cantidad final: <span>' + newQty.toLocaleString('es-AR', { maximumFractionDigits: 6 }) + '</span><br>' +
    'Nuevo precio promedio: <span>$' + newCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + '</span>';
}

function closeBuyModal() { $('buy-modal').style.display = 'none'; buyingId = null; }

function confirmBuy() {
  const a = assets.find(x => x.id == buyingId);
  if (!a) return;
  const amount = parseFloat($('buy-amount').value);
  const price = parseFloat($('buy-price').value);
  const solo = $('buy-solo') && $('buy-solo').checked;

  if (isNaN(amount) || amount <= 0) { alert('Ingresá cuánto ' + (solo ? 'aportaste' : 'invertiste') + ', en dólares.'); return; }

  // Modo "solo registrar aporte": no toca la posición, sólo deja el registro para
  // que el resumen del mes no lea ese aporte como ganancia. Sirve para cargar una
  // compra que ya habías hecho antes por el otro formulario.
  if (solo) {
    registrarCompra({ cId: a.cId, ticker: a.ticker, name: a.name, cat: a.cat, qty: 0, price: (isNaN(price) ? null : price), amount });
    closeBuyModal();
    alert('Aporte registrado (no se cambió tu cantidad).');
    return;
  }

  if (isNaN(price) || price <= 0) { alert('Ingresá el precio al que compraste.'); return; }
  const qtyAdded = amount / price;
  const oldQty = a.qty, oldCost = a.costBasis || a.price;
  const newQty = oldQty + qtyAdded;
  a.costBasis = (oldQty * oldCost + qtyAdded * price) / newQty;  // promedio ponderado
  a.qty = newQty;
  // a.price (precio de mercado de hoy) NO se toca a propósito.
  if (!a.boughtDate) a.boughtDate = new Date().toISOString().slice(0, 10);

  registrarCompra({ cId: a.cId, ticker: a.ticker, name: a.name, cat: a.cat, qty: qtyAdded, price, amount });
  saveAssets();
  renderCartera();
  if (typeof syncCarteraToGitHub === 'function') syncCarteraToGitHub();
  closeBuyModal();
}

// Recalcular el preview mientras escribís/tildás, y cerrar con Escape.
if ($('buy-amount')) $('buy-amount').addEventListener('input', updateBuyPreview);
if ($('buy-price')) $('buy-price').addEventListener('input', updateBuyPreview);
if ($('buy-solo')) $('buy-solo').addEventListener('change', updateBuyPreview);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('buy-modal') && $('buy-modal').style.display === 'flex') closeBuyModal(); });


// ── REGISTRO DE COMPRAS (aportes de capital) ─────────────────────────────────
// Espeja el registro de ventas (ventas.js): guarda cada aporte a un activo para
// que el resumen del mes pueda RESTARLO y no confundir "metí plata" con "gané".
// Se guarda local y se sincroniza a GitHub (repo privado), igual que las ventas.
// El robot de snapshots no lo mira; es sólo para la app.
let compras = [];
const LS_COMPRAS = 'planRetiro_compras_v1';
const GH_PATH_COMPRAS = 'compras.json';

function saveComprasLocal() { try { localStorage.setItem(LS_COMPRAS, JSON.stringify(compras)); } catch (e) {} }
function loadComprasLocal() { try { const r = localStorage.getItem(LS_COMPRAS); if (r) compras = JSON.parse(r) || []; } catch (e) {} }

// Registra un aporte. `amount` = plata invertida en USD (lo único que necesita el
// resumen del mes); qty/price se guardan de referencia.
function registrarCompra({ cId, ticker, name, cat, qty, price, amount }) {
  compras.push({
    id: Date.now() + '-' + ticker + '-' + Math.random().toString(36).slice(2, 7),
    date: new Date().toISOString().slice(0, 10),
    cId: cId != null ? cId : null,
    ticker, name: name || ticker, cat: cat || null,
    qty: qty || 0, price: (price != null && !isNaN(price)) ? price : null,
    amount: Math.round((amount || 0) * 100) / 100
  });
  saveComprasLocal();
  if (typeof syncComprasToGitHub === 'function') syncComprasToGitHub();
  if (typeof renderMonthlySummary === 'function') renderMonthlySummary();
}

async function syncComprasToGitHub() {
  const token = (() => { try { return localStorage.getItem(LS_GH_TOKEN); } catch (e) { return null; } })();
  if (!token) return;
  const apiUrl = `https://api.github.com/repos/${GH_DATA_OWNER}/${GH_DATA_REPO}/contents/${GH_PATH_COMPRAS}`;
  try {
    let sha = null;
    const getRes = await fetch(apiUrl + `?ref=${GH_BRANCH}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
    if (getRes.ok) { const cur = await getRes.json(); sha = cur.sha; }
    else if (getRes.status !== 404) return;
    const body = {
      message: 'Actualizar historial de compras',
      content: b64EncodeUtf8(JSON.stringify({ compras, updatedAt: new Date().toISOString() }, null, 2)),
      branch: GH_BRANCH
    };
    if (sha) body.sha = sha;
    await fetch(apiUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { /* falla silenciosa: el próximo aporte o "Sincronizar ahora" reintenta */ }
}

// Al abrir, combina lo local con lo remoto (por si aportaste desde otro dispositivo)
// sin perder registros de ningún lado — mismo criterio que las ventas.
async function loadComprasRemote() {
  loadComprasLocal();
  try {
    const remote = await ghLeerJson(GH_PATH_COMPRAS);
    if (remote) {
      const byId = {};
      [...compras, ...(remote.compras || [])].forEach(c => { byId[c.id] = c; });
      compras = Object.values(byId);
      saveComprasLocal();
    }
  } catch (e) {}
  if (typeof renderMonthlySummary === 'function') renderMonthlySummary();
}
loadComprasRemote();
