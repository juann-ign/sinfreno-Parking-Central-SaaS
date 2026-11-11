// Creates credentials only in an ignored local file; never prints their values.
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const directory = resolve(root, ".recovery");
const target = resolve(directory, "release.env");
await mkdir(directory, { recursive: true });
const content = [
  "# Local disposable release environment. Do not commit or publish this file.",
  `RELEASE_DB_PASSWORD=${randomBytes(32).toString("hex")}`,
  `RELEASE_SECRET_KEY=${randomBytes(48).toString("hex")}`,
  "",
].join("\n");
try {
  await writeFile(target, content, { flag: "wx", mode: 0o600 });
  console.log("Entorno local creado en .recovery/release.env; valores secretos ocultos.");
} catch (error) {
  if (error.code !== "EEXIST") throw error;
  console.log("Se conserva .recovery/release.env existente; no se reemplazaron credenciales.");
}
