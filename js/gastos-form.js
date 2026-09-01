// ── FORMULARIO DE GASTO COLAPSABLE ───────────────────────────────────────────
// Por defecto el formulario para cargar un gasto está colapsado (sólo un botón),
// para dar lugar a ver arriba los números del mes. Se despliega al tocarlo.
// Aditivo: sólo alterna una clase; no toca addGasto ni la carga.

function toggleGastoForm() {
  const form = document.getElementById('gasto-form');
  const btn = document.getElementById('gasto-form-toggle');
  if (!form) return;
  const abierto = form.classList.toggle('abierto');
  if (btn) btn.setAttribute('aria-expanded', abierto ? 'true' : 'false');
  // Al abrir, si la fecha está vacía la dejo en hoy, para cargar más rápido.
  if (abierto) {
    const f = document.getElementById('gasto-fecha');
    if (f && !f.value) {
      const d = new Date();
      f.value = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    }
  }
}
