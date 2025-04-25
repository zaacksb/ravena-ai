# CommandHandler

O CommandHandler é o componente central responsável por processar e gerenciar todos os comandos do bot Ravenabot. Ele coordena a execução de comandos fixos, personalizados e de gerenciamento.

## Funcionalidades Principais

- Processamento de comandos enviados pelos usuários
- Gerenciamento de permissões e verificações de administrador
- Gerenciamento de cooldowns para limitar o uso de comandos
- Suporte a comandos fixos, personalizados e de gerenciamento
- Execução de comandos acionados por reações ou menções
- Processamento de variáveis em comandos personalizados

## Métodos Importantes

### `handleCommand(bot, message, commandText, group)`

Processa um comando recebido. Este é o ponto de entrada principal quando um comando é detectado em uma mensagem.

### `processCommand(bot, message, command, args, group)`

Identifica o tipo de comando (fixo, personalizado ou gerenciamento) e encaminha para o manipulador adequado.

### `executeFixedCommand(bot, message, command, args, group)`

Executa um comando fixo, aplicando verificações de permissão, cooldown e outras validações.

### `executeCustomCommand(bot, message, command, args, group)`

Executa um comando personalizado, processando variáveis e enviando respostas.

### `processManagementCommand(bot, message, command, args, group)`

Processa comandos de gerenciamento, verificando permissões de administrador antes.

### `checkAutoTriggeredCommands(bot, message, text, group)`

Verifica e executa comandos acionados automaticamente (sem necessidade de prefixo).

## Gestão de Cooldowns

O CommandHandler inclui um sistema completo de cooldowns para limitar a frequência de uso de comandos:

- `checkCooldown(command, groupId)` - Verifica se um comando está em cooldown
- `updateCooldown(command, groupId)` - Atualiza o timestamp de cooldown
- `handleCooldownMessage(bot, message, command, groupId, cooldownInfo)` - Envia mensagem de cooldown
- `formatCooldownTime(seconds)` - Formata o tempo de cooldown para exibição

## Processamento de Reações

O CommandHandler trabalha em conjunto com o ReactionsHandler para processar comandos acionados por reações a mensagens, utilizando o método:

- `delayedReaction(msg, emoji, delay)` - Aplica uma reação com atraso

## Como Usar

O CommandHandler é inicializado pelo EventHandler e não precisa ser instanciado diretamente. Para adicionar comandos que serão processados pelo CommandHandler, você deve:

1. Criar comandos fixos seguindo o modelo Command e adicioná-los à pasta `src/functions/`
2. Ou adicionar comandos personalizados através do comando `!g-addCmd` em um grupo

## Exemplo de Uso

```javascript
// Este código é executado internamente pelo EventHandler
const commandText = "ping"; // Comando sem prefixo
commandHandler.handleCommand(bot, message, commandText, group);
```

## Dependências

- `FixedCommands` - Gerencia comandos fixos definidos no código
- `Management` - Gerencia comandos de administração de grupo
- `SuperAdmin` - Gerencia comandos de super administrador
- `CustomVariableProcessor` - Processa variáveis em comandos personalizados
- `Database` - Acesso ao banco de dados para comandos personalizados
- `ReturnMessage` - Modelo para mensagens de retorno padronizadas