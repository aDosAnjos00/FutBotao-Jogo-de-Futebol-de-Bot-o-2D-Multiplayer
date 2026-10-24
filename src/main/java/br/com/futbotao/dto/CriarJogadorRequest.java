package br.com.futbotao.dto;

import jakarta.validation.constraints.NotBlank;

public record CriarJogadorRequest(
        @NotBlank String nome
) {
}