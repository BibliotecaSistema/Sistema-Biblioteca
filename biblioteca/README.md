# Biblioteca Central — Sistema de Gerenciamento de Empréstimos

Sistema completo (backend + frontend + banco de dados) para gerenciar o
empréstimo de livros em uma biblioteca, com dois perfis de usuário:

- **Bibliotecário**: cadastra, edita e remove livros; aprova devoluções.
- **Leitor**: consulta o catálogo, solicita empréstimos e solicita devoluções.

## Estrutura do projeto

```
biblioteca/
├── backend/
│   ├── database/
│   │   └── schema.sql        # script de criação das tabelas (MySQL)
│   ├── src/
│   │   ├── config/db.js      # conexão com o banco (pool mysql2)
│   │   ├── middleware/auth.js# autenticação JWT e controle de permissão
│   │   ├── routes/           # rotas: auth, livros, emprestimos
│   │   ├── utils/atrasados.js# marca empréstimos vencidos como "atrasado"
│   │   ├── seed.js           # cria 2 usuários de teste com senha já criptografada
│   │   └── server.js         # ponto de entrada da API Express
│   ├── .env.example
│   └── package.json
└── frontend/
    ├── index.html            # login / registro
    ├── bibliotecario.html    # painel do bibliotecário
    ├── leitor.html           # painel do leitor
    ├── css/styles.css
    └── js/                   # api.js (helper), auth.js, bibliotecario.js, leitor.js
```

## Passo a passo para rodar

### 1. Pré-requisitos
- Node.js instalado (versão 18 ou mais recente recomendada)
- MySQL instalado e rodando localmente (ou acesso a um servidor MySQL)

### 2. Banco de dados
Rode o script `backend/database/schema.sql` no seu MySQL. Ele cria o banco
`biblioteca`, as três tabelas (`usuarios`, `livros`, `emprestimos`) e insere
três livros de exemplo.

```bash
mysql -u root -p < backend/database/schema.sql
```

> Usa PostgreSQL ou outro banco? O script é bem simples (3 tabelas, FKs e um
> ENUM) — adapte a sintaxe de `AUTO_INCREMENT`/`ENUM` para o seu banco e
> troque o driver `mysql2` por `pg` em `backend/src/config/db.js`.

### 3. Backend

```bash
cd backend
npm install
cp .env.example .env
# edite o .env com usuário/senha do seu MySQL
npm run seed     # (opcional) cria 2 usuários de teste, senha "123456":
                  #   bibliotecario@teste.com  (perfil bibliotecario)
                  #   leitor@teste.com         (perfil leitor)
npm start         # inicia a API em http://localhost:3000
```

Use `npm run dev` em vez de `npm start` se quiser reiniciar automaticamente
o servidor a cada alteração (requer `nodemon`, já incluso nas devDependencies).

### 4. Frontend
O frontend é HTML/CSS/JS puro, sem build. Basta abrir os arquivos da pasta
`frontend/` em um servidor estático (não abra com `file://` direto, porque
algumas chamadas `fetch` podem ter restrições). A forma mais simples:

```bash
cd frontend
npx serve .
# ou: python3 -m http.server 5500
```

Depois acesse `http://localhost:5500` (ou a porta exibida) no navegador. A
página inicial é `index.html`.

> O frontend assume que a API está em `http://localhost:3000/api`. Se você
> mudar a porta do backend, atualize a constante `API_BASE_URL` em
> `frontend/js/api.js`.

## Como o sistema funciona

### Autenticação
- Login e registro emitem/validam um **token JWT**, guardado no
  `localStorage` do navegador e enviado em todas as requisições no cabeçalho
  `Authorization: Bearer <token>`.
- O backend valida o token e o perfil (`bibliotecario` ou `leitor`) em cada
  rota protegida (`middleware/auth.js`).

### Fluxo de empréstimo e devolução
1. Leitor solicita um empréstimo → `quantidade_disponivel` do livro é
   decrementada e o empréstimo nasce com `status = 'ativo'` e
   `data_devolucao_prevista = hoje + 14 dias`.
2. Leitor solicita devolução → `status = 'pendente_devolucao'`.
3. Bibliotecário aprova a devolução → `status = 'devolvido'`,
   `data_devolucao_real` é preenchida e o estoque do livro é incrementado.
4. Sempre que a lista de empréstimos é consultada, o sistema verifica se
   algum empréstimo passou da data prevista sem devolução e atualiza seu
   status para `atrasado` automaticamente.

> **Observação de design:** o enunciado define os status `ativo`,
> `devolvido` e `atrasado`. Foi adicionado o status `pendente_devolucao`
> para representar corretamente o momento em que o leitor *solicita* a
> devolução e o bibliotecário ainda precisa *aprovar* — sem essa etapa
> intermediária não haveria como diferenciar "leitor pediu" de
> "bibliotecário confirmou", que são ações de perfis diferentes.

### Rotas da API

| Método | Rota                                         | Quem pode usar     | Descrição                              |
|--------|-----------------------------------------------|--------------------|-----------------------------------------|
| POST   | `/api/auth/registrar`                         | Público            | Cria um usuário (bibliotecário ou leitor) |
| POST   | `/api/auth/login`                             | Público            | Autentica e retorna o token JWT         |
| GET    | `/api/livros`                                 | Autenticado        | Lista todos os livros                   |
| GET    | `/api/livros/:id`                             | Autenticado        | Detalhes de um livro                    |
| POST   | `/api/livros`                                 | Bibliotecário       | Cadastra um livro                       |
| PUT    | `/api/livros/:id`                             | Bibliotecário       | Atualiza um livro                       |
| DELETE | `/api/livros/:id`                             | Bibliotecário       | Remove um livro                         |
| GET    | `/api/emprestimos`                            | Autenticado        | Lista empréstimos (todos p/ bibliotecário, só os próprios p/ leitor) |
| POST   | `/api/emprestimos`                            | Leitor             | Cria um empréstimo                      |
| PUT    | `/api/emprestimos/:id/solicitar-devolucao`    | Leitor (dono)       | Sinaliza pedido de devolução            |
| PUT    | `/api/emprestimos/:id/aprovar-devolucao`      | Bibliotecário       | Confirma a devolução e repõe o estoque  |
| DELETE | `/api/emprestimos/:id`                        | Bibliotecário       | Cancela/remove um empréstimo            |

## Possíveis melhorias futuras
- Paginação e busca por título/autor no catálogo.
- Histórico de empréstimos devolvidos separado dos ativos.
- Notificações por email quando um empréstimo está perto de vencer.
- Testes automatizados (ex.: Jest + Supertest) para as rotas da API.
