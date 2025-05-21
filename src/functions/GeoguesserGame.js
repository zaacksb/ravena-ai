// src/functions/GeoguesserGame.js
const path = require('path');
const fs = require('fs').promises;
const axios = require('axios');
const crypto = require('crypto');
const { Location } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');
const sharp = require('sharp');

const logger = new Logger('geoguesser-game');
const database = Database.getInstance();

// Configurações do jogo
const GAME_DURATION = 5 * 60 * 1000; // 5 minutos em milissegundos
const IMAGE_ANGLES = [0, 90, 180, 270]; // Ângulos para StreetView
const MIN_DISTANCE_PERFECT = 10000; // Em metros
const MAX_DISTANCE_POINTS = 10000000; // Em metros
const BRAZIL_BOUNDS = {
  minLat: -34.513624230082094,
  maxLat: -0.3381745506226877,
  minLng: -65.85206416262956,
  maxLng: -36.057150968621926,
};

const PLACE_TYPES = [
  'tourist_attraction',
  'gas_station',
  'restaurant',
  'school',
  'park',
  'cafe',
  'shopping_mall',
  'museum',
  'church',
];

const EMOJIS_LOCAL = {
  school: "🏫",
  restaurant: "🍽️",
  cafe: "☕",
  gas_station: "⛽",
  park: "🏞️",
  museum: "🏛️",
  church: "⛪",
  shopping_mall: "🛍️",
  tourist_attraction: "📸"
};

// Emojis para ranking
const EMOJIS_RANKING = ["","🥇","🥈","🥉","🐅","🐆","🦌","🐐","🐏","🐓","🐇"];

// API Key - Deve ser configurada no .env como GOOGLE_MAPS_API_KEY
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;

// Armazena os jogos ativos
const activeGames = {};

// Variáveis para gerenciamento de cache e salvamento
let dadosCache = null;  
let ultimoSalvamento = 0;  
const INTERVALO_SALVAMENTO = 5 * 60 * 1000; // 5 minutes in milliseconds  
let modificacoesNaoSalvas = false;

/**
 * Caminho para o arquivo JSON de dados do Geoguesser
 */
const GEOGUESSER_FILE = path.join(database.databasePath, 'geoguesser.json');

/**  
 * Carrega os dados do Geoguesser
 * @returns {Promise<Object>} Dados do Geoguesser
 */  
async function carregarDadosGeoguesser() {  
  try {  
    // Return cached data if available  
    if (dadosCache !== null) {  
      return dadosCache;  
    }  
    
    let dados;  
    
    try {  
      // Tenta ler o arquivo existente  
      const fileContent = await fs.readFile(GEOGUESSER_FILE, 'utf8');  
      dados = JSON.parse(fileContent);  
    } catch (error) {  
      logger.info('Arquivo de dados do Geoguesser não encontrado ou inválido, criando novo');  
      
      // Cria estrutura de dados inicial  
      dados = {  
        global: {},
        grupos: {}
      };  
      
      // Garante que o diretório exista  
      const dir = path.dirname(GEOGUESSER_FILE);  
      await fs.mkdir(dir, { recursive: true });  
      
      // Salva o arquivo  
      await fs.writeFile(GEOGUESSER_FILE, JSON.stringify(dados, null, 2), 'utf8');  
    }  
    
    // Update cache and last save time  
    dadosCache = dados;  
    ultimoSalvamento = Date.now();  
    
    return dados;  
  } catch (error) {  
    logger.error('Erro ao carregar dados do Geoguesser:', error);  
    // Retorna estrutura vazia em caso de erro  
    return {  
      global: {},
      grupos: {}
    };  
  }  
}  
  

/**  
 * Salva os dados do Geoguesser
 * @param {Object} dados Dados a serem salvos  
 * @param {boolean} forceSave Força o salvamento mesmo que não tenha passado o intervalo  
 * @returns {Promise<boolean>} Sucesso ou falha  
 */  
async function salvarDadosGeoguesser(dados, forceSave = false) {  
  try {  
    // Update cache  
    dadosCache = dados;  
    modificacoesNaoSalvas = true;  
    
    // Only save to disk if forced or if enough time has passed since last save  
    const agora = Date.now();  
    if (forceSave || (agora - ultimoSalvamento) > INTERVALO_SALVAMENTO) {  
      await fs.writeFile(GEOGUESSER_FILE, JSON.stringify(dados, null, 2), 'utf8');  
      ultimoSalvamento = agora;  
      modificacoesNaoSalvas = false;  
      logger.info('Dados do Geoguesser salvos em disco');  
    }  
    
    return true;  
  } catch (error) {  
    logger.error('Erro ao salvar dados do Geoguesser:', error);  
    return false;  
  }  
}

/**
 * Inicializa dados de um grupo se não existirem
 * @param {Object} dados Dados do Geoguesser
 * @param {string} groupId ID do grupo
 * @returns {Object} Dados atualizados
 */
function inicializarGrupo(dados, groupId) {
  if (!dados.grupos[groupId]) {
    dados.grupos[groupId] = {};
  }
  return dados;
}

function getRandomCoordinate(bounds) {
  const lat = Math.random() * (bounds.maxLat - bounds.minLat) + bounds.minLat;
  const lng = Math.random() * (bounds.maxLng - bounds.minLng) + bounds.minLng;
  return { lat, lng };
}

function getRandomPlaceType() {
  const index = Math.floor(Math.random() * PLACE_TYPES.length);
  return PLACE_TYPES[index];
}

async function getRandomPlaceInBrazil() {
  const location = getRandomCoordinate(BRAZIL_BOUNDS);
  const type = getRandomPlaceType();
  const radius = 50000; // meters

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location.lat},${location.lng}&radius=${radius}&type=${type}&key=${API_KEY}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.status === 'OK' && data.results.length > 0) {
    const randomResult = data.results[Math.floor(Math.random() * data.results.length)];

      // Info endereço
    const responseDetails = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${randomResult.place_id}&key=${API_KEY}&`);
    const dataDetails = await responseDetails.json();

    let addr = "-";
    if (dataDetails.status === 'OK' && dataDetails.result) {
      addr = dataDetails.result.formatted_address;
    }

    if((addr.includes("Brazil") || addr.includes("Brasil"))){
      logger.warn('Not in brazil, retrying...');
      return getRandomPlaceInBrazil(); // try again recursively
    }

    
    return {
      name: randomResult.name,
      formatted_address: addr,
      location: randomResult.geometry.location,
      type,
    };
  } else {
    logger.warn('No places found, retrying...');
    return getRandomPlaceInBrazil(); // try again recursively
  }
}

async function combineStreetViewImages(streetViewImages) {
  const tempFolder = path.join(database.databasePath, '..', 'temp');

  // Ensure the temp folder exists
  await fs.mkdir(tempFolder, { recursive: true });

  // Download and buffer each image
  const imageBuffers = await Promise.all(
    streetViewImages.map(async (svi) => {
      const response = await axios.get(svi.url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    })
  );

  // Resize all images to same dimensions
  const resizedImages = await Promise.all(
    imageBuffers.map((buffer) =>
      sharp(buffer).resize(640, 640).toBuffer()
    )
  );

  // Combine into a 2x2 grid
  const compositeImage = await sharp({
    create: {
      width: 1280,
      height: 1280,
      channels: 3,
      background: { r: 255, g: 255, b: 255 }
    }
  })
    .composite([
      { input: resizedImages[0], left: 0, top: 0 },
      { input: resizedImages[1], left: 640, top: 0 },
      { input: resizedImages[2], left: 0, top: 640 },
      { input: resizedImages[3], left: 640, top: 640 }
    ])
    .jpeg()
    .toBuffer();

  const hash = crypto.randomBytes(2).toString('hex');
  const outputPath = path.join(tempFolder, `streetview-${hash}.jpg`);
  await fs.writeFile(outputPath, compositeImage);

  return outputPath;
}

async function getStreetViewImagesFromPlace(place) {
  const { lat, lng } = place.location;

  // First, check if Street View exists nearby
  const metadataUrl = `https://maps.googleapis.com/maps/api/streetview/metadata?location=${lat},${lng}&radius=1000&key=${API_KEY}`;
  const metadataRes = await fetch(metadataUrl);
  const metadata = await metadataRes.json();

  if (metadata.status !== 'OK') {
    return null;
  }

  // Create Street View image URLs for multiple angles
  const streetViewImages = IMAGE_ANGLES.map((heading) => {
    return {
      heading,
      url: `https://maps.googleapis.com/maps/api/streetview?size=1280x1280&location=${lat},${lng}&fov=90&heading=${heading}&radius=1000&pitch=0&key=${API_KEY}`
    };
  });


  const streetViewCombined = await combineStreetViewImages(streetViewImages);

  return {
    placeName: place.name,
    placeType: place.type,
    location: { lat, lng },
    formatted_address: place.formatted_address,
    streetViewImages,
    streetViewCombined
  };
}

async function getRandomStreetViewInBrazil(retries = 0) {
  if(retries > 10){
    return false;
  }

  logger.info(`[getRandomStreetViewInBrazil] ${retries}/10`);
  const place = await getRandomPlaceInBrazil();
  const placeStreetView =  await getStreetViewImagesFromPlace(place);

  if(placeStreetView){
    return placeStreetView;
  } else {
    logger.info(`[getRandomStreetViewInBrazil] No street view, trying again`);
    return getRandomStreetViewInBrazil(retries+1);
  }
}

/**
 * Calcula a distância entre dois pontos usando a fórmula de Haversine
 * @param {number} lat1 - Latitude do ponto 1
 * @param {number} lon1 - Longitude do ponto 1
 * @param {number} lat2 - Latitude do ponto 2
 * @param {number} lon2 - Longitude do ponto 2
 * @returns {number} Distância em metros
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Raio da Terra em metros
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c;
  return distance;
}

/**
 * Calcula a pontuação com base na distância
 * @param {number} distance - Distância em metros
 * @returns {number} Pontuação (0-100)
 */
function calculateScore(distance) {
  if (distance <= MIN_DISTANCE_PERFECT) {
    return 1000;
  }
  
  if (distance >= MAX_DISTANCE_POINTS) {
    return 0;
  }
  
  // Escala logarítmica para a pontuação
  const score = 1000 - (Math.log10(distance) - Math.log10(MIN_DISTANCE_PERFECT)) / 
    (Math.log10(MAX_DISTANCE_POINTS) - Math.log10(MIN_DISTANCE_PERFECT)) * 1000;
  
  return Math.max(0, Math.min(1000, Math.round(score)));
}

function generateMarkers(pins) {
  const markers = pins.map(([lat, lng], index) => {
    if (index === 0) {
      // First pin: green tone
      const color = '0x00aa00'; // green background
      const labelColor = '0x004400'; // dark green glyph
      const borderColor = '0x004400'; // dark green border
      const scale = 1.5;

      return `markers=scale:${scale}|icon:https://chart.googleapis.com/chart?chst=d_map_pin_letter&chld=P|${color}|${labelColor}&chf=bg,s,${color}|${lat},${lng}`;
    } else {
      // Random color for background and glyph, black border
      const randomColor = () => {
        const letters = '0123456789ABCDEF';
        let color = '0x';
        for (let i = 0; i < 6; i++) {
          color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
      };

      const bgColor = randomColor();
      const glyphColor = randomColor();
      const scale = 1;

      return `markers=scale:${scale}|icon:https://chart.googleapis.com/chart?chst=d_map_pin_letter&chld=P|${bgColor}|${glyphColor}&chf=bg,s,${bgColor}|${lat},${lng}`;
    }
  });

  return markers;
}

function generateStaticMapUrl(pins, labels) {
  if (!pins.length || !labels.length || pins.length !== labels.length) {
    throw new Error("Invalid pins or labels array");
  }

  const baseUrl = "https://maps.googleapis.com/maps/api/staticmap";
  const center = pins[0];
  const zoom = 10;
  const size = "1280x1280";
  const maptype = "roadmap";

  // First pin: fixed green with label from labels[0]
  const markerParams = [
    `markers=color:0x6cd838|scale:2|label:${labels[0]}|${center[0]},${center[1]}`
  ];

  // Generate random color for other markers
  for (let i = 1; i < pins.length; i++) {
    const [lat, lng] = pins[i];
    const label = labels[i];
    const color = Math.floor(Math.random() * 0xffffff)
      .toString(16)
      .padStart(6, "0");
    markerParams.push(
      `markers=color:0x${color}|label:${label}|${lat},${lng}`
    );
  }

  const url =
    `${baseUrl}?center=${center[0]},${center[1]}` +
    `&zoom=${zoom}` +
    `&size=${size}` +
    `&maptype=${maptype}` +
    `&${markerParams.join("&")}` +
    `&key=${API_KEY}`;

  return url;
}



async function testeGeo(bot, message, args, group) {
  const chatId = message.group || message.author;
  const lat = -19.9311066985294;
  const lng = -43.98738786116566;

  const pins = [[-19.930557000444892, -43.98399758795254],
  [-19.93184803490352, -43.991582874716926],
  [-19.931537169811445, -43.967424288007244]];

  const localFinal1 = new Location(lat, lng, {name: `Nova Tentativa de moothz`, address: `🔄 ${lat.toFixed(6)}, ${lng.toFixed(6)} - 324.23 km, 514 pontos`, url: `https://www.google.com/maps/place/${lat},${lng}`});

  const msgs = [];
  const markers = generateStaticMapUrl([[lat,lng],  ...pins], ["F", "A", "B", "C"]);
  const mediaTeste = await bot.createMediaFromURL(markers);

  msgs.push(new ReturnMessage({
    chatId: chatId,
    content: localFinal1
  }));



  // msgs.push(new ReturnMessage({
  //   chatId: chatId,
  //   content: mediaTeste
  // }));



  return msgs;
}

/**
 * Inicia um novo jogo de Geoguesser
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function startGeoguesserGame(bot, message, args, group) {
  const chatId = message.group || message.author;

  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O Geoguesser só pode ser jogado em grupos.'
      });
    }
    
    const groupId = message.group;
    
    // Verifica se já existe um jogo ativo
    if (activeGames[groupId]) {
      // Verifica se o jogo já expirou
      if (Date.now() > activeGames[groupId].endTime) {
        // Finaliza o jogo antigo
        await endGame(bot, groupId);
      } else {
        // Informa que há um jogo em andamento
        const timeRemaining = Math.ceil((activeGames[groupId].endTime - Date.now()) / 1000);
        return new ReturnMessage({
          chatId: groupId,
          content: `🌎 Já existe um jogo de Geoguesser em andamento neste grupo! Tempo restante: ${timeRemaining} segundos.`
        });
      }
    }
    
    
    // Envia mensagem inicial
    const returnMessages = [];


    bot.sendReturnMessages(new ReturnMessage({chatId: chatId, content: "🌎 *Inicializando _Geoguesser_*, aguarde as imagens! ⏳"}));

    try{

      const localRandom = await getRandomStreetViewInBrazil();
      const localEmoji = EMOJIS_LOCAL[localRandom.placeType] ?? "📍";

      // Cria o objeto do jogo
      activeGames[groupId] = {
        location: localRandom.location,
        address: localRandom.formatted_address,
        locationInfo: `${localEmoji} ${localRandom.placeName}`,
        guesses: [],
        startTime: Date.now(),
        endTime: Date.now() + GAME_DURATION
      };

      logger.info(`[startGeoguesserGame][${groupId}] Dados do jogo iniciado: `, activeGames[groupId]);


      /*
      for(let img of localRandom.streetViewImages){
        const media = await bot.createMediaFromURL(img.url);

        returnMessages.push(new ReturnMessage({
          chatId: chatId,
          content: media
        }));

      }
      */
      const media = await bot.createMedia(localRandom.streetViewCombined);
      returnMessages.push(new ReturnMessage({
        chatId: chatId,
        content: media
      }));


      

      // Envia instruções
      const instructions = '🌎 *Onde está esse lugar?* 🔍\n\n' +
        '- Envie sua localização pelo WhatsApp ou\n' +
        '- !geoguess nome do lugar\n' +
        '- !geoguess -20.123 -15.32\n\n' +
        'Vocês tem *5 minutos* para adivinhar! ⏰';
      
      returnMessages.push(new ReturnMessage({
        chatId: chatId,
        content: instructions,
        options: {
          quotedMessageId: message.origin.id._serialized
        },
        delay: 1000
      }));

      // Configura o temporizador para finalizar o jogo
      setTimeout(async () => {
        if (activeGames[groupId]) {
          await endGame(bot, groupId);
        }
      }, GAME_DURATION);
      
      return returnMessages;
    } catch (error) {
      logger.error('Erro ao baixar/enviar imagens:', error);
      
      // Limpa o jogo em caso de erro
      delete activeGames[groupId];
      
      return new ReturnMessage({
        chatId: groupId,
        content: '❌ Erro ao iniciar o jogo de Geoguesser. Por favor, tente novamente.'
      });
    }
  } catch (error) {
    logger.error('Erro ao iniciar jogo de Geoguesser:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao iniciar o jogo de Geoguesser. Por favor, tente novamente.'
    });
  }
}

async function searchLocation(input) {
  const parseCoordinates = (str) => {
    // Match various coordinate formats
    const coordRegex = /(-?\d+(?:[\.,]\d+)?)\s*(?:[,eE-]{1,3})\s*(-?\d+(?:[\.,]\d+)?)/;
    const match = str.match(coordRegex);
    if (match) {
      const lat = parseFloat(match[1].replace(',', '.'));
      const lng = parseFloat(match[2].replace(',', '.'));
      if (!isNaN(lat) && !isNaN(lng)) {
        return { lat, lng };
      }
    }
    return null;
  };

  const coords = parseCoordinates(input);
  if (coords) {
    return coords;
  }

  // Not coordinates: do geocoding using Google Maps API
  const encoded = encodeURIComponent(input);
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&region=br&key=${API_KEY}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results.length > 0) {
      const location = data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    } else {
      logger.error(`Geocoding failed: ${data.status}`);
      return null;
    }
  } catch (error) {
    logger.error('Error in searchLocation:', error);
    return null;
  }
}


/**
 * Processa uma adivinhação de localização
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function makeGuess(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O Geoguesser só pode ser jogado em grupos.'
      });
    }
    
    const groupId = message.group;
    const userId = message.author;
    
    // Obtém o nome do usuário
    let userName = message.authorName || "Jogador";
    
    // Verifica se há um jogo ativo
    if (!activeGames[groupId]) {
      return new ReturnMessage({
        chatId: groupId,
        content: '🌎 Não há um jogo de Geoguesser em andamento. Inicie um com !geoguesser'
      });
    }
    
    // Verifica se o jogo expirou
    if (Date.now() > activeGames[groupId].endTime) {
      await endGame(bot, groupId);
      return new ReturnMessage({
        chatId: groupId,
        content: '⏰ O tempo para esse jogo de Geoguesser acabou! Inicie um novo com !geoguesser'
      });
    }
    
    // Verifica argumentos (latitude e longitude ou nome)
    if (args.length < 1) {
      return new ReturnMessage({
        chatId: groupId,
        content: '❌ Formato incorreto. Use: !geoguess latitude longitude ou !geoguess nome do lugar'
      });
    }
    
    const localBuscado = await searchLocation(args.join(" "));

    // Extrai e valida latitude e longitude
    //const lat = parseFloat(args[0].replace(",", ""));
    //const lng = parseFloat(args[1].replace(",", ""));

    const lat = localBuscado.lat;
    const lng = localBuscado.lng;

    
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return new ReturnMessage({
        chatId: groupId,
        content: `❌ Coordenadas ou local inválido (${args.join(" ")}). Latitude deve estar entre -90 e 90, e longitude entre -180 e 180.`
      });
    }
    
    // Calcula a distância
    const targetLocation = activeGames[groupId].location;
    const distance = calculateDistance(lat, lng, targetLocation.lat, targetLocation.lng);
    
    // Calcula a pontuação
    const score = calculateScore(distance);
    
    // Adiciona a adivinhação
    const guess = {
      userId,
      userName,
      lat,
      lng,
      distance,
      score,
      timestamp: Date.now()
    };
    
    // Verifica se o usuário já fez uma adivinhação
    const existingGuessIndex = activeGames[groupId].guesses.findIndex(g => g.userId === userId);
    
    if (existingGuessIndex !== -1) {
      // Atualiza a adivinhação existente se a nova for melhor
      if (score > activeGames[groupId].guesses[existingGuessIndex].score) {
        activeGames[groupId].guesses[existingGuessIndex] = guess;
        
        const guessLoc = new Location(lat, lng, {name: `Nova Tentativa de ${userName}`, address: `🔄 ${lat.toFixed(6)}, ${lng.toFixed(6)} - ${(distance/1000).toFixed(2)} km, ${score} pontos`, url: `https://www.google.com/maps/place/${lat},${lng}`});

        return new ReturnMessage({
          chatId: groupId,
          content: guessLoc, 
          options: { quotedMessageId: message.origin.id._serialized }
        });
      } else {
        return new ReturnMessage({
          chatId: groupId,
          content: `⚠️ ${userName}, sua adivinhação anterior de *${ (activeGames[groupId].guesses[existingGuessIndex].distance/1000).toFixed(2) }km* era melhor que esta de _${ (distance/1000).toFixed(2) }km_.`,
          options: { quotedMessageId: message.origin.id._serialized }
        });
      }
    } else {
      // Adiciona nova adivinhação
      activeGames[groupId].guesses.push(guess);
      
      const guessLoc = new Location(lat, lng, {name: `Tentativa de ${userName}`, address: `✅ ${lat.toFixed(6)}, ${lng.toFixed(6)} - ${(distance/1000).toFixed(2)} km, ${score} pontos`, url: `https://www.google.com/maps/place/${lat},${lng}`});

      return new ReturnMessage({
        chatId: groupId,
        content: guessLoc,
        options: { quotedMessageId: message.origin.id._serialized }
      });
    }
  } catch (error) {
    logger.error('Erro ao processar adivinhação:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao processar sua adivinhação. Por favor, tente novamente.'
    });
  }
}

/**
 * Finaliza um jogo de Geoguesser
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {string} groupId - ID do grupo
 */
async function endGame(bot, groupId) {
  try {
    if (!activeGames[groupId]) {
      return;
    }
    
    const game = activeGames[groupId];
    
    logger.info(`[endGame] `, game);
    // Ordena as adivinhações pela pontuação (maior para menor)
    const sortedGuesses = [...game.guesses].sort((a, b) => b.score - a.score);
    
    // Prepara a mensagem de resultados
    const guessesPins = sortedGuesses.map(sG => [sG.lat, sG.lng]);
    const guessesLabels = sortedGuesses.map(sG => sG.userName[0].toUpperCase());
    const pins = [[game.location.lat,game.location.lng], ...guessesPins];
    const labels = ["R", ...guessesLabels];
    const mapaFinal = generateStaticMapUrl(pins, labels)    // Mapa centralizado na resposta com os pins das tentativas e primeira letra inicial da pessoa no PIN
    const mapMedia = await bot.createMediaFromURL(mapaFinal); 

    let resultsMessage = '🏁 *Fim da rodada de _Geoguesser_!*\n\n';
    resultsMessage += `📍 Local correto:\n- ${game.address}\n- ${game.locationInfo}\n- https://www.google.com/maps/place/${game.location.lat},${game.location.lng}\n\n`;
    
    // Adiciona o ranking
    if (sortedGuesses.length > 0) {
      resultsMessage += '*Ranking da rodada:*\n';
      
      sortedGuesses.forEach((guess, index) => {
        const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
        resultsMessage += `- ${medal} ${guess.userName}: ${guess.score} pontos (${(guess.distance/1000).toFixed(2)} km)\n`;
      });
      
      // Menciona o vencedor
      if (sortedGuesses.length > 0) {
        resultsMessage += `\n🏆 Parabéns a _${sortedGuesses[0].userName}_ pela melhor adivinhação!`;
      }
    } else {
      resultsMessage += 'Ninguém fez uma adivinhação nesta rodada. 😢';
    }
    
    const msgFim = new ReturnMessage({
      chatId: groupId,
      content: mapMedia,
      options: {
        caption: resultsMessage 
      }
    });

    logger.info(`[endGame] `, resultsMessage);

    // Envia mensagem com os resultados
    bot.sendReturnMessages(msgFim);
    
    // Salva os resultados do jogo no histórico
    try {
      // Carrega dados do Geoguesser
      let dados = await carregarDadosGeoguesser();
      
      // Inicializa dados do grupo se necessário
      dados = inicializarGrupo(dados, groupId);
      
      // Inicializa histórico do grupo se não existir
      if (!dados.grupos[groupId].historico) {
        dados.grupos[groupId].historico = [];
      }
      
      // Limita o tamanho do histórico (mantém apenas os últimos 50 jogos)
      if (dados.grupos[groupId].historico.length >= 50) {
        dados.grupos[groupId].historico = dados.grupos[groupId].historico.slice(-49);
      }
      
      // Adiciona resultados do jogo ao histórico
      dados.grupos[groupId].historico.push({
        location: game.location,
        guesses: game.guesses,
        startTime: game.startTime,
        endTime: Date.now(),
        timestamp: Date.now()
      });
      
      // Registra pontos para os jogadores
      for (const guess of sortedGuesses) {
        await registerGeoguesserPoints(guess.userId, guess.userName, groupId, guess.score);
      }
      
      // Salva dados
      await salvarDadosGeoguesser(dados);
    } catch (dbError) {
      logger.error('Erro ao salvar resultados do jogo:', dbError);
    }
    
    // Remove o jogo da lista de ativos
    delete activeGames[groupId];
  } catch (error) {
    logger.error('Erro ao finalizar jogo:', error);
    
    // Garante que o jogo seja removido mesmo em caso de erro
    delete activeGames[groupId];
  }
}

/**
 * Processa uma localização enviada, invocada no EventHandler->processNonCommandMessage
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem formatada
 * @returns {Promise<ReturnMessage|null>} Mensagem de retorno ou null
 */
async function processLocationMessage(bot, message) {
  try {
    const groupId = message.group;
    
    // Verifica se há um jogo ativo no grupo
    if (!activeGames[groupId]) {
      return null;
    }
    
    // Verifica se o jogo expirou
    if (Date.now() > activeGames[groupId].endTime) {
      await endGame(bot, groupId);
      return null;
    }
    
    // Extrai as coordenadas da mensagem de localização
    const lat = message.content?.latitude ?? message.origin?.location?.latitude ?? message.content?.lat ?? message.origin?._data?.lat;
    const lng = message.content?.longitude ?? message.origin?.location?.longitude ?? message.content?.lng ?? message.origin?._data?.lng;

    logger.info(`[processLocationMessage] Recebida localização: ${lat}, ${lng}`)
    if (!lat || !lng) {
      logger.info(`[processLocationMessage] Não consegui local?`, message.origin);

      return null; // Não é uma mensagem de localização válida
    }
    
    const userId = message.author;
    const userName = message.authorName || "Jogador";
    
    // Calcula a distância
    const targetLocation = activeGames[groupId].location;
    const distance = calculateDistance(lat, lng, targetLocation.lat, targetLocation.lng);
    
    // Calcula a pontuação
    const score = calculateScore(distance);
    
    // Cria objeto de adivinhação
    const guess = {
      userId,
      userName,
      lat,
      lng,
      distance,
      score,
      timestamp: Date.now()
    };
    
    // Verifica se o usuário já fez uma adivinhação
    const existingGuessIndex = activeGames[groupId].guesses.findIndex(g => g.userId === userId);
    
    if (existingGuessIndex !== -1) {
      // Atualiza a adivinhação existente se a nova for melhor
      if (score > activeGames[groupId].guesses[existingGuessIndex].score) {
        activeGames[groupId].guesses[existingGuessIndex] = guess;
        
        return new ReturnMessage({
          chatId: groupId,
          content: `🔄 ${userName} atualizou sua adivinhação usando localização.\nDistância: ${(distance/1000).toFixed(2)} km\nPontuação: ${score} pontos (melhor que sua tentativa anterior)`,
          options: { quotedMessageId: message.origin.id._serialized }
        });
      } else {
        return new ReturnMessage({
          chatId: groupId,
          content: `⚠️ ${userName}, sua adivinhação anterior de *${(activeGames[groupId].guesses[existingGuessIndex].distance/1000).toFixed(2)}km* era melhor que esta de _${ (distance/1000).toFixed(2) }km_.`,
          options: { quotedMessageId: message.origin.id._serialized }
        });
      }
    } else {
      // Adiciona nova adivinhação
      activeGames[groupId].guesses.push(guess);
      
      return new ReturnMessage({
        chatId: groupId,
        content: `✅ ${userName} tentou adivinhar.\nDistância: ${(distance/1000).toFixed(2)} km\nPontuação: ${score} pontos`,
        options: { quotedMessageId: message.origin.id._serialized }
      });
    }
  } catch (error) {
    logger.error('Erro ao processar mensagem de localização:', error);
    return null;
  }
}

/**
 * Mostra o status do jogo atual
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function showGameStatus(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O Geoguesser só pode ser jogado em grupos.'
      });
    }
    
    const groupId = message.group;
    
    // Verifica se há um jogo ativo
    if (!activeGames[groupId]) {
      return new ReturnMessage({
        chatId: groupId,
        content: '🌎 Não há um jogo de Geoguesser em andamento. Inicie um com !geoguesser'
      });
    }
    
    // Verifica se o jogo expirou
    if (Date.now() > activeGames[groupId].endTime) {
      await endGame(bot, groupId);
      return new ReturnMessage({
        chatId: groupId,
        content: '⏰ O tempo para esse jogo de Geoguesser acabou! Inicie um novo com !geoguesser'
      });
    }
    
    // Calcula tempo restante
    const timeRemaining = Math.ceil((activeGames[groupId].endTime - Date.now()) / 1000);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    
    // Prepara a mensagem de status
    let statusMessage = '🌎 *Status do jogo de Geoguesser*\n\n';
    statusMessage += `⏱️ Tempo restante: ${minutes}m ${seconds}s\n\n`;
    
    // Adiciona lista de participantes
    const guesses = activeGames[groupId].guesses;
    
    if (guesses.length > 0) {
      statusMessage += '*Adivinhações até agora:*\n';
      
      // Ordena as adivinhações pela pontuação (maior para menor)
      const sortedGuesses = [...guesses].sort((a, b) => b.score - a.score);
      
      sortedGuesses.forEach((guess, index) => {
        statusMessage += `${index + 1}. ${guess.userName}: ${guess.score} pontos\n`;
      });
    } else {
      statusMessage += 'Ainda ninguém fez uma adivinhação nesta rodada!';
    }
    
    return new ReturnMessage({
      chatId: groupId,
      content: statusMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar status do jogo:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao mostrar status do jogo. Por favor, tente novamente.'
    });
  }
}

/**
 * Mostra o histórico de jogos de Geoguesser
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function showGameHistory(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O comando de histórico só pode ser usado em grupos.'
      });
    }
    
    const groupId = message.group;
    
    // Carrega dados do Geoguesser
    let dados = await carregarDadosGeoguesser();
    
    // Inicializa dados do grupo se necessário
    dados = inicializarGrupo(dados, groupId);
    
    // Verifica se há histórico para este grupo
    if (!dados.grupos[groupId].historico || dados.grupos[groupId].historico.length === 0) {
      return new ReturnMessage({
        chatId: groupId,
        content: '📜 Ainda não há histórico de jogos de Geoguesser neste grupo.'
      });
    }
    
    // Limita a exibir apenas os 5 jogos mais recentes
    const recentGames = dados.grupos[groupId].historico.slice(-5).reverse();
    
    // Prepara a mensagem de histórico
    let historyMessage = '📜 *Histórico de Geoguesser*\n\n';
    
    recentGames.forEach((game, index) => {
      // Obtém a data formatada
      const gameDate = new Date(game.timestamp);
      const dateStr = gameDate.toLocaleString('pt-BR');
      
      historyMessage += `*Jogo ${index + 1}* - ${dateStr}\n`;
      
      // Adiciona o local
      historyMessage += `📍 ${game.location.lat.toFixed(6)}, ${game.location.lng.toFixed(6)}\n`;
      
      // Adiciona o vencedor se houver
      if (game.guesses && game.guesses.length > 0) {
        // Ordena as adivinhações pela pontuação (maior para menor)
        const sortedGuesses = [...game.guesses].sort((a, b) => b.score - a.score);
        
        historyMessage += `🏆 Vencedor: ${sortedGuesses[0].userName} (${sortedGuesses[0].score} pts)\n`;
      } else {
        historyMessage += `😢 Sem participantes\n`;
      }
      
      historyMessage += '\n';
    });
    
    historyMessage += `Total de jogos realizados neste grupo: ${dados.grupos[groupId].historico.length}`;
    
    return new ReturnMessage({
      chatId: groupId,
      content: historyMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar histórico de jogos:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao mostrar histórico de jogos. Por favor, tente novamente.'
    });
  }
}

// Registra pontos do geoguesser para um usuário
async function registerGeoguesserPoints(userId, userName, groupId, points) {
  try {
    // Carrega dados do Geoguesser
    let dados = await carregarDadosGeoguesser();
    
    // Inicializa dados do grupo se necessário
    dados = inicializarGrupo(dados, groupId);
    
    // Inicializa ranking do grupo se não existir
    if (!dados.grupos[groupId].ranking) {
      dados.grupos[groupId].ranking = {};
    }
    
    // Inicializa dados do jogador no grupo se não existir
    if (!dados.grupos[groupId].ranking[userId]) {
      dados.grupos[groupId].ranking[userId] = {
        nome: userName,
        pontos: 0,
        jogos: 0,
        vitorias: 0
      };
    }
    
    // Atualiza dados do jogador no grupo
    dados.grupos[groupId].ranking[userId].pontos += points;
    dados.grupos[groupId].ranking[userId].jogos += 1;
    
    // Se obteve pontuação máxima (1000), conta como vitória perfeita
    if (points === 1000) {
      dados.grupos[groupId].ranking[userId].vitorias += 1;
    }
    
    // Atualiza nome se mudou
    dados.grupos[groupId].ranking[userId].nome = userName;
    
    // Inicializa ranking global se não existir
    if (!dados.global[userId]) {
      dados.global[userId] = {
        nome: userName,
        pontos: 0,
        jogos: 0,
        vitorias: 0
      };
    }
    
    // Atualiza dados do jogador no ranking global
    dados.global[userId].pontos += points;
    dados.global[userId].jogos += 1;
    
    // Se obteve pontuação máxima (1000), conta como vitória perfeita
    if (points === 1000) {
      dados.global[userId].vitorias += 1;
    }
    
    // Atualiza nome se mudou
    dados.global[userId].nome = userName;
    
    // Salva dados
    await salvarDadosGeoguesser(dados);
    
    return true;
  } catch (error) {
    logger.error('Erro ao registrar pontos de Geoguesser:', error);
    return false;
  }
}

/**
 * Mostra o ranking global de Geoguesser
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function showGeoguesserRanking(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Carrega dados do Geoguesser
    let dados = await carregarDadosGeoguesser();
    
    // Determina qual ranking mostrar (global ou do grupo)
    const showGlobal = args[0] === 'global' || !message.group;
    
    let rankingData = {};
    
    if (showGlobal) {
      rankingData = dados.global;
    } else {
      // Inicializa dados do grupo se necessário
      dados = inicializarGrupo(dados, message.group);
      
      // Obtém ranking do grupo
      rankingData = dados.grupos[message.group].ranking || {};
    }
    
    // Converte para array para poder ordenar
    const players = Object.entries(rankingData).map(([id, data]) => ({
      id,
      ...data
    }));
    
    // Verifica se há jogadores
    if (players.length === 0) {
      return new ReturnMessage({
        chatId,
        content: showGlobal 
          ? '🏆 Ainda não há jogadores no ranking global. Jogue algumas partidas!'
          : '🏆 Ainda não há jogadores no ranking deste grupo. Jogue algumas partidas!'
      });
    }
    
    // Ordena por pontos (maior para menor)
    players.sort((a, b) => b.pontos - a.pontos);
    
    // Limita a 10 jogadores
    const topPlayers = players.slice(0, 10);
    
    // Prepara a mensagem de ranking
    let rankingMessage = `🏆 *Ranking de Geoguesser ${showGlobal ? 'Global' : 'do Grupo'}*\n\n`;
    
    topPlayers.forEach((player, index) => {
      const medal = index < EMOJIS_RANKING.length ? EMOJIS_RANKING[index + 1] : `${index + 1}.`;
      const avgPoints = player.jogos > 0 ? (player.pontos / player.jogos).toFixed(1) : '0.0';
      
      rankingMessage += `${medal} ${player.nome}: ${player.pontos} pts (${player.jogos} jogos, média: ${avgPoints}, vitórias perfeitas: ${player.vitorias})\n`;
    });
    
    // Adiciona instruções para ver outro ranking
    if (message.group) {
      rankingMessage += `\nUse "!georanking global" para ver o ranking global`;
    } else {
      rankingMessage += `\nEste é o ranking global. Use o comando em um grupo para ver o ranking específico.`;
    }
    
    return new ReturnMessage({
      chatId,
      content: rankingMessage
    });
  } catch (error) {
    logger.error('Erro ao mostrar ranking de Geoguesser:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: '❌ Erro ao mostrar ranking. Por favor, tente novamente.'
    });
  }
}

setInterval(async () => {  
  try {  
      // Salva periodicamente se houver modificações não salvas  
      if (modificacoesNaoSalvas && (Date.now() - ultimoSalvamento) > INTERVALO_SALVAMENTO) {  
        await salvarDadosGeoguesser(dadosCache);  
      }  
  } catch (error) {  
    logger.error('Erro na verificação periódica de dados Geoguesser:', error);  
  }  
}, INTERVALO_SALVAMENTO);

// Adicione um handler para salvar dados antes de encerrar o processo  
process.on('SIGINT', async () => {  
  try {  
    if (dadosCache !== null && modificacoesNaoSalvas) {  
      logger.info('Salvando dados do Geoguesser antes de encerrar...');  
      await salvarDadosGeoguesser(dadosCache, true);  
    }  
  } catch (error) {  
    logger.error('Erro ao salvar dados do Geoguesser durante encerramento:', error);  
  } finally {  
    process.exit(0);  
  }  
});

// Criar array de comandos usando a classe Command
const commands = [
  new Command({
    name: 'geotest',
    description: 'Testes',
    category: "jogos",
    cooldown: 0,
    hidden: true,
    reactions: {
      before: "🌎",
      after: "🔍",
      error: "❌"
    },
    method: testeGeo
  }),
  new Command({
    name: 'geoguesser',
    description: 'Inicia um jogo de adivinhação de localização',
    category: "jogos",
    cooldown: 300, // 5 minutos
    reactions: {
      before: "🌎",
      after: "🔍",
      error: "❌"
    },
    method: startGeoguesserGame
  }),
  
  new Command({
    name: 'geoguess',
    description: 'Envia uma adivinhação para o jogo atual',
    category: "jogos",
    hidden: true,
    cooldown: 0,
    reactions: {
      before: "🧐",
      after: "📍",
      error: "❌"
    },
    method: makeGuess
  }),
  
  new Command({
    name: 'geostatus',
    description: 'Mostra o status do jogo atual',
    category: "jogos",
    hidden: true,
    cooldown: 10,
    reactions: {
      after: "ℹ️",
      error: "❌"
    },
    method: showGameStatus
  }),
  
  new Command({
    name: 'geohistory',
    description: 'Mostra o histórico de jogos',
    category: "jogos",
    hidden: true,
    cooldown: 30,
    reactions: {
      after: "📜",
      error: "❌"
    },
    method: showGameHistory
  }),
  
  new Command({
    name: 'geo-ranking',
    description: 'Mostra o ranking de jogadores',
    category: "jogos",
    cooldown: 30,
    reactions: {
      after: "🏆",
      error: "❌"
    },
    method: showGeoguesserRanking
  })
];

module.exports = { commands, processLocationMessage };