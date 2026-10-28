package br.com.futbotao.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class PartidaServiceTest {

    @Test
    void encerraPartidaQuandoJogadorMarcaTresGols() {
        PartidaService service = new PartidaService();

        PartidaService.EntradaPartida jogador1 =
                service.criar("Jogador 1");
        PartidaService.EntradaPartida jogador2 =
                service.entrar(jogador1.codigoPartida(), "Jogador 2");

        String peca1 = jogador1.estado().jogadores().get(0).pecaId();
        String peca2 = jogador2.estado().jogadores().get(1).pecaId();

        PartidaService.EstadoPartida estado;

        // Primeiro gol do Jogador 1.
        jogar(service, jogador1, peca1, 1, 0);
        jogar(service, jogador2, peca2, -1, 0);
        jogar(service, jogador1, peca1, 1, 0);
        jogar(service, jogador2, peca2, 1, 0);
        jogar(service, jogador1, peca1, 1, 0);
        jogar(service, jogador2, peca2, 1, 0);
        estado = jogar(service, jogador1, peca1, 1, 0);

        assertEquals(1, estado.jogadores().get(0).gols());

        // Segundo e terceiro gols. Após um gol, o turno começa no Jogador 2.
        for (int gol = 2; gol <= 3; gol++) {
            jogar(service, jogador2, peca2, 0, 1);
            jogar(service, jogador1, peca1, 1, 0);
            jogar(service, jogador2, peca2, -1, 0);
            jogar(service, jogador1, peca1, 1, 0);
            jogar(service, jogador2, peca2, 0, -1);
            jogar(service, jogador1, peca1, 1, 0);
            jogar(service, jogador2, peca2, 1, 0);
            estado = jogar(service, jogador1, peca1, 1, 0);
        }

        assertEquals("ENCERRADA", estado.situacao());
        assertEquals(3, estado.jogadores().get(0).gols());
        assertEquals(0, estado.jogadores().get(1).gols());
        assertEquals(estado.jogadores().get(0).id(), estado.vencedorId());
        assertNull(estado.jogadorDaVezId());
    }

    private PartidaService.EstadoPartida jogar(
            PartidaService service,
            PartidaService.EntradaPartida jogador,
            String pecaId,
            double direcaoX,
            double direcaoY
    ) {
        return service.fazerJogada(
                jogador.codigoPartida(),
                jogador.tokenJogador(),
                pecaId,
                direcaoX,
                direcaoY,
                100
        );
    }
}