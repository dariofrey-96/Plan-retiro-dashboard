// ── SECCIÓN INICIO ──────────────────────────────────────────────────────────
// El panel de arriba de todo: junta las DOS mitades en un solo resumen. Es el
// primer lugar donde la cartera (USD) y el presupuesto (ARS) conviven, así que
// cada bloque aclara su moneda.
//
// No duplica lógica: lee `carteras`/`histData` de la mitad de retiro y reusa
// loadGastosAll/getPresupuestoCat/loadAlertasCfg de la de presupuesto. Como todo
// vive en el mismo scope global, puede llamar a las dos sin tocarlas.

const LS_APORTES = 'finlab_aportes_v1';
let iniScope = null;          // null = sin elegir → se resuelve a la cartera de jubilación
                              // 'todo' | id de cartera — sólo afecta al bloque de patrimonio
let editandoAportes = false;

function iniNum(id) { const el = $(id); const n = el ? parseFloat(el.value) : NaN; return isNaN(n) ? 0 : n; }
function iniMes() { return (typeof monthKey === 'function') ? monthKey() : new Date().toISOString().slice(0, 7); }
function iniMesPasado() { const h = new Date(); return monthKey(new Date(h.getFullYear(), h.getMonth() - 1, 1)); }

// ── Patrimonio ──────────────────────────────────────────────────────────────
function iniValorVivo(scope) {
  const lista = scope === 'todo'
    ? carteras.flatMap(c => c.assets)
    : (carteras.find(c => c.id === scope) || { assets: [] }).assets;
  return lista.reduce((s, a) => s + (a.qty || 0) * (a.price || 0), 0);
}
function iniValorSnap(snap, scope) {
  if (!snap) return 0;
  if (scope === 'todo') return snap.total || 0;
  if (snap.porCartera && snap.porCartera[scope]) return snap.porCartera[scope].total || 0;
  const c = carteras.find(x => x.id === scope);
  if (!c || !snap.byAsset) return 0;
  return c.assets.reduce((s, a) => s + (snap.byAsset[a.ticker] || 0), 0);
}
function iniSnapsOrdenados() {
  if (!histData || !histData.snapshots || !histData.snapshots.length) return [];
  return [...histData.snapshots].sort((a, b) => getSnapTime(a) - getSnapTime(b));
}
// El snapshot más cercano a hace 24h: el más nuevo que ya tenga 24h de viejo.
// Si todavía no hay 24h de historia, el más antiguo que haya.
function iniSnapHace24() {
  const s = iniSnapsOrdenados();
  if (!s.length) return null;
  const ahora = getSnapTime(s[s.length - 1]);
  let cand = null;
  for (const x of s) if (ahora - getSnapTime(x) >= 24 * 3600000) cand = x;
  return cand || s[0];
}

// ── Gastos por día (para "acumulado hasta hoy" y comparaciones) ─────────────
function iniGastadoHastaDia(mesKey, diaTope) {
  return (loadGastosAll()[mesKey] || []).reduce((s, x) => {
    const d = new Date((x.fecha || (mesKey + '-01')) + 'T00:00:00');
    return d.getDate() <= diaTope ? s + (x.monto || 0) : s;
  }, 0);
}

// ── Aportes a los fondos ────────────────────────────────────────────────────
function iniLoadAportes() { try { return JSON.parse(localStorage.getItem(LS_APORTES) || '{}'); } catch (e) { return {}; } }
function iniAporteManual(mk) { return iniLoadAportes()[mk] || null; }
function iniGuardarAporte() {
  const inv = Math.max(0, parseFloat(($('aporte-inv') || {}).value) || 0);
  const emer = Math.max(0, parseFloat(($('aporte-emer') || {}).value) || 0);
  const all = iniLoadAportes();
  all[iniMes()] = { inv, emer };
  try { localStorage.setItem(LS_APORTES, JSON.stringify(all)); } catch (e) {}
  editandoAportes = false;
  renderInicio();
}
function iniUsarEstimado() {
  const all = iniLoadAportes();
  delete all[iniMes()];
  try { localStorage.setItem(LS_APORTES, JSON.stringify(all)); } catch (e) {}
  editandoAportes = false;
  renderInicio();
}
function iniEditarAportes() { editandoAportes = true; renderInicio(); }

// ── Alertas del MES ACTUAL (calcularAlertas usa mesVisible, que puede ser otro) ─
function iniAlertas() {
  if (typeof getPresupuestoCat !== 'function' || typeof PV_CAT_IDS === 'undefined') return [];
  const byCat = {};
  (loadGastosAll()[iniMes()] || []).forEach(x => { byCat[x.cat] = (byCat[x.cat] || 0) + (x.monto || 0); });
  const out = [];
  PV_CAT_IDS.forEach(id => {
    const presu = getPresupuestoCat(id);
    if (!(presu > 0)) return;
    const real = byCat[id] || 0;
    if (real / presu >= 1) out.push({ id, real, presu });
  });
  return out;
}

// ── Render ──────────────────────────────────────────────────────────────────
function iniCambiarScope(scope) { iniScope = scope; renderInicio(); }

// Scope por defecto del patrimonio en Inicio: la cartera de jubilación (por
// nombre). Si hay una sola cartera el toggle ni aparece, y si ninguna coincide
// cae a 'todo' (el total) en vez de adivinar.
function iniScopePorDefecto() {
  if (!Array.isArray(carteras) || carteras.length <= 1) return 'todo';
  const jub = carteras.find(c => /jubila|retiro/i.test(c.nombre || ''));
  return jub ? jub.id : 'todo';
}

function renderInicio() {
  const cont = $('inicio-content');
  if (!cont) return;
  const F$ = (typeof fmtC === 'function') ? fmtC : (typeof fmt === 'function' ? fmt : (n => '$' + Math.round(n)));
  const AR = (typeof fmtARS === 'function') ? fmtARS : (n => '$' + Math.round(n).toLocaleString('es-AR'));
  const verde = 'var(--green)', rojo = 'var(--red)', suave = 'var(--muted)';
  const hoy = new Date(), dia = hoy.getDate();
  const mk = iniMes(), mkPrev = iniMesPasado();
  const H = [];

  // Saludo
  const hora = hoy.getHours();
  const saludo = hora < 6 ? 'Buenas noches' : hora < 13 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches';
  H.push(`<div style="padding:6px 2px 2px 2px;"><div style="font-size:1.1rem;font-weight:700;">${saludo}</div>
    <div class="field-hint" style="margin:0;">Tu resumen de hoy · ${hoy.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</div></div>`);

  // ── Alertas activas (banner, sólo si hay) ──
  const alertas = iniAlertas();
  if (alertas.length) {
    const nombres = alertas.map(a => (typeof catLabel === 'function' ? catLabel(a.id) : a.id)).slice(0, 3).join(', ');
    H.push(`<button onclick="irASeccionApp('gastos')" style="width:100%;text-align:left;background:var(--red-soft);border:1px solid var(--red);border-radius:var(--radius-md);padding:12px 14px;color:var(--text);cursor:pointer;display:flex;gap:10px;align-items:center;">
      <span style="font-size:1.1rem;">⚠️</span>
      <span style="font-size:.82rem;line-height:1.3;"><b>${alertas.length} ${alertas.length === 1 ? 'categoría pasada' : 'categorías pasadas'} de presupuesto</b><br><span style="color:${suave};">${nombres} · tocá para ver</span></span>
    </button>`);
  }

  // ── Patrimonio ──
  // Por defecto muestra la cartera de jubilación (no el total): si no se tocó el
  // toggle en esta sesión, se resuelve sola. Se reinicia en cada carga de la app.
  const scope = (iniScope != null) ? iniScope : iniScopePorDefecto();
  const snaps = iniSnapsOrdenados();
  const nuevo = snaps.length ? snaps[snaps.length - 1] : null;
  const actual = iniValorVivo(scope) || iniValorSnap(nuevo, scope);
  const prev = iniValorSnap(iniSnapHace24(), scope);
  const pct = prev > 0 ? (actual - prev) / prev * 100 : null;
  const dif = prev > 0 ? actual - prev : null;
  const col = (pct == null || Math.abs(pct) < 0.005) ? suave : (pct >= 0 ? verde : rojo);
  const flecha = pct == null ? '' : (pct >= 0 ? '▲' : '▼');

  const chips = [{ id: 'todo', n: 'Todo' }].concat(
    carteras.length > 1 ? carteras.map(c => ({ id: c.id, n: c.nombre })) : []
  ).map(o => `<button onclick="iniCambiarScope(${typeof o.id === 'string' ? `'${o.id}'` : o.id})"
      class="toggle-btn${scope === o.id ? ' active' : ''}">${o.n}</button>`).join('');

  // Mini-resumen de "¿vas en camino?" (sólo jubilación), para verlo de un vistazo
  // sin ir a Proyección. Tocá la línea para abrir el detalle completo allá.
  let caminoLinea = '';
  if (typeof jubResumen === 'function') {
    const r = jubResumen();
    if (r) {
      const ccol = r.cerca ? suave : (r.enCamino ? verde : rojo);
      const cflecha = r.cerca ? '●' : (r.enCamino ? '▲' : '▼');
      const ctxt = r.cerca ? 'En línea con el plan'
        : (r.enCamino ? `${r.pct.toFixed(0)}% por encima del plan`
                      : `${r.pct.toFixed(0)}% por debajo del plan`);
      caminoLinea = `<button onclick="irASeccionApp('retiro')" style="width:100%;margin-top:11px;padding:9px 11px;background:var(--surface3);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:.8rem;text-align:left;">
        <span style="color:${suave};">🎯 Plan de jubilación</span>
        <span style="color:${ccol};font-weight:600;white-space:nowrap;">${cflecha} ${ctxt} ›</span>
      </button>`;
    }
  }

  H.push(`<div class="panel-card">
    <div class="chart-header"><span class="chart-title">💰 Patrimonio</span>
      ${carteras.length > 1 ? `<div class="toggle-wrap">${chips}</div>` : ''}</div>
    <div style="font-size:2.3rem;font-weight:800;letter-spacing:-.02em;line-height:1.05;">${F$(actual)}</div>
    <div style="display:flex;align-items:baseline;gap:9px;margin-top:6px;">
      ${pct == null
      ? `<span class="field-hint" style="margin:0;">Sin historial suficiente para la variación de 24h.</span>`
      : `<span style="color:${col};font-size:.9rem;font-weight:600;">${flecha} ${Math.abs(pct).toFixed(2)}%</span>
         <span style="color:${suave};font-size:.82rem;">${dif >= 0 ? '+' : '−'}${F$(Math.abs(dif))} en 24h</span>`}
    </div>
    <div class="field-hint" style="margin-top:8px;">En dólares.</div>
    ${caminoLinea}
  </div>`);

  // ── Gastos del mes vs mismo tramo del mes pasado ──
  const esteMes = iniGastadoHastaDia(mk, dia);
  const mesPasado = iniGastadoHastaDia(mkPrev, dia);
  const dg = esteMes - mesPasado;
  const gcol = mesPasado === 0 ? suave : (dg <= 0 ? verde : rojo);
  let lectura;
  if (mesPasado === 0) lectura = 'No hay gastos del mes pasado para comparar todavía.';
  else if (Math.abs(dg) < mesPasado * 0.02) lectura = 'Vas prácticamente igual que el mes pasado.';
  else lectura = `Vas ${AR(Math.abs(dg))} ${dg > 0 ? 'más' : 'menos'} que a esta altura del mes pasado.`;

  H.push(`<div class="panel-card">
    <div class="chart-header"><span class="chart-title">📅 Gastos del mes</span>
      <span class="field-hint" style="margin:0;">al día ${dia}</span></div>
    <div style="display:flex;align-items:flex-end;gap:16px;margin-top:4px;">
      <div><div style="font-size:1.6rem;font-weight:700;">${AR(esteMes)}</div>
        <div class="field-hint" style="margin:0;">este mes</div></div>
      <div style="opacity:.7;"><div style="font-size:1.1rem;font-weight:600;color:${suave};">${AR(mesPasado)}</div>
        <div class="field-hint" style="margin:0;">mes pasado</div></div>
    </div>
    <div style="color:${gcol};font-size:.84rem;font-weight:600;margin-top:10px;">${lectura}</div>
    <div class="field-hint" style="margin-top:4px;">En pesos.</div>
  </div>`);

  // ── Esta semana: top categorías últimos 7 días ──
  const desde = new Date(hoy); desde.setHours(0, 0, 0, 0); desde.setDate(hoy.getDate() - 6);
  const semana = {};
  [...(loadGastosAll()[mk] || []), ...(loadGastosAll()[mkPrev] || [])].forEach(x => {
    const d = new Date((x.fecha || '') + 'T00:00:00');
    if (d >= desde && d <= hoy) semana[x.cat] = (semana[x.cat] || 0) + (x.monto || 0);
  });
  const totSem = Object.values(semana).reduce((a, b) => a + b, 0);
  const top = Object.entries(semana).sort((a, b) => b[1] - a[1]).slice(0, 3);
  H.push(`<div class="panel-card">
    <div class="chart-header"><span class="chart-title">🗓️ Esta semana</span>
      <span class="field-hint" style="margin:0;">últimos 7 días</span></div>
    ${top.length === 0
      ? `<div class="field-hint" style="margin:6px 0 0 0;">No cargaste gastos en los últimos 7 días.</div>`
      : `<div style="font-size:1.3rem;font-weight:700;margin:2px 0 12px 0;">${AR(totSem)}</div>` +
        top.map(([cat, monto]) => {
          const w = totSem > 0 ? Math.round(monto / top[0][1] * 100) : 0;
          const lbl = (typeof catLabel === 'function') ? catLabel(cat) : cat;
          return `<div style="margin-bottom:11px;">
            <div style="display:flex;justify-content:space-between;font-size:.84rem;margin-bottom:4px;"><span>${lbl}</span><span style="font-weight:600;">${AR(monto)}</span></div>
            <div style="height:6px;background:var(--surface3);border-radius:100px;overflow:hidden;"><div style="height:100%;width:${w}%;background:var(--accent);border-radius:100px;"></div></div>
          </div>`;
        }).join('')}
    <div class="field-hint" style="margin-top:2px;">En pesos.</div>
  </div>`);

  // ── Aportes del mes a los fondos ──
  const objInv = iniNum('fInversiones'), objEmer = iniNum('fEmergencia'), objTot = objInv + objEmer;
  if (objTot > 0) {
    const salario = iniNum('salario');
    const gastoReal = (loadGastosAll()[mk] || []).reduce((s, x) => {
      const d = new Date((x.fecha || (mk + '-01')) + 'T00:00:00');
      return d.getDate() <= dia ? s + (x.monto || 0) : s;
    }, 0);
    const sobrante = Math.max(0, salario - gastoReal);
    const manual = iniAporteManual(mk);
    // Estimación proporcional del sobrante entre los dos fondos (neutral, no
    // asume prioridad de uno sobre otro). Con datos manuales, se usan esos.
    const estInv = objTot > 0 ? Math.min(objInv, sobrante * objInv / objTot) : 0;
    const estEmer = objTot > 0 ? Math.min(objEmer, sobrante * objEmer / objTot) : 0;
    const invAp = manual ? manual.inv : estInv;
    const emerAp = manual ? manual.emer : estEmer;

    const fila = (nombre, ap, obj) => {
      const w = obj > 0 ? Math.min(100, Math.round(ap / obj * 100)) : 0;
      const ok = ap >= obj - 1;
      const barra = ok ? verde : (w >= 60 ? 'var(--orange)' : rojo);
      return `<div style="margin-bottom:14px;">
        <div style="display:flex;justify-content:space-between;font-size:.84rem;margin-bottom:5px;">
          <span>${nombre}</span>
          <span style="color:${suave};">${AR(ap)} / ${AR(obj)}</span></div>
        <div style="height:8px;background:var(--surface3);border-radius:100px;overflow:hidden;"><div style="height:100%;width:${w}%;background:${barra};border-radius:100px;"></div></div>
        <div style="font-size:.74rem;color:${ok ? verde : suave};margin-top:4px;">${ok ? '✓ Aporte cubierto' : 'Faltan ' + AR(Math.max(0, obj - ap))}</div>
      </div>`;
    };

    let cuerpo;
    if (editandoAportes) {
      cuerpo = `<div class="field-hint" style="margin:2px 0 12px 0;">Anotá cuánto pusiste de verdad en cada fondo este mes.</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <label style="font-size:.82rem;">Fondo de inversiones
            <input id="aporte-inv" type="number" inputmode="numeric" value="${Math.round(invAp)}" style="width:100%;margin-top:4px;background:var(--surface3);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:9px 10px;font-size:.9rem;"></label>
          <label style="font-size:.82rem;">Fondo de emergencia
            <input id="aporte-emer" type="number" inputmode="numeric" value="${Math.round(emerAp)}" style="width:100%;margin-top:4px;background:var(--surface3);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:9px 10px;font-size:.9rem;"></label>
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;">
          <button class="btn btn-primary" style="flex:1;" onclick="iniGuardarAporte()">Guardar</button>
          <button class="btn btn-cancel" onclick="iniUsarEstimado()">Usar estimado</button>
        </div>`;
    } else {
      const verdicto = manual
        ? ''
        : (sobrante >= objTot
          ? `<div style="color:${verde};font-size:.84rem;font-weight:600;margin-bottom:12px;">Te alcanza para aportar todo tu plan (${AR(objTot)}) y te sobran ${AR(sobrante - objTot)}.</div>`
          : `<div style="color:${rojo};font-size:.84rem;font-weight:600;margin-bottom:12px;">Tu sobrante (${AR(sobrante)}) no cubre el plan de ${AR(objTot)}. Faltarían ${AR(objTot - sobrante)}.</div>`);
      cuerpo = verdicto + fila('Fondo de inversiones', invAp, objInv) + fila('Fondo de emergencia', emerAp, objEmer) +
        `<div style="display:flex;justify-content:space-between;align-items:center;margin-top:2px;">
          <span class="field-hint" style="margin:0;">${manual ? 'Aportes que cargaste vos.' : 'Estimado según tu sobrante del mes.'}</span>
          <button onclick="iniEditarAportes()" style="background:none;border:none;color:var(--accent);font-size:.8rem;font-weight:600;cursor:pointer;padding:0;">${manual ? 'Editar' : 'Corregir'}</button>
        </div>`;
    }
    H.push(`<div class="panel-card">
      <div class="chart-header"><span class="chart-title">🎯 Aportes del mes</span></div>
      ${cuerpo}
      <div class="field-hint" style="margin-top:8px;">En pesos.</div>
    </div>`);
  }

  cont.innerHTML = H.join('');
}
