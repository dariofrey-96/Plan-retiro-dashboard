// ── RESUMEN MENSUAL DE CARTERA (aditivo, no toca loadHistory/setCarteraCurrency originales) ──
const MONTHLY_CAT_LABELS = { crypto: 'Crypto', stock: 'Acciones/ETFs', metal: 'Metales', cash: 'USD/USDT' };

// byCategory en history.json sólo trackea crypto/stock/metal (ver fetch-snapshot.mjs).
// El resto de "total" es liquidez (cash) — se reconstruye por diferencia.
function monthlyCatTotal(snap, cat) {
  const bc = snap.byCategory || {};
  if (cat === 'cash') return Math.max(0, (snap.total || 0) - (bc.crypto || 0) - (bc.stock || 0) - (bc.metal || 0));
  return bc[cat] || 0;
}

function findSnapAtOrBefore(snaps, ts, fallback) {
  let found = fallback;
  for (const s of snaps) { if (getSnapTime(s) <= ts) found = s; else break; }
  return found;
}

function renderMonthlySummary() {
  const el = $('monthly-summary');
  if (!el || !histData) return;
  // Cada medición se mira desde la cartera elegida antes de hacer cualquier
  // cuenta, conservando fecha y benchmarks para que el resto siga igual.
  const snaps = [...(histData.snapshots || [])]
    .sort((a, b) => getSnapTime(a) - getSnapTime(b))
    .map(s => ({ ...vistaSnapshot(s), date: s.date, timestamp: s.timestamp, benchmarks: s.benchmarks }));
  if (snaps.length < 2) return; // deja el mensaje por defecto del HTML

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();

  const startSnap = findSnapAtOrBefore(snaps, monthStart, snaps[0]);
  const endSnap = snaps[snaps.length - 1];
  if (startSnap === endSnap) return;

  // Flujos externos del mes: aportes (compras.js) y ventas, respetando la cartera
  // que estás viendo (mismo criterio que el historial de ventas). Sirven para
  // separar el RENDIMIENTO real de la plata que metiste o sacaste este mes.
  const mesStr = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const pmDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const mesPrevStr = pmDate.getFullYear() + '-' + String(pmDate.getMonth() + 1).padStart(2, '0');
  const dePrimera = (typeof carteras !== 'undefined' && carteras.length) ? carteras[0].id : 1;
  const enVista = r => (typeof carteraActiva === 'undefined' || carteraActiva === TODAS)
    ? true : ((r.cId != null ? r.cId : dePrimera) === carteraActiva);

  const aporteMes = {}, aporteCat = {}; let aporteTot = 0, aportePrev = 0;
  (typeof compras !== 'undefined' ? compras : []).forEach(c => {
    if (!c || !enVista(c)) return;
    const m = (c.date || '').slice(0, 7);
    if (m === mesStr) {
      aporteMes[c.ticker] = (aporteMes[c.ticker] || 0) + (c.amount || 0);
      if (c.cat) aporteCat[c.cat] = (aporteCat[c.cat] || 0) + (c.amount || 0);
      aporteTot += (c.amount || 0);
    } else if (m === mesPrevStr) aportePrev += (c.amount || 0);
  });
  const ventaMes = {}, ventaCat = {}; let ventaTot = 0;
  (typeof sales !== 'undefined' ? sales : []).forEach(s => {
    if (!s || (s.date || '').slice(0, 7) !== mesStr || !enVista(s)) return;
    ventaMes[s.ticker] = (ventaMes[s.ticker] || 0) + (s.saleValue || 0);
    if (s.cat) ventaCat[s.cat] = (ventaCat[s.cat] || 0) + (s.saleValue || 0);
    ventaTot += (s.saleValue || 0);
  });

  // Rendimiento del mes = variación de valor − lo que aportaste. Las ventas NO
  // cambian el total (el activo se vuelve liquidez dentro de la misma cartera).
  const delta = (endSnap.total - startSnap.total) - aporteTot;
  const baseTot = startSnap.total + aporteTot;
  const pct = baseTot ? (delta / baseTot * 100) : 0;
  const sign = delta >= 0 ? '+' : '';
  const cls = delta >= 0 ? 'green' : 'red';
  const monthName = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

  // Comparación contra el mes anterior: el snapshot al inicio del mes en
  // curso es, a la vez, el cierre aproximado del mes anterior.
  const prevStartSnap = findSnapAtOrBefore(snaps, prevMonthStart, null);
  let prevComparisonHtml = '';
  if (prevStartSnap && prevStartSnap !== startSnap) {
    const prevDelta = (startSnap.total - prevStartSnap.total) - aportePrev;
    const better = delta >= prevDelta;
    prevComparisonHtml = `<div class="field-hint">Mes anterior: ${prevDelta >= 0 ? '+' : ''}${fmtC(prevDelta)} — este mes vas ${better ? 'mejor 📈' : 'más flojo 📉'} que el anterior.</div>`;
  }

  // Top movers por activo (en $ y %).
  const assetKeys = new Set([...Object.keys(startSnap.byAsset || {}), ...Object.keys(endSnap.byAsset || {})]);
  const movers = [...assetKeys].filter(a => a !== 'USD').map(a => {
    const s0 = startSnap.byAsset?.[a] || 0, s1 = endSnap.byAsset?.[a] || 0;
    const ap = aporteMes[a] || 0, ve = ventaMes[a] || 0;
    const d = (s1 - s0) - ap + ve;          // sólo la parte de precio, sin aportes ni ventas
    const base = s0 + ap;
    return { ticker: a, delta: d, pct: base > 0 ? d / base * 100 : null, isNew: s0 === 0 && s1 > 0 };
  }).filter(m => Math.abs(m.delta) > 0.005);
  const gainers = movers.filter(m => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const losers = movers.filter(m => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 3);

  // Desglose por categoría.
  const catDeltas = Object.keys(MONTHLY_CAT_LABELS)
    .map(cat => {
      let d = monthlyCatTotal(endSnap, cat) - monthlyCatTotal(startSnap, cat) - (aporteCat[cat] || 0) + (ventaCat[cat] || 0);
      // La liquidez sube por las ventas (y por aportes de USD); nada de eso es
      // rendimiento, así que se descuenta para que no figure como ganancia.
      if (cat === 'cash') d -= ventaTot;
      return { cat, delta: d };
    })
    .filter(c => Math.abs(c.delta) > 0.005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  const moverRow = (m, isGain) => `<div class="mover-row"><span>${isGain ? '🟢' : '🔴'} ${m.ticker}${m.isNew ? ' (nuevo)' : ''}</span><span class="${isGain ? 'green' : 'red'}">${m.delta >= 0 ? '+' : ''}${fmtC(m.delta)}${m.pct != null ? ` (${m.pct >= 0 ? '+' : ''}${m.pct.toFixed(1)}%)` : ''}</span></div>`;
  const catRow = c => `<div class="mover-row"><span>${MONTHLY_CAT_LABELS[c.cat]}</span><span class="${c.delta >= 0 ? 'green' : 'red'}">${c.delta >= 0 ? '+' : ''}${fmtC(c.delta)}</span></div>`;

  el.innerHTML = `
    <div class="ckpi"><div class="ckpi-label">Cartera en ${monthName}</div><div class="ckpi-val ${cls}">${sign}${fmtC(delta)} (${sign}${pct.toFixed(1)}%)</div></div>
    ${prevComparisonHtml}
    ${renderBenchmarkBlock(startSnap, endSnap, pct)}
    ${gainers.length ? `<div class="summary-block"><div class="summary-block-title">📈 Lo que más subió</div>${gainers.map(m => moverRow(m, true)).join('')}</div>` : ''}
    ${losers.length ? `<div class="summary-block"><div class="summary-block-title">📉 Lo que más cayó</div>${losers.map(m => moverRow(m, false)).join('')}</div>` : ''}
    ${catDeltas.length ? `<div class="summary-block"><div class="summary-block-title">Por categoría</div>${catDeltas.map(catRow).join('')}</div>` : ''}
  `;
}

// ── "¿FUE EL MERCADO O FUI YO?" ────────────────────────────────────────────
// Los snapshots viejos no traen benchmarks (se agregaron después), así que
// todo esto devuelve '' si no hay datos en ambas puntas del período.
const BENCH_LABELS = { spy: 'S&P 500', btc: 'Bitcoin', gold: 'Oro' };

function renderBenchmarkBlock(startSnap, endSnap, carteraPct) {
  const b0 = startSnap.benchmarks, b1 = endSnap.benchmarks;
  if (!b0 || !b1) return '';

  const filas = Object.keys(BENCH_LABELS)
    .filter(k => typeof b0[k] === 'number' && b0[k] > 0 && typeof b1[k] === 'number')
    .map(k => ({ clave: k, pct: (b1[k] - b0[k]) / b0[k] * 100 }));
  if (!filas.length) return '';

  const fila = f => `<div class="mover-row"><span>${BENCH_LABELS[f.clave]}</span><span class="${f.pct >= 0 ? 'green' : 'red'}">${f.pct >= 0 ? '+' : ''}${f.pct.toFixed(1)}%</span></div>`;

  // La lectura en criollo: compara tu cartera contra el promedio de las
  // referencias, para decir si el movimiento fue tuyo o del mercado en general.
  const promedio = filas.reduce((s, f) => s + f.pct, 0) / filas.length;
  const dif = carteraPct - promedio;
  let lectura;
  if (Math.abs(dif) < 0.5) lectura = 'Tu cartera se movió prácticamente igual que el mercado.';
  else if (dif > 0) lectura = `Tu cartera le ganó al mercado por ${dif.toFixed(1)} puntos. 👏`;
  else lectura = `Tu cartera quedó ${Math.abs(dif).toFixed(1)} puntos por debajo del mercado.`;

  return `<div class="summary-block">
    <div class="summary-block-title">🌍 ¿Fue el mercado o fuiste vos?</div>
    <div class="mover-row"><span><b>Tu cartera</b></span><span class="${carteraPct >= 0 ? 'green' : 'red'}"><b>${carteraPct >= 0 ? '+' : ''}${carteraPct.toFixed(1)}%</b></span></div>
    ${filas.map(fila).join('')}
    <div class="field-hint">${lectura}</div>
  </div>`;
}

(function () {
  const _loadHistory = loadHistory;
  loadHistory = async function (...args) {
    const r = await _loadHistory(...args);
    renderMonthlySummary();
    return r;
  };
  const _setCarteraCurrency = setCarteraCurrency;
  setCarteraCurrency = function (...args) {
    const r = _setCarteraCurrency(...args);
    renderMonthlySummary();
    return r;
  };
})();

// ── ESCALA LINEAL / LOGARÍTMICA DEL GRÁFICO DE PROYECCIÓN ──────────────────
// En lineal, el interés compuesto aplasta los primeros 20-30 años contra el
// piso. En logarítmica, la misma altura siempre significa el mismo % de
// crecimiento, así que la curva se ve pareja de punta a punta.
// Arranca en logarítmica: en lineal el interés compuesto aplasta los primeros
// 20-30 años contra el piso y no se aprecia nada. El botón "Lineal" sigue ahí.
let escalaY = 'log';
const CB_EJE_Y_ORIGINAL = chart.options.scales.y.ticks.callback;

function aplicarEscalaY() {
  const log = escalaY === 'log';
  chart.options.scales.y.type = log ? 'logarithmic' : 'linear';
  // El logaritmo de 0 (o de un negativo) no existe: esos puntos se saltean en
  // vez de romper la escala. Pasa cuando el capital inicial es 0.
  if (log) {
    chart.data.datasets.forEach(ds => {
      ds.data = ds.data.map(v => (typeof v === 'number' && v <= 0) ? null : v);
    });
    // Chart.js en log genera marcas irregulares (30K, 60K, 80K...) y llena el
    // eje. Se reemplazan por una serie clásica 1-2-5 por década, que da
    // valores redondos y una cantidad razonable para el celular.
    chart.options.scales.y.afterBuildTicks = escala => {
      const marcas = [];
      for (let e = Math.floor(Math.log10(escala.min)); e <= Math.ceil(Math.log10(escala.max)); e++) {
        [1, 2, 5].forEach(m => {
          const v = m * Math.pow(10, e);
          if (v >= escala.min && v <= escala.max) marcas.push({ value: v });
        });
      }
      if (marcas.length) escala.ticks = marcas;
    };
    chart.options.scales.y.ticks.callback = v =>
      v >= 1e6 ? '$' + (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M'
      : v >= 1e3 ? '$' + Math.round(v / 1e3) + 'K'
      : '$' + Math.round(v);
  } else {
    chart.options.scales.y.ticks.callback = CB_EJE_Y_ORIGINAL;
    delete chart.options.scales.y.afterBuildTicks;
  }
  chart.update();
}

function setEscalaY(tipo, btn) {
  escalaY = tipo;
  document.querySelectorAll('#escala-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  recalc(); // rehace los datos desde cero; el enganche de abajo aplica la escala
}

// Se engancha a recalc() para que la escala sobreviva a cualquier cambio de
// parámetros, sin tocar la función original.
(function () {
  const _recalc = recalc;
  recalc = function (...args) { const r = _recalc(...args); aplicarEscalaY(); return r; };
})();

// El primer dibujo del gráfico ocurre en el INIT de nucleo.js, ANTES de que se
// enganche la escala de acá. Sin esto el eje arrancaba en lineal aunque el
// estado y el botón dijeran "log". Se aplica una vez, ahora que el enganche ya
// está puesto y el gráfico ya tiene datos.
try { aplicarEscalaY(); } catch (e) {}

