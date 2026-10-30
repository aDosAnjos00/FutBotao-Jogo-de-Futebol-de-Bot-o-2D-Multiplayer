import { describe, expect, it } from "vitest";

import {
  destinoDaJogada,
  distancia,
  DISTANCIA_MAXIMA_PECA,
  forcaDoArraste,
  jogadaDoArraste,
  jogadaValida,
  limitar,
  limitarForca,
  normalizar,
  pontoDaTelaParaCampo,
  posicaoVisivel,
  RAIO_BOLA,
  RAIO_PECA,
  RECUO_BOLA,
  RECUO_PECA,
  separarPecas,
  SEPARACAO_PECAS,
} from "./geometria";

const CAMPO = { largura: 100, altura: 60 };

describe("normalizar", () => {
  it("devolve um vetor de modulo 1", () => {
    const unitario = normalizar({ x: 3, y: 4 });
    expect(unitario).not.toBeNull();
    expect(unitario!.x).toBeCloseTo(0.6, 10);
    expect(unitario!.y).toBeCloseTo(0.8, 10);
    expect(Math.hypot(unitario!.x, unitario!.y)).toBeCloseTo(1, 10);
  });

  it("preserva o sentido das componentes negativas", () => {
    const unitario = normalizar({ x: -1, y: -1 });
    expect(unitario!.x).toBeCloseTo(-Math.SQRT1_2, 10);
    expect(unitario!.y).toBeCloseTo(-Math.SQRT1_2, 10);
  });

  it("mantem as componentes dentro de -1 e 1, como o servidor exige", () => {
    for (const bruto of [
      { x: 500, y: 1 },
      { x: -0.001, y: 0.002 },
      { x: 1, y: -9999 },
    ]) {
      const unitario = normalizar(bruto)!;
      expect(unitario.x).toBeGreaterThanOrEqual(-1);
      expect(unitario.x).toBeLessThanOrEqual(1);
      expect(unitario.y).toBeGreaterThanOrEqual(-1);
      expect(unitario.y).toBeLessThanOrEqual(1);
    }
  });

  it("rejeita o vetor nulo (0,0)", () => {
    expect(normalizar({ x: 0, y: 0 })).toBeNull();
    expect(normalizar({ x: -0, y: 0 })).toBeNull();
  });

  it("rejeita componentes nao finitas", () => {
    expect(normalizar({ x: Number.NaN, y: 1 })).toBeNull();
    expect(normalizar({ x: Number.POSITIVE_INFINITY, y: 0 })).toBeNull();
  });
});

describe("limitar e limitarForca", () => {
  it("limita ao intervalo informado", () => {
    expect(limitar(5, 0, 10)).toBe(5);
    expect(limitar(-3, 0, 10)).toBe(0);
    expect(limitar(42, 0, 10)).toBe(10);
  });

  it("limita a forca ao intervalo 1 a 100 aceito pelo servidor", () => {
    expect(limitarForca(50)).toBe(50);
    expect(limitarForca(0)).toBe(1);
    expect(limitarForca(-20)).toBe(1);
    expect(limitarForca(100)).toBe(100);
    expect(limitarForca(1000)).toBe(100);
  });

  it("arredonda para inteiro", () => {
    expect(limitarForca(70.4)).toBe(70);
    expect(limitarForca(70.6)).toBe(71);
  });

  it("devolve a forca minima para valores nao finitos", () => {
    expect(limitarForca(Number.NaN)).toBe(1);
    expect(limitarForca(Number.POSITIVE_INFINITY)).toBe(1);
  });
});

describe("forcaDoArraste", () => {
  it("usa a distancia maxima da peca como forca 100", () => {
    expect(forcaDoArraste(DISTANCIA_MAXIMA_PECA)).toBe(100);
    expect(forcaDoArraste(DISTANCIA_MAXIMA_PECA / 2)).toBe(50);
  });

  it("nunca sai do intervalo valido", () => {
    expect(forcaDoArraste(0)).toBe(1);
    expect(forcaDoArraste(500)).toBe(100);
  });
});

describe("jogadaValida", () => {
  const base = { pecaId: "p-1", direcaoX: 1, direcaoY: 0, forca: 50 };

  it("aceita uma jogada dentro dos limites", () => {
    expect(jogadaValida(base)).toBe(true);
    expect(jogadaValida({ ...base, forca: 1 })).toBe(true);
    expect(jogadaValida({ ...base, forca: 100 })).toBe(true);
    expect(jogadaValida({ ...base, direcaoX: -1, direcaoY: 1 })).toBe(true);
  });

  it("rejeita direcao (0,0)", () => {
    expect(jogadaValida({ ...base, direcaoX: 0, direcaoY: 0 })).toBe(false);
  });

  it("rejeita componente de direcao fora de -1 e 1", () => {
    expect(jogadaValida({ ...base, direcaoX: 1.1 })).toBe(false);
    expect(jogadaValida({ ...base, direcaoY: -1.0001 })).toBe(false);
  });

  it("rejeita forca fora de 1 a 100", () => {
    expect(jogadaValida({ ...base, forca: 0 })).toBe(false);
    expect(jogadaValida({ ...base, forca: 101 })).toBe(false);
    expect(jogadaValida({ ...base, forca: Number.NaN })).toBe(false);
  });

  it("rejeita pecaId vazio", () => {
    expect(jogadaValida({ ...base, pecaId: "" })).toBe(false);
  });
});

describe("jogadaDoArraste", () => {
  it("monta a jogada a partir do vetor do arraste", () => {
    const jogada = jogadaDoArraste("p-1", { x: 25, y: 30 }, { x: 45, y: 30 });
    expect(jogada).not.toBeNull();
    expect(jogada!.pecaId).toBe("p-1");
    expect(jogada!.direcaoX).toBeCloseTo(1, 10);
    expect(jogada!.direcaoY).toBeCloseTo(0, 10);
    expect(jogada!.forca).toBe(100);
    expect(jogadaValida(jogada!)).toBe(true);
  });

  it("usa o sentido do arraste, nao o inverso", () => {
    const jogada = jogadaDoArraste("p-1", { x: 50, y: 30 }, { x: 50, y: 20 })!;
    expect(jogada.direcaoY).toBeLessThan(0);
    expect(jogada.direcaoX).toBeCloseTo(0, 10);
  });

  it("devolve null em arraste curto demais", () => {
    expect(
      jogadaDoArraste("p-1", { x: 25, y: 30 }, { x: 25, y: 30 }),
    ).toBeNull();
    expect(
      jogadaDoArraste("p-1", { x: 25, y: 30 }, { x: 25.1, y: 30 }),
    ).toBeNull();
  });

  it("gera sempre uma jogada aceita pela validacao do servidor", () => {
    const destinos = [
      { x: 0, y: 0 },
      { x: 100, y: 60 },
      { x: 25, y: 59 },
      { x: 1, y: 2 },
    ];
    for (const destino of destinos) {
      const jogada = jogadaDoArraste("p-1", { x: 25, y: 30 }, destino);
      if (jogada) expect(jogadaValida(jogada), JSON.stringify(destino)).toBe(true);
    }
  });
});

describe("pontoDaTelaParaCampo", () => {
  it("converte o centro do elemento no centro do campo", () => {
    const retangulo = { left: 0, top: 0, width: 1000, height: 600 };
    const ponto = pontoDaTelaParaCampo({ x: 500, y: 300 }, retangulo, CAMPO);
    expect(ponto.x).toBeCloseTo(50, 10);
    expect(ponto.y).toBeCloseTo(30, 10);
  });

  it("desconta a posicao do elemento na pagina", () => {
    const retangulo = { left: 120, top: 80, width: 1000, height: 600 };
    const ponto = pontoDaTelaParaCampo({ x: 120, y: 80 }, retangulo, CAMPO);
    expect(ponto.x).toBeCloseTo(0, 10);
    expect(ponto.y).toBeCloseTo(0, 10);
  });

  it("escala proporcionalmente quando o elemento tem a mesma proporcao", () => {
    const retangulo = { left: 0, top: 0, width: 500, height: 300 };
    const ponto = pontoDaTelaParaCampo({ x: 125, y: 150 }, retangulo, CAMPO);
    expect(ponto.x).toBeCloseTo(25, 10);
    expect(ponto.y).toBeCloseTo(30, 10);
  });

  it("compensa a letra-caixa de preserveAspectRatio quando sobra altura", () => {
    // 1000x1000 com viewBox 100x60: escala 10, campo renderizado 1000x600,
    // sobrando 200px acima e 200px abaixo.
    const retangulo = { left: 0, top: 0, width: 1000, height: 1000 };
    expect(
      pontoDaTelaParaCampo({ x: 0, y: 200 }, retangulo, CAMPO).y,
    ).toBeCloseTo(0, 10);
    expect(
      pontoDaTelaParaCampo({ x: 500, y: 500 }, retangulo, CAMPO),
    ).toEqual({ x: 50, y: 30 });
  });

  it("compensa a letra-caixa quando sobra largura", () => {
    // 1000x300 com viewBox 100x60: escala 5, campo renderizado 500x300,
    // sobrando 250px de cada lado.
    const retangulo = { left: 0, top: 0, width: 1000, height: 300 };
    expect(
      pontoDaTelaParaCampo({ x: 250, y: 0 }, retangulo, CAMPO).x,
    ).toBeCloseTo(0, 10);
    expect(
      pontoDaTelaParaCampo({ x: 750, y: 300 }, retangulo, CAMPO).x,
    ).toBeCloseTo(100, 10);
  });

  it("nao divide por zero em elemento sem tamanho", () => {
    const ponto = pontoDaTelaParaCampo(
      { x: 10, y: 10 },
      { left: 0, top: 0, width: 0, height: 0 },
      CAMPO,
    );
    expect(ponto).toEqual({ x: 0, y: 0 });
  });
});

describe("destinoDaJogada", () => {
  it("alcanca a distancia maxima com forca 100", () => {
    const destino = destinoDaJogada(
      { x: 25, y: 30 },
      { pecaId: "p-1", direcaoX: 1, direcaoY: 0, forca: 100 },
      CAMPO,
    );
    expect(destino.x).toBeCloseTo(25 + DISTANCIA_MAXIMA_PECA, 10);
    expect(destino.y).toBeCloseTo(30, 10);
  });

  it("escala o alcance com a forca, como o servidor faz", () => {
    const destino = destinoDaJogada(
      { x: 50, y: 30 },
      { pecaId: "p-1", direcaoX: 0, direcaoY: 1, forca: 50 },
      CAMPO,
    );
    expect(destino.y).toBeCloseTo(30 + DISTANCIA_MAXIMA_PECA / 2, 10);
  });

  it("limita o destino ao campo, por eixo, como o servidor", () => {
    const destino = destinoDaJogada(
      { x: 95, y: 55 },
      { pecaId: "p-1", direcaoX: 1, direcaoY: 1, forca: 100 },
      CAMPO,
    );
    expect(destino.x).toBe(100);
    expect(destino.y).toBe(60);
  });

  it("nao deixa o destino ficar negativo", () => {
    const destino = destinoDaJogada(
      { x: 5, y: 5 },
      { pecaId: "p-1", direcaoX: -1, direcaoY: -1, forca: 100 },
      CAMPO,
    );
    expect(destino.x).toBe(0);
    expect(destino.y).toBe(0);
  });
});

describe("posicaoVisivel", () => {
  // O servidor limita o centro a borda; a forma inteira precisa caber.
  it("recua o centro para a forma nao vazar na borda direita e inferior", () => {
    expect(posicaoVisivel({ x: 100, y: 60 }, RECUO_PECA, CAMPO)).toEqual({
      x: 97,
      y: 57,
    });
  });

  it("recua o centro nas bordas esquerda e superior", () => {
    expect(posicaoVisivel({ x: 0, y: 0 }, RECUO_PECA, CAMPO)).toEqual({
      x: 3,
      y: 3,
    });
  });

  it("usa o recuo menor da bola", () => {
    expect(posicaoVisivel({ x: 100, y: 0 }, RECUO_BOLA, CAMPO)).toEqual({
      x: 98.5,
      y: 1.5,
    });
  });

  it("nao mexe em posicoes que já estao folgadas", () => {
    for (const posicao of [
      { x: 50, y: 30 },
      { x: 25, y: 30 },
      { x: 75, y: 30 },
    ]) {
      expect(posicaoVisivel(posicao, RECUO_PECA, CAMPO)).toEqual(posicao);
    }
  });

  it("mantem a forma inteira dentro do campo em qualquer coordenada do servidor", () => {
    // Varre todas as bordas e cantos que o clamp do servidor pode produzir.
    for (let x = 0; x <= 100; x += 5) {
      for (const y of [0, 15, 30, 45, 60]) {
        for (const raio of [RECUO_PECA, RECUO_BOLA]) {
          const { x: vx, y: vy } = posicaoVisivel({ x, y }, raio, CAMPO);
          expect(vx - raio, `x=${x} raio=${raio}`).toBeGreaterThanOrEqual(0);
          expect(vx + raio, `x=${x} raio=${raio}`).toBeLessThanOrEqual(100);
          expect(vy - raio, `y=${y} raio=${raio}`).toBeGreaterThanOrEqual(0);
          expect(vy + raio, `y=${y} raio=${raio}`).toBeLessThanOrEqual(60);
        }
      }
    }
  });

  it("nao inverte os limites num campo menor que o dobro do raio", () => {
    const minusculo = { largura: 4, altura: 4 };
    const visivel = posicaoVisivel({ x: 4, y: 0 }, RECUO_PECA, minusculo);
    expect(Number.isFinite(visivel.x)).toBe(true);
    expect(Number.isFinite(visivel.y)).toBe(true);
  });

  it("o recuo cobre o raio desenhado de cada forma", () => {
    expect(RECUO_PECA).toBeGreaterThanOrEqual(RAIO_PECA);
    expect(RECUO_BOLA).toBeGreaterThanOrEqual(RAIO_BOLA);
  });
});

describe("separarPecas", () => {
  const sep = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    separarPecas(a, b, CAMPO);

  it("nao mexe em pecas que já estao afastadas", () => {
    const [a, b] = sep({ x: 25, y: 30 }, { x: 75, y: 30 });
    expect(a).toEqual({ x: 25, y: 30 });
    expect(b).toEqual({ x: 75, y: 30 });
  });

  // Caso observado no servidor real: as duas pecas em 55,30.
  it("separa pecas exatamente no mesmo ponto, cada uma para o seu lado", () => {
    const [a, b] = sep({ x: 55, y: 30 }, { x: 55, y: 30 });
    expect(distancia(a, b)).toBeCloseTo(SEPARACAO_PECAS, 9);
    expect(a.x).toBeLessThan(55);
    expect(b.x).toBeGreaterThan(55);
    expect(a.y).toBe(30);
    expect(b.y).toBe(30);
  });

  it("separa ao longo da linha entre os centros quando ha direcao", () => {
    const [a, b] = sep({ x: 50, y: 30 }, { x: 50, y: 32 });
    expect(distancia(a, b)).toBeCloseTo(SEPARACAO_PECAS, 9);
    expect(a.y).toBeLessThan(b.y);
    expect(a.x).toBeCloseTo(50, 9);
    expect(b.x).toBeCloseTo(50, 9);
  });

  it("afasta o minimo necessario, mantendo o ponto medio", () => {
    const [a, b] = sep({ x: 48, y: 30 }, { x: 52, y: 30 });
    expect(distancia(a, b)).toBeCloseTo(SEPARACAO_PECAS, 9);
    expect((a.x + b.x) / 2).toBeCloseTo(50, 9);
  });

  it("garante a separacao mesmo com as duas no mesmo canto", () => {
    for (const canto of [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 0, y: 60 },
      { x: 100, y: 60 },
      { x: 100, y: 30 },
    ]) {
      const [a, b] = sep(canto, canto);
      expect(distancia(a, b), JSON.stringify(canto)).toBeGreaterThanOrEqual(
        SEPARACAO_PECAS - 1e-6,
      );
    }
  });

  it("mantem as duas pecas inteiras dentro do campo depois de separar", () => {
    const casos = [
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      [
        { x: 100, y: 60 },
        { x: 100, y: 60 },
      ],
      [
        { x: 100, y: 30 },
        { x: 98, y: 30 },
      ],
      [
        { x: 50, y: 0 },
        { x: 50, y: 1 },
      ],
      [
        { x: 2, y: 58 },
        { x: 1, y: 59 },
      ],
    ] as const;

    for (const [primeira, segunda] of casos) {
      const [a, b] = sep(primeira, segunda);
      for (const p of [a, b]) {
        const rotulo = JSON.stringify([primeira, segunda]);
        expect(p.x - RECUO_PECA, rotulo).toBeGreaterThanOrEqual(-1e-9);
        expect(p.x + RECUO_PECA, rotulo).toBeLessThanOrEqual(100 + 1e-9);
        expect(p.y - RECUO_PECA, rotulo).toBeGreaterThanOrEqual(-1e-9);
        expect(p.y + RECUO_PECA, rotulo).toBeLessThanOrEqual(60 + 1e-9);
      }
    }
  });

  it("nunca sobrepoe os discos, varrendo o campo", () => {
    for (let x = 0; x <= 100; x += 10) {
      for (let y = 0; y <= 60; y += 10) {
        for (const desvio of [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 0, y: 2 },
          { x: 3, y: 3 },
          { x: -2, y: 1 },
        ]) {
          const [a, b] = sep(
            { x, y },
            { x: x + desvio.x, y: y + desvio.y },
          );
          expect(
            distancia(a, b),
            `(${x},${y}) desvio ${JSON.stringify(desvio)}`,
          ).toBeGreaterThanOrEqual(SEPARACAO_PECAS - 1e-6);
        }
      }
    }
  });

  it("a separacao minima e o diametro do disco", () => {
    expect(SEPARACAO_PECAS).toBe(RAIO_PECA * 2);
  });
});
