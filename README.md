## V10.1.12 — Estorno com restauração completa

- Estorno de uma distribuição que quitou o Make Up congelado restaura também o saldo congelado anterior e o regime.
- Novas distribuições salvam um snapshot financeiro mínimo no metadata para reversões fiéis.
- Inclui reparo compatível com o estorno de teste criado na V10.1.11.
- Mantém lançamento original + movimento inverso no razão; nada é apagado.

### SQL obrigatório
Execute `upgrade_v10_1_11_to_v10_1_12_reversal_state_restore.sql` uma vez no Supabase SQL Editor.
