# Manipulação de Imagens

O módulo `ImageManipulation.js` fornece comandos para modificar, transformar e aplicar efeitos em imagens, incluindo remoção de fundo, distorção e efeitos artísticos.

## Implementação

Este módulo utiliza várias ferramentas e bibliotecas para processamento de imagem:

- **ImageMagick**: Para aplicar efeitos artísticos e transformações
- **sharp**: Para recortar e processamento básico de imagens
- **rembg**: Para remoção de fundo (requer Python)

## Requisitos Externos

Para o funcionamento completo deste módulo, é necessário instalar:

- **ImageMagick**: [Baixar ImageMagick](https://imagemagick.org/script/download.php)
  - No Windows: Adicione à variável PATH do sistema ou especifique no arquivo `.env`
  - No Linux: `sudo apt-get install imagemagick`
  - No macOS: `brew install imagemagick`

- **Python e rembg** (para remoção de fundo):
  ```bash
  pip install rembg
  ```

## Comandos Disponíveis

| Comando | Descrição | Aliases |
|---------|-----------|---------|
| `!removebg` | Remove o fundo de uma imagem | - |
| `!stickerbg` | Cria um sticker após remover o fundo | `!sbg` |
| `!distort` | Aplica efeito de distorção a uma imagem | - |
| `!sketch` | Aplica efeito de desenho a lápis | - |
| `!oil` | Aplica efeito de pintura a óleo | - |
| `!neon` | Aplica efeito de neon | - |
| `!pixelate` | Aplica efeito de pixelização | - |

## Exemplos de Uso

### Comando !removebg

Este comando deve ser usado com uma imagem (diretamente ou como resposta a uma mensagem com imagem).

**Entrada:**
```
!removebg
```

**Saída:**
A imagem original com o fundo removido, enviada como arquivo. Útil para criar fotos de perfil, figurinhas e elementos gráficos.

### Comando !stickerbg ou !sbg

**Entrada:**
```
!stickerbg Nome do Sticker
```
ou
```
!sbg Nome do Sticker
```

**Saída:**
Um sticker com fundo transparente criado a partir da imagem, com o nome especificado.

### Comando !distort

**Entrada:**
```
!distort 50
```
(O parâmetro é a intensidade da distorção, de 30 a 70)

**Saída:**
A imagem com efeito de distorção aplicado, útil para criar memes e imagens engraçadas.

### Comandos de Efeitos Artísticos

Todos estes comandos funcionam da mesma forma, aplicando diferentes efeitos artísticos:

**Entrada:**
```
!sketch
```
ou
```
!oil
```
ou
```
!neon
```
ou
```
!pixelate
```

**Saída:**
A imagem com o efeito artístico correspondente aplicado.

## Reações com Emojis

Os comandos deste módulo também podem ser acionados usando reações com emojis em mensagens com imagens:

| Emoji | Comando equivalente |
|-------|---------------------|
| 🖼 | `!sticker` |
| ✂️ | `!stickerbg` |
| 🪓 | `!removebg` |
| 🤪 | `!distort` |
| 📝 | `!sketch` |
| 🎭 | `!neon` |
| 🧩 | `!pixelate` |
| 🖌️ | `!oil` |

## Funcionamento Interno

O fluxo de processamento para a maioria dos comandos segue este padrão:

1. Obtém a mídia da mensagem (direta ou citada)
2. Salva a mídia em um arquivo temporário
3. Aplica o efeito ou transformação solicitada usando as ferramentas adequadas
4. Envia o resultado de volta para o chat
5. Limpa os arquivos temporários

### Remoção de Fundo

Para remover o fundo, o módulo usa a ferramenta `rembg`, que utiliza redes neurais para detecção e remoção inteligente de fundo. Em seguida, usa `sharp` para recortar quaisquer espaços em branco excedentes.

### Efeitos Artísticos

Os efeitos artísticos são aplicados usando o ImageMagick com configurações específicas para cada efeito:

- **sketch**: Conversão para escala de cinza e aplicação de filtro de esboço
- **oil**: Aplicação de filtro de pintura a óleo com textura
- **neon**: Processamento com detecção de bordas e efeito de brilho neon
- **pixelate**: Redução extrema de escala seguida de ampliação para criar pixelização

## Notas e Limitações

- O processamento de imagens é feito em arquivos temporários no sistema
- Os arquivos temporários são excluídos após o processamento
- A qualidade e eficácia da remoção de fundo dependem da complexidade da imagem original
- Imagens muito grandes podem ser redimensionadas automaticamente para evitar problemas de memória
- O processamento de imagens pode levar alguns segundos, especialmente para a remoção de fundo