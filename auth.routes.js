const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const pool = require('../config/db');

const router = express.Router();

router.post('/registrar', async (req, res) => {
  try {
    const { nome, email, senha, perfil } = req.body;

    if (!nome || !email || !senha || !perfil) {
      return res.status(400).json({ erro: 'Preencha nome, email, senha e perfil.' });
    }

    if (!['bibliotecario', 'leitor'].includes(perfil)) {
      return res.status(400).json({ erro: "Perfil deve ser 'bibliotecario' ou 'leitor'." });
    }

    const [existentes] = await pool.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    if (existentes.length > 0) {
      return res.status(409).json({ erro: 'Já existe um usuário cadastrado com este email.' });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);

    const [resultado] = await pool.query(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      [nome, email, senhaCriptografada, perfil]
    );

    return res.status(201).json({
      mensagem: 'Usuário cadastrado com sucesso.',
      usuario: { id: resultado.insertId, nome, email, perfil },
    });
  } catch (erro) {
    console.error('Erro ao registrar usuário:', erro);
    return res.status(500).json({ erro: 'Erro interno ao registrar usuário.' });
  }
});

/**
 * POST /api/auth/login
 * Body: { email, senha }
 * Retorna um token JWT e os dados básicos do usuário.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ erro: 'Informe email e senha.' });
    }

    const [linhas] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
    const usuario = linhas[0];

    if (!usuario) {
      return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senha);
    if (!senhaValida) {
      return res.status(401).json({ erro: 'Email ou senha inválidos.' });
    }

    const token = jwt.sign(
      { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    return res.json({
      mensagem: 'Login realizado com sucesso.',
      token,
      usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil },
    });
  } catch (erro) {
    console.error('Erro ao fazer login:', erro);
    return res.status(500).json({ erro: 'Erro interno ao fazer login.' });
  }
});

module.exports = router;
