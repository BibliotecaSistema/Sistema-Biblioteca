const express = require('express');
const pool = require('../config/db');
const { autenticar, autorizar } = require('../middleware/auth');
const { atualizarEmprestimosAtrasados } = require('../utils/atrasados');

const router = express.Router();

const DIAS_PARA_DEVOLUCAO = 14;

router.use(autenticar);

/**
 * GET /api/emprestimos
 * - Bibliotecário: vê todos os empréstimos (com nome do leitor e título do livro).
 * - Leitor: vê apenas os próprios empréstimos.
 */
router.get('/', async (req, res) => {
  try {
    await atualizarEmprestimosAtrasados();

    const filtroLeitor = req.usuario.perfil === 'leitor';

    const sql = `
      SELECT
        e.id,
        e.livro_id,
        e.leitor_id,
        e.data_emprestimo,
        e.data_devolucao_prevista,
        e.data_devolucao_real,
        e.status,
        l.titulo  AS livro_titulo,
        l.autor   AS livro_autor,
        u.nome    AS leitor_nome
      FROM emprestimos e
      JOIN livros l   ON l.id = e.livro_id
      JOIN usuarios u ON u.id = e.leitor_id
      ${filtroLeitor ? 'WHERE e.leitor_id = ?' : ''}
      ORDER BY e.data_emprestimo DESC
    `;

    const params = filtroLeitor ? [req.usuario.id] : [];
    const [emprestimos] = await pool.query(sql, params);

    return res.json(emprestimos);
  } catch (erro) {
    console.error('Erro ao listar empréstimos:', erro);
    return res.status(500).json({ erro: 'Erro interno ao listar empréstimos.' });
  }
});

/**
 * POST /api/emprestimos
 * Cria um novo empréstimo. Restrito a leitores.
 * Body: { livro_id }
 *
 * Regras:
 *  - O livro precisa existir e ter quantidade_disponivel > 0.
 *  - quantidade_disponivel é decrementada imediatamente.
 *  - data_devolucao_prevista = hoje + 14 dias.
 *  - status inicial = 'ativo'.
 */
router.post('/', autorizar('leitor'), async (req, res) => {
  const { livro_id } = req.body;

  if (!livro_id) {
    return res.status(400).json({ erro: 'Informe o livro_id desejado.' });
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [livros] = await conexao.query(
      'SELECT * FROM livros WHERE id = ? FOR UPDATE',
      [livro_id]
    );

    if (livros.length === 0) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Livro não encontrado.' });
    }

    const livro = livros[0];
    if (livro.quantidade_disponivel <= 0) {
      await conexao.rollback();
      return res.status(409).json({ erro: 'Não há exemplares disponíveis deste livro.' });
    }

    const [resultado] = await conexao.query(
      `INSERT INTO emprestimos (livro_id, leitor_id, data_emprestimo, data_devolucao_prevista, status)
       VALUES (?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL ? DAY), 'ativo')`,
      [livro_id, req.usuario.id, DIAS_PARA_DEVOLUCAO]
    );

    await conexao.query(
      'UPDATE livros SET quantidade_disponivel = quantidade_disponivel - 1 WHERE id = ?',
      [livro_id]
    );

    await conexao.commit();

    return res.status(201).json({
      mensagem: 'Empréstimo solicitado com sucesso.',
      emprestimo_id: resultado.insertId,
    });
  } catch (erro) {
    await conexao.rollback();
    console.error('Erro ao criar empréstimo:', erro);
    return res.status(500).json({ erro: 'Erro interno ao criar empréstimo.' });
  } finally {
    conexao.release();
  }
});

/**
 * PUT /api/emprestimos/:id/solicitar-devolucao
 * O leitor sinaliza que quer devolver o livro. Restrito ao próprio leitor
 * do empréstimo. Muda o status para 'pendente_devolucao', aguardando
 * aprovação do bibliotecário.
 */
router.put('/:id/solicitar-devolucao', autorizar('leitor'), async (req, res) => {
  try {
    const { id } = req.params;

    const [emprestimos] = await pool.query('SELECT * FROM emprestimos WHERE id = ?', [id]);
    if (emprestimos.length === 0) {
      return res.status(404).json({ erro: 'Empréstimo não encontrado.' });
    }

    const emprestimo = emprestimos[0];

    if (emprestimo.leitor_id !== req.usuario.id) {
      return res.status(403).json({ erro: 'Você só pode solicitar devolução dos seus próprios empréstimos.' });
    }

    if (!['ativo', 'atrasado'].includes(emprestimo.status)) {
      return res.status(409).json({ erro: `Não é possível solicitar devolução de um empréstimo com status '${emprestimo.status}'.` });
    }

    await pool.query("UPDATE emprestimos SET status = 'pendente_devolucao' WHERE id = ?", [id]);

    return res.json({ mensagem: 'Devolução solicitada. Aguardando aprovação do bibliotecário.' });
  } catch (erro) {
    console.error('Erro ao solicitar devolução:', erro);
    return res.status(500).json({ erro: 'Erro interno ao solicitar devolução.' });
  }
});

/**
 * PUT /api/emprestimos/:id/aprovar-devolucao
 * O bibliotecário aprova/registra a devolução. Restrito a bibliotecários.
 * Marca status = 'devolvido', preenche data_devolucao_real e devolve
 * o exemplar ao estoque (quantidade_disponivel + 1).
 */
router.put('/:id/aprovar-devolucao', autorizar('bibliotecario'), async (req, res) => {
  const { id } = req.params;

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [emprestimos] = await conexao.query('SELECT * FROM emprestimos WHERE id = ? FOR UPDATE', [id]);
    if (emprestimos.length === 0) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Empréstimo não encontrado.' });
    }

    const emprestimo = emprestimos[0];
    if (emprestimo.status === 'devolvido') {
      await conexao.rollback();
      return res.status(409).json({ erro: 'Este empréstimo já foi devolvido.' });
    }

    await conexao.query(
      "UPDATE emprestimos SET status = 'devolvido', data_devolucao_real = CURDATE() WHERE id = ?",
      [id]
    );

    await conexao.query(
      'UPDATE livros SET quantidade_disponivel = quantidade_disponivel + 1 WHERE id = ?',
      [emprestimo.livro_id]
    );

    await conexao.commit();

    return res.json({ mensagem: 'Devolução registrada com sucesso.' });
  } catch (erro) {
    await conexao.rollback();
    console.error('Erro ao aprovar devolução:', erro);
    return res.status(500).json({ erro: 'Erro interno ao aprovar devolução.' });
  } finally {
    conexao.release();
  }
});

/**
 * DELETE /api/emprestimos/:id
 * Cancela (remove) um registro de empréstimo. Restrito a bibliotecários.
 * Se o empréstimo ainda estava em aberto, devolve o exemplar ao estoque
 * antes de excluir o registro.
 */
router.delete('/:id', autorizar('bibliotecario'), async (req, res) => {
  const { id } = req.params;

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [emprestimos] = await conexao.query('SELECT * FROM emprestimos WHERE id = ? FOR UPDATE', [id]);
    if (emprestimos.length === 0) {
      await conexao.rollback();
      return res.status(404).json({ erro: 'Empréstimo não encontrado.' });
    }

    const emprestimo = emprestimos[0];
    const estavaEmAberto = ['ativo', 'pendente_devolucao', 'atrasado'].includes(emprestimo.status);

    await conexao.query('DELETE FROM emprestimos WHERE id = ?', [id]);

    if (estavaEmAberto) {
      await conexao.query(
        'UPDATE livros SET quantidade_disponivel = quantidade_disponivel + 1 WHERE id = ?',
        [emprestimo.livro_id]
      );
    }

    await conexao.commit();

    return res.json({ mensagem: 'Empréstimo cancelado/removido com sucesso.' });
  } catch (erro) {
    await conexao.rollback();
    console.error('Erro ao remover empréstimo:', erro);
    return res.status(500).json({ erro: 'Erro interno ao remover empréstimo.' });
  } finally {
    conexao.release();
  }
});

module.exports = router;
