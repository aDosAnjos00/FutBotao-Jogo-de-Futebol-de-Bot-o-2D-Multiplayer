package br.com.futbotao.model;

public class Jogador {

    private final Long id;
    private final String nome;

    public Jogador(Long id, String nome) {
        this.id = id;
        this.nome = nome;
    }

    public Long getId() {
        return id;
    }

    public String getNome() {
        return nome;
    }
}
