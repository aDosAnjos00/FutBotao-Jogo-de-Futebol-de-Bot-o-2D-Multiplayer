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
            Jogador jogador = novoJogador(nome);
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

            Jogador jogador = novoJogador(nome);
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
            boolean participante = partida.jogadores.stream()
                    .anyMatch(jogador -> jogador.token.equals(token));

            if (!participante) {
                throw new JsonRpcException(
                        -32003,
                        "O jogador não pertence a esta partida"
                );
            }

            return criarEstado(partida);
        }
    }

    private Partida buscarPartida(String codigo) {
        Partida partida = partidas.get(codigo);
        if (partida == null) {
            throw new JsonRpcException(-32001, "Partida não encontrada");
        }
        return partida;
    }

    private Jogador novoJogador(String nome) {
        return new Jogador(
                UUID.randomUUID().toString(),
                UUID.randomUUID().toString(),
                nome
        );
    }

    private String validarTexto(String valor, String campo) {
        if (valor == null || valor.isBlank()) {
            throw new JsonRpcException(
                    -32602,
                    "Parâmetro inválido: " + campo
            );
        }
        return valor.strip();
    }

    private EstadoPartida criarEstado(Partida partida) {
        List<JogadorResumo> jogadores = partida.jogadores.stream()
                .map(jogador -> new JogadorResumo(
                        jogador.id,
                        jogador.nome,
                        jogador.gols
                ))
                .toList();

        return new EstadoPartida(
                partida.codigo,
                partida.situacao,
                jogadores,
                partida.jogadorDaVezId,
                partida.vencedorId
        );
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
            String vencedorId
    ) {
    }

    public record JogadorResumo(String id, String nome, int gols) {
    }

    private static final class Partida {
        private final String codigo;
        private final List<Jogador> jogadores = new ArrayList<>();
        private String situacao = "AGUARDANDO_JOGADOR";
        private String jogadorDaVezId;
        private String vencedorId;

        private Partida(String codigo) {
            this.codigo = codigo;
        }
    }

    private static final class Jogador {
        private final String id;
        private final String token;
        private final String nome;
        private int gols;

        private Jogador(String id, String token, String nome) {
            this.id = id;
            this.token = token;
            this.nome = nome;
        }
    }
}
