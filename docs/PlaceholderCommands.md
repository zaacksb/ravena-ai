# Comandos Básicos

O módulo `PlaceholderCommands.js` implementa comandos essenciais e utilitários que servem como base para o funcionamento do bot. Apesar do nome "placeholder" (espaço reservado), estes são comandos fundamentais que estarão disponíveis mesmo se outros módulos não forem carregados.

## Implementação

Este módulo implementa comandos básicos como resposta a ping, integração com IA, repetição de texto e geração de números aleatórios. Ele utiliza o serviço LLM (Large Language Model) para fornecer respostas inteligentes a perguntas dos usuários.

## Requisitos

O comando `!ai` utiliza o serviço `LLMService` que pode ser configurado para usar diferentes provedores:
- OpenRouter
- OpenAI
- LM Studio local

As chaves de API necessárias devem ser configuradas no arquivo `.env`:

```env
# Chaves de API
OPENAI_API_KEY=         # Chave da API OpenAI (opcional)
OPENROUTER_API_KEY=     # Chave da API OpenRouter (recomendado)
LOCAL_LLM_ENDPOINT=     # Endpoint LLM local (ex: http://localhost:1234/v1)
```

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!ping` | Verifica se o bot está online | - |
| `!ai` | Pergunte algo à IA | <pergunta> |
| `!echo` | Repete o texto fornecido | <texto> |
| `!roll` | Joga um dado | [lados] (padrão: 6) |

## Exemplos de Uso

### Comando !ping

O comando mais básico para verificar se o bot está respondendo.

**Entrada:**
```
!ping
```

**Saída:**
```
Pong! 🏓
```

### Comando !ai

Este comando permite fazer perguntas ao modelo de linguagem integrado.

**Entrada:**
```
!ai Qual é a capital da França?
```

**Saída:**
```
A capital da França é Paris. É uma das cidades mais visitadas do mundo, conhecida por monumentos como a Torre Eiffel, o Arco do Triunfo e a Catedral de Notre-Dame.
```

As respostas podem variar dependendo do modelo e do provedor de IA configurado.

### Comando !echo

Simplesmente repete o texto fornecido pelo usuário.

**Entrada:**
```
!echo Olá, mundo!
```

**Saída:**
```
Olá, mundo!
```

### Comando !roll

Simula o lançamento de um dado com o número especificado de lados.

**Entrada:**
```
!roll
```

**Saída:**
```
🎲 Você tirou 4 (d6)
```

Com número personalizado de lados:

**Entrada:**
```
!roll 20
```

**Saída:**
```
🎲 Você tirou 17 (d20)
```

## Reações com Emojis

Os comandos utilizam reações com emojis para indicar diferentes estados:

| Comando | Antes | Depois |
|---------|-------|--------|
| `!ping` | ⏳ | ✅ |
| `!ai` | 🧠 | ✨ |
| `!echo` | 📝 | 🔊 |
| `!roll` | 🎲 | 🎯 |

## Funcionamento do Comando AI

O comando `!ai` funciona da seguinte forma:

1. O usuário envia uma pergunta com o comando
2. O bot envia um indicador de digitação para simular processamento
3. A pergunta é enviada ao serviço LLM configurado
4. A resposta é processada e enviada de volta ao chat

O provedor de IA é definido no código como `openrouter`, mas pode ser modificado para usar `openai` ou `local` dependendo da configuração.

## Notas Adicionais

- Estes comandos são carregados automaticamente e sempre estarão disponíveis
- O comando `!ai` pode levar alguns segundos para responder, dependendo da latência da API
- O comando `!roll` utiliza `Math.random()` para gerar números aleatórios
- Estes comandos são projetados para funcionar tanto em conversas privadas quanto em grupos