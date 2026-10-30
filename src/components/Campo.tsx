import { useCallback, useMemo, useRef, useState } from "react";

import type { EstadoPartida, Jogada, Posicao } from "../api/types";
import { equipeDoJogador, nomeExibido } from "../game/equipes";
import {
  destinoDaJogada,
  jogadaDoArraste,
  pontoDaTelaParaCampo,
  posicaoVisivel,
  preverBola,
  RAIO_BOLA,
  RAIO_PECA,
  RECUO_BOLA,
  RECUO_PECA,
  separarPecas,
} from "../game/geometria";

type Props = {
  estado: EstadoPartida;
  meuJogadorId: string;
  meuPecaId: string;
  podeJogar: boolean;
  onJogada: (jogada: Jogada) => void;
};

type Arraste = {
  pecaId: string;
  origem: { x: number; y: number };
  atual: { x: number; y: number };
  jogada: Jogada | null;
};

/** Altura aproximada do nome; abaixo disso o rotulo vira para baixo da peca. */
const FOLGA_NOME = 7;

export function Campo({
  estado,
  meuJogadorId,
  meuPecaId,
  podeJogar,
  onJogada,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [arraste, definirArraste] = useState<Arraste | null>(null);

  const { campo } = estado;

  const pontoLogico = useCallback(
    (clientX: number, clientY: number) => {
      const elemento = svgRef.current;
      if (!elemento) return { x: 0, y: 0 };
      const retangulo = elemento.getBoundingClientRect();
      return pontoDaTelaParaCampo(
        { x: clientX, y: clientY },
        retangulo,
        { largura: campo.largura, altura: campo.altura },
      );
    },
    [campo.altura, campo.largura],
  );

  const minhaPeca = campo.pecas.find((peca) => peca.jogadorId === meuJogadorId);

  /**
   * Posicao de desenho de cada peca: recuada da borda e afastada da outra,
   * para que duas pecas nunca apareçam no mesmo lugar.
   */
  const desenhos = useMemo(() => {
    const mapa = new Map<string, Posicao>();
    const dimensoes = { largura: campo.largura, altura: campo.altura };

    // Ordem de `jogadores`: indice 0 joga pela esquerda, 1 pela direita.
    const ordenadas = estado.jogadores
      .map((jogador) =>
        campo.pecas.find((peca) => peca.jogadorId === jogador.id),
      )
      .filter((peca): peca is NonNullable<typeof peca> => peca !== undefined);

    const [primeira, segunda] = ordenadas;
    if (primeira && segunda) {
      const [a, b] = separarPecas(
        primeira.posicao,
        segunda.posicao,
        dimensoes,
      );
      mapa.set(primeira.id, a);
      mapa.set(segunda.id, b);
    } else if (primeira) {
      mapa.set(
        primeira.id,
        posicaoVisivel(primeira.posicao, RECUO_PECA, dimensoes),
      );
    }
    return mapa;
  }, [campo.altura, campo.largura, campo.pecas, estado.jogadores]);

  const aoPressionar = (evento: React.PointerEvent<SVGGElement>) => {
    if (!podeJogar || !minhaPeca) return;
    evento.preventDefault();
    evento.currentTarget.setPointerCapture(evento.pointerId);
    // Origem do gesto e o disco desenhado, que e o que o usuario agarrou.
    const origem = desenhos.get(minhaPeca.id) ?? minhaPeca.posicao;
    definirArraste({
      pecaId: meuPecaId,
      origem: { x: origem.x, y: origem.y },
      atual: { x: origem.x, y: origem.y },
      jogada: null,
    });
  };

  const aoMover = (evento: React.PointerEvent<SVGGElement>) => {
    if (!arraste) return;
    evento.preventDefault();
    const atual = pontoLogico(evento.clientX, evento.clientY);
    definirArraste({
      ...arraste,
      atual,
      jogada: jogadaDoArraste(arraste.pecaId, arraste.origem, atual),
    });
  };

  const aoSoltar = (evento: React.PointerEvent<SVGGElement>) => {
    if (!arraste) return;
    evento.preventDefault();
    const jogada = arraste.jogada;
    definirArraste(null);
    if (jogada && podeJogar) onJogada(jogada);
  };

  const dimensoes = { largura: campo.largura, altura: campo.altura };

  // A mira termina onde a peca realmente vai parar: o destino e limitado pelo
  // servidor e depois recuado para o disco caber no campo.
  const mira =
    arraste?.jogada && minhaPeca
      ? posicaoVisivel(
          destinoDaJogada(minhaPeca.posicao, arraste.jogada, dimensoes),
          RECUO_PECA,
          dimensoes,
        )
      : null;

  const meuIndice = estado.jogadores.findIndex(
    (jogador) => jogador.id === meuJogadorId,
  );

  // Previsao da bola para a jogada que esta sendo mirada. Usa a coordenada
  // logica da peca, que e a que o servidor vai usar na conta.
  const previsao =
    arraste?.jogada && minhaPeca
      ? preverBola(campo.bola, minhaPeca.posicao, arraste.jogada, dimensoes, {
          inicioY: campo.golInicioY,
          fimY: campo.golFimY,
        })
      : null;

  const golPrevisto =
    previsao && previsao.indiceMarcador !== null
      ? previsao.indiceMarcador === meuIndice
        ? "favor"
        : "contra"
      : null;
  // Comeca no disco como ele aparece, nao na coordenada logica, para a mira
  // sair de onde o dedo pegou a peca.
  const origemMira = minhaPeca ? desenhos.get(minhaPeca.id) ?? null : null;

  return (
    <svg
      ref={svgRef}
      className="campo"
      viewBox={`0 0 ${campo.largura} ${campo.altura}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={descreverCampo(estado, meuJogadorId)}
    >
      <defs>
        <radialGradient id="brilhoPeca" cx="35%" cy="30%" r="70%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Recorta a faixa da camisa no contorno do disco. */}
        <clipPath id="discoPeca">
          <circle r={RAIO_PECA} />
        </clipPath>
      </defs>

      {/* Gramado e faixas */}
      <rect
        x="0"
        y="0"
        width={campo.largura}
        height={campo.altura}
        className="campo__gramado"
      />
      {Array.from({ length: 10 }, (_, indice) => (
        <rect
          key={indice}
          x={(indice * campo.largura) / 10}
          y="0"
          width={campo.largura / 10}
          height={campo.altura}
          className={
            indice % 2 === 0 ? "campo__faixa campo__faixa--clara" : "campo__faixa"
          }
        />
      ))}

      {/* Linhas de campo */}
      <rect
        x="1"
        y="1"
        width={campo.largura - 2}
        height={campo.altura - 2}
        className="campo__linha"
      />
      <line
        x1={campo.largura / 2}
        y1="1"
        x2={campo.largura / 2}
        y2={campo.altura - 1}
        className="campo__linha"
      />
      <circle
        cx={campo.largura / 2}
        cy={campo.altura / 2}
        r="9"
        className="campo__linha"
      />
      <circle
        cx={campo.largura / 2}
        cy={campo.altura / 2}
        r="0.7"
        className="campo__marca"
      />

      {/* Areas e metas */}
      <rect
        x="1"
        y={campo.golInicioY - 8}
        width="12"
        height={campo.golFimY - campo.golInicioY + 16}
        className="campo__linha"
      />
      <rect
        x={campo.largura - 13}
        y={campo.golInicioY - 8}
        width="12"
        height={campo.golFimY - campo.golInicioY + 16}
        className="campo__linha"
      />
      <rect
        x="0"
        y={campo.golInicioY}
        width="2"
        height={campo.golFimY - campo.golInicioY}
        className="campo__gol campo__gol--direita"
      />
      <rect
        x={campo.largura - 2}
        y={campo.golInicioY}
        width="2"
        height={campo.golFimY - campo.golInicioY}
        className="campo__gol campo__gol--esquerda"
      />

      {/* Linha de mira: para onde a peca vai */}
      {mira && origemMira && (
        <g className="campo__mira">
          <line x1={origemMira.x} y1={origemMira.y} x2={mira.x} y2={mira.y} />
          <circle cx={mira.x} cy={mira.y} r="0.9" />
        </g>
      )}

      {/* Previsao da bola: para onde ela vai se o chute tocar nela */}
      {previsao?.toca && (
        <g
          data-testid="previsao-bola"
          data-gol={golPrevisto ?? "nenhum"}
          className={[
            "campo__previsao",
            golPrevisto === "favor" ? "campo__previsao--favor" : "",
            golPrevisto === "contra" ? "campo__previsao--contra" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <line
            x1={campo.bola.x}
            y1={campo.bola.y}
            x2={previsao.destino.x}
            y2={previsao.destino.y}
          />
          <circle
            cx={previsao.destino.x}
            cy={previsao.destino.y}
            r={RAIO_BOLA}
          />
          {golPrevisto && (
            <text
              x={previsao.destino.x}
              y={previsao.destino.y - 3.5}
              className="campo__aviso"
            >
              {golPrevisto === "favor" ? "GOL" : "GOL CONTRA"}
            </text>
          )}
        </g>
      )}

      {/* Bola */}
      <g
        className="campo__movel"
        style={transformar(posicaoVisivel(campo.bola, RECUO_BOLA, dimensoes))}
      >
        <circle r={RAIO_BOLA} className="campo__bola" />
      </g>

      {/* Pecas */}
      {campo.pecas.map((peca) => {
        const souEu = peca.jogadorId === meuJogadorId;
        const indice = estado.jogadores.findIndex(
          (jogador) => jogador.id === peca.jogadorId,
        );
        const jogador = estado.jogadores[indice];
        const equipe = equipeDoJogador(jogador?.nome ?? "", indice);
        const arrastavel = souEu && podeJogar;
        const desenho =
          desenhos.get(peca.id) ??
          posicaoVisivel(peca.posicao, RECUO_PECA, dimensoes);
        // Junto da borda de cima nao cabe nome acima do disco: vira para baixo.
        const nomeAcima = desenho.y >= FOLGA_NOME;

        return (
          <g
            key={peca.id}
            data-testid={`peca-${peca.id}`}
            data-eu={souEu ? "true" : "false"}
            data-arrastavel={arrastavel ? "true" : "false"}
            className={[
              "campo__movel",
              "campo__peca",
              indice === 0 ? "campo__peca--esquerda" : "campo__peca--direita",
              souEu ? "campo__peca--eu" : "",
              arrastavel ? "campo__peca--arrastavel" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={transformar(desenho)}
            onPointerDown={souEu ? aoPressionar : undefined}
            onPointerMove={souEu ? aoMover : undefined}
            onPointerUp={souEu ? aoSoltar : undefined}
            onPointerCancel={souEu ? aoSoltar : undefined}
          >
            {souEu && <circle r={RAIO_PECA + 0.4} className="campo__halo" />}
            <circle
              r={RAIO_PECA}
              className="campo__disco"
              fill={equipe.primaria}
              stroke={equipe.detalhe}
            />
            {/* Faixa da camisa: horizontal para o indice 0 e vertical para o
                indice 1, para as pecas seguirem distinguiveis mesmo quando os
                dois jogadores escolhem a mesma selecao. */}
            <rect
              clipPath="url(#discoPeca)"
              x={indice === 0 ? -RAIO_PECA : -0.75}
              y={indice === 0 ? -0.75 : -RAIO_PECA}
              width={indice === 0 ? RAIO_PECA * 2 : 1.5}
              height={indice === 0 ? 1.5 : RAIO_PECA * 2}
              fill={equipe.secundaria}
              opacity="0.95"
            />
            <circle r={RAIO_PECA} fill="url(#brilhoPeca)" />
            <text
              y={nomeAcima ? -RAIO_PECA - 2 : RAIO_PECA + 3.2}
              className="campo__nome"
            >
              {equipe.bandeira} {nomeExibido(jogador?.nome ?? "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Posiciona por `transform` em vez de `cx`/`cy` para que a transicao de CSS
 * anime o deslocamento entre dois estados, em vez de teletransportar a peca.
 */
function transformar(posicao: Posicao): React.CSSProperties {
  return { transform: `translate(${posicao.x}px, ${posicao.y}px)` };
}

function descreverCampo(estado: EstadoPartida, meuJogadorId: string): string {
  const partes = estado.campo.pecas.map((peca) => {
    const jogador = estado.jogadores.find((j) => j.id === peca.jogadorId);
    const quem =
      peca.jogadorId === meuJogadorId
        ? "sua peça"
        : `peça de ${jogador ? nomeExibido(jogador.nome) : "adversário"}`;
    return `${quem} em x ${peca.posicao.x.toFixed(0)}, y ${peca.posicao.y.toFixed(0)}`;
  });
  const bola = estado.campo.bola;
  return `Campo de ${estado.campo.largura} por ${estado.campo.altura} unidades. Bola em x ${bola.x.toFixed(0)}, y ${bola.y.toFixed(0)}. ${partes.join(". ")}.`;
}
