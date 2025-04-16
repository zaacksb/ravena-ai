# Stickers

O módulo `Stickers.js` implementa funcionalidades para criação e gerenciamento de stickers (figurinhas) a partir de imagens e vídeos para o WhatsApp.

## Implementação

Este módulo aproveita as funcionalidades nativas da biblioteca `whatsapp-web.js` para converter imagens e vídeos em stickers, adicionando camadas de lógica para melhorar a experiência do usuário e possibilitar a extração de stickers existentes.

## Comandos Disponíveis

| Comando | Descrição | Aliases |
|---------|-----------|---------|
| `!sticker` | Converte mídia em sticker | `!s` |

## Exemplos de Uso

### Comando !sticker ou !s

O comando pode ser usado de três formas:

1. **Com mídia direta** - Enviando uma imagem ou vídeo com a legenda contendo o comando

**Entrada:**
```
!sticker Nome do Sticker
```
(enviando junto com uma imagem ou vídeo)

**Saída:**
A imagem ou vídeo convertido em um sticker, com o nome especificado.

2. **Como resposta a uma mensagem com mídia** - Respondendo a uma mensagem que contenha imagem ou vídeo

**Entrada:**
```
!sticker Nome do Sticker
```
(respondendo a uma mensagem com imagem ou vídeo)

**Saída:**
A imagem ou vídeo da mensagem citada convertido em um sticker, com o nome especificado.

3. **Como resposta a um sticker existente** - Para extrair a mídia original de um sticker

**Entrada:**
```
!sticker
```
(respondendo a um sticker)

**Saída:**
A mídia original do sticker (imagem ou vídeo) é enviada.

Se nenhum nome for especificado para o sticker, o bot usará o nome do grupo atual como nome do sticker.

## Reações com Emojis

O comando utiliza reações com emojis para indicar diferentes estados:

- **Antes**: 🖼 - Indica que o comando está sendo processado
- **Depois**: ✅ - Indica que o comando foi executado com sucesso
- **Erro**: ❌ - Indica que ocorreu um erro durante o processamento

## Verificações e Validações

O módulo realiza várias verificações para garantir que o comando seja usado corretamente:

1. **Verificação de mídia** - Garante que o comando seja usado com uma imagem ou vídeo
2. **Tipo de mídia suportado** - Verifica se o tipo de mídia pode ser convertido em sticker (imagem, vídeo ou GIF)
3. **Extração de sticker** - Detecta quando o comando é usado para extrair a mídia original de um sticker

## Tratamento de Erros

O módulo implementa tratamento de erros robusto, com mensagens específicas para diferentes situações:

- Tipo de mídia não suportado
- Erro ao baixar mídia
- Erro ao processar sticker

## Integração com WhatsApp-Web.js

O módulo aproveita a API do WhatsApp-Web.js para criar stickers, utilizando o método `sendMessage` com opções especiais:

```javascript
await bot.sendMessage(chatId, media, { 
  sendMediaAsSticker: true,
  stickerAuthor: "ravena",
  stickerName: stickerName,
  quotedMessageId: message.origin.id._serialized
});
```

## Funcionalidade de Extração de Sticker

Uma característica especial deste módulo é a capacidade de extrair a mídia original de um sticker. Quando um usuário responde a uma mensagem de sticker com o comando `!sticker` ou `!s`, o bot baixa o sticker e envia de volta a mídia original (imagem ou vídeo) que foi usada para criar o sticker.

Isso é útil para quando o usuário deseja obter a imagem original de um sticker recebido.
Para vídeos, infelizmente não funciona. Um dia ainda irei descobrir o motivo.

## Reações Automáticas

Além do comando direto, o sistema também suporta criação de stickers através de reações com emoji. Quando um usuário reage a uma mensagem com mídia usando o emoji 🖼, o bot automaticamente converte essa mídia em um sticker.

Essa funcionalidade é implementada no módulo `ReactionsHandler.js` e se integra com o sistema de stickers.

## Notas Adicionais

- Stickers de vídeo têm um limite máximo de duração (aproximadamente 10 segundos)
- O WhatsApp comprime os stickers durante o processo de criação, então a qualidade pode ser reduzida
- Stickers são sempre enviados com fundo transparente (para imagens que suportam transparência)
- Metadados como nome e autor do sticker são preservados e podem ser visualizados nas informações do sticker
- O módulo pode ser facilmente expandido para suportar novas funcionalidades de stickers