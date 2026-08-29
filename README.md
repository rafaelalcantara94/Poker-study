# Poker Study V3

## Principais novidades
- Imagem em cada mão, salva em bucket privado do Supabase Storage
- Detalhes por street: pré-flop, flop, turn e river
- Site, formato, blinds, stack efetivo e posições
- Tags em mãos e estudos
- Leaks automáticos por tema/tag
- Metas
- Filtro por período no dashboard
- Resultados por site e formato
- Relatórios consolidados
- Formulários melhores

## Atualização da sua V2
1. Supabase > SQL Editor.
2. Rode todo o arquivo `upgrade_v2_to_v3.sql`.
3. No GitHub, substitua os arquivos antigos pelos desta V3.
4. Faça Commit.
5. A Vercel deve publicar automaticamente.
6. Mantenha as mesmas variáveis:
   - VITE_SUPABASE_URL
   - VITE_SUPABASE_PUBLISHABLE_KEY

Nunca use a `sb_secret_...` no frontend.
