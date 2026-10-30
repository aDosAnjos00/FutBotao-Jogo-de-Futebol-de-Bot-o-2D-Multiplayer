import type { EntradaPartida, EstadoPartida, Situacao } from "../api/types";

export const ID_CRIADOR = "jog-0";
export const PECA_CRIADOR = "peca-0";
export const TOKEN_CRIADOR = "token-0";
export const ID_VISITANTE = "jog-1";
export const PECA_VISITANTE = "peca-1";
export const TOKEN_VISITANTE = "token-1";
export const CODIGO = "ABC123";

type Opcoes = {
  situacao?: Situacao;
  comDoisJogadores?: boolean;
  jogadorDaVezId?: string | null;
  vencedorId?: string | null;
  golsCriador?: number;
  golsVisitante?: number;
  bola?: { x: number; y: number };
  posicaoCriador?: { x: number; y: number };
  posicaoVisitante?: { x: number; y: number };
  /** Nome bruto, como o servidor guarda (pode trazer o sufixo da selecao). */
  nomeCriador?: string;
  nomeVisitante?: string;
};

/** Estado no mesmo formato que `PartidaService.criarEstado` produz. */
export function estadoFalso(opcoes: Opcoes = {}): EstadoPartida {
  const {
    situacao = "EM_ANDAMENTO",
    comDoisJogadores = situacao !== "AGUARDANDO_JOGADOR",
    jogadorDaVezId = situacao === "EM_ANDAMENTO" ? ID_CRIADOR : null,
    vencedorId = null,
    golsCriador = 0,
    golsVisitante = 0,
    bola = { x: 50, y: 30 },
    posicaoCriador = { x: 25, y: 30 },
    posicaoVisitante = { x: 75, y: 30 },
    nomeCriador = "Ana",
    nomeVisitante = "Bia",
  } = opcoes;

  const criador = {
    id: ID_CRIADOR,
    nome: nomeCriador,
    pecaId: PECA_CRIADOR,
    gols: golsCriador,
  };
  const visitante = {
    id: ID_VISITANTE,
    nome: nomeVisitante,
    pecaId: PECA_VISITANTE,
    gols: golsVisitante,
  };

  const jogadores = comDoisJogadores ? [criador, visitante] : [criador];
  const pecas = comDoisJogadores
    ? [
        { id: PECA_CRIADOR, jogadorId: ID_CRIADOR, posicao: posicaoCriador },
        {
          id: PECA_VISITANTE,
          jogadorId: ID_VISITANTE,
          posicao: posicaoVisitante,
        },
      ]
    : [{ id: PECA_CRIADOR, jogadorId: ID_CRIADOR, posicao: posicaoCriador }];

  return {
    codigoPartida: CODIGO,
    situacao,
    jogadores,
    jogadorDaVezId,
    vencedorId,
    campo: {
      largura: 100,
      altura: 60,
      golInicioY: 25,
      golFimY: 35,
      bola,
      pecas,
    },
  };
}

export function entradaFalsa(
  indice: 0 | 1,
  estado = estadoFalso(
    indice === 0 ? { situacao: "AGUARDANDO_JOGADOR" } : { situacao: "EM_ANDAMENTO" },
  ),
): EntradaPartida {
  return {
    codigoPartida: CODIGO,
    tokenJogador: indice === 0 ? TOKEN_CRIADOR : TOKEN_VISITANTE,
    estado,
  };
}

export function respostaSucesso(resultado: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({ jsonrpc: "2.0", result: resultado, id: 1 }),
  } as Response;
}

export function respostaErro(codigo: number, mensagem = "erro"): Response {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      jsonrpc: "2.0",
      error: { code: codigo, message: mensagem },
      id: 1,
    }),
  } as Response;
}

/** Nome do metodo JSON-RPC de uma chamada registrada no mock de fetch. */
export function metodoDaChamada(chamada: unknown[]): string {
  const init = chamada[1] as RequestInit;
  const corpo = JSON.parse(init.body as string) as { method: string };
  return corpo.method;
}

export function paramsDaChamada<T>(chamada: unknown[]): T {
  const init = chamada[1] as RequestInit;
  const corpo = JSON.parse(init.body as string) as { params: T };
  return corpo.params;
}
