import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import * as repo from './repositorio.js';

const sessoes = new Map();

function hashSenha(senha, sal = randomBytes(16).toString('hex')) {
  return `${sal}:${scryptSync(senha, sal, 64).toString('hex')}`;
}

function senhaConfere(senha, armazenada) {
  const [sal, hash] = String(armazenada).split(':');
  if (!sal || !hash) return false;
  const atual = scryptSync(senha, sal, 64).toString('hex');
  return hash.length === atual.length && timingSafeEqual(Buffer.from(hash), Buffer.from(atual));
}

function emailValido(email) {
  return /^[^\s@]+@[^\s@]+\.com$/i.test(email.trim());
}

function validarDados({ nome, email, senha, perfil }) {
  if ([nome, email, senha, perfil].some((valor) => typeof valor !== 'string' || !valor.trim())) {
    throw new Error('Nome, e-mail, senha e perfil são obrigatórios');
  }
  if (!emailValido(email)) throw new Error('E-mail deve conter @ e terminar com .com');
  if (senha.length < 6) throw new Error('Senha deve ter pelo menos 6 caracteres');
  if (!['doador', 'ong'].includes(perfil)) throw new Error('Perfil deve ser doador ou ong');
}

export async function cadastrar(dados) {
  validarDados(dados);
  const email = dados.email.trim().toLowerCase();
  if (await repo.buscarUsuarioPorEmail(email)) throw new Error('E-mail já cadastrado');
  return repo.inserirUsuario({ nome: dados.nome.trim(), email, senha: hashSenha(dados.senha), perfil: dados.perfil });
}

export async function login({ email, senha } = {}) {
  if (typeof email !== 'string' || typeof senha !== 'string' || !email.trim() || !senha) {
    throw new Error('E-mail e senha são obrigatórios');
  }
  if (!emailValido(email)) throw new Error('E-mail deve conter @ e terminar com .com');
  const usuario = await repo.buscarUsuarioPorEmail(email.trim().toLowerCase());
  if (!usuario || !senhaConfere(senha, usuario.senha)) throw new Error('E-mail ou senha inválidos');
  const token = randomBytes(32).toString('hex');
  const publico = { id: usuario.id, nome: usuario.nome, email: usuario.email, perfil: usuario.perfil };
  sessoes.set(token, publico);
  return { token, usuario: publico };
}

export function autenticar(req, res, proximo) {
  const cabecalho = req.get('authorization') || '';
  const token = cabecalho.startsWith('Bearer ') ? cabecalho.slice(7) : '';
  const usuario = sessoes.get(token);
  if (!usuario) return res.status(401).json({ erro: 'autenticação necessária' });
  req.usuario = usuario;
  return proximo();
}

export function exigirPerfil(...perfis) {
  return (req, res, proximo) => {
    if (!perfis.includes(req.usuario?.perfil)) return res.status(403).json({ erro: 'perfil sem permissão' });
    return proximo();
  };
}