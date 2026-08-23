// ── PARÁMETROS DE GASTOS: botones + / − con vibración y renombrar categorías ──
// Aditivo. Al cargar, mete en el panel de presupuesto los mismos botones − y +
// que ya tiene el panel de retiro (con su misma vibración, vía el switch nativo
// de iOS), y un lápiz para renombrar cada categoría. Los nombres nuevos se
// guardan por dispositivo y los lee catLabel(), así aparecen en toda la app
// (lista de gastos, resumen, inicio, alertas y el desplegable al cargar gastos).
//
// No se toca la lógica original: los botones sólo cambian el valor del slider y
// disparan su evento 'input', que ya guarda y repinta. Ver haptics.js (ruteo del
// switch) y presupuesto.js (catLabel lee los nombres personalizados).

// Sube/baja el monto de un slider de presupuesto y reusa su guardado/repintado.
function adjustSliderPresu(id, delta) {
  const e = document.getElementById(id);
  if (!e) return;
  let v = parseFloat(e.value) + delta;
  const min = parseFloat(e.min), max = parseFloat(e.max);
  if (!isNaN(min)) v = Math.max(min, v);
  if (!isNaN(max)) v = Math.min(max, v);
  const step = parseFloat(e.step);
  if (step > 0) v = Math.round(v / step) * step;   // evita decimales raros al sumar floats
  e.value = v;
  e.dispatchEvent(new Event('input', { bubbles: true }));
}

function guardarNombresCat(obj) {
  try { localStorage.setItem('finlab_cat_nombres', JSON.stringify(obj)); } catch (e) {}
}

function renombrarCat(id) {
  const actual = (typeof catLabel === 'function') ? catLabel(id) : id;
  const nuevo = prompt('Nombre de la categoría:', actual);
  if (nuevo === null) return;                         // canceló
  const limpio = nuevo.replace(/[<>]/g, '').trim().slice(0, 40);
  const store = (typeof catNombresCustom === 'function') ? catNombresCustom() : {};
  const def = (typeof GASTO_CATS !== 'undefined' ? (GASTO_CATS.find(c => c.id === id) || {}).label : '') || '';
  if (!limpio || limpio === def) delete store[id];   // vacío o igual al original => vuelve al default
  else store[id] = limpio;
  guardarNombresCat(store);
  aplicarNombresCategorias();
  ['initGastoCatSelect', 'renderGastos', 'renderResumen', 'renderInicio'].forEach(fn => {
    if (typeof window[fn] === 'function') { try { window[fn](); } catch (e) {} }
  });
}

// El <label> humano de una categoría: fila simple, o la que está detrás de un
// toggle (ahí el nombre vive en el .toggle-field anterior al .sub-field).
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

(function () {
  const panel = document.getElementById('aside-presu');
  if (!panel) return;

  // 1) Botones − / + en cada slider del panel de gastos.
  let n = 0;
  panel.querySelectorAll('input[type="range"]').forEach(rango => {
    const id = rango.id;
    if (!id || rango.dataset.pmDone) return;
    rango.dataset.pmDone = '1';
    const row = rango.parentElement;                 // .field-row
    if (!row) return;
    let step = parseFloat(rango.step); if (!(step > 0)) step = 1;
    const mkWrap = (signo, delta) => {
      const wrap = document.createElement('span');
      wrap.className = 'pm-wrap';
      const swId = 'pm-presu-' + id + '-' + (++n);
      wrap.innerHTML =
        '<button class="pm-btn" tabindex="-1" aria-hidden="true">' + signo + '</button>' +
        '<label class="pm-switch-label" for="' + swId + '">' +
        '<input type="checkbox" switch class="pm-switch" id="' + swId +
        '" data-target="' + id + '" data-delta="' + delta + '" data-presu="1"></label>';
      return wrap;
    };
    row.insertBefore(mkWrap('−', -step), rango);   // − antes del slider
    rango.insertAdjacentElement('afterend', mkWrap('+', step)); // + después
  });

  // 2) Lápiz para renombrar en cada categoría.
  if (typeof PV_CAT_IDS !== 'undefined') {
    PV_CAT_IDS.forEach(id => {
      const lab = labelDeCategoria(id);
      if (!lab || lab.dataset.renDone) return;
      lab.dataset.renDone = '1';
      const nombre = (typeof catLabel === 'function') ? catLabel(id) : (lab.textContent || id).trim();
      lab.innerHTML =
        '<span class="cat-nombre">' + nombre + '</span>' +
        '<button type="button" class="cat-edit-btn" title="Renombrar categoría" ' +
        'style="background:none;border:none;color:var(--accent);cursor:pointer;font-size:.82rem;padding:2px 4px;margin-left:6px;line-height:1;vertical-align:middle;" ' +
        'onclick="renombrarCat(\'' + id + '\')">✏️</button>';
    });
  }

  aplicarNombresCategorias();
})();
