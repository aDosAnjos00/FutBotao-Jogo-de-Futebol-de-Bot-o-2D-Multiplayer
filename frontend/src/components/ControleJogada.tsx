import { useState } from "react";

import type { Jogada } from "../api/types";
import {
  FORCA_MAXIMA,
  FORCA_MINIMA,
  jogadaValida,
  limitarForca,
  normalizar,
  type PrevisaoBola,
} from "../game/geometria";

type Props = {
  meuPecaId: string;
  /** Falso quando nao e a vez, ha requisicao em voo ou a partida encerrou. */
  habilitado: boolean;
  enviando: boolean;
  onJogada: (jogada: Jogada) => void;
  /** Indice do jogador local em `jogadores`, para saber de quem e o gol. */
  meuIndice: 0 | 1;
  /**
   * Previsao da bola para a jogada montada aqui. O arraste no campo mostra a
   * trajetoria desenhada; por teclado o mesmo aviso vem em texto.
   */
  prever?: ((jogada: Jogada) => PrevisaoBola) | undefined;
};

type Direcao = { x: number; y: number; rotulo: string; seta: string };

const DIRECAO_PADRAO: Direcao = {
  x: 1,
  y: 0,
  rotulo: "direita",
  seta: "→",
};

/**
 * Grade 3x3 na ordem de leitura, equivalente ao teclado numerico. O centro e
 * `null` porque direcao (0,0) e rejeitada pelo servidor.
 */
const GRADE: (Direcao | null)[] = [
  { x: -1, y: -1, rotulo: "cima e esquerda", seta: "↖" },
  { x: 0, y: -1, rotulo: "cima", seta: "↑" },
  { x: 1, y: -1, rotulo: "cima e direita", seta: "↗" },
  { x: -1, y: 0, rotulo: "esquerda", seta: "←" },
  null,
  DIRECAO_PADRAO,
  { x: -1, y: 1, rotulo: "baixo e esquerda", seta: "↙" },
  { x: 0, y: 1, rotulo: "baixo", seta: "↓" },
  { x: 1, y: 1, rotulo: "baixo e direita", seta: "↘" },
];

export function ControleJogada({
  meuPecaId,
  habilitado,
  enviando,
  onJogada,
  meuIndice,
  prever,
}: Props) {
  const [direcao, definirDirecao] = useState<Direcao>(DIRECAO_PADRAO);
  const [forca, definirForca] = useState(50);
  const [aviso, definirAviso] = useState<string | null>(null);
  /**
   * Texto cru do campo numerico. Guardado separado da forca para o usuario
   * poder apagar e digitar: limitar a cada tecla faria "" virar 1 e os
   * digitos seguintes se concatenarem a ele.
   */
  const [textoForca, definirTextoForca] = useState("50");

  const ajustarForca = (valor: number) => {
    const limitada = limitarForca(valor);
    definirForca(limitada);
    definirTextoForca(String(limitada));
  };

  const desabilitado = !habilitado || enviando;

  const unitarioAtual = normalizar(direcao);
  const jogadaMirada: Jogada | null = unitarioAtual
    ? {
        pecaId: meuPecaId,
        direcaoX: unitarioAtual.x,
        direcaoY: unitarioAtual.y,
        forca: limitarForca(forca),
      }
    : null;
  const previsao =
    prever && jogadaMirada && habilitado ? prever(jogadaMirada) : null;

  const chutar = () => {
    const unitario = normalizar(direcao);
    if (!unitario) {
      definirAviso("Escolha uma direção antes de chutar.");
      return;
    }

    const jogada: Jogada = {
      pecaId: meuPecaId,
      direcaoX: unitario.x,
      direcaoY: unitario.y,
      forca: limitarForca(forca),
    };

    if (!jogadaValida(jogada)) {
      definirAviso("A força deve ficar entre 1 e 100.");
      return;
    }

    definirAviso(null);
    onJogada(jogada);
  };

  return (
    <section className="controle" aria-label="Controle de jogada">
      <h2 className="controle__titulo">Chute</h2>
      <p className="controle__dica">
        Arraste a sua peça no campo ou use os controles abaixo.
      </p>

      <fieldset className="controle__grupo" disabled={desabilitado}>
        <legend>Direção</legend>
        <div className="controle__rosa" role="group" aria-label="Direção do chute">
          {GRADE.map((opcao, indice) => {
            if (!opcao) {
              return (
                <span
                  key="centro"
                  className="controle__centro"
                  aria-hidden="true"
                />
              );
            }
            const ativa = opcao.x === direcao.x && opcao.y === direcao.y;
            return (
              <button
                key={indice}
                type="button"
                className={`controle__seta${ativa ? " controle__seta--ativa" : ""}`}
                aria-label={`Direção ${opcao.rotulo}`}
                aria-pressed={ativa}
                disabled={desabilitado}
                onClick={() => definirDirecao(opcao)}
              >
                {opcao.seta}
              </button>
            );
          })}
        </div>

        <label className="controle__campo">
          <span>
            Força: <strong>{forca}</strong>
          </span>
          <input
            type="range"
            min={FORCA_MINIMA}
            max={FORCA_MAXIMA}
            step={1}
            value={forca}
            disabled={desabilitado}
            aria-label="Força do chute, de 1 a 100"
            onChange={(evento) => ajustarForca(Number(evento.target.value))}
          />
        </label>

        <label className="controle__campo controle__campo--numero">
          <span>Força exata</span>
          <input
            type="number"
            min={FORCA_MINIMA}
            max={FORCA_MAXIMA}
            value={textoForca}
            disabled={desabilitado}
            aria-label="Força exata do chute"
            onChange={(evento) => {
              const texto = evento.target.value;
              definirTextoForca(texto);
              if (texto.trim() !== "") {
                const numero = Number(texto);
                if (Number.isFinite(numero)) definirForca(limitarForca(numero));
              }
            }}
            // Ao sair do campo, o texto volta a refletir a forca de fato usada.
            onBlur={() => definirTextoForca(String(forca))}
          />
        </label>
      </fieldset>

      <button
        type="button"
        className="botao botao--primario controle__chutar"
        // Rotulo fixo: o texto visivel muda durante o envio, mas o nome
        // acessivel do botao precisa ser estavel.
        aria-label="Chutar"
        disabled={desabilitado}
        onClick={chutar}
      >
        {enviando ? "Enviando…" : "Chutar"}
      </button>

      <p className="controle__estado" role="status">
        {!habilitado
          ? "Aguarde a sua vez para chutar."
          : enviando
            ? "Enviando a jogada…"
            : `Pronto para chutar para ${direcao.rotulo}, força ${forca}.`}
      </p>

      {previsao && (
        <p
          className={[
            "controle__previsao",
            previsao.indiceMarcador === meuIndice
              ? "controle__previsao--favor"
              : "",
            previsao.indiceMarcador !== null &&
            previsao.indiceMarcador !== meuIndice
              ? "controle__previsao--contra"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
          role="status"
          aria-live="polite"
        >
          {textoDaPrevisao(previsao, meuIndice)}
        </p>
      )}

      {aviso && (
        <p className="controle__aviso" role="alert">
          {aviso}
        </p>
      )}
    </section>
  );
}

function textoDaPrevisao(previsao: PrevisaoBola, meuIndice: 0 | 1): string {
  if (!previsao.toca) return "Este chute não alcança a bola.";
  if (previsao.indiceMarcador === meuIndice) return "Este chute faz gol.";
  if (previsao.indiceMarcador !== null) {
    return "Atenção: este chute faz gol contra.";
  }
  const { x, y } = previsao.destino;
  return `Este chute leva a bola para x ${x.toFixed(0)}, y ${y.toFixed(0)}.`;
}
