/* ==========================================================
   Lógica do painel do leitor (leitor.html)
   ========================================================== */

let usuarioAtual = null;

document.addEventListener('DOMContentLoaded', () => {
  usuarioAtual = Sessao.exigirPerfil('leitor');
  if (!usuarioAtual) return;

  document.getElementById('nome-usuario').textContent = usuarioAtual.nome;
  document.getElementById('botao-sair').addEventListener('click', () => Sessao.encerrar());

  carregarLivros();
  carregarMeusEmprestimos();
});

const mensagemGeral = () => document.getElementById('mensagem-geral');

/* -------------------- Catálogo de livros -------------------- */

async function carregarLivros() {
  const corpoTabela = document.getElementById('tabela-livros');
  try {
    const livros = await chamarApi('/livros');

    if (livros.length === 0) {
      corpoTabela.innerHTML = '<tr><td colspan="5" class="vazio">Nenhum livro cadastrado ainda.</td></tr>';
      return;
    }

    corpoTabela.innerHTML = livros.map((livro) => `
      <tr>
        <td>${escaparHtml(livro.titulo)}</td>
        <td>${escaparHtml(livro.autor)}</td>
        <td>${livro.ano_publicacao ?? '—'}</td>
        <td class="${livro.quantidade_disponivel === 0 ? 'estoque-baixo' : ''}">${livro.quantidade_disponivel}</td>
        <td>
          <button
            class="botao botao-primario botao-pequeno"
            data-acao="solicitar"
            data-id="${livro.id}"
            ${livro.quantidade_disponivel === 0 ? 'disabled' : ''}
          >
            ${livro.quantidade_disponivel === 0 ? 'Indisponível' : 'Solicitar empréstimo'}
          </button>
        </td>
      </tr>
    `).join('');

    corpoTabela.querySelectorAll('[data-acao="solicitar"]').forEach((botao) => {
      botao.addEventListener('click', () => solicitarEmprestimo(Number(botao.dataset.id)));
    });
  } catch (erro) {
    corpoTabela.innerHTML = `<tr><td colspan="5" class="vazio">${escaparHtml(erro.message)}</td></tr>`;
  }
}

async function solicitarEmprestimo(livroId) {
  try {
    await chamarApi('/emprestimos', { metodo: 'POST', corpo: { livro_id: livroId } });
    mostrarMensagem(mensagemGeral(), 'Empréstimo realizado com sucesso. Prazo de devolução: 14 dias.', 'sucesso');
    carregarLivros();
    carregarMeusEmprestimos();
  } catch (erro) {
    mostrarMensagem(mensagemGeral(), erro.message, 'erro');
  }
}

/* -------------------- Meus empréstimos -------------------- */

async function carregarMeusEmprestimos() {
  const corpoTabela = document.getElementById('tabela-emprestimos');
  try {
    const emprestimos = await chamarApi('/emprestimos');

    if (emprestimos.length === 0) {
      corpoTabela.innerHTML = '<tr><td colspan="5" class="vazio">Você ainda não fez nenhum empréstimo.</td></tr>';
      return;
    }

    corpoTabela.innerHTML = emprestimos.map((emp) => `
      <tr>
        <td>${escaparHtml(emp.livro_titulo)}</td>
        <td>${formatarData(emp.data_emprestimo)}</td>
        <td>${formatarData(emp.data_devolucao_prevista)}</td>
        <td>${seloStatus(emp.status)}</td>
        <td>
          ${['ativo', 'atrasado'].includes(emp.status)
            ? `<button class="botao botao-secundario botao-pequeno" data-acao="devolver" data-id="${emp.id}">Solicitar devolução</button>`
            : (emp.status === 'pendente_devolucao'
                ? '<span class="subtitulo" style="margin:0;">Aguardando aprovação</span>'
                : '—')}
        </td>
      </tr>
    `).join('');

    corpoTabela.querySelectorAll('[data-acao="devolver"]').forEach((botao) => {
      botao.addEventListener('click', () => solicitarDevolucao(Number(botao.dataset.id)));
    });
  } catch (erro) {
    corpoTabela.innerHTML = `<tr><td colspan="5" class="vazio">${escaparHtml(erro.message)}</td></tr>`;
  }
}

async function solicitarDevolucao(id) {
  try {
    await chamarApi(`/emprestimos/${id}/solicitar-devolucao`, { metodo: 'PUT' });
    mostrarMensagem(mensagemGeral(), 'Devolução solicitada. Aguarde a aprovação do bibliotecário.', 'sucesso');
    carregarMeusEmprestimos();
  } catch (erro) {
    mostrarMensagem(mensagemGeral(), erro.message, 'erro');
  }
}

/* -------------------- Utilidades -------------------- */

function escaparHtml(texto) {
  const div = document.createElement('div');
  div.textContent = texto ?? '';
  return div.innerHTML;
}
