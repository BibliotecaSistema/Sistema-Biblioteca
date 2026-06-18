/* ==========================================================
   Lógica da página de login e registro (index.html)
   ========================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Se já houver sessão ativa, manda direto para o painel correto.
  const usuarioLogado = Sessao.obterUsuario();
  if (usuarioLogado && Sessao.obterToken()) {
    window.location.href = usuarioLogado.perfil === 'bibliotecario' ? 'bibliotecario.html' : 'leitor.html';
    return;
  }

  const mensagemEl = document.getElementById('mensagem');
  const abas = document.querySelectorAll('.aba-botao');
  const formularios = document.querySelectorAll('.formulario');

  // Alternância entre as abas "Entrar" e "Criar conta"
  abas.forEach((aba) => {
    aba.addEventListener('click', () => {
      abas.forEach((a) => a.classList.remove('ativa'));
      formularios.forEach((f) => f.classList.remove('ativo'));

      aba.classList.add('ativa');
      document.querySelector(`[data-form="${aba.dataset.aba}"]`).classList.add('ativo');
      esconderMensagem(mensagemEl);
    });
  });

  // Login
  document.getElementById('form-login').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    esconderMensagem(mensagemEl);

    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;

    try {
      const resposta = await chamarApi('/auth/login', { metodo: 'POST', corpo: { email, senha } });
      Sessao.salvar(resposta.token, resposta.usuario);
      window.location.href = resposta.usuario.perfil === 'bibliotecario' ? 'bibliotecario.html' : 'leitor.html';
    } catch (erro) {
      mostrarMensagem(mensagemEl, erro.message, 'erro');
    }
  });

  // Registro
  document.getElementById('form-registro').addEventListener('submit', async (evento) => {
    evento.preventDefault();
    esconderMensagem(mensagemEl);

    const nome = document.getElementById('registro-nome').value.trim();
    const email = document.getElementById('registro-email').value.trim();
    const senha = document.getElementById('registro-senha').value;
    const perfil = document.querySelector('input[name="perfil"]:checked').value;

    try {
      await chamarApi('/auth/registrar', { metodo: 'POST', corpo: { nome, email, senha, perfil } });
      mostrarMensagem(mensagemEl, 'Conta criada com sucesso! Você já pode entrar.', 'sucesso');

      // Leva o usuário de volta para a aba de login, com o email preenchido.
      document.querySelector('[data-aba="login"]').click();
      document.getElementById('login-email').value = email;
    } catch (erro) {
      mostrarMensagem(mensagemEl, erro.message, 'erro');
    }
  });
});
