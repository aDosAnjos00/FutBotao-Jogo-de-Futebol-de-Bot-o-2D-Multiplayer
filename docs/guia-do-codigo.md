# Guia de funcionamento e roteiro de apresentação

Este guia explica o caminho de uma partida, o papel dos principais módulos e uma sequência de apresentação. A implementação usa um servidor central como autoridade: os clientes enviam intenções de jogada e recebem o estado validado pelo Spring Boot.

## Visão geral

```text
Navegador do jogador 1 ─┐
                        ├─ React/Vite ─ JSON-RPC 2.0 ─ Spring Boot ─ PartidaService
Navegador do jogador 2 ─┘     polling      POST /rpc        estado em memória
```

Em desenvolvimento, o navegador carrega o React pelo Vite na porta 5173. O proxy configurado em `frontend/vite.config.ts` encaminha `/rpc` e `/status` ao backend na porta 8080. O polling periódico faz ambos os clientes consultarem o mesmo estado no servidor.

## Caminho de uma partida

1. O cliente abre a tela inicial e escolhe criar uma sala ou entrar usando um código.
2. `usePartida` chama as funções de `frontend/src/api/rpc.ts`.
3. O cliente JSON monta uma requisição JSON-RPC 2.0 e envia `POST /rpc`.
4. `JsonRpcController` valida versão, método, parâmetros e identificador; depois encaminha o método para `PartidaService`.
5. `PartidaService` cria ou altera o estado compartilhado. Cada operação sobre uma sala é sincronizada no objeto da partida.
6. O controlador devolve `result` ou `error` com o identificador da chamada.
7. O hook atualiza a interface e consulta `partida.obterEstado` periodicamente para refletir as ações do outro cliente.
8. O servidor encerra a sala quando o placar de alguém chega a três gols.

## Backend Java

### Inicialização e endpoints

- `src/main/java/br/com/futbotao/FutBotaoApplication.java`: ponto de entrada Spring Boot.
- `controller/StatusController.java`: oferece `GET /status` para indicar que o servidor está online.
- `rpc/JsonRpcController.java`: oferece `POST /rpc`, valida a estrutura JSON-RPC, despacha os quatro métodos de partida e cria respostas de sucesso ou erro.
- `rpc/JsonRpcException.java`: carrega o código e a mensagem de erro de protocolo ou regra.

O `JsonRpcController` é a fronteira de transporte. Ele converte os parâmetros JSON para chamadas de serviço; não deve decidir a lógica de movimento ou pontuação.

### Estado e regras da partida

- `service/PartidaService.java`: implementa criação, entrada, consulta, jogadas, validações, movimento, gols e estado retornado.
- As partidas ficam em um `ConcurrentHashMap`. A sincronização em cada partida serializa as operações que poderiam concorrer na mesma sala.
- A criação guarda o primeiro jogador e devolve código, token e estado. A entrada do segundo jogador muda a sala para `EM_ANDAMENTO` e define o primeiro turno.
- Em uma jogada, o serviço verifica sala, token, situação da partida, turno, peça e limites da direção/força.
- A peça anda na direção normalizada pelo vetor, até 20 unidades na força máxima, limitada às bordas.
- O servidor calcula a distância mínima entre a trajetória e a bola. Se for no máximo 2,5 unidades, a bola avança na direção do chute.
- O gol só é marcado quando a bola cruza uma extremidade na faixa vertical entre 25 e 35. Depois do gol, o placar aumenta e as posições são reiniciadas; ao terceiro gol, a partida é encerrada.
- Os `record`s internos (`EstadoPartida`, `JogadorResumo`, `Campo`, `Posicao` e `PecaResumo`) definem a resposta pública serializada em JSON. Tokens são devolvidos na entrada, não incluídos no estado público.

### Cadastro REST auxiliar

- `controller/JogadorController.java`: expõe cadastro, listagem e busca por ID em `/jogadores`.
- `service/JogadorService.java`: mantém esses registros em memória.
- `model/Jogador.java`, `dto/CriarJogadorRequest.java` e `dto/JogadorResponse.java`: modelo e contratos REST.
- `exception/ApiExceptionHandler.java` e `dto/ErroResponse.java`: padronizam erros de validação e de busca REST.

O cadastro REST é separado das identidades temporárias de jogador usadas dentro de uma partida. O jogo multiplayer não precisa consultar o cadastro para criar ou entrar numa sala.

## Frontend React

### Aplicação e telas

- `frontend/src/main.tsx`: monta o React no elemento raiz da página.
- `frontend/src/App.tsx`: escolhe a tela pela fase da partida e conecta os componentes ao hook `usePartida`.
- `components/TelaInicial.tsx`: formulário para criar ou entrar numa sala.
- `components/SalaEspera.tsx`: mostra o código enquanto aguarda o segundo jogador.
- `components/Campo.tsx`: desenha campo, bola e peças e transforma gesto do usuário em intenção de jogada.
- `components/ControleJogada.tsx`: fornece controles alternativos de jogada.
- `components/Placar.tsx`, `AvisoGol.tsx` e `TelaFim.tsx`: exibem placar, gol e resultado final.
- `frontend/src/styles.css`: apresentação visual e adaptação das telas.

### Estado do cliente e chamadas remotas

- `hooks/usePartida.ts`: coordena criação/entrada, sessão, estado visível, erros, turnos, avisos de gol e polling.
- A sessão contém código da partida e token do jogador no `sessionStorage`, além dos IDs que permitem a interface identificar a peça local. A sessão é por aba do navegador.
- O polling consulta o servidor a cada segundo enquanto a partida está ativa. Respostas antigas são descartadas e chamadas em voo podem ser canceladas para evitar atualizar a tela com estado atrasado.
- `api/rpc.ts`: serializa as chamadas JSON-RPC e trata `result`, `error`, falha de rede e status do backend.
- `api/types.ts`: define os tipos TypeScript que espelham os `record`s Java do estado da partida.
- `api/erros.ts`: traduz códigos de erro em mensagens apropriadas à interface.

### Geometria e previsão

- `game/geometria.ts`: converte coordenadas do mouse para o campo lógico, calcula direção e força do arraste, valida limites e prevê visualmente a posição da bola.
- `game/equipes.ts`: fornece nomes/identidade visual das equipes.
- A previsão ajuda a desenhar a mira antes de enviar a jogada. Ela não define o placar nem substitui o cálculo do backend; o resultado aceito sempre vem do servidor.

## Erros e validação

O endpoint JSON-RPC devolve códigos padronizados para requisições inválidas, métodos/parâmetros desconhecidos e regras da partida. Exemplos de regras: partida cheia (`-32002`), token de jogador inválido (`-32003`), turno incorreto (`-32005`), jogada inválida (`-32006`) e partida encerrada (`-32007`). A lista completa está em `docs/contrato-json-rpc.md`.

O React pode desabilitar controles quando não é a vez do usuário para melhorar a experiência, mas a mesma regra é validada novamente no servidor. Isso impede que o cliente escolha o placar ou force a vez.

## Testes existentes

- Backend: `src/test/java/br/com/futbotao/FutBotaoApplicationTests.java`, testes do controlador de jogadores e `service/PartidaServiceTest.java`.
- Frontend: testes de `App`, cliente JSON-RPC, erros, hook, campo, controles e funções geométricas.
- Comandos: `./mvnw test` na raiz do backend; `npm test` e `npm run build` em `frontend/`.

## Limites conhecidos do MVP

- O estado das salas e os cadastros ficam em memória e desaparecem quando o servidor reinicia.
- A sincronização entre clientes usa consultas periódicas, não WebSocket.
- A física é intencionalmente simplificada e as peças não colidem no servidor.
- O proxy de desenvolvimento aponta para `localhost:8080`; uma implantação em outro endereço exige configurar o destino do backend.

## Roteiro de apresentação (8 a 10 minutos)

### 1. Objetivo e requisitos — 45 segundos

**Na tela:** título do projeto e dois clientes conectados ao servidor central.

**Fala sugerida:** “O FutBotão é um jogo 2D de futebol de botão para duas pessoas. O objetivo técnico é manter o estado autoritativo no servidor e permitir que dois clientes façam chamadas remotas para jogar.”

### 2. Arquitetura — 1 minuto

**Na tela:** React/Vite → JSON-RPC 2.0 por HTTP → Spring Boot → `PartidaService` em memória.

**Fala sugerida:** “O React cuida das telas e dos controles. Ele manda intenções de jogada por JSON-RPC. O Spring Boot valida cada pedido, atualiza a partida e devolve o estado. Assim, os dois navegadores consultam a mesma fonte de verdade.”

### 3. Organização do backend — 1 minuto

**Na tela:** mostrar `JsonRpcController` e `PartidaService`.

**Fala sugerida:** “O controller faz a ponte do protocolo: valida a chamada e despacha o método. O `PartidaService` concentra as regras de sala, jogador, turno, movimento e gol. A separação deixa o transporte fora da regra de negócio.”

### 4. Organização do frontend — 1 minuto

**Na tela:** mostrar `App.tsx`, `usePartida.ts`, `api/rpc.ts` e componentes.

**Fala sugerida:** “O `App` escolhe a tela. O hook `usePartida` coordena sessão, polling e ações. O módulo `api/rpc` envia as chamadas. Os componentes desenham a sala, o campo, o placar e o fim de jogo.”

### 5. Criar e entrar na sala — 1 minuto

**Demonstração:** cliente 1 cria a sala; cliente 2 informa o código.

**Fala sugerida:** “Ao criar, o servidor gera um código e um token privado para o jogador. O segundo cliente usa o código para entrar e recebe seu próprio token. Quando chega o segundo jogador, o serviço marca a partida como em andamento e determina quem joga primeiro.”

### 6. Jogada e validação — 1 minuto

**Demonstração:** fazer uma jogada e tentar jogar fora da vez.

**Fala sugerida:** “O cliente envia peça, direção e força. O backend confere token, jogador da vez, peça e limites. Mesmo que a interface esconda ou desabilite um controle, a regra decisiva é verificada de novo no servidor.”

### 7. Movimento e gol — 1 minuto

**Na tela:** mostrar as constantes e a lógica em `PartidaService`; depois demonstrar um chute.

**Fala sugerida:** “O campo é calculado em coordenadas lógicas de 100 por 60. A peça se desloca conforme a força; o servidor verifica se sua trajetória alcança a bola e calcula o impulso. Se a bola cruza a linha dentro da faixa do gol, o placar muda. Aos três gols, a partida termina.”

### 8. Sincronização dos clientes — 1 minuto

**Demonstração:** após o lance de um jogador, mostrar o estado atualizado no outro navegador.

**Fala sugerida:** “A cada segundo, os clientes chamam `partida.obterEstado`. Por isso, a jogada aparece nas duas telas sem o cliente decidir o resultado. As salas estão em memória: é simples para o MVP, mas reiniciar o servidor apaga as partidas.”

### 9. Testes e encerramento — 1 minuto

**Na tela:** mostrar os testes backend/frontend e o contrato JSON-RPC.

**Fala sugerida:** “Os testes cobrem regras do backend, o contrato do cliente e os componentes principais. O contrato documenta métodos, parâmetros, respostas e erros. Como próximos limites conhecidos, há polling em vez de WebSocket e regras físicas simplificadas.”

## Checklist para a demonstração

- Iniciar o backend na porta 8080 e verificar `/status`.
- Iniciar o Vite na porta 5173.
- Abrir dois clientes separados (abas anônimas ou navegadores distintos).
- Criar sala no primeiro cliente e entrar no segundo.
- Demonstrar alternância e rejeição de uma jogada fora da vez.
- Marcar gols até o encerramento ou usar uma partida preparada.
- Mostrar o contrato e os testes sem expor tokens de sessão.
