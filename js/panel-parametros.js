// ── ARRASTRAR PARA CERRAR EL PANEL DE PARÁMETROS (bottom sheet) ─────────────
// Se agarra del "handle" (la barrita gris) o del título — igual que en las
// apps nativas — para no pisar el scroll de la lista de parámetros. Arrastrar
// más de ~18% de la altura de pantalla, o soltar con velocidad, cierra el
// panel llamando a la función toggleSidebar() ya existente (no se toca).
(function () {
  const asideEl = document.getElementById('aside');
  const backdropEl = document.getElementById('sheet-backdrop');
  if (!asideEl) return;
  const dragZones = [asideEl.querySelector('.sheet-handle'), asideEl.querySelector('.sheet-title-row')].filter(Boolean);
  if (!dragZones.length) return;

  let dragging = false, startY = 0, currentY = 0, startTime = 0;

  function getY(e) { return e.touches ? e.touches[0].clientY : e.clientY; }

  function onStart(e) {
    if (!asideEl.classList.contains('open')) return;
    dragging = true;
    startY = currentY = getY(e);
    startTime = Date.now();
    asideEl.style.transition = 'none';
  }
  function onMove(e) {
    if (!dragging) return;
    currentY = getY(e);
    const delta = Math.max(0, currentY - startY);
    asideEl.style.transform = 'translateY(' + delta + 'px)';
    if (backdropEl) backdropEl.style.opacity = String(Math.max(0.15, 1 - delta / (window.innerHeight * 0.5)));
    if (e.cancelable) e.preventDefault();
  }
  function onEnd() {
    if (!dragging) return;
    dragging = false;
    const delta = Math.max(0, currentY - startY);
    const elapsed = Date.now() - startTime;
    // la velocidad solo es una señal confiable si pasó al menos ~1 frame;
    // si no, un drag chico pero "instantáneo" (o un tap con jitter) podría
    // calcular una velocidad absurda y cerrar el panel sin que corresponda.
    const velocity = elapsed > 16 ? delta / elapsed : 0;
    const shouldClose = delta > window.innerHeight * 0.18 || (delta > 24 && velocity > 0.5);

    if (shouldClose) {
      asideEl.style.transition = '';
      asideEl.style.transform = '';
      if (backdropEl) backdropEl.style.opacity = '';
      hapticTick();
      toggleSidebar();
    } else {
      asideEl.style.transition = 'transform .25s ease';
      asideEl.style.transform = 'translateY(0)';
      if (backdropEl) { backdropEl.style.transition = 'opacity .25s ease'; backdropEl.style.opacity = ''; }
      setTimeout(() => {
        asideEl.style.transition = '';
        asideEl.style.transform = '';
        if (backdropEl) backdropEl.style.transition = '';
      }, 260);
    }
  }

  dragZones.forEach(zone => {
    zone.addEventListener('touchstart', onStart, { passive: true });
    zone.addEventListener('touchmove', onMove, { passive: false });
    zone.addEventListener('touchend', onEnd);
    zone.addEventListener('touchcancel', onEnd);
    zone.addEventListener('mousedown', onStart); // soporte de mouse para probar en desktop
  });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onEnd);
})();
