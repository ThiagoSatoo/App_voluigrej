// Pós-build: aplica a política de segurança de conteúdo (CSP) com hashes exatos
// dos scripts embutidos e versiona o service worker.
import { createHash } from "node:crypto";
import fs from "node:fs";

const dir = "dist/client";
const shellPath = `${dir}/_shell.html`;
let html = fs.readFileSync(shellPath, "utf8");

const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
  (m) => `'sha256-${createHash("sha256").update(m[1], "utf8").digest("base64")}'`,
);

let supabase = "https://*.supabase.co wss://*.supabase.co";
const url = process.env.VITE_SUPABASE_URL;
if (url) {
  const host = new URL(url).host;
  supabase = `https://${host} wss://${host}`;
}

const csp = [
  "default-src 'self'",
  `script-src 'self' ${hashes.join(" ")}`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  `img-src 'self' data: blob: ${supabase.split(" ")[0]}`,
  `connect-src 'self' ${supabase}`,
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

html = html.replace(/<meta charSet="utf-8"\/>/i, (m) => `${m}<meta http-equiv="Content-Security-Policy" content="${csp}"/>`);
if (!html.includes("Content-Security-Policy")) throw new Error("Não foi possível inserir a CSP no HTML.");
fs.writeFileSync(shellPath, html);

const buildId = createHash("sha256").update(html).digest("hex").slice(0, 12);
const swPath = `${dir}/sw.js`;
fs.writeFileSync(swPath, fs.readFileSync(swPath, "utf8").replace("__BUILD_ID__", buildId));

console.log(`[postbuild] CSP com ${hashes.length} script(s) embutido(s); service worker ${buildId}`);
