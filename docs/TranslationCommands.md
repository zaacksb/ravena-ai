# Comandos de Tradução

Este módulo implementa funcionalidades para traduzir textos entre diferentes idiomas e processamento de reações com bandeiras para tradução rápida.

## Comandos

### !traduzir

Traduz texto para o idioma especificado.

**Descrição:** Permite traduzir mensagens ou textos para qualquer idioma suportado.

**Uso:** 
- `!traduzir [código do idioma] [texto]`
- `!traduzir [código do idioma]` (em resposta a uma mensagem)

**Exemplos:**
- `!traduzir en Olá, como vai você?` - Traduz para inglês
- `!traduzir es Buenos días` - Traduz para espanhol
- Responder uma mensagem com `!traduzir fr` - Traduz a mensagem para francês

**Detalhes:**
- Suporta todos os idiomas comuns e vários regionais
- Aceita códigos de idioma (en, es, fr) ou nomes (inglês, español, français)
- Traduz textos enviados diretamente ou mensagens citadas
- Mostra o nome do idioma de destino no resultado

## Reações com Bandeiras

Além do comando, o bot também suporta tradução através de reações com emojis de bandeiras:

**Descrição:** Reaja a uma mensagem com um emoji de bandeira para traduzir para o idioma correspondente.

**Uso:** Reaja a qualquer mensagem com um emoji de bandeira de país

**Exemplos:**
- 🇺🇸 ou 🇬🇧 - Traduz para inglês
- 🇪🇸 - Traduz para espanhol
- 🇫🇷 - Traduz para francês
- 🇧🇷 - Traduz para português

**Detalhes:**
- Suporta mais de 50 bandeiras de países
- Tradução instantânea sem necessidade de comandos
- O resultado inclui o emoji da bandeira usada

## Idiomas Suportados

O sistema suporta uma ampla gama de idiomas, incluindo mas não limitado a:

- 🇺🇸 Inglês (en)
- 🇧🇷 Português (pt)
- 🇪🇸 Espanhol (es)
- 🇫🇷 Francês (fr)
- 🇩🇪 Alemão (de)
- 🇮🇹 Italiano (it)
- 🇯🇵 Japonês (ja)
- 🇨🇳 Chinês (zh)
- 🇷🇺 Russo (ru)
- 🇰🇷 Coreano (ko)

Além de vários outros idiomas e dialetos regionais.

## Código-fonte

Este módulo está implementado no arquivo `src/functions/TranslationCommands.js` e utiliza:
- Biblioteca 'translate' para processamento de traduções
- Google Translate como mecanismo de tradução padrão
- Sistema de mapeamento de bandeiras para códigos de idioma
- Manipulação de reações para facilitar traduções rápidas

## Observações

- As traduções são processadas com limitação de taxa para evitar bloqueios da API
- O sistema implementa retry com backoff exponencial para garantir estabilidade
- A detecção de idiomas é feita automaticamente para o texto de origem

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*