// ── FEED DE INSIGHTS ("Para vos hoy") ────────────────────────────────────────
// La estrella de la pantalla Hoy: unas pocas frases en criollo, priorizadas, que
// dicen lo único que hoy importa. NO calcula nada nuevo: junta lo que ya se
// computa en otras partes (alertas de presupuesto, ritmo de gasto, tasa de
// ahorro, patrimonio 24h, ¿vas en camino?, mejor/peor activo) y lo ordena por
// importancia. Cada frase es tappable y lleva a la sección que corresponde.
// Todo con guardas: si falta un dato (p.ej. sin token la cartera viene vacía),
// ese insight simplemente no aparece — nunca rompe la pantalla.

function insightsCandidatos() {
  const C = [];
  const AR = (typeof fmtARS === 'function') ? fmtARS : (n => '$' + Math.round(n));
  const F$ = (typeof fmtC === 'function') ? fmtC : (typeof fmt === 'function' ? fmt : (n => '$' + Math.round(n)));
  const catL = id => (typeof catLabel === 'function') ? catLabel(id) : id;
  const mk = (typeof iniMes === 'function') ? iniMes() : new Date().toISOString().slice(0, 7);
  const dia = new Date().getDate();

  // 1 · Presupuesto: categorías pasadas (rojo) y al borde (naranja).
  if (typeof iniAlertas === 'function' && typeof getPresupuestoCat === 'function' && typeof PV_CAT_IDS !== 'undefined') {
    const pasadas = iniAlertas(); // real/presu >= 1
    if (pasadas.length) {
      const peor = pasadas.slice().sort((a, b) => (b.real / b.presu) - (a.real / a.presu))[0];
      const pctP = Math.round(peor.real / peor.presu * 100);
      const otras = pasadas.length - 1;
      const extra = otras > 0 ? ` (y ${otras} categoría${otras > 1 ? 's' : ''} más)` : '';
      C.push({ prioridad: 100, tono: 'malo', icono: '🚨', destino: 'gastos',
        texto: `Te pasaste en <b>${catL(peor.id)}</b>: vas en el ${pctP}% de lo presupuestado${extra}.` });
    }
    if (typeof loadGastosAll === 'function') {
      const byCat = {};
      (loadGastosAll()[mk] || []).forEach(x => { byCat[x.cat] = (byCat[x.cat] || 0) + (x.monto || 0); });
      let borde = null;
      PV_CAT_IDS.forEach(id => {
        const p = getPresupuestoCat(id); if (!(p > 0)) return;
        const f = (byCat[id] || 0) / p;
        if (f >= 0.8 && f < 1 && (!borde || f > borde.f)) borde = { id, f };
      });
      if (borde) C.push({ prioridad: 72, tono: 'ojo', icono: '⚠️', destino: 'gastos',
        texto: `<b>${catL(borde.id)}</b> ya usó el ${Math.round(borde.f * 100)}% de su presupuesto del mes.` });
    }
  }

  // 2 · Ritmo de gasto vs el mismo tramo del mes pasado.
  if (typeof iniGastadoHastaDia === 'function' && typeof iniMesPasado === 'function') {
    const este = iniGastadoHastaDia(mk, dia), pas = iniGastadoHastaDia(iniMesPasado(), dia);
    if (pas > 0) {
      const dg = este - pas;
      if (dg > pas * 0.12) C.push({ prioridad: 60, tono: 'ojo', icono: '📈', destino: 'gastos',
        texto: `Vas gastando <b>${AR(dg)}</b> más que a esta altura del mes pasado.` });
      else if (dg < -pas * 0.12) C.push({ prioridad: 42, tono: 'bueno', icono: '📉', destino: 'gastos',
        texto: `Vas gastando <b>${AR(-dg)}</b> menos que a esta altura del mes pasado. 👌` });
    }
  }

  // 3 · Tasa de ahorro del mes (sobre el salario cargado en parámetros).
  if (typeof iniNum === 'function' && typeof loadGastosAll === 'function') {
    const salario = iniNum('salario');
    if (salario > 0) {
      const gasto = (loadGastosAll()[mk] || []).reduce((s, x) => {
        const d = new Date((x.fecha || (mk + '-01')) + 'T00:00:00');
        return d.getDate() <= dia ? s + (x.monto || 0) : s;
      }, 0);
      const rate = (salario - gasto) / salario;
      if (rate < 0) C.push({ prioridad: 88, tono: 'malo', icono: '🔴', destino: 'resumen',
        texto: `Este mes ya gastaste <b>más que tu ingreso</b> (${AR(gasto)} de ${AR(salario)}).` });
      else if (rate >= 0.3) C.push({ prioridad: 50, tono: 'bueno', icono: '🐷', destino: 'resumen',
        texto: `Llevás ahorrado el <b>${Math.round(rate * 100)}%</b> de tu ingreso este mes.` });
      else if (rate > 0 && rate < 0.1) C.push({ prioridad: 56, tono: 'ojo', icono: '🐷', destino: 'resumen',
        texto: `Tu ahorro del mes va en el <b>${Math.round(rate * 100)}%</b> del ingreso, por debajo de tu ritmo.` });
    }
  }

  // 4 · Patrimonio: cuánto se movió la inversión en las últimas 24h.
  if (typeof iniValorVivo === 'function' && typeof iniSnapHace24 === 'function' && typeof iniValorSnap === 'function') {
    const inv = iniValorVivo('todo');
    const prev = iniValorSnap(iniSnapHace24(), 'todo');
    if (inv > 0 && prev > 0) {
      const pct = (inv - prev) / prev * 100;
      if (Math.abs(pct) >= 1) C.push({
        prioridad: Math.abs(pct) >= 3 ? 66 : 44, tono: pct >= 0 ? 'bueno' : 'ojo',
        icono: pct >= 0 ? '📈' : '📉', destino: 'cartera',
        texto: `Tu inversión ${pct >= 0 ? 'subió' : 'bajó'} <b>${Math.abs(pct).toFixed(1)}%</b> (${F$(Math.abs(inv - prev))}) en las últimas 24h.` });
    }
  }

  // 5 · ¿Vas en camino? (plan de jubilación).
  if (typeof jubResumen === 'function') {
    const r = jubResumen();
    if (r && !r.cerca) {
      if (r.enCamino) C.push({ prioridad: 46, tono: 'bueno', icono: '🎯', destino: 'retiro',
        texto: `Vas <b>${r.pct.toFixed(0)}% por encima</b> de tu plan de retiro. 🚀` });
      else C.push({ prioridad: 64, tono: 'ojo', icono: '🎯', destino: 'retiro',
        texto: `Estás <b>${r.pct.toFixed(0)}% por debajo</b> de tu plan de retiro.` });
    }
  }

  // 6 · Mejor / peor activo (precio de hoy vs tu precio promedio de compra).
  if (typeof carteras !== 'undefined' && Array.isArray(carteras)) {
    const conCosto = carteras.flatMap(c => c.assets || [])
      .filter(a => a.cat !== 'cash' && a.qty > 0 && (a.costBasis || 0) > 0)
      .map(a => ({ t: a.ticker, pct: (a.price - a.costBasis) / a.costBasis * 100 }))
      .sort((x, y) => y.pct - x.pct);
    if (conCosto.length) {
      const mejor = conCosto[0];
      if (mejor.pct >= 8) C.push({ prioridad: 36, tono: 'bueno', icono: '⭐', destino: 'cartera',
        texto: `<b>${mejor.t}</b> es tu mejor activo: <b>+${mejor.pct.toFixed(0)}%</b> desde tu compra.` });
      const peor = conCosto[conCosto.length - 1];
      if (conCosto.length > 1 && peor.pct <= -8) C.push({ prioridad: 40, tono: 'ojo', icono: '🥶', destino: 'cartera',
        texto: `<b>${peor.t}</b> cae <b>${Math.abs(peor.pct).toFixed(0)}%</b> desde tu compra.` });
    }
  }

  return C.sort((a, b) => b.prioridad - a.prioridad);
}

function renderFeedInsights() {
  let cand;
  try { cand = insightsCandidatos(); } catch (e) { cand = []; }
  if (!cand || !cand.length) return '';
  const top = cand.slice(0, 4);
  const color = t => t === 'bueno' ? 'var(--green)' : t === 'malo' ? 'var(--red)' : t === 'ojo' ? 'var(--orange)' : 'var(--muted)';
  const filas = top.map(i => `<button class="feed-item" style="border-left-color:${color(i.tono)};" onclick="irASeccionApp('${i.destino}')">
      <span class="feed-ic">${i.icono}</span>
      <span class="feed-tx">${i.texto}${i.sub ? `<span class="feed-sub">${i.sub}</span>` : ''}</span>
      <span class="feed-chev">›</span>
    </button>`).join('');
  return `<div class="panel-card feed-card">
    <div class="chart-header"><span class="chart-title">✨ Para vos hoy</span></div>
    <div class="feed">${filas}</div>
  </div>`;
}
