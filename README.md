# ravena-ai

![Ravenabot AI - img by chatgpt](ravenabanner.png)

> Novo código da ravena completamente desenvolvido utilizando LLM Claude 3.7 Sonnet. Esta versão apresenta uma arquitetura modular, suporte a múltiplas instâncias, comandos personalizáveis e integração com plataformas de streaming. Livre para uso, sem garantias. Consulte o arquivo "Prompts" para ver as coisas que eu pedi pro Claude. Leia mais sobre os [design patterns aqui](docs/DesignPatterns.md).

## ℹ️ Principais diferenças
- Comandos de gerenciar agora são !g-
- Por padrão, agora precisam do prefixo para serem acionados. É possível mudar usando !g-setCustomPrefix. A ravena antiga não tinha prefixo
- Todos números rodam no mesmo processo e compartilham a base de dados


## ✅ TODO-Core

- [x] Estrutura base do bot
- [x] Sistema de comandos (fixos, personalizados, gerenciamento)
- [x] Gerenciamento de grupos
- [x] Variáveis personalizadas em respostas
- [x] Integração com LLM (OpenRouter, LM Studio)
- [x] Monitoramento de streams (Twitch, Kick, YouTube)
- [x] Sistema de convites
- [x] Detecção de conteúdo NSFW
- [x] Manipulação de mídia
- [x] Sistema de doações pelo tipa.ai
- [x] Servidor API
- [x] Instruções do VOSK para speech-to-text
- [X] Implementar docs para todas as funções implementadas até o momento
- [X] Implementar e testar comandos com variáveis para APIs personalizadas (RAB, LoL, WR, valorant, etc.)
- [X] Organizar/traduzir docs das funções
- [X] Mensagem IA pra join/leave de grupo
- [X] Comandos genéricos: Variáveis dinâmicas
    - [ ] Implementar comando !g- pra mostrar todas
- [X] Comandos genéricos: processCustomStaticVariables implementar seleção random
- [X] Dados de quem enviou convite na mensagem quando add ravena
- [X] Additonal Admins: Bot considera outras pessoas como admin (a que add no grupo ou outra manual)
- [x] Editar README com principais diferenças da ravena antiga
- [x] Comando: !lembrar e versão nova com opção de repetir
- [x] Comando: !gif, busca de gifs
- [x] Comando: !imagine, geração de imagens no sdwebui
- [x] Comando: !anime, info de animes
    - [x] Traduzir sinopse
- [x] Comando: !imdb, info de filmes e séries
    - [x] Traduzir sinopse
- [x] Comando: !wiki, busca na wikipédia
- [x] Comando: !velharia, importa os comandos genéricos antigos da ravena
- [x] Comando: !dxx, comandos de dados agora como fixos
- [x] Comando: !apagar, pra apagar msgs do bot
- [x] Comando: !g-pausar, suspende atividade do bot no grupo
- [x] Comando: !traduzir + reações de bandeira
- [X] Implementar classes ReturnMessage e Command
- [x] Migrar as funções para utlizar as classes Command e ReturnMessage
- [x] Comandos de superadmin (!sa-join, !sa-block, refletir no model command.js)
- [x] Comando: !lastfm
- [x] Comando: !news, ViniMunews (antigo JrMunews)
- [x] Implementar isAdmin/AdditionalAdmin/SuperAdmin
- [x] Status do bot no status do whats
- [x] Quando o bot carregar, pegar contatos bloqueados e ignorar os mesmos em grupos
- [x] Interagir automatico em grupo com chance setada
- [x] Mensagem boas vindas fixa (data/groupJoin.txt)
- [x] Ranking mensagens (!faladores)
- [x] Comando: !apelido, remover do gerenciamento e processar no EventHandler
- [x] Comando: !g-manage dentro do grupo sem argumento
- [x] GroupJoin: Enviar o nome que ficou o grupo e como mudar
- [x] Variáveis: Mencionar pessoas {mention-55999999...}
- [x] Variáveis: Importar todas da ravena antiga
- [x] Melhorar comando !cmd pra ficar mais organizado
- [x] Script para migração de dados da ravena antiga
    - [x] Grupos
    - [x] Lembretes
    - [x] Listas
    - [x] Outros
    - [x] News
    - [ ] Midia da twitch

## ✅ TODO-FIX
- [X] Fix respostas LLM não chegarem pelo OpenRouter
- [X] Fix boas vindas enviando mesmo sem setar
- [x] Fix emojis e reações que o claude criou estranhos
- [x] Fix autoStt não triggando
- [x] Imagine não tá retornando img
- [x] !gif tá retornando img estática
- [x] Fix TTS com AllTalk V2
- [x] Busca img não funciona
- [x] Não salvando algumas propriedades de grupo
- [ ] Mention bot apenas no começo
- [ ] Bot tentando notificar sem estar nos grupos
- [x] Gerenciar no PV buga coisas normais
- [x] !g-manage está fazendo o bot responder dentro do grupo

## ✅ TODO-Extras
- [ ] Interface web para status dos bots
- [ ] Novo Jogo: Geoguesser
- [ ] Novo Jogo: Stop/Adedonha
- [ ] Novo Jogo: Anagrama
- [ ] Nova função Streams: Alterar imagem do grupo quando fica on/off
- [ ] Implementar ADB para digitar code de login automaticamente
- [ ] Melhor explicação da implementação do bot no README
- [ ] Interface web para administração
- [ ] Comando: !ajuda [topico], usar LLM pra gerar ajuda sobre os comandos
- [x] Simulador de mensagens do whats pra fazer tutoriais ([aqui](simulador/index.html))
    - [ ] Gerador de código de mockup para os tutoriais
    - [ ] Tutoriais

## 📚 Documentação dos Comandos

Esta seção contém documentação detalhada de cada categoria de comandos disponíveis atualmente no bot, explicando sua implementação, uso e requisitos.

- [Menu de Comandos](docs/Menu.md) - Exibição de comandos disponíveis
- [Comandos Básicos](docs/PlaceholderCommands.md) - Conjunto de comandos essenciais e utilitários
- [Stickers](docs/Stickers.md) - Criação de stickers a partir de imagens
- [Roleta Russa](docs/RoletaRussaCommands.md) - Mini-jogo de azar com sistema de timeout
- [Previsão do Tempo](docs/Weather.md) - Comandos para obter informações meteorológicas
- [Download de YouTube](docs/YoutubeDownloader.md) - Ferramentas para baixar vídeos e áudios do YouTube
- [Resumos de Conversas](docs/SummaryCommands.md) - Geração de resumos das conversas do grupo
- [Gerenciamento de Arquivos](docs/FileManager.md) - Sistema para armazenamento e organização de arquivos
- [Conversão de Arquivos](docs/FileConversions.md) - Comandos para converter entre diferentes formatos de mídia
- [Comandos de Grupo](docs/GroupCommands.md) - Recursos específicos para gerenciamento de grupos
- [Manipulação de Imagens](docs/ImageManipulation.md) - Ferramentas para modificar e transformar imagens
- [Listas](docs/ListCommands.md) - Sistema para criar e gerenciar listas de membros
- [Comandos de Busca](docs/SearchCommands.md) - Ferramentas para realizar buscas na web
- [Comandos de Voz](docs/SpeechCommands.md) - Conversão entre texto e fala
- [Comandos RiotGames](docs/RiotGames.md) - Dados da API da Riot Games
- [Monitoramento de Streams](docs/StreamCommands.md) - Comandos para gerenciar monitoramento de lives
- [Sistema de Convites](docs/InviteSystem.md) - Gerenciamento de convites para grupos e administradores adicionais
- [Comandos de Doação](docs/DonationCommands.md) - Comandos para visualizar informações de doação e doadores
- [Lembretes](docs/LembretesCommands.md) - Sistema de lembretes agendados com suporte a mídia
- [Stable Diffusion](docs/StableDiffusionCommands.md) - Geração de imagens com IA
- [Giphy](docs/GiphyCommands.md) - Busca e envio de GIFs
- [Anime](docs/AnimeCommands.md) - Informações sobre animes do MyAnimeList
- [IMDB](docs/ImdbCommands.md) - Informações sobre filmes e séries
- [Wikipedia](docs/WikipediaCommands.md) - Consulta de artigos da Wikipedia
- [Dados para RPG](docs/DiceCommands.md) - Sistema de rolagem de dados

Para saber mais sobre os comandos de gerenciamento de grupo, consulte a [documentação de Comandos de Gerenciamento](docs/Management.md).

## 🔧 Instalação

### Pré-requisitos

* [Node.js](https://nodejs.org/) (v14.0.0 ou superior)
* [npm](https://www.npmjs.com/) (normalmente instalado com Node.js)
* [Python 3.7+](https://www.python.org/downloads/) (para funcionalidades de IA e processamento de imagem)
* [ImageMagick](docs/ImageManipulation.md) (para manipulação de imagens)
* [FFmpeg](https://ffmpeg.org/download.html) (para processamento de áudio e vídeo)

### Passo a passo

1. Clone o repositório:
   ```bash
   git clone https://github.com/seu-usuario/ravenabot-ai.git
   cd ravenabot-ai
   ```

2. Instale as dependências:
   ```bash
   npm install
   ```

   Este comando também instalará automaticamente as dependências Python necessárias.

3. Copie o arquivo `.env.example` para `.env`:
   ```bash
   cp .env.example .env
   ```

4. Configure o arquivo `.env` (veja a seção [Configuração](#-configuração))

5. Inicie o bot:
   ```bash
   npm start
   ```

6. Escaneie o código QR que aparecerá no console usando o WhatsApp no seu celular.

## ⚙️ Configuração

Edite o arquivo `.env` com suas configurações. Abaixo estão as variáveis mais importantes:

```env
# Configuração do bot
DEFAULT_PREFIX=!        # Prefixo padrão para comandos
SAFE_MODE=false         # Modo seguro (não envia mensagens reais)
DEBUG=true              # Modo de depuração
HEADLESS_MODE=true      # Modo headless do navegador
YOUTUBE_DL_FOLDER=D:/youtube

# Configuração da API
API_PORT=5000           # Porta para o servidor da API
TIPA_TOKEN=seu_token    # Token webhook do Tipa.ai

# Chaves de API
OPENAI_API_KEY=         # Chave da API OpenAI (opcional)
OPENROUTER_API_KEY=     # Chave da API OpenRouter (recomendado)
LOCAL_LLM_ENDPOINT=     # Endpoint LLM local (ex: http://localhost:1234/v1)
OPENWEATHER_API_KEY=    # Chave da API OpenWeather (opcional)
SDWEBUI_URL=            # URL da API Stable Diffusion Web UI
OMDB_API_KEY=           # Chave da API do OMDB (para comandos IMDB)
GIPHY_API_KEY=          # Chave da API do Giphy

# Configurações de doação
DONATION_LINK=          # Link para doações tipa.ai
DONATION_GOAL_AMOUNT=   # Meta de doação
DONATION_GOAL_DESC=     # Descrição da meta

# IDs dos grupos de comunidade, formato 1234567890@g.us
GRUPO_LOGS=             # ID do grupo para logs
GRUPO_INVITES=          # ID do grupo para convites
GRUPO_AVISOS=           # ID do grupo para avisos
GRUPO_INTERACAO=        # ID do grupo para interação

# Tokens Twitch (para monitoramento de streams)
TWITCH_CLIENT_ID=       # Client ID da Twitch
TWITCH_CLIENT_SECRET=   # Client Secret da Twitch
```

### Programas Externos

O bot utiliza alguns programas externos para funcionalidades avançadas:

* [ImageMagick](docs/ImageManipulation.md) - Para manipulação de imagens
* [FFmpeg](https://ffmpeg.org/download.html) - Para processamento de áudio e vídeo
* [AllTalk V2](https://github.com/erew123/alltalk_tts/tree/alltalkbeta) - Para síntese de voz (opcional)
* [Whisper](https://github.com/openai/whisper) - Para transcrição de áudios (opcional)
* [Stable Diffusion Web UI](https://github.com/AUTOMATIC1111/stable-diffusion-webui) - Para geração de imagens (opcional)

Configure os caminhos destes programas no arquivo `.env`:

```env
# Programas
FFMPEG_PATH=C:/path/to/ffmpeg/bin/ffmpeg.exe
CHROME_PATH=             # Caminho personalizado para o Chrome (opcional)
```

## 🔄 Fluxo de Funcionamento

```mermaid
graph TD
    A[Mensagem recebida] --> B{É um comando?}
    B -->|Sim| C{Tipo de comando}
    B -->|Não| D{Conteúdo filtrado?}
    
    C -->|Fixo| E[Executar comando fixo]
    C -->|Personalizado| F[Executar comando personalizado]
    C -->|Gerenciamento| G[Executar comando de gerenciamento]
    
    D -->|Sim| H[Filtrar/Deletar mensagem]
    D -->|Não| I{É uma menção ao bot?}
    
    I -->|Sim| J[Processar com LLM]
    I -->|Não| K{Auto-trigger ou voz?}
    
    K -->|Auto-trigger| L[Executar comando sem prefixo]
    K -->|Voz| M[Converter áudio para texto]
    K -->|Nenhum| N[Ignorar mensagem]
    
    E --> O[Retornar resultado]
    F --> O
    G --> O
    J --> O
    L --> O
    M --> O
    
    style A fill:#d0e0ff,stroke:#333
    style B fill:#ffe0b2,stroke:#333
    style C fill:#ffe0b2,stroke:#333
    style D fill:#ffe0b2,stroke:#333
    style I fill:#ffe0b2,stroke:#333
    style K fill:#ffe0b2,stroke:#333
    style O fill:#d5f5e3,stroke:#333
```

## 📋 Tipos de Comandos

O bot suporta três tipos de comandos:

### 1. Comandos Fixos

São comandos pré-definidos implementados em JavaScript na pasta `src/functions`. Exemplos:

- `!ping`: Verifica se o bot está online
- `!ai <pergunta>`: Faz uma pergunta ao LLM
- `!weather <local>`: Obtém previsão do tempo
- `!roll [lados]`: Joga um dado (padrão: 6 lados)
- `!help`: Mostra comandos disponíveis
- `!imagine <prompt>`: Gera imagens com Stable Diffusion
- `!gif <termo>`: Busca e envia GIFs do Giphy
- `!anime <nome>`: Busca informações sobre animes
- `!imdb <título>`: Busca informações sobre filmes/séries
- `!wiki <termo>`: Busca artigos na Wikipedia
- `!dXX`: Comandos de dados (d20, d6, etc.)
- `!lembrar <data/hora>`: Cria um lembrete
- `!apagar`: Apaga mensagens do bot quando respondido

### 2. Comandos Personalizados

São criados pelos usuários para cada grupo usando o comando de gerenciamento `!g-addCmd`:

```
!g-addCmd saudação
Olá a todos no grupo!
```

Após criar, o comando pode ser usado com: `!saudação`

Os comandos personalizados suportam:
- Texto simples
- Mídia (imagens, vídeos, áudio, etc.)
- Variáveis: `{pessoa}`, `{date}`, `{time}`, etc.
- Comportamentos especiais como reagir à mensagem

### 3. Comandos de Gerenciamento

Começam com `!g-` e são usados para configurar o bot e o grupo:

- `!g-setName <nome>`: Define o nome do grupo
- `!g-addCmd <gatilho>`: Adiciona comando personalizado (usado como resposta)
- `!g-delCmd <comando>`: Remove comando personalizado
- `!g-setCustomPrefix <prefixo>`: Altera o prefixo de comando (vazio = sem prefixo)
- `!g-setWelcome <mensagem>`: Define mensagem de boas-vindas
- `!g-setFarewell <mensagem>`: Define mensagem de despedida
- `!g-filtro-palavra <palavra>`: Adiciona/remove palavra do filtro
- `!g-filtro-links`: Ativa/desativa filtro de links
- `!g-filtro-nsfw`: Ativa/desativa filtro de conteúdo NSFW
- `!g-pausar`: Pausa/retoma todas as atividades do bot no grupo

## 🧩 Criando Novos Comandos

Para adicionar um novo comando fixo, crie um arquivo `.js` na pasta `src/functions/`. Exemplo:

```javascript
const Logger = require('../utils/Logger');
const logger = new Logger('meus-comandos');

const commands = [
  {
    name: 'exemplo',
    description: 'Um comando de exemplo',
    reactions: {
      before: "⏳",  // Emoji mostrado antes da execução
      after: "✅"    // Emoji mostrado após a execução
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      logger.debug(`Executando comando exemplo`);
      
      // Obtém o primeiro argumento ou usa um valor padrão
      const nome = args.length > 0 ? args[0] : "mundo";
      
      // Envia a resposta
      await bot.sendMessage(chatId, `Olá, ${nome}!`);
    }
  },
  
  // Adicione mais comandos aqui
];

// Exporta os comandos
module.exports = { commands };
```

### Propriedades de Comando

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `name` | string | **Obrigatório**. Nome do comando (usado após o prefixo). |
| `description` | string | Descrição do comando, exibida em mensagens de ajuda. |
| `method` | function | **Obrigatório**. Função a ser executada. Recebe `(bot, message, args, group)`. |
| `needsMedia` | boolean | Se `true`, o comando requer mídia. |
| `needsQuotedMsg` | boolean | Se `true`, o comando requer mensagem citada. |
| `aliases` | array | Nomes alternativos para o comando. |
| `cooldown` | number | Tempo de espera (segundos) entre usos do comando. |
| `adminOnly` | boolean | Se `true`, apenas administradores podem usar. |
| `groupOnly` | boolean | Se `true`, o comando só pode ser usado em grupos. |
| `privateOnly` | boolean | Se `true`, o comando só pode ser usado em chats privados. |
| `enabled` | boolean | Se `false`, o comando está desativado. |
| `hidden` | boolean | Se `true`, o comando não é mostrado na ajuda. |

## 📊 Monitoramento de Streams

O bot pode monitorar canais do Twitch, Kick e YouTube e notificar os grupos quando eles ficam online/offline:

### Comandos Twitch

- `!g-twitch-canal <canal>`: Ativa/desativa monitoramento do canal
- `!g-twitch-midia-on <canal>`: Define notificação para quando o canal ficar online
- `!g-twitch-midia-off <canal>`: Define notificação para quando o canal ficar offline
- `!g-twitch-mudarTitulo <canal>`: Ativa/desativa alteração do título do grupo
- `!g-twitch-titulo-on <canal> <título>`: Define título personalizado para quando online
- `!g-twitch-usarIA <canal>`: Ativa/desativa geração de mensagens com IA

Comandos similares existem para Kick (`!g-kick-...`) e YouTube (`!g-youtube-...`).


## 📝 Licença

Free, usem como quiserem.