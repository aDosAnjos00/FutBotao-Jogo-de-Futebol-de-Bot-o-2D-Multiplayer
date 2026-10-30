import { describe, expect, it } from "vitest";

import {
  CODIGO_FALHA_REDE,
  CODIGO_RESPOSTA_INVALIDA,
  ehErroDeConexao,
  ehErroDeSessao,
  mensagemDoErro,
} from "./erros";

/** Todos os codigos da tabela da especificacao. */
const CODIGOS_DO_CONTRATO = [
  -32700, -32600, -32601, -32602, -32603, -32001, -32002, -32003, -32004,
  -32005, -32006, -32007,
];

describe("mensagemDoErro", () => {
  it("tem mensagem para todo codigo do contrato", () => {
    for (const codigo of CODIGOS_DO_CONTRATO) {
      const mensagem = mensagemDoErro(codigo);
      expect(mensagem, `codigo ${codigo}`).toBeTruthy();
      expect(mensagem).not.toBe("Algo deu errado. Tente novamente.");
    }
  });

  it("tem mensagem para os codigos locais do cliente", () => {
    expect(mensagemDoErro(CODIGO_FALHA_REDE)).toContain("8080");
    expect(mensagemDoErro(CODIGO_RESPOSTA_INVALIDA)).toBeTruthy();
  });

  it("cai na mensagem genérica em codigo desconhecido", () => {
    expect(mensagemDoErro(-99999)).toBe("Algo deu errado. Tente novamente.");
    expect(mensagemDoErro(0)).toBe("Algo deu errado. Tente novamente.");
  });

  it("nao repete a mesma mensagem para codigos diferentes do contrato", () => {
    const mensagens = CODIGOS_DO_CONTRATO.map(mensagemDoErro);
    expect(new Set(mensagens).size).toBe(CODIGOS_DO_CONTRATO.length);
  });
});

describe("classificacao dos erros", () => {
  it("trata -32001 e -32003 como erros de sessao", () => {
    expect(ehErroDeSessao(-32001)).toBe(true);
    expect(ehErroDeSessao(-32003)).toBe(true);
  });

  it("nao descarta a sessao em erros de regra", () => {
    for (const codigo of [-32002, -32004, -32005, -32006, -32007]) {
      expect(ehErroDeSessao(codigo), `codigo ${codigo}`).toBe(false);
    }
  });

  it("identifica apenas a falha de transporte como erro de conexao", () => {
    expect(ehErroDeConexao(CODIGO_FALHA_REDE)).toBe(true);
    expect(ehErroDeConexao(-32005)).toBe(false);
    expect(ehErroDeConexao(CODIGO_RESPOSTA_INVALIDA)).toBe(false);
  });
});
