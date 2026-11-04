import express from 'express';
import * as doacoes from './doacoes.js';
import * as autenticacao from './autenticacao.js';

export function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static('public'));

  // Verificação de saúde: usada pelo CI para provar que a aplicação sobe.
  app.get('/api/saude', (req, res) => res.json({ ok: true }));

  app.post('/api/cadastro', async (req, res) => {
    try {
      res.status(201).json(await autenticacao.cadastrar(req.body));
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  });

  app.post('/api/login', async (req, res) => {
    try {
      res.json(await autenticacao.login(req.body));
    } catch (erro) {
      res.status(401).json({ erro: erro.message });
    }
  });

  app.get('/api/me', autenticacao.autenticar, (req, res) => res.json(req.usuario));

  app.get('/api/doacoes', autenticacao.autenticar, autenticacao.exigirPerfil('ong'), async (req, res) => {
    try {
      res.json(await doacoes.listarDisponiveis(req.query.tipo));
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  });

  app.get('/api/minhas-coletas', autenticacao.autenticar, autenticacao.exigirPerfil('ong'), async (req, res) => {
    try {
      res.json(await doacoes.listarAceitas(req.usuario.nome));
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  });

  app.post('/api/doacoes', autenticacao.autenticar, autenticacao.exigirPerfil('doador'), async (req, res) => {
    try {
      res.status(201).json(await doacoes.criarDoacao(req.body, req.usuario.id));
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  });

  app.post('/api/doacoes/:id/aceitar', autenticacao.autenticar, autenticacao.exigirPerfil('ong'), async (req, res) => {
    try {
      res.json(await doacoes.aceitar(req.params.id, req.usuario.nome));
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  });

  app.post('/api/doacoes/:id/cancelar', autenticacao.autenticar, autenticacao.exigirPerfil('ong'), async (req, res) => {
    try {
      res.json(await doacoes.cancelar(req.params.id, req.usuario.nome));
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  });

  // H5c — o estabelecimento vê as doações que publicou, cancela com motivo e consulta o histórico.
  app.get('/api/minhas-doacoes', autenticacao.autenticar, autenticacao.exigirPerfil('doador'), async (req, res) => {
    try {
      res.json(await doacoes.listarPublicadas(req.usuario.id));
    } catch (erro) {
      res.status(400).json({ erro: erro.message });
    }
  });

  app.post(
    '/api/doacoes/:id/cancelar-publicacao',
    autenticacao.autenticar,
    autenticacao.exigirPerfil('doador'),
    async (req, res) => {
      try {
        res.json(await doacoes.cancelarPeloDoador(req.params.id, req.usuario.id, req.body?.motivo));
      } catch (erro) {
        res.status(erro.message === 'doação não encontrada' ? 404 : 400).json({ erro: erro.message });
      }
    }
  );

  app.get(
    '/api/doacoes/:id/historico',
    autenticacao.autenticar,
    autenticacao.exigirPerfil('doador'),
    async (req, res) => {
      try {
        res.json(await doacoes.historico(req.params.id, req.usuario.id));
      } catch (erro) {
        res.status(404).json({ erro: erro.message });
      }
    }
  );

  return app;
}
