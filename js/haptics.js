// ── HAPTICS (vibración táctil al tocar parámetros) ──────────────────────────
// Android/Chrome: usa la Vibration API estándar (navigator.vibrate) — anda
// perfecto tanto en los botones +/- como arrastrando los sliders.
//
// iOS Safari: no existe una API estándar de vibración. Hasta iOS 26.4 se podía
// "engañar" con un checkbox tipo switch disparado por código; Apple lo cerró
// en iOS 26.5. Lo que SÍ sigue funcionando ahí: si el dedo toca DIRECTAMENTE
// un <input type="checkbox" switch> real, el sistema igual hace sonar el
// motor táctil. Por eso los botones +/- ahora tienen ese switch real,
// invisible, puesto exactamente encima del botón visible — así el toque
// del usuario cae sobre el control nativo de verdad, no sobre una simulación.
// Resultado: los botones +/- vibran en iOS incluso en las versiones nuevas.
// El arrastre de los sliders NO tiene forma conocida de hacerlo (no hay
// manera de "enganchar" un switch nativo a un gesto de drag continuo) —
// esa limitación es real y no tiene workaround en web hoy.
let _lastHaptic = 0;
function hapticTick() {
  const now = Date.now();
  if (now - _lastHaptic < 35) return; // throttle para no saturar durante un drag rápido
  _lastHaptic = now;
  try {
    if (navigator.vibrate) { navigator.vibrate(8); return; }
  } catch (e) {}
}

// Sliders: listener adicional (no reemplaza el que ya actualiza el valor y
// recalcula), best-effort — funciona en Android; en iOS no hay garantía.
['edadActual','edadRetiro','vidaEsperada','gastoMensual','inflacion','swr',
 'capitalInicial','ahorroMensual','crecAhorro','retorno','alquiler',
 'dividendos','consultoria','alertaCaida'].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('input', hapticTick);
});

// Botones +/-: el 'change' del switch real (tocado directamente por el
// usuario) dispara la vibración nativa en iOS, y acá reusamos exactamente
// la misma función adjustSlider() ya existente para aplicar el cambio.
document.addEventListener('change', (e) => {
  if (e.target.matches && e.target.matches('.pm-switch')) {
    const id = e.target.dataset.target;
    const delta = parseFloat(e.target.dataset.delta);
    hapticTick(); // fallback extra por si el switch no sonó (p.ej. Android)
    adjustSlider(id, delta);
  }
});
