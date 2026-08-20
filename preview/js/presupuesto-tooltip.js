// Tooltip táctil de la barra de distribución del ingreso. Es lo único que se
// rescata del segundo bloque de Presupuesto: el resto (modo oscuro, deslizar
// con el dedo, vibración, arrastrar el panel) ya existe en la otra mitad.
// ── TOOLTIP TÁCTIL EN LA BARRA DE DISTRIBUCIÓN (el CSS ya cubre el :hover de mouse) ──
const distBarEl = $('dist-bar');
if (distBarEl) {
  distBarEl.addEventListener('click', (e) => {
    const seg = e.target.closest('.dist-seg');
    document.querySelectorAll('.dist-seg.tt-active').forEach(s => { if (s !== seg) s.classList.remove('tt-active'); });
    if (seg) seg.classList.toggle('tt-active');
  });
  // cierra el tooltip si se toca en cualquier otro lugar de la pantalla
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dist-seg')) {
      document.querySelectorAll('.dist-seg.tt-active').forEach(s => s.classList.remove('tt-active'));
    }
  });
}

