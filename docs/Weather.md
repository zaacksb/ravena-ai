# Previsão do Tempo

O módulo `Weather.js` implementa comandos para obter informações meteorológicas atuais e previsões para qualquer localização, utilizando a API OpenWeatherMap.

## Implementação

Este módulo utiliza a API do OpenWeatherMap para obter dados meteorológicos detalhados, incluindo:
- Condições meteorológicas atuais
- Temperatura e sensação térmica
- Umidade e pressão atmosférica
- Velocidade e direção do vento
- Previsão para as próximas horas e dias

Os dados são formatados em uma mensagem bem estruturada com emojis para facilitar a compreensão.

## Requisitos Externos

Para utilizar este módulo, é necessário ter uma chave de API do OpenWeatherMap, que deve ser configurada no arquivo `.env`:

```env
OPENWEATHER_API_KEY=sua_chave_api_aqui
```

Para obter uma chave, registre-se em [OpenWeatherMap](https://openweathermap.org/api).

## Comandos Disponíveis

| Comando | Descrição | Parâmetros |
|---------|-----------|------------|
| `!clima` | Mostra o clima atual e previsão para uma localização | \<local\> ou responder a uma localização compartilhada |
| `!weather` | Versão em inglês do comando `!clima` | \<local\> ou responder a uma localização compartilhada |

## Exemplos de Uso

### Comando !clima com nome da cidade

**Entrada:**
```
!clima São Paulo
```

**Saída:**
```
🌍 Clima em São Paulo, BR

☁️ Tempo Atual: nublado
🌡️ Temperatura: 22°C
🔥 Sensação térmica: 23°C
💧 Umidade: 75%
↘️ Vento: 12 km/h (SE)
📊 Pressão: 1015 hPa

⏱️ Próximas Horas:
☁️ 16:00 - 22°C, nublado
🌧️ 19:00 - 20°C, chuva fraca
🌧️ 22:00 - 19°C, chuva fraca
🌧️ 01:00 - 18°C, chuva fraca
⛅ 04:00 - 17°C, parcialmente nublado
⛅ 07:00 - 16°C, parcialmente nublado

📆 Próximos Dias:
⛅ quinta-feira, 17 - 24°C, parcialmente nublado
☀️ sexta-feira, 18 - 27°C, céu limpo
☀️ sábado, 19 - 28°C, céu limpo
⛅ domingo, 20 - 26°C, parcialmente nublado
🌧️ segunda-feira, 21 - 23°C, chuva moderada
```

### Comando !clima respondendo a uma localização compartilhada

**Entrada:**
```
!clima
```
(respondendo a uma mensagem com localização compartilhada)

**Saída:**
Similar ao exemplo anterior, mas para a localização específica compartilhada.

## Funcionamento Interno

### Obtenção de Dados

1. **Coordenadas geográficas**: O sistema primeiro obtém as coordenadas (latitude e longitude) da localização solicitada
   - Via nome da cidade usando a API Geocoding do OpenWeatherMap
   - Ou diretamente das coordenadas de uma localização compartilhada

2. **Dados meteorológicos**: Uma vez com as coordenadas, o sistema faz duas chamadas à API:
   - API `weather` para condições atuais
   - API `forecast` para previsão futura

### Formatação de Dados

O módulo processa os dados recebidos para criar uma mensagem bem formatada:

1. **Clima atual**: Informações básicas como temperatura, umidade, vento
2. **Próximas horas**: Previsão para as próximas 18 horas (de 3 em 3 horas)
3. **Próximos dias**: Previsão para os próximos 5 dias

### Mapeamento de Condições para Emojis

O sistema usa um mapeamento de códigos de condições meteorológicas para emojis:

```javascript
const WEATHER_EMOJIS = {
  '01d': '☀️', // céu limpo (dia)
  '01n': '🌙', // céu limpo (noite)
  '02d': '⛅', // poucas nuvens (dia)
  '02n': '☁️', // poucas nuvens (noite)
  // outros códigos...
};
```

### Direção do Vento

A direção do vento é convertida de graus para uma representação textual e um emoji:

```javascript
const WIND_DIRECTIONS = [
  { name: 'N', emoji: '⬆️', min: 348.75, max: 11.25 },
  { name: 'NNE', emoji: '↗️', min: 11.25, max: 33.75 },
  // outras direções...
];
```

## Previsão para Próximos Dias

Para gerar a previsão dos próximos dias, o módulo:

1. Agrupa os dados de previsão por dia
2. Calcula a temperatura média do dia
3. Determina a condição meteorológica mais frequente
4. Formata uma descrição concisa para cada dia

## Tratamento de Erros

O módulo inclui tratamento de erros para várias situações:

- Cidade não encontrada
- Problemas de conexão com a API
- Localização não fornecida
- Resposta inválida da API

## Notas Adicionais

- Todas as temperaturas são exibidas em graus Celsius (°C)
- A velocidade do vento é convertida para km/h
- A formatação de datas e horas usa o formato local do usuário
- A previsão para as próximas horas mostra no máximo 6 períodos
- A previsão para os próximos dias mostra no máximo 5 dias
- A API tem um limite de requisições gratuitas, então o uso excessivo pode causar limitações temporárias