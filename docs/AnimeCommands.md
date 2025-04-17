# Comandos de Anime

O módulo `AnimeCommands.js` implementa funcionalidades para buscar e exibir informações detalhadas sobre animes usando o MyAnimeList como fonte de dados. O comando permite que os usuários obtenham informações como sinopse, gêneros, estúdios, notas e muito mais.

## Implementação

Este módulo utiliza a biblioteca `mal-scraper` para buscar informações da popular base de dados MyAnimeList. Quando disponível, a imagem de capa do anime também é baixada e enviada junto com as informações, proporcionando uma experiência visual completa.

## Requisitos

Para utilizar este módulo, você precisa:

1. Instalar a biblioteca mal-scraper:
   ```
   npm install mal-scraper
   ```

2. Ter acesso à internet para realizar as consultas na API do MyAnimeList.

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!anime` | Busca informações sobre um anime | <nome do anime> |

## Exemplos de Uso

### Comando !anime

**Entrada:**
```
!anime Naruto
```

**Processo:**
1. O bot enviará uma mensagem indicando que está buscando as informações
2. O nome "Naruto" é enviado para a API do MyAnimeList
3. As informações são formatadas em uma mensagem legível
4. A imagem de capa do anime é baixada (se disponível)
5. O bot envia a imagem com as informações como legenda

**Saída:**
```
🗾 Naruto (ナルト)

📅 Lançamento: Oct 3, 2002 (Finished Airing @ TV)
🏢 Estúdio: Pierrot
📖 Fonte: Manga
🍿 Gênero: Action, Adventure, Comedy, Super Power, Martial Arts, Shounen
🔢 Episódios: 220 (23 min. per ep.)
🏆 Nota: 7.97, #586 no ranking, #21 em popularidade

💬 Sinopse: Momentos antes do nascimento de Naruto Uzumaki, um enorme demônio conhecido como Kyuubi, a Raposa de Nove Caudas, atacou Konohagakure, a Vila Oculta da Folha, e causou estragos. Para pôr fim ao caos de Kyuubi, o líder da aldeia, o Quarto Hokage, sacrificou sua vida e selou a fera monstruosa dentro do recém-nascido Naruto. Agora, Naruto é um ninja hiperativo e cabeça-dura que ainda vive em Konohagakure...
```

## Informações Exibidas

O comando `!anime` exibe os seguintes dados (quando disponíveis):

- **Título:** Nome do anime em inglês/romanizado
- **Título Japonês:** Nome original em japonês
- **Lançamento:** Data de início da exibição
- **Status:** Estado atual (em exibição, finalizado, etc.)
- **Tipo:** Formato do anime (TV, OVA, Filme, etc.)
- **Estúdio:** Estúdio de animação responsável
- **Fonte:** Material de origem (Manga, Light Novel, Original, etc.)
- **Gênero:** Categorias do anime
- **Episódios:** Número total de episódios
- **Duração:** Tempo médio por episódio
- **Nota:** Avaliação média no MyAnimeList
- **Ranking:** Posição no ranking geral do MyAnimeList
- **Popularidade:** Posição no ranking de popularidade
- **Sinopse:** Descrição da história do anime

## Reações com Emojis

| Comando | Antes | Depois |
|---------|-------|--------|
| `!anime` | 🔍 | 🗾 |

## Tratamento de Erros

O módulo fornece mensagens de erro específicas para diferentes problemas:

- Nenhum nome fornecido: "Por favor, forneça o nome de um anime para buscar. Exemplo: !anime Naruto"
- Anime não encontrado: "Não foi possível encontrar esse anime. Verifique se o nome está correto."
- Timeout da API: "Tempo esgotado ao buscar informações. A API pode estar indisponível."
- Erro geral: "Erro ao buscar informações do anime. Por favor, tente novamente."

## Notas Adicionais

- O módulo depende do acesso à internet e à API do MyAnimeList.
- Se a imagem de capa não puder ser baixada, apenas as informações textuais serão enviadas.
- A busca usa o nome mais próximo encontrado, então resultados parciais são possíveis.
- Devido a limitações da API, alguns animes muito novos ou obscuros podem não ser encontrados.