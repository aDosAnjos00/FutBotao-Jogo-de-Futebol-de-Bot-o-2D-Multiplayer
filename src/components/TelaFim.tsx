import type { EstadoPartida, JogadorResumo } from "../api/types";
import { equipeDoJogador, nomeExibido } from "../game/equipes";

type Props = {
  estado: EstadoPartida;
  meuJogadorId: string;
  vencedor: JogadorResumo | undefined;
  euVenci: boolean;
  onJogarNovamente: () => void;
};

export function TelaFim({
  estado,
  meuJogadorId,
  vencedor,
  euVenci,
  onJogarNovamente,
}: Props) {
  return (
    <main className="tela tela--fim">
      <div className="cartao">
        <h1 className={euVenci ? "fim__titulo fim__titulo--vitoria" : "fim__titulo"}>
          {euVenci ? "Você ganhou!" : "Você perdeu"}
        </h1>
        <p className="bloco__texto">
          {vencedor
            ? `${nomeExibido(vencedor.nome)} chegou a ${vencedor.gols} gols.`
            : "A partida foi encerrada."}
        </p>

        <ol className="fim__placar">
          {estado.jogadores.map((jogador, indice) => {
            const equipe = equipeDoJogador(jogador.nome, indice);
            return (
              <li key={jogador.id}>
                <span>
                  <span aria-hidden="true">{equipe.bandeira}</span>{" "}
                  {nomeExibido(jogador.nome)}
                  {jogador.id === meuJogadorId && (
                    <span className="placar__eu"> (você)</span>
                  )}
                </span>
                <strong>{jogador.gols}</strong>
              </li>
            );
          })}
        </ol>

        <button
          type="button"
          className="botao botao--primario"
          onClick={onJogarNovamente}
        >
          Jogar novamente
        </button>
        <p className="rodape">
          O servidor não tem revanche: a próxima partida é criada do zero.
        </p>
      </div>
    </main>
  );
}
