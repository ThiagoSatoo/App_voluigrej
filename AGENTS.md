## Git
- Não reescreva histórico já publicado (force push, rebase, amend ou squash de commits enviados).

## Camada de dados
- As telas leem o estado com `useStore()` + `src/data/selectors.ts` e alteram dados só por `repo` em `src/data/repository.ts`.
- `src/data/loader.ts` carrega do Supabase apenas o que o usuário logado pode ver; o cache vive só em memória.
- Permissões são garantidas no banco (RLS + funções `security definer` em `supabase/migrations`). Proteções na interface (`useRequireRole`) são só conveniência — toda regra nova de acesso precisa existir no banco.
- Ações sensíveis (sorteio, publicação, substituição, candidatura, seleção, perfis) passam por funções RPC; criação de contas e senhas passa pela Edge Function `manage-users`.
- Nunca use a chave `service_role` no frontend.

## Horários
- Turnos guardam início e fim explícitos (`HH:mm`); os dois formulários de agenda usam os mesmos campos e helpers de horário (`src/lib/time.ts`).
- Datas seguem o fuso America/Sao_Paulo (`today()` em `src/lib/format.ts`).
