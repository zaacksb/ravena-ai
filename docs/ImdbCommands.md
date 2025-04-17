# Comandos IMDB

O módulo `ImdbCommands.js` implementa funcionalidades para buscar e exibir informações detalhadas sobre filmes, séries e programas de TV utilizando a API do OMDB (Open Movie Database), que é baseada nos dados do IMDB (Internet Movie Database).

## Implementação

Este módulo utiliza a API pública do OMDB para buscar informações completas sobre produções audiovisuais. Quando disponível, o pôster do filme ou série também é baixado e enviado junto com as informações, proporcionando uma experiência visual completa.

## Requisitos

Para utilizar este módulo, você precisa:

1. Uma chave de API do OMDB (gratuita ou paga)
2. Configurar a chave de API no arquivo `.env`:

```env
# Chave de API do OMDB
OMDB_API_KEY=sua_chave_api_aqui
```

Você pode obter uma chave de API gratuita em: [http://www.omdbapi.com/apikey.aspx](http://www.omdbapi.com/apikey.aspx)

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!imdb` | Busca informações sobre filmes ou séries | <nome do filme/série> |

## Exemplos de Uso

### Comando !imdb

**Entrada:**
```
!imdb Inception
```

**Processo:**
1. O bot enviará uma mensagem indicando que está buscando as informações
2. O nome "Inception" é enviado para a API do OMDB
3. O sistema primeiro encontra o ID IMDB correto e depois busca os detalhes completos
4. As informações são formatadas em uma mensagem legível
5. O pôster do filme é baixado (se disponível)
6. O bot envia o pôster com as informações como legenda

**Saída:**
```
🎬 Inception (2010)

📋 Tipo: Movie | Classificação: PG-13
⏱️ Duração: 2h 28min
🎭 Gênero: Action, Adventure, Sci-Fi
🎬 Direção: Christopher Nolan
✍️ Roteiro: Christopher Nolan
🎭 Elenco: Leonardo DiCaprio, Joseph Gordon-Levitt, Elliot Page

📊 Avaliações:
  • IMDB: 8.8/10 (2,279,150 votos)
  • Rotten Tomatoes: 87%
  • Metacritic: 74/100

📝 Sinopse: Um ladrão que rouba segredos corporativos através do uso da tecnologia de compartilhamento de sonhos, recebe a tarefa inversa de plantar uma ideia na mente de um CEO, mas seu passado trágico pode condenar o projeto e sua equipe ao desastre.

🔗 IMDB: https://www.imdb.com/title/tt1375666/
```

## Informações Exibidas

O comando `!imdb` exibe os seguintes dados (quando disponíveis):

- **Título e Ano:** Nome do filme/série e seu ano de lançamento
- **Tipo:** Categoria da produção (Filme, Série, Episódio)
- **Classificação:** Classificação indicativa (PG-13, R, etc.)
- **Duração:** Tempo de exibição (formatado para horas e minutos quando aplicável)
- **Gênero:** Categorias do filme/série
- **Direção:** Diretor(es) da produção
- **Roteiro:** Roteirista(s) da produção
- **Elenco:** Atores principais
- **Avaliações:** Notas do IMDB, Rotten Tomatoes, Metacritic, etc.
- **Sinopse:** Descrição da história
- **Link IMDB:** URL direta para a página no IMDB

## Reações com Emojis

| Comando | Antes | Depois |
|---------|-------|--------|
| `!imdb` | 🎬 | 🍿 |

## Tratamento de Erros

O módulo fornece mensagens de erro específicas para diferentes problemas:

- API não configurada: "⚠️ API do OMDB não configurada. Defina OMDB_API_KEY no arquivo .env"
- Nenhum termo fornecido: "Por favor, forneça o nome de um filme ou série para buscar."
- Filme não encontrado: "Não foi possível encontrar [nome]. Verifique se o nome está correto."
- API inválida: "Chave de API do OMDB inválida. Verifique a configuração."
- Limite excedido: "Limite de requisições excedido. Tente novamente mais tarde."

## Notas Adicionais

- O módulo utiliza um processo de busca em duas etapas: primeiro localiza o ID IMDB correto e depois busca informações detalhadas com este ID
- Para sinopses muito longas, o texto é truncado para manter a legibilidade da mensagem
- As avaliações são exibidas em formato de lista com a fonte e a pontuação para cada uma
- A duração é formatada para um formato mais legível (por exemplo, "148 min" se torna "2h 28min")
- Algumas plataformas de streaming podem ser listadas quando disponíveis na API
- O módulo depende do acesso à internet e à API do OMDB