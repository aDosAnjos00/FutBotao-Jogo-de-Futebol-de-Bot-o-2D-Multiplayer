package br.com.futbotao.rpc;

public class JsonRpcException extends RuntimeException {

    private final int codigo;

    public JsonRpcException(int codigo, String mensagem) {
        super(mensagem);
        this.codigo = codigo;
    }

    public int getCodigo() {
        return codigo;
    }
}
