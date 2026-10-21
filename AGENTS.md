# AGENTS.md — leia primeiro

Este é o arquivo de contexto do projeto, para pessoas e IAs. Leia tudo antes de mudar qualquer coisa.
Ele descreve o app **como ele é hoje**, o que falta e as regras. Não é um diário: ao terminar uma tarefa,
atualize as seções afetadas (principalmente "Situação atual" e "O que falta") em vez de acrescentar histórico.

## Objetivo

- App seguro, instalável no celular (PWA), para organizar a escala de cerca de 60 voluntários de uma paróquia.
- O link da Vercel vai para todos os voluntários. Por isso a segurança **não** depende de esconder o endereço: ela fica no banco.
- Usado por pessoas sem conhecimento técnico, quase sempre no celular.
- O dono do projeto é o **admin**. Ele não é programador: responda em português, com frases simples, e explique o que ele precisa testar.

## Situação atual

- No ar em **https://paroquiasjpapp.vercel.app** (Vercel), publicado a partir da branch `main` (cada push na `main` publica).
- Banco no Supabase com 18 migrations aplicadas (`supabase/migrations/`, iguais às do banco).
- Edge Function `manage-users` publicada (contas e senhas). Só aceita pedidos do endereço do app (segredo `ALLOWED_ORIGINS` = `https://paroquiasjpapp.vercel.app`, no painel do Supabase → Edge Functions → Secrets; se o endereço mudar, atualize o segredo).
- Admin já entrou, tem CPF e senha definitiva. Nome da instituição: "Paróquia Nossa Senhora do Monte Claro". Já existe 1 escala fixa criada.
- Ainda **não houve o teste real** com voluntários usando no celular.

## O que falta

Com o dono:
- **Teste real**: cadastrar alguns voluntários e usar no celular (escolher escalas, sortear, publicar, Indisponível/Disponível, presença).
- Conferir a política "Quem vê a escala" (está `mesmo_turno`); o dono vai retornar.
- Já feito pelo dono: configurações de Authentication (cadastro público e confirmação de e-mail desligados, regra de senha). O aviso do Supabase ainda mostra "Leaked password protection" desligada; esse recurso só existe nos planos pagos.
- As contas de teste `52601815906@cpf…` e `08301661305@cpf…` ficam por decisão do dono (testes). Estão desativadas.

Feito por quem programa:
- Corrigir o que aparecer no teste real.

Opcionais (precisam de aprovação do dono, porque a ferramenta do Supabase pede confirmação para `drop`/`delete`):
- Separar as regras de escrita de `periods` e `needs`: trocar `periods_write`/`needs_write` ("for all") por políticas `*_insert`, `*_update` e `*_delete` com `is_staff()`. Ganho pequeno de desempenho.
- Limpeza mensal do histórico do agendador (`cron.job_run_details`, cerca de 50 mil linhas por ano).

Ideias já sugeridas ao dono, ainda não pedidas:
- Política "mesmo dia" (o voluntário vê todos que servem no mesmo dia).
- Mostrar só o primeiro nome e esconder as fotos dos colegas.
- Esconder escalas passadas dos colegas.
- Fazer a tela Admin também tirar a permissão no banco, além de esconder a aba.

## Perfis

| No banco | Nas telas | O que faz |
| --- | --- | --- |
| `admin` | Administrador | Tudo. Único que gerencia coordenadores e a tela **Admin**. Não pode ser desativado nem rebaixado. |
| `supervisor` | **Coordenador** | Cuida do dia a dia: equipe (voluntários e responsáveis), escalas, sorteio, presença, vagas, relatórios. Não mexe em coordenadores nem no admin. |
| `responsavel` | Responsável | Voluntário que cuida de turnos/vagas atribuídos a ele: vê a equipe e os contatos só desses turnos, marca presença, substitui e gerencia essas vagas. |
| `voluntario` | Voluntário | Vê a própria escala, escolhe escalas fixas, marca Indisponível/Disponível, candidata-se a vagas, altera foto e senha. |

- "Coordenação" ou "staff" = `admin` + `supervisor` (`is_staff()` no banco).
- O nome técnico continua `supervisor` no banco, nas rotas (`/supervisor/...`) e no código. Só o texto das telas diz "Coordenador" (`friendlyError` também troca a palavra nas mensagens do servidor).

## Como funciona a escala (fluxo principal)

1. **Escalas fixas** (aba Escalas da coordenação): horários que se repetem toda semana, com dia da semana, início, fim, quantidade de pessoas, responsável opcional e ativa/desativada. Pode haver várias no mesmo dia.
2. **Participantes**: cada voluntário escolhe de quais escalas fixas participa (aba Escalas dele), sem aprovação. A coordenação também inscreve ou remove pessoas.
3. **Fixar** (só a coordenação, `set_fixed_pins`): escolhe pessoas que entram garantidas numa escala fixa, **numa data** ou **no mês inteiro**. Vale só para aquele mês; todo mês a coordenação fixa de novo. Ao salvar, o sorteio do mês é refeito.
4. **Sorteio** (`draw_fixed`): por escala fixa, **um mês por vez**. O banco cria os turnos do mês (`needs.fixed_id`) e escolhe quem vai:
   - primeiro os fixados;
   - depois os participantes pela prioridade: quem serviu menos nos últimos 3 meses, depois em 12 meses (contando o que já saiu no mês), e desempate aleatório. Assim todos se igualam; a tela avisa se a diferença passar de 3 dias;
   - nunca escala quem marcou Indisponível na data nem a mesma pessoa duas vezes no mesmo dia.
5. O sorteio sai como **rascunho**. A coordenação confere ("Ver datas") e **publica**. Só então os voluntários veem. Cada escala fixa tem a própria publicação (`draws.fixed_id`).
6. **Indisponível** (`mark_unavailable`): a pessoa não pode numa data. O voluntário marca para si; a coordenação (ou o responsável da escala) pode marcar por ele.
   - Não estava escalado: só registra e avisa a coordenação/responsável.
   - Estava escalado: sai do turno. **A troca é sempre manual** (decisão do dono): se o turno fica incompleto, coordenação e responsável recebem um alerta (vermelho no Dashboard) com a **sugestão** do próximo (backup primeiro, depois a prioridade do sorteio), mas ninguém é colocado sozinho. A coordenação escolhe em Agenda → Substituir (o sugerido aparece primeiro, marcado "Sugerido"), e quem entra recebe um aviso.
7. **Disponível** (`mark_available`): desfaz o Indisponível sem apagar nada (`fixed_exceptions.cancelled_at`).
   - Não estava escalado: só volta a contar para o sorteio, sem aviso.
   - Saiu e ninguém ocupou o lugar: volta direto para a escala (presença `escalado`).
   - Saiu e o lugar foi ocupado: fica de **backup** daquele turno. A coordenação pode trocar alguém pelo backup em "Substituir" (backups aparecem primeiro).
   - **Onde fica o botão** (`AvailabilityControl`, botão de dois lados: Disponível em verde claro | Indisponível em vermelho forte; o lado preenchido é a situação atual): para o voluntário, na aba Escalas (cada data) e na Agenda (nos turnos dele); para a coordenação, na janela "Disponibilidade" (`FixedAvailabilityDialog`), aberta pelo cartão da escala fixa (aba Escalas, qualquer data futura) ou pelo turno na Agenda.
8. **Presença e trocas na Agenda da coordenação**: turno publicado de hoje ou passado → Presente / Faltou / Substituir para cada escalado. Turno publicado futuro → "Substituir alguém" (ou "Escolher substituto", em destaque, quando falta gente). O responsável marca presença na aba Turnos, só nos turnos dele.

Também existem:
- **Vagas avulsas**: dias extras com mínimo e máximo de pessoas. O voluntário se candidata e o responsável/coordenação confirma quem vai.
- **Avisos automáticos**: candidatura, cancelamento, mínimo/máximo atingido, abaixo do mínimo a 24h, aniversários, indisponibilidade, substituto escalado e lembretes 24h/12h/6h/3h/1h antes. O `pg_cron` roda `run_scheduled_notifications()` a cada 10 minutos.
- **Relatórios** em PDF e histórico.
- **Dados antigos**: antes das escalas fixas havia períodos mensais com disponibilidade por turno (`availabilities`, `save_draw`). Esses dados continuam no banco e aparecem na Agenda, no Histórico e nos Relatórios, mas não há mais telas para criá-los.

## Telas (abas do menu)

- **Coordenação** (`/supervisor/...`): Dashboard, Equipe, Escalas (escalas fixas + vagas avulsas), Agenda (calendário + presença), Histórico, Relatórios, Configurações, Admin (só o admin).
- **Voluntário e responsável** (`/voluntario/...`): Agenda (primeira tela: próximo turno, calendário e próximos turnos), Escalas (escalas fixas, Indisponível/Disponível), Vagas, Turnos (só responsável), Histórico, Perfil.
- Endereços antigos que redirecionam: `/voluntario` → Agenda; `/supervisor/presenca` → Agenda; `/supervisor/sorteio` e `/supervisor/disponibilidades` → Escalas. Nas rotas, a aba Escalas da coordenação é `/supervisor/periodos` e a do voluntário é `/voluntario/disponibilidade` (nomes antigos mantidos para não quebrar links).
- Abas sempre ligadas: Dashboard, Agenda e Configurações (coordenação); Agenda e Perfil (voluntário). As demais o admin liga/desliga na tela Admin (`nav_config`). Desligar uma aba esconde e bloqueia a tela, mas **não** muda a permissão no banco.

## Configurações que a coordenação controla

- **Nome da instituição** (`app_settings.church_name`): aparece abaixo de "Sistema de escalas" e na tela de login.
- **Quem vê a escala** (`app_settings.visibility_policy`), aplicada pelo banco:
  - `privado`: o voluntário vê só a própria escala.
  - `mesmo_turno`: vê quem está no mesmo turno ou vaga que ele.
  - `escala_geral`: vê todos os turnos com os nomes. Não existe tela de agenda individual de outra pessoa.

## Login e contas

- Login de todos: **CPF, só números**. Senha inicial: **o próprio CPF**. No primeiro acesso a troca é obrigatória (`must_change_password`).
- Senha pessoal: 8 ou mais caracteres, com letras e números, e não pode ser o CPF.
- O Supabase Auth exige e-mail, então o login vira `<cpf>@cpf.escala-voluntarios.app` (interno, nunca recebe mensagens).
- Não há cadastro público. Só a coordenação cria contas, na página **Equipe**. Ela também pode voltar a senha para o CPF ou definir uma nova.
- O app valida os dígitos do CPF (`validCpf` em `src/lib/format.ts`).
- A primeira conta (admin) é criada à mão, pelo SQL em `supabase/README.md`.

## Atualização do app no celular

- `public/sw.js` + `src/lib/pwa.ts`. Ao abrir o app ou voltar para ele, o app confere se há versão nova e recarrega sozinho. Com o app em uso, mostra "Nova versão do app disponível" e atualiza na próxima volta. Se uma tela antiga sumiu do servidor, recarrega na versão nova.
- Os dados recarregam ao abrir, ao voltar para o app e a cada 2 minutos (`src/data/store.ts`). Depois de cada ação, `repo` recarrega tudo.
- O app lê só os sorteios em uso (publicados e rascunhos); versões trocadas não são carregadas (`src/data/loader.ts`).

## Tecnologia

- Frontend: React 19, TanStack Router/Start em **modo SPA**, Tailwind CSS 4, componentes Radix (shadcn/ui em `src/components/ui`; só os que o app usa).
- Backend: **Supabase** (Postgres + RLS, Auth, Storage, Edge Functions, pg_cron). Projeto `fkjbtxsjqdgywfgccqzo` (us-east-1).
- Hospedagem: **Vercel**, site estático em `dist/client`.
- Pacotes: **Bun** (`bun.lock`; a Vercel usa `bun install --frozen-lockfile`).
- Repositório: `ThiagoSatoo/App_voluigrej`. Não usa mais o Lovable: não reintroduza `@lovable.dev/*`.

## Comandos

- `bun install`: instala as dependências.
- `bun run dev`: desenvolvimento em http://localhost:8080.
- `bun run build`: build de produção + `scripts/postbuild.mjs` (CSP e versão do service worker).
- `bun run test`: testes (Vitest, em `src/test/`).
- `bun run lint`: ESLint + Prettier (limpo; mantenha assim: rode `bunx eslint . --fix` antes de enviar).
- `bun audit`: falhas conhecidas em pacotes (hoje limpo).
- `e2e/`: teste visual no Chromium (360px, 390px e 1280px), com largura, CSP e PWA. Veja `e2e/README.md`.

## Estrutura de pastas

- `src/routes/`: telas, roteamento por arquivo (`supervisor.*` = coordenação, `voluntario.*` = voluntário). `__root.tsx` é a casca do app.
  - `supervisor.periodos.tsx`: aba Escalas (escalas fixas, participantes, Fixar, sorteio, publicar) + vagas avulsas.
  - `supervisor.escala.tsx`: Agenda da coordenação (calendário, presença, substituição, backup, Disponibilidade).
  - `voluntario.escala.tsx`: Agenda do voluntário. `voluntario.disponibilidade.tsx`: Escalas do voluntário.
- `src/components/app/`: componentes do app (`AttendanceManager` = presença e substituição, `AvailabilityControl` = botão Disponível/Indisponível, `FixedAvailabilityDialog` = disponibilidade por pessoa para a coordenação, `OpportunityManager` = vagas, avatar, avisos, senha etc.).
- `src/data/types.ts`: tipos. `loader.ts`: lê do Supabase o que o usuário pode ver. `store.ts`: cache em memória e `useStore()`.
- `src/data/repository.ts`: **todas** as alterações de dados passam por aqui (`repo`).
- `src/data/selectors.ts`: consultas sobre os dados (agenda, escala, backup, datas das escalas fixas).
- `src/lib/`: `nav.ts` (abas), `supabase.ts` (cliente e `friendlyError`), `format.ts` (datas, `today()`, CPF), `time.ts`, `pwa.ts`, `report.ts` (PDF).
- `supabase/migrations/`: estrutura do banco em ordem. **É a fonte da verdade das permissões.** O mapa do que cada uma faz (e onde está a versão em vigor de cada função) fica em `supabase/README.md`.
- `supabase/functions/manage-users/`: Edge Function de contas.
- `public/`: `manifest.webmanifest`, `sw.js` e ícones. `vercel.json`: build, rotas da SPA e cabeçalhos de segurança.

## Banco de dados

- `profiles` (pessoa, papel, status, foto; `id` = `auth.users`) e `volunteer_details` (CPF, telefone, e-mail, nascimento).
- `fixed_schedules` (escalas fixas), `fixed_members` (participantes), `fixed_exceptions` ("não posso nesse dia"; `cancelled_at` = desfeito), `fixed_pins` (fixados por data).
- `periods` e `needs`: mês e turnos. `needs.fixed_id` liga o turno à escala fixa; `needs.responsavel_id` é quem cuida.
- `draws`, `draw_slots`, `draw_picks`: sorteios e escalados (status `rascunho`, `publicado` ou `substituido`).
- `attendance` (presença: `presente`, `faltou`, `cancelado`, `substituido`, `escalado`) e `substitutions` (trocas).
- **Backup** não tem tabela: é quem tem presença `cancelado`/`substituido` no turno e um Indisponível desfeito na data (`_is_backup` no banco, `backupsOf` no app).
- `opportunities`, `applications`, `day_availability`: vagas avulsas e candidaturas.
- `notifications`, `notif_prefs`: avisos e preferências. `app_settings`: nome da instituição e política de visibilidade. `nav_config`: abas do menu.
- `availabilities`: disponibilidade do fluxo mensal antigo (só histórico).
- Funções que o app chama (RPC): `draw_fixed`, `publish_draw`, `set_fixed_pins`, `mark_unavailable`, `mark_available`, `substitute`, `apply_to_opportunity`, `cancel_application`, `confirm_selection`, `set_user_role`, `staff_update_volunteer`, `password_changed`, `scale_counts`, `opportunity_counts`, `public_app_name`. As que começam com `_` são internas e não podem ser chamadas pelo app.

## Regras que não podem ser quebradas

- **Toda permissão fica no banco** (RLS + funções `security definer` que conferem o perfil). Esconder algo na tela não é segurança.
- Toda regra nova de acesso precisa de uma **migration nova** em `supabase/migrations/` (nunca edite uma migration já aplicada).
- Nunca use a chave `service_role`/secret no frontend nem em variáveis `VITE_*`.
- Ações sensíveis passam por RPC (lista acima). Contas e senhas só pela Edge Function `manage-users`.
- O usuário anônimo não lê nada. A única exceção é `public_app_name()` (só o nome da instituição).
- Funções novas: `revoke execute ... from public, anon` e `grant` só a `authenticated` quando o app precisar chamar.
- As telas só alteram dados por `repo`. Não chame `supabase.from(...).insert/update/delete` direto nas telas.
- Dados pessoais ficam em `volunteer_details`, separados de `profiles`.
- Fotos no bucket privado `avatars` (até 2 MB, JPG/PNG/WEBP), exibidas por link assinado de 1 hora.
- O service worker só guarda arquivos do app. **Nunca** guarde no cache respostas do Supabase.
- A CSP é gerada no build com hashes dos scripts. Se o build falhar por CSP, corrija a causa. Nada de `unsafe-inline` em `script-src`.
- Não reescreva o histórico do Git publicado (sem force push, amend ou rebase de commits enviados).

## Convenções de código

- TypeScript estrito. Textos da interface e comentários em português, curtos e claros.
- Horários `HH:mm` (use `src/lib/time.ts`). Datas `YYYY-MM-DD`; use `today()` (fuso de São Paulo), nunca `new Date()` puro para o "hoje".
- Erros do servidor viram mensagens amigáveis em `friendlyError()`. Ações na tela usam `act(repo.algo(), "mensagem de sucesso")`.
- Layout mobile-first. Nenhuma tela pode ter rolagem lateral em 360px. Cartões em grade precisam de `min-w-0` (o `Panel` já tem).

## Dicas para quem for mexer (armadilhas conhecidas)

- **Migrations pelo MCP do Supabase**: chamadas grandes (mais de ~12 KB de SQL) estouram o tempo; divida em migrations menores. SQL com `delete` ou `drop` pede confirmação do dono e, sem resposta, expira: não contorne, deixe anotado em "O que falta".
- No banco, o nome das migrations é o mesmo do arquivo, mas a numeração (versão) é a data em que foram aplicadas; isso é normal.
- **Testar permissões no banco**: dentro de um bloco `do $$ ... $$`, crie pessoas de teste, use `set local role authenticated` e `set_config('request.jwt.claims', '{"sub": "<id>"}', true)` para agir como cada perfil e termine com `raise exception` mostrando o resultado. Assim tudo é desfeito e nada fica gravado.
- O ambiente de nuvem das IAs pode não acessar `*.supabase.co` por HTTP; use as ferramentas do MCP.
- Depois de mudar o banco, rode os avisos de segurança e de desempenho do Supabase. Avisos esperados: funções `security definer` liberadas para `authenticated` (de propósito; cada uma confere o perfil), `public_app_name` para `anon` e "leaked password protection" (só nos planos pagos).

## Antes de entregar uma mudança

1. `bun run build` sem erros.
2. `bun run test` passando e `bun run lint` limpo (`bunx eslint . --fix` arruma a formatação).
3. Se mexeu em tela: rode o teste de `e2e/` (nenhum problema em 360px).
4. Se mexeu em permissão: teste no banco como admin, coordenador, responsável, voluntário, inativo e anônimo.
5. Rode os avisos de segurança do Supabase (advisors).
6. Atualize este arquivo (Situação atual / O que falta / seções afetadas).
7. Envie para a `main` e explique ao dono, em poucas frases, o que mudou e o que ele precisa testar no celular.
