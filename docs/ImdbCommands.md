# Comandos IMDB

Este módulo implementa funcionalidades para buscar informações sobre filmes e séries no IMDB (Internet Movie Database).

## Comandos

### !imdb

Busca informações sobre filmes ou séries no IMDB.

**Descrição:** Pesquisa e apresenta informações detalhadas sobre filmes, séries e produções audiovisuais, incluindo sinopse, elenco, avaliações e mais.

**Uso:** `!imdb [nome do filme ou série]`

**Exemplos:**
- `!imdb Inception`
- `!imdb Breaking Bad`
- `!imdb O Senhor dos Anéis`
- `!imdb Pulp Fiction`

**Detalhes:**
- Busca filmes e séries na base de dados do IMDB/OMDB
- Apresenta título, ano, classificação, duração e gênero
- Exibe informações sobre direção, roteiro e elenco
- Mostra avaliações do IMDB e outras fontes
- Inclui sinopse traduzida para português
- Quando disponível, inclui poster do filme/série
- Fornece link para a página do IMDB

## Informações Exibidas

O comando fornece as seguintes informações sobre o filme ou série:

### Informações Básicas
- Título original e ano de lançamento
- Tipo (filme, série, episódio)
- Classificação indicativa
- Duração
- Gêneros

### Equipe de Produção
- Direção
- Roteiro
- Elenco principal

### Avaliações
- Nota no IMDB (0-10)
- Número de votos
- Avaliações de outras fontes (Rotten Tomatoes, Metacritic, etc.)

### Conteúdo
- Sinopse em português (traduzida automaticamente)
- Poster/imagem do filme ou série
- Link para a página completa no IMDB

## Código-fonte

Este módulo está implementado no arquivo `src/functions/ImdbCommands.js` e utiliza:
- API OMDB (baseada no IMDB) para dados de filmes e séries
- Sistema de tradução para converter sinopses para português
- MessageMedia para envio de posters

## Configuração

O módulo requer uma chave de API do OMDB configurada no arquivo `.env`:

```
OMDB_API_KEY=sua_chave_aqui
```

A chave de API pode ser obtida gratuitamente em [omdbapi.com](http://www.omdbapi.com/).

## Limitações

- Depende da disponibilidade e precisão da API OMDB
- A qualidade das informações varia de acordo com a popularidade do título
- Traduções são automáticas e podem apresentar imprecisões
- Alguns títulos mais obscuros podem não ser encontrados

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*