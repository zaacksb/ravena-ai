# Comandos de Conversão de Arquivos

Este módulo implementa funcionalidades para conversão e manipulação de arquivos de mídia, especialmente áudio.

## Comandos

### !getaudio

Converte mídia para arquivo de áudio MP3.

**Descrição:** Extrai e converte o áudio de qualquer mídia para o formato MP3.

**Uso:** Responda a uma mensagem com mídia usando `!getaudio`

**Detalhes:**
- Suporta extração de áudio de vídeos, áudios e mensagens de voz
- Converte para o formato MP3 de alta qualidade
- Envia o resultado como arquivo de áudio (não como mensagem de voz)
- Mantém a qualidade original do áudio

### !getvoice

Converte mídia para mensagem de voz.

**Descrição:** Extrai e converte o áudio de qualquer mídia para formato de mensagem de voz.

**Uso:** Responda a uma mensagem com mídia usando `!getvoice`

**Detalhes:**
- Suporta extração de áudio de vídeos, áudios e arquivos de áudio
- Converte para o formato OGG (Opus) utilizado nas mensagens de voz do WhatsApp
- Envia o resultado como mensagem de voz (reproduzível no player nativo do WhatsApp)
- Útil para compartilhar áudios de forma mais conveniente

### !volume

Ajusta o volume de arquivos de mídia.

**Descrição:** Altera o volume de áudios e vídeos.

**Uso:** `!volume [nível]` (respondendo a uma mídia)

**Exemplos:**
- `!volume 200` - Dobra o volume do áudio/vídeo
- `!volume 50` - Reduz o volume pela metade
- `!volume 1000` - Aumenta o volume ao máximo suportado

**Detalhes:**
- Suporta níveis de volume de 0 a 1000 (100 = volume original)
- Funciona com áudios, vídeos e mensagens de voz
- Preserva o formato original (MP3, OGG, MP4, etc.)
- Mantém a qualidade do áudio durante o processamento

## Processamento de Mídia

O módulo implementa as seguintes funcionalidades para processamento de mídia:

- **Extração de áudio:** Separa o áudio de arquivos de vídeo
- **Conversão de formatos:** Transforma entre formatos comuns de áudio
- **Normalização de volume:** Ajusta níveis de volume para melhor experiência
- **Otimização para WhatsApp:** Garante compatibilidade com os formatos suportados
- **Gestão de arquivos temporários:** Limpa automaticamente arquivos após o processamento

## Código-fonte

Este módulo está implementado no arquivo `src/functions/FileConversions.js` e utiliza:
- FFmpeg para processamento de áudio e vídeo
- Sistema de arquivos temporários para processamento
- MessageMedia para envio de mídias processadas

## Requisitos Técnicos

O módulo requer o FFmpeg instalado no sistema e configurado no arquivo `.env`:

```
FFMPEG_PATH=/caminho/para/ffmpeg
```

Se não configurado, o sistema tentará usar o FFmpeg disponível no PATH do sistema.

## Limitações

- O tamanho máximo de arquivo é limitado pela API do WhatsApp
- O processamento pode levar alguns segundos dependendo do tamanho do arquivo
- A qualidade final depende da qualidade do arquivo original
- Arquivos muito grandes podem falhar no envio após o processamento

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*