import { EQUIPES, type Equipe } from "../game/equipes";

type Props = {
  escolhida: Equipe;
  desabilitado: boolean;
  onEscolher: (equipe: Equipe) => void;
};

export function EscolhaEquipe({ escolhida, desabilitado, onEscolher }: Props) {
  return (
    <fieldset className="equipes" disabled={desabilitado}>
      <legend>Sua seleção</legend>
      <div className="equipes__lista" role="radiogroup" aria-label="Seleção">
        {EQUIPES.map((equipe) => {
          const ativa = equipe.codigo === escolhida.codigo;
          return (
            <button
              key={equipe.codigo}
              type="button"
              role="radio"
              aria-checked={ativa}
              aria-label={equipe.nome}
              className={`equipes__item${ativa ? " equipes__item--ativa" : ""}`}
              disabled={desabilitado}
              onClick={() => onEscolher(equipe)}
            >
              <span className="equipes__bandeira" aria-hidden="true">
                {equipe.bandeira}
              </span>
              <span className="equipes__nome">{equipe.nome}</span>
              <span
                className="equipes__cores"
                aria-hidden="true"
                style={{
                  background: `linear-gradient(90deg, ${equipe.primaria} 0 50%, ${equipe.secundaria} 50% 100%)`,
                  borderColor: equipe.detalhe,
                }}
              />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
