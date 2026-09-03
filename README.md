# Poker Study V7.8.3 — Automatic LeakFinder

V7.8.3 adiciona o Resumo Automático de Leaks: ranqueia somente stats com benchmark validado, levando em conta desvio, amostra e importância do spot, com clique para auditoria e Replayer.

**SQL:** não é necessário nesta versão.

# Poker Study V7.7 — Unified LeakFinder + Audit

V7.7 integra a análise clássica ao LeakFinder avançado, exibe apenas stats com benchmark validado e corrige denominadores de Blind War, Probe/Donk e OOP Multiway Sandwich.


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


## V7.0 — Tracker Dashboard
- Novos filtros: posição, stack efetivo e número de jogadores, além de modalidade e datas.
- Auditorias de 3Bet, CBet Flop, Check-Raise e bb/100 respeitam todos os filtros ativos.
- Dentro da auditoria, o botão **Abrir no Replayer** monta uma sessão somente com as mãos do numerador da stat.
- O Replayer recebe um cabeçalho com o contexto da sessão e um botão para voltar ao Stats HH.
- As HH continuam locais no IndexedDB; não é necessário reimportar nem executar SQL.


### Novidades V7.0
- RFI e Limp com oportunidades reais
- Squeeze
- Call/Fold/4Bet após enfrentar 3Bet do próprio open
- Steal CO/BTN/SB e Fold BB vs Steal
- C-Bet Flop/Turn/River
- Fold vs C-Bet Flop
- Check-Raise separado por Flop/Turn/River
- Cards de stats clicáveis com auditoria e botão Abrir no Replayer
- Mantém modalidade, posição, stack, tamanho da mesa e datas

Não exige SQL novo e não exige reimportar as Hand Histories já salvas no navegador.


## V7.3
Corrige o gráfico de evolução para grandes bases de HH: cálculo de min/max sem espalhar dezenas de milhares de valores como argumentos e renderização com amostragem visual eficiente.


## V7.3 — Functionality Pass
- Ações rápidas agora executam funções reais.
- Relatório completo com resumo, gráfico, posições e impressão/Salvar PDF.
- Comparação de períodos com dois intervalos escolhidos pelo usuário.
- Exportação CSV respeita filtros atuais.
- Notas do Tracker salvas localmente no navegador.
- Gráfico em BB preservado; All-in EV continua pendente até validação do motor de equidade.
- Sem migração SQL.


## V7.7 — All-in EV / EVbb/100
- Nova linha amarela de All-in EV no gráfico de evolução.
- EVbb/100 exibido no painel e no relatório.
- Cálculo em big blinds usando o BB de cada Hand History.
- Equity exata quando o all-in ocorre no flop, turn ou river.
- All-ins pré-flop usam simulação determinística estável para manter o navegador responsivo em bases grandes.
- Side pots elegíveis ao Hero são tratados pelas contribuições finais da mão.
- All-ins sem cartas conhecidas dos oponentes não recebem ajuste e são informados na cobertura do motor.
- CSV inclui net_bb, allin_ev_bb, ev_delta_bb, equity e método.
- Não exige SQL novo nem reimportação das HH já salvas.


## V7.7 — LeakFinder benchmarks
- Ativa classificação automática Great / Too Tight / Aggro / Amostra insuficiente apenas para benchmarks explicitamente legíveis na referência H2N fornecida pelo usuário.
- Benchmarks iniciais: VPIP 29–32, PFR 20–24, 3Bet geral 10–11, WWSF 46+, RFI por posição (UTG/EP 18–20, HJ 28–30, CO 37–39, BTN 50–55, SB 40–50) e 3Bet total por posição (UTG/EP 6–7, HJ 8–9, CO 9–10, BTN 10–11, SB/BB 10–15).
- Stats sem benchmark validado permanecem neutras.
- Amostra mínima: 500 mãos em stats gerais e 100 oportunidades em rates.


## V7.8.3
- Corrige direção estratégica dos benchmarks de fold: acima da faixa = Too Tight; abaixo = Aggro.
- Resumo automático enfatiza o nome da stat e deixa Too Tight/Aggro como diagnóstico secundário.


## V7.8.3 — Leak Review Target
- O Resumo automático agora escolhe o conjunto correto para revisão.
- Frequência abaixo do benchmark: abre oportunidades em que a ação NÃO foi executada.
- Frequência acima do benchmark: abre as mãos em que a ação foi executada.
- A lógica vale também para stats de fold: o alvo é determinado pela direção numérica do desvio, enquanto Too Tight/Aggro continua sendo a interpretação estratégica.
- O botão Abrir no Replayer envia exatamente esse subconjunto.
- Sem alteração de banco/SQL.


## V7.8.3 — Opportunity Audit
- Corrige denominadores pre-flop nAI: open shove não conta como oportunidade de 3Bet nAI; 3Bet shove não conta como oportunidade de 4Bet.
- O LeakFinder passa a chamar misses de oportunidades válidas sem a ação, sem afirmar que seriam ações GTO obrigatórias.
- Mantém separadas oportunidade estatística e recomendação estratégica.
