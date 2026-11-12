import express from 'express';
import * as doacoes from './doacoes.js';
import * as autenticacao from './autenticacao.js';

// Monta o handler de uma rota: chama a regra, responde com o resultado em JSON
// e, se a regra lançar erro, responde { erro: mensagem }.
// `erro` pode ser um status fixo ou uma função que escolhe o status pela mensagem.
function responder(acao, { sucesso = 200, erro = 400 } = {}) {
  return async (req, res) => {
    try {
      res.status(sucesso).json(await acao(req));
    } catch (falha) {
      const status = typeof erro === 'function' ? erro(falha) : erro;
      res.status(status).json({ erro: falha.message });
    }
  };
}

const naoEncontradaVira404 = (falha) => (falha.message === 'doação não encontrada' ? 404 : 400);

export function criarApp() {
  const app = express();
  app.use(express.json());
  app.use(express.static('public'));

  const apenasOng = [autenticacao.autenticar, autenticacao.exigirPerfil('ong')];
  const apenasDoador = [autenticacao.autenticar, autenticacao.exigirPerfil('doador')];

  // Verificação de saúde: usada pelo CI para provar que a aplicação sobe.
  app.get('/api/saude', (req, res) => res.json({ ok: true }));

  app.post(
    '/api/cadastro',
    responder((req) => autenticacao.cadastrar(req.body), { sucesso: 201 })
  );
  app.post(
    '/api/login',
    responder((req) => autenticacao.login(req.body), { erro: 401 })
  );
  app.get('/api/me', autenticacao.autenticar, (req, res) => res.json(req.usuario));

  app.get(
    '/api/doacoes',
    apenasOng,
    responder((req) => doacoes.listarDisponiveis(req.query.tipo))
  );
  app.get(
    '/api/minhas-coletas',
    apenasOng,
    responder((req) => doacoes.listarAceitas(req.usuario.nome))
  );
  app.post(
    '/api/doacoes',
    apenasDoador,
    responder((req) => doacoes.criarDoacao(req.body, req.usuario.id), { sucesso: 201 })
  );
  app.post(
    '/api/doacoes/:id/aceitar',
    apenasOng,
    responder((req) => doacoes.aceitar(req.params.id, req.usuario.nome))
  );
  app.post(
    '/api/doacoes/:id/cancelar',
    apenasOng,
    responder((req) => doacoes.cancelar(req.params.id, req.usuario.nome))
  );

  // H5c — o estabelecimento vê as doações que publicou, cancela com motivo e consulta o histórico.
  app.get(
    '/api/minhas-doacoes',
    apenasDoador,
    responder((req) => doacoes.listarPublicadas(req.usuario.id))
  );
  app.post(
    '/api/doacoes/:id/cancelar-publicacao',
    apenasDoador,
    responder((req) => doacoes.cancelarPeloDoador(req.params.id, req.usuario.id, req.body?.motivo), {
      erro: naoEncontradaVira404
    })
  );
  app.get(
    '/api/doacoes/:id/historico',
    apenasDoador,
    responder((req) => doacoes.historico(req.params.id, req.usuario.id), { erro: 404 })
  );

  return app;
}
