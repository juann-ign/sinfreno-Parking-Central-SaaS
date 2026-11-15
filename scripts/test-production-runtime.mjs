// Real production image + fresh PostgreSQL + exact production Nginx trust + private TLS.
// Never joins, seeds, resets or removes an existing release/demo installation.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const options = { context: "desktop-linux", "frontend-image": "", "backend-image": "", "http-port": "15178", "https-port": "15179" };
let confirmed = false;
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === "--confirm-disposable") confirmed = true;
  else if (Object.hasOwn(options, argument.slice(2)) && process.argv[index + 1]) options[argument.slice(2)] = process.argv[++index];
  else throw new Error("Unknown or incomplete production QA option");
}
const nonce = randomBytes(12).toString("hex");
const project = `sinfreno-production-qa-${Date.now()}-${nonce}`;
const envPath = resolve(root, `.recovery/production-qa-${nonce}.env`);
const caPath = resolve(root, `.recovery/production-qa-${nonce}.crt`);
const reportPath = resolve(root, `.recovery/production-qa-${nonce}.json`);
const backendTag = options["backend-image"] || `${project}:runtime`;
const secretKey = randomBytes(48).toString("hex");
const databasePassword = randomBytes(32).toString("hex");
const fixturePassword = randomBytes(32).toString("hex");
const origin = `https://localhost:${options["https-port"]}`;
const composeArgs = ["compose", "--env-file", envPath, "-p", project, "-f", resolve(root, "deploy/compose.production-qa.yml")];
const createdFiles = new Set();
const helperNames = new Set();
let resourcesCreated = false;
let builtImage = "";

function safeDiagnostic(value) {
  let message = String(value || "");
  for (const secret of [secretKey, databasePassword, fixturePassword]) message = message.replaceAll(secret, "[redacted]");
  return message.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
    .replace(/postgres(?:ql)?:\/\/[^\s'"<>]+/g, "[redacted-database-url]")
    .split(/\r?\n/).slice(-30).join("\n").slice(-6000);
}
function docker(args, input, timeout = 120000) {
  try {
    return execFileSync("docker", ["--context", options.context, ...args], {
      encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, timeout,
    }).trim();
  } catch (error) {
    const operation = args[0] === "compose" ? `compose ${args.find((part) => ["build", "up", "down", "exec", "ps"].includes(part)) || ""}` : args[0];
    throw new Error(`Production QA Docker ${operation} failed (${error.status ?? error.code ?? "unknown"}).\n${safeDiagnostic(`${error.stderr || ""}\n${error.stdout || ""}`)}`);
  }
}
const compose = (...args) => docker([...composeArgs, ...args], undefined, args[0] === "up" ? 300000 : 120000);
const sql = (statement) => compose("exec", "-T", "db", "psql", "-U", "production_qa", "-d", "production_qa_disposable", "-v", "ON_ERROR_STOP=1", "-Atqc", statement);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

function ipv4(value) { return value.split(".").reduce((total, octet) => total * 256 + Number(octet), 0); }
function preflightResources() {
  // Exactly matches deploy/compose.production.yml and frontend/nginx.production.conf.
  const ranges = ["172.30.250.0", "172.30.251.0"].map((address) => {
    const start = ipv4(address);
    return { start, end: start + 15 };
  });
  const ids = docker(["network", "ls", "-q"]).split(/\s+/).filter(Boolean);
  const networks = ids.length ? JSON.parse(docker(["network", "inspect", ...ids])) : [];
  for (const network of networks) for (const entry of network.IPAM?.Config || []) {
    if (!entry.Subnet || entry.Subnet.includes(":")) continue;
    const [address, prefix] = entry.Subnet.split("/");
    const size = 2 ** (32 - Number(prefix));
    const otherStart = Math.floor(ipv4(address) / size) * size;
    assert.ok(ranges.every(({ start, end }) => end < otherStart || start > otherStart + size - 1),
      "Production QA proxy or data subnet is occupied; existing networks were left intact");
  }
  for (const type of ["container", "network", "volume"]) {
    assert.equal(docker([type, "ls", ...(type === "container" ? ["--all"] : []), "--quiet", "--filter", `label=com.docker.compose.project=${project}`]), "", "QA resource identity already exists");
  }
  if (!options["backend-image"]) assert.equal(docker(["image", "ls", "--quiet", backendTag]), "", "Generated QA image tag already exists");
}
function availablePort(port) {
  return new Promise((accept, reject) => {
    const server = net.createServer();
    server.once("error", () => reject(new Error(`Loopback QA port ${port} is occupied; no service was stopped`)));
    server.listen(Number(port), "127.0.0.1", () => server.close(accept));
  });
}
function request(secure, path, { method = "GET", headers = {}, body, ca } = {}) {
  return new Promise((accept, reject) => {
    const port = Number(options[secure ? "https-port" : "http-port"]);
    const req = (secure ? https : http).request({
      hostname: "127.0.0.1", port, servername: secure ? "localhost" : undefined,
      path, method, ca, rejectUnauthorized: true,
      headers: { Host: `localhost:${port}`, ...headers }, timeout: 15000,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => accept({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("Production QA request timed out")));
    if (body !== undefined) req.write(body);
    req.end();
  });
}
function fixture(action, stayId) {
  const name = `${project}-fixture-${action}`;
  helperNames.add(name);
  return JSON.parse(docker(["run", "--rm", "--interactive", "--name", name, "--network", `${project}_data`,
    "--label", "com.sinfreno.purpose=production-runtime-qa-helper", "--label", `com.sinfreno.qa-invocation=${nonce}`, "--env-file", envPath,
    "--env", `PRODUCTION_QA_CONFIRM=${nonce}`, "--entrypoint", "python", backendTag,
    "-", action, ...(stayId ? [String(stayId)] : [])], readFileSync(resolve(root, "deploy/scripts/production-qa-fixture.py"), "utf8")));
}

async function exercise(ca, data) {
  const api = (path, options = {}) => request(true, `/api/v1${path}`, { ca, ...options });
  const check = (response, status, operation) => assert.equal(response.status, status, `${operation}: unexpected HTTP status`);
  check(await request(true, "/", { ca }), 200, "static frontend");
  check(await api("/parking/config"), 401, "anonymous read rejected");
  for (const spoofed of [undefined, "http", "https, http"]) {
    const response = await api("/auth/login/", { method: "POST", body: "", headers: spoofed ? { "X-Forwarded-Proto": spoofed } : {} });
    check(response, 307, "HTTPS redirect");
    assert.equal(response.headers.location, `${origin}/api/v1/auth/login`);
  }
  const direct = await request(false, "/api/v1/auth/login/", { method: "POST", body: "", headers: { "X-Forwarded-Proto": "https" } });
  check(direct, 307, "untrusted forwarded scheme");
  assert.equal(direct.headers.location, `http://localhost:${options["http-port"]}/api/v1/auth/login`);
  const preflight = await api("/parking/config", { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": "GET" } });
  check(preflight, 200, "production CORS");
  assert.equal(preflight.headers["access-control-allow-origin"], origin);
  const rejectedOrigin = await api("/parking/config", { method: "OPTIONS", headers: { Origin: "https://untrusted.example.com", "Access-Control-Request-Method": "GET" } });
  check(rejectedOrigin, 400, "untrusted CORS origin");
  async function login(name) {
    const result = await api("/auth/login", { method: "POST", body: new URLSearchParams({ username: `${name}@production-qa.example.com`, password: fixturePassword }).toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    check(result, 200, "production login");
    return JSON.parse(result.body);
  }
  const admin = await login("admin"), operator = await login("operator");
  const adminHeaders = { Authorization: `Bearer ${admin.access_token}` };
  const operatorHeaders = { Authorization: `Bearer ${operator.access_token}` };
  async function command(path, actor, body, key = randomBytes(16).toString("hex")) {
    const response = await api(path, { method: "POST", body: JSON.stringify(body), headers: { ...actor, "Content-Type": "application/json", "Idempotency-Key": key } });
    check(response, 200, path);
    assert.equal(response.headers["idempotency-resolved"], "true");
    return response;
  }
  const box = JSON.parse((await command("/cash/abrir", adminHeaders, { notas: "Synthetic isolated production QA" })).body);
  const entryKey = randomBytes(16).toString("hex");
  const entryBody = { patente: "PRODQA1", torre_id: data.tower, tipo: "AUTO", caja_id: box.id };
  const entry = await command("/parking/ingreso", operatorHeaders, entryBody, entryKey);
  const stay = JSON.parse(entry.body);
  const replayEntry = await command("/parking/ingreso", operatorHeaders, entryBody, entryKey);
  assert.equal(replayEntry.headers["idempotency-replayed"], "true");
  assert.deepEqual(JSON.parse(replayEntry.body), stay);
  fixture("age", stay.id);
  const quoted = await api(`/parking/${stay.id}/cotizaciones`, { method: "POST", headers: operatorHeaders });
  check(quoted, 200, "actual quote");
  const quote = JSON.parse(quoted.body);
  assert.equal(Number(quote.monto), 1000);
  const paymentKey = randomBytes(16).toString("hex");
  const paymentBody = { cotizacion_id: quote.id, caja_id: box.id, metodo_pago: "EFECTIVO" };
  const payment = await command(`/parking/${stay.id}/salida`, operatorHeaders, paymentBody, paymentKey);
  assert.equal(Number(JSON.parse(payment.body).monto), 1000);
  const replay = await command(`/parking/${stay.id}/salida`, operatorHeaders, paymentBody, paymentKey);
  assert.equal(replay.headers["idempotency-replayed"], "true");
  assert.deepEqual(JSON.parse(replay.body), JSON.parse(payment.body));
  const recovered = await api(`/parking/operaciones/SALIDA/${paymentKey}`, { headers: operatorHeaders });
  check(recovered, 200, "confirmation recovery");
  assert.deepEqual(JSON.parse(recovered.body), JSON.parse(payment.body));
  const receipts = await api("/parking/comprobantes-propios", { headers: operatorHeaders });
  check(receipts, 200, "own receipts");
  assert.ok(JSON.parse(receipts.body).items.some((item) => item.id === stay.id));
  const pdf = await api(`/parking/${stay.id}/pdf`, { headers: operatorHeaders });
  check(pdf, 200, "authorized PDF");
  assert.equal(pdf.headers["cache-control"], "no-store");
  assert.equal(pdf.body.subarray(0, 4).toString(), "%PDF");
  check(await api(`/parking/${stay.id}/pdf`), 401, "anonymous PDF rejected");
  const status = await api("/cash/status", { headers: adminHeaders });
  check(status, 200, "cash accounting");
  const countedCash = JSON.parse(status.body);
  assert.equal(Number(countedCash.monto_esperado), 1000);
  assert.match(countedCash.revision_cierre, /^[a-f0-9]{64}$/);
  const closeKey = randomBytes(16).toString("hex");
  const closeBody = { monto_real: "1000.00", notas: "Synthetic QA close", revision_cierre: countedCash.revision_cierre };
  const closed = await command(`/cash/${box.id}/cerrar`, adminHeaders, closeBody, closeKey);
  assert.equal(JSON.parse(closed.body).estado, "CERRADA");
  assert.equal(Number(JSON.parse(closed.body).diferencia), 0);
  const repeatedClose = await command(`/cash/${box.id}/cerrar`, adminHeaders, closeBody, closeKey);
  assert.equal(repeatedClose.headers["idempotency-replayed"], "true");
  assert.deepEqual(JSON.parse(repeatedClose.body), JSON.parse(closed.body));
  check(await api("/cash/status", { headers: adminHeaders }), 404, "closed turn status");
  const proof = fixture("verify", stay.id);
  const backend = compose("ps", "-q", "backend");
  docker(["cp", caPath, `${backend}:/tmp/production-qa-ca.crt`]);
  const wssCode = [
    "import asyncio,json,ssl,sys,websockets",
    "info=json.load(sys.stdin)",
    "context=ssl.create_default_context(cafile='/tmp/production-qa-ca.crt')",
    "async def check():",
    "    async with websockets.connect('wss://localhost:8443/ws/'+str(info['branch']), host='gateway', port=8443, ssl=context, server_hostname='localhost', origin=info['origin']) as ws:",
    "        await ws.send(json.dumps({'type':'authenticate','token':info['token']}))",
    "        assert json.loads(await asyncio.wait_for(ws.recv(),10)) == {'type':'authenticated'}",
    "        await ws.send(json.dumps({'type':'ping'}))",
    "        assert json.loads(await asyncio.wait_for(ws.recv(),10)) == {'type':'pong'}",
    "    print('Authenticated production WSS, CA and hostname verified')",
    "asyncio.run(check())",
  ].join("\n");
  docker([...composeArgs, "exec", "-T", "backend", "python", "-c", wssCode], JSON.stringify({ token: operator.access_token, branch: data.branch, origin }));
  return { auth: true, cashOpen: true, cashCloseAndReplay: true, entryAndReplay: true, quoteAmount: 1000, confirmationReplayAndRecovery: true, receiptPdf: true, authenticatedWss: true, ...proof };
}

async function cleanup() {
  if (resourcesCreated) {
    // A timed-out docker run may leave its one-off helper alive after the CLI exits.
    const helpers = docker(["container", "ls", "--all", "--quiet", "--filter", `label=com.sinfreno.qa-invocation=${nonce}`,
      "--filter", "label=com.sinfreno.purpose=production-runtime-qa-helper"]).split(/\s+/).filter(Boolean);
    for (const id of helpers) {
      const helper = JSON.parse(docker(["container", "inspect", id]))[0];
      assert.ok(helperNames.has(helper.Name.replace(/^\//, "")), "Cleanup refused an unknown helper");
      docker(["container", "rm", "--force", id]);
    }
    // Refuse to remove anything whose labels are not ours, even within our random project.
    for (const type of ["container", "network", "volume"]) {
      const ids = docker([type, "ls", ...(type === "container" ? ["--all"] : []), "--quiet", "--filter", `label=com.docker.compose.project=${project}`]).split(/\s+/).filter(Boolean);
      for (const id of ids) {
        const resource = JSON.parse(docker([type, "inspect", id]))[0];
        const labels = type === "container" ? resource.Config.Labels : resource.Labels;
        assert.equal(labels?.["com.sinfreno.qa-invocation"], nonce, "Cleanup refused a resource not created by this invocation");
      }
    }
    compose("down", "--volumes");
  }
  if (builtImage) {
    assert.equal(docker(["image", "inspect", "--format", "{{.Id}}", backendTag]), builtImage, "Cleanup refused a changed image tag");
    docker(["image", "rm", backendTag]);
  }
  for (const path of createdFiles) if (existsSync(path)) unlinkSync(path);
}

async function main() {
  assert.ok(confirmed, "Requires --confirm-disposable for a NEW isolated QA installation");
  assert.ok(options["frontend-image"] && !options["frontend-image"].includes("\n"), "Pass the production static image using --frontend-image");
  for (const key of ["http-port", "https-port"]) assert.ok(/^\d{4,5}$/.test(options[key]) && Number(options[key]) <= 65535, "Use an unprivileged valid loopback port");
  assert.notEqual(options["http-port"], options["https-port"], "QA ports must differ");
  await Promise.all([availablePort(options["http-port"]), availablePort(options["https-port"])]);
  preflightResources();
  docker(["image", "inspect", options["frontend-image"]]);
  docker(["image", "inspect", "caddy:2-alpine"]);
  if (options["backend-image"]) docker(["image", "inspect", backendTag]);
  mkdirSync(resolve(root, ".recovery"), { recursive: true });
  const env = [
    `PRODUCTION_QA_RUN=${nonce}`, `PRODUCTION_QA_PROJECT=${project}`,
    `PRODUCTION_QA_BACKEND_IMAGE=${backendTag}`, `PRODUCTION_QA_FRONTEND_IMAGE=${options["frontend-image"]}`,
    `PRODUCTION_QA_DB_PASSWORD=${databasePassword}`, `PRODUCTION_QA_PASSWORD=${fixturePassword}`,
    `PRODUCTION_QA_HTTP_PORT=${options["http-port"]}`, `PRODUCTION_QA_HTTPS_PORT=${options["https-port"]}`,
    "PRODUCTION_QA_SUBNET=172.30.250.0/28", "PRODUCTION_QA_GATEWAY_IP=172.30.250.2", "PRODUCTION_QA_FRONTEND_IP=172.30.250.3", "PRODUCTION_QA_BACKEND_IP=172.30.250.4",
    "APP_ENV=production", `DATABASE_URL=postgresql://production_qa:${databasePassword}@db:5432/production_qa_disposable`,
    `SECRET_KEY=${secretKey}`, `CORS_ORIGINS=["${origin}"]`, "TELEGRAM_TOKEN=", "TELEGRAM_CHAT_ID=", "",
  ].join("\n");
  writeFileSync(envPath, env, { flag: "wx", mode: 0o600 });
  createdFiles.add(envPath);
  let runError;
  try {
    console.log(`Production QA project ${project}; fresh DB, loopback ${options["http-port"]}/${options["https-port"]}.`);
    if (!options["backend-image"]) {
      docker([...composeArgs, "build", "backend"], undefined, 900000);
      builtImage = docker(["image", "inspect", "--format", "{{.Id}}", backendTag]);
    }
    resourcesCreated = true;
    compose("up", "-d", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "120", "db");
    assert.equal(sql("SELECT current_database() || '|' || current_user"), "production_qa_disposable|production_qa");
    assert.equal(sql("SELECT count(*) FROM pg_tables WHERE schemaname = 'public'"), "0", "New QA database unexpectedly has application tables");
    sql(`COMMENT ON DATABASE production_qa_disposable IS 'sinfreno-production-qa:${nonce}'`);
    compose("up", "-d", "--no-build", "--pull", "never", "--wait", "--wait-timeout", "180");
    assert.equal(sql("SELECT count(*) FROM public.usuarios"), "0", "Production startup created an automatic account");
    const runtime = [
      "import importlib.util,json,os", "from importlib.metadata import distributions",
      "from alembic.config import Config", "from alembic.script import ScriptDirectory", "from alembic.runtime.migration import MigrationContext",
      "from app.core.config import settings", "from app.core.database import engine", "from app.seed import require_demo_database",
      "assert os.geteuid()==10001", "assert settings.APP_ENV=='production'",
      "assert importlib.util.find_spec('pytest') is None and importlib.util.find_spec('pip_audit') is None",
      "assert not {'pytest','pytest-asyncio','pip-audit'} & {d.metadata['Name'].lower().replace('_','-') for d in distributions()}",
      "with engine.connect() as connection:", "    assert set(MigrationContext.configure(connection).get_current_heads()) == set(ScriptDirectory.from_config(Config('alembic.ini')).get_heads())",
      "try:", "    require_demo_database('production_qa_disposable')", "except RuntimeError:", "    pass", "else:", "    raise AssertionError('Production unexpectedly permits demo seed')",
      "print(json.dumps({'uid':os.geteuid(),'appEnv':settings.APP_ENV,'migrationHeadsVerified':True,'testPackagesAbsent':True,'productionSeedRejected':True}))",
    ].join("\n");
    const runtimeProof = JSON.parse(compose("exec", "-T", "backend", "python", "-c", runtime));
    compose("exec", "-T", "backend", "python", "-m", "pip", "check");
    const data = fixture("create");
    const gateway = compose("ps", "-q", "gateway");
    for (let attempt = 0; attempt < 20; attempt++) {
      try { docker(["cp", `${gateway}:/data/caddy/pki/authorities/local/root.crt`, caPath]); createdFiles.add(caPath); break; }
      catch (error) { if (attempt === 19) throw error; await sleep(500); }
    }
    chmodSync(caPath, 0o644); // Public CA only; allows the non-root API WSS verifier to read it.
    const result = await exercise(readFileSync(caPath), data);
    const report = { passed: true, project, backendImage: docker(["image", "inspect", "--format", "{{.Id}}", backendTag]),
      productionBuildPerformed: !options["backend-image"], buildInstallDev: options["backend-image"] ? null : false,
      ...runtimeProof, pipCheck: true, emptyDatabaseBeforeMigrations: true, automaticUsers: 0,
      privateCaVerified: true, trustedProductionProxySchemes: true, corsVerified: true, ...result, publicDeployment: false };
    writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, { flag: "wx", mode: 0o600 });
    console.log(JSON.stringify(report));
    console.log(`Production QA report: ${reportPath}`);
  } catch (error) {
    runError = error;
    throw error;
  } finally {
    try { await cleanup(); }
    catch (error) {
      if (runError) console.error(safeDiagnostic(runError.message));
      throw new Error(`Cleanup did not finish; this invocation's private recovery files were retained. ${safeDiagnostic(error.message)}`);
    }
  }
}

main().catch((error) => { console.error(safeDiagnostic(error.message)); process.exitCode = 1; });
