import { createClient } from "@supabase/supabase-js";

// Valores públicos do projeto (seguros no navegador). Podem ser trocados por variáveis de ambiente.
const DEFAULT_URL = "https://fkjbtxsjqdgywfgccqzo.supabase.co";
const DEFAULT_KEY = "sb_publishable_FqnNB_o1Hj6_ltrVhnDeDg_-7KfxM4d";
const url = (import.meta.env["VITE_SUPABASE_URL"] as string | undefined) || DEFAULT_URL;
const key = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined) || DEFAULT_KEY;

export const supabaseConfigured = Boolean(url && key);

/**
 * Cliente do navegador. Usa somente a chave pública (publishable);
 * toda a proteção dos dados é feita pelas regras de acesso (RLS) no banco.
 */
export const supabase = createClient(url ?? "http://localhost", key ?? "missing-key", {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: "escala-auth",
  },
});

/**
 * O Supabase Auth exige um e-mail. Voluntários entram com CPF e a equipe com usuário,
 * então cada um ganha um e-mail interno que nunca recebe mensagens.
 */
export const LOGIN_DOMAIN_CPF = "cpf.escala-voluntarios.app";
export const LOGIN_DOMAIN_STAFF = "equipe.escala-voluntarios.app";
export const cpfLogin = (cpf: string) => `${cpf.replace(/\D/g, "")}@${LOGIN_DOMAIN_CPF}`;
export const staffLogin = (username: string) =>
  `${username.trim().toLowerCase()}@${LOGIN_DOMAIN_STAFF}`;

export const AVATAR_BUCKET = "avatars";

/** Converte erros do banco/servidor em mensagens amigáveis em português. */
export function friendlyError(err: unknown): string {
  // No banco o perfil se chama "supervisor"; na tela, "coordenador".
  const msg = ((err as { message?: string })?.message ?? String(err ?? "")).replace(
    /supervisor(es)?/g,
    (_, p) => (p ? "coordenadores" : "coordenador"),
  );
  if (/row-level security|permission denied|Acesso negado/i.test(msg))
    return "Você não tem permissão para fazer isso.";
  if (/Invalid login credentials/i.test(msg)) return "Login ou senha inválidos.";
  if (/rate limit|too many/i.test(msg))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (/Failed to fetch|NetworkError|network/i.test(msg))
    return "Sem conexão com o servidor. Verifique sua internet.";
  if (/duplicate key.*cpf/i.test(msg)) return "Já existe um voluntário com este CPF.";
  if (/duplicate key.*(month|year)/i.test(msg)) return "Já existe um período para este mês.";
  if (/duplicate key.*username/i.test(msg)) return "Este usuário já está em uso.";
  if (/foreign key.*fixed_id|violates foreign key constraint "(needs|draws)_fixed_id/i.test(msg))
    return "Esta escala fixa já tem turnos gerados. Desative-a em vez de excluir.";
  if (/duplicate key.*fixed_members/i.test(msg))
    return "Esta pessoa já participa desta escala fixa.";
  if (/weak|password should/i.test(msg))
    return "Senha muito fraca. Use pelo menos 8 caracteres, com letras e números.";
  if (/same_password|should be different/i.test(msg))
    return "A nova senha deve ser diferente da atual.";
  // Mensagens geradas pelas funções do banco já estão em português.
  if (
    msg &&
    msg.length < 200 &&
    /[áéíóúãõçà]|não|Somente|inválid|escala|turno|Voluntário|Selecione/i.test(msg)
  )
    return msg;
  return "Não foi possível concluir. Tente novamente.";
}
