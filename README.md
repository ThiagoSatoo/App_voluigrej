# Sistema de escalas

Aplicativo web instalável (PWA), pensado para o celular, que organiza a escala de cerca de 60 voluntários de uma paróquia: escalas fixas semanais, sorteio justo, publicação, presença, substituições e vagas avulsas.

> **Vai trabalhar no projeto (pessoa ou IA)?** Comece pelo [`AGENTS.md`](AGENTS.md). Lá estão a situação atual, o que falta, como o app funciona e as regras.

## O que o app faz

- **Escalas fixas.** A coordenação cadastra horários que se repetem toda semana (ex.: "Domingo 09:00–11:00, 4 pessoas"). Pode haver várias no mesmo dia.
- **Participação.** Cada voluntário escolhe de quais escalas fixas participa. A coordenação também pode inscrever ou remover pessoas.
- **Sorteio justo, um mês por vez.** Para cada escala fixa, o app monta o mês: entra primeiro quem serviu menos nos últimos 3 meses (depois 12 meses; no empate, sorteio). Assim todos servem de forma parecida. A coordenação pode **fixar** pessoas garantidas numa data ou no mês inteiro. A escala sai como rascunho e só os voluntários a veem depois de publicada.
- **Indisponível / Disponível.** O voluntário avisa que não pode numa data. Se ele estava escalado, o app chama um substituto sozinho e avisa a coordenação. Se mudar de ideia, toca em "Disponível": volta para a escala ou fica de backup.
- **Presença.** Na Agenda, a coordenação marca Presente, Faltou ou Substituir em cada turno. O responsável faz o mesmo nos turnos dele.
- **Vagas avulsas.** Dias extras com mínimo e máximo de pessoas. Os voluntários se candidatam e o responsável confirma quem vai.
- **Agenda.** Calendário do mês. A coordenação vê todos os horários, escalados e vagas vazias. O voluntário vê o próximo turno e a própria escala.
- **Avisos automáticos.** Candidaturas, cancelamentos, indisponibilidades, substitutos, aniversários e lembretes antes de cada turno. Cada pessoa liga ou desliga cada tipo.
- **Privacidade da escala.** A coordenação escolhe quem vê o quê ("Privado", "Mesmo turno" ou "Escala geral"), e o banco aplica a regra.
- **Equipe, Admin, Relatórios em PDF e Histórico.**
- **Sempre atualizado.** Ao abrir ou voltar para o app, ele baixa a versão mais nova e os dados mais recentes sozinho.

## Perfis

| Perfil | O que pode fazer |
| --- | --- |
| **Administrador** | Tudo, inclusive gerenciar coordenadores e ligar/desligar as abas de cada perfil (tela **Admin**). |
| **Coordenador** | O dia a dia: equipe, escalas fixas, sorteio, publicação, presença, vagas, relatórios e configurações. |
| **Responsável** | Voluntário com a aba extra **Turnos**: vê a equipe e os contatos só dos turnos e vagas dele, marca presença e faz substituições. |
| **Voluntário** | Vê a própria escala, escolhe escalas fixas, marca Indisponível/Disponível, candidata-se a vagas e altera foto e senha. |

**O login de todos é o CPF, só com números.** As contas são criadas pela coordenação na página **Equipe** (não existe cadastro público). A senha inicial é o próprio CPF, e no primeiro acesso a pessoa é obrigada a criar uma senha própria. Peça que cada um troque a senha logo depois de ser cadastrado: a página Equipe mostra quem ainda não trocou.

## Segurança

O link do app é compartilhado com todos, então a segurança não depende de esconder o endereço. Ela está no servidor:

- **Regras de acesso no banco (RLS)** em todas as tabelas. Cada consulta devolve só o que o perfil logado pode ver, mesmo que alguém chame a API diretamente.
- **Ações sensíveis por funções seguras no banco** (sorteio, publicação, indisponibilidade, substituição, candidaturas, troca de perfil). Elas conferem o perfil antes de agir.
- **Contas e senhas** são geridas por uma Edge Function com a chave secreta, que nunca chega ao navegador.
- **Sem acesso anônimo**, **fotos privadas** (links temporários de 1 hora) e **dados pessoais** numa tabela separada.
- **Proteções do navegador**: CSP com hashes dos scripts, HSTS, bloqueio de iframes e outros cabeçalhos (`vercel.json` e `scripts/postbuild.mjs`).
- **PWA sem vazamento**: o aparelho guarda só os arquivos do app, nunca dados do Supabase.

As configurações que só podem ser feitas no painel do Supabase estão em "O que falta", no `AGENTS.md`.

## Como rodar localmente

Pré-requisito: [Bun](https://bun.sh) (ou Node 22+).

```bash
bun install
cp .env.example .env.local   # preencha com os dados do seu projeto Supabase
bun run dev                  # http://localhost:8080
```

```bash
bun run build   # build de produção (dist/client) + CSP e service worker
bun run test    # testes
bun run lint    # verificação de código
```

O teste visual das telas (celular e computador) está em `e2e/README.md`.

## Banco de dados

A estrutura e as regras de acesso estão em `supabase/migrations/`, em ordem. A Edge Function de contas fica em `supabase/functions/manage-users/`. Para montar o banco em outro projeto e criar a conta do administrador, veja `supabase/README.md`.

## Deploy na Vercel

1. Importe o repositório na Vercel. O `vercel.json` já define o build, a pasta de saída e os cabeçalhos de segurança.
2. Em **Settings → Environment Variables**, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (chave **publishable**, pública).
3. Cada push na branch `main` publica uma versão nova. Os celulares se atualizam sozinhos ao abrir o app.
4. Para instalar: no Android, o app oferece o botão **Instalar**; no iPhone, abra no Safari e toque em **Compartilhar → Adicionar à Tela de Início**.

> Nunca coloque a chave `service_role`/secret em variáveis `VITE_*`: tudo que começa com `VITE_` vai para o navegador.
