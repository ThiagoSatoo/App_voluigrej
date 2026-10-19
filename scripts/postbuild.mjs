// Pós-build: aplica a política de segurança de conteúdo (CSP) com hashes exatos
// dos scripts embutidos e versiona o service worker.
import { createHash } from "node:crypto";
import fs from "node:fs";
import { parse } from "parse5";

const dir = "dist/client";
const shellPath = `${dir}/_shell.html`;
let html = fs.readFileSync(shellPath, "utf8");

// O navegador calcula o hash sobre o texto do script JÁ interpretado pelo parser de HTML
// (ex.: o caractere nulo U+0000 que o TanStack embute vira U+FFFD). Por isso usamos o parse5,
// que segue o mesmo algoritmo dos navegadores, para extrair o texto exato de cada script.
const inlineScripts = [];
(function walk(node) {
  if (node.nodeName === "script" && !node.attrs.some((a) => a.name === "src")) {
    inlineScripts.push(node.childNodes.map((c) => c.value ?? "").join(""));
  }
  (node.childNodes ?? []).forEach(walk);
  if (node.content) walk(node.content);
})(parse(html));
const sha = (t) => `sha256-${createHash("sha256").update(t, "utf8").digest("base64")}`;
const hashes = inlineScripts.map((t) => `'${sha(t)}'`);

// Mesmo padrão de src/lib/supabase.ts: libera conexões só para o projeto do app.
const url = process.env.VITE_SUPABASE_URL || "https://fkjbtxsjqdgywfgccqzo.supabase.co";
const host = new URL(url).host;
const supabase = `https://${host} wss://${host}`;

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
// Confere o resultado final: todo script embutido precisa estar liberado, senão o app quebra no navegador.
const finalScripts = [];
(function walk(node) {
  if (node.nodeName === "script" && !node.attrs.some((a) => a.name === "src")) finalScripts.push(node.childNodes.map((c) => c.value ?? "").join(""));
  (node.childNodes ?? []).forEach(walk);
  if (node.content) walk(node.content);
})(parse(html));
const missing = finalScripts.filter((t) => !csp.includes(sha(t)));
if (missing.length) throw new Error(`CSP: ${missing.length} script(s) embutido(s) não liberado(s).`);
fs.writeFileSync(shellPath, html);

const buildId = createHash("sha256").update(html).digest("hex").slice(0, 12);
const swPath = `${dir}/sw.js`;
fs.writeFileSync(swPath, fs.readFileSync(swPath, "utf8").replace("__BUILD_ID__", buildId));

console.log(`[postbuild] CSP com ${hashes.length} script(s) embutido(s); service worker ${buildId}`);
