// ══════════ APP DE PRESUPUESTO ══════════
// Traída desde el repo Presupuesto-personal. Los nombres que chocaban con la
// mitad de retiro/cartera llevan apellido "Presu"; los ayudantes que eran
// idénticos ($ , fmtPct, hapticTick, toggleTheme) se borraron y se usa la
// versión que ya estaba en nucleo.js.


// ── FORMATO ───────────────────────────────────────────────────────────────
function fmtARS(n) {
  if (n == null) return '—';
  const abs = Math.abs(Math.round(n));
  let s;
  if (abs >= 1e6) s = '$' + (abs/1e6).toFixed(1) + 'M';
  else if (abs >= 1e3) s = '$' + (abs/1e3).toFixed(0) + 'K';
  else s = '$' + abs.toLocaleString('es-AR');
  return n < 0 ? '-' + s : s;
}

function fmtPctInt(n) { return Math.round(n * 100) + '%'; }

// ── TABS ─────────────────────────────────────────────────────────────────
let currentTab = 'resumen';
function toggleSidebarPresu() {
  // Usa su PROPIO oscurecido (sheet-backdrop-presu), que vive en la mitad de
  // presupuesto y al tocarlo llama a esta misma función para cerrar. Antes usaba
  // el de retiro (sheet-backdrop), cuyo click abría el panel de retiro y dejaba
  // la pantalla trabada.
  const a = $('aside-presu'), backdrop = $('sheet-backdrop-presu'), open = a.classList.toggle('open');
  if (backdrop) backdrop.classList.toggle('open', open);
}
// Al mover un parámetro se repinta la pantalla actual (antes esto lo hacía
// recalc(), que alimentaba pantallas que ya no existen).
function repintar() {
  if (currentTab === 'resumen') renderResumen();
  else if (currentTab === 'gastos') renderGastos();
}

function setTab(t) {
  currentTab = t;
  document.querySelectorAll('.tab[data-tab], .bn-item[data-tab]').forEach(b => b.classList.remove('active'));
  document.querySelectorAll(`[data-tab="${t}"]`).forEach(b => b.classList.add('active'));
  $('view-gastos').style.display  = t === 'gastos'  ? '' : 'none';
  $('view-resumen').style.display = t === 'resumen' ? '' : 'none';
  if (t === 'gastos') renderGastos();
  if (t === 'resumen') renderResumen();
  const a = $('aside-presu');
  if (a.classList.contains('open')) toggleSidebarPresu();
}

// ── PERSISTENCIA ─────────────────────────────────────────────────────────
const LS_PARAMS = 'presupuesto_params_v1';
function saveParamsPresu() {
  try {
    const p = { sliders: {}, toggles: {} };
    Object.keys(sliders).forEach(id => { const el = $(id); if (el) p.sliders[id] = el.value; });
    toggles.forEach(id => { const el = $('tog-' + id); if (el) p.toggles[id] = el.checked; });
    localStorage.setItem(LS_PARAMS, JSON.stringify(p));
  } catch (e) {}
}
function loadParamsPresu() {
  try {
    const r = localStorage.getItem(LS_PARAMS);
    if (!r) return;
    const p = JSON.parse(r);
    Object.entries(p.sliders || {}).forEach(([id, v]) => { const el = $(id); if (el) el.value = v; });
    Object.entries(p.toggles || {}).forEach(([id, v]) => {
      const el = $('tog-' + id);
      if (el) { el.checked = v; const row = $('row-' + id); if (row) row.style.display = v ? '' : 'none'; }
    });
  } catch (e) {}
}

// ── SLIDERS ───────────────────────────────────────────────────────────────
const sliders = {
  salario:          v => fmtARS(v),
  estudios:         v => fmtARS(v),
  alquiler:         v => fmtARS(v),
  servicios:        v => fmtARS(v),
  supermercado:     v => fmtARS(v),
  juntadas:         v => fmtARS(v),
  gimnasio:         v => fmtARS(v),
  deportes:         v => fmtARS(v),
  nafta:            v => fmtARS(v),
  seguroAuto:       v => fmtARS(v),
  patente:          v => fmtARS(v),
  mantenimientoAuto:v => fmtARS(v),
  auto:             v => fmtARS(v),
  suscripciones:    v => fmtARS(v),
  cnc:              v => fmtARS(v),
  fEmergencia:      v => fmtARS(v),
  fVacaciones:      v => fmtARS(v),
  fInversiones:     v => fmtARS(v),
  prepaga:          v => fmtARS(v),
  farmacia:         v => fmtARS(v),
  viajes:           v => fmtARS(v),
  colegio:          v => fmtARS(v),
  ninera:           v => fmtARS(v),
  actividades:      v => fmtARS(v),
  casaFam:          v => fmtARS(v),
};

Object.keys(sliders).forEach(id => {
  const el = $(id);
  if (!el) return;
  const vEl = $('v-' + id);
  const update = () => {
    if (vEl) vEl.textContent = sliders[id](parseFloat(el.value));
    saveParamsPresu();
    repintar();
  };
  el.addEventListener('input', update);
  if (vEl) vEl.textContent = sliders[id](parseFloat(el.value));
});

// ── TOGGLES ───────────────────────────────────────────────────────────────
const toggles = ['deportes','seguroAuto','patente','mantenimientoAuto','auto','prepaga','farmacia','viajes','colegio','ninera','actividades','casaFam'];
toggles.forEach(id => {
  const tog = $('tog-' + id);
  tog.addEventListener('change', () => {
    $('row-' + id).style.display = tog.checked ? '' : 'none';
    saveParamsPresu();
    repintar();
  });
});

// ── GRÁFICOS ─────────────────────────────────────────────────────────────

const ctxRes = $('chart-rs') ? $('chart-rs').getContext('2d') : null;
const chartRes = ctxRes ? new Chart(ctxRes, {
  type: 'line',
  data: { labels: [], datasets: [] },
  options: {
    responsive: true, maintainAspectRatio: false,
    animation: { duration: 180 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff', borderColor: '#e7e4e0', borderWidth: 1,
        titleColor: '#9d9a95', bodyColor: '#1a1a18', padding: 10,
        callbacks: { label: c => ` ${c.dataset.label}: ${fmtARS(c.parsed.y)}` }
      }
    },
    scales: {
      x: { ticks: { color: '#9d9a95', font: { size: 10 }, maxTicksLimit: 12 }, grid: { color: 'rgba(128,128,128,.12)' }, border: { color: '#e7e4e0' } },
      y: {
        beginAtZero: true,
        ticks: { color: '#9d9a95', font: { size: 10 }, callback: v => fmtARS(v) },
        grid: { color: 'rgba(128,128,128,.12)' }, border: { color: '#e7e4e0' }
      }
    }
  }
}) : null;

// Dona de proporciones por categoría, con el mismo look que las del Plan de Retiro.
const ctxCats = $('chart-cats') ? $('chart-cats').getContext('2d') : null;
const chartCats = ctxCats ? new Chart(ctxCats, {
  type: 'doughnut',
  data: { labels: [], datasets: [{ data: [], backgroundColor: [], borderWidth: 0, hoverOffset: 5 }] },
  options: {
    responsive: true, maintainAspectRatio: false, cutout: '72%',
    animation: { duration: 200 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#ffffff', borderColor: '#e7e4e0', borderWidth: 1,
        titleColor: '#9d9a95', bodyColor: '#1a1a18', padding: 10,
        callbacks: {
          label: c => {
            const tot = c.dataset.data.reduce((s, n) => s + n, 0) || 1;
            return ` ${c.label}: ${fmtARS(c.parsed)} (${Math.round((c.parsed / tot) * 100)}%)`;
          }
        }
      }
    }
  }
}) : null;


// ── GASTOS DEL MES ────────────────────────────────────────────────────────
const LS_GASTOS = 'presupuesto_gastos_v1';
const GASTO_CATS = [
  { id: 'estudios',          label: 'Estudios y aprendizaje' },
  { id: 'alquiler',          label: 'Alquiler / expensas' },
  { id: 'servicios',         label: 'Servicios (luz, agua, gas, internet)' },
  { id: 'supermercado',      label: 'Supermercado / almacén' },
  { id: 'juntadas',          label: 'Juntadas / salidas / comidas afuera' },
  { id: 'gimnasio',          label: 'Gimnasio' },
  { id: 'deportes',          label: 'Deportes (fútbol, pádel, etc.)' },
  { id: 'nafta',             label: 'Nafta' },
  { id: 'seguroAuto',        label: 'Seguro del auto' },
  { id: 'patente',           label: 'Patente / impuestos auto' },
  { id: 'mantenimientoAuto', label: 'Mantenimiento / service auto' },
  { id: 'auto',              label: 'Cuota / leasing auto' },
  { id: 'suscripciones',     label: 'Suscripciones' },
  { id: 'cnc',               label: 'Varios / imprevistos' },
  { id: 'prepaga',           label: 'Prepaga / salud' },
  { id: 'farmacia',          label: 'Farmacia / medicamentos' },
  { id: 'viajes',            label: 'Viajes' },
  { id: 'colegio',           label: 'Colegio / educación hijos' },
  { id: 'ninera',            label: 'Niñera / jardín' },
  { id: 'actividades',       label: 'Actividades / deportes hijos' },
  { id: 'casaFam',           label: 'Casa más grande / barrio' },
  { id: 'otro',              label: 'Otro' },
];
// Nombres personalizados de categorías (renombradas por el usuario), por
// dispositivo. catLabel los prioriza; si no hay, usa el nombre por defecto.
function catNombresCustom() {
  try { return JSON.parse(localStorage.getItem('finlab_cat_nombres') || '{}'); } catch (e) { return {}; }
}
const catLabel = id => catNombresCustom()[id] || (GASTO_CATS.find(c => c.id === id) || {}).label || id;

function monthKey(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; }
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
}
function monthLabelShort(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }).replace('.', '');
}
// Mes que se está mirando en la pestaña de gastos. Arranca en el actual, pero
// se puede navegar: al importar un resumen los gastos suelen caer en el mes
// anterior, y sin esto quedaban cargados pero invisibles.
let mesVisible = monthKey();
function moverMes(delta) {
  const [y, m] = mesVisible.split('-').map(Number);
  mesVisible = monthKey(new Date(y, m - 1 + delta, 1));
  renderGastos();
}
function irAlMesActual() { mesVisible = monthKey(); renderGastos(); }
function verMes(key) { mesVisible = key; renderGastos(); }

function loadGastosAll() {
  try { return JSON.parse(localStorage.getItem(LS_GASTOS) || '{}'); } catch (e) { return {}; }
}
function saveGastosAll(all) {
  try { localStorage.setItem(LS_GASTOS, JSON.stringify(all)); } catch (e) {}
}
function initGastoCatSelect() {
  const sel = $('gasto-cat');
  sel.innerHTML = GASTO_CATS.map(c => `<option value="${c.id}">${catLabel(c.id)}</option>`).join('');
}
// Un pago único puede corresponder a varios meses (ej. pagás 3 meses de gimnasio
// juntos). Lo repartimos en una parte por mes, así el mes del pago no queda
// inflado y los meses siguientes ya lo tienen cubierto.
function repartirEnMeses(total, meses) {
  const base = Math.round(total / meses);
  const partes = new Array(meses).fill(base);
  partes[0] += total - base * meses;   // el resto del redondeo va al primer mes
  return partes;
}
// Para gastos irregulares (arreglos del auto, por ejemplo) uno no sabe cuántos
// meses cubre el pago, pero sí cuánto tiene presupuestado. Deducimos los meses
// preguntando cuántas mensualidades de esa categoría se come el gasto.
const TOPE_MESES_AUTO = 12;
function mesKeyOffset(fechaISO, off) { return monthKey(new Date(fechaDesplazada(fechaISO, off) + 'T00:00:00')); }
function nombreMesOffset(fechaISO, off) { return monthLabelShort(mesKeyOffset(fechaISO, off)); }
function gastadoEnMes(all, key, cat) {
  return (all[key] || []).reduce((s, g) => g.cat === cat ? s + g.monto : s, 0);
}
// Va llenando el hueco libre de cada mes en vez de dividir en partes iguales:
// si en el mes del pago ya habías gastado en ese rubro, ahí entra menos y el
// resto sigue de largo. Así el prorrateo nunca deja un mes pasado de la bolsa.
function planBolsa(cat, monto, fechaISO) {
  if (!PV_CAT_IDS.includes(cat)) return { error: 'sinCategoria' };
  const mensual = getPresupuestoCat(cat);
  if (!(mensual > 0)) return { error: 'sinPresupuesto' };

  const all = loadGastosAll();
  const yaEsteMes = gastadoEnMes(all, mesKeyOffset(fechaISO, 0), cat);
  const partes = [];
  let resto = Math.round(monto);
  for (let i = 0; i < TOPE_MESES_AUTO && resto > 0; i++) {
    const libre = Math.max(Math.round(mensual - gastadoEnMes(all, mesKeyOffset(fechaISO, i), cat)), 0);
    if (libre <= 0) continue;                       // ese mes ya está lleno, seguimos
    const parte = Math.min(resto, libre);
    partes.push({ offset: i, monto: parte });
    resto -= parte;
  }
  // No entró ni llenando un año entero de bolsa: el sobrante va al último mes.
  const desborde = resto;
  if (desborde > 0) {
    if (partes.length) partes[partes.length - 1].monto += desborde;
    else partes.push({ offset: 0, monto: desborde });
  }
  return {
    mensual, anual: mensual * 12, exactos: monto / mensual,
    yaEsteMes, libreEsteMes: Math.max(mensual - yaEsteMes, 0),
    partes, desborde,
  };
}
function detallePlan(fechaISO, partes) {
  const linea = p => `   ${nombreMesOffset(fechaISO, p.offset)} → ${fmtARS(p.monto)}`;
  if (partes.length <= 6) return partes.map(linea).join('\n');
  return [linea(partes[0]), linea(partes[1]), `   ... (${partes.length - 3} meses más)`, linea(partes[partes.length - 1])].join('\n');
}
function fechaDesplazada(fechaISO, nMeses) {
  const b = new Date(fechaISO + 'T00:00:00');
  const d = new Date(b.getFullYear(), b.getMonth() + nMeses, 1);
  const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(b.getDate(), ultimoDia));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addGasto() {
  const fecha = $('gasto-fecha').value;
  const cat = $('gasto-cat').value;
  const monto = parseFloat($('gasto-monto').value);
  const nota = $('gasto-nota').value.trim();
  const elegido = ($('gasto-meses') || {}).value || '1';
  if (!fecha) { alert('Elegí una fecha.'); return; }
  if (!monto || monto <= 0) { alert('Cargá un monto válido.'); return; }

  let partes;
  if (elegido === 'auto') {
    const c = planBolsa(cat, monto, fecha);
    if (c.error === 'sinCategoria') {
      alert(`"${catLabel(cat)}" no tiene un presupuesto propio, así que no puedo calcular los meses.\n\nElegí a mano cuántos meses cubre.`);
      return;
    }
    if (c.error === 'sinPresupuesto') {
      alert(`Para calcularlo solo necesito saber cuánto tenés presupuestado por mes en "${catLabel(cat)}", y hoy está en cero.\n\nAndá a Presupuesto, activá la categoría si hace falta y ponele un monto mensual. Si lo pensás por año, dividilo por 12.`);
      return;
    }
    const yaGastado = c.yaEsteMes > 0
      ? `\nEn ${nombreMesOffset(fecha, 0)} ya llevás ${fmtARS(c.yaEsteMes)} en este rubro, así que ahí ${c.libreEsteMes > 0 ? `entran ${fmtARS(c.libreEsteMes)} más` : 'ya no entra nada'}.`
      : '';
    const desborde = c.desborde > 0
      ? `\n\n⚠️ OJO: no entra ni llenando un año entero de esa bolsa. Te pasás del presupuesto anual por ${fmtARS(c.desborde)}, que quedan cargados en el último mes.`
      : '';
    const ok = confirm(
      `${catLabel(cat)}\n\n` +
      `Tenés presupuestado ${fmtARS(c.mensual)} por mes, o sea ${fmtARS(c.anual)} al año.${yaGastado}${desborde}\n\n` +
      (c.partes.length > 1
        ? `Reparto los ${fmtARS(monto)} así:\n${detallePlan(fecha, c.partes)}`
        : `Lo dejo entero en ${nombreMesOffset(fecha, c.partes[0].offset)}.`) +
      '\n\n¿Lo hago así?'
    );
    if (!ok) return;
    partes = c.partes;
  } else {
    const meses = Math.max(1, parseInt(elegido, 10) || 1);
    partes = repartirEnMeses(monto, meses).map((m, i) => ({ offset: i, monto: m }));
  }

  const all = loadGastosAll();
  const grupo = partes.length > 1 ? 'g' + Date.now() : null;
  partes.forEach((p, i) => {
    const f = fechaDesplazada(fecha, p.offset);
    const key = monthKey(new Date(f + 'T00:00:00'));
    if (!all[key]) all[key] = [];
    const item = { id: Date.now() + i, fecha: f, cat, monto: p.monto, nota };
    if (grupo) Object.assign(item, { grupo, cuota: i + 1, cuotas: partes.length, montoTotal: monto, fechaPago: fecha });
    all[key].push(item);
    all[key].sort((a, b) => b.fecha.localeCompare(a.fecha));
  });
  saveGastosAll(all);

  $('gasto-monto').value = '';
  $('gasto-nota').value = '';
  if ($('gasto-meses')) $('gasto-meses').value = '1';
  renderGastos();
  chequearAlertaCat(cat);
}
function removeGasto(id) {
  const all = loadGastosAll();
  const key = mesVisible;
  if (!all[key]) return;
  const target = all[key].find(g => g.id === id);
  if (!target) return;
  if (target.grupo) {
    // Media parte de un pago repartido no tiene sentido: se borran todas juntas.
    const msg = `Este gasto es parte de un pago de ${fmtARS(target.montoTotal)} repartido en ${target.cuotas} meses.\n\nSe van a borrar las ${target.cuotas} partes, incluidas las de los meses que vienen. ¿Seguir?`;
    if (!confirm(msg)) return;
    Object.keys(all).forEach(k => { all[k] = (all[k] || []).filter(g => g.grupo !== target.grupo); });
  } else {
    all[key] = all[key].filter(g => g.id !== id);
  }
  saveGastosAll(all);
  renderGastos();
}
// Partes de pagos repartidos que caen en meses posteriores al actual.
function comprometidoFuturo() {
  const all = loadGastosAll();
  const actual = mesVisible;
  let total = 0;
  const meses = [];
  Object.keys(all).sort().forEach(k => {
    if (k <= actual) return;
    const suma = (all[k] || []).reduce((s, g) => g.grupo ? s + g.monto : s, 0);
    if (suma > 0) { total += suma; meses.push(k); }
  });
  return { total, meses };
}
function renderFuturoNote() {
  const el = $('futuro-note');
  if (!el) return;
  const { total, meses } = comprometidoFuturo();
  if (!total) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  el.innerHTML = `<span>📅</span><span>Ya pagaste <b>${fmtARS(total)}</b> que corresponde a ${meses.map(monthLabelShort).join(', ')}. Va a aparecer solo cuando llegues a esos meses, así que no hace falta que lo vuelvas a cargar.</span>`;
}
const PV_CAT_IDS = ['estudios','alquiler','servicios','supermercado','juntadas','gimnasio','deportes','nafta','seguroAuto','patente','mantenimientoAuto','auto','suscripciones','cnc','prepaga','farmacia','viajes','colegio','ninera','actividades','casaFam'];
const PV_EXTRA_TOGGLE = ['deportes','seguroAuto','patente','mantenimientoAuto','auto','prepaga','farmacia','viajes','colegio','ninera','actividades','casaFam'];
function getPresupuestoCat(id) {
  if (PV_EXTRA_TOGGLE.includes(id)) return tog(id) ? g(id) : 0;
  return g(id);
}
function renderGastos() {
  const key = mesVisible;
  const all = loadGastosAll();
  const list = all[key] || [];
  const esMesActual = key === monthKey();
  const lbl = $('gastos-mes-label');
  lbl.textContent = monthLabel(key);
  lbl.className = 'gastos-mes' + (esMesActual ? '' : ' mes-viejo');
  if ($('mes-hoy')) $('mes-hoy').style.display = esMesActual ? 'none' : '';

  const total = list.reduce((s, g) => s + g.monto, 0);
  $('gk-total').textContent = fmtARS(total);
  $('gk-count').textContent = list.length;

  const byCat = {};
  list.forEach(g => { byCat[g.cat] = (byCat[g.cat] || 0) + g.monto; });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
  $('gk-top').textContent = top ? `${catLabel(top[0])} (${fmtARS(top[1])})` : '—';

  // ── PRESUPUESTADO VS. REAL ──
  let totalPresu = 0, totalRealPresu = 0;
  const pvRows = [];
  PV_CAT_IDS.forEach(id => {
    const presu = getPresupuestoCat(id);
    const real = byCat[id] || 0;
    if (presu <= 0 && real <= 0) return;
    totalPresu += presu;
    totalRealPresu += real;
    const pct = presu > 0 ? real / presu : (real > 0 ? 1.3 : 0);
    const color = presu <= 0 ? 'var(--red)' : pct > 1 ? 'var(--red)' : pct >= 0.8 ? 'var(--orange)' : 'var(--green)';
    pvRows.push({ id, presu, real, pct, color });
  });
  const otroReal = byCat['otro'] || 0;
  if (otroReal > 0) pvRows.push({ id: 'otro', presu: 0, real: otroReal, pct: 1.3, color: 'var(--red)' });

  const disponible = totalPresu - totalRealPresu - otroReal;
  const dEl = $('gk-disponible');
  dEl.textContent = fmtARS(disponible);
  dEl.className = 'gk-val ' + (disponible >= 0 ? 'green' : 'red');

  updateRetiroPreview();

  const pvList = $('pv-list');
  if (!pvRows.length) {
    pvList.innerHTML = `<div class="pv-empty">Cargá algún gasto o definí presupuesto en las categorías para ver la comparación acá.</div>`;
  } else {
    pvList.innerHTML = pvRows.map(r => {
      const noPresu = r.presu <= 0;
      const label = noPresu ? 'sin presupuesto asignado' : fmtPctInt(r.pct);
      return `
        <div class="pv-row">
          <div class="pv-row-top">
            <span class="pv-name">${catLabel(r.id)}</span>
            <span class="pv-nums"><b>${fmtARS(r.real)}</b> / ${noPresu ? '—' : fmtARS(r.presu)}<span class="pv-pct" style="color:${r.color}">${label}</span></span>
          </div>
          <div class="pv-bar"><div class="pv-fill" style="width:${Math.min(r.pct, 1) * 100}%;background:${r.color}"></div></div>
        </div>`;
    }).join('');
  }

  renderAlertasBanner();
  renderFuturoNote();
  renderFijos();
  renderSugerenciasFijos();

  const tbody = $('tbody-gastos');
  if (typeof renderFiltroGastos === 'function') renderFiltroGastos(list);
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="gastos-empty">No hay gastos cargados en ${monthLabel(key)}.${esMesActual ? ' Usá el formulario de arriba para empezar.' : ' Usá las flechitas de arriba para mirar otro mes.'}</td></tr>`;
    return;
  }
  // El filtro sólo afecta a esta tabla; los KPIs y el presupuestado-vs-real de
  // arriba siguen mostrando el mes completo.
  const _filtro = (typeof gastoFiltroActivo === 'function') ? gastoFiltroActivo() : 'todas';
  const _lista = (_filtro && _filtro !== 'todas') ? list.filter(g => g.cat === _filtro) : list;
  if (!_lista.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="gastos-empty">No hay gastos de "${catLabel(_filtro)}" en ${monthLabel(key)}.</td></tr>`;
    return;
  }
  tbody.innerHTML = _lista.map(g => `
    <tr>
      <td data-label="Fecha" style="color:var(--muted)">${new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}</td>
      <td data-label="Categoría"><span class="cat-chip">${catLabel(g.cat)}</span></td>
      <td data-label="Monto" style="font-weight:600">${fmtARS(g.monto)}${g.grupo ? `<span class="cuota-chip" title="Pagaste ${fmtARS(g.montoTotal)} el ${new Date(g.fechaPago + 'T00:00:00').toLocaleDateString('es-AR')} por ${g.cuotas} meses">${g.cuota} de ${g.cuotas}</span>` : ''}</td>
      <td data-label="Nota" style="color:var(--muted)">${esc(g.nota) || '—'}</td>
      <td style="white-space:nowrap"><button class="edit-gasto-btn" onclick="editarGastoCat(${g.id})" title="Cambiar categoría">✎</button><button class="del-gasto-btn" onclick="removeGasto(${g.id})" title="Eliminar">✕</button></td>
    </tr>`).join('');
}

// ── ALERTAS DE CATEGORÍA ──────────────────────────────────────────────────
// Avisan cuando el gasto real de un rubro llega al umbral configurado (aviso)
// o se pasa del presupuesto (exceso). El pop-up salta al cargar un gasto; el
// banner de la pestaña "Gastos del mes" muestra la foto permanente.
const LS_ALERTAS_CFG = 'presupuesto_alertas_cfg_v1';
const LS_ALERTAS_EST = 'presupuesto_alertas_estado_v1';
const NIVEL_AVISO = 1, NIVEL_EXCESO = 2;

function loadAlertasCfg() {
  try {
    const r = JSON.parse(localStorage.getItem(LS_ALERTAS_CFG) || '{}');
    const u = parseFloat(r.umbral);
    return { activas: r.activas !== false, umbral: (u > 0 && u <= 1) ? u : 0.8 };
  } catch (e) { return { activas: true, umbral: 0.8 }; }
}
function saveAlertasCfg(cfg) {
  try { localStorage.setItem(LS_ALERTAS_CFG, JSON.stringify(cfg)); } catch (e) {}
}
function loadAlertasEstado() {
  try { return JSON.parse(localStorage.getItem(LS_ALERTAS_EST) || '{}'); } catch (e) { return {}; }
}
function saveAlertasEstado(all) {
  try { localStorage.setItem(LS_ALERTAS_EST, JSON.stringify(all)); } catch (e) {}
}
// Estado por rubro y por mes: hasta qué nivel ya se avisó, y si el usuario lo silenció.
function getAlertaEstado(cat) {
  const all = loadAlertasEstado();
  const m = all[mesVisible] || {};
  return Object.assign({ nivel: 0, mute: false }, m[cat]);
}
function setAlertaEstado(cat, patch) {
  const key = mesVisible;
  const all = loadAlertasEstado();
  if (!all[key]) all[key] = {};
  all[key][cat] = Object.assign({ nivel: 0, mute: false }, all[key][cat], patch);
  saveAlertasEstado(all);
}

function nivelAlerta(pct, umbral) {
  if (pct >= 1) return NIVEL_EXCESO;
  if (pct >= umbral) return NIVEL_AVISO;
  return 0;
}
function gastosPorCatMes() {
  const list = loadGastosAll()[mesVisible] || [];
  const by = {};
  list.forEach(g => { by[g.cat] = (by[g.cat] || 0) + g.monto; });
  return by;
}
// Rubros con presupuesto asignado que hoy están en aviso o en exceso.
function calcularAlertas() {
  const cfg = loadAlertasCfg();
  const byCat = gastosPorCatMes();
  const out = [];
  PV_CAT_IDS.forEach(id => {
    const presu = getPresupuestoCat(id);
    if (!(presu > 0)) return;
    const real = byCat[id] || 0;
    const pct = real / presu;
    out.push({ id, presu, real, pct, nivel: nivelAlerta(pct, cfg.umbral) });
  });
  return out;
}

// Salta al cargar un gasto, solo si ese rubro cruzó un nivel nuevo.
function chequearAlertaCat(cat) {
  const cfg = loadAlertasCfg();
  if (!cfg.activas) return;
  if (!PV_CAT_IDS.includes(cat)) return;          // "Otro" no tiene presupuesto propio
  const presu = getPresupuestoCat(cat);
  if (!(presu > 0)) return;                       // sin presupuesto no hay umbral que cruzar
  const real = gastosPorCatMes()[cat] || 0;
  const pct = real / presu;
  const nivel = nivelAlerta(pct, cfg.umbral);
  const est = getAlertaEstado(cat);
  if (nivel === 0 || est.mute || nivel <= est.nivel) return;
  setAlertaEstado(cat, { nivel });
  mostrarAlerta({ id: cat, presu, real, pct, nivel });
}

let alertaCatActual = null;
let alertaCola = [];
function mostrarAlerta(r) {
  // Si ya hay una alerta en pantalla (ej. cargaste varios gastos fijos de una
  // sola vez), la nueva espera su turno en vez de pisar a la anterior.
  if ($('alerta-modal').classList.contains('open')) { alertaCola.push(r); return; }
  alertaCatActual = r.id;
  const exceso = r.nivel >= NIVEL_EXCESO;
  const color = exceso ? 'var(--red)' : 'var(--gold)';
  $('alerta-ic').textContent = exceso ? '🚨' : '⚠️';
  const justo = exceso && r.real <= r.presu;   // quedaste clavado en el 100%
  $('alerta-titulo').textContent = !exceso
    ? `Ya usaste el ${fmtPctInt(r.pct)} de este rubro`
    : justo ? 'Usaste todo el presupuesto' : 'Te pasaste del presupuesto';
  $('alerta-cat').textContent = catLabel(r.id);
  $('alerta-fill').style.width = Math.min(r.pct, 1) * 100 + '%';
  $('alerta-fill').style.background = color;
  $('alerta-nums').innerHTML = `<span style="color:${exceso ? 'var(--red-text)' : 'var(--gold-text)'}">${fmtARS(r.real)}</span> <span style="color:var(--muted);font-weight:500">de</span> ${fmtARS(r.presu)}`;
  $('alerta-msg').textContent = !exceso
    ? `Te quedan ${fmtARS(r.presu - r.real)} para el resto del mes en este rubro.`
    : justo
      ? 'Llegaste justo al límite. Todo lo que gastes de acá en adelante en este rubro ya te pasa del presupuesto.'
      : `Te pasaste por ${fmtARS(r.real - r.presu)} en lo que va del mes. Si podés, frená los gastos de este rubro hasta que arranque el mes que viene.`;
  $('alerta-backdrop').classList.add('open');
  $('alerta-modal').classList.add('open');
}
function cerrarAlerta() {
  $('alerta-backdrop').classList.remove('open');
  $('alerta-modal').classList.remove('open');
  alertaCatActual = null;
  if (alertaCola.length) {
    const siguiente = alertaCola.shift();
    setTimeout(() => mostrarAlerta(siguiente), 180);
  }
}
function silenciarAlertaActual() {
  if (alertaCatActual) setAlertaEstado(alertaCatActual, { mute: true, nivel: NIVEL_EXCESO });
  cerrarAlerta();
  renderAlertasBanner();
}
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if ($('alerta-modal').classList.contains('open')) cerrarAlerta();
  else if ($('imp-modal') && $('imp-modal').classList.contains('open')) cerrarImport();
});

function renderAlertasBanner() {
  const el = $('alertas-banner');
  if (!el) return;
  const cfg = loadAlertasCfg();
  const rows = calcularAlertas();

  // Si un rubro bajó de nivel (borraste un gasto o subiste el presupuesto),
  // destrabamos el aviso para que pueda volver a saltar si lo cruzás de nuevo.
  const key = mesVisible;
  const all = loadAlertasEstado();
  let dirty = false;
  rows.forEach(r => {
    const est = all[key] && all[key][r.id];
    if (!est) return;
    if (r.nivel === 0 && (est.nivel > 0 || est.mute)) { all[key][r.id] = { nivel: 0, mute: false }; dirty = true; }
    else if (est.nivel > r.nivel) { est.nivel = r.nivel; dirty = true; }
  });
  if (dirty) saveAlertasEstado(all);

  const visibles = cfg.activas
    ? rows.filter(r => r.nivel > 0 && !getAlertaEstado(r.id).mute).sort((a, b) => b.pct - a.pct)
    : [];
  if (!visibles.length) { el.style.display = 'none'; el.innerHTML = ''; return; }

  el.style.display = '';
  el.innerHTML = visibles.map(r => {
    const exceso = r.nivel >= NIVEL_EXCESO;
    const detalle = !exceso
      ? `te quedan ${fmtARS(r.presu - r.real)}`
      : r.real <= r.presu ? 'usaste todo el presupuesto' : `te pasaste por ${fmtARS(r.real - r.presu)}`;
    const txt = `<b>${catLabel(r.id)}</b> — ${detalle} (${fmtARS(r.real)} de ${fmtARS(r.presu)})`;
    return `
      <div class="ab-row ${exceso ? 'nivel-exceso' : 'nivel-aviso'}">
        <span class="ab-ic">${exceso ? '🚨' : '⚠️'}</span>
        <span class="ab-txt">${txt}</span>
        <span class="ab-pct" style="color:${exceso ? 'var(--red-text)' : 'var(--gold-text)'}">${fmtPctInt(r.pct)}</span>
      </div>`;
  }).join('');
}

function initAlertasUI() {
  const cfg = loadAlertasCfg();
  const tg = $('tog-alertas'), sl = $('umbralAlerta'), vl = $('v-umbralAlerta'), row = $('row-umbralAlerta');
  if (!tg || !sl) return;
  tg.checked = cfg.activas;
  sl.value = cfg.umbral;
  if (vl) vl.textContent = fmtPctInt(cfg.umbral);
  if (row) row.style.display = cfg.activas ? '' : 'none';
  tg.addEventListener('change', () => {
    const c = loadAlertasCfg(); c.activas = tg.checked; saveAlertasCfg(c);
    if (row) row.style.display = tg.checked ? '' : 'none';
    renderAlertasBanner();
  });
  sl.addEventListener('input', () => {
    const c = loadAlertasCfg(); c.umbral = parseFloat(sl.value); saveAlertasCfg(c);
    if (vl) vl.textContent = fmtPctInt(c.umbral);
    renderAlertasBanner();
  });
}
initAlertasUI();

// ── GASTOS FIJOS / RECURRENTES ────────────────────────────────────────────
// Si un gasto se repite mes a mes, la app lo sugiere como "fijo". Nunca lo
// carga sola: cada mes te lo ofrece con el monto del mes anterior editable
// (con la inflación de acá, el importe cambia seguido).
const LS_RECURRENTES = 'presupuesto_recurrentes_v1';
const MESES_MIRADOS = 3;        // ventana hacia atrás para buscar repeticiones
const MESES_PARA_SUGERIR = 2;   // en cuántos de esos meses tiene que aparecer

function loadRecurrentes() {
  try {
    const r = JSON.parse(localStorage.getItem(LS_RECURRENTES) || '{}');
    return { fijos: r.fijos || {}, descartados: r.descartados || [] };
  } catch (e) { return { fijos: {}, descartados: [] }; }
}
function saveRecurrentes(r) {
  try { localStorage.setItem(LS_RECURRENTES, JSON.stringify(r)); } catch (e) {}
}

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// "Cuota   Mensual" y "cuota mensual" son el mismo gasto.
function normNota(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
function claveGasto(cat, nota) { return cat + '|' + normNota(nota); }
function etiquetaFijo(cat, nota) { return nota ? `${catLabel(cat)} · ${nota}` : catLabel(cat); }
function mesesRecientes(n) {
  const hoy = new Date(), out = [];
  for (let i = 0; i < n; i++) out.push(monthKey(new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)));
  return out;
}

function detectarCandidatosFijos() {
  const rec = loadRecurrentes();
  const all = loadGastosAll();
  const porClave = {};
  mesesRecientes(MESES_MIRADOS).forEach(m => {
    (all[m] || []).forEach(x => {
      if (x.grupo) return;   // los pagos repartidos ya se cargan solos en cada mes
      const k = claveGasto(x.cat, x.nota);
      if (!porClave[k]) porClave[k] = { clave: k, cat: x.cat, nota: x.nota, porMes: {} };
      (porClave[k].porMes[m] = porClave[k].porMes[m] || []).push(x);
    });
  });
  return Object.values(porClave)
    .filter(c => !rec.fijos[c.clave] && !rec.descartados.includes(c.clave))
    .filter(c => {
      const ms = Object.keys(c.porMes);
      // Tiene que repetirse en varios meses y una sola vez por mes, así no
      // sugerimos "supermercado" que cargás cinco veces al mes.
      return ms.length >= MESES_PARA_SUGERIR && ms.every(m => c.porMes[m].length === 1);
    })
    .map(c => {
      const ms = Object.keys(c.porMes).sort();
      const ult = c.porMes[ms[ms.length - 1]][0];
      return { clave: c.clave, cat: c.cat, nota: c.nota, monto: ult.monto, dia: parseInt(ult.fecha.slice(8, 10), 10) || 1, meses: ms.length };
    })
    .sort((a, b) => b.meses - a.meses || b.monto - a.monto);
}

function estadoFijos() {
  const rec = loadRecurrentes();
  const yaEsteMes = new Set((loadGastosAll()[mesVisible] || []).map(x => claveGasto(x.cat, x.nota)));
  return Object.entries(rec.fijos)
    .map(([clave, f]) => ({ clave, cat: f.cat, nota: f.nota, monto: f.monto, dia: f.dia, cargado: yaEsteMes.has(clave) }))
    .sort((a, b) => (a.cargado - b.cargado) || etiquetaFijo(a.cat, a.nota).localeCompare(etiquetaFijo(b.cat, b.nota)));
}

let _seqGasto = 0;
function agregarFijoAlMes(f, monto) {
  const key = mesVisible;
  const [y, m] = key.split('-').map(Number);
  const ultimoDia = new Date(y, m, 0).getDate();
  const dia = Math.min(Math.max(parseInt(f.dia, 10) || 1, 1), ultimoDia);
  const all = loadGastosAll();
  if (!all[key]) all[key] = [];
  all[key].push({ id: Date.now() + (_seqGasto++), fecha: `${key}-${String(dia).padStart(2, '0')}`, cat: f.cat, monto, nota: f.nota });
  all[key].sort((a, b) => b.fecha.localeCompare(a.fecha));
  saveGastosAll(all);
  const rec = loadRecurrentes();
  if (rec.fijos[f.clave]) { rec.fijos[f.clave].monto = monto; saveRecurrentes(rec); }  // el monto de este mes manda para el que viene
}

let fijosRender = [], candidatosRender = [], fijosVerTodo = false;

function montoDeFila(i, porDefecto) {
  const input = $('fijo-monto-' + i);
  return parseFloat(input ? input.value : porDefecto);
}
function cargarFijo(i) {
  const f = fijosRender[i];
  if (!f || f.cargado) return;
  const monto = montoDeFila(i, f.monto);
  if (!monto || monto <= 0) { alert('Cargá un monto válido para este gasto fijo.'); return; }
  agregarFijoAlMes(f, monto);
  renderGastos();
  chequearAlertaCat(f.cat);
}
function cargarTodosLosFijos() {
  const cats = [];
  fijosRender.forEach((f, i) => {
    if (f.cargado) return;
    const monto = montoDeFila(i, f.monto);
    if (!monto || monto <= 0) return;
    agregarFijoAlMes(f, monto);
    if (!cats.includes(f.cat)) cats.push(f.cat);
  });
  renderGastos();
  cats.forEach(chequearAlertaCat);
}
function marcarFijo(i) {
  const c = candidatosRender[i];
  if (!c) return;
  const rec = loadRecurrentes();
  rec.fijos[c.clave] = { cat: c.cat, nota: c.nota, monto: c.monto, dia: c.dia };
  saveRecurrentes(rec);
  renderGastos();
}
function descartarFijo(i) {
  const c = candidatosRender[i];
  if (!c) return;
  const rec = loadRecurrentes();
  if (!rec.descartados.includes(c.clave)) rec.descartados.push(c.clave);
  saveRecurrentes(rec);
  renderGastos();
}
function quitarFijo(i) {
  const f = fijosRender[i];
  if (!f) return;
  if (!confirm(`"${etiquetaFijo(f.cat, f.nota)}" va a dejar de figurar como gasto fijo.\n\nLos gastos que ya cargaste quedan como están. ¿Seguir?`)) return;
  const rec = loadRecurrentes();
  delete rec.fijos[f.clave];
  if (!rec.descartados.includes(f.clave)) rec.descartados.push(f.clave);  // no volver a sugerirlo
  saveRecurrentes(rec);
  renderGastos();
}
function toggleVerFijos(v) { fijosVerTodo = v; renderFijos(); }

function renderFijos() {
  const el = $('fijos-card');
  if (!el) return;
  fijosRender = estadoFijos();
  if (!fijosRender.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';

  const pendientes = fijosRender.filter(f => !f.cargado).length;
  const total = fijosRender.length;
  const plural = total > 1;

  // Si ya está todo cargado, se encoge a una línea para no ocupar pantalla al pedo.
  if (!pendientes && !fijosVerTodo) {
    el.innerHTML = `
      <div class="fc-hdr">
        <span class="fc-title" style="color:var(--green-text)">✓ ${plural ? `Tus ${total} gastos fijos ya están cargados` : 'Tu gasto fijo ya está cargado'} este mes</span>
        <button class="fc-ver" onclick="toggleVerFijos(true)">Ver</button>
      </div>`;
    return;
  }

  const filas = fijosRender.map((f, i) => f.cargado
    ? `<div class="fc-row fc-done">
         <span class="fc-check">✓</span>
         <span class="fc-name">${esc(etiquetaFijo(f.cat, f.nota))}</span>
         <span class="fc-monto">${fmtARS(f.monto)}</span>
         <button class="fc-x" onclick="quitarFijo(${i})" title="Que deje de ser un gasto fijo">✕</button>
       </div>`
    : `<div class="fc-row">
         <span class="fc-dot">•</span>
         <span class="fc-name">${esc(etiquetaFijo(f.cat, f.nota))}</span>
         <input class="fc-input" id="fijo-monto-${i}" type="number" min="0" step="1000" value="${f.monto}" aria-label="Monto de ${esc(etiquetaFijo(f.cat, f.nota))}">
         <button class="fc-btn" onclick="cargarFijo(${i})">Cargar</button>
         <button class="fc-x" onclick="quitarFijo(${i})" title="Que deje de ser un gasto fijo">✕</button>
       </div>`).join('');

  el.innerHTML = `
    <div class="fc-hdr">
      <span class="fc-title">Gastos fijos de ${monthLabel(mesVisible)}</span>
      <span class="fc-count">${total - pendientes} de ${total} cargados</span>
    </div>
    ${filas}
    ${pendientes > 1 ? `<button class="fc-btn-all" onclick="cargarTodosLosFijos()">Cargar los ${pendientes} que faltan</button>` : ''}
    ${!pendientes ? `<button class="fc-ver" style="margin-top:10px" onclick="toggleVerFijos(false)">Ocultar</button>` : ''}`;
}

function renderSugerenciasFijos() {
  const el = $('sug-card');
  if (!el) return;
  candidatosRender = detectarCandidatosFijos().slice(0, 3);
  if (!candidatosRender.length) { el.style.display = 'none'; el.innerHTML = ''; return; }
  el.style.display = '';
  el.innerHTML = candidatosRender.map((c, i) => `
    <div class="sug-row">
      <span class="sug-ic">💡</span>
      <span class="sug-txt"><b>${esc(etiquetaFijo(c.cat, c.nota))}</b> te aparece ${c.meses} meses seguidos, el último por ${fmtARS(c.monto)}. ¿Lo marcamos como gasto fijo para ofrecértelo todos los meses?</span>
      <span class="sug-acciones">
        <button class="sug-si" onclick="marcarFijo(${i})">Sí, es fijo</button>
        <button class="sug-no" onclick="descartarFijo(${i})">No</button>
      </span>
    </div>`).join('');
}

// ── IMPORTAR RESUMEN (PDF / TEXTO) ────────────────────────────────────────
// Lee el resumen de la tarjeta o de la billetera, propone una categoría para
// cada movimiento y te deja corregir TODO antes de importar nada. El archivo
// se procesa entero dentro del navegador: no se sube a ningún lado.
const LS_IMPORT_REGLAS = 'presupuesto_import_reglas_v1';
const PDFJS_SRC    = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
const PDFJS_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

function loadReglasImport() {
  try { return JSON.parse(localStorage.getItem(LS_IMPORT_REGLAS) || '{}'); } catch (e) { return {}; }
}
function saveReglasImport(r) {
  try { localStorage.setItem(LS_IMPORT_REGLAS, JSON.stringify(r)); } catch (e) {}
}

// Diccionario de comercios argentinos. Se recorre en orden: gana el primero.
const DICCIONARIO_CAT = [
  ['supermercado',      ['coto','carrefour','jumbo','disco ','vea ','changomas','walmart','libertad','makro','dia %','supermercado','almacen','verduleria','carniceria','panaderia','fiambreria','changomas']],
  ['nafta',             ['ypf','shell','axion','puma energ','estacion de servicio','gnc','petrobras','refinor','peaje','caminos de las','autopista','ausa','aubasa','sube ','estacionamiento']],
  ['servicios',         ['edenor','edesur','metrogas','aysa','camuzzi','naturgy','telecom','fibertel','cablevision','personal ','claro ','movistar','directv','flow','telecentro','edea','edelap','epec','aguas ']],
  ['suscripciones',     ['netflix','spotify','disney','hbo','max.com','amazon prime','youtube','apple.com','itunes','icloud','google *','openai','chatgpt','dropbox','microsoft','adobe','canva','paramount','crunchyroll']],
  ['juntadas',          ['restaurant','parrilla','resto','bar ','cafe','coffee','starbucks','mcdonald','burger','subway','mostaza','pizza','pizzer','heladeria','grido','rappi','pedidosya','pedidos ya','cerveceria','sushi','confiteria','bodegon']],
  ['farmacia',          ['farmacia','farmacity','farmatodo','dr. ahorro','simplicity','vantage','perfumeria','juleriaque','get the look','pigmento']],
  ['cnc',               ['fravega','musimundo','garbarino','naldo','cetrogar','ferreteria','easy ','sodimac','mercadolibre','mercado libre','impuesto de sellos','iibb','percep','iva rg','db.rg','rg 5617']],
  ['prepaga',           ['osde','swiss medical','galeno','medife','omint','sancor salud','medicus','hospital italiano','premedic']],
  ['gimnasio',          ['gimnasio','sportclub','megatlon','smartfit','smart fit','crossfit',' gym']],
  ['mantenimientoAuto', ['taller','gomeria','neumatic','repuesto','lubricentro','service auto','autopartes','mecanic']],
  ['seguroAuto',        ['seguro','allianz','zurich','mapfre','sancor seguros','federacion patronal','rivadavia seguros','la caja','provincia seguros']],
  ['patente',           ['patente','rentas','infraccion','vtv','municipalidad']],
  ['viajes',            ['despegar','aerolineas','latam','flybondi','jetsmart','booking','airbnb','airlines','hotel','turismo','almundo']],
  ['estudios',          ['udemy','coursera','platzi','domestika','universidad','univ ','instituto','libreria','fundacion univ','escuela de negocios','posgrado','maestria']],
  ['deportes',          ['padel','futbol','tenis','club atletico','cancha']],
  ['colegio',           ['colegio','jardin de infantes','escuela','cuota escolar']],
  ['alquiler',          ['alquiler','expensas','inmobiliaria','administracion consorcio']],
  ['auto',             ['cuota auto','plan rombo','plan ovalo','credito prendario']],
];

function normTexto(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
}
// Clave con la que la app "recuerda" un comercio: las dos primeras palabras,
// sin números, para que "COTO CICSA 4821 CABA" y "COTO CICSA 9017" sean lo mismo.
function claveComercio(desc) {
  const limpio = normTexto(desc).replace(/[0-9]/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
  return limpio.split(' ').filter(p => p.length > 2).slice(0, 2).join(' ');
}
function categorizar(desc) {
  const d = normTexto(desc);
  const reglas = loadReglasImport();
  for (const clave of Object.keys(reglas)) {          // primero lo que vos le enseñaste
    if (clave && d.includes(clave)) return { cat: reglas[clave], aprendida: true };
  }
  for (const [cat, claves] of DICCIONARIO_CAT) {
    if (claves.some(k => d.includes(k))) return { cat, aprendida: false };
  }
  return { cat: 'otro', aprendida: false };
}

// Los resúmenes usan formato argentino ($ 1.234,56) pero algunos vienen al revés.
function parsearMonto(txt) {
  let t = String(txt).replace(/[^0-9.,-]/g, '');
  const negativo = /^-|-$/.test(t);
  t = t.replace(/-/g, '');
  const coma = t.lastIndexOf(','), punto = t.lastIndexOf('.');
  if (coma > punto)      t = t.replace(/\./g, '').replace(',', '.');
  else if (punto > coma) t = t.replace(/,/g, '');
  else                   t = t.replace(/[.,]/g, '');
  const n = parseFloat(t);
  if (isNaN(n)) return null;
  return negativo ? -n : n;
}

const RE_FECHA = /\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/;
const RE_MONTO = /-?\$?\s?\d{1,3}(?:\.\d{3})+,\d{2}-?|-?\$?\s?\d{1,3}(?:,\d{3})+\.\d{2}-?|-?\$?\s?\d+[.,]\d{2}-?/g;
const RE_CUOTA = /\b(\d{1,2})\s*de\s*(\d{1,2})\b/i;
// Líneas que nunca son un consumo: totales, vencimientos, datos de la cuenta,
// y la letra chica del resumen (que trae fechas y montos y confundiría al lector).
const RE_IGNORAR = /(total|saldo|vencimiento|pago m[ií]nimo|m[ií]nimo a pagar|a pagar|l[ií]mite|cbu|cuit|c\.u\.i\.t|n[uú]mero de cuenta|estado de cuenta|su pago|pago recibido|pago en pesos|adelanto en efectivo|p[aá]gina \d|subtotal|cuotas? de \$|cuotas a vencer|pr[oó]ximas cuotas|tna|tea\b|cftea|plan v:|tasa|per[ií]odo|cierre|copia fiel|t[eé]rminos y condiciones|consumido)/i;
// A partir de acá empieza la letra chica: dejamos de buscar movimientos.
const RE_FIN_MOVIMIENTOS = /(t[eé]rminos y condiciones|informaci[oó]n legal|usted puede solicitar)/i;

function anioProbable(dd, mm, aa) {
  if (aa != null) return aa < 100 ? 2000 + aa : aa;
  const hoy = new Date();
  let a = hoy.getFullYear();
  // Sin año en la línea: si la fecha cae muy adelante, es del año pasado.
  if (new Date(a, mm - 1, dd) - hoy > 1000 * 60 * 60 * 24 * 180) a -= 1;
  return a;
}

// Separa los importes de una línea distinguiendo pesos de dólares por su
// símbolo. Los números entre paréntesis se descartan: en los impuestos son la
// base del cálculo ("21%( 9394,88) $ 1.972,92"), no lo que te cobran.
function importesDeLinea(txt, permitirSinSimbolo) {
  const limpio = txt.replace(/\([^)]*\)/g, ' ');
  const usd = [], pesos = [];
  const sinUsd = limpio.replace(/(-?)\s*U\$S\s*(-?[\d.,]+)/gi, (m, signo, n) => {
    const v = parsearMonto(n);
    if (v != null) usd.push(signo === '-' ? -Math.abs(v) : v);
    return ' ';
  });
  sinUsd.replace(/(-?)\s*\$\s*\$?\s*(-?[\d.,]+)/g, (m, signo, n) => {
    const v = parsearMonto(n);
    if (v != null) pesos.push(signo === '-' ? -Math.abs(v) : v);
    return ' ';
  });
  // Hay resúmenes que no marcan la moneda con ningún símbolo. Ahí tomamos los
  // números con centavos y, si hay varias columnas, la de pesos es la mayor.
  // Solo se hace en líneas que traen su propia fecha: si no, adivinar números
  // sueltos levanta basura como la línea de tasas ("En pesos: 77,900 %"), que
  // se colgaría de la fecha arrastrada de un movimiento anterior.
  if (permitirSinSimbolo && !pesos.length && !usd.length) {
    const sueltos = (limpio.match(RE_MONTO) || []).map(parsearMonto).filter(n => n != null && n !== 0);
    if (sueltos.length) pesos.push(sueltos.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a));
  }
  return { pesos: pesos.filter(n => n !== 0), usd: usd.filter(n => n !== 0) };
}

function limpiarDescripcion(txt, fechaTexto) {
  return txt
    .replace(fechaTexto || '', ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(-?)\s*U\$S\s*-?[\d.,]+/gi, ' ')
    .replace(/(-?)\s*\$\s*\$?\s*-?[\d.,]+/g, ' ')
    .replace(RE_CUOTA, ' ')
    .replace(RE_MONTO, ' ')               // importes sin símbolo de moneda
    .replace(/\b\d{5,}\b/g, ' ')          // número de comprobante
    .replace(/\s+/g, ' ')
    .replace(/^[\s\-*.,|$%]+|[\s\-*.,|$%]+$/g, '')
    .trim();
}

// Lee las líneas del resumen. `tc` es el tipo de cambio para pasar a pesos los
// consumos en dólares; si no hay, esas filas vienen marcadas para que decidas.
function parsearLineas(lineas, tc) {
  const crudas = [];
  let fechaVigente = null, tcDetectado = 0, terminado = false;

  lineas.forEach(linea => {
    if (terminado) return;
    const txt = String(linea).replace(/\s+/g, ' ').trim();
    if (!txt) return;
    if (RE_FIN_MOVIMIENTOS.test(txt)) { terminado = true; return; }
    // Algunos resúmenes traen el tipo de cambio que usó el banco ("tc1500,000").
    const mtc = txt.match(/\btc\s*([\d.,]+)/i);
    if (mtc) { const v = parsearMonto(mtc[1]); if (v && v > 100) tcDetectado = v; }
    if (RE_IGNORAR.test(txt)) return;

    // La fecha se arrastra: hay líneas de continuación que no la repiten
    // (el segundo cargo de Apple del mismo día, por ejemplo).
    const mf = txt.match(RE_FECHA);
    if (mf) {
      const dd = parseInt(mf[1], 10), mm = parseInt(mf[2], 10);
      if (dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12) {
        fechaVigente = { dd, mm, aa: mf[3] != null ? parseInt(mf[3], 10) : null, texto: mf[0] };
      }
    }
    if (!fechaVigente) return;   // todavía no arrancó la lista de movimientos

    const { pesos, usd } = importesDeLinea(txt, !!mf);
    if (!pesos.length && !usd.length) return;
    const enPesos = pesos.length ? pesos[pesos.length - 1] : null;
    const enUsd   = !pesos.length && usd.length ? usd[usd.length - 1] : null;
    const bruto = enPesos != null ? enPesos : enUsd;
    if (bruto == null || bruto <= 0) return;      // pagos y devoluciones no son gastos

    const desc = limpiarDescripcion(txt, mf ? mf[0] : '');
    if (!desc || desc.length < 3) return;

    const mc = txt.match(RE_CUOTA);
    crudas.push({
      dd: fechaVigente.dd, mm: fechaVigente.mm, aa: fechaVigente.aa,
      desc: desc.slice(0, 60),
      enUsd: enPesos == null,
      bruto,
      cuota: mc ? { n: parseInt(mc[1], 10), de: parseInt(mc[2], 10) } : null,
    });
  });

  // El mes del resumen se deduce del mes más repetido entre los consumos que
  // NO son cuotas. Las cuotas traen la fecha de la compra original (puede ser
  // de hace un año) pero te las cobran en ESTE resumen, así que van acá.
  const conteo = {};
  crudas.filter(c => !c.cuota).forEach(c => {
    const a = anioProbable(c.dd, c.mm, c.aa);
    const k = `${a}-${String(c.mm).padStart(2, '0')}`;
    conteo[k] = (conteo[k] || 0) + 1;
  });
  const mesResumen = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a])[0] || monthKey();
  const cambio = tc || tcDetectado || 0;
  const fuenteTC = tc ? 'tuyo' : (tcDetectado ? 'resumen' : '');

  return crudas.map(c => {
    let anio, mes, dia;
    if (c.cuota) {
      [anio, mes] = mesResumen.split('-').map(Number);
      dia = Math.min(c.dd, new Date(anio, mes, 0).getDate());
    } else {
      anio = anioProbable(c.dd, c.mm, c.aa);
      mes = c.mm;
      dia = Math.min(c.dd, new Date(anio, mes, 0).getDate());
    }
    const monto = c.enUsd ? Math.round(c.bruto * cambio) : Math.round(c.bruto);
    return {
      fecha: `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
      desc: c.desc,
      monto,
      enUsd: c.enUsd,
      usd: c.enUsd ? c.bruto : 0,
      tcUsado: c.enUsd ? cambio : 0,
      tcFuente: c.enUsd ? fuenteTC : '',
      cuota: c.cuota,
      reubicada: !!c.cuota,
    };
  });
}

let _pdfjs = null;
function cargarPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  if (_pdfjs) return _pdfjs;
  _pdfjs = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = PDFJS_SRC;
    s.onload = () => {
      if (!window.pdfjsLib) return rej(new Error('cargó pero no encontré el lector'));
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
      res(window.pdfjsLib);
    };
    s.onerror = () => { _pdfjs = null; rej(new Error('sin internet')); };
    document.head.appendChild(s);
  });
  return _pdfjs;
}

// El PDF entrega pedacitos de texto sueltos con su posición; los reagrupamos
// en líneas juntando los que están a la misma altura.
async function lineasDelPdf(file) {
  const pdfjsLib = await cargarPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lineas = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const contenido = await (await pdf.getPage(p)).getTextContent();
    const filas = {};
    contenido.items.forEach(it => {
      if (!it.str || !it.str.trim()) return;
      const y = Math.round(it.transform[5] / 3) * 3;
      (filas[y] = filas[y] || []).push({ x: it.transform[4], s: it.str });
    });
    Object.keys(filas).map(Number).sort((a, b) => b - a).forEach(y => {
      const t = filas[y].sort((a, b) => a.x - b.x).map(o => o.s).join(' ').replace(/\s+/g, ' ').trim();
      if (t) lineas.push(t);
    });
  }
  return lineas;
}

let impFilas = [];

function abrirImport() {
  impFilas = [];
  $('imp-backdrop').classList.add('open');
  $('imp-modal').classList.add('open');
  pantallaImportInicial();
}
function cerrarImport() {
  $('imp-backdrop').classList.remove('open');
  $('imp-modal').classList.remove('open');
  impFilas = [];
}
function pantallaImportInicial() {
  $('imp-title').textContent = 'Importar resumen';
  $('imp-body').innerHTML = `
    <div class="imp-drop">
      <div class="imp-drop-ic">📄</div>
      <div class="imp-drop-txt">Elegí el PDF del resumen de tu tarjeta<br>o de los movimientos de tu billetera.</div>
      <button class="imp-btn" onclick="document.getElementById('imp-file').click()">Elegir archivo PDF</button>
    </div>
    <div class="imp-o">o si no tenés el PDF</div>
    <textarea class="imp-ta" id="imp-texto" placeholder="Pegá acá las líneas de movimientos, copiadas del home banking o de la app del banco. Por ejemplo:&#10;&#10;15/07/26  COTO CICSA        $ 45.230,50&#10;16/07/26  YPF FULL PALERMO  $ 32.000,00"></textarea>
    <button class="imp-btn-2" style="width:100%;margin-top:8px" onclick="importarTextoPegado()">Leer el texto pegado</button>
    <div class="imp-nota">🔒 <b>Tu resumen no se sube a ningún lado.</b> Se lee entero dentro de tu navegador, igual que el resto de la app. Y no se carga nada hasta que lo revises en el paso siguiente.</div>`;
  $('imp-foot').innerHTML = `<span class="imp-info">Después de leerlo vas a poder corregir categorías y montos antes de importar.</span>
    <button class="imp-btn-2" onclick="cerrarImport()">Cancelar</button>`;
}
function pantallaImportEstado(html) {
  $('imp-body').innerHTML = `<div class="imp-estado">${html}</div>`;
  $('imp-foot').innerHTML = `<span class="imp-info"></span><button class="imp-btn-2" onclick="pantallaImportInicial()">Volver</button>`;
}

async function importarArchivo(evt) {
  const file = evt.target.files[0];
  evt.target.value = '';
  if (!file) return;
  pantallaImportEstado('Leyendo el PDF…<br><span style="font-size:.75rem">La primera vez descarga el lector, puede tardar unos segundos.</span>');
  try {
    prepararRevision(parsearLineas(await lineasDelPdf(file), tc()), file.name);
  } catch (e) {
    const sinNet = /sin internet/.test(e.message || '');
    pantallaImportEstado(`<span class="imp-error">No pude leer ese PDF.</span><br><br>` + (sinNet
      ? 'Necesito conexión a internet la primera vez, para descargar el lector de PDF. Fijate si tenés señal y probá de nuevo.'
      : 'Puede que el archivo esté protegido con contraseña, o que sea una foto escaneada en vez de texto.<br><br>Probá con la opción de <b>pegar el texto</b> a mano.'));
  }
}
function importarTextoPegado() {
  const txt = ($('imp-texto') || {}).value || '';
  if (!txt.trim()) { alert('Pegá primero las líneas de movimientos en el recuadro.'); return; }
  prepararRevision(parsearLineas(txt.split(/\r?\n/), tc()), 'texto pegado');
}

function prepararRevision(filas, origen) {
  if (!filas.length) {
    pantallaImportEstado(`<span class="imp-error">No encontré movimientos ahí.</span><br><br>
      Necesito líneas que tengan una <b>fecha</b> y un <b>importe</b>, tipo<br>
      <code style="font-size:.75rem">15/07/26 COTO CICSA $ 45.230,50</code><br><br>
      Si tu resumen tiene otro formato, pasámelo y lo adapto.`);
    return;
  }
  const all = loadGastosAll();
  impFilas = filas.map(f => {
    const c = categorizar(f.desc);
    const key = monthKey(new Date(f.fecha + 'T00:00:00'));
    const dup = (all[key] || []).some(g => g.fecha === f.fecha && Math.round(g.monto) === f.monto && normTexto(g.nota) === normTexto(f.desc));
    // Un consumo en dólares sin tipo de cambio cargado no se puede convertir:
    // se muestra igual, pero destildado, para que no entre un monto en cero.
    const sinTC = f.enUsd && !f.monto;
    return { ...f, cat: c.cat, aprendida: c.aprendida, catOriginal: c.cat, dup, sinTC, usar: !dup && !sinTC };
  });
  renderRevisionImport(origen);
}

function renderRevisionImport(origen) {
  const opciones = cat => GASTO_CATS.map(c => `<option value="${c.id}"${c.id === cat ? ' selected' : ''}>${catLabel(c.id)}</option>`).join('');
  const dups = impFilas.filter(f => f.dup).length;
  const reconocidos = impFilas.filter(f => f.cat !== 'otro').length;
  const cuotas = impFilas.filter(f => f.reubicada).length;
  const dolares = impFilas.filter(f => f.enUsd).length;
  const sinTC = impFilas.filter(f => f.sinTC).length;

  $('imp-title').textContent = `Revisá antes de importar`;
  $('imp-body').innerHTML = `
    <div class="imp-nota" style="margin:0 0 12px">
      Encontré <b>${impFilas.length} movimiento${impFilas.length > 1 ? 's' : ''}</b> en ${esc(origen)}.
      Le puse categoría a <b>${reconocidos}</b> y el resto quedó en "Otro".
      ${cuotas ? `<br>🔁 <b>${cuotas}</b> ${cuotas > 1 ? 'son cuotas y las moví' : 'es una cuota y la moví'} al mes de este resumen: figuran con la fecha de la compra original, pero te ${cuotas > 1 ? 'las cobran' : 'la cobran'} ahora.` : ''}
      ${dolares ? `<br>💵 <b>${dolares}</b> ${dolares > 1 ? 'están' : 'está'} en dólares. ${
        sinTC ? '<b>No tenés cargado el tipo de cambio</b>, así que no puedo pasarlos a pesos: cargalo más abajo en esta pestaña y volvé a importar.'
        : impFilas.some(f => f.tcFuente === 'resumen')
          ? `Los pasé a pesos con el tipo de cambio que venía en el propio resumen (${impFilas.find(f => f.tcFuente === 'resumen').tcUsado}). Si preferís otro, cargalo abajo y volvé a importar.`
          : 'Los pasé a pesos con el tipo de cambio que tenés cargado.'}` : ''}
      ${dups ? `<br>⚠️ <b>${dups}</b> ya ${dups > 1 ? 'están' : 'está'} cargado${dups > 1 ? 's' : ''} en la app, así que ${dups > 1 ? 'vienen destildados' : 'viene destildado'}.` : ''}
      <br>Corregí lo que haga falta: <b>cada corrección se la voy a recordar</b> para la próxima vez.
    </div>
    <table class="imp-tabla">
      <thead><tr><th></th><th>Fecha</th><th>Descripción</th><th>Monto</th><th>Categoría</th></tr></thead>
      <tbody>
        ${impFilas.map((f, i) => `
          <tr class="${f.dup ? 'dup' : ''}">
            <td><input type="checkbox" id="imp-usar-${i}" ${f.usar ? 'checked' : ''} onchange="impFilas[${i}].usar=this.checked;actualizarPieImport()"></td>
            <td class="imp-fecha">${new Date(f.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })}</td>
            <td class="imp-desc">${esc(f.desc)}${f.dup ? '<span class="imp-dup-chip">ya está</span>' : ''}${f.cuota ? `<span class="imp-cuota-chip">cuota ${f.cuota.n} de ${f.cuota.de}</span>` : ''}${f.enUsd ? `<span class="imp-usd-chip">U$S ${f.usd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}${f.tcUsado ? ` × ${f.tcUsado}` : ' · falta el TC'}</span>` : ''}</td>
            <td><input type="number" min="0" step="1" value="${f.monto}" onchange="impFilas[${i}].monto=Math.round(parseFloat(this.value)||0)"></td>
            <td><select onchange="impFilas[${i}].cat=this.value">${opciones(f.cat)}</select></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  actualizarPieImport();
}
function actualizarPieImport() {
  const n = impFilas.filter(f => f.usar).length;
  const total = impFilas.filter(f => f.usar).reduce((s, f) => s + f.monto, 0);
  $('imp-foot').innerHTML = `
    <span class="imp-info">${n ? `${n} seleccionado${n > 1 ? 's' : ''} · ${fmtARS(total)}` : 'No seleccionaste ninguno.'}</span>
    <button class="imp-btn-2" onclick="pantallaImportInicial()">Volver</button>
    <button class="imp-btn" onclick="confirmarImport()" ${n ? '' : 'disabled'}>Importar ${n || ''}</button>`;
}

function confirmarImport() {
  const elegidas = impFilas.filter(f => f.usar && f.monto > 0);
  if (!elegidas.length) return;
  const all = loadGastosAll();
  const reglas = loadReglasImport();
  const cats = [];
  let aprendidas = 0;

  elegidas.forEach((f, i) => {
    const key = monthKey(new Date(f.fecha + 'T00:00:00'));
    if (!all[key]) all[key] = [];
    all[key].push({ id: Date.now() + i, fecha: f.fecha, cat: f.cat, monto: f.monto, nota: f.desc });
    all[key].sort((a, b) => b.fecha.localeCompare(a.fecha));
    // Si corregiste la categoría, la app se lo guarda para el próximo resumen.
    if (f.cat !== f.catOriginal && f.cat !== 'otro') {
      const clave = claveComercio(f.desc);
      if (clave && reglas[clave] !== f.cat) { reglas[clave] = f.cat; aprendidas++; }
    }
    if (!cats.includes(f.cat)) cats.push(f.cat);
  });
  Object.keys(all).forEach(k => all[k].sort((a, b) => b.fecha.localeCompare(a.fecha)));
  saveGastosAll(all);
  saveReglasImport(reglas);
  cerrarImport();

  // Los resúmenes casi siempre son del mes pasado. Si los gastos no cayeron en
  // el mes que estás mirando, te llevo hasta ahí: si no, quedan cargados pero
  // invisibles y parece que no se importó nada.
  const porMes = {};
  elegidas.forEach(f => { const k = f.fecha.slice(0, 7); porMes[k] = (porMes[k] || 0) + 1; });
  const mesPrincipal = Object.keys(porMes).sort((a, b) => porMes[b] - porMes[a])[0];
  const salte = mesPrincipal && mesPrincipal !== mesVisible;
  if (salte) mesVisible = mesPrincipal;
  renderGastos();

  const otrosMeses = Object.keys(porMes).length > 1
    ? `\n\nOjo: quedaron repartidos en ${Object.keys(porMes).length} meses (${Object.keys(porMes).sort().map(monthLabelShort).join(', ')}). Usá las flechitas para verlos.`
    : '';
  alert(`Listo: importé ${elegidas.length} gasto${elegidas.length > 1 ? 's' : ''}.` +
        (salte ? `\n\nSon de ${monthLabel(mesPrincipal)}, así que te llevo a ese mes.` : '') +
        otrosMeses +
        (aprendidas ? `\n\nMe guardé ${aprendidas === 1 ? 'tu corrección' : `tus ${aprendidas} correcciones`} de categoría para la próxima vez.` : ''));
  cats.forEach(chequearAlertaCat);
}

// ── RESUMEN POR PERÍODO ───────────────────────────────────────────────────
// Reemplaza a la vieja pestaña de histórico: se calcula con los gastos
// cargados, así que no hace falta "cerrar" ningún mes para verlo.
const PERIODOS = [
  { id: 'mes',    label: 'Este mes',          meses: 1,  atras: 0 },
  { id: 'pasado', label: 'Mes pasado',        meses: 1,  atras: 1 },
  { id: 'tres',   label: 'Últimos 3 meses',   meses: 3,  atras: 0 },
  { id: 'doce',   label: 'Últimos 12 meses',  meses: 12, atras: 0 },
];
let periodoActivo = 'mes';
// Paleta propia, equivalente a la del Plan de Retiro pero con los colores de
// esta app, para que se lea bien en claro y en oscuro.
const PALETA_CATS = [
  'oklch(58% .18 25)', 'oklch(55% .15 264)', 'oklch(56% .13 150)', 'oklch(72% .15 80)',
  'oklch(52% .16 300)', 'oklch(58% .12 175)', 'oklch(62% .15 350)', 'oklch(60% .13 130)',
  'oklch(55% .11 210)', 'oklch(50% .05 264)',
];

function mesesHaciaAtras(cantidad, saltando) {
  const hoy = new Date(), out = [];
  for (let i = 0; i < cantidad; i++) {
    out.push(monthKey(new Date(hoy.getFullYear(), hoy.getMonth() - (saltando || 0) - i, 1)));
  }
  return out.sort();
}
function totalDelMes(all, k) {
  return (all[k] || []).reduce((s, g) => s + g.monto, 0);
}
function datosPeriodo(p) {
  const all = loadGastosAll();
  const meses = mesesHaciaAtras(p.meses, p.atras);
  const gastos = meses.reduce((acc, k) => acc.concat(all[k] || []), []);
  const total = gastos.reduce((s, g) => s + g.monto, 0);
  const porCat = {};
  gastos.forEach(g => { porCat[g.cat] = (porCat[g.cat] || 0) + g.monto; });
  // El período inmediatamente anterior, del mismo largo, para comparar.
  const previos = mesesHaciaAtras(p.meses, (p.atras || 0) + p.meses);
  const totalPrevio = previos.reduce((s, k) => s + totalDelMes(all, k), 0);
  // Los meses con algo cargado, para no dividir por meses vacíos.
  const conDatos = meses.filter(k => (all[k] || []).length).length || 1;
  const conDatosPrevio = previos.filter(k => (all[k] || []).length).length;
  // Comparar contra meses en los que todavía no usabas la app da porcentajes
  // absurdos ("+299%"), así que en ese caso no se muestra la comparación.
  const comparable = conDatosPrevio >= conDatos;
  return { meses, gastos, total, porCat, totalPrevio, comparable, promedio: total / conDatos, conDatos };
}

function renderResumen() {
  if (!$('rs-total')) return;
  // Los gráficos se crean con la pestaña oculta, así que arrancan midiendo 0.
  // Al mostrarla hay que pedirles que se vuelvan a medir.
  if (chartRes) chartRes.resize();
  if (chartCats) chartCats.resize();
  const p = PERIODOS.find(x => x.id === periodoActivo) || PERIODOS[0];
  const d = datosPeriodo(p);

  $('rs-chips').innerHTML = PERIODOS.map(x =>
    `<button class="rs-chip${x.id === p.id ? ' on' : ''}" onclick="verPeriodo('${x.id}')">${x.label}</button>`).join('');

  $('rs-label').textContent = p.meses > 1 ? `Gastado en ${p.label.toLowerCase()}` : `Gastado en ${monthLabel(d.meses[0])}`;
  $('rs-total').textContent = fmtARS(d.total);

  const partes = [];
  if (p.meses > 1) partes.push(`<b>${fmtARS(d.promedio)}</b> por mes en promedio`);
  if (d.comparable && d.totalPrevio > 0 && d.total > 0) {
    const dif = d.total - d.totalPrevio;
    const pct = Math.abs(dif) / d.totalPrevio;
    const color = dif > 0 ? 'var(--red-text)' : 'var(--green-text)';
    partes.push(`<b style="color:${color}">${dif > 0 ? '↑' : '↓'} ${fmtPctInt(pct)}</b> contra ${p.meses > 1 ? 'el período anterior' : 'el mes anterior'} (${fmtARS(d.totalPrevio)})`);
  }
  partes.push(`${d.gastos.length} movimiento${d.gastos.length === 1 ? '' : 's'}`);
  $('rs-sub').innerHTML = d.total > 0 ? partes.join(' · ') : 'No hay gastos cargados en este período.';

  // ── Barra de presupuesto consumido ──
  // El presupuesto de las categorías es MENSUAL; para un período de varios meses
  // se multiplica por la cantidad de meses (igual que el ingreso en la barra de
  // distribución), así la comparación es contra el presupuesto de todo el tramo.
  const rsPresu = $('rs-presu');
  if (rsPresu) {
    const presuMes = (typeof PV_CAT_IDS !== 'undefined')
      ? PV_CAT_IDS.reduce((s, id) => s + (getPresupuestoCat(id) || 0), 0) : 0;
    const presuPeriodo = presuMes * p.meses;
    if (presuPeriodo > 0 && d.total > 0) {
      const pct = d.total / presuPeriodo;
      const w = Math.min(100, Math.round(pct * 100));
      const col = pct > 1 ? 'var(--red)' : (pct >= 0.8 ? 'var(--orange)' : 'var(--green)');
      const rotulo = p.meses > 1 ? `Presupuesto de ${p.meses} meses` : 'Presupuesto del mes';
      const pie = pct > 1
        ? `Te pasaste por <b>${fmtARS(d.total - presuPeriodo)}</b>`
        : `Te queda <b>${fmtARS(presuPeriodo - d.total)}</b> ${p.meses > 1 ? 'en el período' : 'este mes'}`;
      rsPresu.innerHTML = `
        <div style="margin-top:16px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;font-size:.78rem;margin-bottom:6px;">
            <span style="color:var(--muted);">${rotulo}</span>
            <span style="font-weight:700;">${Math.round(pct * 100)}% de ${fmtARS(presuPeriodo)}</span></div>
          <div style="height:12px;background:var(--surface-3);border-radius:100px;overflow:hidden;">
            <div id="rs-presu-fill" style="height:100%;width:${w}%;background:${col};border-radius:100px;transform-origin:left center;"></div></div>
          <div style="font-size:.78rem;color:${pct > 1 ? 'var(--red-text)' : 'var(--muted)'};margin-top:6px;">${pie}</div>
        </div>`;
      const fill = $('rs-presu-fill');
      if (fill && fill.animate) {
        try { fill.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }],
          { duration: 650, easing: 'cubic-bezier(.22,.61,.36,1)' }); } catch (e) {}
      }
    } else if (presuPeriodo <= 0) {
      rsPresu.innerHTML = `<div style="font-size:.76rem;color:var(--muted);margin-top:12px;">Definí un presupuesto en las categorías (pestaña Gastos) para ver acá cuánto llevás usado.</div>`;
    } else {
      rsPresu.innerHTML = '';
    }
  }

  renderDistribucionIngreso(d, p);

  // ── Desglose por categoría: la dona da la proporción, la lista los números ──
  const filas = Object.entries(d.porCat).sort((a, b) => b[1] - a[1]);
  $('rs-cats-hdr').textContent = `En qué se te va${p.meses > 1 ? ` · ${p.label.toLowerCase()}` : ''}`;
  $('rs-cats').innerHTML = filas.length
    ? filas.map(([id, monto], i) => `
        <div class="rs-cat">
          <span class="rs-cat-dot" style="background:${PALETA_CATS[i % PALETA_CATS.length]}"></span>
          <span class="rs-cat-name">${esc(catLabel(id))}</span>
          <span class="rs-cat-monto">${fmtARS(monto)}</span>
          <span class="rs-cat-pct">${d.total > 0 ? Math.round((monto / d.total) * 100) : 0}%</span>
        </div>`).join('')
    : `<div class="rs-vacio">Cuando cargues gastos, acá vas a ver en qué se te va la plata, ordenado de mayor a menor.</div>`;

  $('rs-donut-num').textContent = fmtARS(d.total);
  $('rs-donut-cap').textContent = filas.length ? `en ${filas.length} rubro${filas.length > 1 ? 's' : ''}` : 'sin datos';
  if (chartCats) {
    chartCats.data.labels = filas.map(([id]) => catLabel(id));
    chartCats.data.datasets[0].data = filas.map(([, m]) => m);
    chartCats.data.datasets[0].backgroundColor = filas.map((_, i) => PALETA_CATS[i % PALETA_CATS.length]);
    chartCats.update();
  }
  pintarGraficoResumen();
}

// A dónde va el ingreso del período: lo gastado es real, los fondos salen de
// tu plan (no son categorías de gasto, no se cargan como movimientos).
// Los tres fondos se muestran por separado: son destinos distintos y conviene
// ver cuánto va a cada uno, no una bolsa única.
const FONDOS = [
  { id: 'fEmergencia',  nom: 'Fondo de emergencia',  col: 'oklch(66% .10 150)' },
  { id: 'fVacaciones',  nom: 'Fondo de vacaciones',  col: 'oklch(57% .13 150)' },
  { id: 'fInversiones', nom: 'Fondo de inversiones', col: 'oklch(46% .12 150)' },
];

function renderDistribucionIngreso(d, p) {
  if (!$('di-barra')) return;
  const ingreso = g('salario') * p.meses;
  const detalleFondos = FONDOS
    .map(f => ({ nom: f.nom, col: f.col, val: g(f.id) * p.meses }))
    .filter(f => f.val > 0);
  const fondos = detalleFondos.reduce((s, f) => s + f.val, 0);
  const gastos = d.total;
  const libre = ingreso - gastos - fondos;
  const base = Math.max(ingreso, gastos + fondos) || 1;

  $('di-ingreso').textContent = fmtARS(ingreso);
  $('di-ingreso-lbl').textContent = p.meses > 1
    ? `de ingreso en ${p.meses} meses` : `de ingreso en ${monthLabel(d.meses[0])}`;

  // La barra muestra cada fondo como su propio tramo, en tonos de verde.
  const segmentos = [{ nom: 'Gastos', val: gastos, col: 'oklch(58% .18 25)' }]
    .concat(detalleFondos)
    .concat(libre > 0 ? [{ nom: 'Te queda libre', val: libre, col: 'oklch(55% .15 264)' }] : []);
  $('di-barra').innerHTML = segmentos.filter(x => x.val > 0)
    .map(x => `<span class="di-seg" style="width:${(x.val / base) * 100}%;background:${x.col}" title="${x.nom}: ${fmtARS(x.val)}"></span>`).join('');

  if (!(ingreso > 0)) {
    $('di-detalle').innerHTML = `<div class="rs-vacio">Cargá tu salario en Ajustes y acá vas a ver cómo se reparte tu ingreso.</div>`;
    return;
  }
  const fila = (x) => `
    <div class="di-fila${x.hijo ? ' hijo' : ''}">
      <span class="di-punto" style="background:${x.col}"></span>
      <span class="di-nombre">${x.nom}${x.sub ? `<small>${x.sub}</small>` : ''}</span>
      <span class="di-monto"${x.rojo ? ' style="color:var(--red-text)"' : ''}>${x.rojo ? '−' : ''}${fmtARS(x.val)}</span>
      <span class="di-pct">${Math.round((x.val / ingreso) * 100)}%</span>
    </div>`;

  const filas = [];
  if (gastos > 0) filas.push(fila({ nom: 'Gastos', sub: 'lo que cargaste', val: gastos, col: 'oklch(58% .18 25)' }));
  if (fondos > 0) {
    filas.push(fila({ nom: 'Fondos e inversión', sub: 'según tu plan', val: fondos, col: 'oklch(56% .13 150)' }));
    detalleFondos.forEach(f => filas.push(fila({ nom: f.nom, val: f.val, col: f.col, hijo: true })));
  }
  if (libre >= 0) filas.push(fila({ nom: 'Te queda libre', sub: 'sin asignar', val: libre, col: 'oklch(55% .15 264)' }));
  else filas.push(fila({ nom: 'Te falta', sub: 'gastaste más de lo que entra', val: -libre, col: 'oklch(72% .15 80)', rojo: true }));
  $('di-detalle').innerHTML = filas.join('');
}

// El gráfico siempre muestra los últimos 12 meses: es la foto larga, no
// depende del filtro de arriba.
function pintarGraficoResumen() {
  if (!chartRes) return;
  const all = loadGastosAll();
  let meses = mesesHaciaAtras(12, 0);
  // No arrancar con un montón de meses en cero de antes de que usaras la app.
  const primero = meses.findIndex(k => (all[k] || []).length);
  if (primero > 0) meses = meses.slice(primero);
  chartRes.data.labels = meses.map(monthLabelShort);
  chartRes.data.datasets = [{
    label: 'Gastado',
    data: meses.map(k => totalDelMes(all, k)),
    borderColor: 'oklch(58% .18 25)',
    backgroundColor: 'oklch(58% .18 25 / .07)',
    // Mismo estilo que el gráfico del Plan de Retiro: línea suave, sin puntos
    // hasta que la tocás.
    borderWidth: 2.5, pointRadius: 0, pointHoverRadius: 5, fill: true, tension: 0.3,
  }];
  chartRes.update();
}
function verPeriodo(id) { periodoActivo = id; renderResumen(); }

// ── INICIO / ESTA SEMANA ──────────────────────────────────────────────────
// Pantalla de arranque: un vistazo rápido de cómo venís, en vez de caer en
// una tabla vacía. La semana va de lunes a domingo.
const DIAS_CORTOS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Una semana puede cruzar dos meses, así que aplanamos todos los meses.




// ── HISTÓRICO / SNAPSHOTS MENSUALES ─────────────────────────────────────
const LS_SNAPSHOTS = 'presupuesto_snapshots_v1';

// ── TIPO DE CAMBIO Y CONEXIÓN CON EL PLAN DE RETIRO ─────────────────────
const LS_TC = 'presupuesto_tc_v1';
const LS_RETIRO_PARAMS = 'planRetiro_params_v1'; // clave compartida con el plan de retiro (mismo dominio)
function fmtUSD(n) {
  if (n == null) return '—';
  const abs = Math.abs(Math.round(n));
  return (n < 0 ? '-US$' : 'US$') + abs.toLocaleString('en-US');
}
function tc() { return parseFloat($('tipoCambio').value) || 0; }
function saveTC() { try { localStorage.setItem(LS_TC, $('tipoCambio').value || ''); } catch (e) {} }
function loadTC() { try { const r = localStorage.getItem(LS_TC); if (r) $('tipoCambio').value = r; } catch (e) {} }
function computeSuperavitRealActual() {
  const key = mesVisible;
  const all = loadGastosAll();
  const list = all[key] || [];
  const gastoReal = list.reduce((s, x) => s + x.monto, 0);
  return g('salario') - gastoReal;
}
function updateRetiroPreview() {
  const sup = computeSuperavitRealActual();
  const rate = tc();
  const usd = rate > 0 ? sup / rate : null;
  $('retiro-preview').innerHTML = `Superávit real: <b>${fmtARS(sup)}</b> · en USD: <b>${usd !== null ? fmtUSD(usd) : '—'}</b>`;
}
function syncAhorroARetiro() {
  const rate = tc();
  if (!rate || rate <= 0) { alert('Ingresá un tipo de cambio válido primero (ARS por USD).'); return; }
  const sup = computeSuperavitRealActual();
  if (sup <= 0) {
    if (!confirm('Tu superávit real de este mes es negativo o cero, así que se enviaría $0 como ahorro mensual. ¿Continuar igual?')) return;
  }
  const usd = Math.max(0, Math.round(sup / rate));
  try {
    const raw = localStorage.getItem(LS_RETIRO_PARAMS);
    const p = raw ? JSON.parse(raw) : {};
    p.ahorroMensual = usd;
    localStorage.setItem(LS_RETIRO_PARAMS, JSON.stringify(p));
    alert(`Listo. Ahorro mensual actualizado a ${fmtUSD(usd)} en el plan de retiro.\n\nAbrí (o refrescá) el plan de retiro para verlo reflejado.`);
  } catch (e) {
    alert('No pude escribir en el almacenamiento local del navegador. Asegurate de usar el mismo navegador donde tenés abierto el plan de retiro.');
  }
}

// ── BACKUP: EXPORTAR / IMPORTAR ─────────────────────────────────────────
const BACKUP_KEYS = [LS_PARAMS, LS_GASTOS, LS_SNAPSHOTS, LS_TC, LS_ALERTAS_CFG, LS_ALERTAS_EST, LS_RECURRENTES, LS_IMPORT_REGLAS];
function exportBackup() {
  const data = { exportedAt: new Date().toISOString(), app: 'presupuesto_personal', data: {} };
  BACKUP_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) data.data[k] = v; });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presupuesto-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
function importBackup(evt) {
  const file = evt.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      const data = parsed.data || parsed;
      if (!confirm('Esto va a reemplazar tus datos actuales (presupuesto, gastos, histórico y tipo de cambio) por los del backup. ¿Continuar?')) return;
      Object.entries(data).forEach(([k, v]) => { if (BACKUP_KEYS.includes(k)) localStorage.setItem(k, v); });
      alert('Backup restaurado ✓. La página se va a recargar.');
      location.reload();
    } catch (e) {
      alert('El archivo no parece un backup válido de esta app.');
    }
  };
  reader.readAsText(file);
  evt.target.value = '';
}

// ── RECALC ────────────────────────────────────────────────────────────────
function g(id) { return parseFloat($(id).value); }
function tog(id) { return $('tog-' + id).checked; }


// ── INIT ──────────────────────────────────────────────────────────────────
loadParamsPresu();
Object.keys(sliders).forEach(id => {
  const el = $(id), vEl = $('v-' + id);
  if (el && vEl) vEl.textContent = sliders[id](parseFloat(el.value));
});
initGastoCatSelect();
$('gasto-fecha').value = new Date().toISOString().slice(0, 10);
loadTC();
$('tipoCambio').addEventListener('input', () => { saveTC(); updateRetiroPreview(); });
setTab('resumen');   // deja la vista correcta visible y pinta todo
