package br.com.futbotao.service;

import br.com.futbotao.rpc.JsonRpcException;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class PartidaService {

    private static final int MAXIMO_JOGADORES = 2;
    private static final int GOLS_PARA_VENCER = 3;
    private static final double LARGURA_CAMPO = 100.0;
    private static final double ALTURA_CAMPO = 60.0;
    private static final double GOL_MIN_Y = 25.0;
    private static final double GOL_MAX_Y = 35.0;
    private static final double DISTANCIA_MAXIMA_BOTAO = 20.0;
    private static final double RAIO_DE_CONTATO = 2.5;

    private final ConcurrentMap<String, Partida> partidas = new ConcurrentHashMap<>();

    public EntradaPartida criar(String nomeJogador) {
        String nome = validarTexto(nomeJogador, "nomeJogador");

        while (true) {
            String codigo = UUID.randomUUID()
                    .toString()
                    .replace("-", "")
                    .substring(0, 6)
                    .toUpperCase(Locale.ROOT);

            Partida partida = new Partida(codigo);
            Jogador jogador = novoJogador(nome, 0);
            partida.jogadores.add(jogador);

            if (partidas.putIfAbsent(codigo, partida) == null) {
                return new EntradaPartida(
                        codigo,
                        jogador.token,
                        criarEstado(partida)
                );
            }
        }
    }

    public EntradaPartida entrar(String codigoPartida, String nomeJogador) {
        String codigo = validarTexto(codigoPartida, "codigoPartida")
                .toUpperCase(Locale.ROOT);
        String nome = validarTexto(nomeJogador, "nomeJogador");
        Partida partida = buscarPartida(codigo);

        synchronized (partida) {
            if (partida.jogadores.size() >= MAXIMO_JOGADORES) {
                throw new JsonRpcException(-32002, "A partida já está cheia");
            }

            Jogador jogador = novoJogador(nome, 1);
            partida.jogadores.add(jogador);
            partida.situacao = "EM_ANDAMENTO";
            partida.jogadorDaVezId = partida.jogadores.get(0).id;

            return new EntradaPartida(
                    codigo,
                    jogador.token,
                    criarEstado(partida)
            );
        }
    }

    public EstadoPartida obterEstado(String codigoPartida, String tokenJogador) {
        String codigo = validarTexto(codigoPartida, "codigoPartida")
                .toUpperCase(Locale.ROOT);
        String token = validarTexto(tokenJogador, "tokenJogador");
        Partida partida = buscarPartida(codigo);

        synchronized (partida) {
            Jogador jogador = buscarJogadorPorToken(partida, token);
            if (jogador == null) {
                throw new JsonRpcException(
                        -32003,
                        "O jogador não pertence a esta partida"
                );
            }

            return criarEstado(partida);
        }
    }

    public EstadoPartida fazerJogada(
            String codigoPartida,
            String tokenJogador,
            String pecaId,
            double direcaoX,
            double direcaoY,
            double forca
    ) {
        String codigo = validarTexto(codigoPartida, "codigoPartida")
                .toUpperCase(Locale.ROOT);
        String token = validarTexto(tokenJogador, "tokenJogador");
        String peca = validarTexto(pecaId, "pecaId");
        validarJogada(direcaoX, direcaoY, forca);

        Partida partida = buscarPartida(codigo);

        synchronized (partida) {
            if ("AGUARDANDO_JOGADOR".equals(partida.situacao)) {
                throw new JsonRpcException(-32004, "A partida ainda não começou");
            }
            if ("ENCERRADA".equals(partida.situacao)) {
                throw new JsonRpcException(-32007, "A partida já foi encerrada");
            }

            Jogador jogador = buscarJogadorPorToken(partida, token);
            if (jogador == null) {
                throw new JsonRpcException(
                        -32003,
                        "O jogador não pertence a esta partida"
                );
            }
            if (!jogador.id.equals(partida.jogadorDaVezId)) {
                throw new JsonRpcException(-32005, "Não é a vez deste jogador");
            }
            if (!jogador.pecaId.equals(peca)) {
                throw new JsonRpcException(
                        -32006,
                        "A peça informada não pertence a este jogador"
                );
            }

            aplicarJogada(partida, jogador, direcaoX, direcaoY, forca);
            return criarEstado(partida);
        }
    }

    private void aplicarJogada(
            Partida partida,
            Jogador jogador,
            double direcaoX,
            double direcaoY,
            double forca
    ) {
        double modulo = Math.hypot(direcaoX, direcaoY);
        double vetorX = direcaoX / modulo;
        double vetorY = direcaoY / modulo;
        double distanciaPretendida = DISTANCIA_MAXIMA_BOTAO * forca / 100.0;

        double inicioX = jogador.x;
        double inicioY = jogador.y;
        double fimX = limitar(inicioX + vetorX * distanciaPretendida, 0.0, LARGURA_CAMPO);
        double fimY = limitar(inicioY + vetorY * distanciaPretendida, 0.0, ALTURA_CAMPO);
        double segmentoX = fimX - inicioX;
        double segmentoY = fimY - inicioY;
        double comprimentoQuadrado = segmentoX * segmentoX + segmentoY * segmentoY;

        jogador.x = fimX;
        jogador.y = fimY;

        if (comprimentoQuadrado > 0.0) {
            double contato = ((partida.bolaX - inicioX) * segmentoX
                    + (partida.bolaY - inicioY) * segmentoY) / comprimentoQuadrado;
            contato = limitar(contato, 0.0, 1.0);

            double pontoContatoX = inicioX + contato * segmentoX;
            double pontoContatoY = inicioY + contato * segmentoY;
            double distanciaContato = Math.hypot(
                    partida.bolaX - pontoContatoX,
                    partida.bolaY - pontoContatoY
            );

            if (distanciaContato <= RAIO_DE_CONTATO) {
                double comprimentoSegmento = Math.sqrt(comprimentoQuadrado);
                double distanciaBola = (comprimentoSegmento * (1.0 - contato)) * 1.5;
                double destinoX = partida.bolaX + vetorX * distanciaBola;
                double destinoY = partida.bolaY + vetorY * distanciaBola;
                Jogador marcador = verificarGol(partida, destinoX, destinoY);

                if (marcador != null) {
                    registrarGol(partida, marcador, jogador);
                } else {
                    partida.bolaX = limitar(destinoX, 0.0, LARGURA_CAMPO);
                    partida.bolaY = limitar(destinoY, 0.0, ALTURA_CAMPO);
                }
            }
        }

        if (!"ENCERRADA".equals(partida.situacao)) {
            partida.jogadorDaVezId = proximoJogador(partida, jogador).id;
        }
    }

    private Jogador verificarGol(Partida partida, double destinoX, double destinoY) {
        if (destinoY < GOL_MIN_Y || destinoY > GOL_MAX_Y) {
            return null;
        }
        if (destinoX >= LARGURA_CAMPO) {
            return partida.jogadores.get(0);
        }
        if (destinoX <= 0.0) {
            return partida.jogadores.get(1);
        }
        return null;
    }

    private void registrarGol(Partida partida, Jogador marcador, Jogador jogadorDaJogada) {
        marcador.gols++;
        partida.bolaX = LARGURA_CAMPO / 2.0;
        partida.bolaY = ALTURA_CAMPO / 2.0;

        if (marcador.gols >= GOLS_PARA_VENCER) {
            partida.situacao = "ENCERRADA";
            partida.vencedorId = marcador.id;
            partida.jogadorDaVezId = null;
            return;
        }

        for (int i = 0; i < partida.jogadores.size(); i++) {
            Jogador jogador = partida.jogadores.get(i);
            jogador.x = i == 0 ? 25.0 : 75.0;
            jogador.y = ALTURA_CAMPO / 2.0;
        }
        partida.jogadorDaVezId = proximoJogador(partida, jogadorDaJogada).id;
    }

    private Jogador proximoJogador(Partida partida, Jogador atual) {
        return partida.jogadores.stream()
                .filter(jogador -> !jogador.id.equals(atual.id))
                .findFirst()
                .orElseThrow(() -> new JsonRpcException(
                        -32004,
                        "A partida ainda não começou"
                ));
    }

    private void validarJogada(double direcaoX, double direcaoY, double forca) {
        if (!Double.isFinite(direcaoX) || !Double.isFinite(direcaoY)
                || direcaoX < -1.0 || direcaoX > 1.0
                || direcaoY < -1.0 || direcaoY > 1.0
                || (direcaoX == 0.0 && direcaoY == 0.0)
                || !Double.isFinite(forca) || forca < 1.0 || forca > 100.0) {
            throw new JsonRpcException(-32006, "Jogada inválida");
        }
    }

    private Jogador buscarJogadorPorToken(Partida partida, String token) {
        return partida.jogadores.stream()
                .filter(jogador -> jogador.token.equals(token))
                .findFirst()
                .orElse(null);
    }

    private Partida buscarPartida(String codigo) {
        Partida partida = partidas.get(codigo);
        if (partida == null) {
            throw new JsonRpcException(-32001, "Partida não encontrada");
        }
        return partida;
    }

    private Jogador novoJogador(String nome, int posicao) {
        return new Jogador(
                UUID.randomUUID().toString(),
                UUID.randomUUID().toString(),
                UUID.randomUUID().toString(),
                nome,
                posicao == 0 ? 25.0 : 75.0,
                ALTURA_CAMPO / 2.0
        );
    }

    private String validarTexto(String valor, String campo) {
        if (valor == null || valor.isBlank()) {
            throw new JsonRpcException(-32602, "Parâmetro inválido: " + campo);
        }
        return valor.strip();
    }

    private EstadoPartida criarEstado(Partida partida) {
        List<JogadorResumo> jogadores = partida.jogadores.stream()
                .map(jogador -> new JogadorResumo(
                        jogador.id,
                        jogador.nome,
                        jogador.pecaId,
                        jogador.gols
                ))
                .toList();

        List<PecaResumo> pecas = partida.jogadores.stream()
                .map(jogador -> new PecaResumo(
                        jogador.pecaId,
                        jogador.id,
                        new Posicao(jogador.x, jogador.y)
                ))
                .toList();

        Campo campo = new Campo(
                LARGURA_CAMPO,
                ALTURA_CAMPO,
                GOL_MIN_Y,
                GOL_MAX_Y,
                new Posicao(partida.bolaX, partida.bolaY),
                pecas
        );

        return new EstadoPartida(
                partida.codigo,
                partida.situacao,
                jogadores,
                partida.jogadorDaVezId,
                partida.vencedorId,
                campo
        );
    }

    private double limitar(double valor, double minimo, double maximo) {
        return Math.max(minimo, Math.min(maximo, valor));
    }

    public record EntradaPartida(
            String codigoPartida,
            String tokenJogador,
            EstadoPartida estado
    ) {
    }

    public record EstadoPartida(
            String codigoPartida,
            String situacao,
            List<JogadorResumo> jogadores,
            String jogadorDaVezId,
            String vencedorId,
            Campo campo
    ) {
    }

    public record JogadorResumo(String id, String nome, String pecaId, int gols) {
    }

    public record Campo(
            double largura,
            double altura,
            double golInicioY,
            double golFimY,
            Posicao bola,
            List<PecaResumo> pecas
    ) {
    }

    public record Posicao(double x, double y) {
    }

    public record PecaResumo(String id, String jogadorId, Posicao posicao) {
    }

    private static final class Partida {
        private final String codigo;
        private final List<Jogador> jogadores = new ArrayList<>();
        private String situacao = "AGUARDANDO_JOGADOR";
        private String jogadorDaVezId;
        private String vencedorId;
        private double bolaX = LARGURA_CAMPO / 2.0;
        private double bolaY = ALTURA_CAMPO / 2.0;

        private Partida(String codigo) {
            this.codigo = codigo;
        }
    }

    private static final class Jogador {
        private final String id;
        private final String token;
        private final String pecaId;
        private final String nome;
        private int gols;
        private double x;
        private double y;

        private Jogador(
                String id,
                String token,
                String pecaId,
                String nome,
                double x,
                double y
        ) {
            this.id = id;
            this.token = token;
            this.pecaId = pecaId;
            this.nome = nome;
            this.x = x;
            this.y = y;
        }
    }
}
