# Comandos de Inteligência Artificial

Este módulo implementa funcionalidades que utilizam modelos de linguagem (LLM) para geração de texto, resumo, interação conversacional e geração de imagens.

## Comandos

### !ai / !ia / !gpt / !gemini

Permite fazer perguntas para a inteligência artificial.

**Descrição:** Envia perguntas, conversas ou solicitações para um modelo de linguagem avançado.

**Uso:** 
- `!ai [pergunta ou instrução]`
- `!ai` (em resposta a uma mensagem para contexto adicional)

**Exemplos:**
- `!ai Explique como funciona a fotossíntese`
- `!ai Escreva uma pequena história sobre um robô e seu gato`
- `!ai Sugira 5 nomes para um personagem de fantasia`
- Responder a um texto com `!ai Resuma este texto`

**Detalhes:**
- Processa perguntas ou solicitações usando LLM
- Consegue manter contexto quando usado em resposta a uma mensagem
- Suporta diversas tarefas: respostas, criação de conteúdo, explicações, resumos, etc.
- Possui vários aliases para facilitar o uso (!ia, !gpt, !gemini)
- Usa o modelo de IA definido na configuração do bot (padrão: OpenRouter)

### !resumo

Resume conversas recentes do grupo.

**Descrição:** Analisa as mensagens recentes do grupo e cria um resumo conciso dos principais tópicos.

**Uso:** `!resumo`

**Detalhes:**
- Analisa até 30 mensagens recentes do grupo
- Identifica os tópicos principais da conversa
- Cria um resumo estruturado dos pontos discutidos
- Útil para acompanhar discussões extensas
- Funciona apenas em grupos

### !interagir

Gera uma mensagem interativa baseada na conversa do grupo.

**Descrição:** Analisa o contexto da conversa atual e gera uma mensagem natural para participar da discussão.

**Uso:** `!interagir`

**Detalhes:**
- Analisa o contexto das mensagens recentes
- Gera uma mensagem que se encaixa naturalmente na conversa
- Adapta o tom e estilo ao utilizado no grupo
- Cria mensagens curtas e relevantes
- Funciona apenas em grupos

### !imagine

Gera uma imagem usando Stable Diffusion.

**Descrição:** Cria imagens baseadas em descrições textuais (prompts) usando modelos de difusão.

**Uso:** 
- `!imagine [descrição detalhada]`
- `!imagine` (em resposta a uma mensagem para usar seu conteúdo como prompt)

**Exemplos:**
- `!imagine um gato usando chapéu de cowboy em um deserto ao pôr do sol`
- `!imagine retrato de uma mulher japonesa em estilo cyberpunk neon`
- `!imagine paisagem montanhosa ao amanhecer, estilo pintura a óleo`

**Detalhes:**
- Utiliza Stable Diffusion Web UI para geração de imagens
- Suporta descrições detalhadas para melhores resultados
- Retorna a imagem junto com o prompt utilizado
- Inclui filtro de NSFW para evitar conteúdo inadequado
- Requer configuração do Stable Diffusion no arquivo .env

## Código-fonte

Este módulo combina funcionalidades implementadas em vários arquivos:
- `src/functions/GeneralCommands.js` - Comandos !ai/!ia
- `src/functions/SummaryCommands.js` - Comandos !resumo e !interagir
- `src/functions/StableDiffusionCommands.js` - Comando !imagine

Os comandos utilizam:
- LLMService para integração com modelos de linguagem
- APIs do OpenRouter ou modelos locais para geração de texto
- API do Stable Diffusion Web UI para geração de imagens
- NSFWPredict para detecção de conteúdo inadequado

## Configuração

O módulo requer as seguintes configurações no arquivo `.env`:

```
# Para comandos de IA/texto
OPENROUTER_API_KEY=sua_chave_aqui   # Recomendado
# ou
OPENAI_API_KEY=sua_chave_aqui       # Alternativo
# ou
LOCAL_LLM_ENDPOINT=http://localhost:1234/v1  # Para modelo local

# Para geração de imagens
SDWEBUI_URL=http://localhost:7860    # URL da API Stable Diffusion
```

## Limitações

- A qualidade das respostas e imagens depende dos modelos configurados
- Geração de imagens pode levar alguns segundos
- Limitação de 500 tokens para respostas do modelo de linguagem
- Respostas e imagens podem variar dependendo do modelo e da configuração

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*