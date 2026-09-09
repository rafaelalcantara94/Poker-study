# Poker Study V10.0 — Team Reload

Adiciona o módulo Reload preparado para times, com solicitação multi-site, visão do gestor, histórico, relatório financeiro, exportação CSV e Make Up por razão independente.

## IMPORTANTE
Execute `upgrade_v9_9_1_to_v10_0_team_reload.sql` no Supabase SQL Editor antes de abrir a aba Reload.

O primeiro usuário que abrir o módulo cria automaticamente um time pessoal e entra como owner. A arquitetura já usa team_id, user_id e roles para a futura expansão multiusuário.

# Poker Study V9.7 — Leak Goals

## Novidades
- Integra a Caixa de Revisões à Central de Leaks e ao Plano de Estudos.
- Revisões enviadas são agrupadas pelo tema/stat de origem.
- Central de Leaks mostra confirmações manuais separadas do ranking automático.
- Plano de Estudos coloca itens enviados como `TEORIA CONFIRMADA` no topo da fila.
- Cada revisão enviada preserva cartas, posição, stack, nota, data e link de retorno ao Replayer quando o snapshot estiver disponível.
- Enviar continua sendo uma ação manual; nada é promovido automaticamente.
- Itens enviados permanecem em Todas/Resolvidas na Caixa de Revisões.
- Mantém snapshot/cache de performance do Stats HH.

## Banco de dados
Nenhum SQL novo é necessário. A V9.7 cria metas automáticas dos leaks a partir das revisões já salvas e do snapshot local do Stats HH.


## V9.7 — Leak Goals
- Metas automáticas para leaks confirmados.
- Objetivo orientado pela faixa de referência (aproximação, não aumento cego).
- Linha de base, valor atual, oportunidades e progresso.
- Metas manuais permanecem separadas.


## V9.7 — Study Execution
Plano de Estudos agora inicia sessões executáveis na aba Estudos, com cronômetro, mãos relacionadas, anotações e conclusão registrada no histórico. Sem SQL novo.

## V9.7 — Central do Dia
- Dashboard reorganizado para responder rapidamente o que merece atenção agora.
- KPIs operacionais: revisões pendentes, leaks confirmados, próximo estudo e tempo estudado na semana.
- Ações rápidas para Revisões, Estudos e Stats HH.
- Performance recente resumida sem duplicar o Analytics; filtros continuam disponíveis em área recolhível.
- Foco técnico usa o snapshot do Stats HH quando disponível, sem alterar cálculos estatísticos.
- Sem alterações de banco/SQL.

## V9.9.1 — Sessão de Estudo Guiada
- sessão ativa agora exibe um fluxo de 3 etapas: revisar mãos, extrair aprendizado e fechar sessão;
- cada mão relacionada aceita um aprendizado/decisão próprio, salvo localmente durante a sessão;
- progresso visual das mãos revisadas;
- abrir a mão no Replayer preserva a sessão ativa para retorno posterior;
- conclusão grava também os aprendizados por mão no registro de Estudos;
- atualização de branding do shell para V9.9.1.
- Sem SQL novo.


## V10.0 final DB sync
Frontend alinhado ao schema executado no Supabase: status `paid` é exibido como **Enviado** e notas de decisão usam `manager_note`.
