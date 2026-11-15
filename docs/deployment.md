# Instalación, publicación preparada y recuperación

El registro de ejecución y resultados está en [la release](recovery/RELEASE_2026-11-15.md). Estas instrucciones preparan una publicación; no acreditan una URL desplegada ni QA visual.

## Desarrollo y demo local

En PowerShell, desde `C:\dev\sinfreno`, con Docker Desktop:

```powershell
node scripts/init-release.mjs
docker --context desktop-linux compose --env-file .recovery/release.env -p sinfreno-release-20261115 -f docker-compose.release.yml up -d --build --wait
docker --context desktop-linux compose --env-file .recovery/release.env -p sinfreno-release-20261115 -f docker-compose.release.yml exec -T backend python -m app.seed --confirm-disposable release_disposable
```

Abrir `http://127.0.0.1:15175`. Cuenta ADMIN local ficticia: `admin@release.example.com`; OPERADOR: `operador@release.example.com`. Contraseña de ambas: `Sinfreno-demo-local-2026`. API: `http://127.0.0.1:18002/docs`.

El arranque aplica migraciones y ejecuta un solo proceso Uvicorn sin reload. No crea cuentas. El seed es explícito y sólo acepta la base/usuario descartables de la release, confirmación de nombre y Telegram vacío. Para reiniciarla deliberadamente, agregar `--reset` al comando del seed; nunca apuntarlo a una base conservada.

El dataset usa servicios productivos con reloj UTC sintético acotado al proceso CLI: un turno con ARS 1.000 efectivo y ARS 2.000 QR, cierre con efectivo contado ARS 1.000 y diferencia cero; turno actual abierto y estadías de las tres categorías. Auditoría e idempotencia registran el momento de la siembra. Las métricas se consultan sobre esos registros; el cambio de día puede cambiar las métricas diarias. Repetir el seed no duplica operaciones; un fallo produce salida distinta de cero y puede reanudarse.

El archivo `.recovery/release.env` generado contiene secretos locales nuevos: está fuera de Git y de las imágenes. Conservarlo mientras se conserve la base demo. El `.env` anterior no se utiliza ni modifica.

### Revisión manual breve

La demo está en `http://127.0.0.1:15175`; el navegador automatizado no tiene host conectado. La única checklist manual está en [el registro de continuidad](recovery/RELEASE_2026-11-15.md#qa-humano-agrupado). Usar perfiles separados para las terminales ficticias. No reiniciar datos ni limpiar almacenamiento mientras haya intentos inciertos que recuperar. No se acreditan capturas ni impresión física.

## Producción preparada

No se encontró hosting de aplicación configurado en el repositorio: GitHub tiene Pages deshabilitado y homepage vacía. Los pushes de la rama de release ejecutan CI de validación, sin desplegar. La propuesta preparada usa un host Linux con Docker/Compose, PostgreSQL privado persistente y un dominio propio. Caddy termina HTTPS y reenvía al frontend estático Nginx; éste publica API y WebSocket sobre el mismo origen. El despliegue requiere elegir/habilitar host y DNS, proveer credenciales privadas y autorización específica.

Archivos: `deploy/compose.production.yml`, `deploy/Caddyfile`, `deploy/production.env.example`, `frontend/Dockerfile.production` y `frontend/nginx.production.conf`.

1. Copiar `deploy/production.env.example` a `deploy/production.env` fuera de Git y completar en el host elegido: dominio, contraseña PostgreSQL, URL de conexión con contraseña codificada para URL, clave JWT aleatoria propia y lista JSON del origen HTTPS exacto.
2. Generar la clave con un gestor de secretos o `python -c "import secrets; print(secrets.token_urlsafe(48))"` en una terminal privada. No pegarla en documentación, commits o argumentos de build.
3. Verificar `docker compose --env-file deploy/production.env -p sinfreno-production -f deploy/compose.production.yml config --quiet`. Evitar imprimir `config` completo porque muestra variables resueltas.
4. Una vez autorizada la publicación, el comando preparado es `docker compose --env-file deploy/production.env -p sinfreno-production -f deploy/compose.production.yml up -d --build --wait`. Requiere DNS y puertos 80/443 accesibles para obtener el certificado. API y PostgreSQL no publican puertos.
5. En una instalación vacía, crear interactivamente al propietario privado: `docker compose --env-file deploy/production.env -p sinfreno-production -f deploy/compose.production.yml exec backend python -m scripts.bootstrap_owner --email CORREO_DEL_PROPIETARIO --confirm-database sinfreno --confirm-new-install`. La contraseña se solicita sin mostrarla; el comando rechaza instalaciones que ya tengan usuarios. No compartir esta cuenta global como acceso público de portfolio.

Producción exige `APP_ENV=production`, PostgreSQL, `SECRET_KEY` propio de al menos 32 caracteres, algoritmo HS256 y orígenes HTTPS exactos. Falla si falta configuración o se usan claves de ejemplo. Telegram permanece desactivado en los ejemplos de despliegue. El frontend sólo recibe `VITE_BACKEND_URL=/`, que deriva API/WS sobre el origen HTTPS del navegador; las credenciales están exclusivamente en el backend.

La red privada `172.30.250.0/28` fija Caddy `.2`, Nginx `.3` y backend `.4`. Caddy reemplaza el esquema reenviado con el de su conexión; Nginx sólo acepta ese dato desde Caddy; Uvicorn sólo confía las cabeceras de Nginx. Esto conserva HTTPS en redirecciones sin aceptar un encabezado público manipulado. PostgreSQL usa otra red interna y no publica puertos. Comprobar que esa subred no colisiona con redes del host elegido; si se cambia, actualizar conjuntamente Compose, la lista `geo` de Nginx y `FORWARDED_ALLOW_IPS`.

Se conserva un solo worker: las salas WS viven en memoria. Escalar procesos requeriría otro diseño de distribución de eventos. Los tags base de imágenes deben registrarse por digest al preparar una publicación concreta. La configuración local no acredita emisión de certificado, WSS público, firewall ni respaldo externo.

Después de desplegar, verificar certificado/origen, login, sesión, PDF autenticado, evento real entre terminales, cotización/confirmación/reintento y restauración. Mantener la cuenta global privada y acordar explícitamente qué perfil de demo se comparte.

### Ensayo local de HTTPS y proxies

Resultado observado el15/11: imagen estática construida y ensayo local aprobado. Se comprobaron dos estáticos, cinco fuentes locales, redirecciones HTTPS con puerto conservado, rechazo de esquema manipulado, login/lecturas, PDF autenticado y WSS con CA verificada. Los recursos QA temporales se limpiaron. No equivale a navegador, impresión ni certificado público. El fallo de espacio del11/11 queda como evidencia histórica en el registro.

Después del backup/restauración y con las imágenes locales disponibles:

```powershell
docker --context desktop-linux pull caddy:2-alpine
docker --context desktop-linux build -t sinfreno-release-frontend-static:20261115 -f frontend/Dockerfile.production frontend
node scripts/test-release-proxy.mjs --confirm-disposable
```

La descarga explícita de Caddy es un prerrequisito para un checkout en una máquina nueva. Ejecutarla sólo después de recuperar espacio y Docker; el ensayo conserva `--pull never` para no iniciar descargas inesperadas.

El ensayo está preparado para usar sólo `release_restore_disposable` y un proyecto QA nuevo, con puertos loopback 15176/15177. Comprueba que la subred no colisiona; exige imágenes ya presentes y no descarga durante el test. Caddy genera una CA local privada; los clientes verifican TLS confiando explícitamente sólo su certificado público, sin desactivar la verificación ni modificar el almacén de confianza del host. El script comprueba estáticos/fuentes, login, lecturas, PDF, ACK WSS y redirecciones HTTPS con puerto conservado, incluso ante X-Forwarded-Proto manipulado. No equivale a navegador, eventos entre terminales ni certificado público/ACME. Elimina sólo sus contenedores/red/volúmenes QA y su archivo privado temporal; conserva el certificado público para evidencia. No ejecuta migraciones ni seed.

## CI y dependencias

La variante real del backend de producción se verifica, además, con:

```powershell
node scripts/test-production-runtime.mjs --confirm-disposable --frontend-image sinfreno-release-frontend-static:20261115
```

El runner construye `INSTALL_DEV=false` y ejecuta `APP_ENV=production` sobre PostgreSQL vacío en un proyecto nuevo con nonce, secretos efímeros y puertos sólo loopback15178/15179. Verifica migraciones, cero cuentas automáticas, UID10001, ausencia de pytest/pip-audit, `pip check` y rechazo del seed de demo. El fixture externo vive fuera del contexto de la imagen, exige identidad/nonce de la base y no habilita seed productivo. Prueba autenticación, ingreso/cotización/cobro, reintento/recuperación, PDF, cierre y WSS con CA y hostname verificados. Limpia sólo sus recursos y conserva un informe JSON sin secretos en `.recovery/`. El15/11 este comando pasó localmente; la CI correspondiente se registra por separado. No despliega la aplicación.

`.github/workflows/quality.yml` está preparada con Actions fijadas por SHA oficial, permisos de lectura, Node 22 y Python 3.11, instalación desde lock npm, lint/build/suite frontend completa, PostgreSQL descartable, migraciones, suite backend completa y auditorías npm/Python. Rechaza runs sin pruebas o con skips. No publica ni despliega. Sólo un run observado en GitHub permite afirmar que Actions pasó; las verificaciones locales se registran por separado.

El job independiente `release-image-proxy` parte de un checkout nuevo en Ubuntu: crea su contexto Docker sólo en el runner efímero y credenciales descartables, construye y arranca únicamente DB/API, comprueba que el arranque no crea usuarios y ejecuta el seed explícito. Después ensaya el respaldo/restauración, construye la imagen estática de producción y verifica HTTPS/WSS local con CA privada y los proxies sobre la base restaurada. La limpieza se ejecuta siempre y se limita a los proyectos release/QA de ese runner, sus volúmenes y archivos temporales; no se suben secretos ni respaldos como artifacts. El [run43772380802](https://github.com/juann-ign/sinfreno-Parking-Central-SaaS/actions/runs/43772380802) aprobó este job y los otros dos. No acredita despliegue, certificado público/ACME, QA en navegador ni eventos entre terminales.

`backend/requirements.txt` contiene runtime; `requirements-dev.txt` agrega pytest, pytest-asyncio y pip-audit. La imagen normal excluye esas herramientas; el Compose de release activa `INSTALL_DEV=true`. Sus constraints `requirements-runtime.lock` y `requirements-dev.lock` fijan también las versiones transitivas resueltas para Linux/Python 3.11. Los resultados concretos de auditoría se guardan en `.recovery/`. Una auditoría sin avisos conocidos no garantiza ausencia de fallos.

## Respaldo y ensayo de restauración

Con pruebas detenidas y sin otras escrituras en la demo, ejecutar en PowerShell:

```powershell
node scripts/test-release-backup.mjs --confirm-disposable
```

El script comprueba proyecto, label Docker, base `release_disposable` y usuario `release_demo`; genera un `pg_dump` binario, lo copia a `.recovery/` sin pasarlo por una tubería de texto PowerShell, crea exclusivamente `release_restore_disposable` y restaura con `pg_restore --exit-on-error`. Compara cantidades y hashes de todas las filas por tabla, incluida la versión Alembic, y confirma que el origen no cambió. Si la base destino ya existe, rechaza sobrescribirla o borrarla. Conserva el archivo y la base restaurada para revisión; la salida sólo acredita lo que pudo comprobar.

Este ensayo se limita a recursos descartables de la release. Para producción hay que acordar periodicidad, retención, cifrado y copia fuera del servidor, y ensayar el procedimiento con sus credenciales/host antes del piloto. Un volumen Docker no reemplaza un backup.

Ante una actualización fallida: detener nuevas operaciones, conservar logs sin secretos y el backup, volver a la imagen/checkpoint compatible o restaurar en una base nueva y verificarla antes de cambiar la conexión. Una base restaurada con formato nuevo no debe abrirse con código antiguo sin comprobar compatibilidad. No existe soporte offline con reconciliación automática: si el servicio no está disponible, pausar la operación y aplicar el procedimiento humano acordado con la cochera.
