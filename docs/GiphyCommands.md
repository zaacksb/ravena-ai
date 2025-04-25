# Comandos Giphy

O módulo `GiphyCommands.js` implementa funcionalidades para buscar e enviar GIFs animados do serviço Giphy.

## Comandos Disponíveis

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `!gif` | Busca e envia um GIF do Giphy | `!gif gato dançando` |

## Detalhes do comando

### !gif

Este comando utiliza a API do Giphy para buscar e enviar GIFs animados com base em termos de pesquisa fornecidos pelo usuário.

#### Funcionalidades:
- Busca GIFs com base em termos de pesquisa
- Envia GIFs como vídeos MP4 para melhor compatibilidade com WhatsApp
- Converte GIFs para MP4 quando necessário
- Busca GIFs populares/trending quando nenhum termo é fornecido
- Inclui informações sobre o GIF como legenda

#### Parâmetros:
- **termo de busca**: Termo para buscar GIFs (opcional)
  - Exemplo: `!gif cachorro fofo`
  - Se não for fornecido, o comando busca GIFs populares/trending

#### Configuração necessária:
- Uma chave de API do Giphy deve estar configurada no arquivo `.env` como `GIPHY_API_KEY`

#### Formato da resposta:
A resposta inclui:
- O GIF em formato de vídeo MP4 (para melhor compatibilidade)
- Uma legenda com informações sobre o GIF, incluindo:
  - Título do GIF
  - Data de publicação (se disponível)
  - Número aproximado de visualizações
  - Classificação do conteúdo
  - Fonte original

#### Exemplo de uso:
```
!gif gato assustado
```

Isso retornará um GIF relacionado a "gato assustado" do serviço Giphy.

#### Reações de emoji:
- Antes de processar: ⏳
- Após processamento bem-sucedido: 📱

#### Limitações:
- Sujeito a limites de taxa da API do Giphy
- O tamanho dos GIFs pode ser limitado para compatibilidade com WhatsApp
- Alguns conteúdos podem não estar disponíveis devido a restrições de conteúdo

#### Comportamento especial:
- Quando nenhum termo de busca é fornecido, o comando busca GIFs populares do momento
- Os GIFs são convertidos para formato MP4 para garantir compatibilidade com WhatsApp
- O comando utiliza a biblioteca ffmpeg para processamento de vídeo

#### Dicas:
- Seja específico nos termos de busca para melhores resultados
- Use termos em inglês para acesso a uma biblioteca maior de GIFs
- Para GIFs aleatórios populares, use apenas `!gif` sem parâmetros