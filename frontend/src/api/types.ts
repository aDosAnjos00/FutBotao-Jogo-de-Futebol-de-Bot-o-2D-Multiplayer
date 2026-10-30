/**
 * Tipos espelhados dos `record` de `PartidaService.java`. Os nomes dos campos
 * precisam bater exatamente com o JSON produzido pelo backend.
 */

export type Posicao = { x: number; y: number };

export type JogadorResumo = {
  id: string;
  nome: string;
  /** UUID da peca do jogador; diferente de `id`. */
  pecaId: string;
  gols: number;
};

export type PecaResumo = {
  /** Igual ao `pecaId` do jogador dono. */
  id: string;
  jogadorId: string;
  posicao: Posicao;
};

export type Campo = {
  largura: number;
  altura: number;
  golInicioY: number;
  golFimY: number;
  bola: Posicao;
  pecas: PecaResumo[];
};

export type Situacao = "AGUARDANDO_JOGADOR" | "EM_ANDAMENTO" | "ENCERRADA";

export type EstadoPartida = {
  codigoPartida: string;
  situacao: Situacao;
  /** Indice 0 e sempre o criador (lado esquerdo), indice 1 quem entrou. */
  jogadores: JogadorResumo[];
  jogadorDaVezId: string | null;
  vencedorId: string | null;
  campo: Campo;
};

/** `result` de `partida.criar` e `partida.entrar`. */
export type EntradaPartida = {
  codigoPartida: string;
  tokenJogador: string;
  estado: EstadoPartida;
};

export type Jogada = {
  pecaId: string;
  direcaoX: number;
  direcaoY: number;
  forca: number;
};

/**
 * Dados que o cliente guarda em `sessionStorage`. O backend nao devolve o
 * `jogadorId` em `criar`/`entrar`, por isso ele e deduzido pelo indice e
 * persistido junto com o token.
 */
export type Sessao = {
  codigoPartida: string;
  tokenJogador: string;
  meuIndice: 0 | 1;
  meuJogadorId: string;
  meuPecaId: string;
};

export function ehSituacaoAtiva(situacao: Situacao): boolean {
  return situacao === "AGUARDANDO_JOGADOR" || situacao === "EM_ANDAMENTO";
}

export function jogadorPorId(
  estado: EstadoPartida,
  id: string | null,
): JogadorResumo | undefined {
  if (id === null) return undefined;
  return estado.jogadores.find((jogador) => jogador.id === id);
}

/** Cruza peca e jogador por `jogadorId`, sem confiar na ordem do array. */
export function pecaDoJogador(
  estado: EstadoPartida,
  jogadorId: string,
): PecaResumo | undefined {
  return estado.campo.pecas.find((peca) => peca.jogadorId === jogadorId);
}
