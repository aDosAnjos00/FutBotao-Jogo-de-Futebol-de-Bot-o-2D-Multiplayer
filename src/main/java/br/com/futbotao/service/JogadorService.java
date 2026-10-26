package br.com.futbotao.service;

import br.com.futbotao.dto.JogadorResponse;
import br.com.futbotao.model.Jogador;
import br.com.futbotao.repository.JogadorRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@Service
public class JogadorService {

    private final JogadorRepository jogadorRepository;

    public JogadorService(JogadorRepository jogadorRepository) {
        this.jogadorRepository = jogadorRepository;
    }

    @Transactional
    public JogadorResponse cadastrar(String nome) {
        Jogador jogador = new Jogador(nome.strip());

        Jogador salvo = jogadorRepository.save(jogador);

        return new JogadorResponse(
                salvo.getId(),
                salvo.getNome()
        );
    }

    @Transactional(readOnly = true)
    public List<JogadorResponse> listar() {
        return jogadorRepository.findAll(Sort.by("id"))
                .stream()
                .map(jogador -> new JogadorResponse(
                        jogador.getId(),
                        jogador.getNome()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public JogadorResponse buscarPorId(Long id) {
        Jogador jogador = jogadorRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Jogador não encontrado"
                ));

        return new JogadorResponse(
                jogador.getId(),
                jogador.getNome()
        );
    }
}