# Sistema de Listas

O módulo `ListCommands.js` implementa um sistema completo para criação e gerenciamento de listas de membros dentro de grupos, com suporte a reações e múltiplas funcionalidades de administração.

## Implementação

Este módulo permite que usuários criem listas temáticas dentro de grupos (como times para jogos, participantes de eventos, etc.), onde os membros podem entrar ou sair facilmente através de comandos ou reações a mensagens.

O sistema armazena as listas em arquivos JSON separados para cada grupo, mantendo os dados persistentes entre reinicializações do bot.

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!listas` | Mostra as listas disponíveis no grupo | - |
| `!ll` | Alias para comando `!listas` | - |
| `!lc` | Cria uma nova lista | nome_da_lista [nome_lista2 ...] |
| `!lct` | Cria uma nova lista com título | nome_da_lista Título da Lista |
| `!ld` | Deleta uma lista | nome_da_lista [nome_lista2 ...] |
| `!le` | Entra em uma lista | nome_da_lista |
| `!ls` | Sai de uma lista | nome_da_lista |
| `!lt` | Define título de uma lista | nome_da_lista Novo Título |
| `!lr` | Remove um usuário de uma lista (admin only) | nome_da_lista número_telefone |

## Exemplos de Uso

### Comando !lc (Criar lista)

**Entrada:**
```
!lc gamers
```

**Saída:**
```
Lista criada: gamers
```

Seguido pela exibição de todas as listas disponíveis.

### Comando !lct (Criar lista com título)

**Entrada:**
```
!lct evento Participantes do Workshop de Sábado
```

**Saída:**
```
Lista criada: evento (Participantes do Workshop de Sábado)
```

### Comando !listas ou !ll

**Entrada:**
```
!listas
```

**Saída:**
```
Listas disponíveis

1️⃣ gamers (2 membros)
Membros: João, Maria

2️⃣ Participantes do Workshop de Sábado (0 membros)

Reaja com o emoji do número para entrar/sair de uma lista.
Comandos: !le <lista> (entrar), !ls <lista> (sair)
```

### Comando !le (Entrar em lista)

**Entrada:**
```
!le evento
```

**Saída:**
```
Carlos entrou na lista "Participantes do Workshop de Sábado".
```

### Comando !ls (Sair de lista)

**Entrada:**
```
!ls gamers
```

**Saída:**
```
João saiu da lista "gamers".
```

### Comando !lt (Definir título)

**Entrada:**
```
!lt gamers Jogadores de CS:GO
```

**Saída:**
```
Título da lista "gamers" atualizado para "Jogadores de CS:GO".
```

### Comando !ld (Deletar lista)

**Entrada:**
```
!ld evento
```

**Saída:**
```
Lista excluída: evento
```

### Comando !lr (Remover usuário - apenas para admins)

**Entrada:**
```
!lr gamers 5521987654321
```

**Saída:**
```
Maria foi removido da lista "Jogadores de CS:GO" por um administrador.
```

## Interação por Reações

Além dos comandos, o sistema permite entrar ou sair de listas através de reações com emojis de números (1️⃣, 2️⃣, 3️⃣, etc.) na mensagem da lista.

Quando um usuário reage a um número correspondente a uma lista, o bot:
1. Verifica se o usuário já está na lista
2. Se estiver, remove o usuário da lista
3. Se não estiver, adiciona o usuário à lista
4. Envia uma mensagem confirmando a ação

## Estrutura de Dados

Cada lista armazena:
- Nome (identificador único)
- Título (nome de exibição, opcional)
- Timestamp de criação
- ID do criador
- Lista de membros (com IDs, nomes e timestamps)

As informações são armazenadas em arquivos JSON separados para cada grupo na pasta `data/lists/`.

## Integração com Sistema de Apelidos

O módulo se integra com o sistema de apelidos dos grupos, exibindo apelidos em vez de nomes reais quando disponíveis. Isso é útil para grupos onde os usuários preferem usar nomes personalizados em vez de seus nomes do WhatsApp.

## Funções Internas

- `processListReaction`: Processa reações de emoji para entrar/sair de listas
- `getGroupLists`: Obtém listas para um grupo específico
- `saveGroupLists`: Salva listas de um grupo no armazenamento
- `getUserDisplayName`: Obtém nome de exibição do usuário (com suporte a apelidos)
- `showLists`: Exibe todas as listas disponíveis
- `createList`: Cria uma nova lista
- `createListWithTitle`: Cria uma nova lista com título personalizado
- `deleteList`: Exclui uma lista
- `joinList`: Adiciona usuário a uma lista
- `leaveList`: Remove usuário de uma lista
- `setListTitle`: Define o título de uma lista
- `removeFromList`: Remove um usuário de uma lista (função administrativa)

## Notas

- As listas são específicas para cada grupo
- Usuários podem participar de múltiplas listas ao mesmo tempo
- O sistema de reações facilita a entrada/saída de listas sem necessidade de digitar comandos
- Apenas administradores podem remover outros usuários das listas
- O número máximo de listas que podem aparecer com emojis de número é 10 (1️⃣ até 🔟)