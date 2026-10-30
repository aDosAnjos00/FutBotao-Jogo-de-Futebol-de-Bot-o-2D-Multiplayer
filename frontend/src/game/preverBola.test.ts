import { describe, expect, it } from "vitest";

import { marcadorDoGol, preverBola } from "./geometria";

const CAMPO = { largura: 100, altura: 60 };
const GOL = { inicioY: 25, fimY: 35 };
const chute = (direcaoX: number, direcaoY: number, forca: number) => ({
  pecaId: "p-1",
  direcaoX,
  direcaoY,
  forca,
});

/**
 * Os casos abaixo foram medidos no backend real rodando (jogadas de forca 100
 * para a direita). Se a previsao divergir, a mira passa a mentir.
 */
describe("preverBola bate com o servidor real", () => {
  it("peca longe da bola: nao toca", () => {
    // Observado: peca 25 -> 45, bola permaneceu em 50.
    const previsao = preverBola(
      { x: 50, y: 30 },
      { x: 25, y: 30 },
      chute(1, 0, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(false);
    expect(previsao.destino).toEqual({ x: 50, y: 30 });
    expect(previsao.indiceMarcador).toBeNull();
  });

  it("primeiro toque: bola de 50 para 72,5", () => {
    // Observado: peca 45 -> 65, bola 50 -> 72.5.
    const previsao = preverBola(
      { x: 50, y: 30 },
      { x: 45, y: 30 },
      chute(1, 0, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(true);
    expect(previsao.destino.x).toBeCloseTo(72.5, 9);
    expect(previsao.destino.y).toBeCloseTo(30, 9);
    expect(previsao.indiceMarcador).toBeNull();
  });

  it("segundo toque: bola de 72,5 para 91,25", () => {
    // Observado: peca 65 -> 85, bola 72.5 -> 91.25.
    const previsao = preverBola(
      { x: 72.5, y: 30 },
      { x: 65, y: 30 },
      chute(1, 0, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(true);
    expect(previsao.destino.x).toBeCloseTo(91.25, 9);
    expect(previsao.indiceMarcador).toBeNull();
  });

  it("toque decisivo: gol para o jogador 0, com a peca limitada pela borda", () => {
    // Observado: peca 85 -> 100 (limitada), bola 91.25 -> 104.375 => GOL.
    const previsao = preverBola(
      { x: 91.25, y: 30 },
      { x: 85, y: 30 },
      chute(1, 0, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(true);
    expect(previsao.destinoBruto.x).toBeCloseTo(104.375, 9);
    expect(previsao.indiceMarcador).toBe(0);
    // O destino limitado nao decide o gol, mas e onde a bola apareceria.
    expect(previsao.destino.x).toBe(100);
  });
});

describe("preverBola", () => {
  it("nao toca a bola quando ela esta fora do raio de contato", () => {
    // Bola a 3 unidades da trajetoria horizontal: acima de 2,5.
    const previsao = preverBola(
      { x: 50, y: 33 },
      { x: 45, y: 30 },
      chute(1, 0, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(false);
  });

  it("toca a bola no limite exato do raio de contato", () => {
    const previsao = preverBola(
      { x: 50, y: 32.5 },
      { x: 45, y: 30 },
      chute(1, 0, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(true);
  });

  it("aponta gol contra quando a bola vai para o proprio gol", () => {
    // Jogador 1 (lado direito) chutando para a esquerda marca em x <= 0.
    const previsao = preverBola(
      { x: 10, y: 30 },
      { x: 15, y: 30 },
      chute(-1, 0, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(true);
    expect(previsao.indiceMarcador).toBe(1);
  });

  it("nao e gol quando a bola cruza fora da faixa do gol", () => {
    const previsao = preverBola(
      { x: 91.25, y: 10 },
      { x: 85, y: 10 },
      chute(1, 0, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(true);
    expect(previsao.destinoBruto.x).toBeGreaterThan(100);
    expect(previsao.indiceMarcador).toBeNull();
  });

  it("nao preve nada com direcao invalida", () => {
    const previsao = preverBola(
      { x: 50, y: 30 },
      { x: 45, y: 30 },
      chute(0, 0, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(false);
  });

  it("forca minima quase nao desloca a bola", () => {
    const previsao = preverBola(
      { x: 46, y: 30 },
      { x: 45, y: 30 },
      chute(1, 0, 1),
      CAMPO,
      GOL,
    );
    // Peca anda 0,2; bola esta a frente, entao contato = 1 e nada e empurrado.
    expect(previsao.destino.x).toBeCloseTo(46, 9);
  });

  it("limita o destino ao campo quando nao e gol", () => {
    const previsao = preverBola(
      { x: 50, y: 58 },
      { x: 50, y: 55 },
      chute(0, 1, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.destino.y).toBeLessThanOrEqual(60);
    expect(previsao.destino.x).toBeLessThanOrEqual(100);
  });

  it("funciona em diagonal", () => {
    const previsao = preverBola(
      { x: 50, y: 30 },
      { x: 48, y: 28 },
      chute(Math.SQRT1_2, Math.SQRT1_2, 100),
      CAMPO,
      GOL,
    );
    expect(previsao.toca).toBe(true);
    expect(previsao.destino.x).toBeGreaterThan(50);
    expect(previsao.destino.y).toBeGreaterThan(30);
  });
});

describe("marcadorDoGol", () => {
  it("da o ponto ao jogador 0 quando a bola passa de x = 100 na faixa do gol", () => {
    expect(marcadorDoGol({ x: 100, y: 30 }, CAMPO, GOL)).toBe(0);
    expect(marcadorDoGol({ x: 120, y: 25 }, CAMPO, GOL)).toBe(0);
    expect(marcadorDoGol({ x: 120, y: 35 }, CAMPO, GOL)).toBe(0);
  });

  it("da o ponto ao jogador 1 quando a bola passa de x = 0 na faixa do gol", () => {
    expect(marcadorDoGol({ x: 0, y: 30 }, CAMPO, GOL)).toBe(1);
    expect(marcadorDoGol({ x: -5, y: 26 }, CAMPO, GOL)).toBe(1);
  });

  it("nao e gol fora da faixa Y, mesmo cruzando a linha", () => {
    expect(marcadorDoGol({ x: 110, y: 24.9 }, CAMPO, GOL)).toBeNull();
    expect(marcadorDoGol({ x: -10, y: 35.1 }, CAMPO, GOL)).toBeNull();
  });

  it("nao e gol dentro do campo", () => {
    expect(marcadorDoGol({ x: 50, y: 30 }, CAMPO, GOL)).toBeNull();
    expect(marcadorDoGol({ x: 99.9, y: 30 }, CAMPO, GOL)).toBeNull();
  });
});
