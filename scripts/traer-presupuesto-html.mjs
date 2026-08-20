// Inserta el marcado de la app de Presupuesto dentro del index.html unificado.
//
// Todo su HTML queda envuelto en .app-presupuesto, que es lo que hace que sus
// estilos (css/presupuesto.css) no se derramen sobre la otra mitad. Los seis
// identificadores que existían en las dos mitades se renombran acá.
import { readFile, writeFile } from 'node:fs/promises';

const RAIZ = 'C:/Users/Dario/OneDrive/Dokumente/GitHub/Plan-retiro-dashboard/';
const ORIGEN = 'C:/Users/Dario/OneDrive/Dokumente/GitHub/Presupuesto-personal/index.html';

const P = (await readFile(ORIGEN, 'utf8')).replace(/\r/g, '').split('\n');
const trozo = (a, b) => P.slice(a - 1, b).join('\n');

// El body de Presupuesto: header propio (se descarta, hay uno solo), fondos de
// los paneles, modales y el .shell con el aside y las vistas.
let marcado = trozo(994, 1470);

// Identificadores repetidos entre las dos mitades. `alquiler` no está en esta
// lista porque se resolvió al revés: se renombró el del retiro, que es un
// supuesto a futuro y no un dato cargado a mano.
const IDS = {
  'aside': 'aside-presu',
  'sheet-backdrop': 'sheet-backdrop-presu',
  'sidebar-toggle': 'sidebar-toggle-presu',
};
for (const [viejo, nuevo] of Object.entries(IDS)) {
  marcado = marcado.replace(new RegExp(`id="${viejo}"`, 'g'), `id="${nuevo}"`);
  marcado = marcado.replace(new RegExp(`\\$\\('${viejo}'\\)`, 'g'), `$('${nuevo}')`);
}
// Las llamadas que quedaron en atributos onclick del propio marcado
marcado = marcado.replace(/toggleSidebar\(\)/g, 'toggleSidebarPresu()');

const bloque = `
<!-- ══════════ MITAD DE PRESUPUESTO ══════════
     Envuelta en .app-presupuesto: ese contenedor es lo que mantiene sus
     estilos adentro y evita que pisen a los de retiro/cartera. -->
<div class="app-presupuesto" id="mitad-presupuesto" style="display:none">
${marcado}
</div>
`;

// ── Insertar en el index.html unificado ─────────────────────────────────────
let H = await readFile(RAIZ + 'index.html', 'utf8');

// 1. Envolver lo que ya existe (retiro/cartera) en su propio contenedor, para
//    poder mostrar una mitad u otra.
H = H.replace('<div class="shell">', '<div id="mitad-retiro">\n<div class="shell">');
H = H.replace(/<\/main>\n<\/div>\n/, '</main>\n</div>\n</div>\n');

// 2. Meter la mitad de presupuesto justo antes de la barra de abajo
H = H.replace('<nav class="bottom-nav" id="bottom-nav">', bloque + '\n<nav class="bottom-nav" id="bottom-nav">');

// 3. Barra de abajo unificada: cuatro secciones más los ajustes de la que estés viendo
const nav = `<nav class="bottom-nav" id="bottom-nav">
  <button class="bn-item" data-seccion="resumen" onclick="irASeccionApp('resumen')"><span class="bn-ic">◔</span>Resumen</button>
  <button class="bn-item" data-seccion="gastos" onclick="irASeccionApp('gastos')"><span class="bn-ic">＋</span>Gastos</button>
  <button class="bn-item active" data-seccion="retiro" onclick="irASeccionApp('retiro')"><span class="bn-ic">📈</span>Proyección</button>
  <button class="bn-item" data-seccion="cartera" onclick="irASeccionApp('cartera')"><span class="bn-ic">💼</span>Cartera</button>
  <button class="bn-item" onclick="abrirAjustesDeLaSeccion()"><span class="bn-ic">⚙</span>Ajustes</button>
</nav>`;
H = H.replace(/<nav class="bottom-nav" id="bottom-nav">[\s\S]*?<\/nav>/, nav);

// 4. Enlazar los archivos nuevos
H = H.replace('<link rel="stylesheet" href="css/estilos.css">',
  '<link rel="stylesheet" href="css/estilos.css">\n<link rel="stylesheet" href="css/presupuesto.css">');
H = H.replace('<script src="js/deslizar.js"></script>',
  ['<script src="js/presupuesto.js"></script>',
   '<script src="js/presupuesto-tooltip.js"></script>',
   '<script src="js/presupuesto-sync.js"></script>',
   '<script src="js/navegacion.js"></script>',
   '<script src="js/deslizar.js"></script>'].join('\n'));

await writeFile(RAIZ + 'index.html', H, 'utf8');

// ── Verificación ────────────────────────────────────────────────────────────
const ids = t => [...t.matchAll(/id="([^"]+)"/g)].map(m => m[1]);
const todos = ids(H);
const repetidos = [...new Set(todos.filter((x, i) => todos.indexOf(x) !== i))];
console.log(`index.html: ${H.split('\n').length} líneas`);
console.log(`  identificadores totales: ${todos.length}`);
console.log(repetidos.length ? `  REPETIDOS: ${repetidos.join(', ')}` : '  sin identificadores repetidos');
const pares = ['mitad-retiro', 'mitad-presupuesto', 'aside-presu', 'bottom-nav'];
pares.forEach(id => console.log(`  ${id}: ${todos.filter(x => x === id).length}`));
