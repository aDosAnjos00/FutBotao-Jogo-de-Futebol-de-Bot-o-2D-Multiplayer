package br.com.futbotao.service;

import br.com.futbotao.dto.JogadorResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class JogadorService {

    private final List<JogadorResponse> jogadores = new ArrayList<>();
    private long proximoId = 1;

    public synchronized JogadorResponse cadastrar(String nome) {
        JogadorResponse jogador =
                new JogadorResponse(proximoId++, nome.strip());

        jogadores.add(jogador);
        return jogador;
    }

    public synchronized List<JogadorResponse> listar() {
        return List.copyOf(jogadores);
    }
}
