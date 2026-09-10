## V10.1.16 — Caixa acima do Make Up

- Saques/distribuições agora são limitados pelo caixa financeiro real disponível.
- Fórmula: `disponível = caixa considerado - Make Up ativo`, nunca abaixo de zero.
- Caixa considerado parte do último fechamento e ajusta reloads enviados e saques não estornados posteriores ao fechamento.
- Sem fechamento de caixas, o saque fica bloqueado.
- O gestor pode distribuir um valor menor que o máximo, mas nunca maior.
- O Supabase repete a mesma validação no servidor para impedir gravações fora da regra.
- As regras já validadas de 50/50, Banco, exceção, MU congelado, limite mensal e estorno permanecem.

### SQL obrigatório
Execute `upgrade_v10_1_15_to_v10_1_16_cash_gate.sql` uma vez no Supabase antes de testar.
