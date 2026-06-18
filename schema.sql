CREATE DATABASE IF NOT EXISTS biblioteca
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE biblioteca;

CREATE TABLE IF NOT EXISTS usuarios (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(150)        NOT NULL,
  email     VARCHAR(150)        NOT NULL UNIQUE,
  senha     VARCHAR(255)        NOT NULL,
  perfil    ENUM('bibliotecario', 'leitor') NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS livros (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  titulo                 VARCHAR(200) NOT NULL,
  autor                  VARCHAR(150) NOT NULL,
  ano_publicacao         INT NULL,
  quantidade_disponivel  INT NOT NULL DEFAULT 0,
  criado_em              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS emprestimos (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  livro_id                INT NOT NULL,
  leitor_id               INT NOT NULL,
  data_emprestimo         DATE NOT NULL,
  data_devolucao_prevista DATE NOT NULL,
  data_devolucao_real     DATE NULL,
  status                  ENUM('ativo', 'pendente_devolucao', 'devolvido', 'atrasado')
                             NOT NULL DEFAULT 'ativo',
  criado_em               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_emprestimo_livro
    FOREIGN KEY (livro_id) REFERENCES livros(id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_emprestimo_leitor
    FOREIGN KEY (leitor_id) REFERENCES usuarios(id)
    ON DELETE RESTRICT
);

INSERT INTO livros (titulo, autor, ano_publicacao, quantidade_disponivel) VALUES
  ('O Senhor dos Anéis', 'J. R. R. Tolkien', 1954, 3),
  ('1984', 'George Orwell', 1949, 5),
  ('Clean Code', 'Robert C. Martin', 2008, 2);