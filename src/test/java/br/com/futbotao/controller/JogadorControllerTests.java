package br.com.futbotao.controller;

import br.com.futbotao.exception.ApiExceptionHandler;
import br.com.futbotao.service.JogadorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class JogadorControllerTests {

    private JogadorService jogadorService;
    private MockMvc mvc;

    @BeforeEach
    void configurar() {
        jogadorService = new JogadorService();
        mvc = MockMvcBuilders.standaloneSetup(
                new JogadorController(jogadorService)
        )
                .setControllerAdvice(new ApiExceptionHandler())
                .build();
    }

    @Test
    void cadastraEListaJogador() throws Exception {
        mvc.perform(post("/jogadores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\" Jogador 1 \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.nome").value("Jogador 1"));

        mvc.perform(get("/jogadores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].nome").value("Jogador 1"));
    }

    @Test
    void rejeitaNomeEmBrancoSemCadastrar() throws Exception {
        mvc.perform(post("/jogadores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"   \"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.mensagem").value("Dados inválidos"))
                .andExpect(jsonPath("$.campos.nome").value("O nome é obrigatório"));

        mvc.perform(get("/jogadores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void retornaErroPadronizadoParaJogadorInexistente() throws Exception {
        mvc.perform(get("/jogadores/{id}", Long.MAX_VALUE))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.mensagem")
                        .value("Jogador não encontrado"));
    }
}
