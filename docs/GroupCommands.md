# Comandos de Grupo

Este módulo implementa funcionalidades para gerenciamento e interação em grupos do WhatsApp.

## Comandos

### !atencao

Menciona todos os membros do grupo.

**Descrição:** Envia uma mensagem mencionando todos os participantes do grupo para chamar atenção.

**Uso:** 
- `!atencao`
- `!atencao [mensagem]`

**Exemplos:**
- `!atencao` - Menciona todos com mensagem padrão
- `!atencao Reunião em 5 minutos!` - Menciona todos com a mensagem personalizada

**Detalhes:**
- Menciona todos os participantes do grupo que não estão na lista de ignorados
- Permite adicionar uma mensagem personalizada
- Tem cooldown de 5 minutos para evitar spam
- Pode ser acionado pela reação 📢

### !ignorar

Alterna ser ignorado pelas menções de grupo.

**Descrição:** Permite que um usuário entre ou saia da lista de ignorados para as menções de grupo.

**Uso:** `!ignorar`

**Detalhes:**
- Alterna entre ser mencionado ou não pelo comando !atencao
- Configuração individual por usuário
- Status é salvo no banco de dados do grupo
- Não afeta outras funcionalidades do bot

### !apagar

Apaga a mensagem do bot quando usado em resposta a ela.

**Descrição:** Permite apagar mensagens enviadas pelo bot.

**Uso:** Responda a uma mensagem do bot com `!apagar`

**Detalhes:**
- Apaga a mensagem do bot à qual o comando responde
- Se o bot for administrador do grupo, pode apagar mensagens de outros usuários também (se solicitado por um administrador)
- Apenas apaga mensagens do bot por padrão
- Pode ser acionado pela reação 🗑️
- O bot tenta apagar também a mensagem do comando
- Confirmação é dada através de reação ✅

## Gerenciamento Básico de Grupos

### !apelido

Define um apelido para o usuário no grupo.

**Descrição:** Permite que um usuário defina seu próprio apelido para uso no grupo.

**Uso:** `!apelido [apelido]`

**Exemplos:**
- `!apelido Mestre do RPG`
- `!apelido Jogador #1`

**Detalhes:**
- O apelido é salvo no banco de dados do grupo
- Limite de 20 caracteres por apelido
- Os apelidos são usados em comandos de dados, rankings, etc.
- Sem argumento, mostra o apelido atual

### !faladores

Mostra o ranking de quem mais fala no grupo.

**Descrição:** Exibe estatísticas sobre os participantes mais ativos no grupo.

**Uso:** `!faladores`

**Detalhes:**
- Exibe os 10 membros que mais enviaram mensagens
- Mostra número de mensagens por participante
- Destaca os três primeiros com medalhas (🥇, 🥈, 🥉)
- Apresenta estatísticas gerais do grupo
- Atualizado automaticamente com cada mensagem

## Comandos Globais do Bot

### !grupao

Adiciona o usuário ao grupo oficial de interação da Ravena.

**Descrição:** Adiciona o usuário ao grupo principal de suporte e interação do bot.

**Uso:** `!grupao`

**Detalhes:**
- Tenta adicionar o usuário ao grupo principal configurado do bot
- Fornece link alternativo caso não consiga adicionar diretamente
- Reação 👨‍👨‍👧‍👦 para indicar adição ao grupo

### !diferenças

Exibe as diferenças para a versão anterior da Ravena.

**Descrição:** Mostra um resumo das principais mudanças em relação à versão antiga do bot.

**Uso:** `!diferenças`

**Detalhes:**
- Lista principais diferenças de comandos e funcionalidades
- Explica novos recursos disponíveis
- Orienta sobre mudanças no prefixo de comandos
- Fornece informações sobre o projeto open-source

## Código-fonte

Este módulo está implementado nos arquivos:
- `src/functions/GroupCommands.js` - Comandos de grupo
- `src/functions/GeneralCommands.js` - Comandos gerais e de bot
- `src/functions/RankingMessages.js` - Sistema de ranking de mensagens

## Limitações

- Alguns comandos requerem que o bot ou o usuário sejam administradores
- Certos recursos dependem de permissões específicas no WhatsApp
- A contagem de mensagens para o ranking é mantida apenas desde a última reinicialização do bot ou da habilitação do recurso

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*