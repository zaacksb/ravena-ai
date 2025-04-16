# Comandos de Grupo

O módulo `GroupCommands.js` implementa funcionalidades específicas para interação em grupos de WhatsApp, como mencionar todos os participantes e gerenciar preferências de menções.

## Implementação

Este módulo foi desenvolvido para oferecer ferramentas úteis em conversas de grupo, com foco em facilitar a comunicação entre múltiplos participantes e permitir que membros personalizem suas preferências de interação.

As principais funcionalidades incluem:
- Mencionar todos os membros de um grupo silenciosamente (sem notificação de som)
- Permitir que usuários optem por ser ignorados nas menções em massa
- Manter preferências dos usuários persistentes no banco de dados

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!atencao` | Menciona todos os membros do grupo silenciosamente | [mensagem] (opcional) |
| `!galera` | Alias para `!atencao` | [mensagem] (opcional) |
| `!ignorar` | Alterna ser ignorado nas menções de grupo | - |

## Exemplos de Uso

### Comando !atencao ou !galera

**Entrada:**
```
!atencao Reunião em 5 minutos!
```

**Saída:**
```
Reunião em 5 minutos!
```
A mensagem menciona todos os membros do grupo (exceto aqueles que optaram por ser ignorados), mas sem gerar notificação sonora.

Se nenhuma mensagem for fornecida, o bot usará uma mensagem padrão:

**Entrada:**
```
!atencao
```

**Saída:**
```
🚨 Atenção pessoal! 🚨
```

### Comando !ignorar

**Entrada:**
```
!ignorar
```

**Saída (primeira vez):**
```
Você agora será ignorado nas menções de grupo.
```

**Saída (segunda vez):**
```
Você agora será incluído nas menções de grupo.
```

Este comando funciona como um toggle, alternando entre ser incluído ou ignorado nas menções de grupo.

## Funcionamento Interno

### Menções em Grupo

Quando um usuário executa `!atencao` ou `!galera`:

1. O bot recupera a lista de todos os participantes do grupo
2. Filtra participantes que optaram por ser ignorados
3. Cria uma menção para cada participante
4. Envia a mensagem com todas as menções

Tecnicamente, o bot está usando a funcionalidade de API do WhatsApp para criar menções que não geram som de notificação, o que é útil para obter a atenção dos membros sem ser intrusivo.

### Sistema de Ignorar

O sistema de ignorar menções funciona da seguinte forma:

1. Quando um usuário executa `!ignorar`, o bot verifica se o usuário já está na lista de ignorados
2. Se não estiver, adiciona o usuário à lista
3. Se já estiver, remove o usuário da lista
4. A lista é armazenada no banco de dados para persistência

Os dados são armazenados na propriedade `ignoredUsers` no objeto do grupo, que é persistido no banco de dados do bot.

## Notas Adicionais

- Os comandos só funcionam em grupos, não em conversas privadas
- Administradores de grupo sempre conseguem mencionar todos os membros, mesmo aqueles que optaram por ser ignorados usando o comando do bot
- O sistema é projetado para ser não-intrusivo, respeitando as preferências dos usuários
- A lista de usuários ignorados é específica para cada grupo, então um usuário pode optar por ser ignorado em um grupo mas não em outro