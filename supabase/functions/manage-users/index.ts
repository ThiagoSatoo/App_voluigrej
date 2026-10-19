// Gerencia contas de acesso: criar, redefinir/definir senha, ativar/desativar, trocar CPF.
// Login de todos é o CPF (só números); a senha inicial também é o CPF.
// Roda no servidor do Supabase com a chave secreta (service role), que nunca vai ao navegador.
// Cada ação confere o perfil de quem chamou antes de fazer qualquer coisa.
import { createClient } from "npm:@supabase/supabase-js@2";

const CPF_DOMAIN = "cpf.escala-voluntarios.app";
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

/** CPF com 11 dígitos e dígitos verificadores corretos (evita erro de digitação no login). */
function validCpf(cpf: unknown): cpf is string {
  if (typeof cpf !== "string" || !/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(cpf[9]) && dv(10) === Number(cpf[10]);
}

const isUuid = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s);
const str = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
const digits = (s: unknown) => (typeof s === "string" ? s.replace(/\D/g, "") : "");
const loginOf = (cpf: string) => `${cpf}@${CPF_DOMAIN}`;

/** Senha definida pela coordenação: 8 a 72 caracteres. */
const validPassword = (p: unknown): p is string => typeof p === "string" && p.length >= 8 && p.length <= 72;

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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(req, 400, { error: "Requisição inválida." });
  }

  const target = async (id: unknown) => {
    if (!isUuid(id)) return null;
    const { data } = await admin.from("profiles").select("id, role, status, name").eq("id", id).maybeSingle();
    return data;
  };
  const cpfOf = async (id: string) => {
    const { data } = await admin.from("volunteer_details").select("cpf").eq("id", id).maybeSingle();
    return data?.cpf as string | undefined;
  };
  const cpfTaken = async (cpf: string, exceptId?: string) => {
    let q = admin.from("volunteer_details").select("id").eq("cpf", cpf);
    if (exceptId) q = q.neq("id", exceptId);
    const { data } = await q.maybeSingle();
    return !!data;
  };
  // Supervisor gerencia voluntários/responsáveis; admin gerencia também supervisores; ninguém mexe no admin.
  const canManage = (t: { role: string } | null) =>
    !!t && t.role !== "admin" && (t.role === "voluntario" || t.role === "responsavel" ? isStaff : t.role === "supervisor" && isAdmin);

  /** Cria a conta de login + perfil + dados pessoais; desfaz tudo se algo falhar. */
  const createAccount = async (role: string, name: string, cpf: string, extra: Record<string, unknown>) => {
    const { data: created, error } = await admin.auth.admin.createUser({ email: loginOf(cpf), password: cpf, email_confirm: true });
    if (error || !created.user) {
      return json(req, 400, { error: error?.message?.includes("already") ? "Já existe um acesso com este CPF." : "Não foi possível criar o acesso." });
    }
    const id = created.user.id;
    const p = await admin.from("profiles").insert({ id, role, name, must_change_password: true });
    const d = p.error ? p : await admin.from("volunteer_details").insert({ id, cpf, ...extra });
    if (p.error || d.error) {
      await admin.auth.admin.deleteUser(id);
      return json(req, 400, { error: "Não foi possível salvar o cadastro." });
    }
    return json(req, 200, { id });
  };

  try {
    switch (body.action) {
      // Supervisor/admin cria voluntário ou responsável. Login e senha inicial = CPF.
      case "create_volunteer": {
        if (!isStaff) return json(req, 403, { error: "Acesso negado." });
        const name = str(body.name, 120);
        const cpf = digits(body.cpf);
        const birth = str(body.birthDate, 10);
        const role = body.role === "responsavel" ? "responsavel" : "voluntario";
        if (name.length < 3) return json(req, 400, { error: "Informe o nome completo." });
        if (!validCpf(cpf)) return json(req, 400, { error: "CPF inválido. Confira os números." });
        if (birth && !/^\d{4}-\d{2}-\d{2}$/.test(birth)) return json(req, 400, { error: "Data de nascimento inválida." });
        if (await cpfTaken(cpf)) return json(req, 409, { error: "Já existe uma pessoa com este CPF." });
        return await createAccount(role, name, cpf, { phone: str(body.phone, 30), email: str(body.email, 200), birth_date: birth || null });
      }

      // Somente o admin cria supervisores. Login e senha inicial = CPF.
      case "create_staff": {
        if (!isAdmin) return json(req, 403, { error: "Somente o administrador cria supervisores." });
        const name = str(body.name, 120);
        const cpf = digits(body.cpf);
        if (name.length < 3) return json(req, 400, { error: "Informe o nome completo." });
        if (!validCpf(cpf)) return json(req, 400, { error: "CPF inválido. Confira os números." });
        if (await cpfTaken(cpf)) return json(req, 409, { error: "Já existe uma pessoa com este CPF." });
        return await createAccount("supervisor", name, cpf, { phone: str(body.phone, 30), email: str(body.email, 200) });
      }

      // Volta a senha para o CPF e exige troca no próximo acesso.
      case "reset_password": {
        const t = await target(body.userId);
        if (!canManage(t)) return json(req, 403, { error: "Você não pode alterar a senha desta pessoa." });
        const cpf = await cpfOf(t!.id);
        if (!cpf) return json(req, 400, { error: "Esta pessoa não tem CPF cadastrado." });
        const { error } = await admin.auth.admin.updateUserById(t!.id, { password: cpf });
        if (error) return json(req, 400, { error: "Não foi possível redefinir a senha." });
        await admin.from("profiles").update({ must_change_password: true }).eq("id", t!.id);
        return json(req, 200, { ok: true });
      }

      // A coordenação digita uma senha nova para a pessoa.
      case "set_password": {
        const t = await target(body.userId);
        if (!canManage(t)) return json(req, 403, { error: "Você não pode alterar a senha desta pessoa." });
        if (!validPassword(body.password)) return json(req, 400, { error: "A senha deve ter de 8 a 72 caracteres." });
        const { error } = await admin.auth.admin.updateUserById(t!.id, { password: body.password });
        if (error) return json(req, 400, { error: "Não foi possível alterar a senha." });
        await admin.from("profiles").update({ must_change_password: body.mustChange !== false }).eq("id", t!.id);
        return json(req, 200, { ok: true });
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
        if (!canManage(t)) return json(req, 403, { error: "Você não pode alterar o CPF desta pessoa." });
        const cpf = digits(body.cpf);
        if (!validCpf(cpf)) return json(req, 400, { error: "CPF inválido. Confira os números." });
        if (await cpfTaken(cpf, t!.id)) return json(req, 409, { error: "Já existe uma pessoa com este CPF." });
        const { error } = await admin.auth.admin.updateUserById(t!.id, { email: loginOf(cpf), email_confirm: true });
        if (error) return json(req, 400, { error: "Não foi possível alterar o CPF." });
        await admin.from("volunteer_details").upsert({ id: t!.id, cpf });
        return json(req, 200, { ok: true });
      }

      // A própria pessoa da coordenação cadastra o CPF dela (contas antigas criadas com "usuário").
      case "set_my_cpf": {
        if (!isStaff) return json(req, 403, { error: "Acesso negado." });
        if (await cpfOf(me.id)) return json(req, 400, { error: "Seu CPF já está cadastrado. Peça ao administrador para alterá-lo." });
        const cpf = digits(body.cpf);
        if (!validCpf(cpf)) return json(req, 400, { error: "CPF inválido. Confira os números." });
        if (await cpfTaken(cpf)) return json(req, 409, { error: "Já existe uma pessoa com este CPF." });
        const ins = await admin.from("volunteer_details").insert({ id: me.id, cpf });
        if (ins.error) return json(req, 400, { error: "Não foi possível salvar o CPF." });
        const { error } = await admin.auth.admin.updateUserById(me.id, { email: loginOf(cpf), email_confirm: true });
        if (error) {
          await admin.from("volunteer_details").delete().eq("id", me.id);
          return json(req, 400, { error: "Não foi possível alterar o login." });
        }
        await admin.from("profiles").update({ username: null }).eq("id", me.id);
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
