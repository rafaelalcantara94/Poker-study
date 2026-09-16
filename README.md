## V13.1.0 — Room-Aware Coach

- Central do Time agora aplica Sala ao recorte estatístico inteiro, não apenas ao seletor.
- Jogadores sem dados na sala selecionada deixam de contaminar Focus #1, leaks, agenda e gestão individual.
- Período + Sala usam a view específica publicada pelo Stats HH; não há fallback silencioso para "Todas as salas".
- Review Packs abertos pela Central respeitam a sala selecionada quando as mãos sincronizadas possuem essa sala.
- Diagnósticos temporários Multi-Room removidos da interface.
- Mantém cache incremental/performance da V13.0.x.
- Sem SQL novo.
