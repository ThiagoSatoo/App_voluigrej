# AGENTS.md — contexto do projeto para IAs

Leia este arquivo inteiro antes de mudar qualquer coisa. Ele descreve o que o projeto é, como funciona e o que não pode ser quebrado.

## O que é

- Nome: **Sistema de escalas**.
- É um PWA (app web instalável) para organizar a escala de voluntários de uma instituição (uma igreja).
- O foco é o celular. Também funciona no computador.
- São cerca de 60 voluntários.
- O idioma da interface é português do Brasil.
- O fuso horário é America/Sao_Paulo.
- O dono do projeto é o admin. Ele não é programador: explique em linguagem simples.

## O que o app faz

- A coordenação cria **períodos mensais** com turnos (data, início, fim, vagas).
- Os voluntários marcam **disponibilidade** em cada turno do mês.
- O **sorteio** monta a escala: tem prioridade quem serviu menos nos últimos 3 meses, depois nos últimos 12 meses, e o desempate final é aleatório.
- O sorteio nunca escala quem está indisponível nem a mesma pessoa duas vezes no mesmo dia.
- A escala sai como rascunho e só os voluntários a veem depois de **publicada**.
- A coordenação registra **presença**, falta e **substituição**.
- Existem **vagas avulsas**: dias extras com mínimo e máximo de pessoas. O voluntário se candidata e o responsável confirma quem vai.
- **Avisos automáticos**: candidatura, cancelamento, mínimo/máximo atingido, abaixo do mínimo a 24h, aniversários e lembretes de 24h, 12h, 6h, 3h e 1h antes.
- **Agenda**: calendário do mês com todos os horários, escalados, candidatos e vagas vazias.
- **Relatórios** em PDF e histórico.

## Perfis (papéis)

- `admin`: dono do app. Faz tudo. É o único que gerencia supervisores e a tela **Admin**. Não pode ser desativado nem rebaixado.
- `supervisor`: cuida do app no dia a dia. Gerencia voluntários e responsáveis. Não mexe em supervisores nem no admin.
- `responsavel`: é um voluntário que cuida de turnos e vagas atribuídos a ele. Vê a equipe e os contatos só desses turnos. Marca presença, substitui e gerencia as vagas desses turnos.
- `voluntario`: vê a própria escala, informa disponibilidade, candidata-se a vagas e altera a foto e a senha.
- "Coordenação" ou "staff" = `admin` + `supervisor`.

## Login e contas

- O login de todos é o **CPF, só com números**.
- A **senha inicial é o próprio CPF**.
- No primeiro acesso, a troca de senha é obrigatória (`must_change_password`).
- A senha pessoal precisa ter 8 ou mais caracteres, com letras e números, e não pode ser o CPF.
- O Supabase Auth exige um e-mail, então o login vira `<cpf>@cpf.escala-voluntarios.app`. Esse e-mail é interno e nunca recebe mensagens.
- Contas antigas da coordenação usam `<usuario>@equipe.escala-voluntarios.app` até cadastrar o CPF.
- Não há cadastro público. Só a coordenação cria contas, na página **Equipe**.
- A coordenação altera a senha de alguém de duas formas: voltar para o CPF ou digitar uma senha nova.
- O app valida os dígitos verificadores do CPF (`validCpf` em `src/lib/format.ts`).

## Tecnologia

- Frontend: React 19, TanStack Router/Start em **modo SPA**, Tailwind CSS 4, componentes Radix (shadcn/ui em `src/components/ui`).
- Backend: **Supabase** (Postgres + RLS, Auth, Storage, Edge Functions, pg_cron).
- Hospedagem: **Vercel**, com site estático em `dist/client`.
- Gerenciador de pacotes: **Bun** (`bun.lock`). O Node 22+ também funciona.
- Projeto Supabase: `fkjbtxsjqdgywfgccqzo` (us-east-1).
- Repositório: `ThiagoSatoo/App_voluigrej`. A branch publicada é `main`.
- O projeto **não** usa mais o Lovable. Não reintroduza `@lovable.dev/*`.

## Comandos

- `bun install`: instala as dependências.
- `bun run dev`: modo de desenvolvimento em http://localhost:8080.
- `bun run build`: build de produção + `scripts/postbuild.mjs` (CSP e versão do service worker).
- `bun run test`: testes (Vitest, em `src/test/`).
- `bun run lint`: ESLint.
- `e2e/`: teste visual no Chromium (360px, 390px e 1280px), com largura, CSP e PWA. Veja `e2e/README.md`.

## Estrutura de pastas

- `src/routes/`: telas. O roteamento é por arquivo (`supervisor.*` = coordenação, `voluntario.*` = voluntário).
- `src/routes/__root.tsx`: casca do app, `<head>` e registro do service worker.
- `src/components/app/`: componentes do app (avatar, notificações, presença, vagas, senha etc.).
- `src/data/types.ts`: tipos de domínio.
- `src/data/loader.ts`: lê do Supabase tudo o que o usuário logado pode ver.
- `src/data/store.ts`: cache em memória e `useStore()`.
- `src/data/repository.ts`: **todas** as alterações de dados passam por aqui (`repo`).
- `src/data/selectors.ts`: consultas sobre os dados carregados (agenda, equipe, escala etc.).
- `src/lib/nav.ts`: abas do menu de cada área e as regras de ligar/desligar.
- `src/lib/supabase.ts`: cliente Supabase e mensagens de erro em português.
- `src/lib/format.ts`: datas, `today()`, `APP_TITLE`, CPF.
- `supabase/migrations/`: estrutura do banco, em ordem. **É a fonte da verdade das permissões.**
- `supabase/functions/manage-users/`: Edge Function de contas (criar, senha, ativar/desativar, trocar CPF).
- `public/`: `manifest.webmanifest`, `sw.js` e ícones.
- `vercel.json`: build, rotas da SPA e cabeçalhos de segurança.

## Regras que não podem ser quebradas

- **Toda permissão fica no banco** (RLS + funções `security definer`). Esconder algo na tela não é segurança.
- Toda regra nova de acesso precisa de uma migration nova em `supabase/migrations/`.
- Nunca use a chave `service_role` / secret no frontend nem em variáveis `VITE_*`.
- Ações sensíveis passam por RPC: sorteio (`save_draw`, `publish_draw`), `substitute`, candidaturas (`apply_to_opportunity`, `cancel_application`, `confirm_selection`) e perfil (`set_user_role`).
- Contas e senhas só pela Edge Function `manage-users`.
- O usuário anônimo não lê nada. A única exceção é `public_app_name()`, que devolve só o nome da instituição.
- Funções novas: rode `revoke execute ... from public, anon` e dê `grant` só a `authenticated`, quando for o caso.
- As telas só alteram dados por `repo`. Não chame `supabase.from(...).insert/update/delete` direto nas telas.
- Dados pessoais (CPF, telefone, e-mail, nascimento) ficam em `volunteer_details`, separados de `profiles`.
- As fotos ficam no bucket privado `avatars` (até 2 MB, JPG/PNG/WEBP) e aparecem por link assinado de 1 hora.
- O service worker (`public/sw.js`) só guarda arquivos do app. **Nunca** guarde no cache respostas do Supabase.
- A CSP é gerada no build com hashes dos scripts embutidos. Se o build falhar por CSP, corrija a causa. Não use `unsafe-inline` em `script-src`.
- Não reescreva o histórico do Git já publicado (sem force push, amend ou rebase de commits enviados).

## Configurações que a coordenação controla

- **Nome da instituição** (`app_settings.church_name`): aparece abaixo de "Sistema de escalas".
- **Quem vê a escala** (`app_settings.visibility_policy`), aplicada pelo banco:
  - `privado`: o voluntário vê só a própria escala.
  - `mesmo_turno`: vê quem está no mesmo turno ou vaga que ele.
  - `escala_geral`: vê todos os turnos com os nomes. Não existe tela de agenda individual de outra pessoa.
- **Abas do menu** (`nav_config`, tela Admin, só o admin altera): liga e desliga abas do supervisor e do voluntário.
  - Aba desligada some do menu e fica bloqueada pela URL.
  - Abas travadas (sempre ligadas): Dashboard e Configurações do supervisor; Início e Perfil do voluntário.
  - Desligar uma aba não remove a permissão no banco.

## Banco de dados (tabelas principais)

- `profiles`: pessoa, papel, status e foto. O `id` é o mesmo de `auth.users`.
- `volunteer_details`: CPF, telefone, e-mail e nascimento.
- `periods` e `needs`: mês e turnos. `needs.responsavel_id` é quem cuida do turno.
- `availabilities`: disponibilidade por turno.
- `draws`, `draw_slots` e `draw_picks`: sorteios e escalados.
- `attendance` e `substitutions`: presença e trocas.
- `opportunities`, `applications` e `day_availability`: vagas avulsas e candidaturas.
- `notifications` e `notif_prefs`: avisos e preferências.
- `app_settings`: nome da instituição e política de visibilidade.
- `nav_config`: abas do menu por perfil.
- Agendamento: `pg_cron` roda `run_scheduled_notifications()` a cada 10 minutos.

## Convenções de código

- TypeScript estrito.
- Textos da interface em português, curtos e claros.
- Comentários em português.
- Horários no formato `HH:mm`. Os turnos guardam início e fim explícitos. Use `src/lib/time.ts`.
- Datas como `YYYY-MM-DD`. Use `today()` (fuso de São Paulo), nunca `new Date()` puro para o "hoje".
- Erros do servidor viram mensagens amigáveis em `friendlyError()`.
- Ações na tela usam `act(repo.algo(), "mensagem de sucesso")`.
- Layout mobile-first. Nenhuma tela pode ter rolagem lateral em 360px (confira com `e2e/`).
- Cartões em grade precisam de `min-w-0` (o `Panel` já tem).

## Antes de entregar uma mudança

1. `bun run build` sem erros.
2. `bun run test` passando.
3. Se mexeu em tela: rode o teste de `e2e/`.
4. Se mexeu em permissão: teste no banco como cada perfil (admin, supervisor, responsável, voluntário, inativo, anônimo).
5. Rode os avisos de segurança do Supabase (advisors).
