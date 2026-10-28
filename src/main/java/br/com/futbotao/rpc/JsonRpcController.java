package br.com.futbotao.rpc;

import br.com.futbotao.service.PartidaService;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
public class JsonRpcController {

    private final PartidaService partidaService;

    public JsonRpcController(PartidaService partidaService) {
        this.partidaService = partidaService;
    }

    @PostMapping(
            path = "/rpc",
            consumes = MediaType.APPLICATION_JSON_VALUE,
            produces = MediaType.APPLICATION_JSON_VALUE
    )
    public Map<String, Object> processar(@RequestBody Map<String, Object> requisicao) {
        Object id = requisicao.get("id");

        try {
            validarRequisicao(requisicao, id);
            Map<String, Object> parametros = obterParametros(requisicao);
            Object resultado = executar(
                    (String) requisicao.get("method"),
                    parametros
            );
            return respostaSucesso(resultado, id);
        } catch (JsonRpcException erro) {
            return respostaErro(erro.getCodigo(), erro.getMessage(), id);
        }
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public Map<String, Object> tratarJsonInvalido(
            HttpMessageNotReadableException erro
    ) {
        return respostaErro(-32700, "Erro ao interpretar a requisição JSON", null);
    }

    @ExceptionHandler(Exception.class)
    public Map<String, Object> tratarErroInterno(Exception erro) {
        return respostaErro(-32603, "Erro interno do servidor", null);
    }

    private void validarRequisicao(Map<String, Object> requisicao, Object id) {
        if (!"2.0".equals(requisicao.get("jsonrpc"))) {
            throw new JsonRpcException(-32600, "Requisição inválida");
        }

        Object metodo = requisicao.get("method");
        if (!(metodo instanceof String texto) || texto.isBlank()) {
            throw new JsonRpcException(-32600, "Requisição inválida");
        }

        if (!(id instanceof String || id instanceof Number)) {
            throw new JsonRpcException(-32600, "Requisição inválida");
        }
    }

    private Map<String, Object> obterParametros(Map<String, Object> requisicao) {
        Object parametros = requisicao.get("params");
        if (!(parametros instanceof Map<?, ?> mapa)) {
            throw new JsonRpcException(
                    -32602,
                    "Os parâmetros devem ser enviados como objeto JSON"
            );
        }

        Map<String, Object> resultado = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entrada : mapa.entrySet()) {
            if (!(entrada.getKey() instanceof String chave)) {
                throw new JsonRpcException(-32602, "Parâmetros inválidos");
            }
            resultado.put(chave, entrada.getValue());
        }
        return resultado;
    }

    private Object executar(String metodo, Map<String, Object> parametros) {
        return switch (metodo) {
            case "partida.criar" -> partidaService.criar(
                    textoObrigatorio(parametros, "nomeJogador")
            );
            case "partida.entrar" -> partidaService.entrar(
                    textoObrigatorio(parametros, "codigoPartida"),
                    textoObrigatorio(parametros, "nomeJogador")
            );
            case "partida.obterEstado" -> partidaService.obterEstado(
                    textoObrigatorio(parametros, "codigoPartida"),
                    textoObrigatorio(parametros, "tokenJogador")
            );
            case "partida.fazerJogada" -> partidaService.fazerJogada(
                    textoObrigatorio(parametros, "codigoPartida"),
                    textoObrigatorio(parametros, "tokenJogador"),
                    textoObrigatorio(parametros, "jogada.pecaId"),
                    numeroObrigatorio(parametros, "jogada.direcaoX"),
                    numeroObrigatorio(parametros, "jogada.direcaoY"),
                    numeroObrigatorio(parametros, "jogada.forca")
            );
            default -> throw new JsonRpcException(-32601, "Método não encontrado");
        };
    }

    private String textoObrigatorio(Map<String, Object> parametros, String nome) {
        Object valor = obterValor(parametros, nome);
        if (!(valor instanceof String texto) || texto.isBlank()) {
            throw new JsonRpcException(-32602, "Parâmetro inválido: " + nome);
        }
        return texto;
    }

    private double numeroObrigatorio(Map<String, Object> parametros, String nome) {
        Object valor = obterValor(parametros, nome);
        if (!(valor instanceof Number numero)) {
            throw new JsonRpcException(-32602, "Parâmetro inválido: " + nome);
        }
        return numero.doubleValue();
    }

    private Object obterValor(Map<String, Object> parametros, String nome) {
        if (nome.startsWith("jogada.")) {
            Object jogada = parametros.get("jogada");
            if (jogada instanceof Map<?, ?> mapa) {
                return mapa.get(nome.substring("jogada.".length()));
            }
            return null;
        }
        return parametros.get(nome);
    }

    private Map<String, Object> respostaSucesso(Object resultado, Object id) {
        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("jsonrpc", "2.0");
        resposta.put("result", resultado);
        resposta.put("id", id);
        return resposta;
    }

    private Map<String, Object> respostaErro(int codigo, String mensagem, Object id) {
        Map<String, Object> erro = new LinkedHashMap<>();
        erro.put("code", codigo);
        erro.put("message", mensagem);

        Map<String, Object> resposta = new LinkedHashMap<>();
        resposta.put("jsonrpc", "2.0");
        resposta.put("error", erro);
        resposta.put("id", id);
        return resposta;
    }
}
