# Escala de Voluntários

Aplicativo web instalável (PWA), pensado para o celular, que organiza a escala de cerca de 60 voluntários de uma igreja. Ele cobre todo o ciclo: disponibilidade mensal, sorteio justo, publicação da escala, presença, substituições e vagas avulsas.

## O que o app faz

- **Períodos mensais.** A coordenação cria o mês, os dias e horários de cada turno e quantas pessoas cada um precisa.
- **Disponibilidade.** Enquanto o período está aberto, cada voluntário marca em quais turnos pode servir.
- **Sorteio justo.** A prioridade vai para quem foi escalado menos vezes nos últimos 3 meses. Em caso de empate, conta quem serviu menos nos últimos 12 meses e, persistindo o empate, o desempate é aleatório. Ninguém é sorteado para um turno em que marcou "indisponível", nem para dois turnos no mesmo dia. O resultado fica como rascunho até ser publicado.
- **Presença e substituições.** Registro de presença, falta e cancelamento, além da troca de um escalado por outro voluntário disponível.
- **Vagas avulsas.** Dias extras com mínimo e máximo de pessoas. Os voluntários se candidatam e o responsável confirma quem vai servir.
- **Avisos automáticos.** Nova candidatura, cancelamento, mínimo atingido, vaga lotada, vaga abaixo do mínimo a 24h do início, aniversários e lembretes de 24h, 12h, 6h, 3h e 1h antes. Cada pessoa liga ou desliga cada tipo de aviso.
- **Agenda da coordenação.** Calendário do mês com todos os horários criados (escala mensal e vagas avulsas) e todos os escalados ao mesmo tempo. Cada horário mostra vagas preenchidas, vagas vazias e quem se candidatou ou marcou disponibilidade.
- **Privacidade da escala** (Configurações → "Quem vê a escala"). A coordenação escolhe uma opção, que vale para todos e é aplicada pelo banco:
  - **Privado:** cada voluntário vê só a própria escala.
  - **Mesmo turno:** vê quem está no mesmo turno ou vaga que ele.
  - **Escala geral:** vê todos os turnos com os nomes, mas o app não tem tela de agenda individual de outra pessoa.
- **Relatórios** em PDF e **histórico** completo.

## Perfis de acesso

| Perfil | Como entra | O que pode fazer |
| --- | --- | --- |
| **Admin** (dono do app) | CPF + senha | Tudo o que o supervisor faz, mais criar, desativar e alterar a senha de supervisores. Não pode ser desativado. |
| **Supervisor** | CPF + senha | Cuida do app no dia a dia: voluntários, períodos, sorteio, escala, presença, vagas, relatórios e configurações. Define quem é responsável por cada turno, dia ou vaga. |
| **Responsável** | CPF + senha | É um voluntário com uma área extra, **Turnos**. Lá ele vê a equipe e os contatos **apenas** dos turnos e vagas que lhe foram atribuídos, marca presença, faz substituições e gerencia as vagas desses turnos. Continua podendo ser escalado normalmente. |
| **Voluntário** | CPF + senha | Vê o próprio perfil e a própria escala, informa disponibilidade, candidata-se a vagas e altera a foto e a senha. Dos colegas de turno, vê só o nome e a foto. |

**Login de todos é o CPF, só com números.** As contas são criadas pela coordenação na página **Equipe**, porque não existe cadastro público. A **senha inicial é o próprio CPF**, e no primeiro acesso a pessoa é obrigada a criar uma senha própria (que não pode ser o CPF). Na página Equipe, a coordenação também altera a senha de alguém de duas formas: **voltar para o CPF** (a pessoa troca no próximo acesso) ou **digitar uma senha nova**. O app confere os dígitos verificadores do CPF para evitar erro de digitação no login.

> Como o CPF não é segredo, a conta fica vulnerável até a pessoa trocar a senha inicial. Peça que cada um entre e troque a senha logo depois de ser cadastrado. A página Equipe mostra quem ainda está "Aguardando troca da senha inicial".

## Segurança

O link do app é compartilhado com todos os voluntários, então a segurança não depende de esconder o endereço. Ela está no servidor:

- **Regras de acesso no banco (RLS).** Todas as tabelas têm Row Level Security. Cada consulta só devolve o que o perfil logado pode ver, mesmo que alguém use as ferramentas do navegador ou chame a API diretamente. Dados pessoais (CPF, telefone, e-mail, nascimento) ficam numa tabela separada, visível apenas ao próprio voluntário, à coordenação e ao responsável do turno dele.
- **Ações sensíveis passam por funções seguras no banco.** É o caso de sorteio, publicação, substituição, candidatura, confirmação de seleção e troca de perfil. Essas funções conferem o perfil antes de agir, e o voluntário não consegue gravar direto nessas tabelas.
- **Contas gerenciadas no servidor.** Criar contas, alterar senhas, desativar acessos e trocar CPF é feito por uma Edge Function do Supabase que usa a chave secreta. Essa chave nunca chega ao navegador. Desativar alguém bloqueia o login e corta o acesso aos dados na hora, preservando o histórico.
- **Sem acesso anônimo.** Visitantes sem login não leem nada. Uma conta sem perfil ativo também não vê nada, mesmo que exista no sistema de login.
- **Fotos privadas.** As fotos ficam num bucket privado, com limite de 2 MB e apenas JPG, PNG ou WEBP. São exibidas por links temporários de 1 hora, só para quem pode ver aquela pessoa. O app reduz a foto no aparelho e remove metadados como a localização GPS.
- **Proteções do navegador.** O site usa uma Content Security Policy com hashes exatos dos scripts (gerada a cada build), HSTS, bloqueio de iframes (contra clickjacking), `nosniff`, Referrer-Policy e Permissions-Policy, configurados em `vercel.json` e `scripts/postbuild.mjs`.
- **PWA sem vazamento de dados.** O service worker guarda apenas os arquivos do app. Respostas do Supabase (dados pessoais, fotos e login) nunca vão para o cache do aparelho, e os dados ficam só em memória enquanto o app está aberto.
- **Senhas.** A senha pessoal precisa ter no mínimo 8 caracteres, com letras e números, e não pode ser o CPF. A troca exige a senha atual. A senha inicial (o CPF) obriga a troca no primeiro acesso.

### Configurações a fazer no painel do Supabase

Estas opções não podem ser definidas pelo código e precisam ser ajustadas uma vez no painel do Supabase:

1. **Authentication → Sign In / Providers → desligue "Allow new users to sign up".** Mesmo ligado, um intruso não veria nada (falta o perfil), mas desligar fecha a porta de vez.
2. **Authentication → Providers → Email → desligue "Confirm email"**, pois os logins internos não recebem e-mail.
3. **Authentication → Passwords → mínimo de 8 caracteres** (não marque a exigência de letras, porque a senha inicial é o CPF, só com números) e, se disponível no seu plano, **"Leaked password protection"**.
4. **Authentication → URL Configuration:** coloque o endereço da Vercel em *Site URL*.
5. **Edge Functions → manage-users → Secrets:** defina `ALLOWED_ORIGINS` com o endereço do app (ex.: `https://seu-app.vercel.app`) para restringir quem pode chamar a função.

## Tecnologias

React 19, TanStack Router/Start (modo SPA), Tailwind CSS 4, Radix UI, Supabase (Postgres, Auth, Storage, Edge Functions, pg_cron) e hospedagem na Vercel.

## Como rodar localmente

Pré-requisitos: [Bun](https://bun.sh) (ou Node 22+).

```bash
bun install
cp .env.example .env.local   # preencha com os dados do seu projeto Supabase
bun run dev                  # http://localhost:8080
```

Outros comandos:

```bash
bun run build   # build de produção (dist/client) + CSP e service worker
bun run test    # testes
bun run lint    # verificação de código
```

## Banco de dados

A estrutura está versionada em `supabase/migrations/`:

- `…_schema.sql`: tabelas, tipos, funções de permissão e regras de acesso (RLS).
- `…_functions.sql`: funções seguras (sorteio, candidaturas, substituição), avisos automáticos agendados a cada 10 minutos e o bucket de fotos.

A função de servidor fica em `supabase/functions/manage-users/`.

Para recriar o banco em outro projeto, use a [Supabase CLI](https://supabase.com/docs/guides/local-development):

```bash
supabase link --project-ref SEU_PROJETO
supabase db push
supabase functions deploy manage-users
```

Depois crie a conta do administrador, conforme descrito em `supabase/README.md`.

## Deploy na Vercel

1. Importe o repositório na Vercel. O `vercel.json` já define o build, a pasta de saída e os cabeçalhos de segurança.
2. Em **Settings → Environment Variables**, cadastre:
   - `VITE_SUPABASE_URL`: URL do projeto (ex.: `https://xxxx.supabase.co`)
   - `VITE_SUPABASE_PUBLISHABLE_KEY`: chave **publishable** (pública) do projeto
3. Faça o deploy e compartilhe o link. No Android, o app oferece o botão **Instalar**. No iPhone, abra no Safari e toque em **Compartilhar → Adicionar à Tela de Início**.

> Nunca coloque a chave `service_role` / secret em variáveis `VITE_*`: tudo que começa com `VITE_` vai para o navegador.

## Estrutura do código

```
src/
  routes/          telas (roteamento por arquivo)
    supervisor.*   área da coordenação (admin e supervisor)
    voluntario.*   área do voluntário (e a aba Turnos do responsável)
  components/app/  componentes do app (avatar, notificações, presença, vagas…)
  data/
    loader.ts      lê do Supabase só o que o usuário pode ver
    repository.ts  todas as alterações de dados passam por aqui
    selectors.ts   consultas sobre os dados carregados
  lib/             Supabase, formatação, PWA
supabase/          migrations do banco e Edge Function
public/            manifesto, service worker e ícones do PWA
```
