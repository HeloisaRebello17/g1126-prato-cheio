# ADR 0006 — Autenticação própria: senhas com scrypt e sessões em memória

- **Data:** 2026-10-28
- **Status:** aceito, com limitação conhecida (sessões não sobrevivem a reinício nem a múltiplas instâncias)

## Contexto
O produto precisa distinguir doador e ONG e proteger a API (`docs/validacao.md`, critério 4). O
orçamento é zero e o prazo é curto, então um provedor de identidade externo e infraestrutura de
sessão compartilhada ficaram fora do escopo.

## Alternativas consideradas
1. **Cadastro/login próprio: `scrypt` (módulo `node:crypto`) com sal por usuário e token aleatório
   guardado em um `Map` na memória do servidor.** Prós: nenhuma dependência nova; senha nunca em texto
   puro; comparação em tempo constante (`timingSafeEqual`). Contras: sessões somem ao reiniciar; não
   funciona com mais de uma instância; sem expiração de token.
2. **JWT assinado, sem estado no servidor.** Prós: funciona com várias instâncias. Contras: exige
   gerenciar segredo, expiração e revogação; mais complexo para o piloto.
3. **Provedor externo (OAuth/Auth0/Supabase Auth).** Prós: menos código de segurança. Contras:
   dependência externa, limites do plano gratuito, mais configuração.

## Decisão
**Alternativa 1**, por simplicidade e custo zero. O perfil (`doador` ou `ong`) vem do banco e é checado
no servidor (`exigirPerfil`); a interface nunca decide permissões. O nome da ONG gravado no aceite vem da
sessão autenticada, nunca do corpo da requisição. O login devolve a mesma mensagem para e-mail inexistente
e senha errada, para não revelar quais e-mails existem.

## Consequências
- Positivas: comportamento coberto por `tests/auth.test.js` e `tests/erros-api.test.js` (token ausente,
  esquema errado, perfil sem permissão, senha nunca em texto puro).
- Negativas / o que abrimos mão: reiniciar o servidor desloga todos; sem expiração de sessão, sem limite de
  tentativas de login, sem recuperação de senha.
- Riscos e o que fazer se der errado: antes de escalar para mais de uma instância, mover as sessões para
  o PostgreSQL (tabela `sessoes` com expiração) ou adotar JWT. Registrar um novo ADR que substitua este.

## Rastreabilidade
Critério 4 de `docs/validacao.md` (cadastro, login e controle de acesso); restrição "orçamento zero".
