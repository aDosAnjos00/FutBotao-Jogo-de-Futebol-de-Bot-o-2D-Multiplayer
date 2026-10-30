# FutBotão — front-end

Interface React para o backend Spring Boot do FutBotão. Jogo de futebol de
botão 2D para duas pessoas: cada jogador controla uma peça, e quem fizer três
gols primeiro vence.

O backend expõe um único endpoint JSON-RPC 2.0 (`POST /rpc`) e **não** tem
WebSocket, então a sincronização entre os dois jogadores é feita por polling
HTTP de ~1 segundo.

## Como rodar

### 1. Backend (porta 8080)

No repositório do backend:

```bash
./mvnw spring-boot:run
```

Requer **Java 21**. Confira se subiu:

```bash
curl http://localhost:8080/status
# {"status":"online"}
```

### 2. Front-end (porta 5173)

Neste repositório:

```bash
npm install
npm run dev
```

Abra <http://localhost:5173>.

O backend não configura CORS, então o dev server do Vite faz proxy de `/rpc` e
`/status` para `http://localhost:8080` (veja `vite.config.ts`). Nada precisa ser
alterado no Java.

Para apontar para outro host, defina `VITE_API_BASE_URL` (veja `.env.example`):

```bash
VITE_API_BASE_URL=https://api.exemplo.com npm run build
```

## Jogando com duas pessoas

1. Abra o front em **duas abas** (ou dois navegadores/dispositivos).
2. Na primeira, digite um nome, escolha sua **seleção** (Brasil, Argentina,
   Alemanha, Itália ou França) e clique em **Criar partida**. Um código de 6
   caracteres aparece na tela de espera.
3. Na segunda, digite outro nome, escolha a seleção, cole o código e clique em
   **Entrar na partida**. Maiúsculas e minúsculas não importam.
4. A primeira aba sai da espera sozinha e o jogo começa. Quem criou a partida
   joga primeiro, pelo lado esquerdo.

Para chutar, **arraste a sua peça** na direção desejada: o sentido do arraste
define a direção e o comprimento define a força. Durante o arraste aparece a
trajetória prevista da bola, com aviso de **gol** ou **gol contra**. Também há
controles de direção e um slider de força, utilizáveis por teclado, com a mesma
previsão em texto.

Cada gol dispara um aviso em tela cheia dizendo quem marcou e o placar.

> ⚠️ O servidor guarda as partidas apenas na **memória do processo**. Reiniciar
> o backend apaga todas elas: a aba que estava jogando recebe
> "partida não encontrada" e volta para a tela inicial. Também não existe
> revanche — "Jogar novamente" cria uma partida nova.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Dev server com proxy para o backend |
| `npm run build` | Typecheck (`tsc --noEmit`) e build de produção em `dist/` |
| `npm run preview` | Serve o `dist/` gerado |
| `npm test` | Testes com Vitest |
| `npm run test:watch` | Testes em modo watch |

## Estrutura

```
src/
  api/
    rpc.ts          cliente JSON-RPC (envelope, id incremental, ErroRpc)
    types.ts        tipos espelhados dos records do PartidaService
    erros.ts        código de erro -> mensagem em português
  hooks/
    usePartida.ts   sessão, polling, jogada e máquina de fases
  game/
    geometria.ts    vetor, força, previsão da bola, conversão tela -> campo
    equipes.ts      seleções, cores e transporte da escolha pelo nome
  components/
    TelaInicial.tsx SalaEspera.tsx     Campo.tsx
    Placar.tsx      ControleJogada.tsx TelaFim.tsx
    EscolhaEquipe.tsx  AvisoGol.tsx
  App.tsx
  styles.css
```

## Detalhes da integração que valem atenção

Pontos do contrato que não são óbvios e estão tratados no código:

- **O servidor responde HTTP 200 mesmo em erro.** O sucesso é decidido pela
  ausência da chave `error` no corpo, nunca por `response.ok` (`api/rpc.ts`).
- **O jogador local é deduzido por índice.** `partida.criar` e `partida.entrar`
  devolvem só o `tokenJogador`, e o token nunca aparece no estado. Quem criou é
  `estado.jogadores[0]` (lado esquerdo); quem entrou é `estado.jogadores[1]`
  (lado direito). O `jogadorId` e o `pecaId` deduzidos são guardados em
  `sessionStorage`, junto com o token, e restaurados ao recarregar a página.
- **As coordenadas são lógicas, não pixels.** O campo tem 100 × 60 unidades e é
  desenhado em um `<svg viewBox="0 0 100 60">`, então as posições do servidor
  são usadas diretamente. A conversão de ponteiro para coordenada de campo
  compensa a letra-caixa do `preserveAspectRatio`.
- **A seleção escolhida viaja dentro do `nome`.** O servidor guarda só
  `nome` por jogador (`JogadorResumo` manda `id`, `nome`, `pecaId`, `gols`), e
  não há campo para seleção. Para o adversário ver a sua escolha, o cliente
  envia `"Ana (BRA)"` e remove o sufixo na exibição (`game/equipes.ts`).
  Consequência: **no servidor o nome realmente contém o código** — se você
  inspecionar `/rpc` verá `"Ana (BRA)"`, não `"Ana"`. Se o sufixo não for
  reconhecido (nome sem código, ou cliente de outra versão), a peça cai nas
  cores por lado do campo e o nome aparece como veio — degrada sem quebrar.
- **Não existe defesa de chute, e isso é do servidor.** Em `aplicarJogada` a
  bola vai da posição atual direto ao destino em **um único passo**, e o gol é
  decidido só pelo ponto final: a peça adversária nunca entra nessa conta.
  Reproduzido com a defensora em `(97, 29.80)` — dentro da própria boca do gol,
  a 0,20 unidades da trajetória — e o gol saiu igual. Como quem decide gol e
  placar é o servidor, **o cliente não tem como defender nada**. O que o front
  faz é **prever** a trajetória da bola (`preverBola`), replicando a fórmula do
  servidor, para você afastar a bola do seu gol de propósito e ser avisado
  antes de fazer gol contra. A previsão foi validada em teste diferencial
  contra o backend real: 3600 lances, 1841 toques, 25 gols, zero divergências.
- **Não existe colisão entre peças, e isso é do servidor.** O
  `PartidaService` move só a peça de quem jogou: as duas podem terminar na
  mesma coordenada e atravessar uma à outra (reproduzido em `55,30`). O front
  apenas **separa os discos no desenho** (`separarPecas`), para não aparecerem
  no mesmo lugar. **Isto não é física:** a peça adversária não é empurrada de
  verdade, continua podendo ser atravessada, e no servidor as duas seguem na
  mesma posição. Empurrar a peça adversária exigiria alterar
  `PartidaService.aplicarJogada` — mudança de backend, fora do escopo deste
  repositório. Consequência: quando as peças estão sobrepostas, o disco é
  desenhado até 2,4 unidades deslocado da posição real, e a mira sai desse
  ponto deslocado.
- **O servidor limita o *centro* da peça, não a forma inteira.** O clamp do
  `PartidaService` é para `0..100` × `0..60`, sem noção de raio: um disco de
  raio 2,4 com centro em `x = 100` apareceria metade fora do gramado. Por isso
  o desenho recua o centro em `RECUO_PECA` / `RECUO_BOLA`
  (`game/geometria.ts`, função `posicaoVisivel`). É ajuste só de apresentação —
  a coordenada lógica do servidor, usada para contato, gol e placar, e também
  a descrição acessível do campo, continuam sendo a original.

O polling pausa quando a aba fica oculta, para quando a partida encerra, e
descarta respostas atrasadas para que uma volta lenta não sobrescreva o
resultado de uma jogada recém-enviada. A validação de jogada do cliente
(direção ≠ (0,0), força entre 1 e 100) espelha o servidor para dar retorno
imediato, mas a resposta do servidor é sempre a fonte final da verdade.
