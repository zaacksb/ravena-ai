# Comandos de Dados (Dice)

O módulo `DiceCommands.js` implementa funcionalidades para rolagem de dados virtuais, especialmente útil para jogadores de RPG de mesa. Este módulo permite que os usuários lancem dados de diferentes faces e quantidades, aplicando modificadores quando necessário.

## Implementação

Este módulo utiliza expressões regulares para reconhecer padrões de dados em formato standard de RPG (XdY+Z). Ele também reconhece sucessos e falhas críticas em dados d20 e fornece emojis indicativos para diferentes resultados.

## Requisitos

Não há requisitos especiais para este módulo, pois ele não depende de APIs externas ou configurações adicionais.

## Comandos Disponíveis

### Comandos de Dados Comuns

| Comando | Descrição |
|---------|-----------|
| `!d4` | Rola um dado de 4 faces |
| `!d6` | Rola um dado de 6 faces |
| `!d8` | Rola um dado de 8 faces |
| `!d10` | Rola um dado de 10 faces |
| `!d12` | Rola um dado de 12 faces |
| `!d20` | Rola um dado de 20 faces |
| `!d100` | Rola um dado de 100 faces |

### Comando Roll (Personalizado)

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!roll` | Rola dados com padrão customizado | <padrão> |

## Exemplos de Uso

### Dados Comuns

**Entrada:**
```
!d20
```

**Saída:**
```
Jogador rolou:
🎲 17 (d20)
```

**Entrada (com número de dados):**
```
!d6 3
```

**Saída:**
```
Jogador rolou:
🎲 14 [4 + 6 + 4] (3d6)
```

**Entrada (com modificador):**
```
!d20 +5
```

**Saída:**
```
Jogador rolou:
🎲 23 [18 + 5] (d20+5)
```

### Comando Roll (Formato Customizado)

**Entrada:**
```
!roll 2d8+3
```

**Saída:**
```
Jogador rolou:
🎲 17 [8 + 6 + 3] (2d8+3)
```

### Resultados Especiais

**Sucesso Crítico (d20 = 20):**
```
Jogador rolou:
✨ 20 (Sucesso Crítico!) (d20)
```

**Falha Crítica (d20 = 1):**
```
Jogador rolou:
💀 1 (Falha Crítica!) (d20)
```

## Formatos Aceitos

O módulo aceita os seguintes formatos de rolagem:

- `d20` - Um dado de 20 faces
- `2d6` - Dois dados de 6 faces
- `d8+5` - Um dado de 8 faces com modificador +5
- `3d10-2` - Três dados de 10 faces com modificador -2

## Tratamento de Nomes de Usuários

O módulo mostra o nome do usuário que realizou a rolagem na mensagem de resultado:

- Se o usuário tiver um apelido personalizado definido no grupo, esse apelido será usado
- Caso contrário, utiliza o nome do contato ou "pushname" do WhatsApp
- Se nenhuma informação estiver disponível, utiliza "Jogador" como padrão

## Reações com Emojis

| Comando | Antes | Depois |
|---------|-------|--------|
| Todos os comandos de dados | 🎲 | 🎯 |

## Emojis de Resultado

| Resultado | Emoji | Descrição |
|-----------|-------|-----------|
| Normal | 🎲 | Resultado padrão |
| Sucesso Crítico | ✨ | Quando um d20 resulta em 20 |
| Falha Crítica | 💀 | Quando um d20 resulta em 1 |

## Limites e Segurança

Para evitar spam e abuso, o módulo impõe os seguintes limites:

- Máximo de 20 dados por rolagem
- Máximo de 1000 faces por dado
- Valores inválidos são automaticamente ajustados para limites seguros

Quando um limite é excedido, o usuário recebe uma notificação, e o valor é ajustado para o máximo permitido.

## Notas Adicionais

- O módulo utiliza um gerador de números pseudo-aleatórios baseado em `Math.random()`
- A detecção de sucesso/falha crítica só ocorre para rolagens simples de um d20
- Nomes de usuários são obtidos do contato do WhatsApp ou de apelidos personalizados definidos no grupo
- O módulo formata a saída de forma diferente dependendo do tipo de rolagem para uma experiência mais amigável