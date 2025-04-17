# Documentação da Classe Command

## Visão Geral

A classe `Command` foi desenvolvida para padronizar a definição e gerenciamento de comandos do bot WhatsApp. Esta classe encapsula todas as propriedades e comportamentos de um comando, fornecendo uma interface unificada para sua criação, execução e gerenciamento.

## Motivação

Anteriormente, os comandos eram definidos como objetos JavaScript simples nas funções, o que levava a inconsistências na estrutura e comportamento. A classe `Command` resolve esses problemas ao:

1. Estabelecer um padrão estrutural para todos os comandos
2. Fornecer métodos auxiliares para validação e execução
3. Implementar funcionalidades comuns como cooldown e estatísticas de uso
4. Facilitar a serialização e desserialização de comandos
5. Padronizar o retorno de mensagens com a classe `ReturnMessage`

## Estrutura da Classe

### Propriedades Principais

| Propriedade | Tipo | Descrição | Padrão |
|-------------|------|-----------|--------|
| `name` | string | Nome do comando (obrigatório) | `''` |
| `aliases` | array | Nomes alternativos para o comando | `[]` |
| `description` | string | Descrição do comando | `''` |
| `usage` | string | Exemplo de uso do comando | `''` |
| `category` | string | Categoria do comando | `'general'` |
| `needsMedia` | boolean | Se o comando requer mídia | `false` |
| `needsQuotedMsg` | boolean | Se o comando requer mensagem citada | `false` |
| `needsArgs` | boolean | Se o comando requer argumentos | `false` |
| `minArgs` | number | Número mínimo de argumentos | `0` |
| `adminOnly` | boolean | Se apenas administradores podem usar | `false` |
| `reactions` | object | Emojis usados para reagir à mensagem | `{ before: "⏳", after: "✅", error: "❌" }` |
| `cooldown` | number | Tempo mínimo entre usos (segundos) | `0` |
| `timeout` | number | Tempo máximo de execução (segundos) | `30` |
| `reply` | boolean | Se deve responder à mensagem original | `true` |
| `deleteOnComplete` | boolean | Se deve excluir a mensagem original após concluir | `false` |
| `method` | function | Função que implementa o comando (obrigatória) | `null` |
| `middlewares` | array | Middlewares para pré-processamento | `[]` |
| `active` | boolean | Se o comando está ativo | `true` |
| `hidden` | boolean | Se o comando deve ser oculto em listagens | `false` |
| `usesReturnMessage` | boolean | Se o comando usa o padrão ReturnMessage | `true` |

### Métodos

| Método | Descrição |
|--------|-----------|
| `isValid()` | Verifica se o comando tem todos os requisitos necessários |
| `execute(bot, message, args, group)` | Executa o comando e retorna o resultado (ReturnMessage, array de ReturnMessage, ou resultado legacy) |
| `trackUsage()` | Registra um uso bem-sucedido do comando |
| `checkCooldown(userId)` | Verifica se o comando está em cooldown para um usuário |
| `toJSON()` | Converte a instância para um objeto simples para serialização |
| `static fromJSON(data, method)` | Cria uma instância a partir de um objeto serializado |

## Utilização

### Criação de Comandos Básicos

```javascript
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

// Definindo um comando básico
const pingCommand = new Command({
  name: 'ping',
  description: 'Verifica se o bot está online',
  category: 'utility',
  method: async (bot, message, args, group) => {
    const chatId = message.group || message.author;
    return new ReturnMessage({
      chatId,
      content: 'Pong! 🏓'
    });
  }
});

// Exportando o comando
module.exports = { commands: [pingCommand] };
```

### Comando com Requisitos e Validações

```javascript
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

// Definindo um comando com requisitos
const stickerCommand = new Command({
  name: 'sticker',
  description: 'Converte mídia em sticker',
  usage: '!sticker [nome]',
  category: 'media',
  needsMedia: true,
  reactions: {
    before: "🖼",
    after: "✅",
    error: "❌"
  },
  cooldown: 5, // 5 segundos de cooldown
  method: async (bot, message, args, group) => {
    const chatId = message.group || message.author;
    
    // Implementação do comando...
    
    return new ReturnMessage({
      chatId,
      content: message.content,
      options: {
        sendMediaAsSticker: true,
        stickerName: args.join(' ') || 'sticker'
      }
    });
  }
});
```

### Comando com Múltiplas Respostas

```javascript
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

// Definindo um comando que retorna múltiplas mensagens
const multiMsgCommand = new Command({
  name: 'help',
  description: 'Mostra ajuda sobre comandos',
  category: 'info',
  method: async (bot, message, args, group) => {
    const chatId = message.group || message.author;
    
    // Retorna um array de ReturnMessage
    return [
      new ReturnMessage({
        chatId,
        content: '📘 *Lista de Comandos*',
      }),
      new ReturnMessage({
        chatId,
        content: 'Use !comando para executar um comando',
        delay: 500
      })
    ];
  }
});
```

### Comando Legacy (compatibilidade retroativa)

```javascript
const Command = require('../models/Command');

// Definindo um comando que não usa ReturnMessage (modo legado)
const legacyCommand = new Command({
  name: 'legacy',
  description: 'Comando no modo legado',
  usesReturnMessage: false, // Indica que não usa ReturnMessage
  method: async (bot, message, args, group) => {
    const chatId = message.group || message.author;
    // Usa sendMessage diretamente em vez de retornar ReturnMessage
    await bot.sendMessage(chatId, 'Este é um comando no modo legado');
    // Não precisa retornar nada
  }
});
```

## Integração com CommandHandler

A classe Command é projetada para trabalhar com o método `sendReturnMessages` do bot, que pode processar tanto uma única instância de ReturnMessage quanto um array de ReturnMessages. O CommandHandler executa o método `execute` da classe Command, que:

1. Se `usesReturnMessage` for `true` (padrão):
   - Espera que o método retorne uma instância de ReturnMessage ou um array de ReturnMessages
   - Passa o resultado para `bot.sendReturnMessages`

2. Se `usesReturnMessage` for `false` (modo legado):
   - Assume que o método gerencia o envio de mensagens por conta própria
   - Não espera um retorno significativo

## Compatibilidade com FixedCommands

A classe `FixedCommands` agora suporta tanto os comandos no formato de objetos simples quanto as instâncias da classe `Command`. Ao carregar os módulos de comandos, ela verifica o tipo e:

1. Se for uma instância de `Command`, usa-a diretamente
2. Se for um objeto simples, converte-o em uma instância de `Command`

## Migração de Comandos Existentes

Para migrar comandos existentes para o novo formato, siga os passos:

1. Importe a classe `Command` no módulo de comandos
2. Converta o objeto de comando para uma instância de `Command`
3. Atualize o método para retornar instâncias de `ReturnMessage`

### Exemplo de Migração

**Antes:**

```javascript
const commands = [
  {
    name: 'sticker',
    description: 'Converte mídia em sticker',
    needsMedia: true,
    reactions: {
      before: "🖼",
      after: "✅",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      await bot.sendMessage(chatId, 'Criando sticker...');
      // Processamento...
      await bot.sendMessage(chatId, media, { sendMediaAsSticker: true });
    }
  }
];
```

**Depois:**

```javascript
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const commands = [
  new Command({
    name: 'sticker',
    description: 'Converte mídia em sticker',
    needsMedia: true,
    reactions: {
      before: "🖼",
      after: "✅",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      // Retorna array de ReturnMessage
      return [
        new ReturnMessage({
          chatId,
          content: 'Criando sticker...'
        }),
        new ReturnMessage({
          chatId,
          content: message.content,
          options: {
            sendMediaAsSticker: true,
            stickerName: args.join(' ') || 'sticker'
          },
          delay: 500
        })
      ];
    }
  })
];
```