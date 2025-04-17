# Sistema de Gerenciamento de Bot WhatsApp

Este documento explica o funcionamento da classe `Management`, responsável pelo gerenciamento de comandos administrativos do bot, incluindo detalhes de implementação e exemplos de uso.

## Visão Geral

A classe `Management` implementa os comandos administrativos do bot, que permitem configurar e gerenciar diversos aspectos dos grupos do WhatsApp, incluindo:

- Gerenciamento de comandos personalizados
- Configuração de mensagens de boas-vindas e despedidas
- Gerenciamento de filtros de conteúdo
- Monitoramento de canais de streaming (Twitch, Kick, YouTube)
- Definição de apelidos para usuários e outras configurações

Esses comandos são acessados nos grupos com o prefixo `!g-` (ex.: `!g-addCmd`).

## Detalhes de Implementação

### Estrutura da Classe

A classe `Management` possui os seguintes componentes principais:

- **Constructor**: Inicializa o logger, conexão com banco de dados, e mapeia comandos para métodos
- **commandMap**: Objeto que mapeia nomes de comandos para métodos correspondentes
- **Métodos de comando**: Implementações específicas de cada comando
- **Métodos utilitários**: Funções auxiliares para tarefas comuns

### Mapeamento de Comandos

O mapeamento entre nomes de comandos e métodos é feito através do objeto `commandMap`, que associa cada comando de gerenciamento ao método correspondente na classe. Isso permite uma fácil extensão do sistema, bastando adicionar novos mapeamentos.

### Banco de Dados

A classe utiliza um singleton `Database` para interagir com o banco de dados, que armazena informações sobre grupos, comandos personalizados, e outras configurações. Os dados são persistidos em arquivos JSON.

### Gerenciamento de Mídia

Vários comandos podem manipular arquivos de mídia (imagens, áudios, vídeos, etc.). Quando uma mídia é usada em um comando personalizado, ela é:

1. Baixada da mensagem original
2. Salva em um diretório específico (`data/media/`)
3. Referenciada nos comandos usando um formato especial (ex.: `{image-123456789.jpg} Legenda`)

### Sistema de Filtros

A implementação de filtros permite que administradores configurem:

- Filtros de palavras específicas
- Bloqueio de links
- Bloqueio de pessoas específicas
- Filtro de conteúdo NSFW (utilizando `NSFWPredict`)

### Integração com Serviços de Streaming

O sistema possui integração com Twitch, Kick e YouTube para monitorar canais e enviar notificações quando streams ficam online/offline ou novos vídeos são postados. Recursos incluem:

- Monitoramento de múltiplos canais por grupo
- Notificações personalizáveis
- Alteração automática do título do grupo
- Mensagens geradas por IA para anunciar streams

## Programas Externos

O sistema de gerenciamento pode utilizar os seguintes serviços/bibliotecas externos:

1. **NSFWPredict**: Serviço para detecção de conteúdo adulto em imagens
2. **LLMService**: Serviço de modelos de linguagem para geração de mensagens personalizadas
3. **StreamMonitor**: Sistema para monitoramento de plataformas de streaming
4. **APIs de plataformas**: Integrações com Twitch, Kick e YouTube

## Exemplos de Uso

### Gerenciamento de Comandos Personalizados

#### Adicionar um Comando Personalizado

**Entrada**: 
```
!g-addCmd boas-vindas
```
(em resposta a uma mensagem com texto "Bem vindo ao grupo!")

**Saída**:
```
Comando personalizado 'boas-vindas' adicionado com sucesso.
```

> **Nota**: Para comandos personalizados com requisições a APIs, consulte a documentação específica em [Requisições API Personalizadas](CustomAPIRequests.md).

#### Adicionar Resposta a um Comando

**Entrada**:
```
!g-addCmdReply boas-vindas
```
(em resposta a uma mensagem com texto "Olá! Seja bem-vindo ao nosso grupo!")

**Saída**:
```
Adicionada nova resposta ao comando personalizado 'boas-vindas'.
```

#### Desabilitar um Comando

**Entrada**:
```
!g-disableCmd boas-vindas
```

**Saída**:
```
Comando personalizado 'boas-vindas' desabilitado.
```

### Configuração de Grupo

#### Alterar Prefixo de Comando

**Entrada**:
```
!g-setCustomPrefix #
```

**Saída**:
```
Prefixo de comando atualizado para: #
```

#### Configurar Mensagem de Boas-vindas

**Entrada**:
```
!g-setWelcome Olá {pessoa}! Bem-vindo ao grupo de fãs!
```

**Saída**:
```
Mensagem de boas-vindas atualizada para: Olá {pessoa}! Bem-vindo ao grupo de fãs!
```

### Gerenciamento de Filtros

#### Adicionar Palavra ao Filtro

**Entrada**:
```
!g-filtro-palavra palavrão
```

**Saída**:
```
✅ Palavra adicionada ao filtro: "palavrão"

Palavras filtradas atualmente:
palavrão
```

#### Ativar Filtro de Links

**Entrada**:
```
!g-filtro-links
```

**Saída**:
```
✅ Filtro de links ativado. Mensagens contendo links serão apagadas automaticamente.
```

#### Ativar Filtro NSFW

**Entrada**:
```
!g-filtro-nsfw
```

**Saída**:
```
✅ Filtro de conteúdo NSFW ativado. Imagens e vídeos detectados como conteúdo adulto serão automaticamente removidos.
```

### Monitoramento de Canais de Streaming

#### Adicionar Canal da Twitch

**Entrada**:
```
!g-twitch-canal streamer123
```

**Saída**:
```
Canal da Twitch adicionado: streamer123

Configuração padrão de notificação "online" definida. Use !g-twitch-midia-on streamer123 para personalizar.
```

#### Configurar Notificação de Stream Online

**Entrada**:
```
!g-twitch-midia-on streamer123
```
(em resposta a uma mensagem com imagem e texto "🔴 {nomeCanal} está online jogando {jogo}! Título: {titulo}")

**Saída**:
```
Configuração de notificação "online" para o canal streamer123 atualizada com sucesso.
```

#### Ativar Mudança de Título do Grupo

**Entrada**:
```
!g-twitch-mudarTitulo streamer123
```

**Saída**:
```
Alteração de título para eventos do canal streamer123 ativada.

Você pode definir títulos personalizados com:
!g-twitch-titulo-on streamer123 [título]
!g-twitch-titulo-off streamer123 [título]
```

### Outros Comandos

#### Definir Apelido para Usuário

**Entrada**:
```
!g-apelido Fã Número 1
```

**Saída**:
```
Apelido definido: Fã Número 1
```

#### Ver Informações do Grupo

**Entrada**:
```
!g-info
```

**Saída**:
```
📊 Informações do Grupo

Nome: grupofas
ID: 5551234567-1234567890@g.us
Prefixo: "!"
Data de Criação: 05/01/2023, 10:30:00

Armazenamento:
- Arquivos: 15 arquivos
- Espaço usado: 5.2 MB

Configurações de Mensagens:
- Boas-vindas: Olá {pessoa}! Bem-vindo ao grupo de fãs!
- Despedidas: Adeus, {pessoa}!
- Auto-STT: Desativado

Filtros:
- Palavras: palavrão, outra_palavra
- Links: Ativado
- Pessoas: Nenhuma pessoa filtrada
- NSFW: Ativado

Canais Monitorados:
Twitch (1):
- streamer123: 1 notif. online, 0 notif. offline, título: Sim, IA: Não

Comandos Personalizados (3):
- !boas-vindas: "Bem vindo ao grupo!", "Olá! Seja bem-vindo ao nosso grupo!"
- !regras: "As regras do grupo são:..." (+ 1 mais)
- !ajuda: "Comandos disponíveis:..." (+ 1 mais)
```

#### Entrar em um Grupo via Convite

**Entrada** (em um grupo de administração):
```
!g-joinGrupo AbCdEfGhIjKlMnOpQrSt
```

**Saída**:
```
Entrou com sucesso no grupo com código de convite AbCdEfGhIjKlMnOpQrSt
```

#### Ativar Conversão Automática de Voz para Texto

**Entrada**:
```
!g-autoStt
```

**Saída**:
```
Conversão automática de voz para texto agora está *ativada* para este grupo.
```

Este documento cobre os principais aspectos do sistema de gerenciamento do bot. Para mais detalhes sobre comandos específicos, consulte o código-fonte ou use o comando `!g-help` para obter ajuda.

### Comando !g-pausar

**Entrada (para pausar):**
```
!g-pausar
```

**Saída (quando pausando):**
```
⏸️ Bot pausado neste grupo. Somente o comando `!g-pausar` será processado até que seja reativado.
```

**Entrada (para retomar):**
```
!g-pausar
```

**Saída (quando reativando):**
```
▶️ Bot reativado neste grupo. Todos os comandos estão disponíveis novamente.
```