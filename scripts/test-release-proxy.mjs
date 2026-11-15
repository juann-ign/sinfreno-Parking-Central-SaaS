// Local TLS is verified with this invocation's CA; no TLS verification is disabled.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import https from "node:https";
import http from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const project = "sinfreno-release-proxy-qa";
const envPath = resolve(root, ".recovery/proxy-qa.env");
const caPath = resolve(root, `.recovery/proxy-qa-ca-${Date.now()}.crt`);
const composeArgs = ["compose", "--env-file", envPath, "-p", project, "-f", resolve(root, "deploy/compose.proxy-qa.yml")];
function privateSafeDiagnostic(value) {
  let message = String(value || "");
  for (const path of [resolve(root, ".recovery/release.env"), envPath]) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
      const match = /^(?:RELEASE_DB_PASSWORD|RELEASE_SECRET_KEY|SECRET_KEY|DATABASE_URL)=(.+)$/.exec(line);
      if (!match) continue;
      const secret = match[1];
      if (secret.length >= 8) message = message.replaceAll(secret, "[redacted]");
      try {
        const password = decodeURIComponent(new URL(secret).password);
        if (password.length >= 8) message = message.replaceAll(password, "[redacted]");
      } catch { /* Most values are keys rather than URLs. */ }
    }
  }
  return message.replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[redacted-token]")
    .split(/\r?\n/).slice(-25).join("\n").slice(-6000);
}
function docker(args, input) {
  try {
    return execFileSync("docker", ["--context", "desktop-linux", ...args], {
      encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"], windowsHide: true, timeout: 90000,
    }).trim();
  } catch (error) {
    const operation = args[0] === "compose"
      ? `compose ${args.find((part) => ["up", "down", "exec", "ps"].includes(part)) || ""}`
      : args[0];
    const detail = privateSafeDiagnostic(`${error.stderr || ""}\n${error.stdout || ""}`);
    throw new Error(`Falló Docker (${operation}, ${error.status ?? error.code ?? "sin estado"}) en el ensayo HTTPS local.\n${detail}`);
  }
}
const compose = (...args) => docker([...composeArgs, ...args]);
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
function request(secure, path, { headers = {}, body, ca } = {}) {
  return new Promise((accept, reject) => {
    const transport = secure ? https : http;
    const port = secure ? 15177 : 15176;
    const req = transport.request({
      hostname: "127.0.0.1", port, servername: secure ? "localhost" : undefined,
      path, ca, rejectUnauthorized: true, method: body === undefined ? "GET" : "POST",
      headers: { Host: `localhost:${port}`, ...headers }, timeout: 12000,
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => accept({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) }));
    });
    req.on("error", reject);
    req.on("timeout", () => req.destroy(new Error("HTTPS QA request timed out")));
    if (body !== undefined) req.write(body);
    req.end();
  });
}
function ipv4(value) { return value.split(".").reduce((total, octet) => total * 256 + Number(octet), 0); }
function assertProxySubnetAvailable() {
  const ids = docker(["network", "ls", "-q"]).split(/\s+/).filter(Boolean);
  const networks = ids.length ? JSON.parse(docker(["network", "inspect", ...ids])) : [];
  const start = ipv4("172.30.250.0"), end = start + 15;
  for (const network of networks) for (const entry of network.IPAM?.Config || []) {
    if (!entry.Subnet || entry.Subnet.includes(":")) continue;
    const [address, prefix] = entry.Subnet.split("/");
    const size = 2 ** (32 - Number(prefix));
    const existingStart = Math.floor(ipv4(address) / size) * size;
    assert.ok(end < existingStart || start > existingStart + size - 1, "La subred proxy colisiona con una red existente; no se modificó esa red");
  }
}

async function main() {
  assert.deepEqual(process.argv.slice(2), ["--confirm-disposable"], "Requiere --confirm-disposable; usa únicamente la DB restaurada de la release");
  assert.ok(!existsSync(envPath), "proxy-qa.env ya existe; no se sobrescriben credenciales");
  assert.equal(docker(["ps", "-aq", "--filter", `label=com.docker.compose.project=${project}`]), "", "El proyecto QA ya tiene recursos; no se reutiliza a ciegas");
  assertProxySubnetAvailable();
  docker(["image", "inspect", "sinfreno-release-frontend-static:20261115"]);
  docker(["image", "inspect", "caddy:2-alpine"]);
  const releaseEnv = readFileSync(resolve(root, ".recovery/release.env"), "utf8");
  const password = /^RELEASE_DB_PASSWORD=([a-f0-9]{64})$/m.exec(releaseEnv)?.[1];
  assert.ok(password, "No se encontró el entorno local generado de release");
  const backendImage = docker(["inspect", "--format", "{{.Image}}", "sinfreno-release-20261115-backend-1"]);
  const content = [
    `RELEASE_QA_BACKEND_IMAGE=${backendImage}`, "APP_ENV=production",
    `DATABASE_URL=postgresql://release_demo:${password}@db:5432/release_restore_disposable`,
    `SECRET_KEY=${randomBytes(48).toString("hex")}`,
    'CORS_ORIGINS=["https://localhost:15177"]', "TELEGRAM_TOKEN=", "TELEGRAM_CHAT_ID=", "",
  ].join("\n");
  writeFileSync(envPath, content, { flag: "wx", mode: 0o600 });
  let created = false;
  try {
    created = true;
    compose("up", "-d", "--pull", "never", "--wait", "--wait-timeout", "60");
    const gateway = compose("ps", "-q", "gateway");
    let copied = false;
    for (let attempt = 0; attempt < 10; attempt++) {
      try { docker(["cp", `${gateway}:/data/caddy/pki/authorities/local/root.crt`, caPath]); copied = true; break; }
      catch { await sleep(500); }
    }
    assert.ok(copied, "Caddy no generó su CA local dentro del plazo");
    // Public certificate only: docker cp preserves restrictive Unix permissions.
    // The unprivileged API process must read it when verifying the WSS peer.
    chmodSync(caPath, 0o644);
    const ca = readFileSync(caPath);
    const index = await request(true, "/", { ca });
    assert.equal(index.status, 200);
    const html = index.body.toString();
    assert.match(html, /id="root"/);
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)"/g)].map((match) => match[1]);
    assert.ok(assets.length > 0);
    const fonts = new Set();
    for (const asset of assets) {
      const result = await request(true, asset, { ca });
      assert.equal(result.status, 200);
      if (asset.endsWith(".css")) {
        const css = result.body.toString();
        assert.doesNotMatch(css, /fonts\.(googleapis|gstatic)\.com/);
        for (const match of css.matchAll(/url\(["']?(\/assets\/[^)"']+\.woff2)/g)) fonts.add(match[1]);
      }
    }
    assert.ok(fonts.size > 0, "No se encontraron fuentes locales en el CSS");
    for (const font of fonts) assert.equal((await request(true, font, { ca })).status, 200);
    const form = new URLSearchParams({ username: "admin@release.example.com", password: "Sinfreno-demo-local-2026" }).toString();
    for (const spoofed of [undefined, "http", "https, http"]) {
      const response = await request(true, "/api/v1/auth/login/", { ca, body: "", headers: spoofed ? { "X-Forwarded-Proto": spoofed } : {} });
      assert.equal(response.status, 307);
      assert.equal(response.headers.location, "https://localhost:15177/api/v1/auth/login");
    }
    const direct = await request(false, "/api/v1/auth/login/", { body: "", headers: { "X-Forwarded-Proto": "https" } });
    assert.equal(direct.status, 307);
    assert.equal(direct.headers.location, "http://localhost:15176/api/v1/auth/login");
    const login = await request(true, "/api/v1/auth/login", { ca, body: form, headers: { "Content-Type": "application/x-www-form-urlencoded" } });
    assert.equal(login.status, 200);
    const identity = JSON.parse(login.body);
    const active = await request(true, "/api/v1/parking/activas", { ca, headers: { Authorization: `Bearer ${identity.access_token}` } });
    assert.equal(active.status, 200);
    assert.equal(JSON.parse(active.body).length, 3);
    const history = await request(true, "/api/v1/parking/historial", { ca, headers: { Authorization: `Bearer ${identity.access_token}` } });
    assert.equal(history.status, 200);
    const stayId = JSON.parse(history.body).items[0].id;
    const pdf = await request(true, `/api/v1/parking/${stayId}/pdf`, { ca, headers: { Authorization: `Bearer ${identity.access_token}` } });
    assert.equal(pdf.status, 200);
    assert.equal(pdf.headers["cache-control"], "no-store");
    assert.equal(pdf.body.subarray(0, 4).toString(), "%PDF");
    const backend = compose("ps", "-q", "api_qa");
    docker(["cp", caPath, `${backend}:/tmp/proxy-qa-ca.crt`]);
    const wssCode = [
      "import asyncio,json,ssl,sys,websockets",
      "info=json.load(sys.stdin)",
      "context=ssl.create_default_context(cafile='/tmp/proxy-qa-ca.crt')",
      "async def check():",
      "    async with websockets.connect('wss://localhost:8443/ws/'+str(info['branch']), host='gateway', port=8443, ssl=context, server_hostname='localhost', origin='https://localhost:15177') as ws:",
      "        await ws.send(json.dumps({'type':'authenticate','token':info['token']}))",
      "        assert json.loads(await ws.recv()) == {'type':'authenticated'}",
      "    print('WSS autenticado con CA local verificada')",
      "asyncio.run(check())",
    ].join("\n");
    docker([...composeArgs, "exec", "-T", "api_qa", "python", "-c", wssCode], JSON.stringify({ token: identity.access_token, branch: identity.user_info.sucursal.id }));
    console.log(JSON.stringify({ passed: true, localHttpsVerified: true, staticAssets: assets.length, localFonts: fonts.size, redirectKeepsHttpsAndPort: true, gatewayRejectsSpoofedScheme: true, directNginxRejectsSpoofedScheme: true, loginAndReads: true, authenticatedPdf: true, wssAuthenticated: true, publicDeployment: false }));
    console.log(`CA pública temporal conservada: ${caPath}`);
  } finally {
    if (created) compose("down", "--volumes");
    unlinkSync(envPath); // Only this invocation's newly-created private QA file.
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
