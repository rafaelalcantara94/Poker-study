# Poker Study V6.1 — HH Stats Batch Import

Novo módulo **Stats HH (beta)** para importar múltiplas Hand Histories GG e calcular estatísticas do Hero.

Inclui: VPIP, PFR, 3Bet, Fold to 3Bet, C-Bet flop, Check-Raise, WTSD, W$SD, WWSF, chip bb/100 e breakdown por posição.

As HH do tracker são salvas localmente no IndexedDB do navegador e deduplicadas por Hand ID. O Replayer V5.9.1 foi preservado.

**SQL:** não é necessário nesta versão.


## V6.1
- Seleção de vários arquivos HH de uma vez.
- Importação de pasta inteira via seletor de diretório (Chrome/Edge).
- Leitura recursiva dos .txt da pasta escolhida.
- Progresso de importação e deduplicação por Hand ID preservada.
- Sem SQL novo.
