/**
 * Geometria do lado do cliente. Espelha as constantes de `PartidaService` para
 * poder validar uma jogada antes de enviar e desenhar a mira, mas o servidor
 * continua sendo a fonte da verdade sobre o resultado.
 */

import type { Jogada, Posicao } from "../api/types";

/** `DISTANCIA_MAXIMA_BOTAO` no servidor: forca 100 move 20 unidades. */
export const DISTANCIA_MAXIMA_PECA = 20;
export const FORCA_MINIMA = 1;
export const FORCA_MAXIMA = 100;
/** `RAIO_DE_CONTATO` no servidor. */
export const RAIO_DE_CONTATO = 2.5;
/** Fator que o servidor aplica ao trecho restante para empurrar a bola. */
export const IMPULSO_BOLA = 1.5;

/** Raio do disco da peca, em unidades logicas do campo. */
export const RAIO_PECA = 2.4;
/** Raio da bola, em unidades logicas do campo. */
export const RAIO_BOLA = 1.3;
/**
 * Raio efetivo do desenho de cada forma, incluindo contorno e destaque. E o
 * recuo necessario para a forma inteira caber dentro do campo.
 */
export const RECUO_PECA = 3.0;
export const RECUO_BOLA = 1.5;

/** Arrastos menores que isto nao definem uma direcao confiavel. */
const ARRASTE_MINIMO = 0.6;

export type Vetor = { x: number; y: number };

export function limitar(valor: number, minimo: number, maximo: number): number {
  return Math.max(minimo, Math.min(maximo, valor));
}

export function distancia(a: Vetor, b: Vetor): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/**
 * Normaliza o vetor para modulo 1. Devolve `null` quando a direcao e invalida
 * — vetor nulo ou componente nao finita —, os mesmos casos que o servidor
 * rejeita com -32006.
 */
export function normalizar(vetor: Vetor): Vetor | null {
  if (!Number.isFinite(vetor.x) || !Number.isFinite(vetor.y)) return null;
  const modulo = Math.hypot(vetor.x, vetor.y);
  if (modulo === 0) return null;
  return { x: vetor.x / modulo, y: vetor.y / modulo };
}

/** Arredonda e limita a forca ao intervalo aceito pelo servidor (1 a 100). */
export function limitarForca(forca: number): number {
  if (!Number.isFinite(forca)) return FORCA_MINIMA;
  return limitar(Math.round(forca), FORCA_MINIMA, FORCA_MAXIMA);
}

/**
 * Converte o comprimento de um arraste (em unidades logicas do campo) em
 * forca. Arrastar exatamente a distancia que a peca percorre com forca
 * maxima equivale a 100.
 */
export function forcaDoArraste(comprimento: number): number {
  return limitarForca((comprimento / DISTANCIA_MAXIMA_PECA) * FORCA_MAXIMA);
}

/** Replica a validacao de `PartidaService.validarJogada`. */
export function jogadaValida(jogada: Jogada): boolean {
  const { direcaoX, direcaoY, forca } = jogada;
  return (
    typeof jogada.pecaId === "string" &&
    jogada.pecaId.length > 0 &&
    Number.isFinite(direcaoX) &&
    Number.isFinite(direcaoY) &&
    direcaoX >= -1 &&
    direcaoX <= 1 &&
    direcaoY >= -1 &&
    direcaoY <= 1 &&
    !(direcaoX === 0 && direcaoY === 0) &&
    Number.isFinite(forca) &&
    forca >= FORCA_MINIMA &&
    forca <= FORCA_MAXIMA
  );
}

/**
 * Monta a jogada a partir de um arraste em coordenadas logicas do campo.
 * Devolve `null` se o arraste for curto demais para definir uma direcao.
 */
export function jogadaDoArraste(
  pecaId: string,
  origem: Vetor,
  destino: Vetor,
): Jogada | null {
  const bruto = { x: destino.x - origem.x, y: destino.y - origem.y };
  const comprimento = Math.hypot(bruto.x, bruto.y);
  if (comprimento < ARRASTE_MINIMO) return null;

  const direcao = normalizar(bruto);
  if (!direcao) return null;

  return {
    pecaId,
    direcaoX: direcao.x,
    direcaoY: direcao.y,
    forca: forcaDoArraste(comprimento),
  };
}

export type Retangulo = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type Dimensoes = { largura: number; altura: number };

/**
 * Converte um ponto da tela (coordenadas de ponteiro) para as coordenadas
 * logicas do campo, considerando a letra-caixa criada por
 * `preserveAspectRatio="xMidYMid meet"`: o viewBox e centralizado e escalado
 * uniformemente dentro do elemento.
 */
export function pontoDaTelaParaCampo(
  ponto: Vetor,
  retangulo: Retangulo,
  campo: Dimensoes,
): Vetor {
  if (retangulo.width <= 0 || retangulo.height <= 0) {
    return { x: 0, y: 0 };
  }

  const escala = Math.min(
    retangulo.width / campo.largura,
    retangulo.height / campo.altura,
  );
  const margemX = (retangulo.width - campo.largura * escala) / 2;
  const margemY = (retangulo.height - campo.altura * escala) / 2;

  return {
    x: (ponto.x - retangulo.left - margemX) / escala,
    y: (ponto.y - retangulo.top - margemY) / escala,
  };
}

/**
 * Onde o servidor vai parar a peca depois da jogada. Replica o clamp por eixo
 * de `PartidaService.aplicarJogada`, para que a linha de mira nao aponte para
 * fora do campo prometendo um destino impossivel.
 */
export function destinoDaJogada(
  origem: Posicao,
  jogada: Jogada,
  campo: Dimensoes,
): Posicao {
  const alcance = (DISTANCIA_MAXIMA_PECA * jogada.forca) / FORCA_MAXIMA;
  return {
    x: limitar(origem.x + jogada.direcaoX * alcance, 0, campo.largura),
    y: limitar(origem.y + jogada.direcaoY * alcance, 0, campo.altura),
  };
}

/**
 * Posicao de desenho de uma forma de raio `raio`.
 *
 * O servidor limita o *centro* da peca e da bola a borda do campo (0 a 100 e
 * 0 a 60), sem considerar o tamanho da forma: um disco de raio 2,4 com centro
 * em x = 100 seria desenhado metade para fora do gramado. Recuar o centro em
 * `raio` mantem a forma inteira dentro do campo.
 *
 * E um ajuste só de apresentacao: a posicao logica usada pelo servidor para
 * calcular contato, gol e placar continua intacta.
 */
export function posicaoVisivel(
  posicao: Posicao,
  raio: number,
  campo: Dimensoes,
): Posicao {
  return {
    x: limitar(posicao.x, raio, Math.max(raio, campo.largura - raio)),
    y: limitar(posicao.y, raio, Math.max(raio, campo.altura - raio)),
  };
}

export type FaixaGol = { inicioY: number; fimY: number };

export type PrevisaoBola = {
  /** A peca encosta na bola nesta jogada? */
  toca: boolean;
  /** Destino sem o limite do campo — e ele que decide o gol no servidor. */
  destinoBruto: Posicao;
  /** Onde a bola fica de fato, limitada ao campo, quando nao e gol. */
  destino: Posicao;
  /** Indice em `jogadores` de quem marca, ou `null` se nao for gol. */
  indiceMarcador: 0 | 1 | null;
};

/** Replica `PartidaService.verificarGol`. */
export function marcadorDoGol(
  destino: Posicao,
  campo: Dimensoes,
  gol: FaixaGol,
): 0 | 1 | null {
  if (destino.y < gol.inicioY || destino.y > gol.fimY) return null;
  if (destino.x >= campo.largura) return 0;
  if (destino.x <= 0) return 1;
  return null;
}

/**
 * Prevê o que acontece com a bola numa jogada, replicando passo a passo
 * `PartidaService.aplicarJogada`: a peca anda ate `fim` (limitado ao campo),
 * a bola e projetada sobre esse segmento e, se a distancia for <= 2,5, anda
 * `1,5x` o trecho restante na direcao do chute.
 *
 * Serve para a mira mostrar para onde a bola vai — inclusive quando o proprio
 * chute faria gol contra. Nao substitui o servidor: ele continua decidindo o
 * resultado, e e por isso que a conta aqui tem de bater exatamente com a dele.
 */
export function preverBola(
  bola: Posicao,
  origemPeca: Posicao,
  jogada: Jogada,
  campo: Dimensoes,
  gol: FaixaGol,
): PrevisaoBola {
  const semToque: PrevisaoBola = {
    toca: false,
    destinoBruto: bola,
    destino: bola,
    indiceMarcador: null,
  };

  const unitario = normalizar({ x: jogada.direcaoX, y: jogada.direcaoY });
  if (!unitario) return semToque;

  const pretendida = (DISTANCIA_MAXIMA_PECA * jogada.forca) / FORCA_MAXIMA;
  const fim = {
    x: limitar(origemPeca.x + unitario.x * pretendida, 0, campo.largura),
    y: limitar(origemPeca.y + unitario.y * pretendida, 0, campo.altura),
  };

  const segmentoX = fim.x - origemPeca.x;
  const segmentoY = fim.y - origemPeca.y;
  const comprimentoQuadrado = segmentoX * segmentoX + segmentoY * segmentoY;
  if (comprimentoQuadrado <= 0) return semToque;

  const contato = limitar(
    ((bola.x - origemPeca.x) * segmentoX +
      (bola.y - origemPeca.y) * segmentoY) /
      comprimentoQuadrado,
    0,
    1,
  );
  const pontoContato = {
    x: origemPeca.x + contato * segmentoX,
    y: origemPeca.y + contato * segmentoY,
  };
  if (distancia(bola, pontoContato) > RAIO_DE_CONTATO) return semToque;

  // A bola anda na direcao do chute, nao na do segmento (que pode ter sido
  // encurtado pela borda do campo). O servidor faz exatamente assim.
  const percorrida =
    Math.sqrt(comprimentoQuadrado) * (1 - contato) * IMPULSO_BOLA;
  const destinoBruto = {
    x: bola.x + unitario.x * percorrida,
    y: bola.y + unitario.y * percorrida,
  };

  return {
    toca: true,
    destinoBruto,
    destino: {
      x: limitar(destinoBruto.x, 0, campo.largura),
      y: limitar(destinoBruto.y, 0, campo.altura),
    },
    indiceMarcador: marcadorDoGol(destinoBruto, campo, gol),
  };
}

/**
 * Distancia minima entre os centros para os dois discos nao se sobreporem.
 * Mantido no menor valor possivel (os discos apenas se tocam) para distorcer
 * o minimo a posicao desenhada.
 */
export const SEPARACAO_PECAS = RAIO_PECA * 2;

function deslocar(posicao: Posicao, unitario: Vetor, quanto: number): Posicao {
  return {
    x: posicao.x + unitario.x * quanto,
    y: posicao.y + unitario.y * quanto,
  };
}

/**
 * Afasta duas pecas que o servidor deixou sobrepostas, para que nunca ocupem
 * o mesmo espaco no desenho.
 *
 * O `PartidaService` nao tem colisao entre pecas: as duas podem terminar na
 * mesma coordenada (observado em `55,30`) e atravessar uma a outra. Como a
 * posicao e calculada no servidor, o cliente nao pode empurrar a peca
 * adversaria de verdade — so pode deixar de desenhar uma sobre a outra.
 *
 * `a` e `b` devem vir na ordem de `estado.jogadores`, porque quando os centros
 * coincidem exatamente nao ha direcao para separar e o desempate manda cada
 * peca para o seu proprio lado do campo.
 */
export function separarPecas(
  a: Posicao,
  b: Posicao,
  campo: Dimensoes,
): [Posicao, Posicao] {
  let pa = posicaoVisivel(a, RECUO_PECA, campo);
  let pb = posicaoVisivel(b, RECUO_PECA, campo);

  const entre = distancia(pa, pb);
  if (entre >= SEPARACAO_PECAS) return [pa, pb];

  // Centros coincidentes nao definem direcao: separa na horizontal, cada um
  // para o seu lado (indice 0 joga pela esquerda, indice 1 pela direita).
  const unitario =
    normalizar({ x: pb.x - pa.x, y: pb.y - pa.y }) ?? { x: 1, y: 0 };
  const falta = SEPARACAO_PECAS - entre;

  pa = posicaoVisivel(deslocar(pa, unitario, -falta / 2), RECUO_PECA, campo);
  pb = posicaoVisivel(deslocar(pb, unitario, falta / 2), RECUO_PECA, campo);

  // Junto da borda o campo "come" parte do afastamento; o que faltou vai
  // inteiro para a outra peca, que ainda tem espaco.
  const restante = SEPARACAO_PECAS - distancia(pa, pb);
  if (restante > 1e-9) {
    pb = posicaoVisivel(deslocar(pb, unitario, restante), RECUO_PECA, campo);
    const aindaFalta = SEPARACAO_PECAS - distancia(pa, pb);
    if (aindaFalta > 1e-9) {
      pa = posicaoVisivel(deslocar(pa, unitario, -aindaFalta), RECUO_PECA, campo);
    }
  }

  return [pa, pb];
}
