# Comandos de Anime

Este módulo fornece funcionalidades para buscar informações sobre animes utilizando a API MyAnimeList via mal-scraper.

## Comandos

### !anime

Busca informações detalhadas sobre um anime no MyAnimeList.

**Descrição:** Busca e apresenta informações completas sobre animes, incluindo sinopse, informações de lançamento, classificação, episódios e mais.

**Uso:** `!anime [nome do anime]`

**Exemplos:**
- `!anime Naruto`
- `!anime One Piece`
- `!anime Attack on Titan`

**Detalhes:**
- O comando apresenta informações como título (em português e japonês), data de lançamento, estúdio, gêneros, número de episódios, duração, classificações e sinopse.
- A sinopse é automaticamente traduzida para português.
- Quando disponível, inclui imagens do anime.

**Funcionamento interno:**
1. O bot busca o anime no MyAnimeList usando o mal-scraper
2. Processa e traduz as informações obtidas
3. Formata os dados em uma mensagem estruturada
4. Quando disponível, baixa a imagem do anime para envio junto com as informações

## Código-fonte

Este comando é implementado no arquivo `src/functions/AnimeCommands.js` e utiliza as bibliotecas:
- mal-scraper: para buscar informações no MyAnimeList
- axios: para baixar imagens
- MessageMedia: para enviar imagens junto com as informações

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*