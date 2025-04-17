# Requisições API Personalizadas

O módulo `CustomVariableProcessor.js` implementa funcionalidades para realizar requisições a APIs externas diretamente de comandos personalizados, permitindo que usuários integrem dados dinâmicos de serviços web nas respostas do bot.

## Implementação

Este recurso utiliza as seguintes tecnologias:

- **axios**: Para fazer requisições HTTP
- **processAPIRequest**: Método específico para processar variáveis de API
- **JSON path navigation**: Para extrair valores específicos de respostas JSON
- **Argumentos dinâmicos**: Sistema para substituir argumentos do comando nos parâmetros da requisição

## Formatos de Variáveis

### Formato Básico

```
{API#MÉTODO#TIPO_RESPOSTA#URL}
```

Onde:
- **MÉTODO**: GET, POST ou FORM
- **TIPO_RESPOSTA**: TEXT ou JSON
- **URL**: URL da API a ser chamada

### Respostas de Texto vs. JSON

- **#TEXT**: Retorna a resposta da API em formato texto na íntegra
- **#JSON**: Permite criar uma saída formatada com variáveis da resposta JSON dentro de [ ]

### Tipos de Requisição

- **GET**: Envia os parâmetros na URL
- **POST**: Envia dados como objeto JSON no corpo da requisição
- **FORM**: Envia dados como formulário URL-encoded

## Uso com Argumentos Dinâmicos

É possível substituir partes da URL por argumentos fornecidos no comando:

```
{API#GET#TEXT#https://exemplo.com/api?cidade=arg1&estado=arg2}
```

Quando usado com o comando:
```
!clima SãoPaulo SP
```

A requisição será feita para:
```
https://exemplo.com/api?cidade=SãoPaulo&estado=SP
```

## Exemplos de Uso

### Verificação de Clima

**Definição do Comando**:
```
!g-addCmd clima
{API#GET#JSON#https://api.weatherapi.com/v1/current.json?key=SUACHAVE&q=arg1&aqi=no
🌦️ Clima em [location.name]:
  Temperatura: [current.temp_c]°C
  Sensação: [current.feelslike_c]°C
  Condição: [current.condition.text]
  Umidade: [current.humidity]%
  Vento: [current.wind_kph] km/h
}
```

**Uso**:
```
!clima São Paulo
```

**Resposta**:
```
🌦️ Clima em São Paulo:
  Temperatura: 25.3°C
  Sensação: 27.1°C
  Condição: Parcialmente nublado
  Umidade: 65%
  Vento: 10.5 km/h
```

### Consulta de CEP

**Definição do Comando**:
```
!g-addCmd cep
{API#GET#JSON#https://viacep.com.br/ws/arg1/json/
📮 CEP: [cep]
📍 Logradouro: [logradouro]
🏙️ Bairro: [bairro]
🏙️ Cidade/UF: [localidade]/[uf]
}
```

**Uso**:
```
!cep 01001000
```

**Resposta**:
```
📮 CEP: 01001-000
📍 Logradouro: Praça da Sé
🏙️ Bairro: Sé
🏙️ Cidade/UF: São Paulo/SP
```

## Formatação de Respostas JSON

Para respostas JSON, você pode criar templates com marcadores entre colchetes:

- Suporte a navegação em objetos aninhados: `[user.address.city]`
- Múltiplos valores na mesma resposta
- Formatação personalizada para exibição

Exemplo para API que retorna:
```json
{
  "temperature": "12°C",
  "humidity": {
    "pct": "10%", 
    "absolute": "300"
  }
}
```

Template:
```
Temperatura: [temperature]
Umidade: [humidity.pct]
```

## Variáveis Personalizadas e APIs

### Exemplos Adicionais

#### Cotação de Moedas

```
!g-addCmd cotacao
{API#GET#JSON#https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,BTC-BRL
💵 Cotações atuais:
  Dólar: R$ [USDBRL.bid]
  Euro: R$ [EURBRL.bid]
  Bitcoin: R$ [BTCBRL.bid]
}
```

#### Informações de Filmes

```
!g-addCmd filme
{API#GET#JSON#https://www.omdbapi.com/?apikey=SUACHAVE&t=arg1
🎬 [Title] ([Year])
⭐ Nota: [imdbRating]/10
🎭 Diretor: [Director]
👨‍👩‍👧‍👦 Elenco: [Actors]
📝 Sinopse: [Plot]
}
```

#### Tradutor

```
!g-addCmd traduzir
{API#POST#JSON#https://libretranslate.de/translate?q=arg2&source=auto&target=arg1
Tradução: [translatedText]
}
```

#### Status de Servidor

```
!g-addCmd servidor
{API#GET#JSON#https://api.mcsrvstat.us/2/arg1
📊 Servidor: [hostname]
⚙️ Versão: [version]
👥 Jogadores: [players.online]/[players.max]
🟢 Online: [online]
}
```

## Combinação com Outras Variáveis

As variáveis de API podem ser combinadas com outras variáveis do sistema:

```
!g-addCmd previsao
{API#GET#JSON#https://api.weatherapi.com/v1/forecast.json?key=SUACHAVE&q=arg1&days=3
🌦️ Previsão para [location.name] - {date}:
  Hoje: [forecast.forecastday.0.day.condition.text], [forecast.forecastday.0.day.avgtemp_c]°C
  Amanhã: [forecast.forecastday.1.day.condition.text], [forecast.forecastday.1.day.avgtemp_c]°C
  Depois: [forecast.forecastday.2.day.condition.text], [forecast.forecastday.2.day.avgtemp_c]°C
}
```

## Tratamento de Erros

O sistema inclui tratamento para várias situações de erro:

- Falha na conexão com a API
- Resposta inválida ou mal formatada
- Erros de formato na variável de API
- Timeout na requisição

Quando ocorre um erro, a variável é substituída por uma mensagem como:
```
Erro na requisição API: Timeout of 10000ms exceeded
```

## Limitações e Boas Práticas

- **Segurança**: Evite expor chaves de API sensíveis em comandos públicos
- **Performance**: Requisições podem atrasar a resposta do bot
- **Confiabilidade**: APIs externas podem ficar indisponíveis
- **Persistência**: Os resultados não são cacheados entre chamadas
- **Tamanho**: Respostas muito grandes podem ser truncadas para compatibilidade com o WhatsApp