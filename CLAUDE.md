# CLAUDE.md

Contexto persistente para este repositorio.

## Usuario

- Email: dariofrey@hendercross.com

## Contexto general: Presupuesto Personal + Plan de Retiro

Dos apps hermanas (HTML/JS, hosteadas en GitHub Pages), mismo sistema de diseño (cards, modo claro/oscuro adaptativo, mobile-first, bottom sheet con swipe-to-dismiss, haptics en iOS vía switch nativo):

- **Presupuesto Personal** — repo `Presupuesto-personal`, en pesos argentinos.
- **Plan de Retiro** — repo `Plan-retiro-dashboard` (este repo), en dólares (USD) por defecto.

### Este repo (Plan de Retiro)

- **Proyección de retiro**: escenarios, sensibilidad, calculadora inversa. Siempre en USD, independiente a propósito de la Cartera.
- **Cartera de inversión** (crypto/acciones/metales/USD-USDT): precios en vivo, venta de activos con conversión a USD y promedio ponderado, alertas de ganancia con ventana de tiempo.
- **Varias carteras** (desde el 2026-08-18, para separar por estrategia): `carteras` es la fuente de la verdad y `assets` pasó a ser sólo *lo que estás viendo*, para no tocar las ~30 funciones que ya trabajaban sobre él. `saveAssets()` devuelve lo visible a la cartera que corresponde y es el único punto de sincronización — toda mutación de `assets` ya terminaba llamándolo. Cada activo lleva `cId`, que es lo que permite editar y vender desde la vista "Todo"; agregar sí está bloqueado ahí porque no habría forma de saber a cuál va. El selector se esconde solo si hay una sola cartera. `refreshPrices()` actualiza **todas** las carteras, no la visible, o "Todo" sumaría precios viejos.
- **El historial por cartera**: el robot guarda `porCartera` (y `carteras` con los nombres) en cada medición cuando hay más de una. Para las mediciones anteriores, `vistaSnapshot()` reconstruye el pasado sumando los activos que *hoy* están en cada cartera — por eso separar la cartera no deja el gráfico en blanco. Dos sutilezas que ya mordieron: si un ticker está en dos carteras se reparte proporcional a la cantidad (si no, la misma plata se cuenta dos veces), y los tickers del historial que hoy no están en ninguna cartera se le atribuyen a la primera (si no, las carteras sumadas dan menos que "Todo" y parece un error). La reconstrucción usa el reparto de hoy: mover un activo de cartera le muda el pasado.
- **Toggle USD/ARS en Cartera**: dólar blue automático vía dolarapi.com.
- **Los datos NO viven en este repo**: están en `Plan-retiro-datos`, que es **privado**. Mientras estuvieron acá, cualquiera podía leer `cartera.json` e `history.json` sin permiso — activos, cantidades y patrimonio hora por hora. Se separaron el 2026-08-17. Este repo tiene sólo la página; el privado tiene `cartera.json`, `history.json`, `sales.json`, el robot (`scripts/fetch-snapshot.mjs`) y su workflow. La página sigue pública porque GitHub Pages sólo es gratis en repos públicos. **Desde el 2026-08-20 hay un archivo más ahí: `presupuesto.json`**, que es de la app hermana (Presupuesto Personal) y reusa este mismo token — las dos apps viven bajo `dariofrey-96.github.io` y comparten `localStorage`, así que `planRetiro_gh_token` sirve para las dos. Los archivos no se tocan entre sí; el robot de acá no lo mira.
- **Acceso a los datos**: todo pasa por `ghLeerJson()`, que usa la API de GitHub con el token si hay uno guardado y cae a la URL pública si no. Pide el media type "raw" porque la API de contents deja de devolver contenido arriba de 1 MB e `history.json` va camino a pasarlo. **Sin token la app se ve vacía**, y eso es lo esperado: hay que pegar el token una vez por dispositivo (vive en el localStorage de ese navegador). Un 404 se trata como "no existe", no como error, para que quien entre sin token vea un mensaje neutro.
- **Restauración**: al abrir, si no hay nada en localStorage, `restaurarCarteraSiEstaVacia()` baja `cartera.json` y reconstruye la cartera. Sólo actúa con la memoria vacía, así que nunca pisa datos locales. El payload de sync incluye `name`, `costBasis` y `cgId` además de ticker/cat/qty — sin ellos la restauración perdía los nombres, toda la ganancia/pérdida, y el robot tenía que volver a adivinar el id de cada cripto.
- **Sincronización de ida y vuelta** (desde el 2026-08-18): antes cada dispositivo subía pero ninguno bajaba, así que una cartera creada en la notebook no aparecía nunca en el celular. `traerCambiosDeOtroDispositivo()` compara el `updatedAt` de `cartera.json` contra la marca guardada en `LS_SYNC_MARCA` y adopta la versión remota si son distintas. **Al adoptar NO se vuelve a subir** — si se subiera se generaría un `updatedAt` nuevo y los dispositivos se pisarían en círculo. Antes de pisar guarda lo anterior en `LS_CARTERA_PREVIA` y reaprovecha los precios ya cargados por ticker para que la pantalla no quede en cero. Es last-write-wins: dos dispositivos editando a la vez, gana el último que sube.
- **Precios de cripto**: CoinGecko usa ids propios (`bitcoin`, no `BTC`). `GM` cubre las 26 más conocidas; el resto se resuelve solo con `/search` y queda cacheado en `LS_CG_IDS`. Entre varias monedas con el mismo símbolo gana la de mayor capitalización. Esto surgió porque CKB (`nervos-network`) quedaba sin precio y, con el robot fallando fuerte, cortaba el historial entero.
- **El robot falla fuerte a propósito**: si no consigue el precio de algún activo, `fetch-snapshot.mjs` tira error y no guarda nada, porque una medición incompleta se dibuja como una caída que nunca pasó. Eso hace fallar el workflow y GitHub manda mail. Antes de rendirse reintenta 3 veces los errores pasajeros (429/5xx/red); los definitivos (404, permisos) no los reintenta. La app además avisa en pantalla si la última medición tiene más de 6 horas.
- El bot de snapshots corre en paralelo al trabajo normal — genera commits en `origin/main` **del repo privado**, así que ese es el que puede necesitar rebase.
- Gráfico con filtro "24h" (ventana rodante de últimas 24hs, no día calendario) o períodos más largos. Eje vertical con montos exactos, no redondeado a K/M. La serie se adelgaza con `compactarHist()` para dibujar siempre ~140 puntos (`HIST_PUNTOS_OBJETIVO`): parte el rango en franjas de tiempo iguales y se queda con la última medición de cada una. Repartir por tiempo (y no una de cada N mediciones) importa porque el robot guarda una cantidad despareja por día y el eje ubica los puntos en fila pareja.
- Archivos de este repo: `index.html` (la app entera), `manifest.json`, los iconos y este archivo. El resto está en `Plan-retiro-datos`.

### FinLab: la app unificada (hecho el 2026-08-20)

La app se llama **FinLab** y vive en este repo: presupuesto y retiro/cartera en una sola página, cuatro secciones (Resumen · Gastos · Proyección · Cartera). **Ya está en `main` y publicada.** El repo `Presupuesto-personal` queda como archivo histórico — no se le agregan cambios nuevos, todo va acá. La etiqueta `antes-de-finlab` apunta a la última versión previa a la unión, por si hace falta comparar o volver atrás.

- **Hecho**: archivo único partido en `css/` + `js/`; paleta unificada en `css/tokens.css` (tema de tres estados: sin atributo sigue al sistema, `[data-theme]` pisa); JS de Presupuesto traído sin choques de nombres; marcado unificado con una barra de cuatro secciones (Resumen · Gastos · Proyección · Cartera) manejada por `js/navegacion.js`.
- **Lo que hizo falta decidir**: las dos apps compartían sistema de diseño pero con el tema por defecto **invertido** (`:root` de Presupuesto = claro, el del retiro = oscuro). Eso hacía imposible cargar las dos hojas juntas, así que unificar la paleta **no era una pasada de diseño posterior sino el requisito** para poder unir.
- **Convenciones**: lo que chocaba y significaba cosas distintas lleva apellido `Presu` (`loadParamsPresu`, `toggleSidebarPresu`, `LS_SYNC_MARCA_PRESU`…). El deslizador `alquiler` del retiro pasó a `alquilerRetiro` con migración en `loadParams()`, porque el id del elemento era también la clave de guardado. Los estilos de Presupuesto están encapsulados bajo `.app-presupuesto` (`css/presupuesto.css`) — los componentes todavía NO están unificados, sólo los colores.
- **Los tres archivos generados no se editan a mano**: `css/tokens.css`, `css/presupuesto.css` y los `js/presupuesto*.js` salen de los scripts en `scripts/`. Editar `tokens.css` a mano ya rompió el archivo una vez (una declaración cortada se traga todas las reglas siguientes sin dar error).
- **Diseño emparejado** (2026-08-20): las dos mitades definían los mismos 51 componentes con valores apenas distintos (0,02rem de tipografía, un píxel, `--muted` contra `--text-3`) — el mismo diseño separado por vivir en repos distintos, no dos diseños. Manda la versión de Presupuesto y vive en `css/componentes.css`; en `estilos.css` y `presupuesto.css` quedaron sólo las reglas propias de cada mitad. Orden de carga: `tokens` → `componentes` → `estilos` → `presupuesto`.
- **Una sola navegación en dos presentaciones**: barra flotante abajo en celular, pestañas en el encabezado a partir de 900px. Las dos se resaltan juntas desde `irASeccionApp()`. La regla que esconde la barra en pantalla ancha tiene que estar en `componentes.css` **sin encapsular** — estaba dentro de los estilos de presupuesto y, al pasar la barra a ser compartida, dejaba de aplicarse y se veían las dos navegaciones a la vez.
- **Trampa del generador de CSS**: hay que quitar los comentarios ANTES de parsear. Si no, el comentario que va entre dos reglas queda pegado al selector siguiente (`.app-presupuesto /* TABLES */` y abajo `.table-card` suelto) y, peor, un comentario antes de un `@media` hace que el bloque no se reconozca y nada de lo de adentro se encapsule. Fueron 38 reglas derramándose sin que el control de fugas lo viera; ahora hay además una verificación línea por línea, independiente del parser.
- **Falta**: renombrar el repo a `FinLab`, y probar la escritura real a GitHub desde la app unificada (la lectura sí está probada con los datos reales).

### Ideas pendientes (inspiradas en plata.wtf, en orden de prioridad)

1. Importar PDF/resumen de tarjeta con categorización automática (Presupuesto).
2. Informes personalizables por período (gastos/ingresos/patrimonio/flujo de caja).
3. Pagos habituales con recordatorio de vencimiento.
4. Concepto de "cuentas" (efectivo/banco/tarjeta/cripto) con transferencias — el cambio más grande de arquitectura, para el final.

### Regla de trabajo

- Cambios chicos/aditivos van como funciones nuevas sin tocar el JS original.
- Cambios de lógica de negocio real sí se editan directo, pero siempre probados (batería de ~11 archivos de test con jsdom) antes de dar por terminado un cambio.

### Notas operativas

- El 6-7 de agosto de 2026 hubo un incidente real de GitHub (Actions + Pages caídos ~11hs) que causó deployments trabados — no era nada del lado del repo. Si algo similar pasa, chequear githubstatus.com antes de tocar configuración.
- Estado al 2026-08-07: todo funcionando y desplegado, el robot de snapshots por hora corre solo en paralelo.
