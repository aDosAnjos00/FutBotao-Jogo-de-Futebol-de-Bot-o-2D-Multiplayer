package br.com.futbotao.controller;

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

    private MockMvc mvc;

    @BeforeEach
    void configurar() {
        mvc = MockMvcBuilders.standaloneSetup(
                new JogadorController(new JogadorService())).build();
    }

    @Test
    void cadastraEListaJogador() throws Exception {
        mvc.perform(post("/jogadores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\" Alisson \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1))
                .andExpect(jsonPath("$.nome").value("Alisson"));

        mvc.perform(get("/jogadores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].nome").value("Alisson"));
    }

    @Test
    void rejeitaNomeEmBrancoSemCadastrar() throws Exception {
        mvc.perform(post("/jogadores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\"   \"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(get("/jogadores"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }
}
