// PREVIEW HORIZON — sólo ajuste de render, no toca datos ni lógica.
// Le da un respiro al redibujado de los gráficos para evitar el bucle de resize
// que aparecía en pruebas de estilos anteriores.
try { if (window.Chart) Chart.defaults.resizeDelay = 200; } catch (e) {}
