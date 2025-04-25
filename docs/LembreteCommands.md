# Comandos de Lembretes

O módulo `LembretesCommands.js` implementa funcionalidades para criar, gerenciar e visualizar lembretes programados com conteúdo de texto e mídia.

## Comandos Disponíveis

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `!lembrar` | Configura um lembrete para uma data específica | Use respondendo a uma mensagem com `!lembrar amanhã às 10:00` |
| `!lembretes` | Lista os lembretes ativos | `!lembretes` |
| `!l-cancelar` | Cancela um lembrete por ID | `!l-cancelar <id>` |

## Detalhes dos comandos

### !lembrar

Este comando permite configurar um lembrete para ser enviado em uma data e hora específicas. O lembrete pode incluir texto e/ou mídia da mensagem citada.

#### Funcionalidades:
- Programa lembretes com data e hora específicas
- Permite incluir texto da mensagem citada
- Permite incluir mídia da mensagem citada (imagens, vídeos, áudios, etc.)
- Utiliza processamento de linguagem natural para interpretar datas em formato livre

#### Parâmetros:
- **data/hora**: Data e hora para o lembrete (em formato livre)
  - Exemplo: `!lembrar amanhã às 10:00`
  - Exemplo: `!lembrar 17/04/2025 07:30`
  - Exemplo: `!lembrar segunda-feira às 15h`

#### Como usar:
1. Responda a uma mensagem (que pode conter texto e/ou mídia)
2. Digite `!lembrar` seguido da data/hora desejada

#### Formato da resposta:
A resposta de confirmação inclui:
- Confirmação de que o lembrete foi configurado
- Data e hora formatadas
- ID único do lembrete (necessário para cancelamento)

#### Reações de emoji:
- Antes de processar: ⏳
- Após processamento bem-sucedido: ⏰

#### Limitações:
- O temporizador máximo no JavaScript é de 24h, então lembretes com mais de 24h são verificados periodicamente
- Mídia muito grande pode não ser salva corretamente

### !lembretes

Este comando lista todos os lembretes ativos do usuário ou do grupo.

#### Funcionalidades:
- Lista todos os lembretes ativos
- Mostra a data e hora de cada lembrete
- Mostra o tempo restante até cada lembrete
- Exibe o conteúdo resumido do lembrete
- Indica se o lembrete contém mídia

#### Formato da resposta:
A resposta inclui:
- Lista de lembretes ativos com seus respectivos IDs
- Data e hora formatadas para cada lembrete
- Tempo restante para cada lembrete (dias, horas, minutos)
- Texto do lembrete (limitado a 50 caracteres)
- Indicador de mídia (📎) se o lembrete contiver mídia

#### Reações de emoji:
- Antes de processar: ⏳
- Após processamento bem-sucedido: 📋

### !l-cancelar

Este comando permite cancelar um lembrete específico usando seu ID.

#### Funcionalidades:
- Cancela um lembrete programado
- Remove os arquivos de mídia associados ao lembrete (se houver)
- Verifica permissões (apenas o criador do lembrete pode cancelá-lo)

#### Parâmetros:
- **id**: ID único do lembrete a ser cancelado
  - Exemplo: `!l-cancelar abc123`

#### Formato da resposta:
A resposta inclui:
- Confirmação de que o lembrete foi cancelado
- ID do lembrete cancelado

#### Reações de emoji:
- Antes de processar: ⏳
- Após processamento bem-sucedido: 🗑

#### Comportamento especial:
- Quando um lembrete é disparado, o bot envia:
  - O texto do lembrete com um prefixo "⏰ LEMBRETE!"
  - A mídia associada (se houver) com o texto como legenda
- Os lembretes são verificados periodicamente para garantir que não sejam perdidos, mesmo após reinicialização do bot

#### Dicas:
- Para lembretes com apenas hora (como `!lembrar 14:30`), se a hora já tiver passado hoje, o lembrete será agendado para o dia seguinte
- Use `!lembretes` para obter os IDs necessários para cancelamento
- A interpretação de datas aceita formatos naturais como "amanhã", "próxima terça", "em 3 dias", etc.