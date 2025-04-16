# Gerenciamento de Arquivos

O módulo `FileManager.js` implementa um sistema de armazenamento e gerenciamento de arquivos, permitindo que usuários organizem e compartilhem arquivos em pastas, com suporte para variados tipos de mídia.

## Implementação

Este módulo implementa um sistema de arquivos virtual, onde os usuários podem:
- Criar pastas
- Enviar arquivos para pastas específicas
- Listar conteúdo de pastas
- Baixar arquivos
- Excluir arquivos e pastas
- Referenciar arquivos em comandos personalizados

O sistema armazena metadados de arquivos em um banco de dados JSON e os arquivos físicos em uma estrutura de diretórios no servidor.

## Configurações e Limites

O sistema possui limites de uso para evitar abuso:

```javascript
const CONFIG = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_GROUP_STORAGE: 1 * 1024 * 1024 * 1024, // 1GB
  MAX_FILENAME_LENGTH: 10,
  MAX_FOLDER_DEPTH: 5,
  VALID_FILENAME_REGEX: /^[a-zA-Z0-9_]+$/
};
```

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!pastas` | Lista pastas e arquivos do grupo | [pasta] (opcional) |
| `!p-criar` | Cria uma nova pasta | nome_da_pasta |
| `!p-enviar` | Envia arquivo para uma pasta | [pasta/destino] (opcional) |
| `!p-excluir` | Apaga arquivo ou pasta | caminho/do/arquivo_ou_pasta |
| `!p-baixar` | Baixa arquivo ou pasta | caminho/do/arquivo_ou_pasta |

## Exemplos de Uso

### Comando !pastas

**Entrada:**
```
!pastas
```

**Saída:**
```
📂 Arquivos e Pastas
_Grupo Teste_

Arquivos na raiz:
📄 manual.pdf (2.5 MB)

Arquivos em Pastas:
📁 [videos]
  └─ aula1.mp4 (15.4 MB)
  └─ aula2.mp4 (18.7 MB)
📁 [imagens]
  └─ logo.jpg (350 KB)

Total: 4 arquivo(s), 37.0 MB

Espaço usado: 37.0 MB de 1.0 GB

💡 Use !pastas [nome_da_pasta] para ver apenas o conteúdo de uma pasta específica.
```

### Comando !p-criar

**Entrada:**
```
!p-criar documentos
```

**Saída:**
```
✅ Pasta criada com sucesso: documentos
```

### Comando !p-enviar

Este comando deve ser usado como resposta a uma mensagem com mídia.

**Entrada:**
```
!p-enviar documentos
```
(respondendo a uma mensagem com um arquivo PDF anexado)

**Saída:**
```
✅ Arquivo salvo com sucesso: documentos/relatorio.pdf (1.2 MB)

📥 Para baixar: `!p-baixar documentos/relatorio.pdf`
🔗 Para usar em comandos: `{file-documentos/relatorio.pdf}`
```

### Comando !p-excluir

**Entrada:**
```
!p-excluir documentos/relatorio.pdf
```

**Saída:**
```
✅ Arquivo excluído com sucesso: documentos/relatorio.pdf (1.2 MB)
```

### Comando !p-baixar

**Entrada:**
```
!p-baixar documentos/relatorio.pdf
```

**Saída:**
O arquivo é enviado como resposta, com uma legenda contendo o nome do arquivo e seu tamanho.

## Uso em Comandos Personalizados

Os arquivos podem ser referenciados em comandos personalizados usando a sintaxe `{file-caminho/do/arquivo}`. Por exemplo:

1. Crie um comando personalizado que usa um arquivo:
```
!g-addCmd manual
{file-documentos/manual.pdf}
```

2. Quando o comando `!manual` for executado, o bot enviará o arquivo referenciado.

Também é possível referenciar pastas inteiras com `{file-pasta}`, o que enviará todos os arquivos na pasta (até um limite de 5 arquivos).

## Organização dos Arquivos

- Cada grupo possui seu próprio espaço de armazenamento isolado
- Os metadados são armazenados em um arquivo JSON (`files-db.json`)
- Os arquivos físicos são organizados em diretórios por grupo
- Os caminhos virtuais são mapeados para caminhos físicos no sistema de arquivos

## Restrições

- Nomes de arquivo e pasta devem conter apenas letras, números e underscore
- Comprimento máximo de nome de arquivo/pasta: 10 caracteres
- Profundidade máxima de pastas: 5 níveis
- Tamanho máximo de arquivo: 100MB
- Armazenamento máximo por grupo: 1GB