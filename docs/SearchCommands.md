# Comandos de Busca

Este módulo implementa funcionalidades para realizar buscas na web e pesquisar imagens.

## Comandos

### !buscar

Realiza buscas gerais na web e retorna os resultados.

**Descrição:** Pesquisa conteúdo na web usando DuckDuckGo e retorna os resultados mais relevantes.

**Uso:** `!buscar [termo de busca]`

**Exemplos:**
- `!buscar como fazer bolo de chocolate`
- `!buscar notícias Brasil`
- `!buscar quem foi Santos Dumont`

**Detalhes:**
- Retorna um resumo do tópico quando disponível
- Lista os principais resultados relacionados
- Inclui links para os resultados encontrados
- Tem aliases: !google, !search

### !buscar-img

Busca e retorna imagens da web relacionadas ao termo pesquisado.

**Descrição:** Pesquisa imagens na web usando a API Unsplash e retorna as mais relevantes.

**Uso:** `!buscar-img [termo de busca]`

**Exemplos:**
- `!buscar-img montanhas`
- `!buscar-img cachorro fofo`
- `!buscar-img praia pôr do sol`

**Detalhes:**
- Retorna até 3 imagens por busca
- Inclui informações sobre a fonte das imagens
- Utiliza a API Unsplash para obter imagens de alta qualidade
- Tem aliases: !img, !imagem

## Código-fonte

Este módulo está implementado no arquivo `src/functions/SearchCommands.js` e utiliza:
- Axios para requisições HTTP
- API DuckDuckGo para buscas web
- API Unsplash para buscas de imagens

## Configuração

Para as buscas de imagens, é necessário configurar uma chave de API Unsplash no arquivo `.env`:

```
UNSPLASH_API_KEY=sua_chave_aqui
```

Se a chave não estiver configurada, o sistema usará imagens de placeholder como alternativa.

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*