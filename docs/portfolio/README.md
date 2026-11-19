# Sinfreno: demo de portfolio

Sinfreno reúne ingreso de vehículos, cotización, registro de cobros,
comprobantes y turnos de caja para una cochera rotativa. El operador trabaja con
la patente y el importe; el administrador accede a historial y finanzas de su
sucursal. La demo usa exclusivamente datos ficticios.

React 19 y Vite 7 consumen una API FastAPI con SQLAlchemy, PostgreSQL 15 y
migraciones Alembic. Los importes usan Decimal/NUMERIC. Cada ingreso conserva
sus reglas y cada cobro confirma una cotización persistida de 120 segundos.
Las operaciones guardan su identidad para poder recuperar un resultado incierto.

## Recorrido en imágenes

Cinco capturas verificadas del navegador real, sobre el entorno QA local del
18/11/2026, actualizadas con la validación de patente y los iconos de operación.
Los valores representan operaciones sintéticas; cambian al seguir
usando la demo.

| Pantalla | Qué permite revisar |
| --- | --- |
| [Operación](screenshots/01-operacion.png) | Sucursal, caja, ingreso por patente y vehículos activos. |
| [Cotización](screenshots/02-cotizacion.png) | Importe del servidor, explicación, cortesía, vigencia y medio elegido. |
| [Comprobante de salida](screenshots/03-comprobante-salida.png) | Egreso DEMO005, ARS 1.500 por QR y advertencias explícitas. |
| [Caja](screenshots/04-caja.png) | Turno #4: ARS 2.000 recaudados, ARS 500 esperados y contados, diferencia cero. |
| [Historial](screenshots/05-historial.png) | Cuatro registros filtrados y acceso a sus comprobantes autorizados. |

## Qué se comprobó

El QA con Edge y backend real incluyó ingreso con Enter, actualización entre
sesiones independientes, recuperación después de F5 y vencimiento real de la
cotización antes de recalcularla. También se interrumpió una respuesta después
del commit: la pantalla conservó el intento y recuperó su resultado del servidor
tras recargar, con una sola estadía activa.

En caja se registraron ARS 500 en efectivo y ARS 1.500 por QR: recaudación ARS 2.000,
efectivo esperado ARS 500. Un cobro desde otra terminal actualizó el cierre,
conservó el conteo y las notas, y exigió revisarlos. Al cerrar ese turno y abrir
otro desde una segunda sesión, el diálogo original mantuvo su ID y bloqueó el
cierre. Norte conservó su propia caja y sus operaciones separadas.

Se distinguieron comprobantes de ingreso y salida, se descargaron PDF
autorizados y se verificó su contenido mediante rasterización del archivo real.
La vista de impresión tenía un fallo de CSS que producía páginas vacías; se
corrigió y se comprobó un recibo visible en una página, sin el dashboard.
El PDF del backend también separaba un aviso en una segunda página: se ajustó
la plantilla y se comprobó de nuevo el archivo renderizado. Una regresión cubre
cuatro combinaciones de ingreso/salida y fechas UTC/heredadas, con detalles y
avisos completos en una página A6. No se utilizó una impresora física.

El zoom nativo del 200% se verificó en los ajustes de Edge y por CDP: factor 2,
`devicePixelRatio=2`, zoom CSS 1 y ancho exterior 1366/interior 671 px. Los diálogos
conservaron acciones accesibles con Tab, Escape y desplazamiento vertical, sin
desborde horizontal. También se revisaron notebook 1366×768 y escritorio amplio.

Resultados, versiones, límites y pendientes exactos se mantienen en el
[registro único de continuidad](../recovery/RELEASE_2026-11-15.md). Las pruebas
técnicas anteriores incluyen PostgreSQL, concurrencia y la imagen productiva
sin herramientas de test; no representan resultados comerciales.

## Mostrar la demo

El [README del repositorio](../../README.md) explica cómo preparar la demo local
y sus cuentas ficticias. El [guion de 90 segundos](DEMO_90S.md) propone un recorrido
breve y contiene un borrador de LinkedIn sin publicar. Revisar el estado de caja
antes de grabar: las operaciones de QA modifican el escenario inicial.

No hay demo pública ni piloto en uso. Registrar QR o tarjeta no confirma una
transacción bancaria. Los comprobantes son internos, sin integración fiscal.
Quedan fuera abonos, reservas, barreras y sincronización offline. Un piloto exige
acordar tarifas, permisos, equipos, impresión, respaldo y contingencia con una
cochera real.
