// ── METAS CON ANILLOS DE PROGRESO ────────────────────────────────────────────
// Objetivos de ahorro con un anillo que muestra "vas en $X de $Y". Cada meta la
// cargás vos (nombre, objetivo, y cuánto llevás juntado) — no sale de otro lado,
// así que es un dato propio guardado en este dispositivo (localStorage). Aditivo:
// renderInicio() dibuja la tarjeta llamando a renderMetasCard(); el alta/edición
// usa el modal #meta-modal. En pesos o dólares, a elección por meta.

const LS_METAS = 'finlab_metas_v1';
let metaEditandoId = null;

function metasLoad() {
  try { const a = JSON.parse(localStorage.getItem(LS_METAS) || '[]'); return Array.isArray(a) ? a : []; }
  catch (e) { return []; }
}
function metasSave(arr) { try { localStorage.setItem(LS_METAS, JSON.stringify(arr)); } catch (e) {} }

// ── Aporte automático ────────────────────────────────────────────────────────
// Como la app no tiene servidor, "lo automático" se aplica AL ABRIRLA: por cada
// meta con aporte configurado, mira cuántos períodos (de su cadencia) pasaron
// desde el último aplicado y los suma de una (si estuviste meses sin abrir, los
// pone al día). Es idempotente: si ya se aplicó este período, no hace nada.
function metaMesActual() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function metaMesesEntre(a, b) {
  const [ay, am] = a.split('-').map(Number), [by, bm] = b.split('-').map(Number);
  return (by - ay) * 12 + (bm - am);
}
function metaMasMeses(ym, n) {
  let [y, m] = ym.split('-').map(Number); m += n;
  y += Math.floor((m - 1) / 12); m = ((m - 1) % 12 + 12) % 12 + 1;
  return y + '-' + String(m).padStart(2, '0');
}
function metaCadenciaTxt(cada) {
  const n = Math.max(1, Number(cada) || 1);
  return n === 1 ? 'por mes' : n === 12 ? 'por año' : 'cada ' + n + ' meses';
}
function aplicarAportesMetas() {
  const metas = metasLoad();
  const ahora = metaMesActual();
  let cambio = false;
  metas.forEach(m => {
    const monto = Number(m.autoMonto) || 0;
    const cada = Math.max(1, Number(m.autoCada) || 1);
    if (monto <= 0) return;
    if (!m.autoUltimo) { m.autoUltimo = ahora; cambio = true; return; } // recién configurado: arranca el período que viene
    const veces = Math.floor(metaMesesEntre(m.autoUltimo, ahora) / cada);
    if (veces <= 0) return;
    m.actual = (Number(m.actual) || 0) + monto * veces;
    m.autoUltimo = metaMasMeses(m.autoUltimo, veces * cada);
    cambio = true;
  });
  if (cambio) metasSave(metas);
  return cambio;
}

function metaFmt(v, moneda) {
  const n = Math.round(v || 0).toLocaleString('es-AR');
  return (moneda === 'USD' ? 'US$' : '$') + n;
}

// Anillo (dona) de progreso con el % en el centro; a 100% muestra un tilde.
function metaRing(pct) {
  const p = Math.max(0, Math.min(100, pct));
  const deg = (p / 100) * 360;
  const centro = p >= 100 ? '✓' : Math.round(p) + '%';
  return '<div class="meta-ring" style="background:conic-gradient(var(--accent) 0 ' + deg +
    'deg, var(--surface3) ' + deg + 'deg 360deg);"><div class="meta-ring-in">' + centro + '</div></div>';
}

// Devuelve el HTML de la tarjeta de metas (o una invitación si no hay ninguna).
function renderMetasCard() {
  aplicarAportesMetas();            // pone al día los aportes automáticos al abrir
  const metas = metasLoad();
  const cab = '<div class="chart-header"><span class="chart-title">🎯 Tus metas</span>' +
    '<button class="meta-add-btn" onclick="metaNueva()">＋ Nueva</button></div>';

  if (!metas.length) {
    return '<div class="panel-card">' + cab +
      '<button class="meta-empty" onclick="metaNueva()">Sumá tu primera meta<br>' +
      '<span>un fondo de emergencia, un viaje, lo que quieras juntar</span></button></div>';
  }

  const filas = metas.map(m => {
    const pct = m.objetivo > 0 ? (m.actual / m.objetivo * 100) : 0;
    const listo = pct >= 100;
    const cola = listo
      ? '<span style="color:var(--green);font-weight:600;">✓ ' + metaFmt(m.actual, m.moneda) + ' · ¡cumplida!</span>'
      : metaFmt(m.actual, m.moneda) + ' de ' + metaFmt(m.objetivo, m.moneda) + ' · ' + Math.round(pct) + '%';
    const autoTxt = (Number(m.autoMonto) > 0)
      ? '<div class="meta-auto">🔁 ' + metaFmt(m.autoMonto, m.moneda) + ' ' + metaCadenciaTxt(m.autoCada) + ' (automático)</div>'
      : '';
    return '<button class="meta-row" onclick="metaEditar(\'' + m.id + '\')">' +
      metaRing(pct) +
      '<div class="meta-body"><div class="meta-name">' + (m.nombre || 'Meta') + '</div>' +
      '<div class="meta-nums">' + cola + '</div>' + autoTxt + '</div>' +
      '<span class="meta-chev">›</span></button>';
  }).join('');

  return '<div class="panel-card">' + cab + '<div class="metas">' + filas + '</div></div>';
}

// ── Alta / edición (modal) ───────────────────────────────────────────────────
function metaAbrir() { const o = document.getElementById('meta-modal'); if (o) o.style.display = 'flex'; }
function metaCerrar() { const o = document.getElementById('meta-modal'); if (o) o.style.display = 'none'; metaEditandoId = null; }

function metaNueva() {
  metaEditandoId = null;
  const t = document.getElementById('meta-modal-title'); if (t) t.textContent = 'Nueva meta';
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
  set('meta-nombre', ''); set('meta-objetivo', ''); set('meta-actual', ''); set('meta-moneda', 'ARS');
  set('meta-auto-monto', ''); set('meta-auto-cada', '1');
  const del = document.getElementById('meta-del-btn'); if (del) del.style.display = 'none';
  metaAbrir();
}

function metaEditar(id) {
  const m = metasLoad().find(x => String(x.id) === String(id));
  if (!m) return;
  metaEditandoId = m.id;
  const t = document.getElementById('meta-modal-title'); if (t) t.textContent = 'Editar meta';
  const set = (id2, v) => { const e = document.getElementById(id2); if (e) e.value = v; };
  set('meta-nombre', m.nombre || ''); set('meta-objetivo', m.objetivo || ''); set('meta-actual', m.actual || ''); set('meta-moneda', m.moneda || 'ARS');
  set('meta-auto-monto', m.autoMonto || ''); set('meta-auto-cada', String(m.autoCada || 1));
  const del = document.getElementById('meta-del-btn'); if (del) del.style.display = '';
  metaAbrir();
}

function metaGuardar() {
  const nombre = (document.getElementById('meta-nombre') || {}).value || '';
  const objetivo = Math.max(0, parseFloat((document.getElementById('meta-objetivo') || {}).value) || 0);
  const actual = Math.max(0, parseFloat((document.getElementById('meta-actual') || {}).value) || 0);
  const moneda = (document.getElementById('meta-moneda') || {}).value === 'USD' ? 'USD' : 'ARS';
  const autoMonto = Math.max(0, parseFloat((document.getElementById('meta-auto-monto') || {}).value) || 0);
  const autoCada = Math.max(1, parseInt((document.getElementById('meta-auto-cada') || {}).value, 10) || 1);
  if (!nombre.trim() || !(objetivo > 0)) {
    alert('Ponele un nombre y un objetivo mayor a cero.');
    return;
  }
  const mesAhora = metaMesActual();
  const metas = metasLoad();
  if (metaEditandoId != null) {
    const m = metas.find(x => String(x.id) === String(metaEditandoId));
    if (m) {
      m.nombre = nombre.trim(); m.objetivo = objetivo; m.actual = actual; m.moneda = moneda;
      m.autoMonto = autoMonto; m.autoCada = autoCada;
      // Si recién ahora le activás el aporte, arranca a sumar el período que viene.
      if (autoMonto > 0 && !m.autoUltimo) m.autoUltimo = mesAhora;
      if (autoMonto <= 0) m.autoUltimo = null;
    }
  } else {
    metas.push({
      id: Date.now() + '' + Math.floor(Math.random() * 1000),
      nombre: nombre.trim(), objetivo, actual, moneda,
      autoMonto, autoCada, autoUltimo: autoMonto > 0 ? mesAhora : null,
    });
  }
  metasSave(metas);
  metaCerrar();
  if (typeof renderInicio === 'function') renderInicio();
}

function metaEliminar() {
  if (metaEditandoId == null) return;
  if (!confirm('¿Borrar esta meta?')) return;
  metasSave(metasLoad().filter(x => String(x.id) !== String(metaEditandoId)));
  metaCerrar();
  if (typeof renderInicio === 'function') renderInicio();
}
