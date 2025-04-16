# Conversão de Arquivos

O módulo `FileConversions.js` implementa funcionalidades para converter arquivos de mídia entre diferentes formatos, com foco em arquivos de áudio e vídeo.

## Implementação

Este módulo utiliza programas externos e bibliotecas para processar e converter arquivos:

- **ffmpeg**: para conversão entre formatos de áudio e vídeo
- **fluent-ffmpeg**: wrapper Node.js para ffmpeg
- **sharp**: para processamento de imagens (quando necessário)

## Requisitos Externos

Para o funcionamento completo deste módulo, é necessário instalar:

- **FFmpeg**: [Download FFmpeg](https://ffmpeg.org/download.html)
  - No Windows: Defina o caminho no arquivo `.env` como `FFMPEG_PATH=C:/path/to/ffmpeg.exe`
  - No Linux/macOS: Instale via gerenciador de pacotes ou defina o caminho no `.env`

O caminho para o executável do FFmpeg deve ser configurado no arquivo `.env`:

```env
FFMPEG_PATH=C:/path/to/ffmpeg.exe
```

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!getaudio` | Converte mídia para arquivo de áudio MP3 | - |
| `!getvoice` | Converte mídia para mensagem de voz (formato OGG) | - |
| `!volume` | Ajusta o volume da mídia de áudio | Nível de volume (0-1000) |

## Exemplos de Uso

### Comando !getaudio

Este comando deve ser usado como resposta a uma mensagem de áudio ou vídeo.

**Entrada:**
```
!getaudio
```
(respondendo a uma mensagem de vídeo ou áudio)

**Saída:**
Um arquivo de áudio MP3 extraído da mídia original.

### Comando !getvoice

Este comando deve ser usado como resposta a uma mensagem de áudio ou vídeo.

**Entrada:**
```
!getvoice
```
(respondendo a uma mensagem de áudio ou vídeo)

**Saída:**
Uma mensagem de voz (formato OGG) que pode ser reproduzida diretamente no WhatsApp.

### Comando !volume

Este comando ajusta o volume de um arquivo de áudio ou vídeo.

**Entrada:**
```
!volume 200
```
(respondendo a uma mensagem de áudio, onde 200 representa 200% do volume original)

**Saída:**
A mesma mídia com o volume ajustado conforme especificado.

## Funcionamento Interno

O módulo utiliza um fluxo de trabalho que consiste em:

1. Extrair a mídia da mensagem (diretamente ou da mensagem citada)
2. Salvar a mídia em um arquivo temporário
3. Processar o arquivo com FFmpeg de acordo com o comando solicitado
4. Enviar o resultado de volta para o chat
5. Limpar os arquivos temporários

O processamento de arquivos é realizado de forma assíncrona para evitar bloqueio da thread principal.

## Funções Auxiliares

- `getMediaFromMessage`: Obtém mídia da mensagem direta ou citada
- `saveMediaToTemp`: Salva mídia em arquivo temporário
- `convertToMp3`: Converte áudio para formato MP3
- `convertToOgg`: Converte áudio para formato OGG (para mensagens de voz)
- `adjustVolume`: Ajusta o volume do áudio
- `createMediaFromFile`: Cria objeto MessageMedia a partir de arquivo
- `cleanupTempFiles`: Remove arquivos temporários após o processamento

## Notas

- Os arquivos temporários são armazenados no diretório temporário do sistema
- Arquivos temporários são automaticamente limpos após o processamento
- O módulo suporta extração de áudio de vídeos
- O ajuste de volume aceita valores de 0 a 1000, onde 100 é o volume original