import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CODIGO_FALHA_REDE, CODIGO_RESPOSTA_INVALIDA } from "./erros";
import { chamar, criarPartida, ErroRpc, fazerJogada } from "./rpc";

function respostaJson(corpo: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  } as Response;
}

function corpoEnviado(indice = 0): Record<string, unknown> {
  const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>;
  const chamada = fetchMock.mock.calls[indice];
  const init = chamada?.[1] as RequestInit;
  return JSON.parse(init.body as string) as Record<string, unknown>;
}

describe("chamar", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("monta o envelope JSON-RPC 2.0 com method, params e id", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaJson({ jsonrpc: "2.0", result: { ok: true }, id: 1 }),
    );

    await chamar("partida.criar", { nomeJogador: "Ana" });

    const fetchMock = vi.mocked(globalThis.fetch);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/rpc");
    expect(init?.method).toBe("POST");
    expect(
      (init?.headers as Record<string, string>)["Content-Type"],
    ).toBe("application/json");

    const corpo = corpoEnviado();
    expect(corpo.jsonrpc).toBe("2.0");
    expect(corpo.method).toBe("partida.criar");
    expect(corpo.params).toEqual({ nomeJogador: "Ana" });
    expect(typeof corpo.id).toBe("number");
  });

  it("usa um id incremental a cada chamada", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaJson({ jsonrpc: "2.0", result: {}, id: 1 }),
    );

    await chamar("partida.criar", { nomeJogador: "Ana" });
    await chamar("partida.criar", { nomeJogador: "Bia" });

    const primeiro = corpoEnviado(0).id as number;
    const segundo = corpoEnviado(1).id as number;
    expect(segundo).toBe(primeiro + 1);
  });

  it("devolve o conteudo de result", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaJson({
        jsonrpc: "2.0",
        result: { codigoPartida: "ABC123", tokenJogador: "t-1" },
        id: 1,
      }),
    );

    const resultado = await criarPartida("Ana");
    expect(resultado.codigoPartida).toBe("ABC123");
    expect(resultado.tokenJogador).toBe("t-1");
  });

  it("converte HTTP 200 com error no corpo em ErroRpc tipado", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaJson({
        jsonrpc: "2.0",
        error: { code: -32005, message: "Não é a vez deste jogador" },
        id: 1,
      }),
    );

    const promessa = fazerJogada("ABC123", "t-1", {
      pecaId: "p-1",
      direcaoX: 1,
      direcaoY: 0,
      forca: 50,
    });

    await expect(promessa).rejects.toBeInstanceOf(ErroRpc);
    await promessa.catch((erro: ErroRpc) => {
      expect(erro.codigo).toBe(-32005);
      expect(erro.mensagem).toBe("Não é a vez deste jogador");
      expect(erro.mensagemAmigavel).toBe("Não é a sua vez de jogar.");
    });
  });

  it("nao usa response.ok para decidir sucesso", async () => {
    // O backend responde 200 inclusive em erro de protocolo.
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaJson({
        jsonrpc: "2.0",
        error: { code: -32600, message: "Requisição inválida" },
        id: 1,
      }),
    );

    await expect(chamar("partida.criar", {})).rejects.toMatchObject({
      codigo: -32600,
    });
  });

  it("trata falha de rede como CODIGO_FALHA_REDE", async () => {
    vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError("fetch failed"));

    await expect(chamar("partida.criar", {})).rejects.toMatchObject({
      codigo: CODIGO_FALHA_REDE,
    });
  });

  it("trata HTTP nao-200 sem corpo JSON como falha de rede", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => {
        throw new SyntaxError("Unexpected token");
      },
    } as unknown as Response);

    await expect(chamar("partida.criar", {})).rejects.toMatchObject({
      codigo: CODIGO_FALHA_REDE,
    });
  });

  it("trata corpo sem result e sem error como resposta invalida", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaJson({ jsonrpc: "2.0", id: 1 }),
    );

    await expect(chamar("partida.criar", {})).rejects.toMatchObject({
      codigo: CODIGO_RESPOSTA_INVALIDA,
    });
  });

  it("aceita result vazio como sucesso", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaJson({ jsonrpc: "2.0", result: {}, id: 1 }),
    );

    await expect(chamar("partida.criar", {})).resolves.toEqual({});
  });

  it("repassa o AbortSignal ao fetch e propaga AbortError", async () => {
    const controlador = new AbortController();
    vi.mocked(globalThis.fetch).mockImplementation((_url, init) => {
      return new Promise((_resolver, rejeitar) => {
        init?.signal?.addEventListener("abort", () =>
          rejeitar(new DOMException("Aborted", "AbortError")),
        );
      });
    });

    const promessa = chamar("partida.obterEstado", {}, controlador.signal);
    controlador.abort();

    await expect(promessa).rejects.toSatisfy(
      (erro: unknown) =>
        erro instanceof DOMException && erro.name === "AbortError",
    );

    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(init?.signal).toBe(controlador.signal);
  });

  it("nao envia signal quando nenhum e informado", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaJson({ jsonrpc: "2.0", result: {}, id: 1 }),
    );

    await chamar("partida.criar", {});
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0]!;
    expect(init?.signal).toBeUndefined();
  });
});

describe("atalhos de metodo", () => {
  beforeEach(() => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValue(respostaJson({ jsonrpc: "2.0", result: {}, id: 1 }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("envia jogada como objeto aninhado, como o controller espera", async () => {
    await fazerJogada("abc123", "t-1", {
      pecaId: "p-1",
      direcaoX: 0.8,
      direcaoY: -0.6,
      forca: 70,
    });

    const corpo = corpoEnviado();
    expect(corpo.method).toBe("partida.fazerJogada");
    expect(corpo.params).toEqual({
      codigoPartida: "abc123",
      tokenJogador: "t-1",
      jogada: { pecaId: "p-1", direcaoX: 0.8, direcaoY: -0.6, forca: 70 },
    });
  });
});
