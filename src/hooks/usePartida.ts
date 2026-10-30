import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { ehErroDeConexao, ehErroDeSessao, mensagemDoErro } from "../api/erros";
import {
  criarPartida,
  ehAbortado,
  entrarNaPartida,
  ErroRpc,
  fazerJogada,
  obterEstado,
} from "../api/rpc";
import {
  ehSituacaoAtiva,
  jogadorPorId,
  pecaDoJogador,
  type EstadoPartida,
  type Jogada,
  type JogadorResumo,
  type Sessao,
} from "../api/types";
import { jogadaValida } from "../game/geometria";

const CHAVE_SESSAO = "futbotao.sessao";
const INTERVALO_POLLING = 1000;

export type Fase = "inicial" | "restaurando" | "aguardando" | "jogando" | "fim";

/** Gol recem-detectado, para a interface anunciar. */
export type AvisoGol = {
  /** Muda a cada gol, para reiniciar a animacao do aviso. */
  id: number;
  jogadorId: string;
  /** Nome como veio do servidor, ainda com o sufixo da selecao. */
  nomeBruto: string;
  indice: number;
  gols: number;
  /** Este gol encerrou a partida. */
  decisivo: boolean;
};

/** Quanto tempo o aviso de gol fica na tela. */
const DURACAO_AVISO_GOL = 2600;

type EstadoHook = {
  sessao: Sessao | null;
  estado: EstadoPartida | null;
  /** Ha uma requisicao disparada pelo usuario em voo (criar, entrar, jogar). */
  enviando: boolean;
  erro: string | null;
  /** O polling esta falhando por rede, mas a partida nao foi descartada. */
  reconectando: boolean;
  avisoGol: AvisoGol | null;
  /** Serve de `id` do proximo aviso. */
  contadorGol: number;
};

/**
 * Compara o placar do estado anterior com o novo. O servidor nao avisa gol;
 * a unica pista e o campo `gols` subir entre duas leituras.
 */
function detectarGol(
  anterior: EstadoPartida | null,
  novo: EstadoPartida,
  id: number,
): AvisoGol | null {
  // Sem estado anterior nao da para saber o que mudou: a primeira leitura
  // (criar, entrar ou sessao restaurada) so estabelece a linha de base.
  if (!anterior) return null;

  for (let indice = 0; indice < novo.jogadores.length; indice++) {
    const atual = novo.jogadores[indice];
    if (!atual) continue;
    const antes = anterior.jogadores.find((jogador) => jogador.id === atual.id);
    if (antes && atual.gols > antes.gols) {
      return {
        id,
        jogadorId: atual.id,
        nomeBruto: atual.nome,
        indice,
        gols: atual.gols,
        decisivo: novo.situacao === "ENCERRADA",
      };
    }
  }
  return null;
}

type Acao =
  | { tipo: "requisicao-iniciada" }
  | { tipo: "requisicao-encerrada" }
  | { tipo: "sessao-iniciada"; sessao: Sessao; estado: EstadoPartida }
  | { tipo: "estado-recebido"; estado: EstadoPartida }
  | { tipo: "erro"; mensagem: string }
  | { tipo: "erro-limpo" }
  | { tipo: "reconectando"; valor: boolean }
  | { tipo: "aviso-gol-limpo" }
  | { tipo: "sessao-descartada"; mensagem: string | null };

const ESTADO_INICIAL: EstadoHook = {
  sessao: null,
  estado: null,
  enviando: false,
  erro: null,
  reconectando: false,
  avisoGol: null,
  contadorGol: 0,
};

function redutor(estado: EstadoHook, acao: Acao): EstadoHook {
  switch (acao.tipo) {
    case "requisicao-iniciada":
      return { ...estado, enviando: true, erro: null };
    case "requisicao-encerrada":
      return { ...estado, enviando: false };
    case "sessao-iniciada":
      return {
        ...estado,
        sessao: acao.sessao,
        estado: acao.estado,
        erro: null,
        reconectando: false,
      };
    case "estado-recebido": {
      const aviso = detectarGol(
        estado.estado,
        acao.estado,
        estado.contadorGol + 1,
      );
      return {
        ...estado,
        estado: acao.estado,
        reconectando: false,
        avisoGol: aviso ?? estado.avisoGol,
        contadorGol: aviso ? estado.contadorGol + 1 : estado.contadorGol,
      };
    }
    case "erro":
      return { ...estado, erro: acao.mensagem };
    case "erro-limpo":
      return { ...estado, erro: null };
    case "reconectando":
      return { ...estado, reconectando: acao.valor };
    case "aviso-gol-limpo":
      return { ...estado, avisoGol: null };
    case "sessao-descartada":
      return { ...ESTADO_INICIAL, erro: acao.mensagem };
  }
}

function lerSessaoSalva(): Sessao | null {
  try {
    const bruto = sessionStorage.getItem(CHAVE_SESSAO);
    if (!bruto) return null;
    const dados = JSON.parse(bruto) as Partial<Sessao>;
    if (
      typeof dados.codigoPartida === "string" &&
      typeof dados.tokenJogador === "string" &&
      typeof dados.meuJogadorId === "string" &&
      typeof dados.meuPecaId === "string" &&
      (dados.meuIndice === 0 || dados.meuIndice === 1)
    ) {
      return dados as Sessao;
    }
  } catch {
    // sessionStorage indisponivel ou JSON corrompido: comeca do zero.
  }
  return null;
}

function salvarSessao(sessao: Sessao | null): void {
  try {
    if (sessao) {
      sessionStorage.setItem(CHAVE_SESSAO, JSON.stringify(sessao));
    } else {
      sessionStorage.removeItem(CHAVE_SESSAO);
    }
  } catch {
    // Persistencia e um conforto, nao um requisito.
  }
}

function iniciar(): EstadoHook {
  return { ...ESTADO_INICIAL, sessao: lerSessaoSalva() };
}

/**
 * Deduz o jogador local pelo indice no array `jogadores`: o backend devolve
 * apenas o `tokenJogador` em `criar`/`entrar`, e o token nunca aparece no
 * estado. Indice 0 e quem criou, indice 1 e quem entrou.
 */
function montarSessao(
  indice: 0 | 1,
  codigoPartida: string,
  tokenJogador: string,
  estado: EstadoPartida,
): Sessao | null {
  const jogador = estado.jogadores[indice];
  if (!jogador) return null;
  return {
    codigoPartida,
    tokenJogador,
    meuIndice: indice,
    meuJogadorId: jogador.id,
    meuPecaId: jogador.pecaId,
  };
}

export type OpcoesPartida = {
  /** Intervalo do polling em ms. Exposto para os testes. */
  intervaloPolling?: number;
};

export function usePartida(opcoes: OpcoesPartida = {}) {
  const intervalo = opcoes.intervaloPolling ?? INTERVALO_POLLING;
  const [estadoHook, despachar] = useReducer(redutor, undefined, iniciar);

  // Refs com o valor mais recente, para uso dentro do intervalo de polling e
  // de callbacks assincronos, sem recriar o efeito a cada render.
  const sessaoRef = useRef(estadoHook.sessao);
  sessaoRef.current = estadoHook.sessao;
  const estadoRef = useRef(estadoHook.estado);
  estadoRef.current = estadoHook.estado;

  const enviandoRef = useRef(false);
  const geracaoRef = useRef(0);
  const abortPollRef = useRef<AbortController | null>(null);
  const montadoRef = useRef(true);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
      abortPollRef.current?.abort();
    };
  }, []);

  const descartarSessao = useCallback((mensagem: string | null) => {
    salvarSessao(null);
    geracaoRef.current += 1;
    abortPollRef.current?.abort();
    abortPollRef.current = null;
    despachar({ tipo: "sessao-descartada", mensagem });
  }, []);

  /** Traduz um erro do servidor na reacao correspondente da interface. */
  const tratarErro = useCallback(
    (erro: unknown) => {
      if (ehAbortado(erro)) return;
      if (!montadoRef.current) return;

      if (erro instanceof ErroRpc) {
        if (ehErroDeSessao(erro.codigo)) {
          descartarSessao(erro.mensagemAmigavel);
          return;
        }
        if (ehErroDeConexao(erro.codigo)) {
          despachar({ tipo: "reconectando", valor: true });
          return;
        }
        despachar({ tipo: "erro", mensagem: erro.mensagemAmigavel });
        return;
      }

      despachar({ tipo: "erro", mensagem: mensagemDoErro(0) });
    },
    [descartarSessao],
  );

  const aplicarEstado = useCallback((estado: EstadoPartida) => {
    if (!montadoRef.current) return;
    despachar({ tipo: "estado-recebido", estado });
  }, []);

  const criar = useCallback(
    async (nomeJogador: string) => {
      const nome = nomeJogador.trim();
      if (!nome) {
        despachar({ tipo: "erro", mensagem: "Informe o seu nome." });
        return;
      }

      despachar({ tipo: "requisicao-iniciada" });
      try {
        const entrada = await criarPartida(nome);
        const sessao = montarSessao(
          0,
          entrada.codigoPartida,
          entrada.tokenJogador,
          entrada.estado,
        );
        if (!sessao) {
          despachar({
            tipo: "erro",
            mensagem: "O servidor devolveu uma partida incompleta.",
          });
          return;
        }
        salvarSessao(sessao);
        geracaoRef.current += 1;
        if (!montadoRef.current) return;
        despachar({ tipo: "sessao-iniciada", sessao, estado: entrada.estado });
      } catch (erro) {
        tratarErro(erro);
      } finally {
        if (montadoRef.current) despachar({ tipo: "requisicao-encerrada" });
      }
    },
    [tratarErro],
  );

  const entrar = useCallback(
    async (codigoPartida: string, nomeJogador: string) => {
      const nome = nomeJogador.trim();
      const codigo = codigoPartida.trim().toUpperCase();
      if (!nome) {
        despachar({ tipo: "erro", mensagem: "Informe o seu nome." });
        return;
      }
      if (!codigo) {
        despachar({ tipo: "erro", mensagem: "Informe o código da partida." });
        return;
      }

      despachar({ tipo: "requisicao-iniciada" });
      try {
        const entrada = await entrarNaPartida(codigo, nome);
        const sessao = montarSessao(
          1,
          entrada.codigoPartida,
          entrada.tokenJogador,
          entrada.estado,
        );
        if (!sessao) {
          despachar({
            tipo: "erro",
            mensagem: "O servidor devolveu uma partida incompleta.",
          });
          return;
        }
        salvarSessao(sessao);
        geracaoRef.current += 1;
        if (!montadoRef.current) return;
        despachar({ tipo: "sessao-iniciada", sessao, estado: entrada.estado });
      } catch (erro) {
        tratarErro(erro);
      } finally {
        if (montadoRef.current) despachar({ tipo: "requisicao-encerrada" });
      }
    },
    [tratarErro],
  );

  /** Busca o estado uma vez, fora do ritmo do polling. */
  const sincronizar = useCallback(async () => {
    const sessao = sessaoRef.current;
    if (!sessao) return;
    try {
      const estado = await obterEstado(
        sessao.codigoPartida,
        sessao.tokenJogador,
      );
      geracaoRef.current += 1;
      aplicarEstado(estado);
    } catch (erro) {
      if (ehAbortado(erro)) return;
      if (erro instanceof ErroRpc && ehErroDeSessao(erro.codigo)) {
        descartarSessao(erro.mensagemAmigavel);
      }
    }
  }, [aplicarEstado, descartarSessao]);

  const jogar = useCallback(
    async (jogada: Jogada) => {
      const sessao = sessaoRef.current;
      const estado = estadoRef.current;
      if (!sessao || !estado) return;

      if (estado.situacao !== "EM_ANDAMENTO") {
        despachar({
          tipo: "erro",
          mensagem: mensagemDoErro(
            estado.situacao === "ENCERRADA" ? -32007 : -32004,
          ),
        });
        return;
      }
      if (estado.jogadorDaVezId !== sessao.meuJogadorId) {
        despachar({ tipo: "erro", mensagem: mensagemDoErro(-32005) });
        void sincronizar();
        return;
      }
      if (jogada.pecaId !== sessao.meuPecaId || !jogadaValida(jogada)) {
        despachar({ tipo: "erro", mensagem: mensagemDoErro(-32006) });
        return;
      }

      // O polling em voo poderia devolver um estado anterior a esta jogada.
      abortPollRef.current?.abort();
      abortPollRef.current = null;
      geracaoRef.current += 1;

      enviandoRef.current = true;
      despachar({ tipo: "requisicao-iniciada" });
      try {
        const novoEstado = await fazerJogada(
          sessao.codigoPartida,
          sessao.tokenJogador,
          jogada,
        );
        geracaoRef.current += 1;
        aplicarEstado(novoEstado);
      } catch (erro) {
        tratarErro(erro);
        if (
          erro instanceof ErroRpc &&
          (erro.codigo === -32005 || erro.codigo === -32007)
        ) {
          // O servidor manda: realinha o cliente com o estado real.
          void sincronizar();
        }
      } finally {
        enviandoRef.current = false;
        if (montadoRef.current) despachar({ tipo: "requisicao-encerrada" });
      }
    },
    [aplicarEstado, sincronizar, tratarErro],
  );

  const reiniciar = useCallback(() => {
    descartarSessao(null);
  }, [descartarSessao]);

  const limparErro = useCallback(() => {
    despachar({ tipo: "erro-limpo" });
  }, []);

  // O aviso de gol se apaga sozinho; `id` garante que gols seguidos
  // reiniciem a contagem em vez de herdar o timer anterior.
  const idAviso = estadoHook.avisoGol?.id;
  useEffect(() => {
    if (idAviso === undefined) return;
    const timer = setTimeout(
      () => despachar({ tipo: "aviso-gol-limpo" }),
      DURACAO_AVISO_GOL,
    );
    return () => clearTimeout(timer);
  }, [idAviso]);

  const { sessao, estado } = estadoHook;
  const pollingAtivo =
    sessao !== null && (estado === null || ehSituacaoAtiva(estado.situacao));

  useEffect(() => {
    if (!pollingAtivo) return;

    let cancelado = false;

    const consultar = async () => {
      const sessaoAtual = sessaoRef.current;
      if (cancelado || !sessaoAtual) return;
      // Uma jogada em voo e autoritativa; nao competir com ela.
      if (enviandoRef.current) return;
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      ) {
        return;
      }

      const controlador = new AbortController();
      abortPollRef.current = controlador;
      const geracao = geracaoRef.current;

      try {
        const novoEstado = await obterEstado(
          sessaoAtual.codigoPartida,
          sessaoAtual.tokenJogador,
          controlador.signal,
        );
        // Descarta resposta atrasada de uma geracao anterior.
        if (cancelado || geracao !== geracaoRef.current) return;
        aplicarEstado(novoEstado);
      } catch (erro) {
        if (cancelado) return;
        tratarErro(erro);
      } finally {
        if (abortPollRef.current === controlador) {
          abortPollRef.current = null;
        }
      }
    };

    const aoVoltarParaAba = () => {
      if (document.visibilityState === "visible") void consultar();
    };

    void consultar();
    const timer = setInterval(() => void consultar(), intervalo);
    document.addEventListener("visibilitychange", aoVoltarParaAba);

    return () => {
      cancelado = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", aoVoltarParaAba);
      abortPollRef.current?.abort();
      abortPollRef.current = null;
    };
  }, [pollingAtivo, intervalo, aplicarEstado, tratarErro]);

  const derivados = useMemo(() => {
    const fase: Fase = !sessao
      ? "inicial"
      : !estado
        ? "restaurando"
        : estado.situacao === "AGUARDANDO_JOGADOR"
          ? "aguardando"
          : estado.situacao === "EM_ANDAMENTO"
            ? "jogando"
            : "fim";

    let meuJogador: JogadorResumo | undefined;
    let adversario: JogadorResumo | undefined;

    if (estado && sessao) {
      meuJogador = jogadorPorId(estado, sessao.meuJogadorId);
      adversario = estado.jogadores.find(
        (jogador) => jogador.id !== sessao.meuJogadorId,
      );
    }

    const jogadorDaVez = estado
      ? jogadorPorId(estado, estado.jogadorDaVezId)
      : undefined;

    const minhaVez =
      !!estado &&
      !!sessao &&
      estado.situacao === "EM_ANDAMENTO" &&
      estado.jogadorDaVezId === sessao.meuJogadorId;

    const minhaPeca =
      estado && sessao ? pecaDoJogador(estado, sessao.meuJogadorId) : undefined;

    const vencedor = estado
      ? jogadorPorId(estado, estado.vencedorId)
      : undefined;
    const euVenci =
      !!estado && !!sessao && estado.vencedorId === sessao.meuJogadorId;

    return {
      fase,
      meuJogador,
      adversario,
      jogadorDaVez,
      minhaVez,
      minhaPeca,
      vencedor,
      euVenci,
    };
  }, [estado, sessao]);

  return {
    ...estadoHook,
    ...derivados,
    podeJogar: derivados.minhaVez && !estadoHook.enviando,
    criar,
    entrar,
    jogar,
    reiniciar,
    limparErro,
    sincronizar,
  };
}
