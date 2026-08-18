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
- **Toggle USD/ARS en Cartera**: dólar blue automático vía dolarapi.com.
- **Los datos NO viven en este repo**: están en `Plan-retiro-datos`, que es **privado**. Mientras estuvieron acá, cualquiera podía leer `cartera.json` e `history.json` sin permiso — activos, cantidades y patrimonio hora por hora. Se separaron el 2026-08-17. Este repo tiene sólo la página; el privado tiene `cartera.json`, `history.json`, `sales.json`, el robot (`scripts/fetch-snapshot.mjs`) y su workflow. La página sigue pública porque GitHub Pages sólo es gratis en repos públicos.
- **Acceso a los datos**: todo pasa por `ghLeerJson()`, que usa la API de GitHub con el token si hay uno guardado y cae a la URL pública si no. Pide el media type "raw" porque la API de contents deja de devolver contenido arriba de 1 MB e `history.json` va camino a pasarlo. **Sin token la app se ve vacía**, y eso es lo esperado: hay que pegar el token una vez por dispositivo (vive en el localStorage de ese navegador). Un 404 se trata como "no existe", no como error, para que quien entre sin token vea un mensaje neutro.
- **Restauración**: al abrir, si no hay nada en localStorage, `restaurarCarteraSiEstaVacia()` baja `cartera.json` y reconstruye la cartera. Sólo actúa con la memoria vacía, así que nunca pisa datos locales. El payload de sync incluye `name` y `costBasis` además de ticker/cat/qty — sin ellos la restauración perdía los nombres y toda la ganancia/pérdida.
- **El robot falla fuerte a propósito**: si no consigue el precio de algún activo, `fetch-snapshot.mjs` tira error y no guarda nada, porque una medición incompleta se dibuja como una caída que nunca pasó. Eso hace fallar el workflow y GitHub manda mail. Antes de rendirse reintenta 3 veces los errores pasajeros (429/5xx/red); los definitivos (404, permisos) no los reintenta. La app además avisa en pantalla si la última medición tiene más de 6 horas.
- El bot de snapshots corre en paralelo al trabajo normal — genera commits en `origin/main` **del repo privado**, así que ese es el que puede necesitar rebase.
- Gráfico con filtro "24h" (ventana rodante de últimas 24hs, no día calendario) o períodos más largos. Eje vertical con montos exactos, no redondeado a K/M. La serie se adelgaza con `compactarHist()` para dibujar siempre ~140 puntos (`HIST_PUNTOS_OBJETIVO`): parte el rango en franjas de tiempo iguales y se queda con la última medición de cada una. Repartir por tiempo (y no una de cada N mediciones) importa porque el robot guarda una cantidad despareja por día y el eje ubica los puntos en fila pareja.
- Archivos de este repo: `index.html` (la app entera), `manifest.json`, los iconos y este archivo. El resto está en `Plan-retiro-datos`.

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
