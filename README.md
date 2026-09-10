## V10.1.18 — Reload compõe caixa e Make Up

Correção da regra de caixa após fechamento:

- Reload enviado após o fechamento aumenta o **Make Up ativo**.
- O mesmo Reload também aumenta o **caixa real considerado** para saque.
- Saques posteriores reduzem o caixa considerado.
- Fórmula: `caixa considerado = último fechamento + reloads posteriores - saques posteriores`.
- Disponível: `max(0, caixa considerado - Make Up ativo)`.

Exemplo validado: caixa 4.000 + reload 2.000 - saque 1.000 = caixa 5.000; MU ativo 3.000; disponível 2.000.
