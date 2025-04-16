# Roleta Russa

O módulo `RoletaRussaCommands.js` implementa um mini-jogo de roleta russa para grupos, onde os usuários podem testar sua sorte com o risco de receber um "timeout" temporário.

## Implementação

Este módulo simula uma roleta russa virtual, onde:

- Os jogadores têm 1 em 6 chances de "morrer" (como um revólver com 6 câmaras e apenas 1 bala)
- Quando um jogador "morre", recebe um timeout por um período configurável
- Durante o timeout, o jogador não pode jogar novamente
- O sistema mantém estatísticas de tentativas e mortes para cada jogador
- Há rankings de jogadores com mais sorte e mais mortes

Os dados são persistidos em um arquivo JSON para manter estatísticas e status de timeout mesmo após reinicialização do bot.

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!roletarussa` | Joga roleta russa, com risco de ser silenciado | - |
| `!roletaranking` | Mostra ranking da roleta russa | - |
| `!g-setTempoRoleta` | Define tempo de timeout da roleta russa (admin) | <segundos> |

## Exemplos de Uso

### Comando !roletarussa

**Entrada:**
```
!roletarussa
```

**Saída (sucesso):**
```
💨🔫 click - Tá safe! ```3```
```
(o número 3 indica quantas tentativas consecutivas bem-sucedidas o jogador tem)

**Saída (falha):**
```
💥🔫 BANG - F no chat! Morreu em 5.
Neste grupo, você já morreu 3 vezes.
```

Quando um jogador falha (morre), ele fica em timeout por um período configurado (padrão é 5 minutos). Se tentar jogar durante o timeout:

**Saída (em timeout):**
```
☠️ João já está morto na roleta russa. Ressuscita em 4m32s.
```

### Comando !roletaranking

**Entrada:**
```
!roletaranking
```

**Saída:**
```
🏆 Rankings Roleta Russa 🔫

🍀 Sorte - Máx. Tentativas sem morrer
	🥇 1°: 12 (5 atual) - Maria
	🥈 2°: 8 - Carlos
	🥉 3°: 6 - João
	🐅 4°: 5 - Ana
	🐆 5°: 3 - Pedro

🪦 Número de Mortes
	🥇 1°: 15 - Pedro
	🥈 2°: 12 - João
	🥉 3°: 10 - Maria
	🐅 4°: 8 - Ana
	🐆 5°: 5 - Carlos
```

O ranking mostra:
1. Jogadores com mais tentativas consecutivas sem morrer (recorde)
2. Jogadores com mais mortes no total

### Comando !g-setTempoRoleta

Este comando só pode ser usado por administradores e define o tempo de "morte" (timeout) em segundos.

**Entrada:**
```
!g-setTempoRoleta 600
```

**Saída:**
```
⏱️ Tempo de "morte" na roleta russa definido para 10 minuto(s).
```

## Regras do Jogo

1. Cada jogador tem 1/6 de chance de "morrer" quando joga
2. Quando um jogador morre, fica em timeout pelo tempo configurado
3. Um jogador não pode jogar duas vezes consecutivas (deve esperar outro jogador jogar)
4. O bot rastreia quantas tentativas consecutivas cada jogador consegue sem morrer
5. Ao morrer, o contador de tentativas consecutivas é reiniciado
6. O sistema mantém um recorde do maior número de tentativas sem morrer

## Funcionamento Interno

### Armazenamento de Dados

O módulo armazena dados em um arquivo JSON com a seguinte estrutura:

```json
{
  "grupos": {
    "123456789@g.us": {
      "tempoTimeout": 300,
      "jogadores": {
        "5521987654321@c.us": {
          "tentativasAtuais": 0,
          "tentativasMaximo": 12,
          "mortes": 5,
          "timeoutAte": 0
        }
      },
      "ultimoJogador": "5521987654321@c.us"
    }
  },
  "configuracoes": {
    "tempoDefault": 300
  }
}
```

### Verificação Periódica de Timeout

O módulo executa uma verificação a cada 30 segundos para verificar se algum jogador já completou seu período de timeout, atualizando seu status automaticamente.

### Limitações

- Tempo máximo de timeout: 1 hora (3600 segundos)
- Tempo mínimo de timeout: 10 segundos
- Um jogador não pode jogar duas vezes consecutivas

## Emojis de Ranking

O sistema usa emojis para representar posições no ranking:

1. 🥇 (1º lugar)
2. 🥈 (2º lugar)
3. 🥉 (3º lugar)
4. 🐅 (4º lugar)
5. 🐆 (5º lugar)
6. 🦌 (6º lugar)
7. 🐐 (7º lugar)
8. 🐏 (8º lugar)
9. 🐓 (9º lugar)
10. 🐇 (10º lugar)

## Notas

- O tempo de "morte" é específico para cada grupo
- As estatísticas são mantidas por grupo e por usuário
- O sistema permite um elemento de competição amigável no grupo
- O módulo usa timeouts baseados em tempo UNIX para maior precisão