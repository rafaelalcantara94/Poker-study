# Poker Study V4.1

Atualização do importador para o CSV real do SharkScope em português.

- Detecta automaticamente as 22 colunas do CSV.
- Buy-in total = (Stake + Rake) × (1 + Reentradas/Recompras).
- Usa Prêmio para retorno e Resultado (incluindo Rake) para validação.
- Usa ID do Jogo para anti-duplicação.
- Detecta PKO/Bounty pelas Bandeiras/nome.
- Salva rake, reentradas, duração, moeda e flags.

## Atualização
1. Rode `upgrade_v4_to_v4_1.sql` no Supabase SQL Editor.
2. Substitua os arquivos do projeto pelos desta pasta e faça commit na `main`.
3. Aguarde o deploy da Vercel ficar Ready.
4. Importe o CSV em SharkScope / CSV.
