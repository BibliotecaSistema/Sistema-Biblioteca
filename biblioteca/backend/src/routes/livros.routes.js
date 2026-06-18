const express = require('express');
const pool = require('../config/db');
const { autenticar, autorizar } = require('../middleware/auth');

const router = express.Router();

// Todas as rotas de livros exigem usuário autenticado (bibliotecário ou leitor).
router.use(autenticar);

/**
 * GET /api/livros
 * Lista todos os livros do catálogo. Acessível a qualquer usuário logado.
 */
router.get('/', async (req, res) => {
  try {
    const [livros] = await pool.query('SELECT * FROM livros ORDER BY titulo');
    return res.json(livros);
  } catch (erro) {
    console.error('Erro ao listar livros:', erro);
    return res.status(500).json({ erro: 'Erro interno ao listar livros.' });
  }
});

/**
 * GET /api/livros/:id
 * Detalhes de um livro específico.
 */
router.get('/:id', async (req, res) => {
  try {
    const [livros] = await pool.query('SELECT * FROM livros WHERE id = ?', [req.params.id]);
    if (livros.length === 0) {
      return res.status(404).json({ erro: 'Livro não encontrado.' });
    }
    return res.json(livros[0]);
  } catch (erro) {
    console.error('Erro ao buscar livro:', erro);
    return res.status(500).json({ erro: 'Erro interno ao buscar livro.' });
  }
});

/**
 * POST /api/livros
 * Cria um novo livro. Restrito a bibliotecários.
 * Body: { titulo, autor, ano_publicacao, quantidade_disponivel }
 */
router.post('/', autorizar('bibliotecario'), async (req, res) => {
  try {
    const { titulo, autor, ano_publicacao, quantidade_disponivel } = req.body;

    if (!titulo || !autor || quantidade_disponivel === undefined) {
      return res.status(400).json({ erro: 'Preencha título, autor e quantidade disponível.' });
    }

    const [resultado] = await pool.query(
      'INSERT INTO livros (titulo, autor, ano_publicacao, quantidade_disponivel) VALUES (?, ?, ?, ?)',
      [titulo, autor, ano_publicacao || null, quantidade_disponivel]
    );

    return res.status(201).json({
      mensagem: 'Livro cadastrado com sucesso.',
      livro: { id: resultado.insertId, titulo, autor, ano_publicacao, quantidade_disponivel },
    });
  } catch (erro) {
    console.error('Erro ao cadastrar livro:', erro);
    return res.status(500).json({ erro: 'Erro interno ao cadastrar livro.' });
  }
});

/**
 * PUT /api/livros/:id
 * Atualiza um livro existente. Restrito a bibliotecários.
 */
router.put('/:id', autorizar('bibliotecario'), async (req, res) => {
  try {
    const { titulo, autor, ano_publicacao, quantidade_disponivel } = req.body;
    const { id } = req.params;

    const [livros] = await pool.query('SELECT * FROM livros WHERE id = ?', [id]);
    if (livros.length === 0) {
      return res.status(404).json({ erro: 'Livro não encontrado.' });
    }

    const atual = livros[0];

    await pool.query(
      'UPDATE livros SET titulo = ?, autor = ?, ano_publicacao = ?, quantidade_disponivel = ? WHERE id = ?',
      [
        titulo ?? atual.titulo,
        autor ?? atual.autor,
        ano_publicacao ?? atual.ano_publicacao,
        quantidade_disponivel ?? atual.quantidade_disponivel,
        id,
      ]
    );

    return res.json({ mensagem: 'Livro atualizado com sucesso.' });
  } catch (erro) {
    console.error('Erro ao atualizar livro:', erro);
    return res.status(500).json({ erro: 'Erro interno ao atualizar livro.' });
  }
});

/**
 * DELETE /api/livros/:id
 * Remove um livro do catálogo. Restrito a bibliotecários.
 * Não permite remover um livro que tenha empréstimos em aberto.
 */
router.delete('/:id', autorizar('bibliotecario'), async (req, res) => {
  try {
    const { id } = req.params;

    const [emprestimosAbertos] = await pool.query(
      `SELECT id FROM emprestimos
       WHERE livro_id = ? AND status IN ('ativo', 'pendente_devolucao', 'atrasado')`,
      [id]
    );

    if (emprestimosAbertos.length > 0) {
      return res.status(409).json({
        erro: 'Não é possível remover: este livro possui empréstimos em aberto.',
      });
    }

    const [resultado] = await pool.query('DELETE FROM livros WHERE id = ?', [id]);
    if (resultado.affectedRows === 0) {
      return res.status(404).json({ erro: 'Livro não encontrado.' });
    }

    return res.json({ mensagem: 'Livro removido com sucesso.' });
  } catch (erro) {
    console.error('Erro ao remover livro:', erro);
    return res.status(500).json({ erro: 'Erro interno ao remover livro.' });
  }
});

module.exports = router;
