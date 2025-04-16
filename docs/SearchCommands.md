# Comandos de Busca

O módulo `SearchCommands.js` implementa comandos para realizar buscas na web e pesquisar por imagens, permitindo que os usuários obtenham informações diretamente no chat.

## Implementação

Este módulo utiliza APIs públicas para realizar buscas na web (DuckDuckGo) e imagens (Unsplash), processando os resultados e apresentando-os de forma organizada e fácil de compreender.

As buscas são realizadas de forma assíncrona usando a biblioteca Axios para requisições HTTP.

## Comandos Disponíveis

| Comando | Descrição | Aliases |
|---------|-----------|---------|
| `!buscar` | Busca informações na web | `!google`, `!search` |
| `!buscar-img` | Busca por imagens | `!img`, `!imagem` |

## Exemplos de Uso

### Comando !buscar

**Entrada:**
```
!buscar história do Brasil
```

**Saída:**
```
🔍 Resultados para "história do Brasil":

Encyclopedia Britannica:
A história do Brasil abrange desde o período pré-colonial, com povos indígenas, até a colonização portuguesa iniciada em 1500, seguida pela independência em 1822 e os períodos imperial e republicano.

1. O Brasil foi uma colônia portuguesa de 1500 a 1822, quando declarou sua independência.
   🔗 https://www.britannica.com/place/Brazil

2. O período imperial do Brasil durou de 1822 a 1889, quando a república foi proclamada.
   🔗 https://en.wikipedia.org/wiki/Empire_of_Brazil

3. O Brasil passou por períodos democráticos e ditatoriais no século XX, com a ditadura militar de 1964-1985 sendo um período significativo.
   🔗 https://www.history.com/topics/south-america/brazil-history
```

### Comando !buscar-img

**Entrada:**
```
!buscar-img montanhas
```

**Saída:**
Primeiro, uma mensagem informando:
```
🔍 Buscando imagens para "montanhas"...
```

Em seguida, o bot envia até 3 imagens relacionadas ao tema "montanhas", cada uma com uma legenda como:
```
Resultado 1 para "montanhas" | Fonte: Unsplash
```

## Funcionamento Interno

### Busca na Web

O comando `!buscar` utiliza a API do DuckDuckGo para obter resultados de busca. O processo inclui:

1. Envio da consulta à API do DuckDuckGo
2. Processamento da resposta, extraindo:
   - Resumo do tema (AbstractText)
   - Tópicos relacionados (RelatedTopics)
3. Formatação dos resultados em uma mensagem organizada
4. Decodificação de entidades HTML nos resultados

### Busca de Imagens

O comando `!buscar-img` utiliza a API do Unsplash para encontrar imagens. O processo inclui:

1. Envio da consulta à API do Unsplash com uma chave cliente
2. Processamento das imagens retornadas
3. Download das imagens selecionadas (até 3)
4. Criação de objetos MessageMedia com as imagens
5. Envio das imagens com legendas explicativas

Em caso de falha na API do Unsplash, o sistema tem um fallback para usar imagens de placeholder.

## Limitações

- Busca na web: limitada a aproximadamente 5 resultados principais para evitar mensagens muito grandes
- Busca de imagens: limitada a 3 imagens por consulta para evitar spam e problemas de largura de banda
- As APIs públicas utilizadas têm limites de requisições, então o uso intensivo pode resultar em falhas temporárias

## Integração com Indicadores de Digitação

Ambos os comandos enviam indicadores de digitação (status "composing") durante o processamento, para proporcionar uma melhor experiência ao usuário:

```javascript
try {
  await bot.client.sendPresenceUpdate('composing', chatId);
} catch (error) {
  logger.error('Erro ao enviar indicador de digitação:', error);
}
```

## Notas Adicionais

- O comando de busca de imagens utiliza uma chave de API de demonstração do Unsplash, que tem limites de uso. Em um ambiente de produção, recomenda-se registrar uma chave própria.
- A busca na web utiliza uma API pública do DuckDuckGo, que não requer autenticação mas pode ter limites não documentados.
- Os resultados de busca são formatados para serem legíveis no WhatsApp, com emojis e formatação adequada.