import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  estadoFalso,
  ID_CRIADOR,
  ID_VISITANTE,
  PECA_CRIADOR,
  PECA_VISITANTE,
} from "../teste/fixtures";
import { Campo } from "./Campo";

function renderizar(
  props: Partial<Parameters<typeof Campo>[0]> = {},
) {
  const onJogada = vi.fn();
  const estado = props.estado ?? estadoFalso();
  const { container } = render(
    <Campo
      estado={estado}
      meuJogadorId={ID_CRIADOR}
      meuPecaId={PECA_CRIADOR}
      podeJogar
      onJogada={onJogada}
      {...props}
    />,
  );
  return { container, onJogada };
}

/** Rect sem letra-caixa: viewBox 100x60 em 1000x600, escala 10. */
const ESCALA = 10;

/**
 * Simula um arraste sobre a peca. jsdom nao faz layout, entao o retangulo do
 * svg e fornecido aqui; PointerEvent e a captura vem do setup dos testes.
 */
function arrastar(
  container: HTMLElement,
  pecaId: string,
  de: { x: number; y: number },
  para: { x: number; y: number },
) {
  const svg = container.querySelector("svg")!;
  svg.getBoundingClientRect = () =>
    ({
      left: 0,
      top: 0,
      width: 100 * ESCALA,
      height: 60 * ESCALA,
      right: 100 * ESCALA,
      bottom: 60 * ESCALA,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    }) as DOMRect;

  const peca = pecaDe(container, pecaId);
  fireEvent.pointerDown(peca, {
    pointerId: 1,
    clientX: de.x * ESCALA,
    clientY: de.y * ESCALA,
  });
  fireEvent.pointerMove(peca, {
    pointerId: 1,
    clientX: para.x * ESCALA,
    clientY: para.y * ESCALA,
  });
}

function pecaDe(container: HTMLElement, pecaId: string): SVGGElement {
  const elemento = container.querySelector(`[data-testid="peca-${pecaId}"]`);
  if (!elemento) throw new Error(`peça ${pecaId} não renderizada`);
  return elemento as unknown as SVGGElement;
}

describe("Campo", () => {
  it("usa o viewBox nas coordenadas logicas do servidor", () => {
    const { container } = renderizar();
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("viewBox")).toBe("0 0 100 60");
    expect(svg.getAttribute("preserveAspectRatio")).toBe("xMidYMid meet");
  });

  it("destaca a peca do jogador local e so ela", () => {
    const { container } = renderizar();

    const minha = pecaDe(container, PECA_CRIADOR);
    const adversaria = pecaDe(container, PECA_VISITANTE);

    expect(minha.getAttribute("data-eu")).toBe("true");
    expect(minha.getAttribute("class")).toContain("campo__peca--eu");
    expect(minha.querySelector(".campo__halo")).not.toBeNull();

    expect(adversaria.getAttribute("data-eu")).toBe("false");
    expect(adversaria.getAttribute("class")).not.toContain("campo__peca--eu");
    expect(adversaria.querySelector(".campo__halo")).toBeNull();
  });

  it("destaca a peca correta quando o jogador local e o visitante", () => {
    const { container } = renderizar({
      meuJogadorId: ID_VISITANTE,
      meuPecaId: PECA_VISITANTE,
    });

    expect(pecaDe(container, PECA_VISITANTE).getAttribute("data-eu")).toBe(
      "true",
    );
    expect(pecaDe(container, PECA_CRIADOR).getAttribute("data-eu")).toBe(
      "false",
    );
  });

  it("posiciona as pecas e a bola nas coordenadas do estado", () => {
    const estado = estadoFalso({
      posicaoCriador: { x: 40, y: 12 },
      posicaoVisitante: { x: 88, y: 51 },
      bola: { x: 62, y: 18 },
    });
    const { container } = renderizar({ estado });

    expect(pecaDe(container, PECA_CRIADOR).style.transform).toBe(
      "translate(40px, 12px)",
    );
    expect(pecaDe(container, PECA_VISITANTE).style.transform).toBe(
      "translate(88px, 51px)",
    );

    const bola = container.querySelector(".campo__bola")!
      .parentElement as unknown as SVGGElement;
    expect(bola.style.transform).toBe("translate(62px, 18px)");
  });

  // Regressao: o servidor limita o *centro* a borda (0..100 x 0..60), entao um
  // disco de raio 2.4 centrado ali ficava com metade para fora do gramado.
  describe("pecas e bola nunca saem do campo", () => {
    it("recua a peca que o servidor deixou na borda direita", () => {
      const { container } = renderizar({
        estado: estadoFalso({ posicaoCriador: { x: 100, y: 30 } }),
      });
      expect(pecaDe(container, PECA_CRIADOR).style.transform).toBe(
        "translate(97px, 30px)",
      );
    });

    it("recua as pecas que o servidor deixou nas bordas de cima e de baixo", () => {
      // Coordenadas observadas no servidor real ao chutar sempre para cima/baixo.
      const { container } = renderizar({
        estado: estadoFalso({
          posicaoCriador: { x: 25, y: 0 },
          posicaoVisitante: { x: 75, y: 60 },
        }),
      });
      expect(pecaDe(container, PECA_CRIADOR).style.transform).toBe(
        "translate(25px, 3px)",
      );
      expect(pecaDe(container, PECA_VISITANTE).style.transform).toBe(
        "translate(75px, 57px)",
      );
    });

    it("recua a bola encostada na borda", () => {
      const { container } = renderizar({
        estado: estadoFalso({ bola: { x: 0, y: 60 } }),
      });
      const bola = container.querySelector(".campo__bola")!
        .parentElement as unknown as SVGGElement;
      expect(bola.style.transform).toBe("translate(1.5px, 58.5px)");
    });

    it("mantem toda forma dentro do campo em todos os cantos", () => {
      const cantos = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 0, y: 60 },
        { x: 100, y: 60 },
      ];
      for (const canto of cantos) {
        const { container } = renderizar({
          estado: estadoFalso({ posicaoCriador: canto, bola: canto }),
        });
        const transform = pecaDe(container, PECA_CRIADOR).style.transform;
        const [x, y] = transform
          .match(/-?[\d.]+/g)!
          .map(Number) as [number, number];
        expect(x - 2.4, `canto ${JSON.stringify(canto)}`).toBeGreaterThanOrEqual(0);
        expect(x + 2.4).toBeLessThanOrEqual(100);
        expect(y - 2.4).toBeGreaterThanOrEqual(0);
        expect(y + 2.4).toBeLessThanOrEqual(60);
      }
    });

    it("vira o nome para baixo quando a peca esta na borda de cima", () => {
      const { container } = renderizar({
        estado: estadoFalso({ posicaoCriador: { x: 25, y: 0 } }),
      });
      const texto = pecaDe(container, PECA_CRIADOR).querySelector(
        ".campo__nome",
      )!;
      expect(Number(texto.getAttribute("y"))).toBeGreaterThan(0);
    });

    it("mantem o nome acima da peca longe da borda", () => {
      const { container } = renderizar();
      const texto = pecaDe(container, PECA_CRIADOR).querySelector(
        ".campo__nome",
      )!;
      expect(Number(texto.getAttribute("y"))).toBeLessThan(0);
    });

    it("nao mexe na descricao acessivel, que usa a coordenada do servidor", () => {
      renderizar({
        estado: estadoFalso({ posicaoCriador: { x: 100, y: 30 } }),
      });
      expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
        /sua peça em x 100, y 30/i,
      );
    });
  });

  // O servidor nao tem colisao entre pecas: as duas podem terminar na mesma
  // coordenada. Observado no servidor real: ambas em 55,30.
  describe("duas pecas nunca ocupam o mesmo espaco", () => {
    function centroDe(container: HTMLElement, pecaId: string) {
      const [x, y] = pecaDe(container, pecaId)
        .style.transform.match(/-?[\d.]+/g)!
        .map(Number) as [number, number];
      return { x, y };
    }

    it("afasta as pecas que o servidor deixou no mesmo ponto", () => {
      const { container } = renderizar({
        estado: estadoFalso({
          posicaoCriador: { x: 55, y: 30 },
          posicaoVisitante: { x: 55, y: 30 },
        }),
      });

      const a = centroDe(container, PECA_CRIADOR);
      const b = centroDe(container, PECA_VISITANTE);

      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeCloseTo(4.8, 6);
      // Cada peca vai para o seu lado: criador joga pela esquerda.
      expect(a.x).toBeLessThan(b.x);
    });

    it("afasta pecas apenas parcialmente sobrepostas", () => {
      const { container } = renderizar({
        estado: estadoFalso({
          posicaoCriador: { x: 48, y: 30 },
          posicaoVisitante: { x: 50, y: 30 },
        }),
      });

      const a = centroDe(container, PECA_CRIADOR);
      const b = centroDe(container, PECA_VISITANTE);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(4.8 - 1e-6);
    });

    it("nao mexe em pecas que já estao afastadas", () => {
      const { container } = renderizar();
      expect(centroDe(container, PECA_CRIADOR)).toEqual({ x: 25, y: 30 });
      expect(centroDe(container, PECA_VISITANTE)).toEqual({ x: 75, y: 30 });
    });

    it("separa mesmo com as duas sobrepostas na borda", () => {
      const { container } = renderizar({
        estado: estadoFalso({
          posicaoCriador: { x: 100, y: 60 },
          posicaoVisitante: { x: 100, y: 60 },
        }),
      });

      const a = centroDe(container, PECA_CRIADOR);
      const b = centroDe(container, PECA_VISITANTE);
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(4.8 - 1e-6);
      // E as duas seguem inteiras dentro do campo.
      for (const p of [a, b]) {
        expect(p.x - 2.4).toBeGreaterThanOrEqual(0);
        expect(p.x + 2.4).toBeLessThanOrEqual(100);
        expect(p.y - 2.4).toBeGreaterThanOrEqual(0);
        expect(p.y + 2.4).toBeLessThanOrEqual(60);
      }
    });

    it("a descricao acessivel segue com a coordenada do servidor", () => {
      renderizar({
        estado: estadoFalso({
          posicaoCriador: { x: 55, y: 30 },
          posicaoVisitante: { x: 55, y: 30 },
        }),
      });
      const rotulo = screen.getByRole("img").getAttribute("aria-label")!;
      expect(rotulo).toMatch(/sua peça em x 55, y 30/i);
      expect(rotulo).toMatch(/peça de bia em x 55, y 30/i);
    });
  });

  describe("previsao da bola", () => {
    it("nao desenha previsao sem arraste", () => {
      const { container } = renderizar();
      expect(
        container.querySelector('[data-testid="previsao-bola"]'),
      ).toBeNull();
    });

    it("desenha a trajetoria prevista durante o arraste", () => {
      // Peca em 45,30 e bola em 50,30: arrastar para a direita toca a bola.
      const { container } = renderizar({
        estado: estadoFalso({
          posicaoCriador: { x: 45, y: 30 },
          bola: { x: 50, y: 30 },
        }),
      });

      arrastar(container, PECA_CRIADOR, { x: 45, y: 30 }, { x: 65, y: 30 });

      const previsao = container.querySelector(
        '[data-testid="previsao-bola"]',
      );
      expect(previsao).not.toBeNull();
      const linha = previsao!.querySelector("line")!;
      // Mesmo valor medido no servidor real: a bola iria de 50 para 72,5.
      expect(Number(linha.getAttribute("x1"))).toBeCloseTo(50, 6);
      expect(Number(linha.getAttribute("x2"))).toBeCloseTo(72.5, 6);
      expect(previsao!.getAttribute("data-gol")).toBe("nenhum");
    });

    it("marca gol a favor quando a bola entra no gol adversario", () => {
      const { container } = renderizar({
        estado: estadoFalso({
          posicaoCriador: { x: 85, y: 30 },
          bola: { x: 91.25, y: 30 },
        }),
      });

      arrastar(container, PECA_CRIADOR, { x: 85, y: 30 }, { x: 105, y: 30 });

      const previsao = container.querySelector(
        '[data-testid="previsao-bola"]',
      )!;
      expect(previsao.getAttribute("data-gol")).toBe("favor");
      expect(previsao.textContent).toBe("GOL");
    });

    it("avisa gol contra quando a bola entra no proprio gol", () => {
      // Criador (indice 0) defende o lado esquerdo: bola saindo em x <= 0
      // marca para o adversario.
      const { container } = renderizar({
        estado: estadoFalso({
          posicaoCriador: { x: 10, y: 30 },
          bola: { x: 5, y: 30 },
        }),
      });

      arrastar(container, PECA_CRIADOR, { x: 10, y: 30 }, { x: -10, y: 30 });

      const previsao = container.querySelector(
        '[data-testid="previsao-bola"]',
      )!;
      expect(previsao.getAttribute("data-gol")).toBe("contra");
      expect(previsao.textContent).toBe("GOL CONTRA");
    });

    it("o mesmo lance e gol a favor para o jogador de indice 1", () => {
      const { container } = renderizar({
        meuJogadorId: ID_VISITANTE,
        meuPecaId: PECA_VISITANTE,
        estado: estadoFalso({
          jogadorDaVezId: ID_VISITANTE,
          posicaoVisitante: { x: 10, y: 30 },
          bola: { x: 5, y: 30 },
        }),
      });

      arrastar(container, PECA_VISITANTE, { x: 10, y: 30 }, { x: -10, y: 30 });

      expect(
        container
          .querySelector('[data-testid="previsao-bola"]')!
          .getAttribute("data-gol"),
      ).toBe("favor");
    });

    it("nao desenha previsao quando o chute nao alcanca a bola", () => {
      const { container } = renderizar({
        estado: estadoFalso({
          posicaoCriador: { x: 25, y: 30 },
          bola: { x: 50, y: 30 },
        }),
      });

      // Peca 25 -> 45 nao chega a 2,5 da bola em 50 (observado no servidor).
      arrastar(container, PECA_CRIADOR, { x: 25, y: 30 }, { x: 45, y: 30 });

      expect(
        container.querySelector('[data-testid="previsao-bola"]'),
      ).toBeNull();
    });
  });

  it("desenha as duas metas na faixa Y do gol informada pelo servidor", () => {
    const { container } = renderizar();
    const gols = container.querySelectorAll(".campo__gol");
    expect(gols).toHaveLength(2);
    for (const gol of gols) {
      expect(gol.getAttribute("y")).toBe("25");
      expect(gol.getAttribute("height")).toBe("10");
    }
  });

  it("mostra os nomes dos dois jogadores", () => {
    const { container } = renderizar();
    const nomes = Array.from(container.querySelectorAll(".campo__nome")).map(
      (no) => no.textContent,
    );
    // Sem selecao no nome, o rotulo cai na bandeira neutra.
    expect(nomes).toEqual(["⚽ Ana", "⚽ Bia"]);
  });

  describe("selecao escolhida", () => {
    const comEquipes = () =>
      estadoFalso({ nomeCriador: "Ana (BRA)", nomeVisitante: "Bia (ITA)" });

    it("pinta o disco com as cores da selecao de cada jogador", () => {
      const { container } = renderizar({ estado: comEquipes() });

      const minha = pecaDe(container, PECA_CRIADOR).querySelector(
        ".campo__disco",
      )!;
      const dela = pecaDe(container, PECA_VISITANTE).querySelector(
        ".campo__disco",
      )!;

      expect(minha.getAttribute("fill")).toBe("#ffdf00"); // Brasil
      expect(minha.getAttribute("stroke")).toBe("#002776");
      expect(dela.getAttribute("fill")).toBe("#0066b2"); // Itália
    });

    it("mostra a bandeira e o nome sem o sufixo tecnico", () => {
      const { container } = renderizar({ estado: comEquipes() });
      const nomes = Array.from(container.querySelectorAll(".campo__nome")).map(
        (no) => no.textContent,
      );
      expect(nomes).toEqual(["🇧🇷 Ana", "🇮🇹 Bia"]);
    });

    it("diferencia as pecas pela faixa quando as duas selecoes sao iguais", () => {
      const { container } = renderizar({
        estado: estadoFalso({
          nomeCriador: "Ana (BRA)",
          nomeVisitante: "Bia (BRA)",
        }),
      });

      const faixaA = pecaDe(container, PECA_CRIADOR).querySelector("rect")!;
      const faixaB = pecaDe(container, PECA_VISITANTE).querySelector("rect")!;

      // Mesma cor, orientacoes diferentes: indice 0 horizontal, 1 vertical.
      expect(faixaA.getAttribute("fill")).toBe(faixaB.getAttribute("fill"));
      expect(Number(faixaA.getAttribute("width"))).toBeGreaterThan(
        Number(faixaA.getAttribute("height")),
      );
      expect(Number(faixaB.getAttribute("height"))).toBeGreaterThan(
        Number(faixaB.getAttribute("width")),
      );
    });

    it("usa o nome limpo na descricao acessivel", () => {
      renderizar({ estado: comEquipes() });
      expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
        /peça de bia em x 75, y 30/i,
      );
    });
  });

  it("marca a peca local como arrastavel apenas quando pode jogar", () => {
    const { container } = renderizar();
    expect(
      pecaDe(container, PECA_CRIADOR).getAttribute("data-arrastavel"),
    ).toBe("true");

    const { container: bloqueado } = renderizar({ podeJogar: false });
    expect(
      pecaDe(bloqueado, PECA_CRIADOR).getAttribute("data-arrastavel"),
    ).toBe("false");
    expect(
      pecaDe(bloqueado, PECA_VISITANTE).getAttribute("data-arrastavel"),
    ).toBe("false");
  });

  it("descreve o campo para leitores de tela", () => {
    const imagem = screen.queryByRole("img");
    expect(imagem).toBeNull();

    renderizar();
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
      /bola em x 50, y 30/i,
    );
    expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(
      /sua peça/i,
    );
  });

  it("renderiza apenas uma peca enquanto a partida aguarda o segundo jogador", () => {
    const { container } = renderizar({
      estado: estadoFalso({ situacao: "AGUARDANDO_JOGADOR" }),
    });
    expect(container.querySelectorAll(".campo__peca")).toHaveLength(1);
  });
});
