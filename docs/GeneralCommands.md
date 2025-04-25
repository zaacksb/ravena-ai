# Comandos Gerais

O módulo `GeneralCommands.js` implementa funcionalidades básicas e essenciais do bot, incluindo comandos para verificação de status, interação com IA e configurações de apelidos.

## Comandos Disponíveis

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `!ping` | Verifica se o bot está online | `!ping` |
| `!ai` (e aliases) | Faz uma pergunta à IA | `!ai qual é a capital da França?` |
| `!apelido` | Define ou mostra seu apelido no grupo | `!apelido Mestre dos Memes` |
| `!diferenças` | Exibe as diferenças entre a ravena nova e antiga | `!diferenças` |
| `!grupao` | Adiciona o usuário ao grupo de interação principal | `!grupao` |

## Detalhes dos comandos

### !ping

Comando simples para verificar se o bot está online e respondendo aos comandos.

#### Funcionalidades:
- Verifica se o bot está funcionando corretamente
- Útil para testar a conexão com o bot

#### Formato da resposta:
- Responde com "Pong! 🏓" para indicar que está operacional

#### Reações de emoji:
- Antes de processar: ⏳
- Após processamento bem-sucedido: ✅

### !ai (e aliases: !ia, !gpt, !gemini)

Este comando permite fazer perguntas e conversar com um modelo de linguagem grande (LLM) integrado ao bot.

#### Funcionalidades:
- Envia perguntas ou prompts para um modelo de IA
- Suporta múltiplos provedores de IA configuráveis
- Processa texto da mensagem citada, quando disponível

#### Parâmetros:
- **pergunta**: A pergunta ou prompt para a IA
  - Exemplo: `!ai explique o que é inteligência artificial`
  - Exemplo: `!ai resuma o texto` (em resposta a uma mensagem com texto)

#### Configuração necessária:
- Chave da API OpenAI (`OPENAI_API_KEY`) ou
- Chave da API OpenRouter (`OPENROUTER_API_KEY`) ou
- Endpoint LLM local (`LOCAL_LLM_ENDPOINT`)

#### Formato da resposta:
A resposta inclui:
- O texto gerado pelo modelo de IA em resposta à pergunta

#### Reações de emoji:
- Gatilho: 🤖
- Antes de processar: ⏳
- Após processamento bem-sucedido: 🤖

#### Limitações:
- Sujeito a tempos limite de API
- Sujeito a limites de tokens do modelo de IA
- Cooldown de 60 segundos entre usos para evitar spam

### !apelido

Este comando permite definir ou visualizar um apelido personalizado no grupo.

#### Funcionalidades:
- Define um apelido personalizado para o usuário no grupo
- Mostra o apelido atual quando usado sem argumentos
- Os apelidos são armazenados por grupo e persistem entre sessões

#### Parâmetros:
- **apelido**: O apelido desejado (opcional)
  - Exemplo: `!apelido Rei do Grupo`
  - Use sem argumentos para ver seu apelido atual

#### Limitações:
- Apenas disponível em grupos (não em chats privados)
- Apelidos são limitados a 20 caracteres
- Requer no mínimo 2 caracteres

#### Formato da resposta:
- Se definir: "Apelido definido: [seu apelido]"
- Se consultar: "Seu apelido atual é: [seu apelido]" ou "Você não tem um apelido definido"

### !diferenças

Este comando exibe informações sobre as principais diferenças entre a versão antiga e a nova da ravena.

#### Funcionalidades:
- Explica as mudanças no sistema de comandos
- Destaca novas funcionalidades
- Fornece informações sobre mudanças técnicas

#### Formato da resposta:
A resposta inclui:
- Uma lista das principais diferenças no uso diário
- Novos comandos disponíveis
- Diferenças técnicas para desenvolvedores

### !grupao

Este comando adiciona o usuário ao grupo principal de interação da comunidade.

#### Funcionalidades:
- Adiciona o usuário ao grupo de interação principal da ravena
- Fornece link alternativo caso a adição direta falhe

#### Configuração necessária:
- Variável de ambiente `GRUPO_INTERACAO` configurada com o ID do grupo
- Variável de ambiente `LINK_GRUPO_INTERACAO` configurada com o link de convite

#### Limitações:
- Depende das permissões do bot no grupo
- Sujeito a restrições de adição de participantes do WhatsApp