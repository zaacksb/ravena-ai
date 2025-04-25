# Comandos de Wikipedia

Este módulo implementa funcionalidades para buscar e apresentar informações da Wikipedia.

## Comandos

### !wiki

Busca informações na Wikipedia em português.

**Descrição:** Pesquisa e apresenta artigos da Wikipedia sobre o termo especificado, incluindo imagens quando disponíveis.

**Uso:** `!wiki [termo de busca]`

**Exemplos:**
- `!wiki Brasil`
- `!wiki Albert Einstein`
- `!wiki Sistema Solar`
- `!wiki Inteligência Artificial`

**Detalhes:**
- Busca artigos na Wikipedia em português
- Exibe título, descrição e resumo do artigo
- Quando disponível, inclui imagem do artigo
- Fornece link para o artigo completo
- Formata o conteúdo para melhor leitura no WhatsApp

## Funcionamento

O comando segue o seguinte fluxo de operação:

1. Busca o termo na API de pesquisa da Wikipedia
2. Identifica o artigo mais relevante relacionado ao termo
3. Obtém o sumário do artigo encontrado
4. Extrai título, descrição, resumo e imagem (se disponível)
5. Formata as informações para exibição no WhatsApp
6. Envia o resultado com a imagem destacada quando disponível

## Informações Apresentadas

O comando fornece:

- **Título**: Nome do artigo na Wikipedia
- **Descrição**: Breve descrição do tema (quando disponível)
- **Resumo**: Versão condensada do conteúdo do artigo
- **Link**: URL para acessar o artigo completo na Wikipedia
- **Imagem**: Fotografia, ilustração ou diagrama relacionado ao tema (quando disponível)

## Código-fonte

Este módulo está implementado no arquivo `src/functions/WikipediaCommands.js` e utiliza:
- API REST da Wikipedia para busca de artigos
- API de busca da Wikipedia para encontrar artigos relacionados
- Axios para requisições HTTP
- MessageMedia para envio de imagens junto com o texto

## Limitações

- As buscas são realizadas apenas na Wikipedia em português
- O resumo é limitado a 1000 caracteres para melhor visualização no WhatsApp
- Artigos sem informações suficientes podem retornar resultados incompletos

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*