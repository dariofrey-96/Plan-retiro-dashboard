// ── AGREGAR UNA COMPRA A UN ACTIVO QUE YA TENÉS ──────────────────────────────
// Para no recargar ticker/nombre a mano cada vez que comprás más de algo que ya
// está en la cartera. Sólo pedís cuánto invertiste (USD) y a qué precio compraste;
// de ahí sale la cantidad y se recalcula el PRECIO PROMEDIO ponderado, igual que
// hace addAsset() cuando el activo ya existe. NO toca el precio de mercado actual
// (a.price): una compra no cambia el precio de hoy, sólo tu posición y tu promedio.
// Aditivo: vive aparte y sólo agrega un botón en la fila; no cambia la lógica vieja.

let buyingId = null;

function openBuyModal(id) {
  const a = assets.find(x => x.id == id);
  if (!a) return;
  buyingId = id;
  $('buy-info').innerHTML =
    '<b>' + a.name + ' (' + a.ticker + ')</b><br>' +
    'Cantidad actual: <span>' + a.qty.toLocaleString('es-AR', { maximumFractionDigits: 6 }) + '</span><br>' +
    'Precio de mercado: <span>$' + a.price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + '</span><br>' +
    'Precio promedio actual: <span>$' + (a.costBasis || a.price).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + '</span>';
  $('buy-amount').value = '';
  // Prefill del precio con el de mercado (suele comprarse cerca); es editable.
  $('buy-price').value = a.price ? Math.round(a.price * 1e6) / 1e6 : '';
  updateBuyPreview();
  $('buy-modal').style.display = 'flex';
  setTimeout(() => $('buy-amount').focus(), 100);
}

// Muestra en vivo qué va a pasar antes de confirmar: cuánta cantidad sumás y
// cuál queda el nuevo precio promedio.
function updateBuyPreview() {
  const a = assets.find(x => x.id == buyingId);
  const prev = $('buy-preview');
  if (!a || !prev) return;
  const amount = parseFloat($('buy-amount').value);
  const price = parseFloat($('buy-price').value);
  if (isNaN(amount) || amount <= 0 || isNaN(price) || price <= 0) {
    prev.innerHTML = '<span style="color:var(--muted)">Completá monto y precio para ver el resultado.</span>';
    return;
  }
  const qtyAdded = amount / price;
  const oldQty = a.qty, oldCost = a.costBasis || a.price;
  const newQty = oldQty + qtyAdded;
  const newCost = (oldQty * oldCost + qtyAdded * price) / newQty;
  prev.innerHTML =
    'Sumás: <span>' + qtyAdded.toLocaleString('es-AR', { maximumFractionDigits: 6 }) + ' ' + a.ticker + '</span><br>' +
    'Cantidad final: <span>' + newQty.toLocaleString('es-AR', { maximumFractionDigits: 6 }) + '</span><br>' +
    'Nuevo precio promedio: <span>$' + newCost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 6 }) + '</span>';
}

function closeBuyModal() { $('buy-modal').style.display = 'none'; buyingId = null; }

function confirmBuy() {
  const a = assets.find(x => x.id == buyingId);
  if (!a) return;
  const amount = parseFloat($('buy-amount').value);
  const price = parseFloat($('buy-price').value);
  if (isNaN(amount) || amount <= 0) { alert('Ingresá cuánto invertiste, en dólares.'); return; }
  if (isNaN(price) || price <= 0) { alert('Ingresá el precio al que compraste.'); return; }

  const qtyAdded = amount / price;
  const oldQty = a.qty, oldCost = a.costBasis || a.price;
  const newQty = oldQty + qtyAdded;
  a.costBasis = (oldQty * oldCost + qtyAdded * price) / newQty;  // promedio ponderado
  a.qty = newQty;
  // a.price (precio de mercado de hoy) NO se toca a propósito.
  if (!a.boughtDate) a.boughtDate = new Date().toISOString().slice(0, 10);

  saveAssets();
  renderCartera();
  if (typeof syncCarteraToGitHub === 'function') syncCarteraToGitHub();
  closeBuyModal();
}

// Recalcular el preview mientras escribís, y cerrar con Escape (como los otros).
if ($('buy-amount')) $('buy-amount').addEventListener('input', updateBuyPreview);
if ($('buy-price')) $('buy-price').addEventListener('input', updateBuyPreview);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('buy-modal') && $('buy-modal').style.display === 'flex') closeBuyModal(); });
