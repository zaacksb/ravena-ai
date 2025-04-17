Command# Documentação da Classe Command

## Visão Geral

A classe `Command` foi desenvolvida para padronizar a definição e gerenciamento de comandos do bot WhatsApp. Esta classe encapsula todas as propriedades e comportamentos de um comando, fornecendo uma interface unificada para sua criação, execução e gerenciamento.

## Motivação

Anteriormente, os comandos eram definidos como objetos JavaScript simples nas funções, o que levava a inconsistências na estrutura e comportamento. A classe `Command` resolve esses problemas ao:

1. Estabelecer um padrão estrutural para todos os comandos
2. Fornecer métodos auxiliares para validação e execução
3. Implementar funcionalidades comuns como cooldown e estatísticas de uso
4. Facilitar a serialização e desserialização de comandos

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

### Métodos

| Método | Descrição |
|--------|-----------|
| `isValid()` | Verifica se o comando tem todos os requisitos necessários |
| `execute(bot, message, args, group)` | Executa o comando e retorna o resultado |
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

## Integração com CommandHandler

Para integrar a classe `Command` ao `CommandHandler`, o método `executeFixedCommand` deve ser adaptado para trabalhar com instâncias de `Command`:

```javascript
async executeFixedCommand(bot, message, command, args, group) {
  try {
    // Verifica se é uma instância de Command
    const isCommandInstance = command instanceof Command;
    
    // Verifica requisitos se for uma instância de Command
    if (isCommandInstance) {
      // Verifica mensagem citada
      if (command.needsQuotedMsg) {
        const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
        if (!quotedMsg) {
          this.logger.debug(`Comando ${command.name} requer mensagem citada, mas nenhuma foi fornecida`);
          return;
        }
      }
      
      // Verifica mídia
      if (command.needsMedia) {
        const hasDirectMedia = message.type !== 'text';
        let hasQuotedMedia = false;
        
        if (!hasDirectMedia) {
          const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
          hasQuotedMedia = quotedMsg && quotedMsg.hasMedia;
        }
        
        if (!hasDirectMedia && !hasQuotedMedia) {
          this.logger.debug(`Comando ${command.name} requer mídia, mas nenhuma foi fornecida`);
          return;
        }
      }
      
      // Verifica argumentos
      if (command.needsArgs && (!args || args.length < command.minArgs)) {
        const returnMessage = new ReturnMessage({
          chatId: message.group || message.author,
          content: `Este comando requer pelo menos ${command.minArgs} argumento(s). Uso correto: ${command.usage}`
        });
        await bot.sendReturnMessages(returnMessage);
        return;
      }
      
      // Verifica cooldown
      const cooldownCheck = command.checkCooldown(message.author);
      if (cooldownCheck.onCooldown) {
        const returnMessage = new ReturnMessage({
          chatId: message.group || message.author,
          content: `Este comando está em cooldown. Aguarde mais ${cooldownCheck.timeLeft} segundo(s).`
        });
        await bot.sendReturnMessages(returnMessage);
        return;
      }
    }
    
    // Reage com emoji "antes"
    const beforeEmoji = isCommandInstance ? command.reactions.before : (command.reactions?.before || this.defaultReactions.before);
    await message.origin.react(beforeEmoji).catch(err => this.logger.error('Erro ao aplicar reação "antes":', err));
    
    // Executa o comando
    const result = isCommandInstance 
      ? await command.execute(bot, message, args, group)
      : await command.method(bot, message, args, group);
    
    // Processa o resultado (ReturnMessage ou array de ReturnMessages)
    if (result) {
      if (result instanceof ReturnMessage || (Array.isArray(result) && result[0] instanceof ReturnMessage)) {
        await bot.sendReturnMessages(result);
        return;
      }
    }
    
    // Reage com emoji "depois" para modos legados
    const afterEmoji = isCommandInstance ? command.reactions.after : (command.reactions?.after || this.defaultReactions.after);
    await message.origin.react(afterEmoji).catch(err => this.logger.error('Erro ao aplicar reação "depois":', err));
  } catch (error) {
    this.logger.error(`Erro ao executar comando ${isCommandInstance ? command.name : command.name}:`, error);
    
    // Reage com emoji de erro
    const errorEmoji = isCommandInstance ? command.reactions.error : (command.reactions?.error || this.defaultReactions.error);
    await message.origin.react(errorEmoji).catch(err => this.logger.error('Erro ao aplicar reação de erro:', err));
    
    // Envia mensagem de erro
    const returnMessage = new ReturnMessage({
      chatId: message.group || message.author,
      content: `Erro ao executar comando: ${isCommandInstance ? command.name : command.name}`
    });
    await bot.sendReturnMessages(returnMessage);
  }
}
```

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