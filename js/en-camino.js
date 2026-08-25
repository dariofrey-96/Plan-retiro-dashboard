// ── PROYECCIÓN: "¿Vas en camino?" ───────────────────────────────────────────
// Proyecta tu capital DESDE la fecha de inicio de inversión hasta hoy usando los
// parámetros del plan (capital inicial + aportes mensuales que crecen + rendimiento)
// y lo compara con lo que REALMENTE vale tu cartera de jubilación. Así ves si a
// esta altura vas adelantado, igual o atrasado. Todo en USD, como la proyección.
// Aditivo: se dibuja desde recalc() y refreshPrices(), no reemplaza nada.

const LS_JUB_CARTERA = 'finlab_jub_cartera';
function jubScope() { try { return localStorage.getItem(LS_JUB_CARTERA) || 'todas'; } catch (e) { return 'todas'; } }
function jubCambiarCartera(scope) { try { localStorage.setItem(LS_JUB_CARTERA, scope); } catch (e) {} renderEnCamino(); }

// Valor en USD de una cartera (o de todas): cantidad × precio, igual que en Inicio.
function jubValorUSD(scope) {
  if (typeof carteras === 'undefined' || !Array.isArray(carteras)) return 0;
  const lista = scope === 'todas'
    ? carteras.flatMap(c => c.assets || [])
    : ((carteras.find(c => c.id === scope) || {}).assets || []);
  return lista.reduce((s, a) => s + (a.qty || 0) * (a.price || 0), 0);
}

const JUB_MS_MES = (365.25 * 24 * 3600 * 1000) / 12;
// Meses (con decimales) desde la fecha de inicio de inversión hasta hoy.
// null = no hay fecha cargada; -1 = la fecha es futura.
function jubMesesTranscurridos() {
  const el = document.getElementById('fechaInicioInversion');
  if (!el || !el.value) return null;
  const start = new Date(el.value + 'T00:00:00');
  if (isNaN(start)) return null;
  const ms = Date.now() - start.getTime();
  if (ms < 0) return -1;
  return ms / JUB_MS_MES;
}

// Cuánto debería valer hoy: rola el capital mes a mes con el rendimiento del plan
// y sumando el aporte mensual (que crece una vez por año).
function jubEsperado(meses) {
  const g = id => { const e = document.getElementById(id); return e ? (parseFloat(e.value) || 0) : 0; };
  const val = (k, id) => (typeof LC !== 'undefined' && LC && LC[k] != null) ? LC[k] : g(id);
  const ci = val('ci', 'capitalInicial'), ai = val('ai', 'ahorroMensual'),
        ca = val('ca', 'crecAhorro'), ret = val('ret', 'retorno');
  let cap = ci, aho = ai;
  const whole = Math.floor(meses), frac = meses - whole;
  for (let k = 0; k < whole; k++) {
    cap = cap * (1 + ret / 12) + aho;
    if ((k + 1) % 12 === 0) aho *= (1 + ca);
  }
  if (frac > 0) cap = cap * (1 + (ret / 12) * frac) + aho * frac;
  return cap;
}

function jubFechaLinda(v) { const p = String(v).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : v; }
function jubHace(meses) {
  if (meses < 1) { const d = Math.max(1, Math.round(meses * 30.44)); return 'hace ' + d + ' día' + (d === 1 ? '' : 's'); }
  const y = Math.floor(meses / 12), m = Math.round(meses - y * 12);
  const partes = [];
  if (y > 0) partes.push(y + ' año' + (y === 1 ? '' : 's'));
  if (m > 0) partes.push(m + ' mes' + (m === 1 ? '' : 'es'));
  return 'hace ' + (partes.join(' y ') || 'menos de un mes');
}

function renderEnCamino() {
  const cont = document.getElementById('en-camino-card');
  if (!cont) return;
  if (typeof carteras === 'undefined' || !Array.isArray(carteras)) { cont.innerHTML = ''; return; }
  const F = (typeof fmt === 'function') ? fmt : (n => '$' + Math.round(n));
  const verde = 'var(--green)', rojo = 'var(--red)', suave = 'var(--muted)';

  let scope = jubScope();
  if (!(scope === 'todas' || carteras.some(c => c.id === scope))) scope = 'todas';

  // Selector de cartera (sólo si hay más de una).
  let sel = '';
  if (carteras.length > 1) {
    const ops = [{ id: 'todas', n: 'Todas' }].concat(carteras.map(c => ({ id: c.id, n: c.nombre })));
    sel = '<select onchange="jubCambiarCartera(this.value)" style="background:var(--surface3);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:5px 8px;font-size:.8rem;">'
      + ops.map(o => `<option value="${o.id}"${o.id === scope ? ' selected' : ''}>${o.n}</option>`).join('')
      + '</select>';
  }
  const cab = '<div class="chart-header"><span class="chart-title">¿Vas en camino?</span>' + sel + '</div>';

  const meses = jubMesesTranscurridos();
  const fi = document.getElementById('fechaInicioInversion');

  if (meses === null) {
    cont.innerHTML = '<div class="chart-card">' + cab +
      '<div style="font-size:.85rem;color:' + suave + ';margin-top:4px;line-height:1.5;">' +
      'Cargá tu <b>fecha de inicio de inversión</b> en los parámetros (⚙) para ver, según tu plan, cuánto deberías tener hoy y si vas en camino.</div></div>';
    return;
  }
  if (meses === -1) {
    cont.innerHTML = '<div class="chart-card">' + cab +
      '<div style="font-size:.85rem;color:' + suave + ';margin-top:4px;">Tu fecha de inicio de inversión está en el futuro.</div></div>';
    return;
  }

  const esperado = jubEsperado(meses);
  const real = jubValorUSD(scope);
  const dif = real - esperado;
  const enCamino = dif >= 0;
  const cerca = esperado > 0 && Math.abs(dif) < esperado * 0.02;
  const col = cerca ? suave : (enCamino ? verde : rojo);
  const w = esperado > 0 ? Math.min(100, Math.round(real / esperado * 100)) : 0;
  const pct = esperado > 0 ? Math.abs(dif / esperado * 100) : 0;

  let pie;
  if (cerca) pie = 'Vas <b>justo</b> según tu plan. 👌';
  else if (enCamino) pie = `Vas <b style="color:${verde}">${F(dif)}</b> por encima de lo que esperaba tu plan <span style="color:${suave}">(${pct.toFixed(0)}% adelantado)</span>.`;
  else pie = `Te faltan <b style="color:${rojo}">${F(-dif)}</b> para lo que esperaba tu plan <span style="color:${suave}">(${pct.toFixed(0)}% por debajo)</span>.`;

  cont.innerHTML =
    '<div class="chart-card">' + cab +
      '<div class="field-hint" style="margin:0 0 8px">Desde el ' + jubFechaLinda(fi.value) + ' · ' + jubHace(meses) + '</div>' +
      '<div style="display:flex;gap:22px;flex-wrap:wrap;align-items:flex-end;">' +
        '<div><div class="field-hint" style="margin:0">Tenés hoy (cartera)</div>' +
          '<div style="font-size:1.55rem;font-weight:700;letter-spacing:-.01em;color:' + col + '">' + F(real) + '</div></div>' +
        '<div style="opacity:.9"><div class="field-hint" style="margin:0">Deberías tener</div>' +
          '<div style="font-size:1.2rem;font-weight:600;color:' + suave + '">' + F(esperado) + '</div></div>' +
      '</div>' +
      (esperado > 0
        ? '<div style="height:8px;background:var(--surface3);border-radius:100px;overflow:hidden;margin-top:13px;">' +
            '<div style="height:100%;width:' + w + '%;background:' + col + ';border-radius:100px;"></div></div>'
        : '') +
      '<div style="font-size:.85rem;margin-top:11px;line-height:1.4;">' + pie + '</div>' +
      '<div class="field-hint" style="margin-top:9px">En dólares · lo esperado sale de tu capital inicial, tus aportes mensuales y el rendimiento del plan.</div>' +
    '</div>';
}
