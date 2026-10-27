package br.com.futbotao.exception;


import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErroResponse> tratarValidacao(
            MethodArgumentNotValidException exception) {

        Map<String, String> campos = new LinkedHashMap<>();

        exception.getBindingResult()
                .getFieldErrors()
                .forEach(erro -> campos.put(
                        erro.getField(),
                        erro.getDefaultMessage()
                ));

        ErroResponse resposta = new ErroResponse(
                400,
                "Dados inválidos",
                campos
        );

        return ResponseEntity.badRequest().body(resposta);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ErroResponse> tratarStatus(
            ResponseStatusException exception) {

        String mensagem = exception.getReason() != null
                ? exception.getReason()
                : "Não foi possivel realizar a operação";

        ErroResponse resposta = new ErroResponse(
                exception.getStatusCode().value(),
                mensagem,
                Map.of()
        );

        return ResponseEntity
                .status(exception.getStatusCode())
                .body(resposta);
    }

}
