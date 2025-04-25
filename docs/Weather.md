# Comandos de Clima

O módulo `Weather.js` implementa funcionalidades para obter informações meteorológicas atuais e previsões para qualquer localização.

## Comandos Disponíveis

| Comando | Descrição | Uso |
|---------|-----------|-----|
| `!clima` | Mostra o clima atual e previsão para uma localização | `!clima São Paulo` ou em resposta a uma localização compartilhada |

## Detalhes do comando

### !clima

Este comando utiliza a API OpenWeatherMap para fornecer informações detalhadas sobre o clima atual e previsão para os próximos dias de uma localização específica.

#### Funcionalidades:
- Obtém dados meteorológicos atuais (temperatura, sensação térmica, umidade, etc.)
- Mostra previsão para as próximas horas
- Mostra previsão para os próximos dias
- Suporta busca por nome de cidade
- Suporta obtenção de clima a partir de localização compartilhada

#### Parâmetros:
- **Cidade**: Nome da cidade para a qual deseja obter o clima
  - Exemplo: `!clima Rio de Janeiro`
- **Localização**: Pode ser usado em resposta a uma mensagem de localização
  - Exemplo: `!clima` (em resposta a uma localização compartilhada)

#### Configuração necessária:
- Uma chave de API do OpenWeatherMap deve ser configurada no arquivo `.env` como `OPENWEATHER_API_KEY`

#### Formato da resposta:
A resposta inclui:
- Condições meteorológicas atuais (temperatura, sensação térmica, umidade, vento, pressão)
- Previsão para as próximas horas
- Previsão para os próximos dias
- Emojis para representar visualmente as condições do tempo

#### Exemplo de uso:
```
!clima Paris
```

Isso retornará informações detalhadas sobre o clima atual em Paris, incluindo previsão.

#### Reações de emoji:
- Antes de processar: ⏳
- Após processamento bem-sucedido: ☀️
- Em caso de erro: ❌

#### Limitações:
- Depende da disponibilidade e precisão da API OpenWeatherMap
- Algumas localidades remotas podem não ser encontradas
- A precisão da previsão diminui para datas mais distantes

#### Dicas:
- Para localidades com nomes comuns, pode ser útil especificar o país
  - Exemplo: `!clima Springfield, EUA`
- Funciona melhor com nomes de cidades em sua forma nativa ou em inglês