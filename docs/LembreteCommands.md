# Comandos de Lembretes

O módulo `LembretesCommands.js` implementa funcionalidades para criar, listar e gerenciar lembretes agendados. Permite que os usuários configurem o bot para enviar uma mensagem específica em uma data/hora futura, incluindo possibilidade de reenviar mídias como imagens, áudios, vídeos e documentos.

## Implementação

Este módulo utiliza a biblioteca `chrono-node` para interpretar datas escritas em linguagem natural em português brasileiro, permitindo uma interface amigável para criar lembretes. Os lembretes são armazenados em um arquivo JSON, e as mídias relacionadas são salvas em um diretório específico.

O sistema possui um gerenciador inteligente de temporizadores, que lida com lembretes programados para datas muito distantes, reavalidando-os periodicamente para garantir que sejam entregues corretamente mesmo após reinicializações do bot.

## Requisitos

Para utilizar este módulo, você precisa:

1. Instalar a biblioteca chrono-node:
   ```
   npm install chrono-node
   ```

2. Garantir acesso de escrita nas pastas de dados para armazenar os lembretes e mídias relacionadas.

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!lembrar` | Cria um lembrete para uma data específica | <data/hora> |
| `!lembretes` | Lista os lembretes ativos | - |
| `!cancelar` | Cancela um lembrete por ID | <id> |

## Exemplos de Uso

### Comando !lembrar

Este comando deve ser utilizado como resposta a uma mensagem que você deseja lembrar posteriormente.

**Entrada:**
```
!lembrar amanhã às 10:00
```

**Uso em contexto:**
1. Encontre ou envie a mensagem que deseja ser lembrado
2. Responda a essa mensagem com o comando `!lembrar` seguido da data/hora
3. O bot confirmará a criação do lembrete

**Formatos de data/hora aceitos:**
- `!lembrar amanhã às 10:00`
- `!lembrar 17/04/2025 07:30`
- `!lembrar 10:00` (assume a data atual, ou amanhã se o horário já passou)
- `!lembrar amanhã` (assume 07:00 como horário padrão)

**Saída:**
```
✅ Lembrete configurado para quinta-feira, 18 de abril de 2025 às 10:00 (ID: a1b2c3)
```

### Comando !lembretes

Lista os lembretes ativos para o chat atual.

**Entrada:**
```
!lembretes
```

**Saída:**
```
📅 Lembretes Ativos:

ID: a1b2c3
Data: quinta-feira, 18 de abril de 2025 às 10:00
Tempo restante: 1d 6h 30m
Mensagem: Não esquecer de enviar o relatório 📎

Para cancelar um lembrete, use: !cancelar <id>
```

### Comando !cancelar

Cancela um lembrete específico utilizando seu ID.

**Entrada:**
```
!cancelar a1b2c3
```

**Saída:**
```
✅ Lembrete com ID a1b2c3 foi cancelado.
```

## Comportamento com Mídias

Quando um lembrete é criado a partir de uma mensagem que contém mídia (imagem, áudio, vídeo, documento, etc.), o bot irá:

1. Salvar a mídia localmente em seu sistema de arquivos
2. Ao disparar o lembrete, reenviar a mídia junto com a mensagem
3. Após o envio bem-sucedido, a mídia é excluída automaticamente para economizar espaço em disco

## Reações com Emojis

| Comando | Antes | Depois |
|---------|-------|--------|
| `!lembrar` | ⏰ | ✅ |
| `!lembretes` | 📋 | ✅ |
| `!cancelar` | ❌ | ✅ |

## Segurança e Permissões

- Usuários só podem cancelar lembretes que eles próprios criaram
- Em grupos, os lembretes são associados ao grupo mas controlados por seus criadores
- Em chats privados, somente os lembretes criados pelo próprio usuário são visíveis/gerenciáveis

## Limitações

- Tempos muito longos (superiores a 24 horas) são gerenciados por um sistema de revalidação periódica
- Se o bot for reiniciado, os temporizadores são recriados automaticamente na próxima inicialização
- Há um limite de tamanho para mídias armazenadas (dependente do espaço em disco disponível)

## Pontos Técnicos

- Todos os horários são armazenados como timestamps em UTC
- Dados são persistidos em `data/lembretes.json`
- Mídias são armazenadas em `data/lembretes-media/`
- Cada lembrete recebe um ID único gerado automaticamente
- O sistema verifica periodicamente a validade dos lembretes para garantir entrega confiável