package br.com.futbotao.service;

import br.com.futbotao.dto.JogadorResponse;
import br.com.futbotao.model.Jogador;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class JogadorService {

    private final Map<Long, Jogador> jogadores = new ConcurrentHashMap<>();
    private final AtomicLong proximoId = new AtomicLong();

    public JogadorResponse cadastrar(String nome) {
        Jogador jogador = new Jogador(
                proximoId.incrementAndGet(),
                nome.strip()
        );
        jogadores.put(jogador.getId(), jogador);

        return converter(jogador);
    }

    public List<JogadorResponse> listar() {
        return jogadores.values()
                .stream()
                .sorted(Comparator.comparing(Jogador::getId))
                .map(this::converter)
                .toList();
    }

    public JogadorResponse buscarPorId(Long id) {
        Jogador jogador = jogadores.get(id);
        if (jogador == null) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Jogador não encontrado"
            );
        }

        return converter(jogador);
    }

    private JogadorResponse converter(Jogador jogador) {
        return new JogadorResponse(jogador.getId(), jogador.getNome());
    }
}
