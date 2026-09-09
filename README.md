# Poker Study V8.8 — Smart Leak Concentration Ranking

Baseada na V8.6. Mantém Analytics com filtros aplicados por Buscar/Limpar e o motor V8.5 aprovado.

## V8.8
- nova seção **Onde revisar primeiro** dentro do Diagnóstico do Leak;
- cruza posição do agressor, stack efetivo e classe de mão;
- calcula a frequência observada em cada recorte contra o benchmark já validado;
- pondera o destaque pela amostra para evitar recortes minúsculos dominando o diagnóstico;
- cada recorte é clicável e abre exatamente aquele conjunto no Replayer;
- Forte/Mix/Fronteira continua sendo apenas priorização; o diagnóstico não afirma estratégia GTO.

Não requer SQL nem reimportação das HHs.


### V8.8 — ranking corrigido
- `Onde revisar primeiro` agora combina desvio, amostra e relevância estratégica.
- Recortes com candidatos Forte/Mix/Fronteira ganham prioridade no ranking.
- `Trash / Outras` permanece totalmente auditável, mas recebe peso baixo para não dominar o Top 4 apenas por volume e folds naturais.
- Nenhuma oportunidade é removida do universo; a alteração é somente na ordem das recomendações de revisão.


## V8.8 — composição das classes nos recortes
- `Onde revisar primeiro` agora mostra, em recortes de posição do agressor + stack, as 2–3 classes de mão estrategicamente mais relevantes daquele subconjunto.
- O ranking da V8.7.1 foi preservado; nenhuma oportunidade é removida e o universo auditável permanece intacto.
- O objetivo é fechar o caminho Stat → contexto → stack → classe de mão → Replayer sem poluir o painel principal.
