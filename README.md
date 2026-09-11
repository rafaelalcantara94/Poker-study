## V10.1.21 — Financial Clean Start

Esta versão mantém todas as correções validadas da V10.1.20 e adiciona o script de reset financeiro final para começar a operação real com base limpa.

### Reset financeiro

Execute no Supabase SQL Editor o arquivo `reset_finance_clean_start_v10_1_21.sql`.

O reset apaga somente os dados operacionais/financeiros de teste:

- fechamentos de caixa e itens de fechamento;
- pedidos e itens de reload;
- livro financeiro;
- lançamentos de Make Up;
- saldo de Make Up congelado.

Ele preserva usuários, equipes, membros e as configurações do perfil financeiro, como split, percentual de Banco e limite mensal. O regime é devolvido para `Normal`, o Make Up congelado fica em zero e, como o razão é zerado, Make Up ativo e Banco acumulado também voltam a zero.

> **Importante:** o script é destrutivo para o módulo financeiro e deve ser executado apenas quando você decidir encerrar os testes e iniciar a base real.

## V10.1.20 — Regime congelado e saldo atual

- Corrige a prévia de saque para respeitar o **Regime Make Up congelado** sempre que o perfil estiver configurado como congelado.
- O campo do perfil passa a representar o **Make Up congelado atual**, não apenas a base bruta histórica.
- Ao salvar esse saldo, o app compensa automaticamente os lançamentos antigos de `frozen_makeup_effect`, preservando o livro financeiro sem deixar amortizações antigas anularem um novo saldo configurado.
- Frontend e função SQL de distribuição voltam a usar a mesma regra de regime.

### Caso que revelou o bug

Um perfil congelado com R$ 1.000 configurados podia aparecer com R$ 0 de MU congelado quando existia uma amortização antiga de -R$ 1.000 no razão. A prévia então caía incorretamente no bloco visual de Regime normal.

### Após atualizar

Abra **Make Up / Banco → Perfil**, informe novamente o saldo desejado em **Make Up congelado atual** e salve. No cenário de teste atual, informe **R$ 1.000,00**.

## V10.1.19 — Caixa atual pós-fechamento

- A aba **Caixas** do gestor agora usa o caixa efetivo: último fechamento + reloads posteriores - saques posteriores.
- A **Exposição caixa** passa a comparar Make Up ativo com o caixa efetivo (`Make Up - Caixa atual`). Valor negativo indica excedente acima do Make Up.
- **Reloads enviados** continua sendo o total histórico enviado ao jogador.

## V10.1.18 — Reload compõe caixa e Make Up

Correção da regra de caixa após fechamento:

- Reload enviado após o fechamento aumenta o **Make Up ativo**.
- O mesmo Reload também aumenta o **caixa real considerado** para saque.
- Saques posteriores reduzem o caixa considerado.
- Fórmula: `caixa considerado = último fechamento + reloads posteriores - saques posteriores`.
- Disponível: `max(0, caixa considerado - Make Up ativo)`.

Exemplo validado: caixa 4.000 + reload 2.000 - saque 1.000 = caixa 5.000; MU ativo 3.000; disponível 2.000.
