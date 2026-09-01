# Poker Study V6.1.1 — HH Stats Batch Import

Novo módulo **Stats HH (beta)** para importar múltiplas Hand Histories GG e calcular estatísticas do Hero.

Inclui: VPIP, PFR, 3Bet, Fold to 3Bet, C-Bet flop, Check-Raise, WTSD, W$SD, WWSF, chip bb/100 e breakdown por posição.

As HH do tracker são salvas localmente no IndexedDB do navegador e deduplicadas por Hand ID. O Replayer V5.9.1 foi preservado.

**SQL:** não é necessário nesta versão.


## V6.1.1
- Seleção de vários arquivos HH de uma vez.
- Importação de pasta inteira via seletor de diretório (Chrome/Edge).
- Leitura recursiva dos .txt da pasta escolhida.
- Progresso de importação e deduplicação por Hand ID preservada.
- Sem SQL novo.


## V6.1.1 — Auditoria profunda
- Clique em 3Bet, CBet F, XR e bb/100 por posição para abrir as mãos que compõem a estatística.
- Exibe Hand ID, data, cartas, stack, ações relevantes e se a mão entrou no numerador.
- Nenhuma alteração de banco/SQL.


## V6.2 — modalidades e filtro de datas
- HH Stats identifica NL Hold'em, PLO/Omaha, PLO5/Omaha 5 e outros.
- NL Hold'em é o filtro padrão; Omaha não contamina mais as stats de Hold'em.
- Filtros de data inicial/final por mão.
- Auditoria respeita os filtros ativos.
- Sem alteração de SQL/Supabase.
