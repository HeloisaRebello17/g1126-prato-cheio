// Executa os cenários de integração contra o SISTEMA RODANDO (npm start + PostgreSQL do docker compose)
// e imprime cada requisição, o resultado esperado e o obtido, em Markdown.
//
// Uso:  docker compose up -d && npm start        (em um terminal)
//       node scripts/cenarios-integracao.mjs > docs/evidencias/cenarios-http.md
//
// Diferente de tests/integracao.test.js (supertest, banco de teste), aqui as requisições passam pela
// porta HTTP real e gravam no banco de desenvolvimento — é o que a demonstração mostra.
// Cada execução usa e-mails novos, então pode ser repetida sem limpar o banco.

const BASE = process.env.BASE_URL || 'http://localhost:3001';
const sufixo = Date.now();
let falhas = 0;

function dataEmDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return [d.getDate(), d.getMonth() + 1].map((n) => String(n).padStart(2, '0')).join('/') + '/' + d.getFullYear();
}

async function chamar(passo, metodo, caminho, { token, corpo, esperado, conferir } = {}) {
  const res = await fetch(BASE + caminho, {
    method: metodo,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: corpo ? JSON.stringify(corpo) : undefined
  });
  const json = await res.json().catch(() => null);
  const okStatus = res.status === esperado;
  let okConteudo = true;
  try {
    if (conferir) okConteudo = Boolean(conferir(json));
  } catch {
    okConteudo = false;
  }
  const ok = okStatus && okConteudo;
  if (!ok) falhas++;
  const resumo = JSON.stringify(json, (k, v) => (k === 'token' && typeof v === 'string' ? v.slice(0, 8) + '…' : v));
  console.log(
    `| ${passo} | \`${metodo} ${caminho}\` | ${esperado} | ${res.status} | ${ok ? '✅' : '❌'} | \`${
      resumo.length > 140 ? resumo.slice(0, 140) + '…' : resumo
    }\` |`
  );
  return json;
}

const cabecalho = () => {
  console.log('| Passo | Requisição | Status esperado | Status obtido | OK? | Resposta (resumida) |');
  console.log('|---|---|:--:|:--:|:--:|---|');
};

async function cadastrar(nome, perfil) {
  const email = `${perfil}-${sufixo}-${nome.toLowerCase().replace(/\W/g, '')}@demo.com`;
  await chamar(`cadastro ${nome}`, 'POST', '/api/cadastro', {
    corpo: { nome: `${nome} ${sufixo}`, email, senha: 'demo1234', perfil },
    esperado: 201,
    conferir: (j) => j.perfil === perfil && !('senha' in j)
  });
  const r = await chamar(`login ${nome}`, 'POST', '/api/login', {
    corpo: { email, senha: 'demo1234' },
    esperado: 200,
    conferir: (j) => typeof j.token === 'string'
  });
  return r?.token;
}

console.log(`# Evidência — cenários de integração via HTTP\n`);
console.log(`- Servidor: \`${BASE}\` (npm start + PostgreSQL 16 do docker compose)`);
console.log(`- Executado em: ${new Date().toISOString()}`);
console.log(`- Comando: \`node scripts/cenarios-integracao.mjs\`\n`);

console.log('## Pré-condição — a aplicação está no ar\n');
cabecalho();
await chamar('saúde', 'GET', '/api/saude', { esperado: 200, conferir: (j) => j.ok === true });

console.log(
  '\n## Cenário 1 — publicar → filtrar → aceitar → ONG cancela a coleta com observação → outra ONG aceita (H1, H3, H4)\n'
);
cabecalho();
const doador = await cadastrar('Padaria', 'doador');
const ongA = await cadastrar('ONG A', 'ong');
const ongB = await cadastrar('ONG B', 'ong');
const tipoArroz = `Arroz ${sufixo}`;
const arroz = await chamar('doador publica arroz', 'POST', '/api/doacoes', {
  token: doador,
  corpo: { tipo: tipoArroz, quantidade: '10', validade: dataEmDias(3) },
  esperado: 201,
  conferir: (j) => j.status === 'disponivel'
});
await chamar('doador publica feijão', 'POST', '/api/doacoes', {
  token: doador,
  corpo: { tipo: `Feijão ${sufixo}`, quantidade: '4', validade: dataEmDias(3) },
  esperado: 201
});
await chamar('ONG A filtra por tipo', 'GET', `/api/doacoes?tipo=${encodeURIComponent(tipoArroz)}`, {
  token: ongA,
  esperado: 200,
  conferir: (j) => j.length === 1 && j[0].id === arroz.id
});
await chamar('ONG A aceita', 'POST', `/api/doacoes/${arroz.id}/aceitar`, {
  token: ongA,
  esperado: 200,
  conferir: (j) => j.status === 'aceita'
});
await chamar('ONG B não vê o arroz', 'GET', `/api/doacoes?tipo=${encodeURIComponent(tipoArroz)}`, {
  token: ongB,
  esperado: 200,
  conferir: (j) => j.length === 0
});
await chamar('ONG B tenta aceitar (erro)', 'POST', `/api/doacoes/${arroz.id}/aceitar`, {
  token: ongB,
  esperado: 400,
  conferir: (j) => j.erro === 'doação já foi aceita'
});
await chamar('ONG A cancela a coleta com observação', 'POST', `/api/doacoes/${arroz.id}/cancelar`, {
  token: ongA,
  corpo: { observacao: 'Sem veículo para buscar hoje' },
  esperado: 200,
  conferir: (j) => j.status === 'disponivel'
});
await chamar('doador vê a observação da ONG', 'GET', '/api/minhas-doacoes', {
  token: doador,
  esperado: 200,
  conferir: (j) => {
    const d = j.find((x) => x.id === arroz.id);
    return d.status === 'disponivel' && d.ultimo_historico?.motivo === 'Sem veículo para buscar hoje';
  }
});
await chamar('ONG B aceita', 'POST', `/api/doacoes/${arroz.id}/aceitar`, {
  token: ongB,
  esperado: 200,
  conferir: (j) => j.status === 'aceita'
});
await chamar('doador vê o estado final', 'GET', '/api/minhas-doacoes', {
  token: doador,
  esperado: 200,
  conferir: (j) => j.find((d) => d.id === arroz.id)?.status === 'aceita'
});

console.log('\n## Cenário 2 — estabelecimento cancela doação já aceita, com motivo (H5c + autenticação)\n');
cabecalho();
const pao = await chamar('doador publica pão', 'POST', '/api/doacoes', {
  token: doador,
  corpo: { tipo: `Pão ${sufixo}`, quantidade: '30', validade: dataEmDias(1) },
  esperado: 201
});
await chamar('ONG A aceita', 'POST', `/api/doacoes/${pao.id}/aceitar`, { token: ongA, esperado: 200 });
await chamar('cancelar sem motivo (erro)', 'POST', `/api/doacoes/${pao.id}/cancelar-publicacao`, {
  token: doador,
  corpo: { motivo: '   ' },
  esperado: 400,
  conferir: (j) => j.erro === 'motivo do cancelamento é obrigatório'
});
await chamar('doador cancela com motivo', 'POST', `/api/doacoes/${pao.id}/cancelar-publicacao`, {
  token: doador,
  corpo: { motivo: 'ONG não apareceu para retirar' },
  esperado: 200,
  conferir: (j) => j.status === 'cancelada'
});
await chamar('some das coletas da ONG A', 'GET', '/api/minhas-coletas', {
  token: ongA,
  esperado: 200,
  conferir: (j) => !j.some((d) => d.id === pao.id)
});
await chamar('ONG A tenta aceitar de novo (erro)', 'POST', `/api/doacoes/${pao.id}/aceitar`, {
  token: ongA,
  esperado: 400,
  conferir: (j) => j.erro === 'doação cancelada pelo estabelecimento'
});
await chamar('histórico guarda o motivo', 'GET', `/api/doacoes/${pao.id}/historico`, {
  token: doador,
  esperado: 200,
  conferir: (j) => j.at(-1)?.motivo === 'ONG não apareceu para retirar' && j.at(-1)?.status_novo === 'cancelada'
});

console.log('\n## Cenário 3 (erro) — entradas inválidas e acessos indevidos\n');
cabecalho();
await chamar('validade 31/02 (data inexistente)', 'POST', '/api/doacoes', {
  token: doador,
  corpo: { tipo: 'Leite', quantidade: '2', validade: '31/02/2099' },
  esperado: 400,
  conferir: (j) => j.erro === 'validade deve ser uma data válida'
});
await chamar('validade no passado', 'POST', '/api/doacoes', {
  token: doador,
  corpo: { tipo: 'Leite', quantidade: '2', validade: dataEmDias(-1) },
  esperado: 400
});
await chamar('quantidade negativa', 'POST', '/api/doacoes', {
  token: doador,
  corpo: { tipo: 'Leite', quantidade: '-3', validade: dataEmDias(2) },
  esperado: 400
});
await chamar('ONG tenta publicar (perfil errado)', 'POST', '/api/doacoes', {
  token: ongA,
  corpo: { tipo: 'Leite', quantidade: '2', validade: dataEmDias(2) },
  esperado: 403
});
await chamar('listar sem token', 'GET', '/api/doacoes', { esperado: 401 });
await chamar('login com senha errada', 'POST', '/api/login', {
  corpo: { email: `doador-${sufixo}-padaria@demo.com`, senha: 'errada' },
  esperado: 401
});
await chamar('nenhum leite foi gravado', 'GET', '/api/doacoes?tipo=Leite', {
  token: ongA,
  esperado: 200,
  conferir: (j) => j.length === 0
});

console.log(`\n**Resultado:** ${falhas === 0 ? 'todos os passos conferem ✅' : `${falhas} passo(s) divergente(s) ❌`}`);
process.exitCode = falhas === 0 ? 0 : 1;
