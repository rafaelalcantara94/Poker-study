# Poker Study V4.3

- Corrige Analytics para CSVs SharkScope com múltiplas moedas (USD + CNY).
- Auditoria de importação e calibração do câmbio pelo Profit exibido no SharkScope.
- Reimportação atualiza torneios existentes sem duplicar.
- Filtro de período usa a última data disponível nos dados, não o relógio do navegador.
- Datas personalizadas, faixa de buy-in e opção de excluir satélites.
- Gráfico acumulado com eixos, datas e tooltip.

## Atualização
1. Rode `upgrade_v4_2_to_v4_3.sql` no Supabase SQL Editor.
2. Substitua os arquivos no GitHub.
3. Aguarde a Vercel publicar e use Ctrl+F5.
4. No importador, carregue o CSV, informe o Profit que o SharkScope mostra para o mesmo filtro e clique em Calibrar.
5. Confira a auditoria e só então clique em Importar/atualizar.
