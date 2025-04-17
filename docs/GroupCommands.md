# Comandos de Grupo

O módulo `GroupCommands.js` implementa funcionalidades úteis para gestão e interação em grupos do WhatsApp. Este módulo facilita a comunicação em massa e a moderação de conteúdo dentro dos grupos.

## Implementação

Este módulo inclui comandos para mencionar todos os membros de um grupo de forma eficiente, permitir que usuários optem por não receber menções em massa, e recursos para moderação como apagar mensagens.

## Requisitos

Não há requisitos especiais para este módulo, pois ele utiliza apenas as funcionalidades nativas do cliente WhatsApp Web.

## Comandos Disponíveis

| Comando | Descrição | Observações |
|---------|-----------|-------------|
| `!atencao` | Menciona todos os membros do grupo | Os membros receberão uma notificação silenciosa |
| `!galera` | Alias para o comando `!atencao` | Funcionalidade idêntica ao comando atencao |
| `!ignorar` | Alterna o status de ser ignorado pelas menções em massa | Usuários ignorados não aparecerão nas menções |
| `!apagar` | Apaga uma mensagem do bot | Deve ser usado como resposta a uma mensagem |

## Exemplos de Uso

### Comando !atencao (ou !galera)

**Entrada:**
```
!atencao Reunião em 5 minutos, pessoal!
```

**Processo:**
1. O bot obtém a lista de todos os participantes do grupo
2. Filtra participantes que optaram por ser ignorados
3. Cria uma mensagem que menciona todos os demais participantes
4. Envia a mensagem com o texto fornecido

**Saída:**
```
🚨 Reunião em 5 minutos, pessoal!
```
A mensagem acima incluirá menções (@) a todos os membros não ignorados do grupo.

### Comando !ignorar

**Entrada:**
```
!ignorar
```

**Processo:**
1. O bot verifica se o usuário está na lista de ignorados do grupo
2. Alterna seu status (adiciona à lista se não estiver, remove se estiver)
3. Salva a configuração atualizada

**Saída (ao ativar ignorar):**
```
Você agora será ignorado nas menções de grupo.
```

**Saída (ao desativar ignorar):**
```
Você agora será incluído nas menções de grupo.
```

### Comando !apagar

**Uso:**
Responda a uma mensagem do bot com o comando `!apagar`

**Processo:**
1. O bot verifica se a mensagem respondida é uma mensagem enviada por ele
2. Se for do bot: apaga a mensagem citada e apaga o comando `!apagar`
3. Se não for do bot: verifica se o bot é administrador no grupo
   - Se for admin: tenta apagar a mensagem de outro usuário
   - Se não for admin: informa que não pode apagar mensagens de outros

**Comportamento Especial:**
- Reage com ✅ quando consegue apagar a mensagem
- Reage com ❌ quando falha ao apagar
- Tanto o comando quanto a mensagem original são apagados em caso de sucesso
- Em chats privados, as verificações de permissão são ignoradas

## Reações com Emojis

| Comando | Antes | Depois | Erro |
|---------|-------|--------|------|
| `!atencao` | 📢 | ✅ | ❌ |
| `!galera` | 📢 | ✅ | ❌ |
| `!ignorar` | 🔇 | ✅ | ❌ |
| `!apagar` | 🗑️ | ✅ | ❌ |

## Considerações sobre Privacidade

- Usuários podem optar por não receber menções usando o comando `!ignorar`
- A lista de usuários ignorados é armazenada no nível do grupo
- Apenas o próprio usuário pode alterar seu status de ignorado

## Considerações sobre Permissões

- O comando `!apagar` pode apagar mensagens de qualquer usuário se o bot for administrador do grupo
- Caso contrário, só pode apagar suas próprias mensagens
- O bot tenta apagar também a mensagem de comando para manter o chat limpo