package br.com.futbotao.controller;

import br.com.futbotao.service.JogadorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = {
        "spring.datasource.url=jdbc:h2:mem:futbotao_test;DB_CLOSE_DELAY=-1",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@ActiveProfiles("test")
@Transactional
class JogadorControllerTests {

    @Autowired
    private JogadorService jogadorService;

    private MockMvc mvc;

    @BeforeEach
    void configurar() {
        mvc = MockMvcBuilders.standaloneSetup(
                new JogadorController(jogadorService)
        ).build();
    }

    @Test
    void cadastraEListaJogador() throws Exception {
        mvc.perform(post("/jogadores")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"nome\":\" Alisson \"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
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