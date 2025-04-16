# Resumos de Conversas

O módulo `SummaryCommands.js` implementa funcionalidades para resumir e interagir com conversas de grupo usando inteligência artificial, permitindo gerar resumos de discussões e mensagens interativas contextuais.

## Implementação

Este módulo utiliza o `LLMService` (serviço de modelos de linguagem) para:
1. Analisar mensagens recentes de um grupo
2. Gerar resumos concisos das discussões
3. Criar mensagens interativas baseadas no contexto da conversa

O sistema armazena as mensagens recentes de cada grupo em arquivos JSON para rastreamento e análise, mesmo quando a API do WhatsApp não permite acesso direto ao histórico completo.

## Requisitos

O módulo requer acesso a um serviço LLM, que pode ser configurado de várias maneiras:

```env
# Chaves de API
OPENAI_API_KEY=         # Chave da API OpenAI (opcional)
OPENROUTER_API_KEY=     # Chave da API OpenRouter (recomendado)
LOCAL_LLM_ENDPOINT=     # Endpoint LLM local (ex: http://localhost:1234/v1)
```

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!resumo` | Resume conversas recentes do grupo | - |
| `!interagir` | Gera uma mensagem interativa baseada na conversa | - |

## Exemplos de Uso

### Comando !resumo

**Entrada:**
```
!resumo
```

**Saída:**
```
📋 Resumo da conversa:

O grupo discutiu sobre o próximo evento de sábado, com João perguntando detalhes sobre horário e localização. Maria confirmou que será às 15h no parque central, e Carlos compartilhou um link para o mapa. Ana sugeriu que todos levassem alguma comida para compartilhar, e Pedro perguntou se poderia levar seu cachorro, ao que todos concordaram.
```

### Comando !interagir

**Entrada:**
```
!interagir
```

**Saída:**
```
Então pessoal, já decidiram o que cada um vai levar de comida para o evento? Posso ajudar organizando uma lista para não termos só bebidas ou só doces! 😄
```

Neste exemplo, o bot analisou a conversa sobre o evento e produziu uma mensagem interativa relevante ao contexto, como se fosse um participante da conversa.

## Armazenamento de Mensagens

O módulo armazena mensagens recentes de cada grupo em formato JSON:

```javascript
[
  {
    "author": "João Silva",
    "text": "Pessoal, que horas é o evento de sábado?",
    "timestamp": 1650123456789
  },
  {
    "author": "Maria Souza",
    "text": "Vai ser às 15h no parque central",
    "timestamp": 1650123489012
  },
  // mais mensagens...
]
```

Os arquivos são armazenados no diretório `data/conversations/` com nomes baseados no ID do grupo.

## Funcionamento Interno

### Armazenamento Contínuo

A função `storeMessage` é exportada e utilizada pelo `EventHandler` para armazenar continuamente mensagens à medida que são recebidas:

```javascript
// Em EventHandler.js
await SummaryCommands.storeMessage(message, group);
```

### Recuperação de Mensagens

Quando um comando é executado, o sistema tenta:
1. Obter mensagens diretamente da API do WhatsApp (`chat.fetchMessages()`)
2. Se não for possível, recorre ao histórico armazenado localmente

### Processamento com LLM

Para gerar resumos ou interações, o módulo:
1. Formata as mensagens recentes para um prompt
2. Envia o prompt para o serviço LLM configurado
3. Processa a resposta e a envia para o grupo

## Prompts utilizados

### Para resumos:
```
Abaixo está uma conversa recente de um grupo de WhatsApp. Por favor, resuma os principais pontos discutidos de forma concisa:

[mensagens formatadas]

Resumo:
```

### Para interações:
```
Abaixo está uma conversa recente de um grupo de WhatsApp. Crie uma única mensagem curta para interagir com o grupo de forma natural, como se você entendesse o assunto e quisesse participar da conversa com algo relevante. Tente usar o mesmo tom e estilo informal que as pessoas estão usando. A mensagem deve ser curta e natural:

[mensagens formatadas]

Uma mensagem curta para interagir:
```

## Limitações

- O número máximo de mensagens armazenadas por grupo é 30
- A API do WhatsApp pode limitar o acesso a mensagens antigas
- A qualidade do resumo/interação depende do modelo LLM usado
- Em grupos muito ativos, o resumo pode não capturar toda a conversa

## Notas Adicionais

- Os comandos só funcionam em grupos, não em conversas privadas
- Indicadores de digitação são enviados durante o processamento
- A análise é feita apenas no texto, não em imagens ou outros tipos de mídia
- As mensagens do sistema não são incluídas nos resumos