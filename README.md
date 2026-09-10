## V10.1.15 — Bank Persistence Fix

- Corrige divergência entre a prévia e a gravação de saques quando o perfil estava marcado como Make Up congelado, mas o saldo congelado já era zero.
- Com MU congelado em R$ 0, o perfil é normalizado para Regime normal e o Banco volta a ser aplicado por padrão sobre a parte do jogador.
- Mantém a exceção do gestor para dispensar o Banco somente naquela operação.
- Inclui SQL `upgrade_v10_1_14_to_v10_1_15_bank_persistence_fix.sql`.
- Atualiza também o script de reset para truncar tabelas relacionadas em uma única instrução e evitar erro de foreign key.
