# Comandos de Dados (Dice)

Este módulo fornece funcionalidades para rolar dados virtuais, com suporte a vários formatos e tipos de dados comuns em jogos de RPG.

## Comandos

### !d4, !d6, !d8, !d10, !d12, !d20, !d100

Rola dados com diferentes números de faces.

**Descrição:** Permite rolar dados de RPG com diferentes números de faces.

**Uso:** `!dX [quantidade]` onde X é o número de faces

**Exemplos:**
- `!d20` - Rola um dado de 20 faces
- `!d6 3` - Rola três dados de 6 faces
- `!d10 +5` - Rola um dado de 10 faces e adiciona 5 ao resultado

**Detalhes:**
- Ao rolar, mostra o resultado com o nome da pessoa que realizou o comando
- Para d20, identifica sucessos críticos (20) e falhas críticas (1)
- Limitado a um máximo de 20 dados por vez e 1000 faces por dado
- Suporta modificadores (ex: +5, -2)

### !roll

Rola dados usando notação padrão de RPG.

**Descrição:** Permite rolar dados usando a notação NdX+Y, onde N é a quantidade de dados, X o número de faces, e Y um modificador opcional.

**Uso:** `!roll [notação]`

**Exemplos:**
- `!roll d20` - Rola um dado de 20 faces
- `!roll 2d6+3` - Rola dois dados de 6 faces e adiciona 3 ao resultado
- `!roll 3d8-2` - Rola três dados de 8 faces e subtrai 2 do resultado

**Detalhes:**
- Suporta as notações d20, 2d6, 3d8+5, 4d10-2, etc.
- Mostra detalhes dos resultados individuais de cada dado
- Apresenta emojis especiais para resultados críticos em d20

## Código-fonte

Este comando é implementado no arquivo `src/functions/DiceCommands.js` e inclui as seguintes funcionalidades:
- Suporte a diferentes tipos de dados (d4, d6, d8, d10, d12, d20, d100)
- Detecção automática de sucessos e falhas críticas
- Suporte a modificadores
- Exibição de resultados formatados com o nome do jogador

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*