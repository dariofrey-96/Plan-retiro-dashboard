// ── FILTRO POR CATEGORÍA EN LA LISTA DE GASTOS DEL MES ───────────────────────
// Deja ver de un vistazo todos los gastos de un rubro del mes, sin buscarlos uno
// por uno. El filtro sólo afecta a la TABLA de gastos; los totales/KPIs del mes y
// la comparación presupuestado-vs-real siguen mostrando el mes completo.
// Aditivo: la lógica vive acá; renderGastos (presupuesto.js) sólo lo consulta.

let gastoFiltroCat = 'todas';

function gastoFiltroActivo() { return gastoFiltroCat; }

function cambiarFiltroGasto(v) {
  gastoFiltroCat = v || 'todas';
  if (typeof renderGastos === 'function') renderGastos();
}

// Arma el desplegable con las categorías presentes en el mes (con su total y
// cantidad), y muestra el subtotal del filtro elegido. Se esconde si hay menos de
// 2 rubros (ahí no hay nada que filtrar). Si el rubro elegido no está en el mes
// que estás mirando, vuelve solo a "Todas".
function renderFiltroGastos(list) {
  const wrap = document.getElementById('gasto-filtro-wrap');
  const sel = document.getElementById('gasto-filtro-cat');
  const info = document.getElementById('gasto-filtro-info');
  if (!wrap || !sel) return;

  const porCat = {};
  (list || []).forEach(g => {
    if (!porCat[g.cat]) porCat[g.cat] = { total: 0, n: 0 };
    porCat[g.cat].total += g.monto;
    porCat[g.cat].n++;
  });
  const rubros = Object.keys(porCat).sort((a, b) => porCat[b].total - porCat[a].total);

  if (rubros.length < 2) {          // 0 o 1 rubro: no hay nada que filtrar
    gastoFiltroCat = 'todas';
    wrap.style.display = 'none';
    if (info) info.textContent = '';
    return;
  }
  wrap.style.display = 'flex';

  // Si el rubro elegido ya no está en el mes visible, volver a "Todas".
  if (gastoFiltroCat !== 'todas' && !porCat[gastoFiltroCat]) gastoFiltroCat = 'todas';

  const AR = (typeof fmtARS === 'function') ? fmtARS : (n => '$' + Math.round(n));
  const L = id => (typeof catLabel === 'function') ? catLabel(id) : id;
  const totalMes = rubros.reduce((s, id) => s + porCat[id].total, 0);
  const nMes = rubros.reduce((s, id) => s + porCat[id].n, 0);

  sel.innerHTML =
    `<option value="todas"${gastoFiltroCat === 'todas' ? ' selected' : ''}>Todas las categorías · ${AR(totalMes)} (${nMes})</option>` +
    rubros.map(id => `<option value="${id}"${gastoFiltroCat === id ? ' selected' : ''}>${L(id)} · ${AR(porCat[id].total)} (${porCat[id].n})</option>`).join('');

  if (info) {
    if (gastoFiltroCat !== 'todas' && porCat[gastoFiltroCat]) {
      const c = porCat[gastoFiltroCat];
      info.textContent = c.n + (c.n === 1 ? ' gasto' : ' gastos') + ' · ' + AR(c.total);
    } else info.textContent = '';
  }
}
