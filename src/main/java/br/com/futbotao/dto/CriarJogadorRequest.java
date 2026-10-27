package br.com.futbotao.dto;

import jakarta.validation.constraints.NotBlank;

public record CriarJogadorRequest(
        @NotBlank(message = "O nome é obrigatório")
        String nome
) {
}