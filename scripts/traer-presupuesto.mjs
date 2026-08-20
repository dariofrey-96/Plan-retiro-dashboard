// Trae el JavaScript de la app de Presupuesto al repo unificado, resolviendo
// los nombres que chocan con los de la mitad de retiro/cartera.
import { readFile, writeFile } from 'node:fs/promises';

const ORIGEN = 'C:/Users/Dario/OneDrive/Dokumente/GitHub/Presupuesto-personal/index.html';
const DESTINO = 'C:/Users/Dario/OneDrive/Dokumente/GitHub/Plan-retiro-dashboard/js/';

const L = (await readFile(ORIGEN, 'utf8')).replace(/\r/g, '').split('\n');
const trozo = (a, b) => L.slice(a - 1, b).join('\n');

// Nombres que existen en las dos mitades y significan cosas DISTINTAS: se les
// pone apellido para que convivan. (Los que significan lo mismo se borran más
// abajo y queda la versión que ya estaba.)
const APELLIDOS = {
  LS_SYNC_MARCA: 'LS_SYNC_MARCA_PRESU',          // marca cartera.json vs presupuesto.json
  loadParams: 'loadParamsPresu',                  // deslizadores del retiro vs parámetros del presupuesto
  saveParams: 'saveParamsPresu',
  toggleSidebar: 'toggleSidebarPresu',            // cada mitad tiene su propio panel
  marcarSincronizado: 'marcarSincronizadoPresu',  // archivos distintos
  traerCambiosDeOtroDispositivo: 'traerCambiosPresu',
  restaurarSiEstaVacio: 'restaurarPresupuestoSiEstaVacio',
};

function renombrar(js) {
  for (const [viejo, nuevo] of Object.entries(APELLIDOS)) {
    js = js.replace(new RegExp(`\\b${viejo}\\b`, 'g'), nuevo);
  }
  // El panel de parámetros: en el HTML unificado el de Presupuesto pasa a
  // llamarse aside-presu para no chocar con el del retiro.
  js = js.replace(/\$\('aside'\)/g, "$('aside-presu')");
  js = js.replace(/getElementById\('aside'\)/g, "getElementById('aside-presu')");
  return js;
}

// Borra una función/const de nivel superior por nombre, contando llaves.
// Ojo con `$`: en una expresión regular significa "fin de línea", así que hay
// que escaparlo o el borrado no encuentra nada y el nombre queda duplicado.
const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function borrarDeclaracion(js, nombreCrudo) {
  const nombre = escapar(nombreCrudo);
  const re = new RegExp(`^(?:async\\s+)?function\\s+${nombre}\\s*\\(`, 'm');
  const m = js.match(re);
  if (m) {
    let i = js.indexOf('{', m.index), prof = 0, j = i;
    for (; j < js.length; j++) {
      if (js[j] === '{') prof++;
      else if (js[j] === '}') { prof--; if (prof === 0) break; }
    }
    return js.slice(0, m.index) + js.slice(j + 1);
  }
  const reC = new RegExp(`^const\\s+${nombre}\\s*=[^;]*;`, 'm');
  return js.replace(reC, '');
}

// ── Bloque 1: el cuerpo de la app (pestañas, gastos, alertas, importar…) ────
let nucleo = renombrar(trozo(1473, 3038));
// Estos ya existen idénticos en la mitad del retiro: se quedan los de allá.
['$', 'fmtPct', 'hapticTick', 'toggleTheme'].forEach(n => { nucleo = borrarDeclaracion(nucleo, n); });
nucleo = `// ══════════ APP DE PRESUPUESTO ══════════
// Traída desde el repo Presupuesto-personal. Los nombres que chocaban con la
// mitad de retiro/cartera llevan apellido "Presu"; los ayudantes que eran
// idénticos ($ , fmtPct, hapticTick, toggleTheme) se borraron y se usa la
// versión que ya estaba en nucleo.js.
${nucleo}`;
await writeFile(DESTINO + 'presupuesto.js', nucleo + '\n', 'utf8');

// ── Bloque 2: casi todo duplicado; sólo se rescata el tooltip táctil ────────
const tooltip = renombrar(trozo(3231, 3246));
await writeFile(DESTINO + 'presupuesto-tooltip.js',
  `// Tooltip táctil de la barra de distribución del ingreso. Es lo único que se
// rescata del segundo bloque de Presupuesto: el resto (modo oscuro, deslizar
// con el dedo, vibración, arrastrar el panel) ya existe en la otra mitad.
${tooltip}\n`, 'utf8');

// ── Bloque 3: sincronización propia de presupuesto.json ─────────────────────
let sync = renombrar(trozo(3250, 3701));
// ghLeerJson y LS_GH_TOKEN son idénticos a los de sincronizacion.js
sync = borrarDeclaracion(sync, 'ghLeerJson');
sync = sync.replace(/^const\s+LS_GH_TOKEN\s*=[^;]*;\s*$/m, '');
sync = `// Sincronización de presupuesto.json. Comparte repositorio y token con la
// cartera, pero es otro archivo y otra marca de versión, así que las funciones
// llevan apellido. ghLeerJson() y LS_GH_TOKEN son los de sincronizacion.js.
${sync}`;
await writeFile(DESTINO + 'presupuesto-sync.js', sync + '\n', 'utf8');

// ── Verificación ────────────────────────────────────────────────────────────
const archivos = ['presupuesto.js', 'presupuesto-tooltip.js', 'presupuesto-sync.js'];
for (const f of archivos) {
  const src = await readFile(DESTINO + f, 'utf8');
  let estado = 'OK';
  try { new Function(src); } catch (e) { estado = 'ERROR: ' + e.message; }
  console.log(`  ${f.padEnd(26)} ${String(src.split('\n').length).padStart(5)} líneas  ${estado}`);
}
