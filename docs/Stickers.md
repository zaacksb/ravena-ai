# Comandos de Stickers

Este módulo implementa funcionalidades para criar, editar e converter stickers a partir de imagens, vídeos e GIFs.

## Comandos

### !sticker / !s

Converte imagens, vídeos ou GIFs em stickers.

**Descrição:** Transforma mídias em stickers do WhatsApp, preservando as proporções originais.

**Uso:** 
- Envie o comando junto com uma mídia
- Ou responda a uma mensagem com mídia usando o comando

**Exemplos:**
- Envie uma imagem com o comando `!sticker`
- Responda a um vídeo com `!s`
- `!sticker Nome do Pack` - Define o nome do pack de stickers

**Detalhes:**
- Funciona com imagens, vídeos e GIFs
- Preserva a proporção original
- Permite definir o nome do pacote de stickers
- Possui um alias curto `!s` para facilitar o uso

### !sq / !stickerq

Cria stickers quadrados cortando o centro da imagem.

**Descrição:** Cria stickers com formato perfeitamente quadrado, cortando a imagem pelo centro.

**Uso:** Igual ao comando !sticker

**Detalhes:**
- Recorta a imagem em formato quadrado a partir do centro
- Ideal para imagens que precisam de um formato quadrado perfeito

### !sqc / !stickerqc

Cria stickers quadrados cortando a parte superior (cima) da imagem.

**Descrição:** Cria stickers quadrados mantendo a parte superior da imagem.

**Uso:** Igual ao comando !sticker

**Detalhes:**
- Mantém a parte superior da imagem, recortando-a em formato quadrado
- Útil para fotos de pessoas ou objetos onde a parte superior é mais importante

### !sqb / !stickerqb

Cria stickers quadrados cortando a parte inferior (baixo) da imagem.

**Descrição:** Cria stickers quadrados mantendo a parte inferior da imagem.

**Uso:** Igual ao comando !sticker

**Detalhes:**
- Mantém a parte inferior da imagem, recortando-a em formato quadrado
- Útil quando a parte mais importante da imagem está na parte de baixo

### !sqe / !stickerqe

Cria stickers quadrados esticando a imagem.

**Descrição:** Cria stickers quadrados esticando a imagem para preencher um quadrado perfeito.

**Uso:** Igual ao comando !sticker

**Detalhes:**
- Em vez de cortar, estica a imagem para o formato quadrado
- Pode distorcer a imagem, mas não perde nenhuma parte dela

## Recursos Adicionais

Os comandos de sticker também oferecem:

- Conversão de imagens e vídeos em stickers
- Conversão de stickers de volta para a mídia original
- Processamento de mídia para garantir compatibilidade com WhatsApp
- Várias opções de formato (original, quadrado centralizado, topo, base, esticado)

## Código-fonte

Este sistema é implementado no arquivo `src/functions/Stickers.js` e utiliza as seguintes tecnologias:
- Sharp para processamento de imagens
- FFmpeg para processamento de vídeos
- MessageMedia para envio das mídias processadas

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*