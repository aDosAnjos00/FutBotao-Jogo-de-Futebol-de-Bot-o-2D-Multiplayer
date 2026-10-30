import { useState } from "react";

type Props = {
  codigoPartida: string;
  meuNome: string;
  onCancelar: () => void;
};

export function SalaEspera({ codigoPartida, meuNome, onCancelar }: Props) {
  const [copiado, definirCopiado] = useState(false);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigoPartida);
      definirCopiado(true);
      setTimeout(() => definirCopiado(false), 2000);
    } catch {
      // Sem permissao de clipboard: o codigo segue visivel para copiar a mao.
      definirCopiado(false);
    }
  };

  return (
    <main className="tela tela--espera">
      <div className="cartao">
        <h1>Aguardando o segundo jogador</h1>
        <p className="bloco__texto">
          Olá, {meuNome}. Compartilhe o código abaixo para a outra pessoa
          entrar.
        </p>

        <div className="codigo" aria-live="polite">
          <span className="codigo__valor" aria-label={`Código da partida: ${codigoPartida.split("").join(" ")}`}>
            {codigoPartida}
          </span>
          <button type="button" className="botao" onClick={copiar}>
            {copiado ? "Copiado!" : "Copiar"}
          </button>
        </div>

        <p className="espera__pulso" role="status">
          <span className="espera__ponto" aria-hidden="true" />
          A partida começa sozinha assim que alguém entrar.
        </p>

        <button type="button" className="botao botao--discreto" onClick={onCancelar}>
          Cancelar e voltar
        </button>
      </div>
    </main>
  );
}
