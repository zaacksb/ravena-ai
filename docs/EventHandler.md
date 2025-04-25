# EventHandler

O EventHandler é o componente central que gerencia todos os eventos recebidos do WhatsApp, coordenando as respostas do bot para mensagens, reações, entradas e saídas de grupos.

## Funcionalidades Principais

- Processamento de mensagens recebidas do WhatsApp
- Detecção de comandos com base no prefixo configurado
- Gerenciamento de grupos (criação, atualização, filtros)
- Manipulação de eventos de entrada e saída de grupos
- Aplicação de filtros de conteúdo (palavras, links, NSFW)
- Processamento de menções ao bot
- Integração com LLM para respostas inteligentes

## Métodos Importantes

### `onMessage(bot, message)`

Recebe e encaminha mensagens recebidas para processamento.

### `processMessage(bot, message)`

Método principal que processa mensagens recebidas, detecta comandos, aplica filtros e encaminha para manipuladores adequados.

### `processNonCommandMessage(bot, message, group)`

Processa mensagens que não são comandos, como transcrição automática de áudio, detecção de notícias e comandos acionados automaticamente.

### `applyFilters(bot, message, group)`

Aplica filtros configurados no grupo, como filtro de palavras, links, pessoas e conteúdo NSFW.

### `onGroupJoin(bot, data)`

Manipula eventos de entrada em grupo, enviando mensagens de boas-vindas e configurando o grupo.

### `onGroupLeave(bot, data)`

Manipula eventos de saída de grupo, enviando mensagens de despedida.

### `generateGreetingMessage(bot, group, user)`

Gera mensagens de saudação personalizadas para novos membros.

### `processFarewellMessage(group, user)`

Gera mensagens de despedida para membros que saem do grupo.

## Gerenciamento de Grupos

O EventHandler gerencia os grupos através dos métodos:

- `loadGroups()` - Carrega todos os grupos do banco de dados
- `getOrCreateGroup(groupId, name)` - Obtém ou cria um grupo se não existir

## Filtros de Conteúdo

O EventHandler suporta diversos filtros para moderar conteúdo em grupos:

- Filtro de palavras - Bloqueia mensagens contendo palavras proibidas
- Filtro de links - Bloqueia mensagens contendo URLs
- Filtro de pessoas - Ignora mensagens de usuários específicos 
- Filtro NSFW - Detecta e remove conteúdo adulto em imagens

## Como Usar

O EventHandler é instanciado pelo WhatsAppBot e compartilhado entre as instâncias de bot:

```javascript
// No arquivo index.js
const eventHandler = new EventHandler();
const bot = new WhatsAppBot({
  id: 'bot-id',
  eventHandler: eventHandler,
  // outras opções...
});
```

## Fluxo de Processamento de Mensagens

1. Uma mensagem é recebida pelo WhatsAppBot
2. O WhatsAppBot formata a mensagem e a passa para o EventHandler
3. O EventHandler verifica se é um comando (baseado no prefixo)
4. Se for um comando, o CommandHandler é invocado
5. Se não for um comando, são verificadas menções ao bot, comandos automáticos e outros padrões
6. Filtros de conteúdo são aplicados se configurados no grupo

## Dependências

- `CommandHandler` - Processa e executa comandos
- `Database` - Acesso ao banco de dados para grupos e configurações
- `Logger` - Registra eventos e erros
- `AdminUtils` - Verifica permissões administrativas
- `LLMService` - Integração com modelos de linguagem
- `NSFWPredict` - Detecção de conteúdo NSFW em imagens
- Vários módulos de função (como `SpeechCommands`, `SummaryCommands`, etc.)