# Documentação de Comandos

## FixedCommands.js

Esta classe gerencia os comandos fixos do sistema, que são aqueles definidos em código e carregados da pasta `functions`.

### Principais funcionalidades:

- **loadCommands()**: Carrega todos os módulos de comando presentes na pasta `functions`.
- **getCommand(name)**: Obtém um comando específico pelo nome.
- **getAllCommands()**: Retorna todos os comandos carregados.

### Uso:

```javascript
const FixedCommands = require('./commands/FixedCommands');

// Inicializa o gerenciador de comandos fixos
const fixedCommands = new FixedCommands();

// Carrega todos os comandos disponíveis
await fixedCommands.loadCommands();

// Obtém um comando específico
const pingCommand = fixedCommands.getCommand('ping');

// Lista todos os comandos
const allCommands = fixedCommands.getAllCommands();
```

## Management.js

Esta classe implementa comandos de gerenciamento de grupo, permitindo aos administradores configurar o bot.

### Principais funcionalidades:

- Gestão de comandos personalizados
- Configuração de prefixo de comandos
- Gerenciamento de mensagens de boas-vindas e despedida
- Configuração de filtros (palavras, links, NSFW)
- Monitoramento de streams (Twitch, Kick, YouTube)
- Gerenciamento de administradores
- Controle de interações automáticas

### Principais métodos:

- **setGroupName**: Define o nome do grupo
- **addCustomCommand**: Adiciona um comando personalizado
- **setCustomPrefix**: Altera o prefixo de comando para o grupo
- **setWelcomeMessage**: Define a mensagem de boas-vindas
- **showGroupInfo**: Mostra informações detalhadas do grupo
- **filterWord**: Adiciona/remove palavras do filtro
- **pauseGroup**: Pausa/retoma a atividade do bot no grupo
- **toggleTwitchChannel**: Ativa/desativa monitoramento de um canal da Twitch

### Uso:

```javascript
const Management = require('./commands/Management');

// Inicializa o gerenciador de comandos de gerenciamento
const management = new Management();

// Obtém um método de comando
const methodName = management.getCommandMethod('setName');
if (methodName) {
  // Executa o método
  const result = await management[methodName](bot, message, args, group);
}
```