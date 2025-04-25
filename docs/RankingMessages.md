# Comandos de Ranking de Mensagens

O módulo `RankingMessages.js` implementa funcionalidades para rastrear a atividade dos membros em grupos e exibir rankings de participação.

## Comandos Disponíveis

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `!faladores` | Mostra o ranking de quem mais fala no grupo | `!faladores` |

## Detalhes do comando

### !faladores

Este comando exibe um ranking dos membros mais ativos do grupo com base na quantidade de mensagens enviadas.

#### Funcionalidades:
- Rastreia automaticamente todas as mensagens enviadas no grupo
- Mantém estatísticas persistentes por grupo
- Exibe um ranking dos usuários mais ativos
- Mostra estatísticas gerais do grupo

#### Como usar:
- Digite `!faladores` em qualquer grupo para ver o ranking

#### Formato da resposta:
A resposta inclui:
- Um cabeçalho "🏆 Ranking de faladores do grupo 🏆"
- Lista dos 10 usuários mais ativos, ordenados por número de mensagens
- Medalhas para os três primeiros lugares (🥇, 🥈, 🥉)
- Estatísticas gerais, incluindo total de mensagens e total de participantes

#### Limitações:
- Apenas disponível em grupos (não em chats privados)
- Rastreia apenas mensagens de texto (não mídia ou outras interações)
- Armazena dados apenas para grupos onde o bot está presente

#### Comportamento especial:
- O rastreamento de mensagens acontece em segundo plano, sem necessidade de comandos
- Os dados são salvos em arquivos JSON, persistindo mesmo após reinicialização do bot
- Os nomes dos usuários são atualizados a cada mensagem enviada

#### Funcionamento interno:

O sistema funciona em duas partes principais:

1. **Rastreamento automático de mensagens**:
   - Cada mensagem enviada em um grupo é processada pela função `processMessage`
   - A função extrai o ID do usuário e seu nome atual
   - Atualiza o contador de mensagens para o usuário no arquivo de ranking do grupo

2. **Comando para exibir o ranking**:
   - Quando o comando `!faladores` é invocado, o sistema lê os dados armazenados
   - Ordena os usuários pelo número de mensagens (decrescente)
   - Formata e exibe o resultado com formatação visual apropriada

#### Dicas:
- O comando pode ser usado para incentivar a participação no grupo
- As estatísticas são mantidas mesmo que o bot seja removido e adicionado novamente ao grupo
- Os apelidos definidos com o comando `!apelido` não afetam o ranking, que usa os nomes dos contatos