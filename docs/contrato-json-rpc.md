# Contrato JSON-RPC 2.0 do MVP

## Objetivo

Este contrato define como a interface React solicita operações de partida ao servidor Spring Boot. As chamadas de jogo usam JSON-RPC 2.0. O estado das partidas fica somente na memória do servidor; encerrar ou reiniciar o processo apaga as partidas.

## Transporte

- Endpoint: `POST /rpc`
- Content-Type: `application/json`
- Todas as chamadas do MVP incluem `jsonrpc: "2.0"`, `method`, `params` e `id`.
- O servidor devolve o mesmo `id` recebido.
- Para acompanhar mudanças feitas pelo outro cliente, a interface consulta `partida.obterEstado` periodicamente. O MVP não usa WebSocket.

Exemplo de chamada:

```json
{
  "jsonrpc": "2.0",
  "method": "partida.criar",
  "params": {
    "nomeJogador": "Ana"
  },
  "id": 1
}
```

Resposta bem-sucedida segue o formato JSON-RPC:

```json
{
  "jsonrpc": "2.0",
  "result": {
    "codigoPartida": "ABC123",
    "tokenJogador": "token-gerado-pelo-servidor",
    "estado": {}
  },
  "id": 1
}
```

A resposta contém `result` ou `error`, nunca ambos. Os exemplos de código da partida são ilustrativos.

## Operações

### `partida.criar`

Cria uma sala e registra o primeiro jogador.

Parâmetros:

- `nomeJogador`: string não vazia.

Resultado:

- `codigoPartida`: código para o segundo jogador entrar.
- `tokenJogador`: token atribuído pelo servidor ao criador.
- `estado`: estado atual, com a partida aguardando o segundo jogador.

### `partida.entrar`

Adiciona o segundo jogador a uma sala existente. Uma sala cheia não aceita outros jogadores.

Parâmetros:

- `codigoPartida`: string.
- `nomeJogador`: string não vazia.

Resultado:

- `tokenJogador`: token atribuído pelo servidor.
- `estado`: estado atualizado. Quando há dois jogadores, a partida pode começar.

### `partida.obterEstado`

Retorna o estado atual ao jogador participante.

Parâmetros:

- `codigoPartida`: string.
- `tokenJogador`: token recebido ao criar ou entrar.

Resultado: estado da partida.

### `partida.fazerJogada`

Solicita uma jogada. O cliente envia a intenção; o servidor verifica o jogador da vez, valida os valores, atualiza a partida e devolve o novo estado.

Parâmetros:

- `codigoPartida`: string.
- `tokenJogador`: token do jogador que está jogando.
- `jogada`: objeto com `pecaId` (string), `direcaoX` e `direcaoY` (números entre -1 e 1; não podem ser ambos zero) e `forca` (número entre 1 e 100).

## Regras simplificadas do campo

- Campo lógico de 100 por 60 unidades; não representa pixels da interface.
- Uma peça controlável por jogador, posicionada em lados opostos.
- O jogador move sua peça na direção enviada. Se o trajeto passar a até 2,5 unidades da bola, o servidor considera o contato e desloca a bola na mesma direção.
- A força determina a distância da peça, até o máximo de 20 unidades; a bola pode percorrer até 1,5 vez o trecho restante após o contato.
- Gols ficam nas extremidades do campo e ocupam o intervalo vertical entre 25 e 35.
- Bola fora da área do gol para na borda do campo. Não há física de atrito nem colisões entre peças.
- Após um gol, o placar atualiza e as posições reiniciam. O turno alterna. A partida termina quando alguém chega a três gols.

## Estado retornado

O estado deve informar, no mínimo:

- código da partida e situação: aguardando jogador, em andamento ou encerrada;
- jogadores participantes, IDs de peça e seus gols;
- identificador do jogador da vez;
- dimensões lógicas do campo, posição da bola e posição das peças;
- vencedor quando a partida terminar.

O servidor é a fonte do estado. Uma jogada aceita alterna o turno. A interface não envia o placar nem determina se houve gol.

## Concorrência

As alterações de uma mesma partida devem ser processadas de forma serializada no servidor. Se os dois clientes enviarem jogadas ao mesmo tempo, o servidor aceita somente a jogada válida para o turno corrente; a outra recebe erro de turno.

## Erros

Erros de protocolo usam os códigos JSON-RPC 2.0:

- `-32700`: erro ao interpretar JSON;
- `-32600`: requisição inválida;
- `-32601`: método desconhecido;
- `-32602`: parâmetros inválidos;
- `-32603`: erro interno.

Erros de regra usam códigos da faixa reservada para erros do servidor:

- `-32001`: partida não encontrada;
- `-32002`: partida cheia;
- `-32003`: jogador não pertence à partida;
- `-32004`: partida ainda não começou;
- `-32005`: não é a vez do jogador;
- `-32006`: jogada inválida;
- `-32007`: partida encerrada.

A resposta de erro contém `error.code`, `error.message` e o mesmo `id` da chamada. Detalhes opcionais podem ser enviados em `error.data`. Exceções internas não devem expor stack traces ao cliente.

## Limites deste MVP

- Duas pessoas por partida.
- Uma jogada por turno, com alternância.
- Vitória ao chegar a três gols.
- Estado mantido em memória; sem PostgreSQL.
- Movimentação simplificada; sem física realista ou colisões complexas.
