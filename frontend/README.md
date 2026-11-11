# Frontend de Sinfreno

React 19, Vite 6 y JavaScript/JSX. El informe de recuperación y el arranque completo con recursos descartables están en [SF-01](../docs/recovery/01-entorno.md).

Desde `C:\dev\sinfreno\frontend`, en PowerShell:

```powershell
npm.cmd ci --cache ..\.recovery\npm-cache --no-audit --no-fund
npm.cmd run lint
npm.cmd run test:connections
npm.cmd run test:realtime
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

El WebSocket envía la credencial en un primer mensaje y espera confirmación antes de procesar avisos. Origin lo agrega el navegador. Los avisos sólo invalidan lecturas HTTP autorizadas; el resultado individual y el comprobante provienen de la respuesta HTTP de la terminal que hizo la operación. Al cerrar sesión o recibir 401/4401 se limpia la sesión y se cierra el socket. Los rechazos 4403/1008 no se reintentan; las desconexiones transitorias tienen hasta cinco reintentos (1, 2, 4, 8 y 15 segundos), sin reiniciar ese límite dentro de la misma conexión lógica. Después hace falta recargar. El servidor cierra la conexión al vencer la credencial.

Al restaurar una sesión se consulta `/auth/me` para consumir rol, permisos y sucursal actuales; el almacenamiento local sólo conserva la sesión entre recargas. La autorización real se aplica en backend. Los tests de `api/realtime.test.js` verifican el ciclo del cliente con un WebSocket simulado; no reemplazan las pruebas integradas de autenticación y aislamiento.

## Lint

Se mantienen las reglas recomendadas de ESLint, React Hooks y Fast Refresh, junto con `react/jsx-uses-vars` para reconocer referencias JSX. `--max-warnings=0` exige corregir también las advertencias de dependencias de hooks. ESLint 9 se conserva por compatibilidad con los peer dependencies de `eslint-plugin-react` 7; no se actualizó el stack durante SF-01.
