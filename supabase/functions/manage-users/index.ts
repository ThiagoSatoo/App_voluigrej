// Gerencia contas de acesso (criar, redefinir senha, ativar/desativar, trocar CPF).
// Roda no servidor do Supabase com a chave secreta (service role), que nunca vai ao navegador.
// Cada ação confere o perfil de quem chamou antes de fazer qualquer coisa.
import { createClient } from "npm:@supabase/supabase-js@2";

const CPF_DOMAIN = "cpf.escala-voluntarios.app";
const STAFF_DOMAIN = "equipe.escala-voluntarios.app";
const BAN_FOREVER = "876000h"; // ~100 anos

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "*").split(",").map((s) => s.trim());

function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes("*") ? "*" : ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

const json = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

/** Senha provisória legível (sem caracteres ambíguos), gerada com aleatoriedade criptográfica. */
function tempPassword() {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n)), (x) => set[x % set.length]).join("");
  return `${pick(letters, 4)}-${pick(digits, 4)}-${pick(letters, 4)}`;
}

const isCpf = (s: unknown): s is string => typeof s === "string" && /^\d{11}$/.test(s);
const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
const str = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { error: "Método não permitido." });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Quem está chamando?
  const jwt = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: caller, error: callerErr } = await admin.auth.getUser(jwt);
  if (callerErr || !caller?.user) return json(req, 401, { error: "Sessão inválida. Entre novamente." });
  const { data: me } = await admin.from("profiles").select("id, role, status").eq("id", caller.user.id).maybeSingle();
  if (!me || me.status !== "ativo") return json(req, 403, { error: "Acesso negado." });
  const isAdmin = me.role === "admin";
  const isStaff = isAdmin || me.role === "supervisor";
  if (!isStaff) return json(req, 403, { error: "Acesso negado." });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "Requisição inválida." });
  }

  const target = async (id: unknown) => {
    if (!isUuid(id)) return null;
    const { data } = await admin.from("profiles").select("id, role, status, name, username").eq("id", id).maybeSingle();
    return data;
  };
  // Supervisor gerencia voluntários/responsáveis; admin gerencia também supervisores; ninguém mexe no admin.
  const canManage = (t: { role: string } | null) =>
    !!t && t.role !== "admin" && (t.role === "voluntario" || t.role === "responsavel" ? isStaff : t.role === "supervisor" && isAdmin);

  try {
    switch (body.action) {
      case "create_volunteer": {
        const name = str(body.name, 120);
        const cpf = str(body.cpf, 11);
        const birth = str(body.birthDate, 10);
        if (name.length < 3) return json(req, 400, { error: "Informe o nome completo." });
        if (!isCpf(cpf)) return json(req, 400, { error: "CPF deve ter 11 dígitos." });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(birth)) return json(req, 400, { error: "Informe a data de nascimento." });
        const { data: dup } = await admin.from("volunteer_details").select("id").eq("cpf", cpf).maybeSingle();
        if (dup) return json(req, 409, { error: "Já existe um voluntário com este CPF." });

        const password = tempPassword();
        const { data: created, error } = await admin.auth.admin.createUser({ email: `${cpf}@${CPF_DOMAIN}`, password, email_confirm: true });
        if (error || !created.user) return json(req, 400, { error: error?.message?.includes("already") ? "Já existe um acesso com este CPF." : "Não foi possível criar o acesso." });
        const id = created.user.id;
        const p = await admin.from("profiles").insert({ id, role: "voluntario", name, must_change_password: true });
        const d = p.error
          ? p
          : await admin.from("volunteer_details").insert({ id, cpf, phone: str(body.phone, 30), email: str(body.email, 200), birth_date: birth });
        if (p.error || d.error) {
          await admin.auth.admin.deleteUser(id);
          return json(req, 400, { error: "Não foi possível salvar o cadastro." });
        }
        return json(req, 200, { id, tempPassword: password });
      }

      case "create_staff": {
        if (!isAdmin) return json(req, 403, { error: "Somente o administrador cria supervisores." });
        const name = str(body.name, 120);
        const username = str(body.username, 32).toLowerCase();
        if (name.length < 3) return json(req, 400, { error: "Informe o nome completo." });
        if (!/^[a-z0-9._-]{3,32}$/.test(username)) return json(req, 400, { error: "Usuário inválido." });
        const { data: dup } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
        if (dup) return json(req, 409, { error: "Este usuário já está em uso." });
        const password = tempPassword();
        const { data: created, error } = await admin.auth.admin.createUser({ email: `${username}@${STAFF_DOMAIN}`, password, email_confirm: true });
        if (error || !created.user) return json(req, 400, { error: "Não foi possível criar o acesso." });
        const p = await admin.from("profiles").insert({ id: created.user.id, role: "supervisor", name, username, must_change_password: true });
        if (p.error) {
          await admin.auth.admin.deleteUser(created.user.id);
          return json(req, 400, { error: "Não foi possível salvar o cadastro." });
        }
        return json(req, 200, { id: created.user.id, tempPassword: password });
      }

      case "reset_password": {
        const t = await target(body.userId);
        if (!canManage(t)) return json(req, 403, { error: "Você não pode redefinir a senha desta pessoa." });
        const password = tempPassword();
        const { error } = await admin.auth.admin.updateUserById(t!.id, { password });
        if (error) return json(req, 400, { error: "Não foi possível redefinir a senha." });
        await admin.from("profiles").update({ must_change_password: true }).eq("id", t!.id);
        return json(req, 200, { tempPassword: password });
      }

      case "set_status": {
        const t = await target(body.userId);
        if (!canManage(t)) return json(req, 403, { error: "Você não pode alterar o acesso desta pessoa." });
        const status = body.status === "inativo" ? "inativo" : "ativo";
        // Bloqueia também no login, além das regras do banco.
        const { error } = await admin.auth.admin.updateUserById(t!.id, { ban_duration: status === "inativo" ? BAN_FOREVER : "none" });
        if (error) return json(req, 400, { error: "Não foi possível alterar o acesso." });
        await admin.from("profiles").update({ status }).eq("id", t!.id);
        return json(req, 200, { status });
      }

      case "change_cpf": {
        const t = await target(body.userId);
        if (!t || !(t.role === "voluntario" || t.role === "responsavel")) return json(req, 404, { error: "Voluntário não encontrado." });
        const cpf = str(body.cpf, 11);
        if (!isCpf(cpf)) return json(req, 400, { error: "CPF deve ter 11 dígitos." });
        const { data: dup } = await admin.from("volunteer_details").select("id").eq("cpf", cpf).neq("id", t.id).maybeSingle();
        if (dup) return json(req, 409, { error: "Já existe um voluntário com este CPF." });
        const { error } = await admin.auth.admin.updateUserById(t.id, { email: `${cpf}@${CPF_DOMAIN}`, email_confirm: true });
        if (error) return json(req, 400, { error: "Não foi possível alterar o CPF." });
        await admin.from("volunteer_details").update({ cpf }).eq("id", t.id);
        return json(req, 200, { ok: true });
      }

      default:
        return json(req, 400, { error: "Ação desconhecida." });
    }
  } catch (e) {
    console.error(e);
    return json(req, 500, { error: "Erro interno." });
  }
});
