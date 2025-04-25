# Comandos de Gestão de Arquivos

Este módulo implementa um sistema de armazenamento e gerenciamento de arquivos dentro do bot, permitindo que grupos armazenem, organizem e compartilhem arquivos.

## Comandos

### !pastas

Lista todos os arquivos e pastas armazenados no grupo/chat.

**Descrição:** Exibe uma lista organizada de todos os arquivos e pastas armazenados pelo bot para o grupo atual.

**Uso:** `!pastas [nome_da_pasta]`

**Exemplos:**
- `!pastas` - Lista todos os arquivos e pastas
- `!pastas documentos` - Lista apenas o conteúdo da pasta "documentos"

**Detalhes:**
- Mostra hierarquia de pastas e arquivos
- Exibe tamanho de cada arquivo e total utilizado
- Limite de armazenamento: 1GB por grupo

### !p-criar

Cria uma nova pasta no sistema de arquivos.

**Descrição:** Cria uma nova pasta para organizar arquivos.

**Uso:** `!p-criar [nome_da_pasta]`

**Exemplos:**
- `!p-criar documentos`
- `!p-criar imagens/eventos`

**Detalhes:**
- Suporta até 5 níveis de pastas aninhadas
- Nomes de pastas limitados a 10 caracteres
- Aceita apenas letras, números e underscore (_)

### !p-enviar

Envia um arquivo para uma pasta especificada.

**Descrição:** Salva um arquivo no sistema de armazenamento do bot.

**Uso:** `!p-enviar [pasta_destino]` (em resposta a uma mensagem com mídia)

**Exemplos:**
- `!p-enviar` - Salva na raiz do armazenamento
- `!p-enviar documentos` - Salva na pasta "documentos"

**Detalhes:**
- Tamanho máximo de arquivo: 100MB
- Funciona com imagens, vídeos, áudios e documentos
- Retorna um comando para baixar o arquivo posteriormente

### !p-baixar

Baixa um arquivo ou pasta do armazenamento.

**Descrição:** Recupera arquivos anteriormente salvos no sistema de armazenamento.

**Uso:** `!p-baixar [caminho_do_arquivo]`

**Exemplos:**
- `!p-baixar contrato.pdf`
- `!p-baixar documentos/regulamento.txt`
- `!p-baixar imagens` - Baixa todos os arquivos da pasta (até 5)

**Detalhes:**
- Para pastas, baixa até 5 arquivos de uma vez
- Preserva o tipo original do arquivo (imagem, vídeo, áudio, documento)

### !p-excluir

Remove um arquivo ou pasta vazia do armazenamento.

**Descrição:** Exclui arquivos ou pastas vazias do sistema de armazenamento.

**Uso:** `!p-excluir [caminho_do_arquivo_ou_pasta]`

**Exemplos:**
- `!p-excluir arquivo.jpg`
- `!p-excluir documentos/antigos`

**Detalhes:**
- Pastas só podem ser excluídas se estiverem vazias
- A ação não pode ser desfeita

## Recursos Adicionais

O sistema de arquivos também suporta:

- Uso de arquivos em comandos personalizados com a variável `{file-caminho/do/arquivo}`
- Gerenciamento de espaço automatizado
- Verificação de tipos de arquivos e segurança

## Código-fonte

Este sistema é implementado no arquivo `src/functions/FileManager.js` e utiliza as seguintes tecnologias:
- Sistema de arquivos do Node.js (fs/promises)
- Cache de metadados em banco de dados JSON
- Verificação de unicidade de arquivos

---

*Este documento faz parte da [Documentação de Comandos do RavenaBot AI](README.md#documentação-dos-comandos)*