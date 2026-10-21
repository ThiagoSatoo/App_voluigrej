// Abre o app num Chromium real (celular e computador), com o Supabase simulado,
// e verifica: erros, bloqueios de CSP, rolagem horizontal da página e requisitos do PWA.
import { chromium } from "playwright";
import fs from "node:fs";
import { makeFixtures } from "./fixtures.mjs";

const BASE = "http://localhost:4173";
const SB = "https://fkjbtxsjqdgywfgccqzo.supabase.co";
const OUT = "e2e/shots";
fs.mkdirSync(OUT, { recursive: true });
const fx = makeFixtures();

function filterRows(table, params) {
  let rows = [...(fx.tables[table] ?? [])];
  for (const [k, v] of params) {
    if (["select", "offset", "limit", "order"].includes(k)) continue;
    const m = /^eq\.(.*)$/.exec(v);
    if (m) rows = rows.filter((r) => String(r[k]) === m[1]);
  }
  const off = Number(params.get("offset") ?? 0);
  const lim = params.get("limit") ? Number(params.get("limit")) : rows.length;
  return rows.slice(off, off + lim);
}

async function mockSupabase(context, user) {
  await context.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(body),
        headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" },
      });
    if (req.method() === "OPTIONS")
      return route.fulfill({
        status: 200,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "*",
          "access-control-allow-methods": "*",
        },
      });
    if (p.startsWith("/rest/v1/rpc/")) {
      const fn = p.split("/").pop();
      if (fn === "public_app_name") return json(fx.tables.app_settings[0].church_name);
      if (fn === "scale_counts")
        return json(
          fx.tables.profiles.map((x, i) => ({
            volunteer_id: x.id,
            recent3m: i % 4,
            last12m: i % 9,
            last_date: null,
          })),
        );
      if (fn === "opportunity_counts")
        return json(
          fx.tables.opportunities.map((o) => ({
            opportunity_id: o.id,
            active: fx.tables.applications.filter(
              (a) =>
                a.opportunity_id === o.id &&
                a.status !== "cancelado" &&
                a.status !== "nao_selecionado",
            ).length,
          })),
        );
      return json(null);
    }
    if (p.startsWith("/rest/v1/")) {
      const table = p.split("/").pop();
      if (req.method() !== "GET") return json([]);
      let rows =
        table === "notifications"
          ? fx.notificationsFor(user.id)
          : filterRows(table, url.searchParams);
      const accept = req.headers()["accept"] ?? "";
      if (accept.includes("vnd.pgrst.object")) return json(rows[0] ?? null);
      return json(rows);
    }
    if (p.startsWith("/storage/v1/object/sign")) return json([]);
    if (p.startsWith("/auth/v1/user"))
      return json({
        id: user.id,
        email: "x@cpf.escala-voluntarios.app",
        aud: "authenticated",
        role: "authenticated",
      });
    if (p.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204 });
    return json({});
  });
  if (user) {
    const session = {
      access_token: "e2e.e2e.e2e",
      token_type: "bearer",
      expires_in: 3600 * 24,
      expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
      refresh_token: "e2e",
      user: {
        id: user.id,
        aud: "authenticated",
        role: "authenticated",
        email: "x@cpf.escala-voluntarios.app",
        app_metadata: {},
        user_metadata: {},
        created_at: new Date().toISOString(),
      },
    };
    await context.addInitScript(
      (s) => localStorage.setItem("escala-auth", JSON.stringify(s)),
      session,
    );
  }
}

const VIEWPORTS = [
  { name: "celular-360", width: 360, height: 740, mobile: true },
  { name: "celular-390", width: 390, height: 844, mobile: true },
  { name: "desktop", width: 1280, height: 800, mobile: false },
];

const SCENARIOS = [
  { who: "anon", user: null, pages: ["/"] },
  {
    who: "admin",
    user: fx.users.admin,
    pages: [
      "/supervisor",
      "/supervisor/voluntarios",
      "/supervisor/periodos",
      "/supervisor/necessidades",
      "/supervisor/disponibilidades",
      "/supervisor/sorteio",
      "/supervisor/escala",
      "/supervisor/presenca",
      "/supervisor/historico",
      "/supervisor/relatorios",
      "/supervisor/configuracoes",
      "/supervisor/admin",
    ],
  },
  {
    who: "voluntario",
    user: fx.users.vol,
    pages: [
      "/voluntario",
      "/voluntario/disponibilidade",
      "/voluntario/escala",
      "/voluntario/vagas",
      "/voluntario/historico",
      "/voluntario/perfil",
    ],
  },
  {
    who: "responsavel",
    user: fx.users.resp,
    pages: [
      "/voluntario",
      "/voluntario/escala",
      "/voluntario/disponibilidade",
      "/voluntario/turnos",
    ],
  },
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium",
  args: ["--no-sandbox"],
});
const problems = [];
const report = [];

for (const vp of VIEWPORTS) {
  for (const sc of SCENARIOS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.mobile,
      hasTouch: vp.mobile,
      deviceScaleFactor: vp.mobile ? 2 : 1,
      serviceWorkers: "block",
      locale: "pt-BR",
      timezoneId: "America/Sao_Paulo",
    });
    await mockSupabase(context, sc.user);
    await context.addInitScript(() => {
      window.__csp = [];
      document.addEventListener("securitypolicyviolation", (e) =>
        window.__csp.push(`${e.violatedDirective}: ${e.blockedURI || "inline"}`),
      );
    });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => {
      if (m.type() === "error" && !m.text().includes("ERR_TUNNEL_CONNECTION_FAILED"))
        errors.push("console: " + m.text().slice(0, 200));
    });
    await context.route(/fonts\.(googleapis|gstatic)\.com/, (r) =>
      r.fulfill({ status: 200, body: "" }),
    );
    for (const path of sc.pages) {
      errors.length = 0;
      await page.goto(BASE + path, { waitUntil: "networkidle" });
      await page.waitForTimeout(600);
      const info = await page.evaluate((VW) => {
        const vw = VW;
        const doc = document.documentElement.scrollWidth;
        // Elementos que passam da borda direita fora de um contêiner com rolagem própria.
        const offenders = [];
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.right <= vw + 1) continue;
          let p = el.parentElement,
            scrolls = false;
          while (p) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === "auto" || ox === "scroll" || ox === "hidden") {
              scrolls = true;
              break;
            }
            p = p.parentElement;
          }
          if (!scrolls)
            offenders.push(
              `${el.tagName.toLowerCase()}.${String(el.className).split(" ").slice(0, 3).join(".")} (${Math.round(r.right)}px) "${(el.textContent || "").trim().slice(0, 40)}"`,
            );
        }
        const tiny = [...document.querySelectorAll("button, a")].filter((b) => {
          const r = b.getBoundingClientRect();
          return r.width > 0 && r.height > 0 && (r.height < 28 || r.width < 28);
        }).length;
        return {
          vw,
          doc,
          offenders: offenders.slice(0, 5),
          csp: window.__csp,
          h1: document.querySelector("h1")?.textContent?.trim(),
          tiny,
        };
      }, vp.width);
      const file = `${OUT}/${vp.name}__${sc.who}__${path.replaceAll("/", "_") || "_"}.png`;
      await page.screenshot({ path: file, fullPage: true });
      const overflow = info.doc > info.vw + 1;
      const row = {
        vp: vp.name,
        who: sc.who,
        path,
        title: info.h1,
        overflow: overflow ? `${info.doc}px > ${info.vw}px` : "",
        offenders: info.offenders,
        csp: info.csp,
        errors: [...errors],
        tinyTargets: info.tiny,
      };
      report.push(row);
      if (overflow || info.offenders.length || info.csp.length || errors.length) problems.push(row);
    }
    await context.close();
  }
}

// ---------------- PWA ----------------
const pwa = {};
{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  await mockSupabase(context, null);
  const page = await context.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  pwa.manifestLink = await page.evaluate(() =>
    document.querySelector('link[rel="manifest"]')?.getAttribute("href"),
  );
  const man = await (await page.request.get(BASE + pwa.manifestLink)).json();
  pwa.manifest = {
    name: man.name,
    short_name: man.short_name,
    start_url: man.start_url,
    display: man.display,
    icons: man.icons.map((i) => `${i.sizes} ${i.purpose}`),
  };
  pwa.iconsOk = (
    await Promise.all(man.icons.map(async (i) => (await page.request.get(BASE + i.src)).status()))
  ).every((s) => s === 200);
  pwa.themeColor = await page.evaluate(
    () => document.querySelector('meta[name="theme-color"]')?.content,
  );
  pwa.appleIcon = await page.evaluate(
    () => !!document.querySelector('link[rel="apple-touch-icon"]'),
  );
  pwa.swControlled = await page.evaluate(async () => {
    const reg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((r) => setTimeout(() => r(null), 8000)),
    ]);
    return reg ? (reg.active?.scriptURL ?? "registrado") : null;
  });
  // Recarrega já controlado pelo service worker e testa sem internet.
  await page.reload({ waitUntil: "networkidle" });
  pwa.controller = await page.evaluate(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.goto(BASE + "/voluntario/escala").catch(() => {});
  await page.waitForTimeout(1500);
  pwa.offlineShell = await page.evaluate(
    () => document.querySelector("h1")?.textContent ?? document.body.innerText.slice(0, 80),
  );
  await page.screenshot({ path: `${OUT}/pwa-offline.png` });
  // Nada do Supabase pode ter ido para o cache do aparelho.
  pwa.offlineUrl = page.url();
  await context.setOffline(false);
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  pwa.cachedSupabase = await page.evaluate(async () => {
    let n = 0;
    for (const k of await caches.keys())
      for (const r of await (await caches.open(k)).keys()) if (r.url.includes("supabase")) n++;
    return n;
  });
  pwa.cachedCount = await page.evaluate(async () => {
    let n = 0;
    for (const k of await caches.keys()) n += (await (await caches.open(k)).keys()).length;
    return n;
  });
  await context.close();
}

await browser.close();
fs.writeFileSync("e2e/report.json", JSON.stringify({ report, problems, pwa }, null, 2));
console.log(`Páginas testadas: ${report.length}  |  com problema: ${problems.length}`);
for (const p of problems) console.log(JSON.stringify(p));
console.log("PWA:", JSON.stringify(pwa, null, 1));
