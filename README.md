# Poker Study V8.9 — Performance Pass

- Corrige labels antigos para V8.9.
- Adiciona profiler leve do Stats HH.
- Cache persistente dos fatos derivados das Hand Histories no IndexedDB.
- Imports novos já salvam fatos pré-calculados.
- Base antiga é migrada preguiçosamente no primeiro carregamento; os próximos devem ser mais rápidos.
- Diagnóstico Inteligente V2 e universo auditável preservados.

Não requer SQL.


## V9.0 — Performance Pass
- Cache de sessão para os imports do Stats HH, evitando reler ~53k mãos do IndexedDB ao voltar para a aba.
- Memoização da visão estatística por conjunto de filtros.
- Invalidação automática dos caches ao importar/limpar dados.
- Nenhuma alteração no motor estatístico, benchmarks ou banco SQL.


## V9.1.3 — Study Workflow UX
- Revisão operacional dentro do Replayer para sessões vindas do Stats HH.
- Classificação por mão: Correta, Dúvida, Possível leak, Rever teoria.
- Nota rápida persistente por mão e progresso da sessão.
- Próxima mão não revisada e indicadores na lista lateral.
- Persistência local sem migração SQL.
- Mantém o snapshot/performance da V8.9.2.


### V9.1.3
- revisão salva automaticamente com feedback visual
- progresso acompanha o escopo atual (Todas/Só priorizadas + classe)
- destino local de cada classificação fica explícito
- filas locais: Concluída, Dúvidas, Possíveis leaks e Teoria
- integração automática com Central de Leaks/Plano de Estudos ainda não é feita nesta versão


## V9.1.3 — Caixa de Revisões
- Nova área 📥 Revisões no menu.
- Consolida Dúvidas, Possíveis leaks, Rever teoria e histórico de Corretas.
- Mantém tudo local nesta etapa; nada é enviado automaticamente.
- Reabre a mão no Replayer quando a fonte ainda está carregada.
- Sem alterações de banco/SQL.
