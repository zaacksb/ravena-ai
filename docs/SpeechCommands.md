# Comandos de Fala e Voz

Este módulo implementa funcionalidades para conversão de texto para voz (TTS) e voz para texto (STT).

## Comandos de Texto para Voz (TTS)

### !tts

Converte texto para voz usando o personagem 'ravena'.

**Descrição:** Transforma o texto fornecido em uma mensagem de voz com a voz da Ravena.

**Uso:** 
- `!tts [texto]`
- `!tts` (em resposta a uma mensagem)

**Exemplos:**
- `!tts Olá, como vai você?`
- Responder a uma mensagem com `!tts` para converter seu conteúdo em áudio

**Detalhes:**
- Usa a voz personalizada "ravena" definida no sistema
- Gera áudios de alta qualidade utilizando o AllTalk/XTTS
- Envia o resultado como mensagem de voz no WhatsApp

### Variações de TTS

O bot oferece vários personagens para TTS, cada um com sua voz característica:

| Comando | Personagem | Descrição |
|---------|------------|-----------|
| `!tts-mulher` | Voz feminina | Voz feminina padrão |
| `!tts-carioca` | Carioca feminina | Voz feminina com sotaque carioca |
| `!tts-carioco` | Carioca masculina | Voz masculina com sotaque carioca |
| `!tts-sensual` | Voz sensual feminina | Voz feminina com tom sensual |
| `!tts-sensuel` | Voz sensual masculina | Voz masculina com tom sensual |
| `!tts-homem` | Voz masculina | Voz masculina padrão |
| `!tts-clint` | Voz estilo Clint Eastwood | Voz masculina grave e rasgada |
| `!tts-morgan` | Voz estilo Morgan Freeman | Voz masculina profunda e calma |
| `!tts-narrador` | Voz de narrador | Voz masculina em estilo narração |

**Uso:** Igual ao comando `!tts`, apenas substituindo pelo comando específico da voz desejada.

## Comando de Voz para Texto (STT)

### !stt

Converte áudios e mensagens de voz para texto.

**Descrição:** Transcreve o conteúdo de áudios ou mensagens de voz para texto.

**Uso:** Responda a uma mensagem de áudio/voz com `!stt`

**Exemplos:**
- Responder a uma mensagem de voz com `!stt`
- Responder a um áudio com `!stt`

**Detalhes:**
- Utiliza modelo Whisper para transcrição de alta qualidade
- Suporta reconhecimento em português e diversos idiomas
- Otimiza o texto transcrito com pontuação e formatação adequadas
- Processa automaticamente áudios em grupos onde o autoSTT está ativado

## Recursos Adicionais

### Auto-STT

Quando habilitado em um grupo, o bot automaticamente transcreve todas as mensagens de voz recebidas.

**Configuração:** Administradores podem ativar ou desativar com `!g-autoStt`

**Detalhes:**
- Transcrição automática sem necessidade de comandos
- Configurável separadamente por grupo
- Útil para acompanhar discussões em grupos sem precisar ouvir os áudios

## Código-fonte

Este sistema é implementado no arquivo `src/functions/SpeechCommands.js` e utiliza as seguintes tecnologias:
- AllTalk/XTTS para síntese de voz de alta qualidade
- Whisper para reconhecimento de fala
- FFmpeg para processamento de áudio
- Otimização de texto via LLM para melhorar a qualidade das transcrições

## Observações Técnicas

- Os modelos de síntese e reconhecimento de voz funcionam localmente
- O processamento de áudio pode levar alguns segundos dependendo do tamanho do arquivo
- Atualmente há um limite de aproximadamente 150 caracteres por síntese de voz

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*