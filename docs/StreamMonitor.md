# Comandos de Monitoramento de Streams

Este módulo implementa funcionalidades para monitorar e exibir informações sobre canais de streaming do Twitch, Kick e YouTube.

## Comandos

### !streams

Lista todos os canais configurados para monitoramento no grupo.

**Descrição:** Exibe todos os canais de streaming configurados no grupo atual, junto com suas configurações.

**Uso:** `!streams`

**Detalhes:**
- Lista canais do Twitch, Kick e YouTube configurados
- Mostra configurações como notificações online/offline, alteração de título e uso de IA
- Agrupa canais por plataforma
- Exibe contagem de itens de mídia configurados para cada canal

### !streamstatus

Mostra o status atual dos canais monitorados.

**Descrição:** Exibe o status (online/offline) dos canais de streaming configurados no grupo.

**Uso:** `!streamstatus`

**Detalhes:**
- Mostra se cada canal está online ou offline
- Para canais online, exibe título, categoria/jogo, número de espectadores e hora de início
- Para canais do YouTube, mostra informações sobre o último vídeo publicado
- Agrupa canais por plataforma

### !streamers

Lista todos os streamers atualmente online.

**Descrição:** Exibe todos os streamers monitorados pelo bot que estão atualmente online.

**Uso:** `!streamers`

**Detalhes:**
- Lista todos os streamers online em todas as instâncias do bot
- Agrupa por plataforma (Twitch, Kick, YouTube)
- Mostra nome do canal, categoria/jogo e número de espectadores
- Útil para descobrir streamers ativos na comunidade

### !live

Mostra informações detalhadas sobre uma stream da Twitch.

**Descrição:** Exibe informações detalhadas sobre um canal específico da Twitch ou todos os canais configurados.

**Uso:** 
- `!live [nome do canal]`
- `!live` (mostra informações de todos os canais configurados)

**Detalhes:**
- Exibe título da stream, categoria/jogo, espectadores e duração
- Mostra thumbnail da stream quando disponível
- Inclui link direto para a stream
- Quando usado sem argumentos, exibe informações de todos os canais Twitch configurados no grupo

### !live-kick

Mostra informações detalhadas sobre uma stream do Kick.

**Descrição:** Similar ao comando !live, mas para canais do Kick.

**Uso:** 
- `!live-kick [nome do canal]`
- `!live-kick` (mostra informações de todos os canais configurados)

**Detalhes:**
- Funcionalidade similar ao comando !live, mas específico para o Kick
- Exibe informações detalhadas sobre streams do Kick

### !topstreams

Mostra as streams mais populares no momento.

**Descrição:** Exibe as streams mais populares do Twitch e Kick.

**Uso:** 
- `!topstreams`
- `!topstreams [twitch|kick] [número]`

**Exemplos:**
- `!topstreams` - Mostra top 5 de cada plataforma
- `!topstreams twitch` - Mostra apenas streams do Twitch
- `!topstreams kick 10` - Mostra top 10 streams do Kick

**Detalhes:**
- Exibe as streams mais populares por espectadores
- Permite filtrar por plataforma
- Permite definir número de resultados (1-10)
- Mostra título, categoria/jogo e contagem de espectadores
- Tem aliases: !popular, !top-streams, !top

## Configuração de Canais

Para configurar canais de monitoramento, use os comandos de gerenciamento:

- `!g-twitch-canal [nome do canal]` - Ativa/desativa monitoramento de canal Twitch
- `!g-kick-canal [nome do canal]` - Ativa/desativa monitoramento de canal Kick
- `!g-youtube-canal [nome do canal]` - Ativa/desativa monitoramento de canal YouTube

## Código-fonte

Este módulo está implementado no arquivo `src/functions/StreamCommands.js` e trabalha em conjunto com o sistema StreamMonitor para gerenciamento e monitoramento contínuo de canais.

## Características Adicionais

- **Notificações automáticas** quando streamers ficam online/offline
- **Alteração de título do grupo** quando streamers ficam online/offline
- **Mensagens customizadas** usando mídia personalizada para eventos
- **Integração com IA** para gerar mensagens personalizadas sobre streams

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*