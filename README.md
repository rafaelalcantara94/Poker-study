# Poker Study V8.3.6 — Full Opportunity Universe

## O que mudou

- Auditorias estratégicas agora preservam **todo o universo estatisticamente válido** da decisão.
- O Strategic Priority Engine não elimina mais mãos do Replayer: ele apenas marca/prioriza um subconjunto.
- Novo filtro **Escopo da revisão**: `Todas oportunidades` ou `Só priorizadas`.
- O filtro **Classe de mão** funciona em conjunto com o escopo e passa a mostrar também Trash/Outras, A-high, gappers etc. quando existirem no universo válido.
- Para stats nAI, ações agressivas incompatíveis (como shove quando estamos auditando falta de raise nAI) continuam fora da fila passiva principal.
- Forte / Mix / Fronteira continuam sendo heurística de revisão, não decisão GTO.

## Banco de dados

Nenhuma alteração SQL. Não é necessário reimportar Hand Histories.
