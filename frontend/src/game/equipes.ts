/**
 * Selecoes disponiveis e o transporte da escolha entre os dois clientes.
 *
 * O backend guarda apenas `nome` por jogador (`JogadorResumo` manda id, nome,
 * pecaId e gols), entao nao existe campo para a selecao. Para o adversario ver
 * a sua escolha, ela viaja no proprio nome como sufixo ` (BRA)`, que o cliente
 * interpreta e remove na exibicao. Se algo falhar na leitura, o nome aparece
 * como "Ana (BRA)" — degrada de forma legivel em vez de quebrar.
 */

export type Equipe = {
  /** Codigo FIFA de tres letras, usado no sufixo do nome. */
  codigo: string;
  nome: string;
  bandeira: string;
  /** Cor do disco. */
  primaria: string;
  /** Cor da faixa sobre o disco. */
  secundaria: string;
  /** Cor do contorno. */
  detalhe: string;
};

const BRASIL: Equipe = {
  codigo: "BRA",
  nome: "Brasil",
  bandeira: "🇧🇷",
  primaria: "#ffdf00",
  secundaria: "#009739",
  detalhe: "#002776",
};

const ARGENTINA: Equipe = {
  codigo: "ARG",
  nome: "Argentina",
  bandeira: "🇦🇷",
  primaria: "#75aadb",
  secundaria: "#ffffff",
  detalhe: "#f6b40e",
};

const ALEMANHA: Equipe = {
  codigo: "GER",
  nome: "Alemanha",
  bandeira: "🇩🇪",
  primaria: "#f2f2f2",
  secundaria: "#1a1a1a",
  detalhe: "#dd0000",
};

const ITALIA: Equipe = {
  codigo: "ITA",
  nome: "Itália",
  bandeira: "🇮🇹",
  primaria: "#0066b2",
  secundaria: "#ffffff",
  detalhe: "#008c45",
};

const FRANCA: Equipe = {
  codigo: "FRA",
  nome: "França",
  bandeira: "🇫🇷",
  primaria: "#002395",
  secundaria: "#ffffff",
  detalhe: "#ed2939",
};

/** As cinco selecoes mais vitoriosas em Copas do Mundo. */
export const EQUIPES: readonly Equipe[] = [
  BRASIL,
  ARGENTINA,
  ALEMANHA,
  ITALIA,
  FRANCA,
];

export const EQUIPE_PADRAO = BRASIL;

/**
 * Usada quando o nome nao traz selecao — por exemplo numa partida criada por
 * um cliente sem esta versao. Mantem as cores por lado do campo.
 */
const NEUTRA_ESQUERDA: Equipe = {
  codigo: "",
  nome: "Sem seleção",
  bandeira: "⚽",
  primaria: "#58a6ff",
  secundaria: "#1f6feb",
  detalhe: "#0d419d",
};

const NEUTRA_DIREITA: Equipe = {
  codigo: "",
  nome: "Sem seleção",
  bandeira: "⚽",
  primaria: "#f0883e",
  secundaria: "#bb6626",
  detalhe: "#7a3e12",
};

export function equipePorCodigo(codigo: string): Equipe | undefined {
  const alvo = codigo.trim().toUpperCase();
  return EQUIPES.find((equipe) => equipe.codigo === alvo);
}

/** Monta o `nomeJogador` enviado ao servidor. */
export function formatarNome(nome: string, equipe: Equipe): string {
  return `${nome.trim()} (${equipe.codigo})`;
}

const SUFIXO = /^(.*?)\s*\(([A-Za-z]{3})\)\s*$/;

/** Separa o nome de exibicao da selecao embutida no nome do servidor. */
export function interpretarNome(bruto: string): {
  nome: string;
  equipe: Equipe | undefined;
} {
  const achado = SUFIXO.exec(bruto.trim());
  if (achado) {
    const [, nome, codigo] = achado;
    const equipe = equipePorCodigo(codigo ?? "");
    // Só trata como selecao se o codigo for de uma selecao conhecida; assim
    // um nome como "Ana (Jr)" continua intacto.
    if (equipe && nome && nome.trim()) {
      return { nome: nome.trim(), equipe };
    }
  }
  return { nome: bruto.trim(), equipe: undefined };
}

/** Nome para exibir, sem o sufixo tecnico. */
export function nomeExibido(bruto: string): string {
  return interpretarNome(bruto).nome;
}

/** Selecao do jogador, caindo na cor do lado do campo quando nao houver. */
export function equipeDoJogador(bruto: string, indice: number): Equipe {
  return (
    interpretarNome(bruto).equipe ??
    (indice === 0 ? NEUTRA_ESQUERDA : NEUTRA_DIREITA)
  );
}
