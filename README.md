# Poker Study V8.7 — Smart Leak Concentration

Baseada na V8.6. Mantém Analytics com filtros aplicados por Buscar/Limpar e o motor V8.5 aprovado.

## V8.7
- nova seção **Onde revisar primeiro** dentro do Diagnóstico do Leak;
- cruza posição do agressor, stack efetivo e classe de mão;
- calcula a frequência observada em cada recorte contra o benchmark já validado;
- pondera o destaque pela amostra para evitar recortes minúsculos dominando o diagnóstico;
- cada recorte é clicável e abre exatamente aquele conjunto no Replayer;
- Forte/Mix/Fronteira continua sendo apenas priorização; o diagnóstico não afirma estratégia GTO.

Não requer SQL nem reimportação das HHs.
