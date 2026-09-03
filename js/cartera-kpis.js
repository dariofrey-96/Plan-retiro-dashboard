// ── TARJETAS DE CARTERA (nuevas) ─────────────────────────────────────────────
// Capital actual · Rendimiento · TIR anualizada · Mejor activo · Peor activo.
// Reemplazan a las 4 viejas (Valor total / P&L / 24h / % meta), que ya estaban
// repetidas en Proyección. Aditivo: renderCartera() llama a renderCarteraKpis().
// Además esconde la tira de KPIs de Proyección cuando estás en Cartera.

// XIRR (tasa anual que hace 0 el valor presente de los flujos). Bisección: robusta.
// flows: [{amount, date:Date}] — aportes negativos, valor actual positivo.
function xirr(flows) {
  if (!flows || flows.length < 2) return null;
  flows = flows.slice().sort((a, b) => a.date - b.date);
  const t0 = flows[0].date.getTime(), MS = 365.25 * 24 * 3600 * 1000;
  const npv = r => flows.reduce((s, f) => s + f.amount / Math.pow(1 + r, (f.date.getTime() - t0) / MS), 0);
  let lo = -0.9999, hi = 100, flo = npv(lo), fhi = npv(hi);
  if (!isFinite(flo) || !isFinite(fhi) || flo * fhi > 0) return null;   // sin cambio de signo
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2, fm = npv(mid);
    if (!isFinite(fm)) return null;
    if (Math.abs(fm) < 1e-6) return mid;
    if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
  }
  return (lo + hi) / 2;
}

// Construye los flujos de la cartera visible y devuelve la TIR anual (o null).
// Usa los aportes REGISTRADOS (compras.js) con su fecha; lo invertido que sea
// anterior al registro (según el costo promedio) entra como un aporte inicial.
function tirCarteraActual(valorActual) {
  if (typeof assets === 'undefined' || !valorActual) return null;
  const TODASv = (typeof TODAS !== 'undefined') ? TODAS : '__todas__';
  const act = (typeof carteraActiva !== 'undefined') ? carteraActiva : TODASv;
  const dePrimera = (typeof carteras !== 'undefined' && carteras.length) ? carteras[0].id : 1;
  const enScope = c => act === TODASv ? true : ((c.cId != null ? c.cId : dePrimera) === act);

  const cs = (typeof compras !== 'undefined' ? compras : []).filter(c => c && c.amount > 0 && enScope(c));
  const totalCost = assets.reduce((s, a) => s + a.qty * (a.costBasis || a.price), 0);
  const sumC = cs.reduce((s, c) => s + c.amount, 0);

  const fechas = [];
  cs.forEach(c => { if (c.date) fechas.push(new Date(c.date + 'T00:00:00')); });
  assets.forEach(a => { if (a.boughtDate) fechas.push(new Date(a.boughtDate + 'T00:00:00')); });
  const fi = document.getElementById('fechaInicioInversion');
  if (fi && fi.value) fechas.push(new Date(fi.value + 'T00:00:00'));
  fechas.sort((a, b) => a - b);
  const primera = fechas.length ? fechas[0] : null;
  if (!primera) return null;

  const flows = [];
  const faltante = totalCost - sumC;            // lo invertido no capturado por compras.js
  if (faltante > 1) flows.push({ amount: -faltante, date: primera });
  cs.forEach(c => flows.push({ amount: -c.amount, date: new Date(c.date + 'T00:00:00') }));
  flows.push({ amount: valorActual, date: new Date() });

  const primeraHoy = (new Date() - primera) / (365.25 * 24 * 3600 * 1000);
  if (primeraHoy < 20 / 365) return null;        // menos de ~3 semanas: la TIR anualizada no dice nada
  if (!flows.some(f => f.amount < 0) || !flows.some(f => f.amount > 0)) return null;
  return xirr(flows);
}

function renderCarteraKpis(tv, tc, tp, pp) {
  const cont = document.getElementById('cartera-kpis');
  if (!cont) return;
  const F = (typeof fmtC === 'function') ? fmtC : (typeof fmt === 'function' ? fmt : (n => '$' + Math.round(n)));
  const verde = 'var(--green)', rojo = 'var(--red)', suave = 'var(--muted)';
  const sg = n => (n >= 0 ? '+' : '');
  const pctTxt = n => sg(n) + n.toFixed(1) + '%';

  // Variación 24h (para el subtítulo de "Capital actual")
  const w = assets.filter(a => a.change24h != null);
  let ch24 = null;
  if (w.length) {
    const tY = w.reduce((s, a) => s + a.qty * a.price / (1 + a.change24h / 100), 0);
    const tN = w.reduce((s, a) => s + a.qty * a.price, 0);
    ch24 = tY > 0 ? (tN - tY) / tY * 100 : 0;
  }

  // Mejor / peor activo por rendimiento (precio vs precio promedio), sin liquidez
  const conCosto = assets
    .filter(a => a.cat !== 'cash' && a.qty > 0 && (a.costBasis || 0) > 0)
    .map(a => ({ t: a.ticker, pct: (a.price - a.costBasis) / a.costBasis * 100 }))
    .sort((x, y) => y.pct - x.pct);
  const mejor = conCosto[0] || null;
  const peor = conCosto.length > 1 ? conCosto[conCosto.length - 1] : null;

  const tir = tirCarteraActual(tv);

  const card = (label, valHtml, subHtml) =>
    '<div class="ckpi ck2"><div class="ckpi-label">' + label + '</div>' + valHtml +
    (subHtml ? '<div class="ck2-sub">' + subHtml + '</div>' : '') + '</div>';

  const activoCard = (label, d, col) => card(label,
    d ? '<div class="ckpi-val" style="font-size:1.15rem;color:' + col + '">' + d.t + '</div>'
      : '<div class="ckpi-val" style="font-size:1.15rem;color:' + suave + '">—</div>',
    d ? '<span style="color:' + col + ';font-weight:700">' + pctTxt(d.pct) + '</span>' : '');

  cont.innerHTML =
    card('Capital actual',
      '<div class="ckpi-val" style="color:var(--accent-text,var(--accent))">' + F(tv) + '</div>',
      ch24 != null ? '<span style="color:' + (ch24 >= 0 ? verde : rojo) + '">Hoy ' + pctTxt(ch24) + '</span>'
        : '<span style="color:' + suave + '">sin datos 24h</span>') +
    card('Rendimiento',
      '<div class="ckpi-val" style="color:' + (tp >= 0 ? verde : rojo) + '">' + sg(tp) + F(tp) + '</div>',
      '<span style="color:' + (tp >= 0 ? verde : rojo) + '">' + pctTxt(pp * 100) + ' total</span>') +
    card('TIR anualizada',
      tir != null
        ? '<div class="ckpi-val" style="color:' + (tir >= 0 ? verde : rojo) + '">' + pctTxt(tir * 100) + '</div>'
        : '<div class="ckpi-val" style="color:' + suave + '">—</div>',
      tir != null ? 'sobre tus aportes reales' : 'faltan datos de aportes') +
    activoCard('Mejor activo', mejor, verde) +
    activoCard('Peor activo', peor, rojo);
}

// ── Esconder la tira de KPIs de Proyección cuando estás en Cartera ──
(function () {
  // En Cartera se esconden las tiras de KPIs de Proyección (la principal y la de
  // "salud": Ahorro mensual / Retorno real), que ya están en Proyección.
  function toggleStrip(v) {
    try {
      document.querySelectorAll('.kpi-strip, .health-strip').forEach(s => {
        s.style.display = (v === 'cartera') ? 'none' : '';
      });
    } catch (e) {}
  }
  if (typeof switchView === 'function') {
    const _sv = switchView;
    switchView = function (v, btn) { const r = _sv(v, btn); toggleStrip(v); return r; };
  }
  function ini() { const a = document.querySelector('#mitad-retiro .view.active'); if (a) toggleStrip(a.id.replace('view-', '')); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ini); else ini();
})();
