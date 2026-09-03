// Marca la mitad de retiro con la clase "viendo-cartera" SÓLO cuando la vista
// activa es la Cartera, para que css/cartera-vidrio.css aplique el estilo vidrio
// nada más que ahí (Proyección comparte el encabezado de KPIs y no se toca).
// Aditivo: envuelve switchView sin cambiar su lógica. Quitar este <script> y el
// <link> del CSS vuelve todo al diseño actual.
(function () {
  function marcar(v) {
    var m = document.getElementById('mitad-retiro');
    if (m) m.classList.toggle('viendo-cartera', v === 'cartera');
  }
  if (typeof switchView === 'function') {
    var _sv = switchView;
    switchView = function (v, btn) { var r = _sv(v, btn); try { marcar(v); } catch (e) {} return r; };
  }
  function estadoInicial() {
    var act = document.querySelector('#mitad-retiro .view.active');
    if (act) marcar(act.id.replace('view-', ''));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', estadoInicial);
  else estadoInicial();
})();
