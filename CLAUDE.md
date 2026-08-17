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
- **Historial automático**: `cartera.json` se sincroniza solo a GitHub con cada cambio de cartera (token fine-grained en el navegador, permisos acotados a "Contents: Read and write"). GitHub Action (`fetch-snapshot.mjs`) corre cada hora y guarda en `history.json`. El bot de snapshots corre en paralelo al trabajo normal — puede generar commits nuevos en `origin/main` que requieren rebase antes de pushear.
- Gráfico con filtro "24h" (ventana rodante de últimas 24hs, no día calendario) o períodos más largos. Eje vertical con montos exactos, no redondeado a K/M. La serie se adelgaza con `compactarHist()` para dibujar siempre ~140 puntos (`HIST_PUNTOS_OBJETIVO`): parte el rango en franjas de tiempo iguales y se queda con la última medición de cada una. Repartir por tiempo (y no una de cada N mediciones) importa porque el robot guarda una cantidad despareja por día y el eje ubica los puntos en fila pareja.
- Archivos del repo además de `index.html`: `.github/workflows/snapshot-cartera.yml`, `scripts/fetch-snapshot.mjs`, `cartera.json`, `history.json`, `sales.json`.

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
