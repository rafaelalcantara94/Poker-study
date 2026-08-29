# Poker Study V5 — Study Engine

V5 preserva toda a base da V4.4 e adiciona uma camada de estudo orientada por dados.

## Novidades
- Central de Leaks com ranking de prioridade por recorrência, pendências, confiança e aulas concluídas.
- Plano de Estudos automático com blocos sugeridos e carga semanal.
- Evolução: estudo, mãos revisadas, profit e ROI por semana.
- Banco de mãos com filtros por status, prioridade, formato, tema, posição e busca livre por spot/tag/street/stack.
- Mantém Analytics, SharkScope CSV, conversão USD/CNY, recuperação de senha, imagens, metas e relatórios.

## Atualização da V4.4
Não há migração SQL nesta versão. Substitua os arquivos do projeto no GitHub e aguarde o deploy da Vercel.

## Observação
A tela Evolução mostra associação temporal entre estudo e performance; ela não afirma causalidade. Quanto mais semanas de histórico forem registradas, mais útil fica a comparação.

## V5.1
- Mãos agora podem ser editadas e apagadas.
- Cadastro de mão abre em modo Registro rápido, com campos selecionáveis e tags em botões.
- Modo Completo continua disponível para preencher streets, análise, blinds e tags extras.
- Não exige novo SQL; usa as mesmas colunas já existentes da tabela hands.
