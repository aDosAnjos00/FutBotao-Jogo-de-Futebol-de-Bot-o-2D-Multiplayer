package br.com.futbotao.controller;


import br.com.futbotao.dto.CriarJogadorRequest;
import br.com.futbotao.dto.JogadorResponse;
import br.com.futbotao.service.JogadorService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/jogadores")
public class JogadorController {

    private final JogadorService jogadorService;

    public JogadorController(JogadorService jogadorService) {
        this.jogadorService = jogadorService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JogadorResponse cadastrar(
            @Valid @RequestBody CriarJogadorRequest request) {

        return jogadorService.cadastrar(request.nome());
    }

    @GetMapping
    public List<JogadorResponse> listar() {
        return jogadorService.listar();
    }

}
