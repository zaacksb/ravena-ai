# Comandos de MuNews

Este módulo implementa funcionalidades para acessar e gerenciar o sistema MuNews, um serviço de notícias e informações formatadas para o WhatsApp.

## Comandos

### !news

Exibe as MuNews para uma data específica.

**Descrição:** Busca e apresenta as notícias diárias conhecidas como "MuNews", um compilado de informações do dia formatado para WhatsApp.

**Uso:** 
- `!news` - Mostra as notícias de hoje
- `!news [data]` - Mostra as notícias para a data especificada

**Exemplos:**
- `!news` - Exibe as MuNews do dia atual
- `!news ontem` - Exibe as MuNews de ontem
- `!news segunda-feira` - Exibe as MuNews da última segunda-feira
- `!news 19/04/2025` - Exibe as MuNews para a data específica

**Detalhes:**
- Suporta datas em diversos formatos (natural, DD/MM/YYYY, etc.)
- Reconhece expressões como "hoje", "ontem", "terça-feira passada"
- Formata as notícias para exibição adequada no WhatsApp
- Informa caso não haja notícias disponíveis para a data solicitada
- Reação 📰 para indicar envio bem-sucedido

## Sistema MuNews

O MuNews é um sistema de notícias diárias formatadas especificamente para WhatsApp, com as seguintes características:

- **Formato Padrão**: Texto longo com notícias organizadas por tópicos
- **Atualização**: Normalmente disponível entre 06:00 e 07:30 da manhã
- **Nomenclatura**: Anteriormente conhecido como "JrMunews", agora "ViniMunews"
- **Detecção Automática**: O sistema detecta automaticamente MuNews enviadas em grupos
- **Armazenamento**: Notícias são salvas com data para consulta posterior

## Detecção Automática

O módulo possui um sistema que detecta automaticamente mensagens do tipo MuNews em grupos:

1. Analisa mensagens longas (mais de 5000 caracteres)
2. Verifica se contém o cabeçalho característico "ViniMunews"
3. Extrai a data da mensagem
4. Armazena o conteúdo para referência futura

## Código-fonte

Este módulo está implementado no arquivo `src/functions/MuNewsCommands.js` e utiliza:
- Sistema de armazenamento baseado em arquivos JSON
- Biblioteca chrono-node para interpretação de datas em linguagem natural
- Detecção automática de conteúdo MuNews em grupos

## Observações

- A disponibilidade das notícias depende do envio diário pelo autor original
- Datas muito antigas podem não ter notícias armazenadas
- O sistema mantém as notícias mais antigas e mais recentes para referência

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*