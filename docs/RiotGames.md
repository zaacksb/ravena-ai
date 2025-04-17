# Comandos de Jogos Riot

O módulo `RiotGames.js` implementa comandos para acessar estatísticas de jogadores dos produtos da Riot Games, incluindo League of Legends, Wild Rift e Valorant, utilizando a API oficial da Riot Games.

## Implementação

Este módulo obtém dados dos jogadores diretamente dos endpoints da API da Riot Games para fornecer:
- Informações atuais de ranque e pontos de liga (LP)
- Registros de vitórias/derrotas e taxas de vitória
- Preferências de campeões/agentes e níveis de maestria
- Estatísticas de desempenho apropriadas para cada jogo

Os dados são formatados em mensagens claras, aprimoradas com emojis, que apresentam as informações mais relevantes de forma legível.

## Requisitos Externos

Para utilizar este módulo, é necessária uma chave de API da Riot Games, que deve ser configurada no arquivo `.env`:

```env
RIOT_API_KEY=sua_chave_api_aqui
```

Você pode obter uma chave de API registrando-se como desenvolvedor no [Portal de Desenvolvedores da Riot](https://developer.riotgames.com/).

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!lol` | Mostra estatísticas de invocador do League of Legends | `<nome_do_invocador>` |
| `!wr` | Mostra estatísticas de jogador do Wild Rift | `<nome_jogador#tagline>` |
| `!valorant` | Mostra estatísticas de jogador do Valorant | `<nome_jogador#tagline>` |

## Exemplos de Uso

### Busca de Invocador no League of Legends

**Entrada:**
```
!lol Faker
```

**Saída:**
```
🎮 League of Legends - Faker

📊 Nível: 98

💪 Ranque Solo/Duo:
🏆 CHALLENGER I (1247 LP)
🏅 451V 312D (59% taxa de vitória)

👥 Ranque Flex:
🥇 GOLD II (45 LP)
🏅 15V 5D (75% taxa de vitória)

🏆 Principais Campeões:
1. LeBlanc (Nível 7, 542.331 pts)
2. Azir (Nível 7, 345.124 pts)
3. Ahri (Nível 7, 312.887 pts)
4. Zed (Nível 7, 256.998 pts)
5. Syndra (Nível 7, 211.345 pts)
```

### Busca de Jogador no Wild Rift

**Entrada:**
```
!wr ProPlayer#NA1
```

**Saída:**
```
📱 Wild Rift - ProPlayer#NA1

🏆 Ranqueada:
💎 DIAMOND II (75 LP)
🏅 86V 54D (61% taxa de vitória)

🏆 Principais Campeões:
1. Yasuo (Nível 7, 62.453 pts)
2. Akali (Nível 6, 45.231 pts)
3. Ezreal (Nível 7, 42.876 pts)
4. Lee Sin (Nível 6, 39.654 pts)
5. Miss Fortune (Nível 5, 25.789 pts)
```

### Busca de Jogador no Valorant

**Entrada:**
```
!valorant TacticalAim#NA1
```

**Saída:**
```
🔫 Valorant - TacticalAim#NA1

🏆 Ranque Competitivo:
🏆 IMMORTAL II (75 RR)
🏅 56V 34D (62% taxa de vitória)

👤 Principais Agentes:
1. Jett - 42 partidas, 68% TX, 1.85 KDA
2. Reyna - 35 partidas, 72% TX, 2.12 KDA
3. Chamber - 28 partidas, 64% TX, 1.78 KDA
4. Sage - 22 partidas, 59% TX, 1.56 KDA
5. Omen - 18 partidas, 55% TX, 1.62 KDA
```

## Notas Técnicas

### Autenticação

Todas as requisições da API incluem a chave da API da Riot no cabeçalho:

```javascript
{ headers: { 'X-Riot-Token': RIOT_API_KEY } }
```

### Limitação de Taxa

A Riot Games impõe limites rigorosos de taxa nas requisições da API. Este módulo inclui tratamento básico de erros, mas para uso de alto volume, pode ser necessário implementar um tratamento mais robusto de limitação de taxa e caching.

### Gerenciamento de Região

A implementação atual assume a região NA por simplicidade. Para uma implementação mais abrangente, parâmetros de região poderiam ser adicionados a cada comando para suportar jogadores de diferentes regiões.

### Fluxo de Recuperação de Dados

Para cada jogo, a recuperação de dados segue este padrão geral:

1. Obter informações básicas do jogador por nome/ID
2. Usar o PUUID (ID Universal Único do Jogador) retornado para buscar estatísticas detalhadas
3. Organizar e formatar os dados para exibição

### Uso de Emojis

O módulo utiliza emojis para tornar a saída mais visualmente atraente e mais fácil de ler:

- Níveis de ranque (Ferro até Desafiante) têm emojis de medalhas correspondentes
- Estatísticas de vitória/derrota incluem emojis de troféu
- Elementos específicos de cada jogo usam emojis temáticos apropriados