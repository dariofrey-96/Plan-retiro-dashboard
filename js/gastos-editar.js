// ── CAMBIAR LA CATEGORÍA DE UN GASTO YA CARGADO ──────────────────────────────
// Para corregir un gasto (típicamente importado del resumen de la tarjeta) que
// quedó en la categoría equivocada, sin borrar y volver a cargar todo el resumen.
// Aditivo: no toca la carga ni la importación; sólo reasigna el `cat` del ítem
// (y de todas sus cuotas si es un pago repartido). Reusa loadGastosAll/saveGastosAll
// /GASTO_CATS/catLabel/mesVisible/renderGastos, que ya son globales.

let gastoCatEditId = null;

function editarGastoCat(id) {
  const all = (typeof loadGastosAll === 'function') ? loadGastosAll() : {};
  const g = (all[mesVisible] || []).find(x => x.id === id);
  if (!g) return;
  gastoCatEditId = id;

  const sel = document.getElementById('gasto-cat-nueva');
  sel.innerHTML = GASTO_CATS.map(c =>
    `<option value="${c.id}"${c.id === g.cat ? ' selected' : ''}>${catLabel(c.id)}</option>`).join('');

  const fechaTxt = new Date(g.fecha + 'T00:00:00').toLocaleDateString('es-AR');
  const nombre = (typeof esc === 'function') ? (esc(g.nota) || 'Gasto') : (g.nota || 'Gasto');
  document.getElementById('gasto-cat-info').innerHTML =
    '<b>' + nombre + '</b><br>' +
    fechaTxt + ' · ' + fmtARS(g.monto) + '<br>' +
    'Categoría actual: <span>' + catLabel(g.cat) + '</span>' +
    (g.grupo ? '<br><span style="color:var(--muted)">Es un pago en ' + g.cuotas + ' cuotas: se recategorizan todas.</span>' : '');

  document.getElementById('gasto-cat-modal').style.display = 'flex';
}

function cerrarGastoCatModal() {
  const m = document.getElementById('gasto-cat-modal');
  if (m) m.style.display = 'none';
  gastoCatEditId = null;
}

function guardarGastoCat() {
  if (gastoCatEditId == null) return;
  const nueva = document.getElementById('gasto-cat-nueva').value;
  if (!nueva) return;
  const all = loadGastosAll();
  const g = (all[mesVisible] || []).find(x => x.id === gastoCatEditId);
  if (!g) { cerrarGastoCatModal(); return; }

  if (g.grupo) {
    // Un pago repartido en cuotas es un solo gasto: se recategoriza entero, en
    // todos los meses donde tenga partes.
    Object.keys(all).forEach(k => (all[k] || []).forEach(x => { if (x.grupo === g.grupo) x.cat = nueva; }));
  } else {
    g.cat = nueva;
  }
  saveGastosAll(all);
  cerrarGastoCatModal();
  if (typeof renderGastos === 'function') renderGastos();
}

// Cerrar con Escape, como los demás modales.
document.addEventListener('keydown', e => {
  const m = document.getElementById('gasto-cat-modal');
  if (e.key === 'Escape' && m && m.style.display === 'flex') cerrarGastoCatModal();
});
