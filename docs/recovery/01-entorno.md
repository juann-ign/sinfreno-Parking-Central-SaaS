# SF-01 — Recuperación del entorno

Fecha: 10/11/2026 (America/Buenos_Aires).

Estado: **PARCIAL**. Implementación recuperada; queda pendiente la comprobación visual y autenticada en navegador, porque los servicios de acceso al navegador y a aplicaciones no están disponibles en esta sesión. Las pruebas HTTP reales se distinguen abajo de esa comprobación pendiente. No se publicó, hizo push, PR ni despliegue.

## Estado inicial y conservación

- Raíz: `C:\dev\sinfreno`. No se encontraron instrucciones `AGENTS.md` aplicables en la raíz, sus ancestros ni el árbol del proyecto.
- Rama inicial: `feat/superadmin-provisioning`; HEAD `af72009b485120c13343c09b6bd1e6daaeeef670`, también presente en `origin/feat/superadmin-provisioning`, sin upstream configurado.
- Único cambio previo visible: una línea unstaged en `backend/app_audit.log`. No había cambios staged ni archivos untracked visibles. `backend/.pytest_cache` ya tenía acceso denegado; no se alteraron sus permisos ni contenido.
- `develop` local: `4524fb66617febae13eb4501a28d7e3760799662`; HEAD estaba 37 commits por delante. La referencia remota local estaba desactualizada (`f5dc49d`); `git fetch origin` la actualizó a `269214416b6bf07d3d5d072a5325eaa8a2995478`.
- HEAD es ancestro de la referencia auditada, con 47 commits adicionales en `origin/develop` (integraciones). **Ambos árboles son idénticos**, SHA de árbol `8b32208941ffa7b28ce53c85aeccbe5e2310c4b8`. Se conservó HEAD como base para no reemplazar trabajo ni historial local; no era necesario mergear para recuperar el mismo código.
- Rama creada: `fix/recovery-01-entorno`, base `af72009b485120c13343c09b6bd1e6daaeeef670`, sin upstream. No se crearon commits al quedar pendiente la verificación de navegador. Los renombrados por casing están staged por `git mv`; el resto de la implementación queda en el árbol de trabajo.
- No se encontró `auditoria_sinfreno_2026-11-10.md` en el proyecto ni en el directorio del adjunto. Se usaron la consigna y el código real; no se modificó ninguna auditoría histórica.
- No se hicieron reset, clean, stash, pull ni merge. Se mantuvieron las ramas existentes, `.venv`, `backend/.env`, el Compose original y el log previo.

## Herramientas encontradas

| Herramienta | Resultado |
| --- | --- |
| Node Windows | 24.14.1 |
| npm Windows | 11.11.0; ejecutar `npm.cmd` en PowerShell, porque la política local bloquea `npm.ps1` |
| Python Windows | `py` instalado, sin intérpretes registrados. `.venv` previa apunta a Python 3.12.5 ausente; se conservó intacta |
| Docker CLI / Engine Linux | 29.8.2 |
| Docker Compose | v5.6.0 |
| WSL | distribución `docker-desktop`, inicialmente detenida; usada por Docker Desktop |
| Python del contenedor | 3.11.18 |
| Node del contenedor | 22.23.3 (imagen ya disponible en el equipo) |
| npm del contenedor | 10.9.9 |
| PostgreSQL del contenedor | 15.19 |

Docker Desktop estaba detenido. Se inició de forma oculta. Al arrancar el daemon, se iniciaron por su propia configuración tres contenedores ajenos (`py-lab`, `php-lab`, `node-lab`); no se ejecutaron operaciones de creación, parada ni eliminación contra ellos.

El sandbox permite leer `.git`, pero requiere escalación para escribirlo, acceder al daemon y descargar paquetes. Los primeros intentos sin escalación fallaron por permisos; las operaciones autorizadas se repitieron con escalación aprobada. No se cambió la política de ejecución de PowerShell.

## Cambios y propósito

| Archivos | Propósito |
| --- | --- |
| `frontend/pages/{Login,Dashboard,History}.jsx`, `frontend/components/StatCard.jsx` | Registrar casing PascalCase en Git mediante nombres temporales y dos `git mv` por archivo. Windows ya mostraba esos nombres, pero el índice conservaba minúsculas |
| `frontend/src/App.jsx`, `frontend/pages/Dashboard.jsx` | Imports coherentes, incluido `CashModal.jsx` |
| `frontend/package.json`, `package-lock.json`, `eslint.config.js` | Declarar ESLint y paquetes importados, reconocer usos JSX, lint sin warnings y script de tests de conexiones |
| `frontend/components/{ActiveTable,CashModal,EntryForm,OccupancyPieChart,RevenueChart,Skeletons,StatCard,TicketModal}.jsx`, páginas y `src/App.jsx` | Quitar imports/variables sin uso y corregir efectos y dependencias necesarios para pasar las reglas recomendadas, sin desactivarlas |
| `frontend/src/context/{AuthContext.jsx,auth-context.js,useAuth.js}` | Separar Provider, instancia de contexto y hook para Fast Refresh; estabilizar `hasPermission` conservando sus permisos actuales |
| `frontend/pages/Settings.jsx` | Inicializar formulario desde la sucursal y resincronizar mediante su clave, evitando setState síncrono en efecto |
| `frontend/config/connections.js`, `connections.test.js`, `.env.example` | Configuración pública centralizada, validación y seis pruebas de comportamiento de URLs |
| `frontend/api/axios.js`, `pages/Dashboard.jsx`, `components/TicketModal.jsx` | Consumir configuración central para API, WebSocket y enlaces PDF. Codificar el mensaje de WhatsApp completo; no se enviaron mensajes |
| `docker-compose.recovery.yml` | Entorno descartable independiente con DB, backend y frontend; puertos loopback, volumen/red propios, healthchecks y Telegram vacío |
| `backend/.dockerignore`, `frontend/.dockerignore` | Excluir `.env*`, logs, bases, cachés y dependencias locales de las imágenes |
| `backend/Dockerfile` | Normalizar CRLF de `start.sh` durante el build para arrancar en Linux desde Windows |
| `frontend/Dockerfile.recovery` | Instalación limpia con lock y Vite en Linux, sin montar archivos previos del host |
| `backend/scripts/recovery_smoke.py` | Login ficticio y lecturas autenticadas reales; rechaza destinos remotos y no imprime token ni modifica datos |
| `.gitignore` | Ignorar `.recovery/`, que contiene cachés, inventario y logs locales descartables |
| `README.md`, `frontend/README.md`, este informe | Entrada a las instrucciones de recuperación, desarrollo nativo y evidencia |

Dependencias agregadas sólo para lint: ESLint y `@eslint/js` 9.39.5, `globals` 16.5.0, `eslint-plugin-react` 7.37.5, hooks 7.1.1 y refresh 0.5.7. ESLint 9 es compatible con los peers del plugin React seleccionado; el registry ya lo marca fuera de soporte. Se registra esa limitación. No se actualizaron versiones del stack de aplicación ni requisitos del backend. La única dependencia previamente existente cuyo número cambió en el lock fue `es-object-atoms` 1.1.1 → 1.1.2, al resolver el árbol de lint; no se quitaron paquetes existentes.

## Configuración de conexiones

Todas las variables `VITE_*` son **públicas** y quedan embebidas en el frontend. Nunca poner allí claves, passwords ni tokens.

| Variable | Valor por defecto / significado |
| --- | --- |
| `VITE_BACKEND_URL` | `http://localhost:8000`; raíz HTTP(S) del backend, con prefijo opcional |
| `VITE_API_BASE_URL` | Override opcional; por defecto raíz anterior + `/api/v1` |
| `VITE_WS_BASE_URL` | Override opcional; por defecto raíz anterior + `/ws`; se agrega el identificador de sucursal |

Los enlaces de comprobantes se derivan de la base API + `/parking/{id}/pdf`. `https://parking.example/sinfreno/` produce API `https://parking.example/sinfreno/api/v1`, WS `wss://parking.example/sinfreno/ws/{id}` y PDF bajo el mismo prefijo. HTTP se convierte en WS y HTTPS en WSS. Los valores que empiezan con `/` se resuelven sobre el origen del frontend; el proxy deberá publicar esos prefijos. Los overrides de WS aceptan HTTP(S) o WS(S). Se rechazan protocolos incorrectos, credenciales, query y fragmentos; los identificadores se codifican como segmentos.

El Compose de recuperación pasa `VITE_BACKEND_URL=http://127.0.0.1:18000`; la URL se usa desde el navegador del host, no como DNS interno de Docker. Sus CORS permiten `http://127.0.0.1:15173` y `http://localhost:15173`.

Para Vite nativo, usar `frontend/.env.example` como referencia y crear `.env.local` sólo si se necesita un override. Reiniciar Vite tras cambiar variables; reconstruir un frontend empaquetado. Los tests de TLS/prefijos validan construcción de URLs; no certifican un proxy HTTPS real.

## Recursos de prueba

Proyecto: **`sinfreno-sf01-20261110`**, inexistente en el inventario inicial. El Compose original fija `sinfreno_db`, `sinfreno_api`, puertos 5432/8000 y el volumen `sinfreno_postgres_data`; no se utilizó.

Recursos nuevos del proyecto de prueba:

- Contenedores: `sinfreno-sf01-20261110-db-1`, `-backend-1`, `-frontend-1`.
- Volumen: `sinfreno-sf01-20261110_recovery_postgres`, nuevo y descartable; se conserva para volver a abrir la demo.
- Red: `sinfreno-sf01-20261110_default`, dedicada al proyecto.
- Imágenes locales de backend/frontend con el prefijo del proyecto; imagen descargada `postgres:15-alpine`.
- Publicaciones: `127.0.0.1:15432` (DB), `127.0.0.1:18000` (API), `127.0.0.1:15173` (frontend). Esos puertos estaban libres inicialmente.
- DB `sf01_demo`, con credenciales ficticias exclusivamente locales declaradas en Compose; 2 empresas, 2 sucursales, 2 torres, 4 usuarios. Ninguna base previa se reutilizó.
- `.recovery/`: inventario inicial de Docker/volúmenes, hashes de conservación, caché npm, log de build Compose y `backend-pip-freeze.txt`. Está ignorado por Git; no contiene valores del `.env` previo.

Al terminar, **los tres contenedores siguen activos y sanos**, con las publicaciones anteriores. Se conservan el volumen, la red y las imágenes de prueba para que se pueda abrir la aplicación.

La primera red de prueba era `internal`. Docker registró las publicaciones en HostConfig, pero dejó NetworkSettings.Ports vacío; falló HTTP desde el host. Se corrigió usando la red bridge dedicada normal. Se recrearon **sólo** contenedores y red de este proyecto mediante `down` sin `-v`; su volumen nuevo se conservó. Telegram se desactiva mediante ambas variables vacías; su servicio retorna antes de crear una petición HTTP. No se ejecutaron cobros, cierres de caja ni envíos externos.

Las imágenes no incluyen `.env` del host ni montajes de su backend. Se comprobó en ejecución que no existe `/app/.env` y que la configuración de Telegram está vacía. No hay garantía de bloqueo general de salida a Internet en la red final.

## Comandos y resultados

Los comandos se ejecutaron desde PowerShell en `C:\dev\sinfreno`, usando `docker --context desktop-linux`. `docker compose exec ...` ejecuta Linux dentro de cada contenedor.

| Verificación | Resultado y alcance |
| --- | --- |
| `git status --short --branch`, `git log`, `git branch -avv`, diffs staged/unstaged/untracked | Ejecutado; inventario descrito arriba; ningún cambio previo descartado |
| `git fetch origin`, `git rev-list --left-right --count`, `git merge-base`, comparación de árboles | Ejecutado y aprobado; base y referencia auditada tienen el mismo árbol |
| Build Windows inicial `npm.cmd run build` | Aprobado, aunque no acreditaba casing Linux |
| Lint Windows inicial `npm.cmd run lint` | Falló por ESLint ausente; corregido |
| `npm.cmd ci --no-audit --no-fund --cache ..\.recovery\npm-cache` en frontend | Aprobado; instalación limpia de 348 paquetes desde lock |
| `npm.cmd run lint` | Aprobado sin errores ni warnings; no se desactivaron reglas ni se excluyeron fuentes relevantes |
| `npm.cmd run test:connections` | Aprobado, 6 tests; configuración/URLs, no integración |
| `npm.cmd run build` | Aprobado; queda warning de bundle principal de aproximadamente 869 kB (sin comprimir) |
| `docker compose ... config --quiet` | Aprobado |
| Build backend desde `requirements.txt` en Python Linux | Aprobado; se instalaron las dependencias reales, sin cambiar requirements |
| Arranque backend / `start.sh` | Aprobado en recursos nuevos; migraciones, seed y Uvicorn ejecutados |
| `exec -T backend alembic current` | Aprobado: `ab35d88bd0a4 (head)`; ocho migraciones desde DB vacía |
| Consultas SQL al contenedor DB | Aprobado: versión Alembic y cantidades ficticias arriba; no se consultó el volumen previo |
| `exec -T backend python -m pip check` | Aprobado: `No broken requirements found` |
| `exec -T backend python scripts/recovery_smoke.py` | Aprobado: POST login, GET config/activas/summary contra FastAPI y PostgreSQL reales, sin mocks |
| `exec -T backend python -m pytest -q -p no:cacheprovider tests/test_billing.py` | Aprobado: 6 tests. Prueban una réplica de fórmula; no el servicio de cobro real |
| HTTP del host con red `internal` inicial | Ejecutado y fallido; configuración corregida como se explica arriba |
| `up -d --build --wait --wait-timeout 120` final | Aprobado; tres servicios sanos y publicaciones loopback correctas |
| Instalación Linux frontend `npm ci --no-audit --no-fund` durante build | Aprobado, 347 paquetes desde el mismo lock (la selección de paquetes opcionales varía por plataforma) |
| `exec -T frontend npm run lint` | Aprobado sin errores ni warnings en Linux |
| `exec -T frontend npm run test:connections` | Aprobado, 6/6 en Linux |
| `exec -T frontend npm run build` | Aprobado en Linux: Vite 6.4.3, 3014 módulos, 12.97 s; bundle 868.62 kB con warning de tamaño |
| Casing Linux | Aprobado: filesystem del contenedor contiene Login/Dashboard/History/CashModal con casing exacto y rechaza sus variantes en minúsculas; índice Git coincide |
| `Invoke-RestMethod http://127.0.0.1:18000/` desde Windows | Aprobado: `status=online` |
| `Invoke-WebRequest http://127.0.0.1:15173/` y `/config/connections.js` | Aprobado: HTTP 200; HTML contiene mount root y módulo transformado de Vite incorpora URL recovery. No equivale a renderizar la interfaz |
| OPTIONS login con Origin `http://127.0.0.1:15173` | Aprobado: HTTP 200 y allow-origin exacto; prueba HTTP de CORS, no navegador |
| Login ficticio desde Windows + cinco GET autenticados | Aprobado: ADMIN, sucursal 1; config, activas, summary, revenue-hourly e historial responden 200 contra API/DB reales |
| WebSocket desde Node Windows usando `createConnectionConfig` | Aprobado: apertura real a `ws://127.0.0.1:18000/ws/1` y cierre sin mensajes. No prueba autorización ni propagación de eventos |
| Pantalla de acceso y login en navegador | **No ejecutado**: `Computer Use native pipe is unavailable` y `The browser access host is unavailable`; inventario sin navegador accesible. HTTP no sustituye esta prueba |
| `git diff --check` y hashes de archivos previos | Aprobado; `.env` y log previo conservados byte a byte; inventario Docker final sin pérdidas |

`npm audit` se ejecutó sólo en lectura: 9 hallazgos (6 high, 3 moderate; 0 critical) en el árbol actual. No se corrió `audit fix`, ni actualizaciones masivas. Incluye Axios/Vite y dependencias transitivas, además de React Router. El informe de recuperación no certifica seguridad de esas versiones.

El backend conserva dependencias directas fijadas; las transitivas y los tags base de imágenes no están bloqueados por digest. `.recovery/backend-pip-freeze.txt` registra lo instalado en esta ejecución. Reconstrucciones futuras pueden resolver transitivas diferentes.

Control final de conservación: los tres contenedores ajenos mantienen sus IDs originales; no falta ningún volumen previo y el único volumen agregado es `sinfreno-sf01-20261110_recovery_postgres`. Las redes anteriores siguen presentes. Backend y frontend nuevos tienen `Mounts=[]`. Los SHA-256 de `backend/.env` y `backend/app_audit.log` coinciden antes/después; el hash Git del log sigue siendo `09ce76e6336e32574fbe387a88c5b66d9484ebe6`. El diff final sólo contiene los archivos intencionales de esta entrega y la misma modificación previa del log. No se inspeccionó el contenido de las bases previas.

## Abrir y volver a comprobar la aplicación

En **PowerShell**, con Docker Desktop iniciado, desde la raíz:

```powershell
Set-Location C:\dev\sinfreno
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml up -d --build --wait --wait-timeout 120
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml ps
```

Abrir **http://127.0.0.1:15173**. Cuenta ficticia de esta base: `admin@sinfreno.com`, password `admin123`. API: http://127.0.0.1:18000/docs. No usar estos datos para un entorno publicado.

Comprobaciones reproducibles dentro de los contenedores:

```powershell
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml exec -T frontend npm run lint
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml exec -T frontend npm run test:connections
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml exec -T frontend npm run build
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml exec -T backend python scripts/recovery_smoke.py
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml exec -T backend alembic current
```

El smoke usa por defecto `127.0.0.1:8000` **dentro del backend**. Para ejecutarlo con un Python del host haría falta `--base-url http://127.0.0.1:18000/api/v1`; no se validó Python nativo porque está ausente.

Para editar frontend desde Windows, detener sólo su contenedor (evita ocupar 15173) y usar Vite nativo en otra consola PowerShell:

```powershell
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml stop frontend
Set-Location C:\dev\sinfreno\frontend
$env:VITE_BACKEND_URL = 'http://127.0.0.1:18000'
npm.cmd ci --no-audit --no-fund --cache ..\.recovery\npm-cache
npm.cmd run dev -- --host 127.0.0.1 --port 15173 --strictPort
```

La instalación nativa está verificada; el arranque nativo de Vite se indica como alternativa y no reemplaza el arranque Linux del Compose. No se ejecutó Git Bash en Windows. `start.sh` se verificó con `/bin/sh` dentro de Linux, nunca contra la configuración/bases previas del host.

Para detener sólo esta prueba y conservar sus datos:

```powershell
docker --context desktop-linux compose -p sinfreno-sf01-20261110 -f docker-compose.recovery.yml stop
```

Para repetir migraciones desde cero, elegir otro nombre de proyecto (`-p sinfreno-sf01-otra-prueba`) y puertos libres; detener primero esta prueba para liberar sus puertos. Un `up` sobre el proyecto actual reutiliza exclusivamente su DB descartable. `SF01_DB_PORT` y `SF01_API_PORT` permiten cambiar los puertos publicados de DB/API; el frontend recovery permanece en 15173. No usar `down -v` contra recursos preexistentes.

## Límites y continuidad

Pendientes concretos para **SF-02**:

1. Autenticar y autorizar `/ws/{sucursal_id}` y `/api/v1/parking/{id}/pdf`, verificando aislamiento multicliente; esta entrega sólo configura sus conexiones.
2. Revisar alta de usuarios/roles y autorización real por endpoint; las comprobaciones con un admin ficticio no certifican barreras de permisos.
3. Revisar secretos/configuración anteriores y dependencias con hallazgos de seguridad antes de cualquier publicación. No se imprimieron ni migraron secretos existentes.

Otros bloques: caja, auditoría, cálculo real e idempotencia siguen pendientes. El seed previo captura excepciones sin salir con código de fallo; aquí se verificaron por separado migraciones, datos y login, pero el healthcheck `/` por sí solo no garantiza un seed completo. Su corrección general queda registrada.

Verificaciones manuales pendientes (máximo tres):

1. Abrir 15173 y completar el acceso en dos pasos con el admin ficticio; comprobar que aparece el dashboard.
2. Recargar con F5; comprobar que conserva la sesión, carga datos y conecta el WS a `127.0.0.1:18000/ws/1` en las herramientas de red.
3. Abrir Historial y Configuración sin guardar cambios; comprobar navegación y ausencia de errores de carga.

SF-01 no acredita aptitud comercial ni autoriza publicar esta aplicación.

## Checkpoint del 11/11/2026

Se revisó el inventario completo de cambios y su correspondencia con SF-01,
incluidos contexto de autenticación, efectos y conexiones. No se encontró una
regresión concreta que impidiera guardar el checkpoint. El Markdown de este
archivo ya era normal; no se hicieron reemplazos de escapes ni rutas Windows.
Se guarda SF-01 en un commit local antes de comenzar SF-02A, excluyendo el cambio
previo de `backend/app_audit.log`, secretos y recursos de `.recovery/`. El SHA
del checkpoint queda registrado en `02a-accesos.md`. La validación visual sigue
pendiente; el usuario no proporcionó resultados manuales nuevos.
