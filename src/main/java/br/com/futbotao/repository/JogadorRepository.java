package br.com.futbotao.repository;

import br.com.futbotao.model.Jogador;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JogadorRepository
        extends JpaRepository<Jogador, Long>{

}
