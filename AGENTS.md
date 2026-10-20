# AGENTS.md — leia primeiro

Este é o único arquivo de contexto do projeto, para pessoas e IAs.
Ele diz o objetivo, onde paramos, o que falta e as regras.
Leia tudo antes de mudar qualquer coisa.
Ao terminar uma tarefa, atualize as seções "Onde paramos" e "O que falta".

## Objetivo

- Colocar no ar um app seguro para os voluntários instalarem no celular.
- O link da Vercel será enviado a todos os voluntários.
- Por isso, a segurança não pode depender de esconder o endereço: ela fica no banco.
- O app precisa ser simples de usar no celular, por pessoas sem conhecimento técnico.

## Onde paramos (20/10/2026)

- O app está pronto e publicado na Vercel a partir da branch `main`.
- O banco no Supabase está criado, com as regras de acesso aplicadas (migrations 1 a 16).
- A Edge Function `manage-users` está publicada.
- O login é por CPF para todos; a senha inicial é o CPF.
- As telas passaram no teste do `e2e/` (em 360px, 390px e 1280px).
- O PWA funciona: instala, abre sem internet e não guarda dados pessoais no aparelho.
- **Falta o teste real**: entrar no app publicado, criar usuários e usar no celular.
- 20/10: a primeira tela do voluntário e do responsável é a **Agenda** (a aba "Início" saiu; `/voluntario` redireciona).
- 20/10: a aba "Presença" saiu do menu do supervisor; a presença é marcada na **Agenda** (`/supervisor/presenca` redireciona). O responsável continua marcando em "Turnos".
- 20/10: "Supervisor" virou **Coordenador** nas telas (no banco o perfil continua `supervisor`). Botões **Disponível** (voluntário) e **Fixar** (coordenação) nas escalas fixas.
- 20/10: **Escalas fixas** no ar. "Períodos e necessidades", "Disponibilidades" e "Sorteio" viraram a aba **Escalas** (escalas fixas + vagas avulsas). O voluntário escolhe suas escalas fixas e usa o botão "Indisponível" na aba **Escalas**. Os períodos e sorteios antigos continuam no banco e aparecem na Agenda, no Histórico e nos Relatórios.

## O que falta

Feito pelo dono, no painel do Supabase (não dá para fazer pelo código):
- Authentication: desligar "Allow new users to sign up".
- Authentication → Email: desligar "Confirm email".
- Authentication → Passwords: mínimo de 8 caracteres, **sem** exigir letras (a senha inicial é o CPF, só números).
- Ligar "Leaked password protection", se o plano permitir.
- Apagar as contas de teste `52601815906@cpf…` e `08301661305@cpf…` (já estão bloqueadas).
- Desligar a extensão `pg_net` (Database → Extensions); ela foi usada só para testes.

Feito pelo dono, no app:
- Entrar com o usuário `admin` (senha provisória combinada com o dono) e criar a senha definitiva.
- Em Configurações → Minha conta, cadastrar o CPF do admin.
- Em Configurações, trocar o "Nome da instituição" (hoje está "Minha Igreja").
- Escolher a política "Quem vê a escala" (hoje está `mesmo_turno`).

Feito por quem programa, depois que houver o link da Vercel:
- Definir o segredo `ALLOWED_ORIGINS` da Edge Function com o endereço da Vercel.
- Corrigir o que aparecer no teste real.


Respostas do dono sobre escalas fixas (20/10), já aplicadas:
- Sorteio por escala fixa, um mês por vez, em rascunho e depois publicado.
- Prioridade igual à antiga (3 meses, 12 meses, aleatório), contando o que já foi sorteado no mês: assim todos se igualam. A tela avisa se a diferença passar de 3 dias.
- Várias escalas fixas no mesmo dia, quantas a coordenação quiser.
- "Indisponível" numa data avisa a coordenação; se a pessoa estava escalada e o turno fica incompleto, o sistema escolhe o substituto sozinho entre os participantes. Sem ninguém livre, a coordenação recebe um alerta.
- O voluntário entra direto numa escala fixa (sem aprovação).
- Pedido de 20/10 (2ª parte), já aplicado: no lugar de "Desfazer", o botão **Disponível**; o botão **Fixar** da coordenação; "Supervisor" passa a se chamar **Coordenador** nas telas.

Ideias sugeridas ao dono, ainda não pedidas:
- Política "mesmo dia" (vê todos que servem no mesmo dia).
- Mostrar só o primeiro nome e esconder fotos dos colegas.
- Esconder escalas passadas dos colegas.
- Fazer a tela Admin também tirar a permissão no banco, além de esconder a aba.

## O que é

- Nome: **Sistema de escalas**.
- É um PWA (app web instalável) para organizar a escala de voluntários de uma instituição (uma igreja).
- O foco é o celular. Também funciona no computador.
- São cerca de 60 voluntários.
- O idioma da interface é português do Brasil.
- O fuso horário é America/Sao_Paulo.
- O dono do projeto é o admin. Ele não é programador: explique em linguagem simples e em português.

## O que o app faz

- A coordenação cria **escalas fixas**: horários que se repetem toda semana (dia da semana, início, fim, quantidade de pessoas, responsável opcional, ativa/desativada). Pode haver várias no mesmo dia.
- Cada voluntário escolhe de quais escalas fixas **participa** (aba Escalas). A coordenação também inscreve ou remove pessoas.
- O **sorteio** é feito por escala fixa, um mês por vez (`draw_fixed`): o banco cria os turnos do mês (`needs.fixed_id`) e escolhe quem vai. Prioridade: quem serviu menos nos últimos 3 meses, depois 12 meses (contando o que já foi sorteado no mês), desempate aleatório. A tela avisa se a diferença entre participantes passar de 3 dias.
- O sorteio nunca escala quem marcou "Indisponível" na data nem a mesma pessoa duas vezes no mesmo dia.
- A escala sai como rascunho e só os voluntários a veem depois de **publicada** (por escala fixa).
- **Fixar** (`set_fixed_pins`, só a coordenação): escolhe 1 ou mais pessoas para uma escala fixa, numa data ou no mês inteiro. Elas entram garantidas no sorteio (se não marcaram "Indisponível"); o resto das vagas é sorteado. Vale só para o mês: todo mês a coordenação fixa de novo. Ao salvar, o sorteio do mês é refeito em rascunho.
- **Disponível** (`mark_available`): desfaz o "Indisponível" sem apagar nada (a exceção ganha `cancelled_at`).
  - Não estava escalado: só volta a contar para o sorteio (sem aviso).
  - Saiu e o turno ficou sem substituto: volta direto para a escala (presença `escalado`).
  - Saiu e o lugar foi ocupado (ou o turno seguiu completo): fica de **backup** daquele turno. A coordenação recebe aviso e pode trocar alguém pelo backup em "Substituir" (backups aparecem primeiro). Se outra pessoa ficar indisponível, o substituto automático chama o backup antes dos demais.
- **Indisponível** (`mark_unavailable`): o voluntário avisa que não pode numa data. A coordenação/responsável recebe aviso. Se ele já estava escalado e o turno fica incompleto, o banco escolhe o substituto sozinho entre os participantes; sem ninguém livre, vira alerta no Dashboard.
- Antes das escalas fixas existiam períodos mensais com disponibilidade por turno; esses dados antigos continuam no banco e aparecem no histórico.
- A coordenação registra **presença**, falta e **substituição**.
- Existem **vagas avulsas**: dias extras com mínimo e máximo de pessoas. O voluntário se candidata e o responsável confirma quem vai.
- **Avisos automáticos**: candidatura, cancelamento, mínimo/máximo atingido, abaixo do mínimo a 24h, aniversários e lembretes de 24h, 12h, 6h, 3h e 1h antes.
- **Agenda**: calendário do mês com todos os horários, escalados, candidatos e vagas vazias. Ao abrir um turno publicado de hoje ou passado, a coordenação marca Presente / Faltou / Substituir ali mesmo.
- **Agenda do voluntário** (primeira tela): próximo turno e aviso de disponibilidade pendente no topo, calendário do mês e lista dos próximos turnos, conforme a política "Quem vê a escala".
- **Relatórios** em PDF e histórico.

## Perfis (papéis)

- `admin`: dono do app. Faz tudo. É o único que gerencia supervisores e a tela **Admin**. Não pode ser desativado nem rebaixado.
- `supervisor` (nas telas: **Coordenador**): cuida do app no dia a dia. Gerencia voluntários e responsáveis. Não mexe em coordenadores nem no admin.
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
- Ações sensíveis passam por RPC: sorteio (`draw_fixed`, `publish_draw`; `save_draw` é o mensal antigo), indisponibilidade (`mark_unavailable`, `mark_available`), fixar (`set_fixed_pins`), `substitute`, candidaturas (`apply_to_opportunity`, `cancel_application`, `confirm_selection`) e perfil (`set_user_role`).
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
  - Abas do supervisor: Dashboard, Equipe, Escalas (escalas fixas e vagas avulsas), Agenda, Histórico, Relatórios, Configurações e Admin (só o admin).
  - Abas do voluntário: Agenda (primeira), Escalas (escalas fixas e "Indisponível"), Vagas, Turnos (só responsável), Histórico e Perfil.
  - Endereços antigos que redirecionam: `/voluntario` → Agenda; `/supervisor/presenca` → Agenda; `/supervisor/sorteio` e `/supervisor/disponibilidades` → Escalas.
  - Abas travadas (sempre ligadas): Dashboard, Agenda e Configurações do supervisor; Agenda e Perfil do voluntário.
  - Desligar uma aba não remove a permissão no banco.

## Banco de dados (tabelas principais)

- `profiles`: pessoa, papel, status e foto. O `id` é o mesmo de `auth.users`.
- `volunteer_details`: CPF, telefone, e-mail e nascimento.
- `fixed_schedules`, `fixed_members` e `fixed_exceptions`: escalas fixas, participantes e "não posso nesse dia" (`cancelled_at` = desfeito pelo botão Disponível).
- `fixed_pins`: pessoas fixadas pela coordenação numa data de uma escala fixa.
- Backup não tem tabela própria: é quem tem presença `cancelado`/`substituido` no turno e um "Indisponível" desfeito (`cancelled_at`) na data (`_is_backup` no banco, `backupsOf` no app).
- `periods` e `needs`: mês e turnos. `needs.responsavel_id` é quem cuida do turno; `needs.fixed_id` liga o turno à escala fixa.
- `availabilities`: disponibilidade por turno (fluxo mensal antigo; só histórico).
- `draws`, `draw_slots` e `draw_picks`: sorteios e escalados. `draws.fixed_id`: um sorteio por escala fixa e mês.
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
