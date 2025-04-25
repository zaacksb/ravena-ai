# Comandos de Riot Games

Este módulo implementa funcionalidades para consultar informações de jogadores em jogos da Riot Games, incluindo League of Legends, Wild Rift e Valorant.

## Comandos

### !lol

Busca perfil de jogador de League of Legends.

**Descrição:** Exibe informações detalhadas sobre um jogador de League of Legends, incluindo ranking, estatísticas e principais campeões.

**Uso:** `!lol [nome do invocador]`

**Exemplos:**
- `!lol Faker` - Busca o perfil do jogador "Faker"
- `!lol Hide on Bush` - Busca o perfil do jogador "Hide on Bush"

**Detalhes:**
- Mostra o nível da conta
- Exibe rankings em filas solo/duo e flex
- Apresenta taxa de vitórias em cada fila
- Lista os 5 campeões mais jogados com nível de maestria
- Usa emojis para representar os diferentes níveis/ligas

### !wr

Busca perfil de jogador de Wild Rift.

**Descrição:** Exibe informações sobre um jogador de League of Legends: Wild Rift (versão mobile).

**Uso:** `!wr [nome do jogador]#[tagline]`

**Exemplos:**
- `!wr Player123#BR1` - Busca o perfil do jogador "Player123" com tagline "BR1"
- `!wr ProGamer#NA1` - Busca o perfil do jogador "ProGamer" com tagline "NA1"

**Detalhes:**
- Requer Riot ID completo (nome#tagline)
- Mostra ranking atual no jogo
- Exibe estatísticas de partidas (vitórias/derrotas)
- Lista principais campeões jogados

### !valorant

Busca perfil de jogador de Valorant.

**Descrição:** Exibe informações sobre um jogador de Valorant, incluindo rank e agentes mais jogados.

**Uso:** `!valorant [nome do jogador]#[tagline]`

**Exemplos:**
- `!valorant Player123#BR1` - Busca o perfil do jogador "Player123" com tagline "BR1"
- `!valorant ScreaM#EU` - Busca o perfil do jogador "ScreaM" com tagline "EU"

**Detalhes:**
- Requer Riot ID completo (nome#tagline)
- Exibe rank competitivo atual
- Mostra pontuação de RR (Rank Rating)
- Lista principais agentes jogados com estatísticas
- Apresenta taxa de vitórias e estatísticas de KDA

## Sistema de Riot ID

Os jogos da Riot Games utilizam um sistema de identificação chamado Riot ID, composto por:
- **Nome do jogador**: Parte principal do ID, pode conter letras, números e alguns caracteres especiais
- **Tagline**: Código curto que segue o nome, separado por "#" (exemplo: BR1, NA1, EU)

Para Wild Rift e Valorant, é necessário fornecer o Riot ID completo no formato `Nome#Tagline`. Para League of Legends, apenas o nome do invocador é necessário.

## Código-fonte

Este módulo está implementado no arquivo `src/functions/RiotGamesCommands.js` e utiliza:
- API da Riot Games para obter dados dos jogadores
- Sistema de formatação com emojis para representação visual
- Mapas de conversão de códigos para nomes legíveis

## Configuração

O módulo requer uma chave de API da Riot Games configurada no arquivo `.env`:

```
RIOT_API_KEY=sua_chave_aqui
```

A chave pode ser obtida no [Portal de Desenvolvedores da Riot Games](https://developer.riotgames.com/).

## Observações

Atualmente, devido a limitações da API pública da Riot Games, algumas funcionalidades para Wild Rift e Valorant utilizam dados simulados. Em uma implementação completa, esses dados viriam diretamente das APIs oficiais.

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*