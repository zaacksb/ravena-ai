# Design Patterns

Este projeto incorpora diversos padrões de design para promover modularidade, extensibilidade e manutenibilidade. Abaixo estão os principais padrões adotados:

## Singleton

O padrão Singleton é utilizado para garantir que certas classes tenham apenas uma instância em toda a aplicação, fornecendo um ponto de acesso global a ela.

**Exemplos no código:**
- `Database`: Gerencia uma única conexão com o banco de dados
- `Logger`: Implementação que centraliza o sistema de logs

```javascript
// Implementação do padrão Singleton na classe Database
static getInstance() {
  if (!Database.instance) {
    Database.instance = new Database();
  }
  return Database.instance;
}
```

## Observer/Event Emitter

Utilizado para desacoplar componentes e permitir comunicação assíncrona entre diferentes partes do sistema.

**Exemplos no código:**
- `EventHandler`: Gerencia eventos do WhatsApp
- `StreamMonitor`: Emite eventos quando canais de streaming mudam de estado

```javascript
// StreamMonitor herdando de EventEmitter
class StreamMonitor extends EventEmitter {
  // ...
  
  // Emitindo eventos baseados em mudanças de estado
  if (isLiveNow && !wasLive) {
    this.emit('streamOnline', {
      platform: 'twitch',
      channelName: channelName,
      // ...
    });
  }
}
```

## Command

O padrão Command é amplamente utilizado na estrutura de comandos do bot, permitindo encapsular requisições como objetos.

**Exemplos no código:**
- `CommandHandler`: Processa comandos
- `FixedCommands`: Define comandos estáticos
- Sistema de comandos personalizados para grupos

```javascript
// Definição de comandos como objetos
const commands = [
  {
    name: 'sticker',
    description: 'Converte mídia em sticker',
    needsMedia: true,
    reactions: { /* ... */ },
    method: async (bot, message, args, group) => { /* ... */ }
  }
]
```

## Factory Method

Utilizado para criar objetos sem especificar a classe exata do objeto a ser criado.

**Exemplos no código:**
- `createMedia`: Cria objetos MessageMedia
- Criação de comandos personalizados

```javascript
// Factory Method para criação de objetos de mídia
async createMedia(filePath) {
  try {
    return MessageMedia.fromFilePath(filePath);
  } catch (error) {
    this.logger.error(`Erro ao criar mídia de ${filePath}:`, error);
    throw error;
  }
}
```

## Builder Pattern (via ReturnMessage)

Implementado através do novo sistema ReturnMessage, que permite construir objetos complexos passo a passo.

**Exemplos no código:**
- `ReturnMessage`: Constrói mensagens com propriedades variadas
- Configurações personalizáveis para cada mensagem

```javascript
// Uso do padrão Builder através do ReturnMessage
const message = new ReturnMessage({
  chatId: group.id,
  content: media,
  options: {
    caption: "Imagem processada com sucesso",
    sendMediaAsSticker: false
  },
  reactions: {
    before: "⏳",
    after: "✅"
  },
  delay: 500
});
```

## Strategy

Permite definir uma família de algoritmos, encapsulá-los e torná-los intercambiáveis.

**Exemplos no código:**
- `LLMService`: Diferentes estratégias para obter completions (OpenAI, OpenRouter, Local)
- Processadores de mídia com diferentes estratégias de manipulação

```javascript
// Diferentes estratégias para completions em LLMService
async getCompletion(options) {
  switch (options.provider || 'openai') {
    case 'openrouter':
      response = await this.openRouterCompletion(options);
      break;
    case 'local':
      response = await this.openAICompletion({ ...options, useLocal: true });
      break;
    case 'openai':
    default:
      response = await this.openAICompletion(options);
      break;
  }
}
```

## Adapter

Converte a interface de uma classe em outra interface que os clientes esperam.

**Exemplos no código:**
- Adaptação de diferentes APIs (Twitch, Kick, YouTube)
- Formatação de mensagens de diferentes plataformas

```javascript
// Adapta diferentes APIs de plataformas de streaming
async _pollTwitchChannels() {
  // Lógica específica para Twitch
}

async _pollKickChannels() {
  // Lógica específica para Kick, adaptada para interface comum
}

async _pollYoutubeChannels() {
  // Lógica específica para YouTube, adaptada para interface comum
}
```

## Facade

Fornece uma interface unificada para um conjunto de interfaces em um subsistema.

**Exemplos no código:**
- `WhatsAppBot`: Fornece uma fachada para as funcionalidades do WhatsApp
- `BotAPI`: Fornece uma fachada HTTP para interagir com o bot

```javascript
// WhatsAppBot como uma fachada para interação com WhatsApp
class WhatsAppBot {
  async sendMessage(chatId, content, options = {}) { /* ... */ }
  async sendReturnMessages(returnMessages) { /* ... */ }
  async createMedia(filePath) { /* ... */ }
  // ...
}
```

## Chain of Responsibility

Permite que múltiplos objetos tenham chance de processar requisições.

**Exemplos no código:**
- Processamento de comandos (comandos fixos, personalizados, gerenciamento)
- Filtros de mensagem em cascata

```javascript
// Chain of Responsibility no processamento de comandos
async processCommand(bot, message, command, args, group) {
  // Verifica se é um comando de gerenciamento
  if (command.startsWith('g-')) {
    // Processa comando de gerenciamento
    return;
  }
  
  // Verifica se o grupo está pausado
  if (group && group.paused) {
    return;
  }
  
  // Verifica se é um comando fixo
  const fixedCommand = this.fixedCommands.getCommand(command);
  if (fixedCommand) {
    await this.executeFixedCommand(/* ... */);
    return;
  }
  
  // Verifica se é um comando personalizado
  if (group && this.customCommands[group.id]) {
    // ...
  }
}
```

## Composite

Permite tratar objetos individuais e composições de objetos de maneira uniforme.

**Exemplos no código:**
- Sistema de ReturnMessage (mensagem individual vs. array de mensagens)
- Estruturas compostas em menus e comandos aninhados

```javascript
// Tratamento uniforme de mensagem única ou múltiplas mensagens
async sendReturnMessages(returnMessages) {
  // Ensure returnMessages is an array
  if (!Array.isArray(returnMessages)) {
    returnMessages = [returnMessages];
  }
  
  // Processa cada mensagem da mesma forma
  for (const message of validMessages) {
    // ...
  }
}
```

## Conclusão

A aplicação destes padrões de design resultou em um código mais modular, extensível e fácil de manter. A nova implementação do ReturnMessage incorpora elementos de Builder e Composite, permitindo maior flexibilidade na construção e envio de mensagens.

Os padrões adotados facilitam a adição de novos recursos e a manutenção do código existente, tornando o projeto mais robusto e adaptável a mudanças futuras.