# Poker Study V4

A V4 mantém tudo da V3.1 e acrescenta:

- Analytics com filtros por período, site e formato
- Curva de profit acumulado
- Importação de torneios via CSV com mapeamento manual de colunas
- Estrutura pensada para CSV do SharkScope
- Duplicados ignorados por fingerprint
- Banco de mãos com prioridade, confiança e favoritos
- Filtros de revisão de mãos
- Métricas combinando resultados manuais + torneios importados
- Recuperação de senha da V3.1 mantida

## Atualizar da V3.1

1. Supabase > SQL Editor > New query.
2. Rode `upgrade_v3_1_to_v4.sql` inteiro.
3. No GitHub, substitua os arquivos antigos pelos arquivos desta V4.
4. Commit changes.
5. A Vercel deve publicar automaticamente.
6. Não altere as variáveis existentes `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`.

## SharkScope

A V4 usa importação CSV para não expor credenciais do SharkScope no frontend. A integração direta com a API deve ser feita no servidor (por exemplo, função serverless), nunca armazenando senha/chave privada no JavaScript do navegador.
