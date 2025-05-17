# RavenaBot AI

![Ravenabot AI - img by chatgpt](ravenabanner.png)

> Novo código da ravena completamente desenvolvido utilizando LLM Claude 3.7 Sonnet. Esta versão apresenta uma arquitetura modular, suporte a múltiplas instâncias, comandos personalizáveis e integração com plataformas de streaming. Livre para uso, sem garantias. Consulte o arquivo "Prompts" para ver as coisas que eu pedi pro Claude. Leia mais sobre os [design patterns aqui](docs/DesignPatterns.md).

## 🔮 Visão Geral

RavenaBot é um bot para WhatsApp que vem sendo desenvolvido há quase 4 anos, apenas como uma brincadeira/hobby. Começou como um bot da twitch (pra aprender um pouco da API deles com python) e depois foi integrado ao WhatsApp (pra aprender sobre nodejs) - virando um _spaghetti code_ absurdo, aí veio a ideia de refazer todo o código do zero, mas com uma ajudinha especial dos LLM (pra ver o estado atual de criação de código assistido por IA).
O foco deste bot é a utilização do mesmo em grupos, onde ele pode notificar status das lives, responder comandos com utilidades (!clima, !gpt, ..,), criar comandos personalizados do grupo (como nightbot, StreamElements, etc.).

Este bot foi implemetado utilizando o [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js), que manipula o WhatsAppWeb através de um navegador controlado pelo puppeteer.
Bots deste tipo **não são permitidos**, então não use em seu número principal - compre um chip só pra isso.


## 🚀 Recursos Principais
- **Básico de Mídia** - Stickers, stickers sem fundo, baixa vídeos/música do youtube, baixa gifs, imagens, converte formatos, muda volume e mais!
- **Sistema modular de Comandos** - Comandos fixos implementados por arquivo que todos podem ajudar a expandir + Interpretador comandos personalizados que podem ser cirados em tempo real dentro dos grupos
- **Plataformas de Streaming** - Monitoramento de Twitch, Kick e YouTube com notificações customizáveis dentro dos grupos
- **Jogos** - Roleta russa, pescaria, pokemon, geoguesser... Tudo isso no chat do grupo
- **Zoeira** - Comandos de zueira pra entreter os memrbos
- **Interações no Grupo** - Mensagens de boas vindas, despedidas, resumo de conversas, interações inteligentes
- **Integração com LLMs** - Código pronto pra utilizar APIs OpenRouter, Gemini, ChatGPT e locais com o LMStudio
- **StableDiffusion** - Gera imagens via sdwebui e envia direto no whats, rodando local sem pagar APIs
- **Filtros de Mensagens** - Apaga mensagens com palavras específicas, links e também detecta conteúdo 18+
- **Sistema de Convites** - O bot processa links de convites e possui comandos para que o administrador coloque o bot nos grupos de forma remota
- **Painel de Controle Web** - Possui um painel de controle web (!g-painel) para configurar as opções do grupo
- **Multiplas instâncias** - Múltiplos bots rodam com o mesmo código, compartilhando a base de dados
- **Gerenciamento de Grupos**: Ferramentas para administradores
- **Sistema de Convites**: Controle quem pode adicionar o bot a grupos
- **Interações Automáticas**: O bot pode interagir aleatoriamente com mensagens

## 🐦‍⬛ Quero usar agora!

Se você quer interagir com o bot e testar ele, eu disponibilizo o mesmo _gratuitamente_ em alguns números, você pode conferir o status dos bots [aqui neste link](https://ravena.moothz.win/)

## ✅ TODO - O que esperar do futuro

Lista completa do que já foi feito [aqui](docs/TODO.md)

- [x] Melhor explicação da implementação do bot no README
- [ ] Quando receber invite, ver se alguma das ravenas já tá no grupo
- [ ] Comando convite com argumento pro id do bot
- [ ] Add !info
- [ ] Fix: SIGINT/SIGTERM não estão chegando/sendo executados
- [ ] Bot tentando notificar sem estar nos grupos
- [ ] Stickers quadrados videos não envia (client.sendMessage)
- [ ] Fix Riot API
- [ ] Fix reset do ranking de pesca
- [x] Simulador de mensagens do whats pra fazer tutoriais ([aqui](simulador/index.html))
    - [ ] Gerador de código de mockup para os tutoriais
    - [ ] Tutoriais
- [ ] Novo Jogo: Geoguesser
- [ ] Novo Jogo: Stop/Adedonha
- [ ] Novo Jogo: Anagrama
- [ ] Novo Comando: busca no youtube
- [ ] Implementar ADB para digitar code de login automaticamente
- [ ] Comando: !ajuda [topico], usar LLM pra gerar ajuda sobre os comandos
- [ ] Gerar README.md atualizado
- [ ] Downloader de SocialMedias (Insta, TikTok)

## 🔧 Hospedar sua própria ravena
Se você não entende nada de programação ou nunca rodou aplicativos via código fonte, o melhor mesmo é chamar seu amigo da TI pra dar aquele help.
O programa foi feito para rodar em Windows e Linux (MacOS deve funcionar sem problemas, é claro). Já rodei muito em Raspberry Pi/OrangePi e similares, mas nunca tentei rodar diretamente num Android.

### Requisitos Mínimos
Sem isso, não vai dar pra rodar o bot.

* Um servidor capaz de rodar o nodejs e todas as dependências
* Um celular com whatsapp ativo (NÃO USE O SEU CHIP!)
* [Node.js](https://nodejs.org/)
* [Google Chrome](https://www.google.com/chrome/): Para poder enviar vídeos é necessário o Chrome
* [FFmpeg](https://ffmpeg.org/download.html): (para processamento de áudio e vídeo)

### Requisitos Recomendados
Para funções bastante utilizadas do bot

* [Python 3.7+](https://www.python.org/downloads/): Para usar nsfw-detect
* [ImageMagick](docs/ImageManipulation.md): Comandos de efeito em imagens
* [faster-whisper](https://github.com/SYSTRAN/faster-whisper): Para transcrição de áudios _(speech-to-text)_ - fácil de usar, binaries prontos
* [alltalk_tts](https://github.com/erew123/alltalk_tts/tree/alltalkbeta): Texto pra voz, ferramenta grátis e poderosa (dá até pra copiar voz dos outros!)
* [API - Gemini](https://ai.google.dev/): Na minha opinião, a melhor LLM Free _(gemini-2.0-flash-exp)_
* [API - OWM](https://openweathermap.org/api): API grátis de previsão do tempo

### Opcionais e Extras
* [stable-diffusion-webui](https://github.com/AUTOMATIC1111/stable-diffusion-webui): Para gerar imagens com IA localmente
* [nsfw-predict](https://github.com/GantMan/nsfw_model): Deteção de imagens 18+ (precisa do modelo abaixo)
* [nsfw_mobilenet_v2_140_224.zip](https://github.com/GantMan/nsfw_model/releases/tag/1.1.0): Ótimo modelo free para detecção de imagens 18+
* [API - Giphy](https://developers.giphy.com/): Para busca de GIFs
* [API - OMDB](https://www.omdbapi.com/apikey.aspx): Para busca de informação de filmes (IMDB Free)
* [API - Unsplash](https://unsplash.com/developers): Busca de Imagens
* [API - Last.fm](https://www.last.fm/pt/api): Busca no Last.fm (perfis, infos)
* [API - RiotGames](https://developer.riotgames.com/): Busca de ELO informações de jogos da Riot
* [API - Placas](https://apiplacas.com.br/): API paga para busca de placas de carros (não é das melhores, mas é barato!)
* [LM Studio](https://lmstudio.ai/): Caso não queira usar APIs para IA, hospede sua própria


### Passo a passo

1. Clone o repositório:
   ```bash
   git clone https://github.com/moothz/ravenabot-ai.git
   cd ravenabot-ai
   ```

2. Instale as dependências:
   ```bash
   npm install
   python -m pip install backgroundremover
   ```

3. Copie o arquivo `.env.example` para `.env`

4. Configure o arquivo `.env` (veja a seção [Configuração](#-configuração))

4. Copie o arquivo `bots.json.example` para `bots.json`

5. Configure o arquivo `bots.json`

6. Inicie o bot:
   ```bash
   npm start
   ```

7. Escaneie o código QR que aparecerá no console usando o WhatsApp no seu celular.

## ⚙️ Configuração

Edite o arquivo `bots.json` conforme instruções abaixo:
```json
[
   {
    "nome": "ravenabot",
    "numero": "559912345678",
    "ignorePV": false,          // Ignorar comandos no PV (menos de gerencia)
    "ignoreInvites": false,     // Não ativar sistema de invites
    "customPrefix": "!"         // Prefixo padrão dos comandos (os grupos são criados com este prefixo, mas podem alterar depois)
   }
]
```


Edite o arquivo `.env` conforme instruções abaixo:

```env
# Opções Gerais
DEFAULT_PREFIX=!                    # Prefixo padrão de comandos
SAFE_MODE=false                     # Apenas simula envio de mensagens e printa no terminal
DEBUG=true                          # Mostra Mensagens de debug mais
HEADLESS_MODE=false                 # false = mostra o navegador, true = navegador escondido
DL_FOLDER=D:/downloads              # Pasta onde serão baixados mídias (youtube, etc)
NOTIFY_UNKNOWN_COMMANDS=false       # Responder mensagens de "comando não encontrado"
SUPER_ADMINS=12345@c.us             # Número de pessoas que podem dar comandos de SuperAdmin (padrão ID whats)
MAX_BACKUPS=10

# API da RavenaBot
BOT_DOMAIN=https://seuhost.com/rv   # URL da API 
API_PORT=5000                       # Porta da API
BOTAPI_USER=admin                   # Usuário para comandos remotos
BOTAPI_PASSWORD=senhaCecreta        # Senha para comandos Remotos
MANAGEMENT_TOKEN_DURATION=30        # Tempo em minutos de duração da sessão para !g-painel

# Chaves de API Externas
TWITCH_CLIENT_ID=                   # https://dev.twitch.tv/docs/api/
TWITCH_CLIENT_SECRET=               # 
GOOGLE_API_KEY=                     # https://ai.google.dev/
GOOGLE_MAPS_API_KEY=                # https://developers.google.com/maps/documentation/javascript/get-api-key
DEEPSEEK_API_KEY=                   # https://platform.deepseek.com/apiKeys
OPENAI_API_KEY=                     # https://openai.com/api/
OPENROUTER_API_KEY=                 # https://openrouter.ai/docs/api-reference/api-keys/get-api-key
OPENWEATHER_API_KEY=                # https://openweathermap.org/api
RIOT_GAMES=                         # https://developer.riotgames.com/
GIPHY_API_KEY=                      # https://developers.giphy.com/
OMDB_API_KEY=                       # https://www.omdbapi.com/apikey.aspx
UNSPLASH_API_KEY=                   # https://unsplash.com/developers
LASTFM_APIKEY=                      # https://www.last.fm/pt/api
LASTFM_SECRET=                      # 
API_PLACAS_COMUM=                   # https://apiplacas.com.br/
API_PLACAS_PREMIUM=                 # https://apiplacas.com.br/
TIPA_TOKEN=                         # https://tipa.ai/settings/apps (WEBHOOKS)
#API_PLACAS_USAR_PREMIUM=TRUE       # Caso tenha comprad uma chave premium
GRUPOS_PLACA_PREMIUM=grupo1,grupo2  # Nomes de grupos que podem usar a API placa premium

# URL de APIs Locais
API_TIMEOUT=10000                   # 
SDWEBUI_URL=http://192.168.3.200:7860       # Porta padrão SDWebui
LOCAL_LLM_ENDPOINT=http://localhost:9666/v1 # Porta padrão LMStudio
ALLTALK_API=http://localhost:7851           # Porta padrão AllTalk v2

# Configuração das doações (provavelmente inútil pra ti que vai rodar o bot particular)
DONATION_LINK=https://tipa.ai/user
DONATION_GOAL_AMOUNT=1000
DONATION_GOAL_DESCRIPTION=Pagar o moothz!

# Grupos para Desenvolvimento e debug do bot
LINK_GRUPO_INTERACAO=https://chat.whatsapp.com/abc123   # Para !grupao
LINK_GRUPO_AVISOS=https://chat.whatsapp.com/def456      # Para !avisos
GRUPO_LOGS=1234678901234567890@g.us                     # ID WhatsApp de grupos para debug e monitoramento
GRUPO_INVITES=1234678901234567890@g.us                  # 1. Adicione o bot nos grupos
GRUPO_AVISOS=1234678901234567890@g.us                   # 2. Abra o arquivo data/groups.json
GRUPO_INTERACAO=1234678901234567890@g.us                # 3. Pegueo o ID de lá! (pra facilitar, use !g-setName)


# Programas
# Eu rodo a ravena em um Windows Server, então vou deixar aqui os exemplos como seria em uma máquina Windows
WHISPER=C:/Apps/Faster-Whisper-XXL/faster-whisper-xxl.exe
FFMPEG_PATH=C:/Apps/ffmpeg.exe
CHROME_PATH=C:/Program Files/Google/Chrome/Application/chrome.exe
NSFW_PREDICT_COMMAND=C:/Users/Voce/AppData/Local/Packages/Py.../LocalCache/local-packages/Python310/Scripts/nsfw-predict.exe
NSFW_PREDICT_MODEL=C:/Apps/mobilenet_v2_140_224
```
## 🧩 Criando Novos Comandos

Para adicionar um novo comando fixo, crie um arquivo `.js` na pasta `src/functions/`.
Aqui vai uma boa base pra começar:

```javascript
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('meus-comandos');

const commands = [
  new Command({
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
      return new ReturnMessage({
        chatId: chatId,
        content: `Olá, ${nome}!`
      });
    }
  })
];

// Exporta os comandos
module.exports = { commands };
```

### 🤖 Criar comandos usando IA
Se você sabe pedir pras LLMs programarem, aqui vai uma dica de como fazer:
Anexe os seguintes arquivos:
```
- models/Group.js
- models/Command.js
- models/ReturnMessage.js
- Este código de exemplo acima como exemplo.js
```
Se estiver fazendo alguma função similar a alguma existente no bot, anexo também o arquivo JS da pasta functions - por exemplo, se for fazer um comando que retorne Stickers, anexe o `Stickers.js` para a IA saber como tratar ReturnMessage de stickers, etc.


Peça para o LLM:
```
Respeitando os padrões de implementação apresentados nos modelos e no exemplo.js desenvolva um novo comando conforme instruções a seguir:
- Comando 'soletrar'
- Recebe como argumento várias palavras
- Para cada palavra recebida como argumento, separe as letras com hifen

Exemplo:
- Entrada: !soletrar batata porco
- Saída: B-A-T-A-T-A | P-O-R-C-O
```



### Propriedades de Comando

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `name` | string | **Obrigatório**. Nome do comando (usado após o prefixo). |
| `description` | string | Descrição do comando, exibido no menu. |
| `method` | function | **Obrigatório**. Função a ser executada. Recebe `(bot, message, args, group)`. |
| `needsMedia` | boolean | Se `true`, o comando requer mídia. |
| `needsQuotedMsg` | boolean | Se `true`, o comando requer mensagem citada. |
| `aliases` | array | Nomes alternativos para o comando. |
| `cooldown` | number | Tempo de espera (segundos) entre usos do comando. |
| `adminOnly` | boolean | Se `true`, apenas administradores podem usar. |
| `groupOnly` | boolean | Se `true`, o comando só pode ser usado em grupos. |
| `privateOnly` | boolean | Se `true`, o comando só pode ser usado em chats privados. |
| `enabled` | boolean | Se `false`, o comando está desativado. |
| `hidden` | boolean | Se `true`, o comando não é mostrado no menu. |

## 📊 A definir

Aqui vou refatorar a parte do README que fala sobre os comandos, em breve.


## 📝 Licença

Free, usem como quiserem.