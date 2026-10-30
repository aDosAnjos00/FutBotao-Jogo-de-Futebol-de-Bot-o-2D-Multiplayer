import { describe, expect, it } from "vitest";

import {
  EQUIPE_PADRAO,
  EQUIPES,
  equipeDoJogador,
  equipePorCodigo,
  formatarNome,
  interpretarNome,
  nomeExibido,
} from "./equipes";

describe("catalogo de selecoes", () => {
  it("traz as cinco principais selecoes", () => {
    expect(EQUIPES).toHaveLength(5);
    expect(EQUIPES.map((e) => e.nome)).toEqual([
      "Brasil",
      "Argentina",
      "Alemanha",
      "Itália",
      "França",
    ]);
  });

  it("nao repete codigo e todos tem tres letras", () => {
    const codigos = EQUIPES.map((e) => e.codigo);
    expect(new Set(codigos).size).toBe(codigos.length);
    for (const codigo of codigos) expect(codigo).toMatch(/^[A-Z]{3}$/);
  });

  it("toda selecao tem bandeira e as tres cores", () => {
    for (const equipe of EQUIPES) {
      expect(equipe.bandeira, equipe.nome).toBeTruthy();
      for (const cor of [equipe.primaria, equipe.secundaria, equipe.detalhe]) {
        expect(cor, equipe.nome).toMatch(/^#[0-9a-f]{6}$/);
      }
    }
  });

  it("a padrao esta no catalogo", () => {
    expect(EQUIPES).toContain(EQUIPE_PADRAO);
  });

  it("busca por codigo ignorando caixa", () => {
    expect(equipePorCodigo("bra")?.nome).toBe("Brasil");
    expect(equipePorCodigo(" FRA ")?.nome).toBe("França");
    expect(equipePorCodigo("XXX")).toBeUndefined();
  });
});

describe("transporte da selecao pelo nome", () => {
  it("monta o nome enviado ao servidor", () => {
    expect(formatarNome("Ana", EQUIPE_PADRAO)).toBe("Ana (BRA)");
    expect(formatarNome("  Ana  ", EQUIPE_PADRAO)).toBe("Ana (BRA)");
  });

  it("faz a volta completa para todas as selecoes", () => {
    for (const equipe of EQUIPES) {
      const bruto = formatarNome("Ana Maria", equipe);
      const lido = interpretarNome(bruto);
      expect(lido.nome, equipe.nome).toBe("Ana Maria");
      expect(lido.equipe?.codigo, equipe.nome).toBe(equipe.codigo);
    }
  });

  it("nome sem sufixo fica intacto e sem selecao", () => {
    const lido = interpretarNome("Ana");
    expect(lido.nome).toBe("Ana");
    expect(lido.equipe).toBeUndefined();
  });

  it("nao confunde parenteses que nao sao de selecao", () => {
    for (const bruto of ["Ana (Jr)", "Ana (xyz)", "Ana (12)", "Ana ()"]) {
      const lido = interpretarNome(bruto);
      expect(lido.equipe, bruto).toBeUndefined();
      expect(lido.nome, bruto).toBe(bruto);
    }
  });

  it("nao engole o nome quando sobra apenas o codigo", () => {
    const lido = interpretarNome("(BRA)");
    expect(lido.equipe).toBeUndefined();
    expect(lido.nome).toBe("(BRA)");
  });

  it("aceita codigo em minusculas", () => {
    expect(interpretarNome("Ana (bra)").equipe?.nome).toBe("Brasil");
  });

  it("usa o ultimo sufixo quando o usuario digita um parecido", () => {
    const lido = interpretarNome("Ana (BRA) (ITA)");
    expect(lido.equipe?.nome).toBe("Itália");
    expect(lido.nome).toBe("Ana (BRA)");
  });

  it("nomeExibido remove o sufixo", () => {
    expect(nomeExibido("Ana (BRA)")).toBe("Ana");
    expect(nomeExibido("Ana")).toBe("Ana");
  });
});

describe("equipeDoJogador", () => {
  it("devolve a selecao embutida no nome", () => {
    expect(equipeDoJogador("Ana (FRA)", 0).nome).toBe("França");
    expect(equipeDoJogador("Bia (GER)", 1).nome).toBe("Alemanha");
  });

  it("cai na cor do lado do campo quando o nome nao traz selecao", () => {
    const esquerda = equipeDoJogador("Ana", 0);
    const direita = equipeDoJogador("Bia", 1);
    expect(esquerda.codigo).toBe("");
    expect(direita.codigo).toBe("");
    expect(esquerda.primaria).not.toBe(direita.primaria);
  });

  it("a selecao do nome vence o lado do campo", () => {
    // Mesmo no indice 1, quem escolheu Brasil joga de amarelo.
    expect(equipeDoJogador("Bia (BRA)", 1).primaria).toBe(
      equipeDoJogador("Ana (BRA)", 0).primaria,
    );
  });
});
