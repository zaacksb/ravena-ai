# Comandos Stable Diffusion

O módulo `StableDiffusionCommands.js` permite integrar a capacidade de geração de imagens com Stable Diffusion ao RavenaBot. Este módulo se conecta a uma API do Stable Diffusion Web UI para gerar imagens a partir de prompts fornecidos pelos usuários.

## Implementação

Este módulo implementa um comando que envia solicitações para uma instância do Stable Diffusion Web UI. A API padrão do AUTOMATIC1111 Stable Diffusion Web UI é utilizada para estas solicitações. Antes de compartilhar as imagens geradas, o bot verifica se elas contêm conteúdo NSFW usando o módulo NSFWPredict do projeto.

## Requisitos

Para utilizar este módulo, você precisa:

1. Uma instância do Stable Diffusion Web UI em execução (como o AUTOMATIC1111)
2. A API do Stable Diffusion Web UI habilitada
3. A URL da API configurada no arquivo `.env`:

```env
# Configuração Stable Diffusion
SDWEBUI_URL=http://localhost:7860  # URL da API do Stable Diffusion Web UI
```

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!imagine` | Gera uma imagem usando Stable Diffusion | <prompt> |

## Parâmetros de Geração de Imagem

O módulo utiliza as seguintes configurações padrão para geração de imagens:

- **Dimensões**: 512x768
- **Passos de geração**: 30
- **CFG Scale**: 7
- **Sampler**: DPM++ 2M Karras

Estas configurações podem ser ajustadas diretamente no código caso necessário.

## Exemplos de Uso

### Comando !imagine

Gera uma imagem baseada no prompt fornecido.

**Entrada:**
```
!imagine um gato usando chapéu de cowboy
```

**Processo:**
1. O bot enviará uma mensagem indicando que está gerando a imagem
2. O prompt é enviado para a API do Stable Diffusion
3. A imagem gerada é analisada pelo detector NSFW
4. O bot envia a imagem resultante com informações como prompt utilizado, modelo e tempo de geração

**Saída:**
A imagem gerada acompanhada de uma legenda como:
```
🎨 Prompt: um gato usando chapéu de cowboy
📊 Modelo: v1-5-pruned
⏱️ Tempo: 5.3s
```

### Tratamento de Conteúdo NSFW

Se a verificação NSFW detectar que a imagem gerada pode conter conteúdo inapropriado:

1. O bot enviará uma mensagem de aviso: 
   `🔞 A imagem gerada pode conter conteúdo potencialmente inadequado, abra com cautela.`
2. A imagem será enviada com a opção `viewOnce: true`, o que significa que só poderá ser visualizada uma vez e não pode ser encaminhada

## Reações com Emojis

O comando utiliza reações com emojis para indicar diferentes estados:

| Comando | Antes | Depois |
|---------|-------|--------|
| `!imagine` | 🎨 | ✨ |

## Notas Adicionais

- Por padrão, o módulo adiciona prompts negativos para evitar conteúdo NSFW e imagens de baixa qualidade.
- O tempo limite para geração de imagens é de 2 minutos.
- Arquivos temporários são criados durante o processo de verificação NSFW e são excluídos após a análise.
- O módulo depende do `axios` para fazer requisições HTTP para a API.
- Em caso de falha na API, o bot enviará mensagens de erro informativas.

## Tratamento de Erros

O módulo fornece mensagens específicas para diferentes tipos de erro:

- Erro de conexão: "Não foi possível conectar ao servidor Stable Diffusion. Verifique se ele está rodando e acessível."
- Erro da API: "Erro da API Stable Diffusion: [status] - [mensagem]"
- Erro genérico: "Erro ao gerar imagem."