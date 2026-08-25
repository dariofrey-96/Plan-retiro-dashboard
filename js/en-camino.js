// ── PROYECCIÓN: "¿Vas en camino?" ───────────────────────────────────────────
// Compara tu ahorro REAL (el valor de tu cartera de jubilación, en USD) contra
// la BASE del plan (el "capital inicial" cargado en los parámetros). Todo en
// dólares, igual que la proyección. Aditivo: se dibuja desde recalc() y
// refreshPrices() (una línea en cada uno), no reemplaza nada.

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

// Copia el valor real de la cartera al slider de capital inicial y recalcula.
function jubUsarComoBase() {
  const e = document.getElementById('capitalInicial');
  if (!e) return;
  const real = Math.round(jubValorUSD(jubScope()));
  const min = parseFloat(e.min), max = parseFloat(e.max);
  let v = real;
  if (!isNaN(min)) v = Math.max(min, v);
  if (!isNaN(max)) v = Math.min(max, v);
  e.value = v;
  const ve = document.getElementById('v-capitalInicial');
  if (ve && typeof SL !== 'undefined' && SL.capitalInicial) ve.textContent = SL.capitalInicial.d(v);
  if (typeof recalc === 'function') recalc();
  if (typeof saveParams === 'function') saveParams();
}

function renderEnCamino() {
  const cont = document.getElementById('en-camino-card');
  if (!cont) return;
  if (typeof carteras === 'undefined' || !Array.isArray(carteras)) { cont.innerHTML = ''; return; }
  const F = (typeof fmt === 'function') ? fmt : (n => '$' + Math.round(n));

  let scope = jubScope();
  if (!(scope === 'todas' || carteras.some(c => c.id === scope))) scope = 'todas';

  const real = jubValorUSD(scope);
  const base = (typeof LC !== 'undefined' && LC && LC.ci != null)
    ? LC.ci
    : (document.getElementById('capitalInicial') ? (parseFloat(document.getElementById('capitalInicial').value) || 0) : 0);
  const dif = real - base;
  const verde = 'var(--green)', rojo = 'var(--red)', suave = 'var(--muted)';
  const enCamino = dif >= 0;
  const col = base <= 0 ? suave : (enCamino ? verde : rojo);
  const w = base > 0 ? Math.min(100, Math.round(real / base * 100)) : 0;

  let sel = '';
  if (carteras.length > 1) {
    const ops = [{ id: 'todas', n: 'Todas' }].concat(carteras.map(c => ({ id: c.id, n: c.nombre })));
    sel = '<select onchange="jubCambiarCartera(this.value)" style="background:var(--surface3);border:1px solid var(--border);color:var(--text);border-radius:var(--radius-sm);padding:5px 8px;font-size:.8rem;">'
      + ops.map(o => `<option value="${o.id}"${o.id === scope ? ' selected' : ''}>${o.n}</option>`).join('')
      + '</select>';
  }

  let pie;
  if (base <= 0) pie = 'Poné un capital inicial en los parámetros para poder comparar.';
  else if (Math.abs(dif) < base * 0.005) pie = 'Estás justo en la base de tu plan.';
  else if (enCamino) pie = `Vas <b style="color:${verde}">${F(dif)}</b> por encima de la base de tu plan.`;
  else pie = `Te faltan <b style="color:${rojo}">${F(-dif)}</b> para llegar a la base de tu plan.`;

  cont.innerHTML =
    '<div class="chart-card">' +
      '<div class="chart-header"><span class="chart-title">¿Vas en camino?</span>' + sel + '</div>' +
      '<div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-end;margin-top:2px;">' +
        '<div><div class="field-hint" style="margin:0">Tu ahorro real (cartera)</div>' +
          '<div style="font-size:1.55rem;font-weight:700;letter-spacing:-.01em;">' + F(real) + '</div></div>' +
        '<div style="opacity:.85"><div class="field-hint" style="margin:0">Base del plan (capital inicial)</div>' +
          '<div style="font-size:1.15rem;font-weight:600;color:' + suave + '">' + F(base) + '</div></div>' +
      '</div>' +
      (base > 0
        ? '<div style="height:8px;background:var(--surface3);border-radius:100px;overflow:hidden;margin-top:13px;">' +
            '<div style="height:100%;width:' + w + '%;background:' + col + ';border-radius:100px;"></div></div>'
        : '') +
      '<div style="font-size:.85rem;margin-top:11px;line-height:1.4;">' + pie + '</div>' +
      (base > 0 && Math.abs(dif) > 1
        ? '<button onclick="jubUsarComoBase()" class="btn" style="margin-top:13px;">Usar mi cartera como capital inicial</button>'
        : '') +
      '<div class="field-hint" style="margin-top:9px">En dólares.</div>' +
    '</div>';
}
