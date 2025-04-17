# Comandos Wikipedia

O módulo `WikipediaCommands.js` implementa funcionalidades para buscar e exibir informações da Wikipédia em português (pt-br). Este módulo permite que os usuários obtenham resumos de artigos, incluindo imagens quando disponíveis, diretamente no WhatsApp.

## Implementação

Este módulo utiliza a API REST da Wikipédia para buscar informações sobre um determinado tópico. O processo é realizado em duas etapas: primeiro é feita uma busca para encontrar o artigo mais relevante, e depois o sumário desse artigo é obtido junto com informações adicionais como imagens e descrições.

## Requisitos

Este módulo não necessita de chaves de API ou configurações adicionais, pois a API da Wikipédia é de acesso público.

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!wiki` | Busca e exibe informações da Wikipédia | <termo de busca> |

## Exemplos de Uso

### Comando !wiki

**Entrada:**
```
!wiki Brasil
```

**Processo:**
1. O bot enviará uma mensagem indicando que está buscando as informações
2. O termo "Brasil" é usado para buscar artigos relevantes na Wikipédia
3. O artigo mais relevante é selecionado
4. O resumo e outras informações são obtidos
5. Se disponível, a imagem principal do artigo é baixada
6. O bot envia a imagem com o resumo como legenda, ou apenas o texto se não houver imagem

**Saída:**
```
📚 *Brasil*

*República Federativa do Brasil*

O Brasil, oficialmente República Federativa do Brasil, é o maior país da América do Sul e da América Latina, sendo o quinto maior do mundo em área territorial e o sexto em população. É o único país na América onde se fala majoritariamente a língua portuguesa e o maior país lusófono do planeta, além de ser uma das nações mais multiculturais e etnicamente diversas, em decorrência da forte imigração oriunda de variados cantos do mundo.

🔗 *Leia mais:* https://pt.wikipedia.org/wiki/Brasil
```

## Formato das Informações

O comando `!wiki` exibe os seguintes dados (quando disponíveis):

- **Título:** Nome do artigo na Wikipédia
- **Descrição curta:** Uma breve descrição do tópico (quando disponível)
- **Resumo:** Um extrato do conteúdo do artigo, limitado a 1000 caracteres para manter a legibilidade
- **Link:** URL direta para o artigo completo na Wikipédia
- **Imagem:** A imagem principal do artigo (quando disponível)

Quando o resumo é muito longo, ele é truncado e são adicionadas reticências (...) ao final para indicar que há mais conteúdo disponível no link fornecido.

## Reações com Emojis

| Comando | Antes | Depois |
|---------|-------|--------|
| `!wiki` | 📚 | 🔍 |

## Tratamento de Erros

O módulo fornece mensagens de erro específicas para diferentes problemas:

- Nenhum termo fornecido: "Por favor, forneça um termo para buscar na Wikipedia."
- Termo não encontrado: "Não foi possível encontrar informações sobre [termo] na Wikipedia."
- Artigo sem sumário: "Não foi possível encontrar uma página completa sobre [termo] na Wikipedia."
- Excesso de requisições: "Muitas solicitações à Wikipedia. Por favor, tente novamente mais tarde."
- Erro geral: "Erro ao buscar informações da Wikipedia. Por favor, tente novamente."

## Notas Adicionais

- Este módulo utiliza a Wikipédia em português (pt.wikipedia.org) como fonte de informação.
- O sistema tenta obter imagens em alta resolução quando disponíveis.
- Devido a limitações do WhatsApp, apenas uma imagem pode ser enviada por vez (a principal do artigo).
- O resumo é limitado a 1000 caracteres para manter a legibilidade nas mensagens do WhatsApp.
- O comando inclui um link direto para o artigo completo, permitindo que os usuários acessem informações adicionais.