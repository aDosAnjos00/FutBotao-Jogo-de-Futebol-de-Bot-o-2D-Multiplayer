import type { Jogada } from "./api/types";
import { AvisoGol } from "./components/AvisoGol";
import { Campo } from "./components/Campo";
import { ControleJogada } from "./components/ControleJogada";
import { Placar } from "./components/Placar";
import { SalaEspera } from "./components/SalaEspera";
import { TelaFim } from "./components/TelaFim";
import { TelaInicial } from "./components/TelaInicial";
import { nomeExibido } from "./game/equipes";
import { preverBola } from "./game/geometria";
import { usePartida } from "./hooks/usePartida";

export default function App() {
  const partida = usePartida();
  const {
    sessao,
    estado,
    enviando,
    erro,
    reconectando,
    avisoGol,
    fase,
    meuJogador,
    jogadorDaVez,
    minhaVez,
    minhaPeca,
    vencedor,
    euVenci,
    podeJogar,
    criar,
    entrar,
    jogar,
    reiniciar,
    limparErro,
  } = partida;

  if (fase === "inicial" || !sessao) {
    return (
      <TelaInicial
        enviando={enviando}
        erro={erro}
        onCriar={criar}
        onEntrar={entrar}
      />
    );
  }

  if (fase === "restaurando" || !estado) {
    return (
      <main className="tela tela--carregando">
        <div className="cartao">
          <p role="status">Recuperando a partida {sessao.codigoPartida}…</p>
          {reconectando && (
            <p className="alerta" role="alert">
              Sem resposta do servidor. Confira se o backend está rodando na
              porta 8080.
            </p>
          )}
          <button type="button" className="botao botao--discreto" onClick={reiniciar}>
            Voltar ao início
          </button>
        </div>
      </main>
    );
  }

  if (fase === "aguardando") {
    return (
      <SalaEspera
        codigoPartida={estado.codigoPartida}
        meuNome={nomeExibido(meuJogador?.nome ?? "")}
        onCancelar={reiniciar}
      />
    );
  }

  // Previsao da bola para o controle por teclado, com a mesma conta que o
  // arraste no campo usa.
  const prever =
    estado && minhaPeca
      ? (jogada: Jogada) =>
          preverBola(
            estado.campo.bola,
            minhaPeca.posicao,
            jogada,
            { largura: estado.campo.largura, altura: estado.campo.altura },
            {
              inicioY: estado.campo.golInicioY,
              fimY: estado.campo.golFimY,
            },
          )
      : undefined;

  const aviso = avisoGol ? (
    <AvisoGol
      key={avisoGol.id}
      aviso={avisoGol}
      meuJogadorId={sessao.meuJogadorId}
    />
  ) : null;

  if (fase === "fim") {
    return (
      <>
        {aviso}
        <TelaFim
          estado={estado}
          meuJogadorId={sessao.meuJogadorId}
          vencedor={vencedor}
          euVenci={euVenci}
          onJogarNovamente={reiniciar}
        />
      </>
    );
  }

  return (
    <main className="tela tela--partida">
      {aviso}
      <div className="partida">
        <header className="partida__cabecalho">
          <span className="partida__codigo">
            Partida <strong>{estado.codigoPartida}</strong>
          </span>
          {reconectando && (
            <span className="selo selo--reconectando" role="status">
              Reconectando…
            </span>
          )}
        </header>

        <Placar
          estado={estado}
          meuJogadorId={sessao.meuJogadorId}
          minhaVez={minhaVez}
          jogadorDaVez={jogadorDaVez}
        />

        <Campo
          estado={estado}
          meuJogadorId={sessao.meuJogadorId}
          meuPecaId={sessao.meuPecaId}
          podeJogar={podeJogar}
          onJogada={jogar}
        />

        <ControleJogada
          meuPecaId={sessao.meuPecaId}
          meuIndice={sessao.meuIndice}
          habilitado={minhaVez}
          enviando={enviando}
          onJogada={jogar}
          prever={prever}
        />

        {erro && (
          <p className="alerta" role="alert">
            {erro}
            <button type="button" className="alerta__fechar" onClick={limparErro}>
              Fechar
            </button>
          </p>
        )}
      </div>
    </main>
  );
}
