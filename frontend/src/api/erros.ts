/**
 * Codigos de erro do backend (tabela da especificacao) e codigos locais do
 * cliente, usados para que falhas de rede percorram o mesmo caminho de
 * tratamento dos erros de regra.
 */

/** Falha de transporte: servidor fora do ar, DNS, offline. */
export const CODIGO_FALHA_REDE = -33000;
/** HTTP inesperado ou corpo que nao e uma resposta JSON-RPC valida. */
export const CODIGO_RESPOSTA_INVALIDA = -33001;

export const MENSAGENS: Record<number, string> = {
  [-32700]: "Não foi possível interpretar a resposta do servidor.",
  [-32600]: "Requisição inválida enviada ao servidor.",
  [-32601]: "Operação não reconhecida pelo servidor.",
  [-32602]: "Dados inválidos. Confira os campos preenchidos.",
  [-32603]: "O servidor encontrou um erro interno. Tente novamente.",
  [-32001]: "Esta partida não existe mais. O servidor pode ter sido reiniciado.",
  [-32002]: "Esta partida já está cheia.",
  [-32003]: "Você não faz parte desta partida.",
  [-32004]: "A partida ainda não começou.",
  [-32005]: "Não é a sua vez de jogar.",
  [-32006]: "Jogada inválida. Ajuste a direção e a força.",
  [-32007]: "Esta partida já foi encerrada.",
  [CODIGO_FALHA_REDE]:
    "Não foi possível falar com o servidor. Verifique se o backend está rodando na porta 8080.",
  [CODIGO_RESPOSTA_INVALIDA]: "O servidor devolveu uma resposta inesperada.",
};

const MENSAGEM_GENERICA = "Algo deu errado. Tente novamente.";

export function mensagemDoErro(codigo: number): string {
  return MENSAGENS[codigo] ?? MENSAGEM_GENERICA;
}

/** Erros que invalidam a sessao salva: nao ha o que fazer a nao ser recomecar. */
export function ehErroDeSessao(codigo: number): boolean {
  return codigo === -32001 || codigo === -32003;
}

/** Erros transitorios de transporte: vale a pena seguir tentando. */
export function ehErroDeConexao(codigo: number): boolean {
  return codigo === CODIGO_FALHA_REDE;
}
