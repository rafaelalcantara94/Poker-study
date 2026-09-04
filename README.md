# Poker Study V8.3.4 — Auditoria Estratégica + 4Bet Review

- Adiciona uma área de Auditoria Estratégica independente do Top 8 do Resumo de Leaks.
- Acesso direto a RFI, 3Bet nAI, Fold to 3Bet nAI, 4Bet nAI/Total e Blind War.
- O alvo de revisão é escolhido pela direção do desvio: frequência baixa -> decisões sem a ação; frequência alta -> ações executadas.
- Corrige a revisão de 4Bet nAI/Total acima da faixa: execuções marginais sobem na prioridade e premiums óbvios deixam de dominar a fila.
- RFI acima da faixa também prioriza a parte mais fraca dos opens executados.
- A auditoria comum continua disponível sem triagem estratégica automática.
- Não é solver/GTO; continua sendo uma fila heurística de revisão.

Sem mudanças SQL e sem necessidade de reimportar Hand Histories.


## V8.3.4
- F2 3Bet nAI agora exige RFI/open real em pote unopened; ISO raise sobre limpers seguido de reraise fica fora do denominador.
- Triagem F2 3Bet recalibrada para manter uma faixa intermediária de candidatos Forte/Mix/Fronteira sem tratar folds triviais como leaks.
- Sem alteração de SQL.


## V8.3.4
F2 3Bet nAI: universo auditável e prioridade estratégica foram separados. Todas as oportunidades válidas permanecem disponíveis; Forte/Mix/Fronteira apenas ordena a revisão.
