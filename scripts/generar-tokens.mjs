// Genera css/tokens.css: un solo juego de colores y medidas para las dos
// mitades de la app. Lee los bloques directamente del index.html de
// Presupuesto, que tiene la paleta más completa (47 variables contra 27).
import { readFile, writeFile } from 'node:fs/promises';

const PRESUPUESTO = 'C:/Users/Dario/OneDrive/Dokumente/GitHub/Presupuesto-personal/index.html';
const DESTINO = 'C:/Users/Dario/OneDrive/Dokumente/GitHub/Plan-retiro-dashboard/css/tokens.css';

const css = (await readFile(PRESUPUESTO, 'utf8')).replace(/\r/g, '').split('\n').slice(13, 959).join('\n');

// Saca el contenido de un bloque cuidando de cortar en la llave que cierra,
// no en la primera que aparezca.
function cuerpoDe(inicioRe) {
  const m = css.match(inicioRe);
  if (!m) throw new Error('no encontré el bloque ' + inicioRe);
  let i = m.index + m[0].length, prof = 1, ini = i;
  while (i < css.length && prof > 0) {
    if (css[i] === '{') prof++;
    else if (css[i] === '}') prof--;
    if (prof > 0) i++;
  }
  return css.slice(ini, i).replace(/^\n+|\s+$/g, '');
}

const CLARO = cuerpoDe(/:root\s*\{/);
let OSCURO = cuerpoDe(/\[data-theme=["']dark["']\]\s*\{/);

// Los componentes de la mitad del retiro usan los colores base directo
// (--accent, --green...), no las variantes --*-text que usa Presupuesto. El
// bloque oscuro original no los traía, así que sobre fondo negro quedaban
// apagados. Se agregan con los valores que el Plan de Retiro ya tenía afinados.
OSCURO += `

  /* Colores base en su versión para fondo oscuro (los usa la mitad de
     retiro/cartera; Presupuesto usa las variantes --*-text). */
  --accent:  oklch(72% .13 264);
  --green:   oklch(72% .13 150);
  --red:     oklch(72% .15 25);
  --gold:    oklch(78% .13 80);
  --purple:  oklch(74% .14 300);
  --teal:    oklch(72% .11 175);`;

const salida = `/* ═══════════════ COLORES Y MEDIDAS ═══════════════
   Un solo juego de valores para las DOS mitades de la app (presupuesto y
   retiro). Antes cada una tenía el suyo, con los mismos nombres pero el tema
   por defecto invertido: el :root de Presupuesto era la paleta CLARA y el del
   Plan de Retiro la OSCURA. Juntarlas sin unificar dejaba una de las dos
   mitades ilegible.

   Arranca siguiendo el tema del sistema. Si el usuario elige a mano,
   [data-theme] pisa esa preferencia y la elección se recuerda.

   Los tres estados importan, y el orden también: el bloque del sistema lleva
   :not([data-theme="light"]) para que elegir claro a mano le gane a un sistema
   en oscuro, y los bloques manuales van últimos para ganar en los dos sentidos.

   GENERADO por scratchpad/generar-tokens.mjs a partir del index.html de
   Presupuesto — no editar a mano, se regenera. */

:root{
${CLARO}
}

/* El sistema pide oscuro y el usuario no eligió claro a mano */
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
${OSCURO}
  }
}

/* Elección manual: gana siempre, en los dos sentidos */
:root[data-theme="dark"]{
${OSCURO}
}
:root[data-theme="light"]{
${CLARO}
}

/* Nombres que usa la mitad del retiro para los mismos valores. Se dejan como
   alias en vez de renombrar 200 usos: menos riesgo y es lo mismo. */
:root{
  --surface2: var(--surface-2);
  --surface3: var(--surface-3);
  --orange-soft: var(--gold-soft);
}
`;

await writeFile(DESTINO, salida, 'utf8');

// ── Verificación: que no quede ninguna declaración cortada ──────────────────
const problemas = [];
let abre = 0, cierra = 0;
for (const ch of salida) { if (ch === '{') abre++; if (ch === '}') cierra++; }
if (abre !== cierra) problemas.push(`llaves desbalanceadas: ${abre} vs ${cierra}`);

// Cada declaración dentro de un bloque tiene que terminar en ; y tener paréntesis parejos
salida.replace(/\{([^{}]*)\}/g, (_, cuerpo) => {
  cuerpo.split('\n').forEach(l => {
    const t = l.replace(/\/\*[\s\S]*?\*\//g, '').trim();
    if (!t || t.startsWith('/*') || t.startsWith('*')) return;
    if (!t.endsWith(';')) problemas.push('sin punto y coma: ' + t.slice(0, 60));
    const ab = (t.match(/\(/g) || []).length, ce = (t.match(/\)/g) || []).length;
    if (ab !== ce) problemas.push('paréntesis disparejos: ' + t.slice(0, 60));
  });
  return '';
});

const contar = re => (salida.match(re) || []).length;
console.log('css/tokens.css:', salida.split('\n').length, 'líneas');
console.log('  bloques con --bg oscuro:', contar(/--bg:\s*#17161a/g), '(deben ser 2)');
console.log('  bloques con --bg claro: ', contar(/--bg:\s*#f7f6f4/g), '(deben ser 2)');
console.log('  --accent oscuro:', contar(/--accent:\s*oklch\(72%/g), '(deben ser 2)');
console.log(problemas.length ? '  PROBLEMAS:\n   ' + problemas.join('\n   ') : '  sin declaraciones cortadas');
