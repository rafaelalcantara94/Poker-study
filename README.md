## V10.1.17 — Reload não vira caixa distribuível

Correção da trava de saque: um reload enviado depois do último fechamento aumenta o Make Up ativo, mas **não aumenta o caixa-base usado para calcular saque**.

Regra validada:
- Caixa-base = último fechamento de caixas.
- Saques posteriores ao fechamento reduzem o caixa considerado.
- Reloads posteriores são exibidos apenas como informação e aumentam o Make Up ativo, não o caixa distribuível.
- Disponível para distribuição = max(0, caixa considerado - Make Up ativo).

Execute `upgrade_v10_1_16_to_v10_1_17_reload_not_cash.sql` uma vez no Supabase antes de testar.
