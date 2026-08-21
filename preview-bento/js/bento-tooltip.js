// PREVIEW BENTO — tooltip del gráfico de proyección (idea de Gemini).
// Al pasar el mouse por un punto muestra el % de cambio contra el año anterior.
// Se aplica sobre el gráfico existente sin tocar cDef() ni el archivo original.
//
// No llama a chart.update(): sólo deja puesto el callback, que Chart.js lee al
// pasar el mouse. Y se vuelve a poner después de cada recalc() (que resetea el
// tooltip al de la app), para que la versión de Gemini no se pierda. Sin
// update() no hay forma de que entre en un bucle de dibujado.
(function () {
  function etiqueta(context) {
    const datasetLabel = context.dataset.label || '';
    const val = context.parsed.y;
    let text = `${datasetLabel}: $${Math.round(val).toLocaleString('es-AR')}`;
    if (context.dataIndex > 0) {
      const prevVal = context.dataset.data[context.dataIndex - 1];
      if (prevVal && prevVal > 0) {
        const pct = ((val - prevVal) / prevVal) * 100;
        text += `  (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}% vs. año anterior)`;
      }
    }
    return text;
  }
  function poner() {
    if (typeof chart === 'undefined' || !chart || !chart.options || !chart.options.plugins) return false;
    const tt = chart.options.plugins.tooltip = chart.options.plugins.tooltip || {};
    tt.backgroundColor = '#1c1c21';
    tt.titleColor = 'rgba(255,255,255,0.9)';
    tt.bodyColor = 'rgba(255,255,255,0.9)';
    tt.borderColor = 'rgba(255,255,255,0.1)';
    tt.borderWidth = 1;
    tt.callbacks = tt.callbacks || {};
    tt.callbacks.label = etiqueta;
    return true;
  }
  function armar(n) {
    if (!poner() && n > 0) return setTimeout(() => armar(n - 1), 300);
    // recalc() reconstruye el tooltip con el de la app: se re-aplica después.
    if (typeof recalc === 'function' && !recalc.__bento) {
      const _r = recalc;
      recalc = function (...a) { const x = _r(...a); poner(); return x; };
      recalc.__bento = true;
    }
  }
  armar(20);
})();
