## V10.1.13 — Histórico financeiro auditável

- O Livro financeiro recente agora mostra o valor bruto da operação, separado dos efeitos contábeis.
- Ex.: um saque de R$ 6.000,00 continua aparecendo como operação de R$ 6.000,00, enquanto Jogador, Time, Banco e Make Up aparecem na composição abaixo.
- Estornos exibem também o tipo da operação original e seus efeitos inversos.
- Mantém as regras e o motor financeiro validados na V10.1.12; esta atualização é somente de apresentação/auditoria.
- Não exige SQL novo.

## V10.1.12 — Estorno com restauração completa

- Estorno de uma distribuição que quitou o Make Up congelado restaura também o saldo congelado anterior e o regime.
- Novas distribuições salvam um snapshot financeiro mínimo no metadata para reversões fiéis.
- Inclui reparo compatível com o estorno de teste criado na V10.1.11.
- Mantém lançamento original + movimento inverso no razão; nada é apagado.

### SQL obrigatório
Execute `upgrade_v10_1_11_to_v10_1_12_reversal_state_restore.sql` uma vez no Supabase SQL Editor.
