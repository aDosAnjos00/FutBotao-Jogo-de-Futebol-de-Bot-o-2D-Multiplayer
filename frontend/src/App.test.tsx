import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import App from "./App";
import {
  CODIGO,
  entradaFalsa,
  estadoFalso,
  ID_CRIADOR,
  metodoDaChamada,
  respostaErro,
  respostaSucesso,
} from "./teste/fixtures";

beforeEach(() => {
  sessionStorage.clear();
  globalThis.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** Responde por metodo, para o polling nao receber o payload de criacao. */
function servidorFalso(estado = estadoFalso({ situacao: "AGUARDANDO_JOGADOR" })) {
  let atual = estado;
  vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
    const metodo = metodoDaChamada([_url, init]);
    if (metodo === "partida.criar") return respostaSucesso(entradaFalsa(0));
    if (metodo === "partida.entrar") return respostaSucesso(entradaFalsa(1));
    return respostaSucesso(atual);
  });
  return {
    definirEstado: (novo: ReturnType<typeof estadoFalso>) => {
      atual = novo;
    },
  };
}

async function criarPartidaNaInterface(nome = "Ana") {
  const usuario = userEvent.setup();
  render(<App />);
  await usuario.type(screen.getByLabelText(/seu nome/i), nome);
  await usuario.click(screen.getByRole("button", { name: /criar partida/i }));
  return usuario;
}

describe("App: escolha de selecao e aviso de gol", () => {
  it("oferece as cinco selecoes, com Brasil pre-selecionada", () => {
    render(<App />);
    const opcoes = screen.getAllByRole("radio");
    expect(opcoes).toHaveLength(5);
    expect(screen.getByRole("radio", { name: "Brasil" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("envia a selecao escolhida embutida no nome", async () => {
    servidorFalso();
    const usuario = userEvent.setup();
    render(<App />);

    await usuario.type(screen.getByLabelText(/seu nome/i), "Ana");
    await usuario.click(screen.getByRole("radio", { name: "Itália" }));
    await usuario.click(screen.getByRole("button", { name: /criar partida/i }));

    const chamada = vi
      .mocked(globalThis.fetch)
      .mock.calls.find((c) => metodoDaChamada([c[0], c[1]]) === "partida.criar")!;
    const params = JSON.parse(
      (chamada[1] as RequestInit).body as string,
    ).params;
    expect(params.nomeJogador).toBe("Ana (ITA)");
  });

  it("anuncia o gol do jogador local", async () => {
    const servidor = servidorFalso();
    await criarPartidaNaInterface();
    servidor.definirEstado(estadoFalso());
    await waitFor(() => expect(screen.getByText(/sua vez/i)).toBeInTheDocument());

    servidor.definirEstado(estadoFalso({ golsCriador: 1 }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("GOL!"),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/você marcou/i);
  });

  it("anuncia o gol do adversario", async () => {
    const servidor = servidorFalso();
    await criarPartidaNaInterface();
    servidor.definirEstado(estadoFalso());
    await waitFor(() => expect(screen.getByText(/sua vez/i)).toBeInTheDocument());

    servidor.definirEstado(estadoFalso({ golsVisitante: 1 }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        /gol do adversário/i,
      ),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(/bia marcou/i);
  });

  it("o aviso se apaga sozinho", async () => {
    const servidor = servidorFalso();
    await criarPartidaNaInterface();
    servidor.definirEstado(estadoFalso());
    await waitFor(() => expect(screen.getByText(/sua vez/i)).toBeInTheDocument());

    servidor.definirEstado(estadoFalso({ golsCriador: 1 }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("GOL!"),
    );

    await waitFor(
      () => expect(screen.queryByText("GOL!")).not.toBeInTheDocument(),
      { timeout: 4000 },
    );
  }, 10000);

  it("mostra a selecao de cada jogador no placar", async () => {
    const servidor = servidorFalso();
    await criarPartidaNaInterface();
    servidor.definirEstado(
      estadoFalso({ nomeCriador: "Ana (BRA)", nomeVisitante: "Bia (FRA)" }),
    );

    await waitFor(() => expect(screen.getByText(/sua vez/i)).toBeInTheDocument());
    const placar = screen.getByRole("region", { name: /placar/i });
    expect(placar).toHaveTextContent("Brasil");
    expect(placar).toHaveTextContent("França");
    // O sufixo tecnico nao aparece para o usuario.
    expect(placar.textContent).not.toContain("(BRA)");
  });
});

describe("App", () => {
  it("mostra a tela inicial com os dois caminhos", () => {
    render(<App />);
    expect(screen.getByLabelText(/seu nome/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /criar partida/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /entrar na partida/i }),
    ).toBeInTheDocument();
  });

  it("exige o nome antes de liberar os botoes", async () => {
    const usuario = userEvent.setup();
    render(<App />);

    expect(screen.getByRole("button", { name: /criar partida/i })).toBeDisabled();

    await usuario.type(screen.getByLabelText(/seu nome/i), "Ana");
    expect(screen.getByRole("button", { name: /criar partida/i })).toBeEnabled();
    // Entrar ainda exige o codigo.
    expect(
      screen.getByRole("button", { name: /entrar na partida/i }),
    ).toBeDisabled();
  });

  it("vai para a sala de espera e mostra o codigo da partida", async () => {
    servidorFalso();
    await criarPartidaNaInterface();

    await waitFor(() =>
      expect(screen.getByText(/aguardando o segundo jogador/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(CODIGO)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /copiar/i })).toBeInTheDocument();
  });

  it("entra na partida quando o polling traz EM_ANDAMENTO", async () => {
    const servidor = servidorFalso();
    await criarPartidaNaInterface();

    await waitFor(() =>
      expect(screen.getByText(/aguardando o segundo jogador/i)).toBeInTheDocument(),
    );

    servidor.definirEstado(estadoFalso());

    await waitFor(() => expect(screen.getByText(/sua vez/i)).toBeInTheDocument());
    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Chutar" })).toBeEnabled();

    // Placar com os dois jogadores e o placar zerado.
    const placar = screen.getByRole("region", { name: /placar/i });
    expect(placar).toHaveTextContent("Ana");
    expect(placar).toHaveTextContent("Bia");
    expect(placar).toHaveTextContent("(você)");
    expect(screen.getAllByLabelText(/^0 gols$/)).toHaveLength(2);
  });

  it("bloqueia o chute quando e a vez do adversario", async () => {
    const servidor = servidorFalso();
    await criarPartidaNaInterface();
    servidor.definirEstado(estadoFalso({ jogadorDaVezId: "jog-1" }));

    await waitFor(() =>
      expect(screen.getByText(/vez de bia/i)).toBeInTheDocument(),
    );
    expect(screen.getByRole("button", { name: "Chutar" })).toBeDisabled();
  });

  it("mostra a tela de fim com o resultado e o botao de jogar novamente", async () => {
    const servidor = servidorFalso();
    await criarPartidaNaInterface();
    servidor.definirEstado(
      estadoFalso({
        situacao: "ENCERRADA",
        jogadorDaVezId: null,
        vencedorId: ID_CRIADOR,
        golsCriador: 3,
        golsVisitante: 1,
      }),
    );

    await waitFor(() =>
      expect(screen.getByText(/você ganhou/i)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: /jogar novamente/i }),
    ).toBeInTheDocument();
  });

  it("mostra derrota quando o vencedor e o adversario", async () => {
    const servidor = servidorFalso();
    await criarPartidaNaInterface();
    servidor.definirEstado(
      estadoFalso({
        situacao: "ENCERRADA",
        jogadorDaVezId: null,
        vencedorId: "jog-1",
        golsVisitante: 3,
      }),
    );

    await waitFor(() =>
      expect(screen.getByText(/você perdeu/i)).toBeInTheDocument(),
    );
  });

  it("jogar novamente volta para a tela inicial", async () => {
    const servidor = servidorFalso();
    const usuario = await criarPartidaNaInterface();
    servidor.definirEstado(
      estadoFalso({
        situacao: "ENCERRADA",
        jogadorDaVezId: null,
        vencedorId: ID_CRIADOR,
        golsCriador: 3,
      }),
    );

    await waitFor(() =>
      expect(screen.getByText(/você ganhou/i)).toBeInTheDocument(),
    );
    await usuario.click(screen.getByRole("button", { name: /jogar novamente/i }));

    expect(screen.getByLabelText(/seu nome/i)).toBeInTheDocument();
    expect(sessionStorage.getItem("futbotao.sessao")).toBeNull();
  });

  it("volta para a tela inicial com aviso quando a partida desaparece", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      const metodo = metodoDaChamada([_url, init]);
      if (metodo === "partida.criar") return respostaSucesso(entradaFalsa(0));
      return respostaErro(-32001, "Partida não encontrada");
    });

    await criarPartidaNaInterface();

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/não existe mais/i),
    );
    expect(screen.getByLabelText(/seu nome/i)).toBeInTheDocument();
  });

  it("mostra erro do servidor na tela inicial sem criar sessao", async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(respostaErro(-32002));
    const usuario = userEvent.setup();
    render(<App />);

    await usuario.type(screen.getByLabelText(/seu nome/i), "Caio");
    await usuario.type(screen.getByLabelText(/código da partida/i), "abc123");
    await usuario.click(screen.getByRole("button", { name: /entrar na partida/i }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(/já está cheia/i),
    );
    expect(screen.getByLabelText(/seu nome/i)).toBeInTheDocument();
  });

  it("avisa que esta reconectando sem derrubar a partida", async () => {
    vi.mocked(globalThis.fetch).mockImplementation(async (_url, init) => {
      const metodo = metodoDaChamada([_url, init]);
      if (metodo === "partida.criar") return respostaSucesso(entradaFalsa(0));
      throw new TypeError("fetch failed");
    });

    await criarPartidaNaInterface();

    await waitFor(() =>
      expect(screen.getByText(/aguardando o segundo jogador/i)).toBeInTheDocument(),
    );
    expect(screen.queryByLabelText(/seu nome/i)).not.toBeInTheDocument();
  });
});
