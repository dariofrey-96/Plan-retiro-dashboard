// ── PARÁMETROS DE GASTOS: botones + / −, renombrar y agregar categorías ──────
// Aditivo. Al cargar, el panel de presupuesto recibe:
//   • los mismos botones − / + que el panel de retiro (con su vibración, vía el
//     switch nativo de iOS; ver haptics.js, que rutea por data-presu),
//   • un lápiz para renombrar cada categoría,
//   • un grupo "Categorías personalizadas" con las que agregás vos, cada una con
//     su slider, botones, renombrar y tacho para borrar, más un botón "+ Agregar".
//
// Los nombres nuevos y las categorías nuevas se guardan por dispositivo. Las
// categorías custom se inyectan en GASTO_CATS y PV_CAT_IDS al cargar, así el
// resto de la app (getPresupuestoCat, dropdown, resumen, alertas, inicio) las
// toma sin cambios: getPresupuestoCat(id) lee el valor del slider por id.

// ══════════════ Nombres personalizados (renombrar) ══════════════
function guardarNombresCat(obj) {
  try { localStorage.setItem('finlab_cat_nombres', JSON.stringify(obj)); } catch (e) {}
}

function renombrarCat(id) {
  const actual = (typeof catLabel === 'function') ? catLabel(id) : id;
  const nuevo = prompt('Nombre de la categoría:', actual);
  if (nuevo === null) return;
  const limpio = nuevo.replace(/[<>]/g, '').trim().slice(0, 40);
  const store = (typeof catNombresCustom === 'function') ? catNombresCustom() : {};
  const def = (typeof GASTO_CATS !== 'undefined' ? (GASTO_CATS.find(c => c.id === id) || {}).label : '') || '';
  if (!limpio || limpio === def) delete store[id];
  else store[id] = limpio;
  guardarNombresCat(store);
  aplicarNombresCategorias();
  refrescarApp();
}

// El <label> de una categoría: fila simple o la que está detrás de un toggle.
function labelDeCategoria(id) {
  const sub = document.getElementById('row-' + id);
  if (sub) {
    const tf = sub.previousElementSibling;
    if (tf && tf.classList.contains('toggle-field')) return tf.querySelector('label');
  }
  const inp = document.getElementById(id);
  const field = inp && inp.closest('.field');
  return field ? field.querySelector('label') : null;
}

function aplicarNombresCategorias() {
  if (typeof PV_CAT_IDS === 'undefined') return;
  PV_CAT_IDS.forEach(id => {
    const lab = labelDeCategoria(id);
    const span = lab && lab.querySelector('.cat-nombre');
    if (span) span.textContent = (typeof catLabel === 'function') ? catLabel(id) : id;
  });
}

function refrescarApp() {
  ['initGastoCatSelect', 'renderGastos', 'renderResumen', 'renderInicio'].forEach(fn => {
    if (typeof window[fn] === 'function') { try { window[fn](); } catch (e) {} }
  });
}

// ══════════════ Botones + / − de los sliders de presupuesto ══════════════
function adjustSliderPresu(id, delta) {
  const e = document.getElementById(id);
  if (!e) return;
  let v = parseFloat(e.value) + delta;
  const min = parseFloat(e.min), max = parseFloat(e.max);
  if (!isNaN(min)) v = Math.max(min, v);
  if (!isNaN(max)) v = Math.min(max, v);
  const step = parseFloat(e.step);
  if (step > 0) v = Math.round(v / step) * step;
  e.value = v;
  e.dispatchEvent(new Event('input', { bubbles: true }));
}

// ══════════════ Categorías personalizadas (agregar / borrar) ══════════════
const LS_CATS_CUSTOM = 'finlab_cat_custom';
function catsCustom() { try { return JSON.parse(localStorage.getItem(LS_CATS_CUSTOM) || '[]'); } catch (e) { return []; } }
function guardarCatsCustom(arr) { try { localStorage.setItem(LS_CATS_CUSTOM, JSON.stringify(arr)); } catch (e) {} }

// Suma las categorías custom a las listas madre (una sola vez cada una).
function mergeCatsCustom() {
  catsCustom().forEach(c => {
    if (typeof GASTO_CATS !== 'undefined' && !GASTO_CATS.some(x => x.id === c.id)) {
      const iOtro = GASTO_CATS.findIndex(x => x.id === 'otro');
      GASTO_CATS.splice(iOtro >= 0 ? iOtro : GASTO_CATS.length, 0, { id: c.id, label: c.label });
    }
    if (typeof PV_CAT_IDS !== 'undefined' && !PV_CAT_IDS.includes(c.id)) PV_CAT_IDS.push(c.id);
  });
}

function bindCustomSlider(id) {
  const el = document.getElementById(id), v = document.getElementById('v-' + id);
  if (!el) return;
  const fmt = (typeof fmtARS === 'function') ? fmtARS : (n => '$' + Math.round(n));
  const upd = () => {
    if (v) v.textContent = fmt(parseFloat(el.value) || 0);
    const arr = catsCustom(); const c = arr.find(x => x.id === id);
    if (c) { c.budget = parseFloat(el.value) || 0; guardarCatsCustom(arr); }
    if (typeof repintar === 'function') { try { repintar(); } catch (e) {} }
  };
  el.addEventListener('input', upd);
  if (v) v.textContent = fmt(parseFloat(el.value) || 0);
}

function filaCustomHTML(c) {
  const nombre = (typeof catLabel === 'function') ? catLabel(c.id) : c.label;
  const b = c.budget || 0;
  const max = Math.max(5000000, Math.ceil((b * 1.5) / 10000) * 10000);
  const estiloBtn = 'background:none;border:none;cursor:pointer;font-size:.82rem;padding:2px 4px;line-height:1;vertical-align:middle;';
  return '<div class="field" data-custom="' + c.id + '">' +
    '<label data-ren-done="1"><span class="cat-nombre">' + nombre + '</span>' +
    '<button type="button" class="cat-edit-btn" title="Renombrar" style="' + estiloBtn + 'color:var(--accent);margin-left:6px;" onclick="renombrarCat(\'' + c.id + '\')">✏️</button>' +
    '<button type="button" class="cat-del-btn" title="Eliminar" style="' + estiloBtn + 'color:var(--red);" onclick="eliminarCategoria(\'' + c.id + '\')">🗑️</button>' +
    '</label>' +
    '<div class="field-row">' +
    '<input type="range" id="' + c.id + '" min="0" max="' + max + '" step="10000" value="' + b + '">' +
    '<span class="val" id="v-' + c.id + '"></span>' +
    '</div></div>';
}

function renderCustomCatRows() {
  const cont = document.getElementById('custom-cats-list');
  if (!cont) return;
  const arr = catsCustom();
  cont.innerHTML = arr.length ? arr.map(filaCustomHTML).join('')
    : '<div class="field-hint" style="margin:2px 0 8px 0;">Todavía no agregaste categorías propias.</div>';
  arr.forEach(c => bindCustomSlider(c.id));
  inyectarSteppersPanel();   // los sliders nuevos necesitan sus botones − / +
  if (typeof actualizarTotalPresupuesto === 'function') actualizarTotalPresupuesto();
}

function agregarCategoria() {
  const nombre = prompt('Nombre de la categoría nueva:');
  if (nombre === null) return;
  const limpio = nombre.replace(/[<>]/g, '').trim().slice(0, 40);
  if (!limpio) return;
  const arr = catsCustom();
  const id = 'cst_' + Date.now().toString(36);
  arr.push({ id, label: limpio, budget: 0 });
  guardarCatsCustom(arr);
  if (typeof GASTO_CATS !== 'undefined' && !GASTO_CATS.some(x => x.id === id)) {
    const iOtro = GASTO_CATS.findIndex(x => x.id === 'otro');
    GASTO_CATS.splice(iOtro >= 0 ? iOtro : GASTO_CATS.length, 0, { id, label: limpio });
  }
  if (typeof PV_CAT_IDS !== 'undefined' && !PV_CAT_IDS.includes(id)) PV_CAT_IDS.push(id);
  renderCustomCatRows();
  refrescarApp();
}

function eliminarCategoria(id) {
  const c = catsCustom().find(x => x.id === id);
  const nombre = c ? ((typeof catLabel === 'function') ? catLabel(id) : c.label) : id;
  if (!confirm('¿Eliminar la categoría "' + nombre + '"?\n\nLos gastos que ya cargaste en ella no se borran, pero quedan sin una categoría propia.')) return;
  guardarCatsCustom(catsCustom().filter(x => x.id !== id));
  if (typeof GASTO_CATS !== 'undefined') { const i = GASTO_CATS.findIndex(x => x.id === id); if (i >= 0) GASTO_CATS.splice(i, 1); }
  if (typeof PV_CAT_IDS !== 'undefined') { const i = PV_CAT_IDS.indexOf(id); if (i >= 0) PV_CAT_IDS.splice(i, 1); }
  if (typeof catNombresCustom === 'function') { const n = catNombresCustom(); if (id in n) { delete n[id]; guardarNombresCat(n); } }
  renderCustomCatRows();
  refrescarApp();
}

// ══════════════ Total presupuestado (con desglose) ══════════════
// Suma en vivo lo presupuestado para gastos = todas las categorías ACTIVADAS
// (las apagadas dan 0). Sirve para ver el total sin sumar a mano y para
// encontrar de dónde sale cada peso (desglose).
function actualizarTotalPresupuesto() {
  if (typeof PV_CAT_IDS === 'undefined' || typeof getPresupuestoCat !== 'function') return;
  // Número exacto (sin abreviar a K/M) para poder comparar montos al peso.
  const fmt = n => '$' + Math.round(n || 0).toLocaleString('es-AR');
  let total = 0; const filas = [];
  PV_CAT_IDS.forEach(id => { const v = getPresupuestoCat(id) || 0; if (v > 0) { total += v; filas.push([id, v]); } });

  const valEl = document.getElementById('presu-total-val');
  if (valEl) valEl.textContent = fmt(total);

  const sub = document.getElementById('presu-total-sub');
  if (sub) {
    const salEl = document.getElementById('salario');
    const sal = salEl ? (parseFloat(salEl.value) || 0) : 0;
    sub.textContent = sal > 0
      ? 'Es el ' + Math.round(total / sal * 100) + '% de tu ingreso (' + fmt(sal) + ')'
      : filas.length + ' categoría' + (filas.length === 1 ? '' : 's') + ' activa' + (filas.length === 1 ? '' : 's');
  }

  const bd = document.getElementById('presu-total-breakdown');
  if (bd && bd.style.display !== 'none') {
    filas.sort((a, b) => b[1] - a[1]);
    bd.innerHTML = filas.map(([id, v]) =>
      '<div style="display:flex;justify-content:space-between;gap:10px;font-size:.76rem;padding:4px 0;border-bottom:1px dashed var(--border);">' +
      '<span>' + ((typeof catLabel === 'function') ? catLabel(id) : id) + '</span>' +
      '<span style="font-weight:600;white-space:nowrap;">' + fmt(v) + '</span></div>').join('') +
      '<div style="display:flex;justify-content:space-between;font-size:.82rem;padding:7px 0 0;font-weight:800;"><span>Total</span><span>' + fmt(total) + '</span></div>';
  }
}

function togglePresuBreakdown() {
  const bd = document.getElementById('presu-total-breakdown');
  const car = document.getElementById('presu-total-caret');
  if (!bd) return;
  const abrir = bd.style.display === 'none';
  bd.style.display = abrir ? '' : 'none';
  if (car) car.textContent = abrir ? '▴' : '▾';
  actualizarTotalPresupuesto();
}

// ══════════════ Inyección de botones y lápices en el panel ══════════════
let _pmSeq = 0;
function inyectarSteppersPanel() {
  const panel = document.getElementById('aside-presu');
  if (!panel) return;
  panel.querySelectorAll('input[type="range"]').forEach(rango => {
    const id = rango.id;
    if (!id || rango.dataset.pmDone) return;
    rango.dataset.pmDone = '1';
    const row = rango.parentElement;
    if (!row) return;
    let step = parseFloat(rango.step); if (!(step > 0)) step = 1;
    const mkWrap = (signo, delta) => {
      const wrap = document.createElement('span');
      wrap.className = 'pm-wrap';
      const swId = 'pm-presu-' + id + '-' + (++_pmSeq);
      wrap.innerHTML =
        '<button class="pm-btn" tabindex="-1" aria-hidden="true">' + signo + '</button>' +
        '<label class="pm-switch-label" for="' + swId + '">' +
        '<input type="checkbox" switch class="pm-switch" id="' + swId +
        '" data-target="' + id + '" data-delta="' + delta + '" data-presu="1"></label>';
      return wrap;
    };
    row.insertBefore(mkWrap('−', -step), rango);
    rango.insertAdjacentElement('afterend', mkWrap('+', step));
  });
}

function inyectarPencilsBuiltin() {
  if (typeof PV_CAT_IDS === 'undefined') return;
  PV_CAT_IDS.forEach(id => {
    const lab = labelDeCategoria(id);
    if (!lab || lab.dataset.renDone) return;   // las custom ya traen su lápiz
    lab.dataset.renDone = '1';
    const nombre = (typeof catLabel === 'function') ? catLabel(id) : (lab.textContent || id).trim();
    lab.innerHTML =
      '<span class="cat-nombre">' + nombre + '</span>' +
      '<button type="button" class="cat-edit-btn" title="Renombrar categoría" ' +
      'style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:.82rem;padding:2px 4px;margin-left:6px;line-height:1;vertical-align:middle;" ' +
      'onclick="renombrarCat(\'' + id + '\')">✏️</button>';
  });
}

// ══════════════ Init ══════════════
(function () {
  const panel = document.getElementById('aside-presu');
  if (!panel) return;

  mergeCatsCustom();

  // Total presupuestado, fijo arriba del panel (después del título).
  if (!document.getElementById('presu-total-box')) {
    const fila = panel.querySelector('.sheet-title-row');
    const html =
      '<div id="presu-total-box" style="position:sticky;top:0;z-index:3;background:var(--surface);margin:0 -16px;padding:10px 16px;border-bottom:1px solid var(--border);">' +
      '<button type="button" onclick="togglePresuBreakdown()" style="width:100%;display:flex;justify-content:space-between;align-items:baseline;gap:10px;background:none;border:none;color:var(--text);cursor:pointer;padding:0;text-align:left;">' +
      '<span style="color:var(--muted);font-size:.82rem;">Total presupuestado <span id="presu-total-caret" style="font-size:.7rem;">▾</span></span>' +
      '<span id="presu-total-val" style="font-weight:800;font-size:1.1rem;white-space:nowrap;">$0</span></button>' +
      '<div id="presu-total-sub" style="font-size:.74rem;color:var(--muted);margin-top:2px;"></div>' +
      '<div id="presu-total-breakdown" style="display:none;margin-top:8px;"></div></div>';
    if (fila) fila.insertAdjacentHTML('afterend', html);
    else panel.insertAdjacentHTML('afterbegin', html);
    panel.addEventListener('input', actualizarTotalPresupuesto);
    panel.addEventListener('change', actualizarTotalPresupuesto);
  }

  if (!document.getElementById('pg-custom')) {
    panel.insertAdjacentHTML('beforeend',
      '<div class="param-group" id="pg-custom">' +
      '<div class="grp-label">Categorías personalizadas</div>' +
      '<div id="custom-cats-list"></div>' +
      '<button type="button" class="btn" style="width:100%;margin-top:10px;" onclick="agregarCategoria()">+ Agregar categoría</button>' +
      '</div>');
  }

  renderCustomCatRows();      // filas custom (incluye sus botones vía inyectarSteppersPanel)
  inyectarSteppersPanel();    // botones en los sliders fijos
  inyectarPencilsBuiltin();   // lápiz en las categorías fijas
  aplicarNombresCategorias();
  actualizarTotalPresupuesto();
  if (typeof initGastoCatSelect === 'function') { try { initGastoCatSelect(); } catch (e) {} }
})();
