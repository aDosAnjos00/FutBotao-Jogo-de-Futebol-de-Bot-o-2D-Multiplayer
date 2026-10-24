package br.com.futbotao.dto;

import br.com.futbotao.dto.JogadorResponse;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

@Service
public class JogadorService {

    private final List<JogadorResponse> jogadores = new ArrayList<>();
    private long proximoId = 1;

    public synchronized JogadorResponse cadastrar(String nome) {
        JogadorResponse Jogador =
                new JogadorResponse(proximoId++, nome.strip());

        jogadores.add(Jogador);
        return Jogador;
    }

    public synchronized List<JogadorResponse> listar() {
        return List.copyOf(jogadores);
    }
}
