import { makeFixtures } from "./fixtures.mjs";
export const BASE = "http://localhost:4173";
const SB = "https://fkjbtxsjqdgywfgccqzo.supabase.co";
export const fx = makeFixtures();

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

export async function mockSupabase(context, user) {
  await context.route(`${SB}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body), headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*" } });
    if (req.method() === "OPTIONS") return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*" } });
    if (p.startsWith("/rest/v1/rpc/")) {
      const fn = p.split("/").pop();
      if (fn === "public_app_name") return json(fx.tables.app_settings[0].church_name);
      if (fn === "scale_counts") return json(fx.tables.profiles.map((x, i) => ({ volunteer_id: x.id, recent3m: i % 4, last12m: i % 9, last_date: null })));
      if (fn === "opportunity_counts") return json(fx.tables.opportunities.map((o) => ({ opportunity_id: o.id, active: fx.tables.applications.filter((a) => a.opportunity_id === o.id && a.status !== "cancelado" && a.status !== "nao_selecionado").length })));
      return json(null);
    }
    if (p.startsWith("/rest/v1/")) {
      const table = p.split("/").pop();
      if (req.method() !== "GET") return json([]);
      let rows = table === "notifications" ? fx.notificationsFor(user.id) : filterRows(table, url.searchParams);
      const accept = req.headers()["accept"] ?? "";
      if (accept.includes("vnd.pgrst.object")) return json(rows[0] ?? null);
      return json(rows);
    }
    if (p.startsWith("/storage/v1/object/sign")) return json([]);
    if (p.startsWith("/auth/v1/user")) return json({ id: user.id, email: "x@cpf.escala-voluntarios.app", aud: "authenticated", role: "authenticated" });
    if (p.startsWith("/auth/v1/logout")) return route.fulfill({ status: 204 });
    return json({});
  });
  if (user) {
    const session = {
      access_token: "e2e.e2e.e2e", token_type: "bearer", expires_in: 3600 * 24, expires_at: Math.floor(Date.now() / 1000) + 3600 * 24,
      refresh_token: "e2e", user: { id: user.id, aud: "authenticated", role: "authenticated", email: "x@cpf.escala-voluntarios.app", app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    };
    await context.addInitScript((s) => localStorage.setItem("escala-auth", JSON.stringify(s)), session);
  }
}

