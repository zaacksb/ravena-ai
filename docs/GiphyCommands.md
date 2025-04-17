# Comandos Giphy

O módulo `GiphyCommands.js` implementa integração com a API do Giphy para buscar e enviar GIFs animados através do bot. Este módulo permite que os usuários pesquisem GIFs por termos específicos ou recebam GIFs populares aleatórios.

## Implementação

O módulo se conecta à API oficial do Giphy para buscar GIFs baseados em termos de pesquisa ou obter GIFs populares do momento. Os resultados são baixados e enviados como mídia animada com uma legenda informativa contendo dados como título, visualizações, classificação e fonte.

## Requisitos

Para utilizar este módulo, você precisa:

1. Uma chave de API do Giphy (gratuita ou paga)
2. Configurar a chave de API no arquivo `.env`:

```env
# Chave de API Giphy
GIPHY_API_KEY=sua_chave_api_aqui
```

Você pode obter uma chave de API do Giphy em: [https://developers.giphy.com/dashboard/](https://developers.giphy.com/dashboard/)

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!gif` | Busca e envia um GIF do Giphy | [termo de busca] |

## Exemplos de Uso

### Comando !gif com termo de busca

**Entrada:**
```
!gif gato engraçado
```

**Processo:**
1. O bot enviará uma mensagem indicando que está buscando o GIF
2. O termo "gato engraçado" é enviado para a API do Giphy
3. Um GIF aleatório dos resultados é selecionado
4. O GIF é baixado e enviado com informações detalhadas

**Saída:**
```
🔍 Busca: gato engraçado
🏷️ Título: Funny Cat Fails GIF
📅 Publicado: 12/03/2023
👀 Visualizações: 1.2M
📊 Classificação: PG
🔗 Fonte: giphy.com
```

### Comando !gif sem termos (GIFs populares)

Quando utilizado sem argumentos, o comando retorna um GIF aleatório da seção de tendências do Giphy.

**Entrada:**
```
!gif
```

**Saída:**
```
🔥 GIF Popular
🏷️ Título: Happy Dance Party GIF
📅 Publicado: 15/04/2025
👀 Visualizações: 3.5M
📊 Classificação: G
🔗 Fonte: giphy.com
```

## Reações com Emojis

| Comando | Antes | Depois |
|---------|-------|--------|
| `!gif` | 🔍 | 📱 |

## Classificação de Conteúdo

O módulo utiliza a classificação de conteúdo `pg-13` por padrão para garantir que os GIFs sejam apropriados para a maioria dos contextos. As classificações do Giphy são:

- **G**: Conteúdo adequado para todas as idades
- **PG**: Conteúdo que pode exigir orientação dos pais
- **PG-13**: Conteúdo que pode não ser adequado para menores de 13 anos
- **R**: Conteúdo restrito, não adequado para certas audiências

## Tratamento de Erros

O módulo fornece mensagens de erro específicas para diferentes problemas:

- API não configurada: "⚠️ API do Giphy não configurada. Defina GIPHY_API_KEY no arquivo .env"
- Nenhum resultado encontrado: "❌ Nenhum GIF encontrado para "[termo]". Tente outra busca."
- API inválida: "Chave de API do Giphy inválida. Verifique sua configuração."
- Limite de requisições: "Limite de requisições da API do Giphy excedido. Tente novamente mais tarde."

## Notas Adicionais

- O módulo seleciona um GIF aleatório do conjunto de resultados para variar as respostas mesmo com o mesmo termo de busca.
- Para GIFs populares, o módulo busca até 25 GIFs trending e seleciona um aleatoriamente.
- Para buscas com termo específico, o módulo busca até 15 resultados e seleciona um aleatoriamente.
- A linguagem padrão para as buscas está configurada como português (`lang: 'pt'`).
- O módulo depende do `axios` para fazer requisições HTTP para a API e baixar os GIFs.