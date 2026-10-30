import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CODIGO,
  entradaFalsa,
  estadoFalso,
  ID_CRIADOR,
  metodoDaChamada,
  paramsDaChamada,
  ID_VISITANTE,
  PECA_CRIADOR,
  PECA_VISITANTE,
  respostaErro,
  respostaSucesso,
  TOKEN_CRIADOR,
} from "../teste/fixtures";
import { usePartida } from "./usePartida";

const CHAVE_SESSAO = "futbotao.sessao";
const JOGADA_VALIDA = {
  pecaId: PECA_CRIADOR,
  direcaoX: 1,
  direcaoY: 0,
  forca: 60,
};

/** Polling curto para os testes nao dependerem do intervalo real de 1s. */
function montar() {
  return renderHook(() => usePartida({ intervaloPolling: 20 }));
}

function chamadasDeFetch() {
  return vi.mocked(globalThis.fetch).mock.calls;
}

function metodosChamados() {
  return chamadasDeFetch().map(metodoDaChamada);
}

beforeEach(() => {
  sessionStorage.clear();
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fluxo de criacao", () => {
  it("cria a partida, deduz o jogador local pelo indice 0 e salva a sessao", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaSucesso(entradaFalsa(0)))
      .mockResolvedValue(
        respostaSucesso(estadoFalso({ situacao: "AGUARDANDO_JOGADOR" })),
      );

    const { result } = montar();
    expect(result.current.fase).toBe("inicial");

    await act(async () => {
      await result.current.criar("Ana");
    });

    expect(result.current.fase).toBe("aguardando");
    expect(result.current.sessao).toEqual({
      codigoPartida: CODIGO,
      tokenJogador: TOKEN_CRIADOR,
      meuIndice: 0,
      meuJogadorId: ID_CRIADOR,
      meuPecaId: PECA_CRIADOR,
    });
    expect(result.current.meuJogador?.nome).toBe("Ana");
    expect(JSON.parse(sessionStorage.getItem(CHAVE_SESSAO)!)).toMatchObject({
      meuIndice: 0,
      meuJogadorId: ID_CRIADOR,
    });
  });

  it("deduz o jogador local pelo indice 1 ao entrar e normaliza o codigo", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaSucesso(entradaFalsa(1)))
      .mockResolvedValue(respostaSucesso(estadoFalso()));

    const { result } = montar();
    await act(async () => {
      await result.current.entrar("abc123", "Bia");
    });

    expect(result.current.sessao?.meuIndice).toBe(1);
    expect(result.current.sessao?.meuPecaId).toBe(PECA_VISITANTE);
    expect(result.current.meuJogador?.nome).toBe("Bia");

    const params = paramsDaChamada<{ codigoPartida: string }>(
      chamadasDeFetch()[0]!,
    );
    expect(params.codigoPartida).toBe("ABC123");
  });

  it("nao chama o servidor com nome vazio", async () => {
    const { result } = montar();
    await act(async () => {
      await result.current.criar("   ");
    });

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(result.current.erro).toBe("Informe o seu nome.");
    expect(result.current.fase).toBe("inicial");
  });

  it("mostra a mensagem do contrato quando a partida esta cheia", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respostaErro(-32002));

    const { result } = montar();
    await act(async () => {
      await result.current.entrar("ABC123", "Bia");
    });

    expect(result.current.erro).toBe("Esta partida já está cheia.");
    expect(result.current.sessao).toBeNull();
  });
});

describe("polling", () => {
  it("passa de aguardando para em andamento quando o segundo jogador entra", async () => {
    // O polling so devolve EM_ANDAMENTO depois que a flag e ligada, para que a
    // transicao seja observada em vez de depender do tempo da primeira volta.
    let segundoEntrou = false;
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      const { method } = JSON.parse((init?.body as string) ?? "{}") as {
        method: string;
      };
      if (method === "partida.criar") return respostaSucesso(entradaFalsa(0));
      return respostaSucesso(
        segundoEntrou
          ? estadoFalso()
          : estadoFalso({ situacao: "AGUARDANDO_JOGADOR" }),
      );
    });

    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });
    expect(result.current.fase).toBe("aguardando");
    expect(result.current.minhaVez).toBe(false);

    segundoEntrou = true;
    await waitFor(() => expect(result.current.fase).toBe("jogando"));
    expect(result.current.minhaVez).toBe(true);
    expect(result.current.adversario?.nome).toBe("Bia");
    expect(metodosChamados()).toContain("partida.obterEstado");
  });

  it("para o polling quando a partida encerra", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaSucesso(entradaFalsa(0)))
      .mockResolvedValue(
        respostaSucesso(
          estadoFalso({
            situacao: "ENCERRADA",
            jogadorDaVezId: null,
            vencedorId: ID_CRIADOR,
            golsCriador: 3,
          }),
        ),
      );

    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });
    await waitFor(() => expect(result.current.fase).toBe("fim"));

    expect(result.current.euVenci).toBe(true);
    expect(result.current.vencedor?.nome).toBe("Ana");

    const total = chamadasDeFetch().length;
    await new Promise((resolver) => setTimeout(resolver, 80));
    expect(chamadasDeFetch().length).toBe(total);
  });

  it("limpa a sessao e volta ao inicio em -32001", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaSucesso(entradaFalsa(0)))
      .mockResolvedValue(respostaErro(-32001, "Partida não encontrada"));

    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });

    await waitFor(() => expect(result.current.fase).toBe("inicial"));
    expect(result.current.sessao).toBeNull();
    expect(result.current.erro).toContain("não existe mais");
    expect(sessionStorage.getItem(CHAVE_SESSAO)).toBeNull();
  });

  it("limpa a sessao em -32003", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaSucesso(entradaFalsa(0)))
      .mockResolvedValue(respostaErro(-32003));

    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });

    await waitFor(() => expect(result.current.sessao).toBeNull());
    expect(sessionStorage.getItem(CHAVE_SESSAO)).toBeNull();
  });

  it("sinaliza reconexao sem derrubar a partida em falha de rede", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaSucesso(entradaFalsa(0)))
      .mockRejectedValue(new TypeError("fetch failed"));

    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });

    await waitFor(() => expect(result.current.reconectando).toBe(true));
    expect(result.current.sessao).not.toBeNull();
    expect(result.current.fase).toBe("aguardando");
  });

  it("restaura a sessao salva e busca o estado ao montar", async () => {
    sessionStorage.setItem(
      CHAVE_SESSAO,
      JSON.stringify({
        codigoPartida: CODIGO,
        tokenJogador: TOKEN_CRIADOR,
        meuIndice: 0,
        meuJogadorId: ID_CRIADOR,
        meuPecaId: PECA_CRIADOR,
      }),
    );
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaSucesso(estadoFalso()),
    );

    const { result } = montar();
    expect(result.current.fase).toBe("restaurando");

    await waitFor(() => expect(result.current.fase).toBe("jogando"));
    expect(metodosChamados()[0]).toBe("partida.obterEstado");
  });

  it("ignora sessao salva corrompida", () => {
    sessionStorage.setItem(CHAVE_SESSAO, "{nao e json");
    const { result } = montar();
    expect(result.current.fase).toBe("inicial");
    expect(result.current.sessao).toBeNull();
  });
});

describe("jogada", () => {
  async function partidaEmAndamento(jogadorDaVezId: string | null = ID_CRIADOR) {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaSucesso(entradaFalsa(0)))
      .mockResolvedValue(respostaSucesso(estadoFalso({ jogadorDaVezId })));

    const retorno = montar();
    await act(async () => {
      await retorno.result.current.criar("Ana");
    });
    await waitFor(() => expect(retorno.result.current.fase).toBe("jogando"));
    return retorno;
  }

  it("envia a jogada e aplica o estado devolvido pelo servidor", async () => {
    const { result } = await partidaEmAndamento();

    const estadoPosGol = estadoFalso({
      golsCriador: 1,
      jogadorDaVezId: "jog-1",
    });
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaSucesso(estadoPosGol),
    );

    await act(async () => {
      await result.current.jogar(JOGADA_VALIDA);
    });

    expect(metodosChamados()).toContain("partida.fazerJogada");
    expect(result.current.estado?.jogadores[0]?.gols).toBe(1);
    expect(result.current.minhaVez).toBe(false);
  });

  it("bloqueia a jogada quando nao e a vez do jogador local", async () => {
    const { result } = await partidaEmAndamento("jog-1");
    const antes = chamadasDeFetch().length;

    await act(async () => {
      await result.current.jogar(JOGADA_VALIDA);
    });

    expect(result.current.erro).toBe("Não é a sua vez de jogar.");
    expect(
      chamadasDeFetch()
        .slice(antes)
        .map(metodoDaChamada),
    ).not.toContain("partida.fazerJogada");
  });

  it("bloqueia a jogada com a peca do adversario", async () => {
    const { result } = await partidaEmAndamento();
    const antes = chamadasDeFetch().length;

    await act(async () => {
      await result.current.jogar({ ...JOGADA_VALIDA, pecaId: PECA_VISITANTE });
    });

    expect(result.current.erro).toContain("Jogada inválida");
    expect(
      chamadasDeFetch()
        .slice(antes)
        .map(metodoDaChamada),
    ).not.toContain("partida.fazerJogada");
  });

  it("bloqueia direcao (0,0) antes de chamar o servidor", async () => {
    const { result } = await partidaEmAndamento();
    const antes = chamadasDeFetch().length;

    await act(async () => {
      await result.current.jogar({
        ...JOGADA_VALIDA,
        direcaoX: 0,
        direcaoY: 0,
      });
    });

    expect(result.current.erro).toContain("Jogada inválida");
    expect(
      chamadasDeFetch()
        .slice(antes)
        .map(metodoDaChamada),
    ).not.toContain("partida.fazerJogada");
  });

  it("bloqueia forca fora de 1 a 100 antes de chamar o servidor", async () => {
    const { result } = await partidaEmAndamento();
    const antes = chamadasDeFetch().length;

    await act(async () => {
      await result.current.jogar({ ...JOGADA_VALIDA, forca: 140 });
    });

    expect(
      chamadasDeFetch()
        .slice(antes)
        .map(metodoDaChamada),
    ).not.toContain("partida.fazerJogada");
  });

  it("envia a jogada como objeto aninhado junto com codigo e token", async () => {
    const { result } = await partidaEmAndamento();
    vi.mocked(globalThis.fetch).mockResolvedValue(
      respostaSucesso(estadoFalso({ jogadorDaVezId: "jog-1" })),
    );

    await act(async () => {
      await result.current.jogar(JOGADA_VALIDA);
    });

    const chamada = chamadasDeFetch().find(
      (item) => metodoDaChamada(item) === "partida.fazerJogada",
    )!;
    expect(paramsDaChamada(chamada)).toEqual({
      codigoPartida: CODIGO,
      tokenJogador: TOKEN_CRIADOR,
      jogada: JOGADA_VALIDA,
    });
  });

  it("resincroniza quando o servidor responde -32005", async () => {
    const { result } = await partidaEmAndamento();

    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaErro(-32005))
      .mockResolvedValue(
        respostaSucesso(estadoFalso({ jogadorDaVezId: "jog-1" })),
      );

    await act(async () => {
      await result.current.jogar(JOGADA_VALIDA);
    });

    expect(result.current.erro).toBe("Não é a sua vez de jogar.");
    await waitFor(() => expect(result.current.minhaVez).toBe(false));
  });

  it("podeJogar fica falso enquanto a jogada esta em voo", async () => {
    const { result } = await partidaEmAndamento();
    expect(result.current.podeJogar).toBe(true);

    let liberar: (resposta: Response) => void = () => {};
    vi.mocked(globalThis.fetch).mockImplementation(
      () => new Promise<Response>((resolver) => (liberar = resolver)),
    );

    let emVoo: Promise<void> = Promise.resolve();
    await act(async () => {
      emVoo = result.current.jogar(JOGADA_VALIDA);
    });

    expect(result.current.enviando).toBe(true);
    expect(result.current.podeJogar).toBe(false);

    await act(async () => {
      liberar(respostaSucesso(estadoFalso({ jogadorDaVezId: "jog-1" })));
      await emVoo;
    });

    expect(result.current.enviando).toBe(false);
  });
});

describe("aviso de gol", () => {
  /** O servidor nao avisa gol: a pista e o campo `gols` subir entre leituras. */
  function servidor(estadoInicial = estadoFalso()) {
    let atual = estadoInicial;
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      const metodo = metodoDaChamada([_url, init]);
      if (metodo === "partida.criar") {
        return respostaSucesso(entradaFalsa(0, estadoInicial));
      }
      return respostaSucesso(atual);
    });
    return {
      definir: (novo: ReturnType<typeof estadoFalso>) => {
        atual = novo;
      },
    };
  }

  it("nao anuncia gol na primeira leitura", async () => {
    servidor(estadoFalso({ golsCriador: 2, golsVisitante: 1 }));

    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });
    await waitFor(() => expect(result.current.fase).toBe("jogando"));

    expect(result.current.avisoGol).toBeNull();
  });

  it("anuncia o gol quando o placar sobe", async () => {
    const srv = servidor();
    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });
    await waitFor(() => expect(result.current.fase).toBe("jogando"));
    expect(result.current.avisoGol).toBeNull();

    srv.definir(estadoFalso({ golsCriador: 1, jogadorDaVezId: ID_VISITANTE }));

    await waitFor(() => expect(result.current.avisoGol).not.toBeNull());
    expect(result.current.avisoGol).toMatchObject({
      jogadorId: ID_CRIADOR,
      indice: 0,
      gols: 1,
      decisivo: false,
    });
  });

  it("identifica o adversario como autor do gol", async () => {
    const srv = servidor();
    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });
    await waitFor(() => expect(result.current.fase).toBe("jogando"));

    srv.definir(estadoFalso({ golsVisitante: 1 }));

    await waitFor(() => expect(result.current.avisoGol).not.toBeNull());
    expect(result.current.avisoGol).toMatchObject({
      jogadorId: ID_VISITANTE,
      indice: 1,
      gols: 1,
    });
  });

  it("marca como decisivo o gol que encerra a partida", async () => {
    const srv = servidor();
    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });
    await waitFor(() => expect(result.current.fase).toBe("jogando"));

    srv.definir(
      estadoFalso({
        situacao: "ENCERRADA",
        jogadorDaVezId: null,
        vencedorId: ID_CRIADOR,
        golsCriador: 3,
      }),
    );

    await waitFor(() => expect(result.current.avisoGol).not.toBeNull());
    expect(result.current.avisoGol?.decisivo).toBe(true);
    expect(result.current.avisoGol?.gols).toBe(3);
  });

  it("nao repete o aviso enquanto o placar nao muda", async () => {
    const srv = servidor();
    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });
    await waitFor(() => expect(result.current.fase).toBe("jogando"));

    srv.definir(estadoFalso({ golsCriador: 1 }));
    await waitFor(() => expect(result.current.avisoGol).not.toBeNull());
    const primeiro = result.current.avisoGol!.id;

    // Varias voltas de polling com o mesmo placar.
    await new Promise((resolver) => setTimeout(resolver, 80));
    expect(result.current.avisoGol?.id ?? primeiro).toBe(primeiro);
  });

  it("gera um id novo a cada gol", async () => {
    const srv = servidor();
    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });
    await waitFor(() => expect(result.current.fase).toBe("jogando"));

    srv.definir(estadoFalso({ golsCriador: 1 }));
    await waitFor(() => expect(result.current.avisoGol).not.toBeNull());
    const primeiro = result.current.avisoGol!.id;

    srv.definir(estadoFalso({ golsCriador: 2 }));
    await waitFor(() =>
      expect(result.current.avisoGol?.gols).toBe(2),
    );
    expect(result.current.avisoGol!.id).toBeGreaterThan(primeiro);
  });

  it("leva o nome bruto, para a interface ler a selecao", async () => {
    const srv = servidor(
      estadoFalso({ nomeCriador: "Ana (BRA)", nomeVisitante: "Bia (ITA)" }),
    );
    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana (BRA)");
    });
    await waitFor(() => expect(result.current.fase).toBe("jogando"));

    srv.definir(
      estadoFalso({
        nomeCriador: "Ana (BRA)",
        nomeVisitante: "Bia (ITA)",
        golsCriador: 1,
      }),
    );

    await waitFor(() => expect(result.current.avisoGol).not.toBeNull());
    expect(result.current.avisoGol?.nomeBruto).toBe("Ana (BRA)");
  });
});

describe("reiniciar", () => {
  it("limpa a sessao e volta para a tela inicial", async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(respostaSucesso(entradaFalsa(0)))
      .mockResolvedValue(
        respostaSucesso(estadoFalso({ situacao: "AGUARDANDO_JOGADOR" })),
      );

    const { result } = montar();
    await act(async () => {
      await result.current.criar("Ana");
    });
    expect(result.current.sessao).not.toBeNull();

    act(() => {
      result.current.reiniciar();
    });

    expect(result.current.sessao).toBeNull();
    expect(result.current.estado).toBeNull();
    expect(result.current.fase).toBe("inicial");
    expect(sessionStorage.getItem(CHAVE_SESSAO)).toBeNull();
  });
});
