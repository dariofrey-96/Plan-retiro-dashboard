// ── GRÁFICO DE EVOLUCIÓN HISTÓRICA ──────────────────────────────────────────
// Lee history.json directo del repo público (sin token, es solo lectura) —
// ese archivo lo va completando solo el robot diario de GitHub Actions.
let histData = null, histPeriodDays = 30, histError = null;
const chartHist = new Chart(document.getElementById('chart-hist').getContext('2d'), {
  type: 'line', data: { labels: [], datasets: [] }, options: cDef()
});
// El gráfico general (cDef) redondea a K/M para las cifras grandes de Proyección
// (millones). Acá los valores de cartera suelen moverse en rangos chicos
// (ej. $9.710 a $9.750), y ese redondeo hacía que todo el eje mostrara "$10K"
// sin distinguir la variación real — se lo pisa con un formateador propio,
// más preciso, sacando el mínimo/máximo real de los datos en cada render.
chartHist.options.scales.y.ticks.callback = v => (typeof fmtC === 'function' ? fmtC(v) : fmt(v));

// El eje X guarda la etiqueta completa (la que se ve en el tooltip: "5 ago 2026,
// 12:00") pero abajo dibuja una versión corta, si no con snapshots cada hora
// quedaban decenas de fechas largas encimadas. maxTicksLimit deja ~7 marcas.
let histAxisLabels = [];
chartHist.options.scales.x.ticks.callback = function (val, i) {
  return histAxisLabels[typeof val === 'number' ? val : i] ?? '';
};
chartHist.options.scales.x.ticks.maxTicksLimit = 7;
chartHist.options.scales.x.ticks.maxRotation = 0;
chartHist.options.scales.x.ticks.autoSkip = true;

// Los colores del tema son oklch(), así que para el degradado hay que
// inyectarles el alfa con la sintaxis "/ a". Si el navegador no lo parsea,
// addColorStop tira SyntaxError y se cae el gráfico: de ahí el try/catch.
function colorConAlfa(color, a) {
  const c = (color || '').trim();
  if (!c) return `rgba(88,166,255,${a})`;
  if (c.startsWith('#')) {
    const h = c.slice(1);
    const f = h.length === 3 ? h.split('').map(x => x + x).join('') : h;
    const n = parseInt(f, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }
  if (/^(oklch|oklab|lch|lab|hsl|rgb)a?\(/i.test(c) && !c.includes('/')) return c.replace(/\)\s*$/, ` / ${a})`);
  return c;
}
// Relleno degradado bajo la línea: se define como función porque en el primer
// render chartArea todavía no existe (Chart.js la calcula después de medir).
function histGradiente(ctx) {
  const { chart } = ctx;
  const { ctx: c, chartArea } = chart;
  if (!chartArea) return 'transparent';
  const base = getCSSVar('--accent') || '#58a6ff';
  try {
    const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    g.addColorStop(0, colorConAlfa(base, 0.26));
    g.addColorStop(1, colorConAlfa(base, 0));
    return g;
  } catch (e) {
    return 'transparent'; // navegador viejo que no entiende oklch con alfa
  }
}

async function loadHistory() {
  try {
    histData = (await ghLeerJson(GH_PATH_HISTORY)) || { snapshots: [] };
    histError = null;
  } catch (e) {
    // No es lo mismo "todavía no hay mediciones" que "no las pude leer": si no
    // se distinguen, un token vencido se ve igual que un historial vacío y el
    // robot puede estar caído meses sin que te enteres.
    histData = { snapshots: [] };
    histError = e.message || 'no se pudo leer';
  }
  populateHistSeriesSelect();
  renderHistChart();
  // La portada dibuja apenas abrís la app, ANTES de que este historial termine
  // de bajar de GitHub. Sin este redibujo, la variación de 24h se quedaba en
  // "sin historial suficiente" aunque el robot tenga semanas de mediciones.
  if (typeof renderInicio === 'function') renderInicio();
}

function populateHistSeriesSelect() {
  const sel = $('hist-series');
  if (!sel || !histData) return;
  // Sólo los tickers y las categorías que la cartera elegida realmente tiene:
  // ofrecer "Metales" cuando no tenés ninguno dibuja una línea plana en cero.
  const propios = new Set((carteraActiva === TODAS ? carteras.flatMap(c => c.assets) : assets).map(a => a.ticker));
  const cats = new Set((carteraActiva === TODAS ? carteras.flatMap(c => c.assets) : assets).map(a => a.cat));
  const tickers = new Set();
  (histData.snapshots || []).forEach(s => Object.keys(s.byAsset || {}).forEach(t => { if (propios.has(t)) tickers.add(t); }));
  const currentVal = sel.value;
  const nombreCat = { crypto: 'Crypto', stock: 'Acciones/ETFs', metal: 'Metales' };
  sel.innerHTML = `<option value="__total__">${carteraActiva === TODAS ? 'Todas las carteras' : nombreCarteraActiva()}</option>` +
    ['crypto', 'stock', 'metal'].filter(c => cats.has(c))
      .map(c => `<option value="cat:${c}">Categoría: ${nombreCat[c]}</option>`).join('') +
    [...tickers].sort().map(t => `<option value="asset:${t}">${t}</option>`).join('');
  if ([...sel.options].some(o => o.value === currentVal)) sel.value = currentVal;
  else sel.value = '__total__';
}

function getSnapTime(s) {
  return new Date(s.timestamp || (s.date + 'T12:00:00')).getTime();
}

// ── UNA MEDICIÓN, VISTA DESDE LA CARTERA ELEGIDA ────────────────────────────
// Devuelve {total, byCategory, byAsset} de la cartera activa para ese momento.
//
// Desde que existen varias carteras el robot guarda `porCartera` y esto es una
// simple búsqueda. Para las mediciones anteriores no hay tal cosa, pero sí está
// `byAsset` con el valor de cada activo — así que el pasado se puede reconstruir
// sumando los activos que hoy están en esta cartera. Por eso el gráfico no
// arranca en blanco al separar la cartera en dos.
//
// Contrapartida honesta: la reconstrucción usa el reparto de HOY. Si mañana
// movés un activo de una cartera a la otra, su pasado se muda con él.
function vistaSnapshot(s) {
  if (carteraActiva === TODAS) return s;
  const pc = s.porCartera && s.porCartera[carteraActiva];
  if (pc) return pc;
  const c = carteraPorId(carteraActiva);
  if (!c || !s.byAsset) return { total: 0, byCategory: {}, byAsset: {} };
  const byAsset = {}, byCategory = { crypto: 0, stock: 0, metal: 0 };
  let total = 0;
  c.assets.forEach(a => {
    const v = s.byAsset[a.ticker];
    if (v == null) return;
    // Si el mismo ticker está en las dos carteras, la medición vieja guarda el
    // valor sumado. Se reparte según cuánto tiene cada una hoy, en vez de darle
    // el total a las dos y contar la misma plata dos veces.
    const qtyTotal = carteras.reduce((acc, c2) =>
      acc + c2.assets.reduce((a2, x) => a2 + (x.ticker === a.ticker ? x.qty : 0), 0), 0);
    const parte = qtyTotal > 0 ? v * (a.qty / qtyTotal) : v;
    byAsset[a.ticker] = (byAsset[a.ticker] || 0) + parte;
    if (byCategory[a.cat] != null) byCategory[a.cat] += parte;
    total += parte;
  });
  // Un activo que aparece en la medición vieja pero hoy no está en ninguna
  // cartera (lo vendiste, o lo borraste) no pertenece a nadie y se perdería:
  // las carteras sumadas darían menos que el total de aquel momento y parecería
  // un error de la app. Se le atribuye a la primera cartera, que es de donde
  // salió cuando había una sola. No se suma a ninguna categoría porque ya no
  // hay forma de saber cuál era.
  if (carteras[0] && carteras[0].id === carteraActiva) {
    const reclamados = new Set(carteras.flatMap(c2 => c2.assets.map(a => a.ticker)));
    Object.entries(s.byAsset).forEach(([tk, v]) => {
      if (reclamados.has(tk)) return;
      byAsset[tk] = (byAsset[tk] || 0) + v;
      total += v;
    });
  }
  return { total, byCategory, byAsset };
}

// Cuántos puntos queremos ver en pantalla, sin importar cuánta historia haya.
// Con este número la curva se ve fluida en un celular sin volverse un borrón.
const HIST_PUNTOS_OBJETIVO = 140;

// Achica la serie a ~HIST_PUNTOS_OBJETIVO repartiendo los puntos parejo EN EL
// TIEMPO: parte el rango en tantas franjas como puntos queremos y se queda con
// la última medición de cada franja.
//
// Antes esto era un corte de golpe ("hasta 150 puntos mostralos todos, pasado
// eso una sola medición por día"), y al cruzar ese número el gráfico se
// desplomaba de 150 puntos a 14 de un snapshot al siguiente. Repartiendo por
// franjas la cantidad dibujada se queda siempre cerca del objetivo y el detalle
// se va soltando de a poco, sin saltos visibles.
//
// Repartir por tiempo y no cada N mediciones también corrige la distancia
// horizontal: el robot no guarda siempre la misma cantidad por día (hubo días
// de 6 y días de 17), y como el eje ubica los puntos en fila pareja, tomar una
// de cada N haría que los días con más mediciones ocuparan más ancho que los
// otros.
function compactarHist(snaps, objetivo) {
  if (snaps.length <= objetivo) return snaps;
  const t0 = getSnapTime(snaps[0]);
  const rango = getSnapTime(snaps[snaps.length - 1]) - t0;
  if (!(rango > 0)) return snaps; // todo en el mismo instante: no hay nada que repartir
  const ancho = rango / objetivo;
  const porFranja = new Map();
  snaps.forEach(s => {
    // La última medición cae justo en el borde; se la manda a la franja final
    // para no crear una franja extra con un solo punto.
    const i = Math.min(objetivo - 1, Math.floor((getSnapTime(s) - t0) / ancho));
    porFranja.set(i, s); // vienen ordenadas: la última de cada franja pisa y gana
  });
  const salida = [...porFranja.keys()].sort((a, b) => a - b).map(i => porFranja.get(i));
  // De cada franja queda la última medición, así que la primera franja arrancaba
  // un rato después del comienzo real y el gráfico empezaba más tarde de lo que
  // debía. Se agrega el arranque real adelante en vez de reemplazar al de su
  // franja: pisarlo dejaba un hueco del doble de ancho en el primer tramo.
  if (salida[0] !== snaps[0]) salida.unshift(snaps[0]);
  return salida;
}

// El robot mide una vez por hora. Si la última medición quedó vieja, algo se
// rompió (token vencido, API caída, Actions apagado) y hasta ahora eso no daba
// ninguna señal: el gráfico simplemente dejaba de crecer y había que darse
// cuenta mirando. Se avisa recién a las 6 horas para no alarmar por una corrida
// demorada o un rato sin internet.
const HORAS_PARA_AVISAR = 6;

function avisarSiElRobotSeColgo() {
  const aviso = $('hist-stale-msg');
  if (!aviso) return;
  const todas = (histData && histData.snapshots) || [];
  if (!todas.length) { aviso.style.display = 'none'; return; }
  const ultima = Math.max(...todas.map(getSnapTime));
  const horas = (Date.now() - ultima) / 3600000;
  if (horas < HORAS_PARA_AVISAR) { aviso.style.display = 'none'; return; }
  const cuando = horas < 48
    ? 'hace ' + Math.round(horas) + ' horas'
    : 'hace ' + Math.round(horas / 24) + ' días';
  aviso.textContent = '⚠ La última medición automática es de ' + cuando +
    '. El robot que guarda el historial puede estar caído, o el token de GitHub vencido.';
  aviso.style.display = '';
}

function setHistPeriod(days, btn) {
  histPeriodDays = days;
  document.querySelectorAll('#hist-period-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderHistChart();
}

function renderHistChart() {
  if (!histData) return;
  let snaps = [...(histData.snapshots || [])].sort((a, b) => getSnapTime(a) - getSnapTime(b));
  const isToday = histPeriodDays === 'today';

  if (isToday) {
    const cutoff24h = Date.now() - 24 * 3600000;
    snaps = snaps.filter(s => getSnapTime(s) >= cutoff24h);
  } else if (histPeriodDays > 0) {
    const cutoff = Date.now() - histPeriodDays * 86400000;
    snaps = snaps.filter(s => getSnapTime(s) >= cutoff);
  }
  snaps = compactarHist(snaps, HIST_PUNTOS_OBJETIVO);

  const emptyMsg = $('hist-empty-msg');
  if (!snaps.length) {
    if (emptyMsg) {
      emptyMsg.style.display = '';
      emptyMsg.textContent = histError
        ? 'No se pudo leer el historial (' + histError + '). Si configuraste un token, puede haber vencido: revisalo en Ajustes.'
        : 'Todavía no hay mediciones para este período.';
    }
    chartHist.data.labels = []; chartHist.data.datasets = []; chartHist.update();
    return;
  }
  if (emptyMsg) emptyMsg.style.display = 'none';
  avisarSiElRobotSeColgo();

  const seriesSel = $('hist-series') ? $('hist-series').value : '__total__';
  const vistas = snaps.map(vistaSnapshot);
  let label = carteraActiva === TODAS ? 'Todas las carteras' : nombreCarteraActiva(), values;
  if (seriesSel === '__total__') {
    values = vistas.map(v => v.total);
  } else if (seriesSel.startsWith('cat:')) {
    const cat = seriesSel.slice(4);
    label = ({ crypto: 'Crypto', stock: 'Acciones/ETFs', metal: 'Metales' }[cat] || cat) + ' · ' + label;
    values = vistas.map(v => (v.byCategory || {})[cat] || 0);
  } else if (seriesSel.startsWith('asset:')) {
    const tk = seriesSel.slice(6);
    label = tk;
    values = vistas.map(v => (v.byAsset || {})[tk] ?? null);
  }

  // Con puntos por hora, poner la fecha en cada marca del eje no sirve (se
  // repetiría "5 ago" siete veces): si todo entra en ~2 días se muestra la
  // hora, y si abarca más, la fecha.
  const spanDias = (getSnapTime(snaps[snaps.length - 1]) - getSnapTime(snaps[0])) / 86400000;
  const ejeConHora = isToday || spanDias <= 2;
  // Si quedó más de una medición del mismo día, el tooltip tiene que aclarar la
  // hora o se verían dos puntos con la misma fecha. Se mira lo que quedó después
  // de compactar, no cuánto había antes.
  const conHora = isToday || snaps.some((s, i) => i > 0 && s.date === snaps[i - 1].date);
  const hora = t => new Date(t).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
  const fecha = t => new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });

  chartHist.data.labels = snaps.map(s => {
    const t = getSnapTime(s);
    const f = new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
    return conHora ? `${f}, ${hora(t)}` : f;
  });
  histAxisLabels = snaps.map(s => (ejeConHora ? hora(getSnapTime(s)) : fecha(getSnapTime(s))));

  const accent = getCSSVar('--accent') || '#58a6ff';
  chartHist.data.datasets = [{
    label, data: values,
    borderColor: accent,
    backgroundColor: histGradiente,
    fill: true,
    borderWidth: 2,
    // Sin marcadores: con snapshots cada hora la línea se llenaba de puntitos.
    // El punto aparece sólo al pasar por encima (o al tocar, en el celular).
    pointRadius: snaps.length <= 2 ? 3 : 0,
    pointHoverRadius: 5,
    pointHoverBackgroundColor: accent,
    pointHoverBorderColor: getCSSVar('--surface') || '#fff',
    pointHoverBorderWidth: 2,
    // 'monotone' suaviza sin inventar picos que no están en los datos, que es
    // lo que hacía el tension normal en series de precios.
    cubicInterpolationMode: 'monotone',
    spanGaps: true
  }];
  chartHist.update();
}

// Enganchar el gráfico nuevo al refresco de colores que ya hace toggleTheme()
// para los otros dos charts (sin tocar esa función original).
(function () {
  // Se engancha a refrescarColoresDeGraficos() y no a toggleTheme(): el tema
  // ahora también puede cambiar solo, cuando el sistema pasa a modo noche y el
  // usuario nunca eligió a mano. Colgado del botón, en ese caso el histórico se
  // quedaba con los colores del tema anterior.
  const _refrescar = refrescarColoresDeGraficos;
  refrescarColoresDeGraficos = function (...args) {
    const r = _refrescar(...args);
    setTimeout(() => {
      const opts = cDef();
      chartHist.options.plugins.tooltip = opts.plugins.tooltip;
      chartHist.options.scales.x.ticks.color = opts.scales.x.ticks.color;
      chartHist.options.scales.x.border.color = opts.scales.x.border.color;
      chartHist.options.scales.y.ticks.color = opts.scales.y.ticks.color;
      chartHist.options.scales.y.border.color = opts.scales.y.border.color;
      chartHist.data.datasets.forEach(ds => {
        ds.borderColor = getCSSVar('--accent');
        ds.pointHoverBackgroundColor = getCSSVar('--accent');
        ds.pointHoverBorderColor = getCSSVar('--surface');
        // backgroundColor es la función del degradado: se repinta sola con el
        // color nuevo en el próximo draw, no hay que tocarla acá.
      });
      chartHist.update();
    }, 60);
    return r;
  };
})();

// ── CONTENIDO EXTRA EN LAS SUB-PESTAÑAS DE PROYECCIÓN (antes vacías) ────────
function renderProyStats() {
  if (!LC.rA) return;
  const totalAportado = LC.ci + LC.rA.reduce((s, r) => s + r.aa, 0);
  const interesGenerado = LC.cR - totalAportado;
  const anosCubiertos = LC.eAg ? Math.max(0, LC.eAg - LC.er) : LC.ev - LC.er;
  if ($('proy-stat-aportado')) $('proy-stat-aportado').textContent = fmt(totalAportado);
  if ($('proy-stat-interes')) $('proy-stat-interes').textContent = fmt(interesGenerado);
  if ($('proy-stat-interes-pct')) $('proy-stat-interes-pct').textContent = LC.cR > 0 ? fmtPct(interesGenerado / LC.cR) + ' de tu capital final' : '';
  if ($('proy-stat-anos')) $('proy-stat-anos').textContent = (LC.eAg ? anosCubiertos : anosCubiertos + '+') + ' años';
}

function calcAccumAt(rate) {
  let c = LC.ci, a = LC.ai;
  for (let i = 0; i < LC.nA; i++) { const aA = a * 12; c = c + aA + (c + aA / 2) * rate; a *= (1 + LC.ca); }
  return c;
}
function renderEscStats() {
  if (LC.ret == null) return;
  if ($('esc-stat-pesimista')) $('esc-stat-pesimista').textContent = fmt(calcAccumAt(0.06));
  if ($('esc-stat-base')) $('esc-stat-base').textContent = fmt(calcAccumAt(LC.ret));
  if ($('esc-stat-optimista')) $('esc-stat-optimista').textContent = fmt(calcAccumAt(0.12));
}

function highlightSensCell() {
  const ahs = [200, 300, 500, 700, 1000, 1500, 2000, 3000];
  const rets = [0.05, 0.06, 0.07, 0.08, 0.09, 0.10, 0.12, 0.15];
  let rowIdx = 0, minRowDiff = Infinity;
  ahs.forEach((v, i) => { const d = Math.abs(v - LC.ai); if (d < minRowDiff) { minRowDiff = d; rowIdx = i; } });
  let colIdx = 0, minColDiff = Infinity;
  rets.forEach((v, i) => { const d = Math.abs(v - LC.ret); if (d < minColDiff) { minColDiff = d; colIdx = i; } });
  const table = document.querySelector('#sens-table-wrap table');
  if (!table) return;
  table.querySelectorAll('.sens-current').forEach(elx => elx.classList.remove('sens-current'));
  const row = table.querySelectorAll('tbody tr')[rowIdx];
  if (row) {
    const cell = row.querySelectorAll('td')[colIdx + 1]; // +1: la primera celda de la fila es la etiqueta "$ahorro"
    if (cell) cell.classList.add('sens-current');
  }
}

function calcCapitalAtRetAge(offsetYears) {
  const nA2 = Math.max(1, (LC.er + offsetYears) - LC.ea);
  let c = LC.ci, a = LC.ai;
  for (let i = 0; i < nA2; i++) { const aA = a * 12; c = c + aA + (c + aA / 2) * LC.ret; a *= (1 + LC.ca); }
  return c;
}
function calcCapitalCustom(ahorroMensual, edadRetiro) {
  const n = Math.max(1, edadRetiro - LC.ea);
  let c = LC.ci, a = ahorroMensual;
  for (let i = 0; i < n; i++) { const aA = a * 12; c = c + aA + (c + aA / 2) * LC.ret; a *= (1 + LC.ca); }
  return c;
}
// "¿Y si...?" interactivo: el usuario mueve estos controles sin tocar su
// configuración real (LC no se modifica). whatifEdadTouched evita que
// recalc() le pise la edad elegida mientras está explorando escenarios.
let whatifEdadTouched = false;
function renderInvWhatIf() {
  if (LC.ret == null) return;
  const extraEl = $('whatif-extra'), edadEl = $('whatif-edad');
  if (!extraEl || !edadEl) return;
  if (!whatifEdadTouched) { edadEl.min = LC.ea + 1; edadEl.value = LC.er; }
  const extra = +extraEl.value, edad = +edadEl.value;

  $('v-whatif-extra').textContent = (extra > 0 ? '+' : '') + fmt(extra) + '/mes';
  $('v-whatif-edad').textContent = edad + ' años';

  const capital = calcCapitalCustom(LC.ai + extra, edad);
  const cubre = capital >= LC.meta;
  const deltaEdad = edad - LC.er;

  const capEl = $('whatif-capital');
  capEl.textContent = fmt(capital);
  capEl.className = 'ckpi-val ' + (cubre ? 'green' : 'red');

  let msg = cubre
    ? `✅ Cubre tu meta de ${fmt(LC.meta)} (sobran ${fmt(capital - LC.meta)}).`
    : `⚠️ Faltarían ${fmt(LC.meta - capital)} para tu meta de ${fmt(LC.meta)}.`;
  if (deltaEdad !== 0) {
    msg += ` Es ${Math.abs(deltaEdad)} año${Math.abs(deltaEdad) === 1 ? '' : 's'} ${deltaEdad < 0 ? 'antes' : 'después'} que tu plan actual (${LC.er} años).`;
  }
  $('whatif-msg').innerHTML = msg;
}

// Enganchar todo esto a las funciones originales, sin tocarlas.
(function () {
  const _recalc = recalc, _renderEsc = renderEsc, _renderSens = renderSens, _renderInv = renderInv;
  recalc = function (...args) { const r = _recalc(...args); renderProyStats(); return r; };
  renderEsc = function (...args) { const r = _renderEsc(...args); renderEscStats(); return r; };
  renderSens = function (...args) { const r = _renderSens(...args); highlightSensCell(); return r; };
  renderInv = function (...args) { const r = _renderInv(...args); renderInvWhatIf(); return r; };
})();
// el recalc() inicial de la página ya corrió antes de instalar este parche
// (este script corre después), así que disparamos una vez a mano para no
// dejar las estadísticas nuevas vacías hasta el próximo cambio de slider.
renderProyStats();

