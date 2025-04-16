# Download de YouTube

O módulo `YoutubeDownloader.js` implementa funcionalidades para baixar vídeos e áudios do YouTube diretamente para o WhatsApp, permitindo que os usuários acessem conteúdo offline.

## Implementação

Este módulo utiliza ferramentas externas para baixar e processar vídeos do YouTube:

- **youtube-dl-exec**: Ferramenta de linha de comando para baixar vídeos do YouTube
- **ffmpeg**: Para processamento e conversão de áudio e vídeo
- **youtube-search-api**: Para buscar vídeos por termo de pesquisa

O módulo também implementa um sistema de cache para evitar baixar novamente vídeos já processados anteriormente.

## Requisitos Externos

Para o funcionamento completo deste módulo, é necessário:

1. **FFmpeg**: [Download FFmpeg](https://ffmpeg.org/download.html)
   - Configure o caminho no arquivo `.env`: `FFMPEG_PATH=C:/path/to/ffmpeg.exe`

2. **youtube-dl** ou **yt-dlp**: [Download yt-dlp](https://github.com/yt-dlp/yt-dlp/releases)
   - Recomenda-se o uso do **yt-dlp** que é mais atualizado

3. **Pasta para downloads**:
   - Configure no arquivo `.env`: `YOUTUBE_DL_FOLDER=/path/to/folder`

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!yt` | Baixa um vídeo do YouTube | \<link ou termo de busca\> |
| `!sr` | Baixa um áudio do YouTube | \<link ou termo de busca\> |

## Exemplos de Uso

### Comando !yt

Este comando pode ser usado de duas formas:

1. **Com link direto do YouTube**:

**Entrada:**
```
!yt https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

**Saída:**
```
⏬ Baixando vídeo...
```
Seguido pelo vídeo baixado em formato MP4.

2. **Com termo de busca**:

**Entrada:**
```
!yt como fazer um bolo de chocolate
```

**Saída:**
```
🔍 Buscando: "como fazer um bolo de chocolate" no YouTube...
⏬ Baixando vídeo...
```
Seguido pelo primeiro vídeo encontrado na busca, em formato MP4.

### Comando !sr

Similar ao comando `!yt`, mas baixa apenas o áudio em formato MP3.

**Entrada:**
```
!sr despacito
```

**Saída:**
```
🔍 Buscando: "despacito" no YouTube...
⏬ Baixando áudio...
```
Seguido pelo áudio do vídeo encontrado, em formato MP3.

## Reações com Emojis

O módulo também suporta download de vídeos através de reações com emoji. Quando um usuário reage a uma mensagem contendo um link do YouTube com o emoji ⏬, o bot automaticamente baixa o vídeo.

## Sistema de Cache

O módulo implementa um sistema de cache para evitar baixar novamente vídeos já processados:

```javascript
videoCacheManager.getVideoInfoWithCache(urlSafe, {dumpSingleJson: true})
  .then(videoInfo => {
    // Processamento com informações do vídeo
    videoCacheManager.downloadVideoWithCache(urlSafe, 
      { 
        o: destinoVideo,
        f: "(bv*[vcodec~='^((he|a)vc|h264)'][filesize<55M]+ba) / (bv*+ba/b)",
        // Outras opções...
      }
    )
  })
```

## Limitações

- Vídeos muito longos (mais de 10 minutos) são rejeitados para evitar problemas
- O tamanho máximo dos vídeos é limitado a 55MB para compatibilidade com o WhatsApp
- A qualidade do vídeo é ajustada para equilibrar tamanho e qualidade
- O download pode levar alguns segundos ou minutos, dependendo do tamanho do vídeo
- Alguns vídeos com restrições de idade ou regionalidade podem não ser baixados

## Funções Internas

O módulo inclui várias funções internas:

- `extractYoutubeVideoId`: Extrai o ID do vídeo a partir de uma URL do YouTube
- `searchYoutubeVideo`: Busca um vídeo no YouTube por termo de pesquisa
- `processYoutubeReaction`: Processa reações para download de vídeos
- `baixarVideoYoutube`: Baixa um vídeo do YouTube
- `baixarMusicaYoutube`: Baixa apenas o áudio de um vídeo do YouTube

## Formatos de URL Suportados

O sistema pode extrair o ID do vídeo de diversos formatos de URL do YouTube:

- youtube.com/watch?v=ID
- youtu.be/ID
- youtube.com/embed/ID
- youtube.com/v/ID
- youtube.com/shorts/ID

## Tratamento de Erros

O módulo inclui tratamento de erros para várias situações:

- Vídeo não encontrado
- Vídeo muito longo
- Problemas no download
- Falhas no processamento de áudio/vídeo

## Configuração de Qualidade

O módulo usa códigos específicos para selecionar a qualidade do vídeo:

```javascript
f: "(bv*[vcodec~='^((he|a)vc|h264)'][filesize<55M]+ba) / (bv*+ba/b)"
```

Este código solicita:
1. Vídeo com codec h264 (para melhor compatibilidade)
2. Tamanho máximo de 55MB
3. Melhor qualidade de áudio disponível
4. Fallback para outra combinação se a primeira não estiver disponível

## Notas Adicionais

- Os arquivos temporários são armazenados no diretório configurado em `YOUTUBE_DL_FOLDER`
- O módulo utiliza cookies para acessar conteúdo restrito quando disponível
- A legenda do vídeo/áudio enviado inclui informações sobre o autor e título original
- O sistema gera hashes aleatórios para evitar conflitos de nome de arquivo