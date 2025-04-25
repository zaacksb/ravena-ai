# Comandos para YouTube

Este módulo implementa funcionalidades para download de vídeos e áudios do YouTube.

## Comandos

### !yt

Baixa vídeos do YouTube.

**Descrição:** Permite baixar vídeos do YouTube a partir de links ou termos de busca.

**Uso:** 
- `!yt [link do vídeo]`
- `!yt [termo de busca]`

**Exemplos:**
- `!yt https://youtu.be/dQw4w9WgXcQ`
- `!yt https://www.youtube.com/watch?v=dQw4w9WgXcQ`
- `!yt despacito` - Busca e baixa o primeiro resultado para "despacito"

**Detalhes:**
- Suporta links completos, links curtos (youtu.be) e links de shorts
- Quando um termo de busca é fornecido, busca automaticamente o primeiro resultado
- Baixa o vídeo em formato MP4 otimizado para WhatsApp
- Limite: vídeos com até 10 minutos de duração

### !sr

Baixa áudio/música do YouTube.

**Descrição:** Permite baixar apenas o áudio de vídeos do YouTube em formato MP3.

**Uso:** 
- `!sr [link do vídeo]`
- `!sr [termo de busca]`

**Exemplos:**
- `!sr https://youtu.be/dQw4w9WgXcQ`
- `!sr despacito` - Busca e baixa o áudio do primeiro resultado para "despacito"

**Detalhes:**
- Extrai apenas o áudio do vídeo em formato MP3
- Qualidade otimizada para músicas
- Quando um termo de busca é fornecido, busca automaticamente o primeiro resultado
- Limite: vídeos com até 10 minutos de duração

## Recursos Adicionais

### Download via Reações

Além dos comandos, o bot também suporta download de vídeos através de reações:

**Descrição:** Reagir com ⏬ a uma mensagem contendo link do YouTube para baixar o vídeo.

**Uso:** Reaja com ⏬ a qualquer mensagem que contenha um link do YouTube

**Detalhes:**
- Funcionalidade rápida sem necessidade de digitar comandos
- Processa automaticamente o primeiro link do YouTube encontrado na mensagem
- Baixa o vídeo em formato MP4

## Sistema de Cache

O módulo implementa um sistema inteligente de cache para otimizar downloads:

- Armazena vídeos e áudios já baixados para evitar downloads repetidos
- Reutiliza conteúdo quando o mesmo vídeo é solicitado novamente
- Reduz consumo de banda e tempo de espera para vídeos populares

## Código-fonte

Este módulo está implementado no arquivo `src/functions/YoutubeDownloader.js` e utiliza:
- youtube-dl-exec para download de vídeos
- youtube-search-api para busca de vídeos
- Sistema próprio de cache para otimização de downloads

## Configuração

O módulo requer as seguintes configurações no arquivo `.env`:

```
YOUTUBE_DL_FOLDER=/caminho/para/pasta/de/download
FFMPEG_PATH=/caminho/para/ffmpeg/ffmpeg.exe
```

## Observações

- O download de vídeos respeita os limites de tamanho do WhatsApp
- Vídeos são automaticamente convertidos para formatos compatíveis
- Atualmente há um limite de 10 minutos por vídeo/áudio
- O sistema utiliza o youtube-dl-exec que se adapta automaticamente às mudanças da API do YouTube

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*