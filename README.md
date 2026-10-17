# Crie um aplicativo web responsivo, com foco principal em uso pelo celular, para gerenciamento de...

Crie um aplicativo web responsivo, com foco principal em uso pelo celular, para gerenciamento de escala de aproximadamente 60 voluntários de uma igreja.



IMPORTANTE:



- Nesta primeira versão NÃO conectar Firebase, Supabase, Google Sheets, APIs externas ou qualquer banco de dados.

- Usar dados mockados/localmente apenas para demonstrar e testar toda a experiência do aplicativo.

- A arquitetura deve ser organizada de forma que futuramente seja possível substituir os dados mockados por um banco de dados sem reconstruir as telas.

- Não criar integração de autenticação externa nesta fase.

- Criar usuários fictícios suficientes para demonstrar o funcionamento.

- O aplicativo deve parecer um produto real pronto para uso, e não um simples protótipo visual.



OBJETIVO



O sistema permitirá que um supervisor gerencie aproximadamente 60 voluntários, suas disponibilidades e a escala mensal.



O sorteio será realizado uma vez por mês, mas a quantidade de voluntários necessários varia conforme cada data/turno.



A regra principal do sorteio é:



"Quem foi escalado menos vezes recentemente tem prioridade."



O sistema deverá preparar a interface para futuramente calcular essa prioridade com base no histórico real.



PERFIS



Existem dois tipos de usuário:



1. Supervisor



Pode:



- Visualizar todos os voluntários.

- Cadastrar voluntários.

- Ativar ou desativar voluntários.

- Visualizar foto, nome e dados básicos.

- Criar períodos mensais.

- Definir datas e turnos.

- Definir quantas pessoas são necessárias em cada data/turno.

- Abrir e encerrar o período de disponibilidade.

- Visualizar quem respondeu e quem ainda não respondeu.

- Executar o sorteio.

- Conferir o resultado antes da publicação.

- Publicar a escala.

- Visualizar a escala completa.

- Registrar presença ou falta.

- Fazer substituições.

- Consultar histórico.



2. Voluntário



Pode:



- Visualizar seu próprio perfil.

- Adicionar ou alterar sua foto, se desejar.

- Informar disponibilidade.

- Alterar sua disponibilidade enquanto o período estiver aberto.

- Visualizar somente sua própria escala.

- Visualizar seus registros de presença.

- Alterar sua senha futuramente.



Um voluntário NÃO deve conseguir visualizar dados pessoais, disponibilidade, histórico ou escala individual dos outros voluntários.



LOGIN — PROTÓTIPO



Criar uma tela de login simples.



Nesta primeira versão usar dados fictícios.



Login do supervisor:



- usuário: supervisor

- senha: 123456



Criar também usuários voluntários fictícios utilizando CPF como identificador de login.



Exemplo:



- CPF: 11111111111

- senha: 123456



O sistema deverá prever o seguinte fluxo futuro:



1. Supervisor cria o acesso do voluntário.

2. Voluntário recebe CPF e senha inicial.

3. No primeiro acesso, deve alterar a senha.

4. Depois poderá alterar a senha novamente quando desejar.

5. Supervisor poderá futuramente redefinir a senha de um voluntário.



Não implementar autenticação real nesta etapa.



PERFIL DO VOLUNTÁRIO



Criar uma tela de perfil contendo:



- Foto de perfil opcional.

- Nome.

- CPF parcialmente mascarado.

- Status.

- Botão "Alterar foto".

- Botão "Alterar senha".



A foto é OPCIONAL.



Se o voluntário não tiver foto, mostrar um avatar padrão elegante com as iniciais do nome.



A foto deverá aparecer:



- No perfil do voluntário.

- Na escala.

- Na lista de voluntários do supervisor.

- No resultado do sorteio.



Criar componentes reutilizáveis para avatar/foto para facilitar futura integração com armazenamento de imagens.



Não exigir foto para utilizar o aplicativo.



ÁREA DO VOLUNTÁRIO



Criar dashboard simples e amigável.



Mostrar:



- Saudação com o primeiro nome.

- Foto/avatar.

- Próxima escala.

- Status da disponibilidade do período atual.

- Atalhos:



"Informar disponibilidade"

"Minha escala"

"Meu histórico"

"Meu perfil"



Card de próxima escala



Exemplo:



[Foto]



João Silva



Sábado, 14 de novembro

Manhã

Status: Escalado



Quando não houver escala



Mostrar uma mensagem amigável:



"Você ainda não possui uma escala publicada."



DISPONIBILIDADE



Criar tela para o voluntário informar sua disponibilidade para o período atual.



Mostrar as datas/turnos em cards.



Exemplo:



07 NOV

Sábado

Manhã



[ Disponível ]

[ Indisponível ]



14 NOV

Sábado

Manhã



[ Disponível ]

[ Indisponível ]



Permitir que o usuário altere sua resposta enquanto o período estiver aberto.



Mostrar claramente:



"Disponibilidade aberta até 05/11."



Depois do encerramento:



"Período encerrado. Sua disponibilidade não pode mais ser alterada."



Criar também um estado para "Ainda não informado".



ÁREA DO SUPERVISOR



Criar dashboard administrativo.



Mostrar cards:



- Total de voluntários

- Voluntários ativos

- Disponibilidades respondidas

- Pendências

- Próxima escala

- Vagas necessárias

- Vagas preenchidas



Criar menu:



Dashboard

Voluntários

Períodos

Disponibilidades

Sorteio

Escala

Presença

Histórico

Configurações



VOLUNTÁRIOS



Criar tabela/lista de voluntários com:



- Foto/avatar

- Nome

- CPF mascarado

- Status

- Última escala

- Quantidade de escalas recentes



Permitir:



- Buscar por nome.

- Filtrar ativos/inativos.

- Abrir perfil.

- Editar.

- Ativar/desativar.



FOTO DOS VOLUNTÁRIOS



A foto deve ser opcional.



Criar botão:



"Adicionar foto"



Permitir futuramente selecionar uma imagem do celular.



No protótipo, utilizar imagens fictícias ou avatares.



Na escala, utilizar avatar circular pequeno ao lado do nome.



No perfil, utilizar avatar maior.



PERÍODOS



Criar tela para o supervisor criar um período mensal.



Exemplo:



NOVEMBRO 2026



Campos:



- Mês

- Ano

- Data de abertura das disponibilidades

- Prazo final

- Status



Status possíveis:



Rascunho

Disponibilidade aberta

Disponibilidade encerrada

Sorteio realizado

Escala publicada

Encerrado



NECESSIDADES



Dentro de cada período, permitir cadastrar as necessidades.



Exemplo:



07/11/2026

Manhã

4 voluntários



14/11/2026

Manhã

6 voluntários



21/11/2026

Tarde

3 voluntários



28/11/2026

Manhã

5 voluntários



A quantidade de voluntários NÃO é fixa para o mês.



Cada data/turno pode ter uma quantidade diferente.



DISPONIBILIDADES DO SUPERVISOR



Criar visão geral mostrando:



Data

Turno

Vagas

Disponíveis

Indisponíveis

Sem resposta



Exemplo:



14/11

Manhã

6 vagas

18 disponíveis

32 indisponíveis

10 sem resposta



Permitir abrir a lista dos voluntários disponíveis.



SORTEIO



Criar uma área específica chamada:



"Sorteio da Escala"



O processo deverá ser visualmente dividido em etapas.



Etapa 1 — Conferência



Mostrar:



- Período.

- Necessidades.

- Quantidade de vagas.

- Quantidade de voluntários elegíveis.

- Pendências.



Etapa 2 — Critério



Mostrar claramente:



"Prioridade: voluntários com menor número de escalas recentes."



Critério futuro:



1. Menor quantidade de escalas nos últimos 3 meses.

2. Em caso de empate, menor quantidade nos últimos 12 meses.

3. Persistindo empate, desempate aleatório.



Nesta primeira versão, simular os números utilizando dados mockados.



Etapa 3 — Gerar sorteio



Botão grande:



"Gerar sorteio"



Antes de executar, mostrar confirmação:



"Você está prestes a gerar uma nova proposta de escala. O resultado poderá ser revisado antes da publicação."



Etapa 4 — Resultado



Mostrar o resultado agrupado por data/turno.



Exemplo:



14/11 — Manhã



[foto] João Silva

[foto] Maria Souza

[foto] Carlos Oliveira

[foto] Ana Santos



6 vagas

6 preenchidas



Mostrar também informações administrativas:



Escalas recentes

Prioridade

Critério de desempate



Essas informações são para o supervisor e não devem aparecer para os voluntários.



Vagas não preenchidas



Se houver menos voluntários elegíveis que vagas:



Mostrar alerta:



"Não existem voluntários elegíveis suficientes para preencher todas as vagas."



Exemplo:



6 vagas necessárias

4 voluntários elegíveis

2 vagas sem preenchimento



Não inventar ou selecionar pessoas indisponíveis.



PUBLICAÇÃO



O resultado do sorteio inicialmente deve ficar como:



"Rascunho"



O supervisor poderá revisar.



Botão:



"Publicar escala"



Antes da publicação:



"Tem certeza que deseja publicar esta escala? Após a publicação, ela ficará disponível para os voluntários."



Depois da publicação:



Status:

"Escala publicada"



ESCALA



Criar uma visualização bonita da escala.



Para o supervisor, mostrar todos.



Para o voluntário, mostrar somente suas próprias escalas.



Exemplo:



NOVEMBRO 2026



Sábado — 14/11

Manhã



[foto] João Silva

[foto] Maria Souza

[foto] Carlos Oliveira

[foto] Ana Santos



A foto deve aparecer ao lado do nome.



No celular, utilizar cards em vez de uma tabela larga.



PRESENÇA



Criar área para o supervisor registrar a presença.



O supervisor seleciona a data/turno e vê:



[foto] João Silva

Escalado



[ Presente ] [ Faltou ]



[foto] Maria Souza

Escalada



[ Presente ] [ Faltou ]



Registrar também:



- Data

- Turno

- Voluntário

- Status

- Data/hora do registro

- Supervisor responsável



Possíveis status:



Presente

Faltou

Substituído

Cancelado



Essa funcionalidade deverá futuramente alimentar o histórico usado pelo sorteio.



SUBSTITUIÇÃO



Criar opção:



"Substituir voluntário"



Ao clicar, mostrar os voluntários elegíveis disponíveis.



Ordenar futuramente pela mesma regra de prioridade do sorteio.



Registrar:



- Quem saiu.

- Quem entrou.

- Data/hora.

- Supervisor.

- Motivo.



HISTÓRICO



Criar tela para o supervisor visualizar:



- Escalas realizadas.

- Escalas canceladas.

- Substituições.

- Presenças.

- Faltas.

- Quantidade de escalas por voluntário.



Criar cards e gráficos simples.



HISTÓRICO DO SORTEIO



Cada execução de sorteio deve ser tratada como uma versão.



Exemplo:



NOVEMBRO 2026

Sorteio #1

Data: 02/11/2026

Status: Publicado



Se houver novo sorteio:



Sorteio #2

Data: 03/11/2026

Status: Publicado



Nunca apagar visualmente a existência dos sorteios anteriores.



No protótipo, utilizar dados simulados.



DESIGN



Criar um design moderno, limpo e acolhedor.



Como é um aplicativo para uma igreja, evitar aparência corporativa excessivamente fria.



Utilizar:



- Cards arredondados.

- Ícones simples.

- Boa hierarquia visual.

- Tipografia legível.

- Espaçamento confortável.

- Navegação inferior no celular para voluntários.

- Menu lateral ou superior para supervisor.

- Estados vazios bem desenhados.

- Mensagens de confirmação.

- Alertas claros.

- Skeleton/loading states quando necessário.



Não utilizar excesso de elementos religiosos ou imagens de símbolos religiosos. A identidade deve ser moderna e discreta.



RESPONSIVIDADE



Prioridade:



1. Celular

2. Tablet

3. Desktop



O aplicativo deverá funcionar muito bem em telas pequenas.



Evitar tabelas que exijam rolagem horizontal no celular.



DADOS MOCKADOS



Criar pelo menos 12 voluntários fictícios para demonstrar o sistema.



Cada voluntário deverá possuir:



- ID

- Nome

- CPF fictício

- Foto/avatar

- Status

- Quantidade de escalas recentes

- Quantidade de escalas nos últimos 12 meses

- Disponibilidades

- Escalas

- Presenças



Criar também dados fictícios para pelo menos um período mensal completo.



Não utilizar dados reais de pessoas.



IMPORTANTE SOBRE O FUTURO BANCO



Estruturar o código para que os dados sejam separados da interface.



Criar uma camada/repositório de dados simulados, para que posteriormente seja possível substituir:



Mock Data

↓

Banco de dados



sem precisar reconstruir as telas.



Não implementar ainda qualquer banco ou serviço externo.



RESULTADO ESPERADO



Entregar um aplicativo navegável, funcional como protótipo, com todos os fluxos principais funcionando com dados fictícios:



Login

→ Dashboard

→ Disponibilidade

→ Sorteio

→ Revisão

→ Publicação

→ Escala

→ Presença

→ Histórico



O objetivo desta primeira versão é validar a experiência completa do aplicativo antes de escolher e conectar o banco de dados definitivo.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/112db88f-3c99-4b5f-8448-ca55875e05ad).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
