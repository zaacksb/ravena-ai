const axios = require('axios');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

// Cria novo logger
const logger = new Logger('weather-commands');

// API Key do OpenWeatherMap - deve ser definida em .env
const API_KEY = process.env.OPENWEATHER_API_KEY;

// Constantes de API
const API_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const GEO_BASE_URL = 'https://api.openweathermap.org/geo/1.0/direct';

// Mapeamento de códigos de clima para emojis
const WEATHER_EMOJIS = {
  // Clima limpo
  '01d': '☀️', // céu limpo (dia)
  '01n': '🌙', // céu limpo (noite)
  
  // Nuvens
  '02d': '⛅', // poucas nuvens (dia)
  '02n': '☁️', // poucas nuvens (noite)
  '03d': '☁️', // nuvens dispersas
  '03n': '☁️',
  '04d': '☁️', // nuvens carregadas
  '04n': '☁️',
  
  // Chuva
  '09d': '🌧️', // chuva fraca
  '09n': '🌧️',
  '10d': '🌦️', // chuva (dia)
  '10n': '🌧️', // chuva (noite)
  
  // Tempestade
  '11d': '⛈️', // tempestade
  '11n': '⛈️',
  
  // Neve
  '13d': '❄️', // neve
  '13n': '❄️',
  
  // Névoa
  '50d': '🌫️', // névoa
  '50n': '🌫️'
};

// Mapeamento de direções do vento
const WIND_DIRECTIONS = [
  { name: 'N', emoji: '⬆️', min: 348.75, max: 11.25 },
  { name: 'NNE', emoji: '↗️', min: 11.25, max: 33.75 },
  { name: 'NE', emoji: '↗️', min: 33.75, max: 56.25 },
  { name: 'ENE', emoji: '↗️', min: 56.25, max: 78.75 },
  { name: 'E', emoji: '➡️', min: 78.75, max: 101.25 },
  { name: 'ESE', emoji: '↘️', min: 101.25, max: 123.75 },
  { name: 'SE', emoji: '↘️', min: 123.75, max: 146.25 },
  { name: 'SSE', emoji: '↘️', min: 146.25, max: 168.75 },
  { name: 'S', emoji: '⬇️', min: 168.75, max: 191.25 },
  { name: 'SSW', emoji: '↙️', min: 191.25, max: 213.75 },
  { name: 'SW', emoji: '↙️', min: 213.75, max: 236.25 },
  { name: 'WSW', emoji: '↙️', min: 236.25, max: 258.75 },
  { name: 'W', emoji: '⬅️', min: 258.75, max: 281.25 },
  { name: 'WNW', emoji: '↖️', min: 281.25, max: 303.75 },
  { name: 'NW', emoji: '↖️', min: 303.75, max: 326.25 },
  { name: 'NNW', emoji: '↖️', min: 326.25, max: 348.75 }
];

/**
 * Mapeia código do clima para emoji
 * @param {string} code - Código do clima (OpenWeatherMap)
 * @returns {string} - Emoji correspondente
 */
function getWeatherEmoji(code) {
  return WEATHER_EMOJIS[code] || '🌡️';
}

/**
 * Obtém direção do vento em texto e emoji
 * @param {number} degrees - Ângulo em graus
 * @returns {object} - {name, emoji} 
 */
function getWindDirection(degrees) {
  // Normaliza graus entre 0-360
  const normalizedDegrees = ((degrees % 360) + 360) % 360;
  
  // Encontra a direção correspondente
  const direction = WIND_DIRECTIONS.find(dir => 
    (normalizedDegrees >= dir.min && normalizedDegrees < dir.max) ||
    (dir.min > dir.max && (normalizedDegrees >= dir.min || normalizedDegrees < dir.max))
  ) || WIND_DIRECTIONS[0]; // Padrão para Norte se não encontrar
  
  return direction;
}

/**
 * Obtém coordenadas de uma cidade
 * @param {string} city - Nome da cidade
 * @returns {Promise<{lat: number, lon: number}>} - Coordenadas
 */
async function getCityCoordinates(city) {
  try {
    const response = await axios.get(GEO_BASE_URL, {
      params: {
        q: city,
        limit: 1,
        appid: API_KEY
      }
    });
    
    if (response.data && response.data.length > 0) {
      const { lat, lon } = response.data[0];
      return { lat, lon };
    }
    
    throw new Error(`Cidade não encontrada: ${city}`);
  } catch (error) {
    logger.error(`Erro ao obter coordenadas para "${city}":`, error);
    throw error;
  }
}

/**
 * Obtém clima atual e previsão para coordenadas
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - Dados do clima
 */
async function getWeatherData(lat, lon) {
  try {
    // Obter clima atual
    const currentResponse = await axios.get(`${API_BASE_URL}/weather`, {
      params: {
        lat,
        lon,
        appid: API_KEY,
        units: 'metric',
        lang: 'pt_br'
      }
    });
    
    // Obter previsão
    const forecastResponse = await axios.get(`${API_BASE_URL}/forecast`, {
      params: {
        lat,
        lon,
        appid: API_KEY,
        units: 'metric',
        lang: 'pt_br'
      }
    });
    
    return {
      current: currentResponse.data,
      forecast: forecastResponse.data
    };
  } catch (error) {
    logger.error(`Erro ao obter dados do clima para lat=${lat}, lon=${lon}:`, error);
    throw error;
  }
}

/**
 * Formata uma mensagem de clima com dados atuais e previsões
 * @param {Object} weatherData - Dados do clima
 * @returns {string} - Mensagem formatada
 */
function formatWeatherMessage(weatherData) {
  try {
    const { current, forecast } = weatherData;
    
    // Extrai dados atuais
    const cityName = current.name;
    const country = current.sys.country;
    const temp = Math.round(current.main.temp);
    const feelsLike = Math.round(current.main.feels_like);
    const humidity = current.main.humidity;
    const windSpeed = Math.round(current.wind.speed * 3.6); // Converte para km/h
    const windDirection = getWindDirection(current.wind.deg);
    const pressure = current.main.pressure;
    const weatherDesc = current.weather[0].description;
    const weatherIcon = current.weather[0].icon;
    const weatherEmoji = getWeatherEmoji(weatherIcon);
    
    // Constrói mensagem para clima atual
    let message = `*🌍 Clima em ${cityName}, ${country}*\n\n`;
    message += `${weatherEmoji} *Tempo Atual:* ${weatherDesc}\n`;
    message += `🌡️ *Temperatura:* ${temp}°C\n`;
    message += `🔥 *Sensação térmica:* ${feelsLike}°C\n`;
    message += `💧 *Umidade:* ${humidity}%\n`;
    message += `${windDirection.emoji} *Vento:* ${windSpeed} km/h (${windDirection.name})\n`;
    message += `📊 *Pressão:* ${pressure} hPa\n\n`;
    
    // Adiciona previsão para próximas horas
    message += `*⏱️ Próximas Horas:*\n`;
    
    // Pega próximas 6 previsões (24 horas, 3 em 3 horas)
    const hourlyForecasts = forecast.list.slice(0, 6);
    
    for (const hourForecast of hourlyForecasts) {
      const time = new Date(hourForecast.dt * 1000);
      const hourTemp = Math.round(hourForecast.main.temp);
      const hourWeatherDesc = hourForecast.weather[0].description;
      const hourWeatherIcon = hourForecast.weather[0].icon;
      const hourWeatherEmoji = getWeatherEmoji(hourWeatherIcon);
      
      const timeStr = time.toLocaleTimeString('pt-BR', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false
      });
      
      message += `${hourWeatherEmoji} *${timeStr}* - ${hourTemp}°C, ${hourWeatherDesc}\n`;
    }
    
    // Adiciona previsão para próximos dias
    message += `\n*📆 Próximos Dias:*\n`;
    
    // Agrupamos previsões por dia (pulando o dia atual)
    const dailyForecasts = [];
    const today = new Date().setHours(0, 0, 0, 0);
    let currentDay = null;
    let dailyTemps = [];
    let dailyWeather = [];
    
    // Começamos da posição 8 (aprox. 24 horas depois) para evitar o dia atual
    for (let i = 8; i < forecast.list.length; i++) {
      const forecastTime = new Date(forecast.list[i].dt * 1000);
      const forecastDay = new Date(forecastTime).setHours(0, 0, 0, 0);
      
      // Se estamos em um novo dia ou é o primeiro item
      if (forecastDay !== currentDay) {
        // Salva o dia anterior (se existir)
        if (currentDay !== null && currentDay !== today && dailyTemps.length > 0) {
          // Calcula média/moda para o dia
          const avgTemp = Math.round(dailyTemps.reduce((a, b) => a + b, 0) / dailyTemps.length);
          
          // Pega condição do tempo mais frequente
          const weatherCounts = {};
          let maxCount = 0;
          let mostFrequentWeather = null;
          
          dailyWeather.forEach(weather => {
            weatherCounts[weather.id] = (weatherCounts[weather.id] || 0) + 1;
            if (weatherCounts[weather.id] > maxCount) {
              maxCount = weatherCounts[weather.id];
              mostFrequentWeather = weather;
            }
          });
          
          dailyForecasts.push({
            date: new Date(currentDay),
            temp: avgTemp,
            weather: mostFrequentWeather
          });
        }
        
        // Inicia novo dia
        currentDay = forecastDay;
        dailyTemps = [forecast.list[i].main.temp];
        dailyWeather = [forecast.list[i].weather[0]];
      } else {
        // Adiciona dados para o dia atual
        dailyTemps.push(forecast.list[i].main.temp);
        dailyWeather.push(forecast.list[i].weather[0]);
      }
    }
    
    // Adiciona o último dia se houver dados
    if (currentDay !== null && currentDay !== today && dailyTemps.length > 0) {
      const avgTemp = Math.round(dailyTemps.reduce((a, b) => a + b, 0) / dailyTemps.length);
      
      // Pega condição do tempo mais frequente
      const weatherCounts = {};
      let maxCount = 0;
      let mostFrequentWeather = null;
      
      dailyWeather.forEach(weather => {
        weatherCounts[weather.id] = (weatherCounts[weather.id] || 0) + 1;
        if (weatherCounts[weather.id] > maxCount) {
          maxCount = weatherCounts[weather.id];
          mostFrequentWeather = weather;
        }
      });
      
      dailyForecasts.push({
        date: new Date(currentDay),
        temp: avgTemp,
        weather: mostFrequentWeather
      });
    }
    
    // Adiciona previsões diárias à mensagem (máximo 5 dias)
    const maxDays = Math.min(5, dailyForecasts.length);
    for (let i = 0; i < maxDays; i++) {
      const day = dailyForecasts[i];
      const dateStr = day.date.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' });
      const dayEmoji = getWeatherEmoji(day.weather.icon);
      
      message += `${dayEmoji} *${dateStr}* - ${day.temp}°C, ${day.weather.description}\n`;
    }
    
    return message;
  } catch (error) {
    logger.error('Erro ao formatar mensagem de clima:', error);
    return 'Não foi possível formatar os dados do clima. Tente novamente mais tarde.';
  }
}

/**
 * Implementação do comando clima
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} ReturnMessage ou array de ReturnMessages
 */
async function handleWeatherCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  try {
    let latitude, longitude, locationName;
    
    // Caso 1: Usuário menciona uma mensagem de localização
    if (args.length === 0) {
      // Verifica se é uma resposta a uma mensagem
      const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
      
      if (!quotedMsg) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça uma cidade ou responda a uma mensagem de localização. Exemplo: !clima São Paulo',
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
      
      // Verifica se a mensagem citada é uma localização
      if (quotedMsg.type === 'location') {
        latitude = quotedMsg.location.latitude;
        longitude = quotedMsg.location.longitude;
        locationName = quotedMsg.location.description || 'localização compartilhada';
      } else {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça uma cidade ou responda a uma mensagem de localização. Exemplo: !clima São Paulo',
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
    } 
    // Caso 2: Usuário fornece o nome de uma cidade
    else {
      const cityName = args.join(' ');
      
      try {
        // Obtém coordenadas da cidade
        const coordinates = await getCityCoordinates(cityName);
        latitude = coordinates.lat;
        longitude = coordinates.lon;
        locationName = cityName;
      } catch (error) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Não foi possível encontrar a cidade: ${cityName}. Verifique o nome e tente novamente.`,
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
    }
    
    // Obtém dados do clima para as coordenadas
    const weatherData = await getWeatherData(latitude, longitude);
    
    // Formata mensagem de clima
    const weatherMessage = formatWeatherMessage(weatherData);
    
    // Retorna a mensagem do clima
    returnMessages.push(
      new ReturnMessage({
        chatId: chatId,
        content: weatherMessage,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      })
    );
    
    // Se tiver mais de uma mensagem no array, retorna o array
    // Caso contrário, retorna só a mensagem do clima
    return returnMessages.length > 1 ? returnMessages : returnMessages[returnMessages.length - 1];
    
  } catch (error) {
    logger.error('Erro ao executar comando clima:', error);
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao obter informações de clima. Por favor, tente novamente mais tarde.'
    });
  }
}

const commands = [
  new Command({
    name: 'clima',
    description: 'Mostra o clima atual e previsão para uma localização',
    category: "utilidades",
    reactions: {
      before: "⏳",
      after: "☀️",
      error: "❌"
    },
    method: handleWeatherCommand
  })
];

// Registra os comandos
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands };