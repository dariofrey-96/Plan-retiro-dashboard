// Empareja el diseño de las dos mitades.
//
// Las dos definían los mismos componentes (.kpi, .field, .bn-item, .panel-card…)
// con valores levemente distintos: 0,02rem de tipografía, un píxel en un punto,
// --muted contra --text-3. No son dos diseños: es el mismo que se fue separando
// mientras las apps vivían en repos distintos.
//
// Se toma la versión de Presupuesto como la buena — es el rediseño más reciente
// y el que estrenó la paleta con tokens semánticos — y se sube a una capa
// compartida que rige para las dos mitades. Las reglas que quedan en cada hoja
// son sólo las propias de esa mitad.
import { readFile, writeFile } from 'node:fs/promises';

const CSS = 'C:/Users/Dario/OneDrive/Dokumente/GitHub/Plan-retiro-dashboard/css/';
const AMBITO = '.app-presupuesto';

const sinComentarios = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

// Parte en bloques de primer nivel, respetando @media anidadas.
function bloques(texto) {
  const out = [];
  let i = 0, sel = '';
  while (i < texto.length) {
    if (texto[i] === '{') {
      let prof = 1, j = i + 1;
      while (j < texto.length && prof > 0) {
        if (texto[j] === '{') prof++;
        else if (texto[j] === '}') { prof--; if (prof === 0) break; }
        j++;
      }
      out.push({ sel: sel.trim(), cuerpo: texto.slice(i + 1, j), crudo: texto.slice(i - sel.length, j + 1) });
      sel = ''; i = j + 1; continue;
    }
    sel += texto[i]; i++;
  }
  return out;
}

const desScope = s => s.replace(new RegExp('\\' + AMBITO + '\\s*', 'g'), '').trim();

const estilos = await readFile(CSS + 'estilos.css', 'utf8');
const presu = await readFile(CSS + 'presupuesto.css', 'utf8');

// Selectores que existen en las dos mitades: son los que hay que unificar.
const selsRetiro = new Set();
bloques(sinComentarios(estilos)).forEach(b => {
  if (b.sel.startsWith('@')) return;
  b.sel.split(',').forEach(s => selsRetiro.add(s.trim()));
});

const compartidos = new Set();
bloques(sinComentarios(presu)).forEach(b => {
  if (b.sel.startsWith('@')) return;
  b.sel.split(',').forEach(s => { const d = desScope(s); if (d && selsRetiro.has(d)) compartidos.add(d); });
});

// ── Capa compartida: la versión de Presupuesto, sin encapsular ──────────────
function repartir(css, esPresupuesto) {
  const compartida = [], propia = [];
  for (const b of bloques(sinComentarios(css))) {
    if (b.sel.startsWith('@')) {
      // Dentro de una media query se decide regla por regla
      const dentroC = [], dentroP = [];
      for (const n of bloques(b.cuerpo)) {
        const sels = n.sel.split(',').map(s => s.trim()).filter(Boolean);
        const compart = [], propios = [];
        sels.forEach(s => {
          const x = esPresupuesto ? desScope(s) : s;
          if (compartidos.has(x)) compart.push(x); else propios.push(s);
        });
        if (compart.length && esPresupuesto) dentroC.push(`${compart.join(',')}{${n.cuerpo}}`);
        if (propios.length) dentroP.push(`${propios.join(',')}{${n.cuerpo}}`);
      }
      if (dentroC.length) compartida.push(`${b.sel}{\n${dentroC.join('\n')}\n}`);
      if (dentroP.length) propia.push(`${b.sel}{\n${dentroP.join('\n')}\n}`);
      continue;
    }
    const sels = b.sel.split(',').map(s => s.trim()).filter(Boolean);
    if (!sels.length) continue;
    // Una regla puede agrupar varios selectores y que sólo algunos sean
    // compartidos (`.num,.val,table{…}`). Si se decide por el grupo entero, la
    // regla se queda donde estaba y el componente sigue definido en dos lados.
    // Por eso el grupo se parte.
    const compart = [], propios = [];
    sels.forEach(s => {
      const n = esPresupuesto ? desScope(s) : s;
      if (compartidos.has(n)) compart.push(n); else propios.push(s);
    });
    // De la parte compartida manda la versión de Presupuesto; la del retiro se
    // descarta, que es justamente el emparejado.
    if (compart.length && esPresupuesto) compartida.push(`${compart.join(',')}{${b.cuerpo}}`);
    if (propios.length) propia.push(`${propios.join(',')}{${b.cuerpo}}`);
  }
  return { compartida, propia };
}

const deR = repartir(estilos, false);
const deP = repartir(presu, true);

const cab = t => `/* ${t}
   GENERADO por scripts/unificar-componentes.mjs — no editar a mano. */\n\n`;

await writeFile(CSS + 'componentes.css',
  cab(`Componentes compartidos por las DOS mitades de la app.

   Las dos definían estos mismos ${compartidos.size} selectores con valores apenas
   distintos (0,02rem de tipografía, un píxel acá y allá, --muted contra
   --text-3): el mismo diseño separado por vivir en repos distintos. Manda la
   versión de Presupuesto, que es el rediseño más reciente.`) +
  deP.compartida.join('\n') + '\n', 'utf8');

await writeFile(CSS + 'estilos.css',
  cab('Estilos propios de la mitad de RETIRO/CARTERA.\n   Los compartidos están en componentes.css y los colores en tokens.css.') +
  deR.propia.join('\n') + '\n', 'utf8');

await writeFile(CSS + 'presupuesto.css',
  cab(`Estilos propios de la mitad de PRESUPUESTO, encapsulados bajo ${AMBITO}.\n   Los compartidos están en componentes.css y los colores en tokens.css.`) +
  deP.propia.join('\n') + '\n', 'utf8');

console.log(`selectores unificados: ${compartidos.size}`);
console.log(`  componentes.css : ${deP.compartida.length} reglas`);
console.log(`  estilos.css     : ${deR.propia.length} reglas propias del retiro`);
console.log(`  presupuesto.css : ${deP.propia.length} reglas propias del presupuesto`);

// Verificación: llaves balanceadas y nada del presupuesto sin encapsular
for (const f of ['componentes.css', 'estilos.css', 'presupuesto.css']) {
  const t = await readFile(CSS + f, 'utf8');
  let a = 0, c = 0; for (const ch of t) { if (ch === '{') a++; if (ch === '}') c++; }
  const fugas = f === 'presupuesto.css'
    ? bloques(sinComentarios(t)).filter(b => !b.sel.startsWith('@') && !b.sel.includes(AMBITO)).length
    : 0;
  console.log(`  ${f.padEnd(18)} llaves ${a === c ? 'OK' : 'DESBALANCEADAS'}${fugas ? `  ${fugas} FUGAS` : ''}`);
}
