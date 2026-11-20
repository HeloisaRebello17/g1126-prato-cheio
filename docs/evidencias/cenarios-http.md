# Evidência — cenários de integração via HTTP

- Servidor: `http://localhost:3001` (npm start + PostgreSQL 16 do docker compose)
- Executado em: 2026-11-20T00:41:07.827Z
- Comando: `node scripts/cenarios-integracao.mjs`

## Pré-condição — a aplicação está no ar

| Passo | Requisição | Status esperado | Status obtido | OK? | Resposta (resumida) |
|---|---|:--:|:--:|:--:|---|
| saúde | `GET /api/saude` | 200 | 200 | ✅ | `{"ok":true}` |

## Cenário 1 — publicar → filtrar → aceitar → ONG cancela a coleta com observação → outra ONG aceita (H1, H3, H4)

| Passo | Requisição | Status esperado | Status obtido | OK? | Resposta (resumida) |
|---|---|:--:|:--:|:--:|---|
| cadastro Padaria | `POST /api/cadastro` | 201 | 201 | ✅ | `{"id":18,"nome":"Padaria 1795135267824","email":"doador-1795135267824-padaria@demo.com","perfil":"doador"}` |
| login Padaria | `POST /api/login` | 200 | 200 | ✅ | `{"token":"e824afbb…","usuario":{"id":18,"nome":"Padaria 1795135267824","email":"doador-1795135267824-padaria@demo.com","perfil":"doador"}}` |
| cadastro ONG A | `POST /api/cadastro` | 201 | 201 | ✅ | `{"id":19,"nome":"ONG A 1795135267824","email":"ong-1795135267824-onga@demo.com","perfil":"ong"}` |
| login ONG A | `POST /api/login` | 200 | 200 | ✅ | `{"token":"1a26c862…","usuario":{"id":19,"nome":"ONG A 1795135267824","email":"ong-1795135267824-onga@demo.com","perfil":"ong"}}` |
| cadastro ONG B | `POST /api/cadastro` | 201 | 201 | ✅ | `{"id":20,"nome":"ONG B 1795135267824","email":"ong-1795135267824-ongb@demo.com","perfil":"ong"}` |
| login ONG B | `POST /api/login` | 200 | 200 | ✅ | `{"token":"159f268a…","usuario":{"id":20,"nome":"ONG B 1795135267824","email":"ong-1795135267824-ongb@demo.com","perfil":"ong"}}` |
| doador publica arroz | `POST /api/doacoes` | 201 | 201 | ✅ | `{"id":15,"tipo":"Arroz 1795135267824","quantidade":"10","validade":"22/11/2026","status":"disponivel","ong":null,"criada_em":"2026-11-20T00:…` |
| doador publica feijão | `POST /api/doacoes` | 201 | 201 | ✅ | `{"id":16,"tipo":"Feijão 1795135267824","quantidade":"4","validade":"22/11/2026","status":"disponivel","ong":null,"criada_em":"2026-11-20T00:…` |
| ONG A filtra por tipo | `GET /api/doacoes?tipo=Arroz%201795135267824` | 200 | 200 | ✅ | `[{"id":15,"tipo":"Arroz 1795135267824","quantidade":"10","validade":"22/11/2026","status":"disponivel","ong":null,"criada_em":"2026-11-20T00…` |
| ONG A aceita | `POST /api/doacoes/15/aceitar` | 200 | 200 | ✅ | `{"id":15,"tipo":"Arroz 1795135267824","quantidade":"10","validade":"22/11/2026","status":"aceita","ong":"ONG A 1795135267824","criada_em":"2…` |
| ONG B não vê o arroz | `GET /api/doacoes?tipo=Arroz%201795135267824` | 200 | 200 | ✅ | `[]` |
| ONG B tenta aceitar (erro) | `POST /api/doacoes/15/aceitar` | 400 | 400 | ✅ | `{"erro":"doação já foi aceita"}` |
| ONG A cancela a coleta com observação | `POST /api/doacoes/15/cancelar` | 200 | 200 | ✅ | `{"id":15,"tipo":"Arroz 1795135267824","quantidade":"10","validade":"22/11/2026","status":"disponivel","ong":null,"criada_em":"2026-11-20T00:…` |
| doador vê a observação da ONG | `GET /api/minhas-doacoes` | 200 | 200 | ✅ | `[{"id":16,"tipo":"Feijão 1795135267824","quantidade":"4","validade":"22/11/2026","status":"disponivel","ong":null,"criada_em":"2026-11-20T00…` |
| ONG B aceita | `POST /api/doacoes/15/aceitar` | 200 | 200 | ✅ | `{"id":15,"tipo":"Arroz 1795135267824","quantidade":"10","validade":"22/11/2026","status":"aceita","ong":"ONG B 1795135267824","criada_em":"2…` |
| doador vê o estado final | `GET /api/minhas-doacoes` | 200 | 200 | ✅ | `[{"id":16,"tipo":"Feijão 1795135267824","quantidade":"4","validade":"22/11/2026","status":"disponivel","ong":null,"criada_em":"2026-11-20T00…` |

## Cenário 2 — estabelecimento cancela doação já aceita, com motivo (H5c + autenticação)

| Passo | Requisição | Status esperado | Status obtido | OK? | Resposta (resumida) |
|---|---|:--:|:--:|:--:|---|
| doador publica pão | `POST /api/doacoes` | 201 | 201 | ✅ | `{"id":17,"tipo":"Pão 1795135267824","quantidade":"30","validade":"20/11/2026","status":"disponivel","ong":null,"criada_em":"2026-11-20T00:41…` |
| ONG A aceita | `POST /api/doacoes/17/aceitar` | 200 | 200 | ✅ | `{"id":17,"tipo":"Pão 1795135267824","quantidade":"30","validade":"20/11/2026","status":"aceita","ong":"ONG A 1795135267824","criada_em":"202…` |
| cancelar sem motivo (erro) | `POST /api/doacoes/17/cancelar-publicacao` | 400 | 400 | ✅ | `{"erro":"motivo do cancelamento é obrigatório"}` |
| doador cancela com motivo | `POST /api/doacoes/17/cancelar-publicacao` | 200 | 200 | ✅ | `{"id":17,"tipo":"Pão 1795135267824","quantidade":"30","validade":"20/11/2026","status":"cancelada","ong":"ONG A 1795135267824","criada_em":"…` |
| some das coletas da ONG A | `GET /api/minhas-coletas` | 200 | 200 | ✅ | `[]` |
| ONG A tenta aceitar de novo (erro) | `POST /api/doacoes/17/aceitar` | 400 | 400 | ✅ | `{"erro":"doação cancelada pelo estabelecimento"}` |
| histórico guarda o motivo | `GET /api/doacoes/17/historico` | 200 | 200 | ✅ | `[{"status_anterior":"aceita","status_novo":"cancelada","motivo":"ONG não apareceu para retirar","registrado_em":"2026-11-20T00:41:08.964Z"}]` |

## Cenário 3 (erro) — entradas inválidas e acessos indevidos

| Passo | Requisição | Status esperado | Status obtido | OK? | Resposta (resumida) |
|---|---|:--:|:--:|:--:|---|
| validade 31/02 (data inexistente) | `POST /api/doacoes` | 400 | 400 | ✅ | `{"erro":"validade deve ser uma data válida"}` |
| validade no passado | `POST /api/doacoes` | 400 | 400 | ✅ | `{"erro":"validade não pode ser anterior à data de hoje"}` |
| quantidade negativa | `POST /api/doacoes` | 400 | 400 | ✅ | `{"erro":"quantidade deve ser um número positivo"}` |
| ONG tenta publicar (perfil errado) | `POST /api/doacoes` | 403 | 403 | ✅ | `{"erro":"perfil sem permissão"}` |
| listar sem token | `GET /api/doacoes` | 401 | 401 | ✅ | `{"erro":"autenticação necessária"}` |
| login com senha errada | `POST /api/login` | 401 | 401 | ✅ | `{"erro":"E-mail ou senha inválidos"}` |
| nenhum leite foi gravado | `GET /api/doacoes?tipo=Leite` | 200 | 200 | ✅ | `[]` |

**Resultado:** todos os passos conferem ✅
