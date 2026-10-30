import { useState } from "react";

import { EQUIPE_PADRAO, formatarNome, type Equipe } from "../game/equipes";
import { EscolhaEquipe } from "./EscolhaEquipe";

type Props = {
  enviando: boolean;
  erro: string | null;
  onCriar: (nome: string) => void;
  onEntrar: (codigo: string, nome: string) => void;
};

export function TelaInicial({ enviando, erro, onCriar, onEntrar }: Props) {
  const [nome, definirNome] = useState("");
  const [codigo, definirCodigo] = useState("");
  const [equipe, definirEquipe] = useState<Equipe>(EQUIPE_PADRAO);
  const [acao, definirAcao] = useState<"criar" | "entrar" | null>(null);

  const nomeValido = nome.trim().length > 0;
  const codigoValido = codigo.trim().length > 0;

  // A selecao viaja no nome: e o unico campo livre que o servidor guarda.
  const nomeComEquipe = () => formatarNome(nome, equipe);

  const criar = (evento: React.FormEvent) => {
    evento.preventDefault();
    definirAcao("criar");
    onCriar(nomeComEquipe());
  };

  const entrar = (evento: React.FormEvent) => {
    evento.preventDefault();
    definirAcao("entrar");
    onEntrar(codigo, nomeComEquipe());
  };

  return (
    <main className="tela tela--inicial">
      <header className="marca">
        <h1 className="marca__titulo">
          Fut<span>Botão</span>
        </h1>
        <p className="marca__legenda">
          Futebol de botão para duas pessoas. Três gols vencem a partida.
        </p>
      </header>

      <div className="cartao">
        <label className="campo-form" htmlFor="nome">
          <span>Seu nome</span>
          <input
            id="nome"
            type="text"
            value={nome}
            maxLength={24}
            autoComplete="off"
            placeholder="Como quer ser chamado?"
            disabled={enviando}
            onChange={(evento) => definirNome(evento.target.value)}
          />
        </label>

        <EscolhaEquipe
          escolhida={equipe}
          desabilitado={enviando}
          onEscolher={definirEquipe}
        />

        <form className="bloco" onSubmit={criar}>
          <h2>Criar uma partida</h2>
          <p className="bloco__texto">
            Você joga pelo lado esquerdo e recebe um código para convidar
            alguém.
          </p>
          <button
            type="submit"
            className="botao botao--primario"
            disabled={enviando || !nomeValido}
          >
            {enviando && acao === "criar" ? "Criando…" : "Criar partida"}
          </button>
        </form>

        <div className="separador" role="presentation">
          <span>ou</span>
        </div>

        <form className="bloco" onSubmit={entrar}>
          <h2>Entrar com código</h2>
          <label className="campo-form" htmlFor="codigo">
            <span>Código da partida</span>
            <input
              id="codigo"
              type="text"
              value={codigo}
              maxLength={6}
              autoComplete="off"
              spellCheck={false}
              placeholder="ABC123"
              className="campo-form__codigo"
              disabled={enviando}
              onChange={(evento) => definirCodigo(evento.target.value)}
            />
          </label>
          <button
            type="submit"
            className="botao"
            disabled={enviando || !nomeValido || !codigoValido}
          >
            {enviando && acao === "entrar" ? "Entrando…" : "Entrar na partida"}
          </button>
        </form>

        {erro && (
          <p className="alerta" role="alert">
            {erro}
          </p>
        )}
      </div>

      <p className="rodape">
        O servidor guarda as partidas apenas na memória: ao reiniciá-lo, todas
        são perdidas.
      </p>
    </main>
  );
}
