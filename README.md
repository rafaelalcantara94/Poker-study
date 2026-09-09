# Poker Study V8.9 — Performance Pass

- Corrige labels antigos para V8.9.
- Adiciona profiler leve do Stats HH.
- Cache persistente dos fatos derivados das Hand Histories no IndexedDB.
- Imports novos já salvam fatos pré-calculados.
- Base antiga é migrada preguiçosamente no primeiro carregamento; os próximos devem ser mais rápidos.
- Diagnóstico Inteligente V2 e universo auditável preservados.

Não requer SQL.


## V8.9.2 — Performance Pass
- Cache de sessão para os imports do Stats HH, evitando reler ~53k mãos do IndexedDB ao voltar para a aba.
- Memoização da visão estatística por conjunto de filtros.
- Invalidação automática dos caches ao importar/limpar dados.
- Nenhuma alteração no motor estatístico, benchmarks ou banco SQL.
