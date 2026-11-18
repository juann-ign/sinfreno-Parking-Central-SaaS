# Frontend de Sinfreno

React 19, Vite 7 y JavaScript/JSX. Node requerido: `^20.19.0 || >=22.12.0`; el entorno verificado usa Node 24 en Windows y Node 22 en Docker. El estado vigente del recorrido completo está en [el registro de release](../docs/recovery/RELEASE_2026-11-15.md); [SF-01](../docs/recovery/01-entorno.md) conserva la evidencia histórica de recuperación.

Desde `C:\dev\sinfreno\frontend`, en PowerShell:

```powershell
npm.cmd ci --cache ..\.recovery\npm-cache --no-audit --no-fund
npm.cmd run lint
npm.cmd run test:connections
npm.cmd run test:realtime
npm.cmd test
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Abrir `http://127.0.0.1:5173`. En Git Bash o Linux usar `npm` en lugar de `npm.cmd` y `../.recovery/npm-cache` para la caché. PowerShell puede bloquear `npm.ps1`; `npm.cmd` evita modificar la política de ejecución.

## Conexiones públicas

Por defecto, el navegador conecta con `http://localhost:8000/api/v1`, el WebSocket con `ws://localhost:8000/ws/{sucursalId}` y los comprobantes se construyen sobre la misma API. El backend debe estar iniciado para acceder con una cuenta.

Copiar `.env.example` a `.env.local` para cambiar la configuración:

- `VITE_BACKEND_URL`: origen público del backend y prefijo opcional, sin `/api/v1` ni `/ws`. Por ejemplo, `https://parking.example/sinfreno`.
- `VITE_API_BASE_URL`: URL completa de la API si usa una ruta independiente. Los enlaces PDF usan esta misma base.
- `VITE_WS_BASE_URL`: base del WebSocket si usa otra ruta. HTTP/HTTPS se convierten a WS/WSS; también admite WS/WSS explícitos.

Las rutas que empiezan por `/` heredan el origen del frontend y su esquema TLS. Los prefijos y las barras finales se conservan o normalizan al construir enlaces. Reiniciar Vite después de cambiar variables; para un frontend compilado se debe volver a ejecutar el build. Las variables `VITE_*` se incluyen en el navegador: nunca poner claves, tokens ni credenciales.

La configuración central está en `config/connections.js`. Sus pruebas cubren protocolos, prefijos, URLs independientes, valores inválidos y codificación de identificadores. Los comprobantes se descargan desde el botón PDF usando el cliente Axios autenticado y un blob local; no se comparten URLs públicas ni tokens mediante WhatsApp.

El WebSocket envía la credencial en un primer mensaje y espera confirmación antes de procesar avisos. Origin lo agrega el navegador. Los avisos sólo invalidan lecturas HTTP autorizadas; el resultado individual y el comprobante provienen de la respuesta HTTP de la terminal que hizo la operación. Al cerrar sesión o recibir 401/4401 se limpia la sesión y se cierra el socket. Los rechazos 4403/1008 no se reintentan; las desconexiones transitorias tienen hasta cinco reintentos (1, 2, 4, 8 y 15 segundos), sin reiniciar ese límite dentro de la misma conexión lógica. Después se ofrece Reconectar o recargar. El servidor cierra la conexión al vencer la credencial.

Al restaurar una sesión se consulta `/auth/me` para consumir rol, permisos y sucursal actuales. Un error transitorio conserva las credenciales y muestra una pantalla cerrada con reintento; 401/logout invalidan y las respuestas tardías no restauran otra identidad. La autorización real se aplica en backend. Los tests de ciclo WS simulan WebSocket/timers y los de sesión controlan respuestas diferidas; no reemplazan integración ni observación en navegador.

## Operación y recuperación

- Ingreso: patente + Enter, con categoría y sector preseleccionados; requiere una caja abierta. `N` enfoca ingreso y `/` enfoca búsqueda cuando no se está escribiendo ni en un diálogo.
- Salida: seleccionar estadía, consultar cotización del servidor, elegir medio y confirmar el importe visible. Si vence, se solicita cotizar otra vez. La UI distingue datos heredados y permite al ADMIN revisar una fecha con fuente verificable.
- Los comandos de ingreso, cobro, apertura y cierre conservan una clave de intento, su cuerpo y los IDs concretos antes de enviarse. Ante timeout/red/5xx se ofrece recuperar el resultado o reenviar el mismo intento. No se genera otro comando del mismo tipo mientras el anterior sea incierto. No hay soporte offline con conciliación automática.
- Los intentos se guardan en `localStorage` por usuario y sucursal. No limpiar el almacenamiento ante una respuesta incierta. Para cuentas simultáneas usar perfiles de navegador independientes. Las claves no conceden autorización: el servidor verifica identidad, autoría y sucursal.
- Mis comprobantes permite recuperar operaciones propias después de cerrar un aviso o recargar. El historial completo exige su permiso y usa la paginación real de la API.
- Caja muestra turno, recaudación general y totales por medio cuando corresponden. El contado y la diferencia son de efectivo físico; los otros medios no se contabilizan como faltante. El cierre conserva el ID del turno seleccionado aunque otra terminal cambie la caja actual.
- “Cobro registrado” describe el registro local; no confirma una transacción bancaria. PDF e impresión no inventan CUIT ni QR funcionales.

Los diálogos usan `<dialog>` con foco inicial, Escape, retorno de foco y bloqueo durante mutaciones. Hay diseño adaptable para notebook, desktop y pantallas estrechas, con reducción de movimiento y foco visible. La observación real en 1366×768, zoom, teclado, descarga e impresión debe constar separadamente en el registro de release; un build no acredita QA visual.

Inter y Arvo se sirven localmente desde las distribuciones oficiales Fontsource 5.3.0: subset Latin WOFF2, Inter 400/600/700/900 y Arvo 700, sin petición a Google Fonts. Las licencias OFL se conservan en `public/fonts/LICENSE-Inter.txt` y `LICENSE-Arvo.txt`, que también se incluyen en el build. Esto elimina la dependencia externa de tipografía; no implica soporte offline de las operaciones.

## Lint

Se mantienen las reglas recomendadas de ESLint, React Hooks y Fast Refresh, junto con `react/jsx-uses-vars` para reconocer referencias JSX. `--max-warnings=0` exige corregir también las advertencias de dependencias de hooks. ESLint 9 se conserva por compatibilidad con los peer dependencies de `eslint-plugin-react` 7; no se actualizó el stack durante SF-01.

## E2E opcionales con backend real

Playwright 1.65.1 está fijado en manifest/lock. Los cuatro casos verifican el
recorrido ingreso/cobro/comprobante/F5, permisos y sucursal en contextos
independientes, impresión y recuperación de una respuesta perdida después del
commit real. No fabrican respuestas exitosas ni usan esperas fijas.

La ejecución exige opt-in y una instancia **descartable separada** en loopback
puerto 15180, con el seed ficticio y una caja abierta en Centro. Rechaza el puerto
15175 de la demo conservada. En esta computadora está preparada la instancia
`sinfreno-portfolio-qa-20261118`; su estado y comandos están en el
[informe de QA](../docs/recovery/QA_2026-11-18.md). No inicia servicios ni siembra
datos automáticamente; los registros propios terminan por el flujo normal de
salida y quedan en el historial.

```powershell
$env:SINFRENO_E2E_URL='http://127.0.0.1:15180'
$env:SINFRENO_E2E_ALLOW_DISPOSABLE='1'
$env:SINFRENO_E2E_EXECUTABLE_PATH='C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
npm.cmd run test:e2e
```

Puede usarse `SINFRENO_E2E_CHANNEL=msedge` en lugar de la ruta, o el Chromium
compatible ya instalado por Playwright. Sin los dos opt-in se omiten los cuatro
casos antes de abrir el navegador. La CI normal mantiene sus controles; estos
E2E se ejecutaron por separado contra el QA local. No se guardan storageState,
trazas, videos ni capturas automáticas. Los artefactos de fallo quedan en
`.recovery/`, fuera de Git.
