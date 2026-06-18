/**
 * Script utilitário para criar dois usuários de teste (um bibliotecário
 * e um leitor), já com a senha criptografada corretamente com bcrypt.
 *
 * Como usar:
 *   1. Configure o arquivo .env (copie de .env.example)
 *   2. Garanta que o banco e as tabelas já foram criados (database/schema.sql)
 *   3. Rode: npm run seed
 *
 * Usuários criados:
 *   bibliotecario@teste.com / 123456
 *   leitor@teste.com        / 123456
 */
const bcrypt = require('bcryptjs');
const pool = require('./config/db');

async function seed() {
  const senhaCriptografada = await bcrypt.hash('123456', 10);

  const usuarios = [
    { nome: 'Bibliotecário Teste', email: 'bibliotecario@teste.com', perfil: 'bibliotecario' },
    { nome: 'Leitor Teste', email: 'leitor@teste.com', perfil: 'leitor' },
  ];

  for (const usuario of usuarios) {
    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [usuario.email]);
    if (existentes.length > 0) {
      console.log(`Usuário ${usuario.email} já existe, pulando.`);
      continue;
    }

    await pool.query(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      [usuario.nome, usuario.email, senhaCriptografada, usuario.perfil]
    );
    console.log(`Usuário criado: ${usuario.email} (perfil: ${usuario.perfil})`);
  }

  console.log('\nSenha para ambos os usuários de teste: 123456');
  process.exit(0);
}

seed().catch((erro) => {
  console.error('Erro ao popular usuários de teste:', erro);
  process.exit(1);
});
