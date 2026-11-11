import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const options = { project: "sinfreno-release-20261115", "compose-file": "docker-compose.release.yml", "env-file": ".recovery/release.env" };
let confirmed = false;
for (let index = 2; index < process.argv.length; index++) {
  const argument = process.argv[index];
  if (argument === "--confirm-disposable") confirmed = true;
  else if (Object.hasOwn(options, argument.slice(2)) && process.argv[index + 1]) options[argument.slice(2)] = process.argv[++index];
  else throw new Error("Opción desconocida o incompleta");
}

function docker(args) {
  try {
    return execFileSync("docker", ["--context", "desktop-linux", ...args], {
      encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
    }).trim();
  } catch {
    throw new Error("Falló un comando Docker/PostgreSQL. Revisar el servicio; no se eliminó ninguna base.");
  }
}

const composeArgs = ["compose", "--env-file", resolve(repoRoot, options["env-file"]), "-p", options.project, "-f", resolve(repoRoot, options["compose-file"])];
const compose = (...args) => docker([...composeArgs, ...args]);
const sql = (database, statement) => compose("exec", "-T", "db", "psql", "-U", "release_demo", "-d", database, "-Atqc", statement);
function signature(database, table) {
  if (!["release_disposable", "release_restore_disposable"].includes(database) || !/^[a-z_][a-z0-9_]*$/.test(table)) {
    throw new Error("Nombre de base o tabla no permitido");
  }
  return sql(database, `SELECT count(*)::text || '|' || md5(COALESCE(string_agg(row_to_json(t)::text, chr(10) ORDER BY row_to_json(t)::text), '')) FROM public."${table}" t;`);
}

async function main() {
  if (!confirmed || !/^sinfreno-release-[a-z0-9-]+$/.test(options.project)) {
    throw new Error("Requiere --confirm-disposable y un proyecto sinfreno-release-*; no admite demos anteriores");
  }
  const dbId = compose("ps", "-q", "db");
  if (!/^[0-9a-f]{12,64}$/.test(dbId)) throw new Error("No se encontró el contenedor DB de esta release");
  if (docker(["inspect", "--format", '{{ index .Config.Labels "com.sinfreno.purpose" }}', dbId]) !== "release-disposable") {
    throw new Error("El contenedor no está identificado como release-disposable");
  }
  if (sql("release_disposable", "SELECT current_database() || '|' || current_user") !== "release_disposable|release_demo") {
    throw new Error("La identidad PostgreSQL no coincide con la base descartable esperada");
  }
  if (sql("release_disposable", "SELECT 1 FROM pg_database WHERE datname = 'release_restore_disposable'") === "1") {
    throw new Error("release_restore_disposable ya existe; se rechaza sobrescribir o eliminar una base");
  }
  const tables = sql("release_disposable", "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename").split(/\r?\n/).filter(Boolean);
  if (!tables.length) throw new Error("La base origen no tiene tablas; no acredita un respaldo útil");
  const before = new Map(tables.map((table) => [table, signature("release_disposable", table)]));
  const dumpPath = `/tmp/sinfreno-release-backup-${randomUUID()}.dump`;
  const backupDir = resolve(repoRoot, ".recovery");
  mkdirSync(backupDir, { recursive: true });
  const backupPath = resolve(backupDir, `release-backup-${Date.now()}.dump`);
  try {
    compose("exec", "-T", "db", "pg_dump", "-U", "release_demo", "-d", "release_disposable", "--format=custom", "--no-owner", "--no-acl", "--file", dumpPath);
    // Keep the archive binary: never send it through a shell text pipeline.
    docker(["cp", `${dbId}:${dumpPath}`, backupPath]);
    compose("exec", "-T", "db", "createdb", "-U", "release_demo", "-O", "release_demo", "release_restore_disposable");
    compose("exec", "-T", "db", "pg_restore", "-U", "release_demo", "-d", "release_restore_disposable", "--no-owner", "--no-privileges", "--exit-on-error", dumpPath);
    for (const table of tables) {
      if (signature("release_restore_disposable", table) !== before.get(table) || signature("release_disposable", table) !== before.get(table)) {
        throw new Error(`No coincide la tabla ${table} o hubo escrituras concurrentes; conservar el respaldo y revisar`);
      }
    }
    const hash = createHash("sha256");
    for await (const chunk of createReadStream(backupPath)) hash.update(chunk);
    console.log(`APROBADO: respaldo y restauración, ${tables.length} tablas con cantidades y hashes coincidentes. Origen intacto.`);
    console.log(`Archivo binario: ${backupPath}`);
    console.log(`SHA256: ${hash.digest("hex")}`);
    console.log("Se conserva la base nueva release_restore_disposable; las demos anteriores permanecen intactas.");
  } finally {
    try { compose("exec", "-T", "db", "rm", "-f", dumpPath); }
    catch { console.error("No se pudo quitar el archivo temporal exclusivo de este ensayo."); }
  }
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
