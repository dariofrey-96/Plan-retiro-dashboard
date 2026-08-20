// ── CARTERA EN USD O ARS (cotización blue automática) ───────────────────────
let carteraCurrency = 'USD';
let arsRate = null; // pesos por 1 USD (blue, venta)
const LS_CARTERA_CUR = 'planRetiro_cartera_currency';

function fmtC(usd) {
  if (carteraCurrency === 'ARS' && arsRate) return 'AR$' + Math.round(usd * arsRate).toLocaleString('es-AR');
  return fmt(usd);
}
function fmtPrice(usd) {
  if (carteraCurrency === 'ARS' && arsRate) return 'AR$' + Math.round(usd * arsRate).toLocaleString('es-AR');
  return '$' + usd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

async function fetchArsRate(retriesLeft) {
  if (retriesLeft == null) retriesLeft = 2;
  try {
    const res = await fetch('https://dolarapi.com/v1/dolares/blue');
    if (res.ok) { const d = await res.json(); if (d && d.venta) arsRate = d.venta; }
  } catch (e) { /* sin conexión a la API — se reintenta más abajo */ }
  updateArsRateHint();
  if (!arsRate && retriesLeft > 0) {
    setTimeout(() => fetchArsRate(retriesLeft - 1).then(() => renderCartera()), 4000);
  }
}
function updateArsRateHint() {
  const hint = $('ars-rate-hint');
  if (!hint) return;
  if (arsRate) hint.textContent = '1 USD = AR$' + Math.round(arsRate).toLocaleString('es-AR') + ' (blue)';
  else if (carteraCurrency === 'ARS') hint.textContent = 'Buscando cotización... (mientras tanto se muestra en USD)';
  else hint.textContent = '';
}

function setCarteraCurrency(cur, btn) {
  carteraCurrency = cur;
  document.querySelectorAll('.currency-toggle .toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.cur === cur));
  try { localStorage.setItem(LS_CARTERA_CUR, cur); } catch (e) {}
  updateArsRateHint();
  if (cur === 'ARS' && !arsRate) fetchArsRate().then(() => renderCartera());
  renderCartera();
}

(function () {
  try { const saved = localStorage.getItem(LS_CARTERA_CUR); if (saved === 'ARS') carteraCurrency = 'ARS'; } catch (e) {}
  document.querySelectorAll('.currency-toggle .toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.cur === carteraCurrency));
  fetchArsRate().then(() => renderCartera()); // la primera vez que carga, re-renderiza con formato correcto (fmtC recién queda disponible acá)
})();

