const pool = require('../config/db');

/**
 * Atualiza para 'atrasado' todo empréstimo que:
 *  - ainda não foi devolvido (data_devolucao_real IS NULL)
 *  - está com status 'ativo' ou 'pendente_devolucao'
 *  - já passou da data prevista de devolução
 *
 * Chamada antes de listar empréstimos, garantindo que o status
 * exibido esteja sempre atualizado, sem precisar de um job/cron
 * separado.
 */
async function atualizarEmprestimosAtrasados() {
  await pool.query(
    `UPDATE emprestimos
     SET status = 'atrasado'
     WHERE data_devolucao_real IS NULL
       AND status IN ('ativo', 'pendente_devolucao')
       AND data_devolucao_prevista < CURDATE()`
  );
}

module.exports = { atualizarEmprestimosAtrasados };
