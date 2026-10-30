import {
  CODIGO_FALHA_REDE,
  CODIGO_RESPOSTA_INVALIDA,
  mensagemDoErro,
} from "./erros";
import type { EntradaPartida, EstadoPartida, Jogada } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

/** Erro de regra ou de protocolo, sempre com um codigo JSON-RPC associado. */
export class ErroRpc extends Error {
  readonly codigo: number;
  readonly mensagem: string;

  constructor(codigo: number, mensagem?: string) {
    const texto = mensagem ?? mensagemDoErro(codigo);
    super(texto);
    this.name = "ErroRpc";
    this.codigo = codigo;
    this.mensagem = texto;
  }

  /** Texto pronto para a interface, independente do que o servidor mandou. */
  get mensagemAmigavel(): string {
    return mensagemDoErro(this.codigo);
  }
}

export function ehAbortado(erro: unknown): boolean {
  return erro instanceof DOMException && erro.name === "AbortError";
}

type RespostaRpc = {
  jsonrpc?: unknown;
  result?: unknown;
  error?: { code?: unknown; message?: unknown };
  id?: unknown;
};

let proximoId = 1;

/**
 * Faz uma chamada JSON-RPC 2.0.
 *
 * O backend responde HTTP 200 inclusive em erro, portanto o sucesso e decidido
 * pela presenca da chave `error` no corpo, nunca por `response.ok`.
 *
 * @throws {ErroRpc} em erro de regra, de protocolo ou de transporte.
 * @throws {DOMException} `AbortError` quando o `signal` e cancelado.
 */
export async function chamar<TResult>(
  method: string,
  params: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<TResult> {
  const corpoEnviado = {
    jsonrpc: "2.0",
    method,
    params,
    id: proximoId++,
  };

  let resposta: Response;
  try {
    const init: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(corpoEnviado),
    };
    if (signal) init.signal = signal;
    resposta = await fetch(`${BASE_URL}/rpc`, init);
  } catch (erro) {
    if (ehAbortado(erro)) throw erro;
    throw new ErroRpc(CODIGO_FALHA_REDE);
  }

  let corpo: RespostaRpc;
  try {
    corpo = (await resposta.json()) as RespostaRpc;
  } catch (erro) {
    if (ehAbortado(erro)) throw erro;
    // HTTP fora do esperado e sem corpo JSON: provavelmente proxy ou gateway.
    throw new ErroRpc(
      resposta.ok ? CODIGO_RESPOSTA_INVALIDA : CODIGO_FALHA_REDE,
    );
  }

  if (corpo && typeof corpo === "object" && corpo.error) {
    const codigo =
      typeof corpo.error.code === "number"
        ? corpo.error.code
        : CODIGO_RESPOSTA_INVALIDA;
    const mensagem =
      typeof corpo.error.message === "string" ? corpo.error.message : undefined;
    throw new ErroRpc(codigo, mensagem);
  }

  if (!corpo || typeof corpo !== "object" || !("result" in corpo)) {
    throw new ErroRpc(CODIGO_RESPOSTA_INVALIDA);
  }

  return corpo.result as TResult;
}

export function criarPartida(
  nomeJogador: string,
  signal?: AbortSignal,
): Promise<EntradaPartida> {
  return chamar<EntradaPartida>("partida.criar", { nomeJogador }, signal);
}

export function entrarNaPartida(
  codigoPartida: string,
  nomeJogador: string,
  signal?: AbortSignal,
): Promise<EntradaPartida> {
  return chamar<EntradaPartida>(
    "partida.entrar",
    { codigoPartida, nomeJogador },
    signal,
  );
}

export function obterEstado(
  codigoPartida: string,
  tokenJogador: string,
  signal?: AbortSignal,
): Promise<EstadoPartida> {
  return chamar<EstadoPartida>(
    "partida.obterEstado",
    { codigoPartida, tokenJogador },
    signal,
  );
}

export function fazerJogada(
  codigoPartida: string,
  tokenJogador: string,
  jogada: Jogada,
  signal?: AbortSignal,
): Promise<EstadoPartida> {
  return chamar<EstadoPartida>(
    "partida.fazerJogada",
    { codigoPartida, tokenJogador, jogada },
    signal,
  );
}

/** Health check do backend, usado para distinguir "offline" de outros erros. */
export async function verificarStatus(signal?: AbortSignal): Promise<boolean> {
  try {
    const init: RequestInit = { method: "GET" };
    if (signal) init.signal = signal;
    const resposta = await fetch(`${BASE_URL}/status`, init);
    if (!resposta.ok) return false;
    const corpo = (await resposta.json()) as { status?: unknown };
    return corpo?.status === "online";
  } catch (erro) {
    if (ehAbortado(erro)) throw erro;
    return false;
  }
}
