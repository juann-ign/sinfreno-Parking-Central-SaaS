# Sinfreno: guion de 90 segundos

Preparar dos sesiones con las cuentas ficticias de operador y administrador.
Usar una caja abierta y una patente nueva; elegir además una estadía con importe
positivo si se quiere mostrar un cobro. Un ingreso recién creado puede costar
cero por cortesía. No alterar fechas ni tarifas para acomodar la grabación.

| Tiempo | Acción y relato sugerido |
| --- | --- |
| 0–10 s | Mostrar la pantalla del operador. «Sinfreno concentra la operación de una cochera rotativa. Esta demo local usa datos ficticios y separa datos y permisos por sucursal». |
| 10–25 s | Escribir una patente y presionar Enter una vez. «El ingreso queda registrado con su categoría, sector y reglas. La otra sesión recibe la actualización». |
| 25–45 s | Cotizar una estadía activa. «El servidor calcula el importe y explica tiempo, tarifa y cortesía. La cotización tiene vigencia; si vence, hay que actualizarla antes de confirmar». |
| 45–60 s | Elegir un medio, confirmar una vez y abrir el comprobante. «Esto registra el cobro y el medio elegido; no acredita una transacción bancaria. El comprobante diferencia ingreso de salida». |
| 60–72 s | Cerrar el comprobante, recargar y recuperarlo en Mis comprobantes. «Si se pierde una respuesta, se conserva el mismo intento para consultar su resultado. Recargar no obliga a repetir la operación». |
| 72–85 s | Cambiar a administrador y mostrar un turno con medios mixtos. «El arqueo separa recaudación total de efectivo esperado. Si otra terminal cambia los importes, pide revisarlos y conserva el conteo». |
| 85–90 s | Cerrar sobre la pantalla. «React, FastAPI y PostgreSQL sostienen el circuito. La siguiente etapa es validar la operación con una cochera real». |

Si no hay un intento incierto preparado, describir su recuperación sin crear una
falla durante la grabación. El ensayo observado está documentado en el
[registro de QA](../recovery/RELEASE_2026-11-15.md). Descargar PDF o generar una
vista de impresión no acredita una impresión física. La revisión manual breve
pendiente se consulta únicamente en ese registro.

## Borrador de LinkedIn — sin publicar

Estoy desarrollando Sinfreno, un sistema de gestión para cocheras rotativas,
como proyecto de portfolio y base para un futuro piloto.

El recorrido reúne ingreso por patente, cotización con vigencia, registro del
cobro, recuperación de comprobantes y cierre de caja por turno. El QA en
navegador real incluyó dos terminales, sucursales separadas y recuperación de una
respuesta perdida sin duplicar el ingreso.

Con React, FastAPI y PostgreSQL trabajé también los detalles que sostienen esas
pantallas: importes exactos, permisos, transacciones y reintentos persistidos.

La demo usa datos ficticios. Los comprobantes son internos y registrar un medio
de pago no confirma una transacción bancaria. Todavía no hay un piloto en uso;
la próxima etapa es acordar y validar el circuito con una cochera real.

Antes de publicar, agregar el enlace definitivo del repositorio y seleccionar
las capturas verificadas. Este texto no se envió a LinkedIn.
