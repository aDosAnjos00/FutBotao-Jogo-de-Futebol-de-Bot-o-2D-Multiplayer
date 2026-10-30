import type { EstadoPartida, JogadorResumo } from "../api/types";
import { equipeDoJogador, nomeExibido } from "../game/equipes";

type Props = {
  estado: EstadoPartida;
  meuJogadorId: string;
  minhaVez: boolean;
  jogadorDaVez: JogadorResumo | undefined;
};

export function Placar({
  estado,
  meuJogadorId,
  minhaVez,
  jogadorDaVez,
}: Props) {
  const aviso =
    estado.situacao === "ENCERRADA"
      ? "Partida encerrada"
      : minhaVez
        ? "Sua vez"
        : jogadorDaVez
          ? `Vez de ${nomeExibido(jogadorDaVez.nome)}`
          : "Aguardando";

  return (
    <section className="placar" aria-label="Placar">
      <ol className="placar__lista">
        {estado.jogadores.map((jogador, indice) => {
          const souEu = jogador.id === meuJogadorId;
          const daVez = jogador.id === estado.jogadorDaVezId;
          const equipe = equipeDoJogador(jogador.nome, indice);
          return (
            <li
              key={jogador.id}
              className={[
                "placar__item",
                indice === 0 ? "placar__item--esquerda" : "placar__item--direita",
                daVez ? "placar__item--vez" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ borderLeftColor: equipe.primaria }}
            >
              <span className="placar__nome">
                <span className="placar__bandeira" aria-hidden="true">
                  {equipe.bandeira}
                </span>{" "}
                {nomeExibido(jogador.nome)}
                {souEu && <span className="placar__eu"> (você)</span>}
                <span className="placar__equipe">{equipe.nome}</span>
              </span>
              <span className="placar__gols" aria-label={`${jogador.gols} gols`}>
                {jogador.gols}
              </span>
            </li>
          );
        })}
      </ol>

      <p
        className={`placar__vez${minhaVez ? " placar__vez--minha" : ""}`}
        role="status"
        aria-live="polite"
      >
        {aviso}
      </p>
    </section>
  );
}
