/* ==========================================================
   Helper compartilhado para chamadas à API e sessão do usuário.
   Carregado em todas as páginas antes dos scripts específicos.
   ========================================================== */

const API_BASE_URL = 'http://localhost:3000/api';

const Sessao = {
  salvar(token, usuario) {
    localStorage.setItem('biblioteca_token', token);
    localStorage.setItem('biblioteca_usuario', JSON.stringify(usuario));
  },
  obterToken() {
    return localStorage.getItem('biblioteca_token');
  },
  obterUsuario() {
    const dados = localStorage.getItem('biblioteca_usuario');
    return dados ? JSON.parse(dados) : null;
  },
  encerrar() {
    localStorage.removeItem('biblioteca_token');
    localStorage.removeItem('biblioteca_usuario');
    window.location.href = 'index.html';
  },
  /**
   * Garante que existe um usuário logado com o perfil esperado.
   * Caso contrário, redireciona para a tela de login.
   */
  exigirPerfil(perfilEsperado) {
    const usuario = this.obterUsuario();
    const token = this.obterToken();
    if (!usuario || !token) {
      window.location.href = 'index.html';
      return null;
    }
    if (usuario.perfil !== perfilEsperado) {
      window.location.href = usuario.perfil === 'bibliotecario' ? 'bibliotecario.html' : 'leitor.html';
      return null;
    }
    return usuario;
  },
};

/**
 * Faz uma chamada à API já incluindo o cabeçalho de autenticação
 * (quando houver um token salvo) e tratando erros de forma padronizada.
 *
 * @param {string} caminho - ex: '/livros' ou '/emprestimos/5/aprovar-devolucao'
 * @param {object} opcoes - { metodo, corpo }
 */
async function chamarApi(caminho, opcoes = {}) {
  const { metodo = 'GET', corpo } = opcoes;
  const token = Sessao.obterToken();

  const cabecalhos = { 'Content-Type': 'application/json' };
  if (token) {
    cabecalhos['Authorization'] = `Bearer ${token}`;
  }

  let resposta;
  try {
    resposta = await fetch(`${API_BASE_URL}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
  } catch (erroDeRede) {
    throw new Error('Não foi possível conectar ao servidor. Verifique se o backend está rodando.');
  }

  const dados = await resposta.json().catch(() => ({}));

  if (resposta.status === 401) {
    Sessao.encerrar();
    throw new Error(dados.erro || 'Sessão expirada. Faça login novamente.');
  }

  if (!resposta.ok) {
    throw new Error(dados.erro || 'Ocorreu um erro inesperado.');
  }

  return dados;
}

/** Exibe uma mensagem de sucesso/erro em um elemento <div class="mensagem"> */
function mostrarMensagem(elemento, texto, tipo = 'erro') {
  elemento.textContent = texto;
  elemento.className = `mensagem mostrar ${tipo}`;
}

function esconderMensagem(elemento) {
  elemento.className = 'mensagem';
}

/** Formata uma data ISO (YYYY-MM-DD) para o formato brasileiro dd/mm/aaaa */
function formatarData(dataIso) {
  if (!dataIso) return '—';
  const [ano, mes, dia] = dataIso.substring(0, 10).split('-');
  return `${dia}/${mes}/${ano}`;
}

const ROTULOS_STATUS = {
  ativo: 'Ativo',
  pendente_devolucao: 'Devolução solicitada',
  devolvido: 'Devolvido',
  atrasado: 'Atrasado',
};

function seloStatus(status) {
  const rotulo = ROTULOS_STATUS[status] || status;
  return `<span class="selo-status status-${status}">${rotulo}</span>`;
}
