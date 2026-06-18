/* ==========================================================
   Lógica do painel do bibliotecário (bibliotecario.html)
   ========================================================== */

let usuarioAtual = null;

document.addEventListener('DOMContentLoaded', () => {
  usuarioAtual = Sessao.exigirPerfil('bibliotecario');
  if (!usuarioAtual) return;

  document.getElementById('nome-usuario').textContent = usuarioAtual.nome;
  document.getElementById('botao-sair').addEventListener('click', () => Sessao.encerrar());

  document.getElementById('form-livro').addEventListener('submit', salvarLivro);
  document.getElementById('botao-cancelar-edicao').addEventListener('click', cancelarEdicaoLivro);

  carregarLivros();
  carregarEmprestimos();
});

const mensagemGeral = () => document.getElementById('mensagem-geral');
const mensagemLivro = () => document.getElementById('mensagem-livro');

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
        <td class="acoes-tabela">
          <button class="botao botao-secundario botao-pequeno" data-acao="editar" data-id="${livro.id}">Editar</button>
          <button class="botao botao-perigo botao-pequeno" data-acao="excluir" data-id="${livro.id}">Excluir</button>
        </td>
      </tr>
    `).join('');

    corpoTabela.querySelectorAll('[data-acao="editar"]').forEach((botao) => {
      botao.addEventListener('click', () => iniciarEdicaoLivro(livros.find((l) => l.id === Number(botao.dataset.id))));
    });

    corpoTabela.querySelectorAll('[data-acao="excluir"]').forEach((botao) => {
      botao.addEventListener('click', () => excluirLivro(Number(botao.dataset.id)));
    });
  } catch (erro) {
    corpoTabela.innerHTML = `<tr><td colspan="5" class="vazio">${escaparHtml(erro.message)}</td></tr>`;
  }
}

function iniciarEdicaoLivro(livro) {
  document.getElementById('titulo-form-livro').textContent = 'Editar livro';
  document.getElementById('livro-id').value = livro.id;
  document.getElementById('livro-titulo').value = livro.titulo;
  document.getElementById('livro-autor').value = livro.autor;
  document.getElementById('livro-ano').value = livro.ano_publicacao ?? '';
  document.getElementById('livro-quantidade').value = livro.quantidade_disponivel;
  document.getElementById('botao-salvar-livro').textContent = 'Salvar alterações';
  document.getElementById('botao-cancelar-edicao').style.display = 'inline-block';
  esconderMensagem(mensagemLivro());
}

function cancelarEdicaoLivro() {
  document.getElementById('titulo-form-livro').textContent = 'Cadastrar novo livro';
  document.getElementById('form-livro').reset();
  document.getElementById('livro-id').value = '';
  document.getElementById('botao-salvar-livro').textContent = 'Cadastrar livro';
  document.getElementById('botao-cancelar-edicao').style.display = 'none';
}

async function salvarLivro(evento) {
  evento.preventDefault();
  const elMensagem = mensagemLivro();
  esconderMensagem(elMensagem);

  const id = document.getElementById('livro-id').value;
  const corpo = {
    titulo: document.getElementById('livro-titulo').value.trim(),
    autor: document.getElementById('livro-autor').value.trim(),
    ano_publicacao: document.getElementById('livro-ano').value ? Number(document.getElementById('livro-ano').value) : null,
    quantidade_disponivel: Number(document.getElementById('livro-quantidade').value),
  };

  try {
    if (id) {
      await chamarApi(`/livros/${id}`, { metodo: 'PUT', corpo });
      mostrarMensagem(elMensagem, 'Livro atualizado com sucesso.', 'sucesso');
    } else {
      await chamarApi('/livros', { metodo: 'POST', corpo });
      mostrarMensagem(elMensagem, 'Livro cadastrado com sucesso.', 'sucesso');
    }
    cancelarEdicaoLivro();
    carregarLivros();
  } catch (erro) {
    mostrarMensagem(elMensagem, erro.message, 'erro');
  }
}

async function excluirLivro(id) {
  if (!confirm('Tem certeza que deseja excluir este livro?')) return;

  try {
    await chamarApi(`/livros/${id}`, { metodo: 'DELETE' });
    mostrarMensagem(mensagemGeral(), 'Livro removido com sucesso.', 'sucesso');
    carregarLivros();
  } catch (erro) {
    mostrarMensagem(mensagemGeral(), erro.message, 'erro');
  }
}

/* -------------------- Empréstimos -------------------- */

async function carregarEmprestimos() {
  const corpoTabela = document.getElementById('tabela-emprestimos');
  try {
    const emprestimos = await chamarApi('/emprestimos');

    if (emprestimos.length === 0) {
      corpoTabela.innerHTML = '<tr><td colspan="6" class="vazio">Nenhum empréstimo registrado ainda.</td></tr>';
      return;
    }

    corpoTabela.innerHTML = emprestimos.map((emp) => `
      <tr>
        <td>${escaparHtml(emp.leitor_nome)}</td>
        <td>${escaparHtml(emp.livro_titulo)}</td>
        <td>${formatarData(emp.data_emprestimo)}</td>
        <td>${formatarData(emp.data_devolucao_prevista)}</td>
        <td>${seloStatus(emp.status)}</td>
        <td class="acoes-tabela">
          ${emp.status !== 'devolvido'
            ? `<button class="botao botao-aprovar botao-pequeno" data-acao="aprovar" data-id="${emp.id}">Aprovar devolução</button>`
            : ''}
          <button class="botao botao-perigo botao-pequeno" data-acao="cancelar" data-id="${emp.id}">Cancelar</button>
        </td>
      </tr>
    `).join('');

    corpoTabela.querySelectorAll('[data-acao="aprovar"]').forEach((botao) => {
      botao.addEventListener('click', () => aprovarDevolucao(Number(botao.dataset.id)));
    });

    corpoTabela.querySelectorAll('[data-acao="cancelar"]').forEach((botao) => {
      botao.addEventListener('click', () => cancelarEmprestimo(Number(botao.dataset.id)));
    });
  } catch (erro) {
    corpoTabela.innerHTML = `<tr><td colspan="6" class="vazio">${escaparHtml(erro.message)}</td></tr>`;
  }
}

async function aprovarDevolucao(id) {
  try {
    await chamarApi(`/emprestimos/${id}/aprovar-devolucao`, { metodo: 'PUT' });
    mostrarMensagem(mensagemGeral(), 'Devolução registrada e estoque atualizado.', 'sucesso');
    carregarEmprestimos();
    carregarLivros();
  } catch (erro) {
    mostrarMensagem(mensagemGeral(), erro.message, 'erro');
  }
}

async function cancelarEmprestimo(id) {
  if (!confirm('Cancelar este empréstimo? Se ele ainda estiver em aberto, o exemplar volta ao estoque.')) return;

  try {
    await chamarApi(`/emprestimos/${id}`, { metodo: 'DELETE' });
    mostrarMensagem(mensagemGeral(), 'Empréstimo cancelado.', 'sucesso');
    carregarEmprestimos();
    carregarLivros();
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
