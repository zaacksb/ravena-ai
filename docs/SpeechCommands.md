# Comandos de Voz

O módulo `SpeechCommands.js` implementa funcionalidades para conversão entre texto e voz, permitindo que os usuários convertam mensagens de texto para áudio e transcreva mensagens de voz para texto.

## Implementação

Este módulo utiliza tecnologias externas para processamento de áudio:

- **eSpeak**: Motor de síntese de voz (TTS - Text-to-Speech)
- **FFmpeg**: Para conversão entre formatos de áudio
- **Vosk**: Motor de reconhecimento de voz (STT - Speech-to-Text)

## Requisitos Externos

Para o funcionamento completo deste módulo, é necessário instalar:

- **eSpeak**: [Download eSpeak](http://espeak.sourceforge.net/)
  - No Windows: Defina o caminho no arquivo `.env` como `ESPEAK_PATH=C:/path/to/espeak.exe`
  - No Linux: `sudo apt-get install espeak`
  - No macOS: `brew install espeak`

- **FFmpeg**: [Download FFmpeg](https://ffmpeg.org/download.html)
  - No Windows: Defina o caminho no arquivo `.env` como `FFMPEG_PATH=C:/path/to/ffmpeg.exe`
  - No Linux: `sudo apt-get install ffmpeg`
  - No macOS: `brew install ffmpeg`

- **Vosk** (para STT):
  ```bash
  pip install vosk
  vosk-transcriber -d # Para baixar o modelo de português
  ```

Configure os caminhos para os executáveis no arquivo `.env`:

```env
ESPEAK_PATH=C:/path/to/espeak.exe
FFMPEG_PATH=C:/path/to/ffmpeg.exe
```

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!tts` | Converte texto para voz | \<texto\> |
| `!stt` | Converte voz para texto | - (deve ser usado como resposta a uma mensagem de voz) |

## Exemplos de Uso

### Comando !tts

**Entrada:**
```
!tts Olá, esta é uma mensagem gerada por voz sintética
```

**Saída:**
Uma mensagem de áudio com a fala sintetizada contendo o texto solicitado.

### Comando !stt

Este comando deve ser usado como resposta a uma mensagem de voz ou áudio.

**Entrada:**
```
!stt
```
(respondendo a uma mensagem de voz)

**Saída:**
```
O texto transcrito da mensagem de voz seria exibido aqui.
```

## Funcionalidade Auto-STT

Além dos comandos explícitos, o módulo também implementa uma funcionalidade de transcrição automática (`autoStt`) que pode ser ativada em grupos. Quando ativada, todas as mensagens de voz enviadas no grupo são automaticamente transcritas.

Esta funcionalidade pode ser ativada/desativada com o comando `!g-autoStt` (comando de gerenciamento).

**Exemplo de saída da transcrição automática:**
```
🔊 ➡ 📝: Olá pessoal, vamos nos encontrar às 15h hoje
```

## Fluxo de Trabalho

### Text-to-Speech (TTS)

1. O usuário envia o comando `!tts` seguido do texto
2. O bot executa o eSpeak para gerar um arquivo WAV com a voz
3. O arquivo WAV é convertido para MP3 usando FFmpeg
4. O arquivo MP3 é enviado como mensagem de voz

### Speech-to-Text (STT)

1. O usuário envia o comando `!stt` como resposta a uma mensagem de voz
2. O bot baixa o áudio da mensagem
3. O áudio é convertido para WAV usando FFmpeg
4. O Vosk-transcriber é usado para transcrever o áudio
5. O texto transcrito é enviado como resposta

## Funções Auxiliares

O módulo inclui várias funções auxiliares:

- `getMediaFromMessage`: Obtém mídia da mensagem direta ou citada
- `saveMediaToTemp`: Salva áudio em arquivo temporário
- `processAutoSTT`: Processa STT automático para mensagens de voz em grupos

## Diretórios Temporários

O módulo utiliza um diretório temporário para armazenar arquivos durante o processamento:

```javascript
const tempDir = path.join(os.tmpdir(), 'whatsapp-bot-speech');
```

Este diretório é criado automaticamente e os arquivos são removidos após o processamento.

## Notas e Limitações

- O eSpeak é um sintetizador de voz gratuito, mas a qualidade da voz é relativamente robótica
- A precisão da transcrição depende da qualidade do áudio e do idioma falado
- O processamento de áudio pode levar alguns segundos, especialmente para arquivos longos
- O sistema está otimizado para o idioma português brasileiro, mas pode funcionar com outros idiomas
- Se o modelo Vosk para português não estiver instalado, a transcrição pode falhar ou ser imprecisa