import { equipeDoJogador, nomeExibido } from "../game/equipes";
import type { AvisoGol as Aviso } from "../hooks/usePartida";

type Props = {
  aviso: Aviso;
  /** Para dizer "você marcou" em vez do nome. */
  meuJogadorId: string;
};

export function AvisoGol({ aviso, meuJogadorId }: Props) {
  const fuiEu = aviso.jogadorId === meuJogadorId;
  const equipe = equipeDoJogador(aviso.nomeBruto, aviso.indice);
  const nome = nomeExibido(aviso.nomeBruto);

  const titulo = fuiEu ? "GOL!" : "GOL DO ADVERSÁRIO";
  const detalhe = fuiEu
    ? `Você marcou — ${aviso.gols} ${aviso.gols === 1 ? "gol" : "gols"}`
    : `${nome} marcou — ${aviso.gols} ${aviso.gols === 1 ? "gol" : "gols"}`;

  return (
    <div
      // `key` no App reinicia a animacao a cada gol.
      className={`aviso-gol${fuiEu ? " aviso-gol--meu" : " aviso-gol--contra"}`}
      role="alert"
      aria-live="assertive"
    >
      <div
        className="aviso-gol__cartao"
        style={{
          borderColor: equipe.primaria,
          boxShadow: `0 0 0 2px ${equipe.detalhe}, 0 18px 50px rgb(0 0 0 / 55%)`,
        }}
      >
        <span className="aviso-gol__bandeira" aria-hidden="true">
          {equipe.bandeira}
        </span>
        <strong className="aviso-gol__titulo">{titulo}</strong>
        <span className="aviso-gol__detalhe">{detalhe}</span>
        <span className="aviso-gol__equipe" style={{ color: equipe.primaria }}>
          {equipe.nome}
        </span>
        {aviso.decisivo && (
          <span className="aviso-gol__decisivo">Gol que encerra a partida</span>
        )}
      </div>
    </div>
  );
}
