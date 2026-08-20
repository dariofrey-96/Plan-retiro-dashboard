// Trae la hoja de estilos de Presupuesto al repo unificado.
//
// Los colores ya viven en tokens.css, compartidos por las dos mitades, así que
// acá se quitan los bloques de paleta. Lo que queda son las reglas de
// componentes, y esas SÍ chocan: las dos mitades definen .kpi, .field,
// .bn-item, .shell y 29 clases más con valores distintos, más 11 selectores de
// elemento (header, aside, table…). Se encapsulan bajo .app-presupuesto para
// que cada mitad conserve su maquetación.
//
// Unificar los componentes es una pasada aparte; lo que se unificó ahora es la
// paleta, que era lo que impedía que convivieran.
import { readFile, writeFile } from 'node:fs/promises';

const AMBITO = '.app-presupuesto';
const ORIGEN = 'C:/Users/Dario/OneDrive/Dokumente/GitHub/Presupuesto-personal/index.html';
const DESTINO = 'C:/Users/Dario/OneDrive/Dokumente/GitHub/Plan-retiro-dashboard/css/presupuesto.css';

let css = (await readFile(ORIGEN, 'utf8')).replace(/\r/g, '').split('\n').slice(13, 959).join('\n');

// Las declaraciones sueltas (@import) terminan en `;`, no en llaves. Si se
// dejan, el parser las pega al selector siguiente. Ojo que la URL de la fuente
// lleva `;` adentro del paréntesis.
const sueltas = [];
css = css.replace(/@(?:import|charset)\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')?[^;]*;/g,
  m => { sueltas.push(m.trim()); return ''; });

// Parte en bloques {selector, cuerpo} contando llaves, para no cortar dentro de
// un @media anidado.
function parsear(texto) {
  const nodos = [];
  let i = 0, sel = '';
  while (i < texto.length) {
    if (texto[i] === '{') {
      let prof = 1, j = i + 1;
      while (j < texto.length && prof > 0) {
        if (texto[j] === '{') prof++;
        else if (texto[j] === '}') { prof--; if (prof === 0) break; }
        j++;
      }
      nodos.push({ sel: sel.trim(), cuerpo: texto.slice(i + 1, j) });
      sel = ''; i = j + 1; continue;
    }
    sel += texto[i]; i++;
  }
  if (sel.trim()) nodos.push({ sel: null, cuerpo: sel });
  return nodos;
}

const esPaleta = s => s === ':root' || /^\[data-theme=["'][a-z]+["']\]$/.test(s.trim());

function encapsular(s) {
  s = s.trim();
  if (!s) return s;
  if (/^(html|body)\b/.test(s)) return s.replace(/^(html|body)\b/, AMBITO);
  if (/^\[data-theme/.test(s)) {
    const m = s.match(/^(\[data-theme=["'][a-z]+["']\])\s*(.*)$/);
    if (m) return m[2] ? `${m[1]} ${AMBITO} ${m[2]}` : `${m[1]} ${AMBITO}`;
  }
  return `${AMBITO} ${s}`;
}

function reconstruir(nodos) {
  return nodos.map(n => {
    if (n.sel === null) return n.cuerpo.trim() ? n.cuerpo : '';
    if (/^@(-webkit-)?keyframes/.test(n.sel)) return `${n.sel}{${n.cuerpo}}`; // los pasos no se tocan
    if (n.sel.startsWith('@')) return `${n.sel}{\n${reconstruir(parsear(n.cuerpo))}\n}`;
    if (esPaleta(n.sel)) return ''; // la paleta ya está en tokens.css
    return `${n.sel.split(',').map(encapsular).join(',')}{${n.cuerpo}}`;
  }).filter(Boolean).join('\n');
}

const cabecera = `/* Estilos de la mitad de PRESUPUESTO, encapsulados bajo ${AMBITO}.

   Las dos mitades definen las mismas clases (.kpi, .field, .bn-item, .shell…)
   con valores distintos, y 11 selectores de elemento (header, aside, table…)
   que pisarían a la otra. Encapsulados, cada mitad conserva su maquetación.

   Los COLORES no están acá: viven en tokens.css, compartidos por las dos.
   Unificar también los componentes es una pasada posterior.

   GENERADO por scripts/traer-presupuesto-css.mjs — no editar a mano. */
`;

const salida = cabecera + sueltas.join('\n') + '\n' + reconstruir(parsear(css)) + '\n';
await writeFile(DESTINO, salida, 'utf8');

// ── Verificación ────────────────────────────────────────────────────────────
const problemas = [];
let abre = 0, cierra = 0;
for (const ch of salida) { if (ch === '{') abre++; if (ch === '}') cierra++; }
if (abre !== cierra) problemas.push(`llaves desbalanceadas: ${abre} vs ${cierra}`);

// Ningún selector puede quedar fuera del contenedor, ni siquiera dentro de @media
function revisarFugas(nodos, dentroDeAt = false) {
  nodos.forEach(n => {
    if (n.sel === null) return;
    if (/^@(-webkit-)?keyframes/.test(n.sel)) return;
    if (n.sel.startsWith('@')) return revisarFugas(parsear(n.cuerpo), true);
    n.sel.split(',').forEach(s => {
      if (!s.includes(AMBITO)) problemas.push(`fuga${dentroDeAt ? ' (dentro de @media)' : ''}: ${s.trim()}`);
    });
  });
}
revisarFugas(parsear(salida.slice(cabecera.length)));

console.log(`css/presupuesto.css: ${salida.split('\n').length} líneas`);
console.log(`  reglas encapsuladas: ${(salida.match(new RegExp('\\' + AMBITO, 'g')) || []).length}`);
console.log(problemas.length ? '  PROBLEMAS:\n   ' + problemas.slice(0, 10).join('\n   ') : '  sin fugas ni llaves sueltas');
