// ── VENDER ACTIVO → PASA A USD/USDT + REGISTRO DE VENTA (sync a GitHub) ────
let sales = [];
let sellingId = null;
const LS_SALES = 'planRetiro_sales_v1';
const GH_PATH_SALES = 'sales.json';

function saveSalesLocal() { try { localStorage.setItem(LS_SALES, JSON.stringify(sales)); } catch (e) {} }
function loadSalesLocal() { try { const r = localStorage.getItem(LS_SALES); if (r) sales = JSON.parse(r) || []; } catch (e) {} }

function openSellModal(id) {
  const a = assets.find(x => x.id == id);
  if (!a) return;
  sellingId = id;
  $('sell-info').innerHTML =
    '<b>' + a.name + ' (' + a.ticker + ')</b><br>' +
    'Tenés: <span>' + a.qty.toLocaleString('es-AR', { maximumFractionDigits: 6 }) + '</span><br>' +
    'Precio actual: <span>$' + a.price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + '</span><br>' +
    'Costo promedio: <span>$' + (a.costBasis || a.price).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + '</span>';
  $('sell-qty').value = a.qty;
  $('sell-qty').max = a.qty;
  updateSellPreview();
  $('sell-modal').style.display = 'flex';
}
function updateSellPreview() {
  const a = assets.find(x => x.id == sellingId);
  const prev = $('sell-preview');
  if (!a || !prev) return;
  let qty = parseFloat($('sell-qty').value);
  if (isNaN(qty) || qty < 0) qty = 0;
  if (qty > a.qty) qty = a.qty;
  const saleValue = qty * a.price;
  const cost = qty * (a.costBasis || a.price);
  const pnl = saleValue - cost;
  const pnlPct = cost > 0 ? (pnl / cost * 100) : 0;
  prev.innerHTML =
    'Recibís: <span>' + fmt(saleValue) + '</span> en USD/USDT<br>' +
    'Resultado de la venta: <span style="color:' + (pnl >= 0 ? 'var(--green)' : 'var(--red)') + '">' +
    (pnl >= 0 ? '+' : '') + fmt(pnl) + ' (' + (pnlPct >= 0 ? '+' : '') + pnlPct.toFixed(1) + '%)</span>';
}
if ($('sell-qty')) $('sell-qty').addEventListener('input', updateSellPreview);

function closeSellModal() { $('sell-modal').style.display = 'none'; sellingId = null; }

function confirmSell() {
  const a = assets.find(x => x.id == sellingId);
  if (!a) return;
  let qty = parseFloat($('sell-qty').value);
  if (isNaN(qty) || qty <= 0) { alert('Ingresá una cantidad válida.'); return; }
  if (qty > a.qty + 1e-9) { alert('No podés vender más de lo que tenés.'); return; }

  const saleValue = qty * a.price;
  const costBasis = a.costBasis || a.price;
  const cost = qty * costBasis;
  const realizedPnl = saleValue - cost;
  const realizedPnlPct = cost > 0 ? (realizedPnl / cost * 100) : 0;

  sales.push({
    id: Date.now() + '-' + a.ticker,
    date: new Date().toISOString().slice(0, 10),
    cId: a.cId, // para poder mostrar las ventas de la cartera que estás mirando
    ticker: a.ticker, name: a.name, cat: a.cat,
    qty, salePrice: a.price,
    saleValue: Math.round(saleValue * 100) / 100,
    costBasis,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    realizedPnlPct: Math.round(realizedPnlPct * 100) / 100
  });
  saveSalesLocal();

  if (qty >= a.qty - 1e-9) assets = assets.filter(x => x.id !== a.id);
  else a.qty -= qty;

  // La liquidez de una venta queda en la MISMA cartera del activo vendido, no
  // en la que estés mirando: si vendés desde la vista "Todo", la plata tiene que
  // volver a donde estaba el activo.
  let cash = assets.find(x => x.cat === 'cash' && x.ticker === 'USD' && x.cId === a.cId);
  if (cash) cash.qty += saleValue;
  else assets.push({ id: ++assetIdCounter, cId: a.cId, name: 'Liquidez USD', ticker: 'USD', cat: 'cash', qty: saleValue, price: 1, costBasis: 1, change24h: null, lastUpdate: null });

  saveAssets();
  renderCartera();
  renderSalesHistory();
  syncCarteraToGitHub();
  syncSalesToGitHub();
  closeSellModal();
}

function renderSalesHistory() {
  const wrap = $('sales-history'), list = $('sales-list');
  if (!wrap || !list) return;
  // Se muestran las ventas de la cartera que estás mirando. Las ventas viejas,
  // anteriores a que existieran varias carteras, no tienen `cId` y se cuentan
  // como de la primera — que es de donde salieron.
  const dePrimera = carteras.length ? carteras[0].id : 1;
  const visibles = carteraActiva === TODAS
    ? sales
    : sales.filter(s => (s.cId != null ? s.cId : dePrimera) === carteraActiva);
  if (!visibles.length) { wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  const sorted = [...visibles].sort((x, y) => y.date.localeCompare(x.date));
  list.innerHTML = sorted.map(s => {
    const pc = s.realizedPnl >= 0 ? 'var(--green)' : 'var(--red)';
    return '<div class="snap-row"><span style="color:var(--muted)">' + s.date + ' · ' + s.ticker + ' (' + s.qty.toLocaleString('es-AR', { maximumFractionDigits: 6 }) + ')</span>' +
      '<span style="color:' + pc + ';font-weight:600">' + (s.realizedPnl >= 0 ? '+' : '') + fmt(s.realizedPnl) + '</span></div>';
  }).join('');
}

async function syncSalesToGitHub() {
  const token = (() => { try { return localStorage.getItem(LS_GH_TOKEN); } catch (e) { return null; } })();
  if (!token) return;
  const apiUrl = `https://api.github.com/repos/${GH_DATA_OWNER}/${GH_DATA_REPO}/contents/${GH_PATH_SALES}`;
  try {
    let sha = null;
    const getRes = await fetch(apiUrl + `?ref=${GH_BRANCH}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } });
    if (getRes.ok) { const cur = await getRes.json(); sha = cur.sha; }
    else if (getRes.status !== 404) return;
    const body = {
      message: 'Actualizar historial de ventas',
      content: b64EncodeUtf8(JSON.stringify({ sales, updatedAt: new Date().toISOString() }, null, 2)),
      branch: GH_BRANCH
    };
    if (sha) body.sha = sha;
    await fetch(apiUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch (e) { /* falla silenciosa: la próxima venta o "Sincronizar ahora" lo vuelve a intentar */ }
}

// Al abrir la app, combina el historial de ventas local con el que ya esté
// en GitHub (por si vendiste algo desde el otro dispositivo) — sin perder
// registros de ninguno de los dos lados.
async function loadSalesRemote() {
  loadSalesLocal();
  try {
    const remote = await ghLeerJson(GH_PATH_SALES);
    if (remote) {
      const byId = {};
      [...sales, ...(remote.sales || [])].forEach(s => { byId[s.id] = s; });
      sales = Object.values(byId);
      saveSalesLocal();
    }
  } catch (e) {}
  renderSalesHistory();
}
loadSalesRemote();

