# Poker Study V8.3 — Action Outcome Engine (Beta)

V8.3 separa o resultado da decisão pré-flop em Fold / Call / Raise nAI / Raise AI antes da triagem estratégica.

Para leaks de 3Bet nAI abaixo do benchmark, Raise AI (shove) deixa de ser tratado como oportunidade passiva sem 3Bet nAI e é excluído da fila principal. A revisão estratégica passa a considerar somente Fold + Call e, em seguida, aplica o Strategic Range Engine contextual.

O modal de auditoria mostra o funil real: oportunidades sem a ação, shoves excluídos, calls, folds, decisões passivas válidas e candidatos estratégicos finais.

Não é solver/GTO e não afirma que os candidatos deveriam obrigatoriamente executar a ação.

Sem mudanças de banco de dados / SQL. Não é necessário reimportar Hand Histories.


## V8.3 — Strategic Priority Engine expandido
- Expande a triagem contextual para RFI, 4Bet nAI/total, Fold to 3Bet nAI e Blind War (SB Walk / BB ISO nAI).
- Mantém separação por resultado da ação e níveis Forte / Mix / Fronteira.
- Heurística de revisão: não substitui solver/GTO.
- Sem migração SQL.
