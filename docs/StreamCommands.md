# Monitoramento de Streams

O módulo `StreamCommands.js` implementa comandos para interagir com o sistema de monitoramento de streams (Twitch, Kick e YouTube) do bot, permitindo listar e verificar o status dos canais monitorados.

## Implementação

Este módulo trabalha em conjunto com o `StreamSystem.js` e o `StreamMonitor.js` para fornecer uma interface amigável para os usuários consultarem informações sobre canais monitorados. O sistema principal de configuração de canais é gerenciado através de comandos administrativos (`!g-twitch-canal`, `!g-kick-canal`, etc.).

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!streams` | Lista todos os canais configurados para monitoramento | - |
| `!streamstatus` | Mostra status dos canais monitorados (online/offline) | - |

## Exemplos de Uso

### Comando !streams

**Entrada:**
```
!streams
```

**Saída:**
```
Canais Monitorados neste Grupo

Twitch:
• streamer1
  - Notificação online: 1 item(s)
  - Notificação offline: 0 item(s)
  - Alterar título: ✅
  - Usar IA: ✅

• streamer2
  - Notificação online: 1 item(s)
  - Notificação offline: 1 item(s)
  - Alterar título: ❌
  - Usar IA: ✅

Kick:
• kickstreamer
  - Notificação online: 1 item(s)
  - Notificação offline: 0 item(s)
  - Alterar título: ✅
  - Usar IA: ❌

YouTube:
• channel1
  - Notificação de vídeo: 1 item(s)
  - Alterar título: ✅
  - Usar IA: ✅
```

### Comando !streamstatus

**Entrada:**
```
!streamstatus
```

**Saída:**
```
Status dos Canais Monitorados

Twitch:
• streamer1: 🟢 ONLINE
  - Título: Jogando Minecraft com viewers!
  - Viewers: 1245
  - Online desde: 16/04/2025, 14:30:00

• streamer2: 🔴 OFFLINE

Kick:
• kickstreamer: 🟢 ONLINE
  - Título: Bate-papo com inscritos
  - Viewers: 532
  - Online desde: 16/04/2025, 15:45:00

YouTube:
• channel1: 📹 Último vídeo
  - Título: Como criar um bot de WhatsApp
  - Publicado: 15/04/2025, 10:00:00
  - Link: https://youtube.com/watch?v=xyz123
```

## Funcionamento do Monitoramento

O sistema geral de monitoramento funciona da seguinte forma:

1. Administradores configuram canais a serem monitorados com comandos como `!g-twitch-canal`
2. O `StreamMonitor` verifica periodicamente o status desses canais
3. Quando um canal muda de estado (online/offline) ou publica um novo vídeo, eventos são gerados
4. Esses eventos acionam notificações automáticas nos grupos

Os comandos deste módulo simplesmente consultam o estado atual do monitoramento e exibem informações relevantes, sem modificar a configuração.

## Plataformas Suportadas

O sistema atualmente suporta três plataformas:

1. **Twitch**: Monitoramento de streams ao vivo
2. **Kick**: Monitoramento de streams ao vivo
3. **YouTube**: Monitoramento de streams ao vivo e novos vídeos

## Formatação de Estado

O sistema usa emojis para representar diferentes estados:

- 🟢 **ONLINE**: Stream ao vivo no momento
- 🔴 **OFFLINE**: Canal offline
- 📹 **Último vídeo**: Informações sobre o vídeo mais recente (para YouTube)
- ❓ **Status desconhecido**: Quando não foi possível determinar o estado

## Integração com Sistema de Notificações

Embora os comandos apenas mostrem o status atual, eles se conectam ao mesmo sistema que gera notificações automáticas quando:

- Um canal fica online
- Um canal fica offline
- Um canal do YouTube publica um novo vídeo

## Limitações

- O status exibido representa um snapshot do momento da verificação
- A precisão das informações depende da última verificação realizada pelo `StreamMonitor`
- Alguns canais podem mostrar status desconhecido se a API da plataforma apresentar problemas
- Canais de YouTube são verificados principalmente para novos vídeos, embora também suportem detecção de streams ao vivo

## Notas Adicionais

- Para configurar canais a serem monitorados, use os comandos administrativos
- O intervalo de verificação padrão é de 1 minuto por plataforma
- As chaves de API necessárias para monitoramento da Twitch devem ser configuradas no arquivo `.env`
- A mudança de título automática só funciona se o bot for administrador do grupo