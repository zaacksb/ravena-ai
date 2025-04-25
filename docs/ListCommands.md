# Comandos de Listas

Este módulo implementa funcionalidades para criar e gerenciar listas dentro dos grupos, permitindo que os membros participem ou saiam facilmente através de comandos ou reações.

## Comandos

### !listas / !ll

Mostra as listas disponíveis no grupo.

**Descrição:** Exibe todas as listas criadas no grupo atual, com seus membros e informações.

**Uso:** `!listas` ou `!ll`

**Detalhes:**
- Mostra todas as listas com seus membros
- Exibe números de reação para entrar ou sair facilmente
- Mostra título personalizado de cada lista quando configurado
- Funciona apenas em grupos

### !lc

Cria uma nova lista simples.

**Descrição:** Cria uma ou mais listas com nomes simples.

**Uso:** `!lc [nome_lista1] [nome_lista2] ...`

**Exemplos:**
- `!lc jogadores` - Cria uma lista chamada "jogadores"
- `!lc online ausentes` - Cria duas listas: "online" e "ausentes"

**Detalhes:**
- Pode criar múltiplas listas de uma vez
- Os nomes das listas não devem conter espaços
- Não sobrescreve listas existentes
- Funciona apenas em grupos

### !lct

Cria uma nova lista com título personalizado.

**Descrição:** Cria uma lista com um nome curto e um título mais descritivo.

**Uso:** `!lct [nome_lista] [título descritivo]`

**Exemplos:**
- `!lct jogadores Jogadores da Raid de Sexta`
- `!lct evento Participantes do Evento de Aniversário`

**Detalhes:**
- O nome da lista é usado nos comandos
- O título aparece na exibição da lista
- O título pode conter espaços e ser mais descritivo
- Funciona apenas em grupos

### !ld

Deleta uma ou mais listas.

**Descrição:** Remove listas existentes do grupo.

**Uso:** `!ld [nome_lista1] [nome_lista2] ...`

**Exemplos:**
- `!ld jogadores` - Remove a lista "jogadores"
- `!ld online ausentes` - Remove as listas "online" e "ausentes"

**Detalhes:**
- Pode excluir múltiplas listas de uma vez
- Pede confirmação antes de excluir
- Funciona apenas em grupos

### !le

Entra em uma lista.

**Descrição:** Adiciona o usuário a uma lista existente.

**Uso:** `!le [nome_lista]`

**Exemplos:**
- `!le jogadores` - Adiciona o usuário à lista "jogadores"

**Detalhes:**
- Adiciona o usuário que enviou o comando
- Usa o nome de exibição ou apelido do usuário
- Alternativa ao uso de reações numéricas
- Funciona apenas em grupos

### !ls

Sai de uma lista.

**Descrição:** Remove o usuário de uma lista existente.

**Uso:** `!ls [nome_lista]`

**Exemplos:**
- `!ls jogadores` - Remove o usuário da lista "jogadores"

**Detalhes:**
- Remove o usuário que enviou o comando
- Alternativa ao uso de reações numéricas
- Funciona apenas em grupos

### !lt

Define o título de uma lista existente.

**Descrição:** Altera o título descritivo de uma lista existente.

**Uso:** `!lt [nome_lista] [novo_título]`

**Exemplos:**
- `!lt jogadores Jogadores do Torneio de Sábado`

**Detalhes:**
- Mantém o nome curto da lista, apenas altera o título
- Útil para atualizar descrições de listas
- Funciona apenas em grupos

### !lr

Remove um usuário de uma lista (apenas administradores).

**Descrição:** Permite que administradores removam outros usuários de listas.

**Uso:** `!lr [nome_lista] [número ou nome do usuário]`

**Exemplos:**
- `!lr jogadores 5521987654321`
- `!lr jogadores João`

**Detalhes:**
- Apenas administradores do grupo podem usar
- Útil para manutenção de listas
- Pode usar número de telefone ou parte do nome
- Funciona apenas em grupos

## Entrada/Saída via Reações

Além dos comandos, os usuários podem entrar ou sair das listas usando reações numéricas:

1. Quando a lista de listas é exibida com `!listas`, cada lista tem um número associado
2. Reagir com o emoji desse número (por exemplo: 1️⃣, 2️⃣, 3️⃣) alterna a participação na lista
3. Se o usuário já está na lista, ele sai; se não está, ele entra

Este método é mais prático e intuitivo que usar os comandos `!le` e `!ls`.

## Código-fonte

Este módulo está implementado no arquivo `src/functions/ListCommands.js` e utiliza:
- Sistema de persistência baseado em JSON
- Manipulação de reações para facilitar participação
- Integração com sistema de apelidos do grupo

## Limitações

- Funciona apenas em grupos
- Nomes de listas não podem conter espaços
- Alguns comandos são limitados a administradores

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*