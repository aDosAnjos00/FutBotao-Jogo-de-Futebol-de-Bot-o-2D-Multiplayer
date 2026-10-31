# FutBotão

Jogo de futebol de botão 2D para duas pessoas, com estado da partida mantido no servidor. O frontend em React conversa com o backend Spring Boot pelo protocolo JSON-RPC 2.0.

## Funcionalidades

- Criar uma partida e compartilhar o código da sala.
- Permitir que um segundo jogador entre na sala.
- Alternar as jogadas e validar a vez no servidor.
- Atualizar posições, bola e placar no servidor.
- Encerrar a partida quando um jogador marca três gols.
- Atualizar o outro cliente consultando o estado da partida periodicamente.

## Tecnologias

- Java 21 e Spring Boot 4.
- Maven Wrapper incluído no repositório.
- React 18, TypeScript e Vite.
- JSON-RPC 2.0 sobre HTTP e JSON.

## Pré-requisitos

- JDK 21 instalado e configurado no `JAVA_HOME`.
- Node.js LTS instalado; ele fornece `node` e `npm`.
- Git para obter o repositório.

No Windows PowerShell, confirme as ferramentas com `java -version`, `node --version` e `npm --version`. Se o PowerShell bloquear `npm.ps1`, use `npm.cmd` nos comandos abaixo.

## Executar localmente

O backend e o frontend rodam em terminais separados. Mantenha os dois abertos enquanto usa o jogo.

### 1. Iniciar o backend

Na pasta raiz do projeto:

```powershell
.\mvnw.cmd spring-boot:run
```

O Spring Boot inicia na porta `8080`. O endpoint `GET http://localhost:8080/status` deve retornar `{"status":"online"}`.

### 2. Iniciar o frontend

Em outro terminal:

```powershell
Set-Location .\frontend
npm ci
npm run dev
```

Abra o endereço informado pelo Vite, normalmente `http://localhost:5173`. A configuração em `frontend/vite.config.ts` encaminha `/rpc` e `/status` para o backend em `http://localhost:8080`; não é necessário Live Server.

Para jogar com duas pessoas, abra o frontend em dois clientes separados. Uma pessoa cria a sala e compartilha o código; a outra entra com esse código.

## Regras desta versão

- Cada partida aceita dois jogadores.
- Uma jogada é aceita por turno; o servidor valida a vez e a peça usada.
- O campo lógico mede 100 por 60 unidades e o gol ocupa a faixa Y de 25 a 35 nas extremidades.
- A peça percorre até 20 unidades conforme a força da jogada. Se sua trajetória passar a até 2,5 unidades da bola, ela a impulsiona.
- A partida termina quando alguém chega a três gols.
- O estado das partidas fica somente na memória. Reiniciar o backend apaga as partidas em andamento.
- A movimentação usa regras simplificadas, sem física realista nem colisão entre peças.

## Protocolo JSON-RPC

As chamadas de partida são enviadas por `POST /rpc`, com JSON-RPC 2.0. Os métodos implementados são:

- `partida.criar`
- `partida.entrar`
- `partida.obterEstado`
- `partida.fazerJogada`

O contrato completo, incluindo campos de entrada, respostas e códigos de erro, está em [`docs/contrato-json-rpc.md`](docs/contrato-json-rpc.md).

## Testes e build

Backend:

```powershell
.\mvnw.cmd test
```

Frontend, na pasta `frontend`:

```powershell
npm.cmd test
npm.cmd run build
```

## Estrutura principal

```text
src/main/java/br/com/futbotao/
  controller/   endpoints de status e cadastro de jogadores
  rpc/          endpoint JSON-RPC e erros de protocolo
  service/      regras de partida e cadastro em memória
  model/        modelo de jogador cadastrado
  dto/          objetos de entrada e saída REST
frontend/src/
  api/          cliente JSON-RPC, erros e tipos TypeScript
  components/   telas e controles do jogo
  game/         geometria, validação e previsão visual da jogada
  hooks/        estado da partida, polling e ações do cliente
docs/
  contrato-json-rpc.md
  guia-do-codigo.md
```

Para uma leitura guiada do código e o roteiro de fala, consulte [`docs/guia-do-codigo.md`](docs/guia-do-codigo.md).
