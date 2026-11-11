# SF-02A — Autorización y aislamiento por sucursal

Fecha: 11/11/2026, America/Buenos_Aires.

Estado: **COMPLETO para SF-02A**, con la limitación visual indicada. Este informe
distingue pruebas de rutas, servicios HTTP/WS reales y la validación visual que
sigue pendiente por indisponibilidad de herramientas de navegador.

## Base y checkpoint SF-01

- Repositorio: `C:\dev\sinfreno`. Se releyeron las instrucciones aplicables; no
  aparecieron archivos `AGENTS.md` ni una auditoría histórica adicional adjunta.
- Se revisaron todos los cambios staged, unstaged y untracked, no sólo la última
  edición. Correspondían a SF-01, incluido casing, AuthContext, efectos, lint y
  configuración central. No se encontró una regresión concreta pendiente de ese bloque.
- El archivo real `01-entorno.md` ya tenía Markdown normal. No se hicieron
  reemplazos globales de escapes ni de rutas Windows. Se agregó una nota de checkpoint.
- Base anterior: `af72009b485120c13343c09b6bd1e6daaeeef670`.
- Checkpoint SF-01: **`4e36a2e77fad99316d8a29aad4d8538df89c09fa`**,
  `fix(recovery): restore reproducible SF-01 environment`, en `fix/recovery-01-entorno`.
- Nueva rama: **`fix/recovery-02a-accesos`**, creada desde ese checkpoint, sin
  merge, rebase, reset, clean ni stash.
- Implementación y pruebas SF-02A guardadas en
  **`161548518f8702d97bf73c448444ef94a41e1e5b`**,
  `fix(access): isolate branch operations, receipts and websocket sessions`.
  Este informe y la entrada del README se guardan en un commit de documentación
  separado; su SHA final queda en el rango del patch entregado.
- Se excluyó el cambio previo de `backend/app_audit.log`, así como `.env`, cachés
  y `.recovery/`. El usuario no aportó resultados manuales nuevos: la revisión visual
  de SF-01 permanece pendiente.

## Política adoptada

Se conservan roles y permisos existentes. La firma y expiración del JWT identifican
un usuario; el rol, los permisos y la sucursal se vuelven a obtener de PostgreSQL.
Los claims adicionales de rol/sucursal enviados por un cliente no conceden acceso.

- **ADMIN** administra sólo su sucursal. Sus permisos efectivos son `ingreso`,
  `salida`, `ver_ocupacion`, `ver_stats`, `ver_historial` y `config_sucursal`.
- **OPERADOR** sólo recibe los permisos conocidos concedidos: los cinco anteriores
  excepto `config_sucursal`. Se eliminan espacios del CSV existente; valores
  desconocidos no conceden nada. No se interpreta `all` como privilegio local.
- **SUPERADMIN** conserva únicamente sus rutas globales explícitas; aunque se le
  asignara una sucursal, no pasa las barreras de operaciones locales.
- Un perfil operativo es un ADMIN local o un OPERADOR con al menos uno de los
  cinco permisos operativos conocidos y una sucursal/empresa existente. Tiene las
  lecturas mínimas de configuración, activas, ocupación y estado de caja necesarias
  para usar el dashboard. Esto mantiene funcionales perfiles con sólo ingreso,
  sólo salida, historial, ocupación o estadísticas.
- Un ADMIN puede crear otro **ADMIN local** deliberadamente: la interfaz ya ofrecía
  esa función. La sucursal se hereda del administrador autenticado. Roles locales se
  normalizan; SUPERADMIN y desconocidos se rechazan. Campos extra, roles y permisos
  no concedibles se rechazan antes de insertar. `config_sucursal` queda reservado
  a ADMIN; no se puede delegar a OPERADOR.

### Matriz de accesos efectivamente montados

Los paths HTTP de la tabla llevan el prefijo `/api/v1`, excepto `/` y `/ws`.
"Local" siempre significa la sucursal del usuario persistido, no toda su empresa.

| Endpoint o canal | Rol / permiso | Alcance | Datos |
| --- | --- | --- | --- |
| `GET /` | Público | Servicio | Salud y versión |
| `POST /auth/login` | Credenciales válidas | Usuario | Token y perfil efectivo |
| `POST /auth/discovery` | Público, flujo previo al login existente | Email consultado | Marca pública de la empresa o marca genérica; no entrega operaciones |
| `GET /auth/me` | Autenticado | Propio | Rol, permisos efectivos, sucursal y configuración actual |
| `GET /auth/users` | ADMIN | Local | Cuentas locales, sin hashes/passwords |
| `POST /auth/users` | ADMIN | Local heredado | Alta ADMIN/OPERADOR validada |
| `DELETE /auth/users/{id}` | ADMIN | Local; no propia cuenta ni cuentas globales | Resultado de eliminación |
| `POST /parking/ingreso` | `ingreso` | Torre local | Operación individual propia |
| `POST /parking/salida` | `salida` | Estadía activa local, antes del bloqueo | Operación individual y su importe cobrado |
| `GET /parking/activas` | Perfil operativo | Local | Estadías activas, datos operativos; no recaudación agregada |
| `GET /parking/config` | Perfil operativo | Local | Tarifas, reglas y torres necesarias para operar |
| `PATCH /parking/config` | ADMIN | Local | Configuración local; no cambia la marca compartida de Empresa |
| `GET /parking/historial` | `ver_historial` | Local | Historial individual con importes y paginación acotada |
| `GET /parking/auditoria` | ADMIN | Local | Últimos 100 registros de esa sucursal |
| `GET /stats/summary` | Perfil operativo | Local | Ocupación; `recaudacion_hoy` sólo con `ver_stats` |
| `GET /stats/revenue-hourly` | `ver_stats` | Local | Recaudación agregada por hora |
| `GET /stats/peak-hour` | Perfil operativo | Local | Volumen y hora pico, sin importes |
| `GET /cash/status` | Perfil operativo | Local | ADMIN recibe detalle; OPERADOR sólo id, fechas, estado y usuario de apertura |
| `POST /cash/abrir`, `/cash/cerrar` | ADMIN | Local | Resultado y detalle de su caja |
| `GET /cash/history` | ADMIN | Local | Cierres de su caja |
| `GET /parking/{id}/pdf` activo | `ver_historial`, o `ingreso` y autor de esa entrada | Local, antes de generar | Comprobante individual de ingreso |
| `GET /parking/{id}/pdf` finalizado | `ver_historial`, o `salida` y autor de ese egreso | Local, antes de generar | Comprobante individual con cobro |
| `POST /superadmin/provision` | SUPERADMIN | Global explícito | Aprovisionamiento de empresa/sucursal/ADMIN |
| `GET /superadmin/global-stats` | SUPERADMIN | Global explícito | Estadísticas globales |
| `/ws/{sucursal_id}` | Perfil operativo + Origin permitido + token válido | Sólo sucursal propia | Avisos mínimos `event` e `id`; configuración sólo `event` |

`admin.py` contiene un router global antiguo que **no está montado**; no se agregó
una segunda vía de aprovisionamiento. Los rechazos usan 401 + `WWW-Authenticate:
Bearer` para credenciales, 403 para privilegios, 404 para una estadía/cuenta/PDF
ajenos o inexistentes y 422 para payloads de alta inválidos. Una torre ajena se
rechaza con 403. No se revela dónde está una patente ajena al intentar egresarla.

### Caja y datos financieros

Un OPERADOR con `salida` puede ver el importe de la operación que acaba de ejecutar
y descargar su comprobante. Eso no le concede recaudación diaria/horaria ni cierres.
`ver_stats` concede los agregados locales de forma expresa; `ver_historial` concede
los registros individuales históricos y sus PDF locales. Sin `ver_stats`, summary
**omite** `recaudacion_hoy`: no lo devuelve como cero o null ni ejecuta esa consulta.

ADMIN consulta, abre y cierra la caja local. OPERADOR consulta únicamente si está
abierta y opera con la caja que abrió un ADMIN; la interfaz no le ofrece abrirla,
cerrarla ni consultar cierres. No se cambió el cálculo del arqueo ni se añadió una
nueva regla backend de obligatoriedad de caja para cobrar: eso sigue en el bloque
operativo posterior. Los eventos no contienen importes, patentes, fechas ni medios
de pago, incluso para destinatarios autorizados a ver reportes.

## Cambios y motivos

- `core/access_policy.py`, `api/dependencies.py`, `core/security.py`: controles
  reutilizables, permisos efectivos y JWT con expiración obligatoria y subject
  decimal positivo dentro del rango Integer de PostgreSQL. Subject enorme,
  malformado, usuario ausente, firma/password/hash inválidos se rechazan sin 500.
- Rutas `auth`, `parking`, `cash`, `stats`, `superadmin`: barreras de permisos y
  sucursal, `/auth/me`, alta local con allowlist y errores globales controlados.
  La autorización ocurre antes de mutaciones y de eventos de éxito.
- `services/parking_service.py`: la salida filtra `Torre.sucursal_id` antes de
  `SELECT FOR UPDATE OF estadias`; conserva el bloqueo de fila. La patente activa
  duplicada se comprueba dentro de la sucursal, permitiendo la misma patente en
  otra cochera sin interferir con su estadía.
- Modelo Estadia y migración **`d24ac9f31e02`**, sobre `ab35d88bd0a4`: snapshot
  nullable `tipo_vehiculo_registrado`. Los nuevos ingresos guardan el tipo por
  estadía; respuestas, PDF y cálculo leen ese snapshot. No se modifica el tipo
  global al operar otra sucursal. El backfill conserva el tipo global conocido
  para las estadías anteriores; no puede reconstruir tipos históricos ambiguos.
  No se cambiaron tarifas, redondeos ni fórmula de cobro.
- `services/stats_service.py` y schemas: omisión real de agregados no autorizados
  y respuesta operacional de caja sin campos financieros.
- La marca vive en Empresa y afecta a sucursales hermanas. ADMIN local no puede
  cambiar logo/color compartidos mediante PATCH de su sucursal. Se permiten valores
  idénticos como no-op para compatibilidad; la interfaz los muestra de sólo lectura.
  Una futura edición de marca debe tener gestión global explícita.
- `main.py`, `core/websocket_auth.py`, `core/websocket_manager.py`: handshake,
  revalidación y avisos mínimos. El registro ya autenticado precede al ACK para no
  perder el primer evento si el cliente opera inmediatamente después de recibirlo.
- Frontend `api/realtime.js`, `session.js`, Axios y AuthContext: autenticación WS,
  restauración de perfil desde `/auth/me`, cierre por logout/401 y permisos efectivos.
- Dashboard, EntryForm y ActiveTable: resultado/toast/comprobante de ingreso o
  cobro desde su respuesta HTTP. El evento sólo refresca lecturas autorizadas;
  no abre comprobantes ni duplica la notificación en otras terminales.
  `CONFIG_UPDATED` refresca perfil/configuración sin crear un bucle de reconexión.
- TicketModal: descarga PDF con Axios autenticado y Blob, errores visibles y
  cancelación al cerrar. No lleva JWT en URL. Se retiró el enlace público de
  WhatsApp; compartir con conductores queda fuera de esta entrega.
- `docker-compose.access.yml`, fixtures, smoke y tests: recursos separados y
  comprobaciones reproducibles. No se agregaron dependencias ni se alteró el lock.

## Protocolo WebSocket y revocación

Se valida exactamente **un Origin** de `CORS_ORIGINS`; se rechazan Origin ausente,
`null`, `*`, ajeno, duplicado o cualquier query string antes de aceptar. La lista
es explícita; CORS HTTP por sí solo no protege WebSocket. En esta prueba permite
`http://127.0.0.1:15174` y `http://localhost:15174`.

Tras abrir el transporte hay hasta 5 segundos para enviar
`{"type":"authenticate","token":"<credencial>"}`. Antes de validarlo no hay sala,
ACK ni datos protegidos. El servidor verifica JWT, usuario, rol/permisos y sucursal.
Responde `{"type":"authenticated"}` y conserva sólo id de usuario/sucursal/exp,
no el JWT. La conexión se cierra al vencimiento incluso inactiva. El cliente espera
ACK con un límite de 7 segundos y termina sin reconectar por rechazo de acceso.

Cada broadcast y mensaje entrante vuelve a consultar PostgreSQL; eliminación,
reasignación o pérdida de permisos operativos impiden el siguiente envío. Una
conexión totalmente inactiva no tiene revocación inmediata por cambio de usuario:
se detecta con actividad o al vencer la credencial. Se admite `{"type":"ping"}`
con respuesta pong después de revalidar. Códigos: 4401 credencial inválida/vencida,
4403 rol/sucursal/permiso, 1008 protocolo inválido, 1011 fallo interno cerrado.

El cliente hace como máximo cinco reintentos transitorios por ciclo con backoff
de 1, 2, 4, 8 y 15 segundos; 4401 termina sesión, 4403/1008 terminan reconexión.
Logout y 401 cierran el socket y cancelan timers. No se registran tokens ni se
incluyen en URLs. En un despliegue futuro deben usarse HTTPS/WSS.

También se escucha la eliminación del token mediante el evento `storage` de otras
pestañas del mismo origen, incluido `localStorage.clear()`: termina el contexto y
el socket local. No se sincronizan identidades cuando se reemplaza un token por
otro usuario; para dos cuentas simultáneas se requieren perfiles independientes.
El mecanismo entre pestañas se revisó estáticamente y pasó lint/build; su
comprobación real en navegador continúa pendiente.

## Verificación y evidencia

| Comprobación | Resultado |
| --- | --- |
| Revisión de SF-01 y checkpoint explícito | Aprobado, commit `4e36a2e`; log previo excluido |
| PostgreSQL nuevo y migraciones hasta `d24ac9f31e02` | Aprobado, sin reutilizar SF-01 |
| `tests/test_access_integration.py` con PostgreSQL y autenticación real | **53 aprobados**; sin dependency overrides de autenticación |
| `tests/test_billing.py` existente | 6 aprobados; replica fórmula, no certifica el servicio real de cobro |
| Suite conjunta | 59 aprobados en 89.46 s; 17 warnings de deprecación de dependencias existentes |
| Repetición de los casos WS tras ajuste de ACK | 10 aprobados, 43 no seleccionados, 23.30 s |
| Smoke contra Uvicorn levantado y conexiones WS de red | Aprobado: login real, tres salas aisladas con eventos de ingreso y salida, rechazados sin datos/eventos de éxito y PDF autenticado |
| Backfill con una estadía anterior en `sf02a_migration_disposable` | Aprobado: upgrade desde `ab35d88bd0a4` conserva snapshot MOTO |
| Windows: lint, conexiones, lifecycle WS y build | Aprobados; 6 + 6 tests; tras ajuste storage, lint/build repetidos: 18.20 s, warning de bundle |
| Linux: lint, conexiones, lifecycle WS y build | Aprobados; 6 + 6 tests; tras ajuste storage, lint/build repetidos: Vite 6.4.3, 18.90 s, bundle 871.95 kB |
| Navegador visual | **No ejecutado**: inventario vacío; `Computer Use native pipe is unavailable` y `The browser access host is unavailable` |
| Conservación final | Aprobada: IDs y volúmenes anteriores intactos; `.env` y log iguales byte a byte; SF-01 permanece en `ab35d88bd0a4` |
| Dependencias backend | `pip check` aprobado; no se agregaron paquetes |
| Patch | Se exporta después del commit de este informe, con revisión de rutas y comparación con valores secretos del `.env` previo sin imprimirlos |

El smoke adicional de red pasó con HTTPX y websockets 12 instalados previamente,
contra Uvicorn dentro del contenedor, sin interceptar respuestas ni generar
eventos artificiales. Se rechazaron Origin/sucursal ajenos y un socket sin
autenticar no recibió los eventos reales emitidos durante su plazo de autenticación.
Los tres operadores realizaron sus propios ingresos/egresos y sólo recibieron sus
avisos mínimos; se descargó un PDF propio y se rechazaron anónimo/ajeno.
Desde Windows también se comprobó HTTP 200 del frontend 15174, módulo público con
API 18001 resuelta y preflight CORS 200 con Origin 15174 exacto. Eso no renderiza
React ni verifica una descarga desde navegador.

Las pruebas de rutas usan FastAPI TestClient con la aplicación y PostgreSQL reales:
login, JWT firmado y verificación de permisos normales. No sustituyen autenticación
por usuarios falsos. Los datos son sintéticos: dos empresas, tres sucursales, dos
de ellas hermanas, administradores y operadores con permisos distintos. Se comprueban
filas antes/después de rechazos y colas reales de eventos de las rutas, no sólo
apertura/cierre del socket. Los tests de lifecycle frontend simulan WebSocket y
timers: son unitarios, no integración de navegador. Ninguna prueba HTTP se presenta
como validación visual.

Los casos cubren: JWT inválido/vencido/malformado; alta SUPERADMIN rechazada sin
inserción; alta ADMIN/OPERADOR válida heredada; claims manipulados ignorados;
provisión global legítima y rechazo local; permisos de ingreso/salida; lectura
operativa mínima; scope de activas/historial/config/users/auditoría/caja/estadísticas;
patente compartida con tipos independientes; rechazos ajenos sin mutación;
finanzas omitidas; PDF anónimo, ajeno, propio y con permiso insuficiente;
Origin/auth/scope/expiry WS; eventos mínimos aislados y revalidación tras cambios DB.

## Recursos y arranque

Se conservaron la demo **`sinfreno-sf01-20261110`**, su volumen, imágenes y puertos
15173/18000/15432. SF-02A usa exclusivamente:

- Proyecto `sinfreno-sf02a-20261111` y red propia de ese nombre.
- Contenedores `sinfreno-sf02a-20261111-{db,backend,frontend}-1`, sin nombres fijos
  globales ni bind mounts del código, `.env` o log del host.
- Volumen `sinfreno-sf02a-20261111_access_postgres`, nuevo y descartable.
- DB `sf02a_disposable` para fixtures/tests/demo y `sf02a_migration_disposable`
  para verificar el backfill con esquema anterior; ambas nuevas dentro de ese volumen.
- Puertos loopback: frontend **15174**, API **18001**, PostgreSQL **15433**.
- Telegram vacío explícitamente; no se efectuaron envíos externos. Se ejerció
  apertura/cierre sintético de caja sólo para comprobar su autorización.

Al entregar siguen activos y sanos los tres servicios SF-02A y los tres SF-01.
El único volumen agregado durante SF-02A es el indicado arriba. Los contenedores
previos conservan sus IDs; no se hicieron operaciones contra sus datos. El hash
Git del log previo permanece `09ce76e6336e32574fbe387a88c5b66d9484ebe6`, fuera de
los commits. La demo nueva conserva los fixtures y tres estadías sintéticas
finalizadas por el smoke, además de las seis estadías de preparación.

En **PowerShell**, con Docker Desktop iniciado, desde la raíz:

```powershell
Set-Location C:\dev\sinfreno
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml up -d --build --wait --wait-timeout 120
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml ps
```

Abrir **http://127.0.0.1:15174**. Tras preparar fixtures, usar
`admin_a1@sf02a.example.com` u `op_a1@sf02a.example.com`; password ficticia común
`sf02a-demo-only`. `admin_a2` y `op_a2` pertenecen a la sucursal hermana; `admin_b1`
y `op_b1` a la segunda empresa (mismo dominio de ejemplo y password). Swagger:
http://127.0.0.1:18001/docs. No usar la URL SF-01 para revisar la nueva autorización.

Comandos **destructivos sólo para la DB descartable SF-02A**: requieren bandera,
nombre, usuario y host exactos, y Telegram vacío; de lo contrario se niegan a resetear.
No ejecutarlos contra una base cuyo propósito no esté confirmado.

```powershell
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml exec -T -e SF02A_ALLOW_RESET=1 backend python -m pytest -q -p no:cacheprovider tests/test_access_integration.py tests/test_billing.py
# Restaurar los datos sintéticos para demo/smoke después de los tests:
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml exec -T -e SF02A_ALLOW_RESET=1 backend python scripts/access_test_data.py
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml exec -T -e SF02A_ALLOW_RESET=1 backend python scripts/access_smoke.py
```

El smoke no reinicia datos: crea y finaliza operaciones sintéticas mediante HTTP
y verifica sus eventos por WS. Se ejecuta dentro del backend contra Uvicorn en
loopback 8000, no contra TestClient. Para dejar una demo sin sus operaciones de
smoke se puede volver a ejecutar únicamente el preparador de fixtures anterior.
Un primer arranque del Compose aún ejecuta el seed histórico; los fixtures de este
informe se preparan con el comando explícito. Eso no modifica cuentas de SF-01.

Validación frontend reproducible dentro de Linux:

```powershell
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml exec -T frontend npm run lint
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml exec -T frontend npm run test:connections
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml exec -T frontend npm run test:realtime
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml exec -T frontend npm run build
```

En Windows usar `npm.cmd`; no se cambió ExecutionPolicy. No se validó Python nativo
ni Git Bash: se mantiene el intérprete Linux de Docker del entorno recuperado.
Para detener solamente SF-02A conservando sus datos:

```powershell
docker --context desktop-linux compose -p sinfreno-sf02a-20261111 -f docker-compose.access.yml stop
```

## Límites, pendientes y revisión externa

- **SF-02B:** secretos históricos/rotación, cuentas demo y arranque seguro,
  clasificación/remediación de los nueve avisos npm ya registrados en SF-01 y
  deprecaciones existentes. No se hizo audit fix, cambio masivo ni rotación externa.
  `start.sh` conserva el seed histórico: reiniciar un backend puede agregar esas
  cuentas/empresas ficticias además de los fixtures. No se considera un arranque
  publicable; su revisión general pertenece a SF-02B.
- **SF-03 y etapas operativas:** cálculo/arqueo, persistencia de auditoría,
  concurrencia de alta Vehiculo/patente y capacidad, idempotencia, saneamiento del
  dominio global Vehiculo y reconstrucción de tipos históricos ambiguos. El tipo
  por estadía es un ajuste mínimo para aislar sucursales, no una migración amplia.
- WS manager es local a un proceso; no se certificó múltiples workers, carga ni
  coordinación distribuida. Revalida DB con actividad; no hay revocación inmediata
  en total inactividad antes del vencimiento. No se probó un proxy HTTPS real.
- No se amplió el flujo público de discovery ni se diseñó compartir PDF público;
  su marca sigue siendo pública como en el login existente.
- Validación visual y descarga desde navegador permanecen pendientes por herramienta
  indisponible; no se incorporaron supuestos resultados manuales.
- Sin push, PR, publicación, despliegue ni cambios en credenciales externas.

Patch de revisión: **`.recovery/02a-review.patch`**, fuera de Git. Comparación desde
`af72009b485120c13343c09b6bd1e6daaeeef670` hasta el HEAD final de
`fix/recovery-02a-accesos`, incluyendo el checkpoint SF-01 y los commits SF-02A.
El rango exacto final se informa al entregar y en `.recovery/02a-review-range.txt`.
Se revisa que no contenga el log previo, `.env`, credenciales reales ni cachés.

Verificaciones manuales sugeridas (máximo tres):

1. En 15174, entrar como `op_a1`, recargar con F5 y confirmar dashboard operativo,
   caja sólo de consulta y ausencia de reportes financieros generales.
2. Registrar y finalizar una patente ficticia propia; confirmar una sola
   notificación local, resultado HTTP y descarga PDF autenticada; cerrar sesión
   y comprobar cierre WS también en otra pestaña del mismo origen.
3. En una ventana incógnita o perfil independiente, entrar como `op_a2` y comprobar
   que no ve operaciones de `op_a1` (dos pestañas normales comparten localStorage);
   con `admin_a1`, comprobar alta local y edición de configuración de su sucursal.

Completar SF-02A no certifica publicación ni operación comercial.
