import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PECA_CRIADOR } from "../teste/fixtures";
import { ControleJogada } from "./ControleJogada";

function renderizar(props: Partial<Parameters<typeof ControleJogada>[0]> = {}) {
  const onJogada = vi.fn();
  render(
    <ControleJogada
      meuPecaId={PECA_CRIADOR}
      meuIndice={0}
      habilitado
      enviando={false}
      onJogada={onJogada}
      {...props}
    />,
  );
  return { onJogada };
}

function botaoChutar() {
  return screen.getByRole("button", { name: /chutar/i });
}

describe("ControleJogada", () => {
  it("desabilita todos os controles quando nao e a vez", () => {
    renderizar({ habilitado: false });

    expect(botaoChutar()).toBeDisabled();
    expect(screen.getByLabelText(/força do chute/i)).toBeDisabled();
    expect(screen.getByLabelText(/direção direita/i)).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      /aguarde a sua vez/i,
    );
  });

  it("desabilita os controles durante requisicao em voo", () => {
    renderizar({ enviando: true });

    expect(botaoChutar()).toBeDisabled();
    expect(botaoChutar()).toHaveTextContent(/enviando/i);
    expect(screen.getByLabelText(/força do chute/i)).toBeDisabled();
    expect(screen.getByLabelText(/^direção cima$/i)).toBeDisabled();
  });

  it("habilita os controles quando e a vez e nada esta em voo", () => {
    renderizar();

    expect(botaoChutar()).toBeEnabled();
    expect(screen.getByLabelText(/força do chute/i)).toBeEnabled();
  });

  it("envia a jogada com a direcao escolhida normalizada e a peca do jogador", async () => {
    const usuario = userEvent.setup();
    const { onJogada } = renderizar();

    await usuario.click(screen.getByLabelText(/^direção cima$/i));
    await usuario.click(botaoChutar());

    expect(onJogada).toHaveBeenCalledTimes(1);
    expect(onJogada).toHaveBeenCalledWith({
      pecaId: PECA_CRIADOR,
      direcaoX: 0,
      direcaoY: -1,
      forca: 50,
    });
  });

  it("normaliza direcoes diagonais para modulo 1", async () => {
    const usuario = userEvent.setup();
    const { onJogada } = renderizar();

    await usuario.click(screen.getByLabelText(/direção cima e direita/i));
    await usuario.click(botaoChutar());

    const jogada = onJogada.mock.calls[0]![0] as {
      direcaoX: number;
      direcaoY: number;
    };
    expect(Math.hypot(jogada.direcaoX, jogada.direcaoY)).toBeCloseTo(1, 10);
    expect(jogada.direcaoX).toBeGreaterThan(0);
    expect(jogada.direcaoY).toBeLessThan(0);
  });

  it("permite apagar e digitar a forca sem concatenar no valor antigo", async () => {
    const usuario = userEvent.setup();
    const { onJogada } = renderizar();

    const entrada = screen.getByLabelText(/força exata/i);
    await usuario.clear(entrada);
    await usuario.type(entrada, "90");

    expect(entrada).toHaveValue(90);
    await usuario.click(botaoChutar());
    expect(onJogada.mock.calls[0]![0]).toMatchObject({ forca: 90 });
  });

  it("normaliza o texto ao sair do campo", async () => {
    const usuario = userEvent.setup();
    renderizar();

    const entrada = screen.getByLabelText(/força exata/i);
    await usuario.clear(entrada);
    await usuario.type(entrada, "500");
    await usuario.tab();

    // 500 e limitado a 100, e o campo passa a mostrar o valor de fato usado.
    expect(entrada).toHaveValue(100);
  });

  it("limita a forca digitada ao intervalo aceito pelo servidor", async () => {
    const usuario = userEvent.setup();
    const { onJogada } = renderizar();

    const entrada = screen.getByLabelText(/força exata/i);
    await usuario.clear(entrada);
    await usuario.type(entrada, "500");
    await usuario.click(botaoChutar());

    expect(onJogada.mock.calls[0]![0]).toMatchObject({ forca: 100 });
  });

  it("nao chama onJogada enquanto desabilitado", async () => {
    const usuario = userEvent.setup();
    const { onJogada } = renderizar({ habilitado: false });

    await usuario.click(botaoChutar());
    expect(onJogada).not.toHaveBeenCalled();
  });

  it("nao oferece a direcao (0,0), rejeitada pelo servidor", () => {
    renderizar();
    const setas = screen.getAllByRole("button", { name: /^direção/i });
    expect(setas).toHaveLength(8);
  });
});

describe("ControleJogada: previsao da bola", () => {
  const semToque = {
    toca: false,
    destinoBruto: { x: 50, y: 30 },
    destino: { x: 50, y: 30 },
    indiceMarcador: null,
  } as const;

  function previsaoDe(texto: RegExp) {
    return screen
      .getAllByRole("status")
      .find((no) => texto.test(no.textContent ?? ""));
  }

  it("avisa quando o chute nao alcanca a bola", () => {
    renderizar({ prever: () => semToque });
    expect(previsaoDe(/não alcança a bola/i)).toBeDefined();
  });

  it("mostra para onde a bola vai quando o chute toca nela", () => {
    renderizar({
      prever: () => ({
        toca: true,
        destinoBruto: { x: 72.5, y: 30 },
        destino: { x: 72.5, y: 30 },
        indiceMarcador: null,
      }),
    });
    expect(previsaoDe(/leva a bola para x 73, y 30/i)).toBeDefined();
  });

  it("anuncia gol a favor quando o marcador e o jogador local", () => {
    renderizar({
      meuIndice: 0,
      prever: () => ({
        toca: true,
        destinoBruto: { x: 104, y: 30 },
        destino: { x: 100, y: 30 },
        indiceMarcador: 0,
      }),
    });
    const aviso = previsaoDe(/faz gol/i)!;
    expect(aviso.textContent).toBe("Este chute faz gol.");
    expect(aviso.className).toContain("controle__previsao--favor");
  });

  it("avisa gol contra quando o marcador e o adversario", () => {
    renderizar({
      meuIndice: 0,
      prever: () => ({
        toca: true,
        destinoBruto: { x: -4, y: 30 },
        destino: { x: 0, y: 30 },
        indiceMarcador: 1,
      }),
    });
    const aviso = previsaoDe(/gol contra/i)!;
    expect(aviso.textContent).toMatch(/atenção/i);
    expect(aviso.className).toContain("controle__previsao--contra");
  });

  it("o mesmo gol e a favor para o jogador de indice 1", () => {
    renderizar({
      meuIndice: 1,
      prever: () => ({
        toca: true,
        destinoBruto: { x: -4, y: 30 },
        destino: { x: 0, y: 30 },
        indiceMarcador: 1,
      }),
    });
    expect(previsaoDe(/faz gol/i)?.textContent).toBe("Este chute faz gol.");
  });

  it("nao mostra previsao quando nao e a vez", () => {
    renderizar({ habilitado: false, prever: () => semToque });
    expect(previsaoDe(/alcança a bola/i)).toBeUndefined();
  });

  it("nao exige a previsao: funciona sem o callback", () => {
    renderizar();
    expect(previsaoDe(/alcança a bola/i)).toBeUndefined();
    expect(screen.getByRole("button", { name: "Chutar" })).toBeEnabled();
  });

  it("recalcula a previsao quando a forca muda", async () => {
    const usuario = userEvent.setup();
    const recebidas: number[] = [];
    renderizar({
      prever: (jogada) => {
        recebidas.push(jogada.forca);
        return semToque;
      },
    });

    const entrada = screen.getByLabelText(/força exata/i);
    await usuario.clear(entrada);
    await usuario.type(entrada, "90");

    expect(recebidas).toContain(90);
  });
});
