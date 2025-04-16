const path = require('path');
const Logger = require('../utils/Logger');
const ytSearch = require('youtube-search-api');
const youtubedl = require('youtube-dl-exec')
const VideoCacheManager = require('../utils/videoCacheManager')
const Database = require('../utils/Database');
const crypto = require('crypto');

const logger = new Logger('youtube-downloader');
const database = Database.getInstance();
const videoCacheManager = new VideoCacheManager(youtubedl, database.databasePath);

logger.info('Módulo YoutubeDownloader carregado');

/**
 * Extrai o ID do vídeo de uma URL do YouTube
 * @param {string} url - URL do YouTube
 * @returns {string|null} - ID do vídeo ou null se não for encontrado
 */
function extractYoutubeVideoId(url) {
  if (!url) return null;
  
  // Padrões de URL do YouTube
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?v=([^&]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtu\.be\/([^?]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([^?]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/v\/([^?]+)/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([^?]+)/i
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Busca um vídeo no YouTube por termo de pesquisa
 * @param {string} searchTerm - Termo de pesquisa
 * @returns {Promise<string|null>} - ID do vídeo encontrado ou null
 */
async function searchYoutubeVideo(searchTerm) {
  try {
    logger.info(`Buscando vídeo no YouTube: "${searchTerm}"`);
    const searchResults = await ytSearch.GetListByKeyword(searchTerm, false, 1);
    
    if (searchResults && searchResults.items && searchResults.items.length > 0) {
      const videoId = searchResults.items[0].id;
      logger.info(`Vídeo encontrado: ${videoId}`);
      return videoId;
    }
    
    logger.warn('Nenhum vídeo encontrado para a pesquisa');
    return null;
  } catch (error) {
    logger.error('Erro ao buscar vídeo no YouTube:', error);
    return null;
  }
}

/**
 * Processa uma reação para download de vídeo/áudio do YouTube
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Mensagem
 * @param {string} emoji - Emoji da reação
 * @returns {Promise<boolean>} - True se a reação foi processada
 */
async function processYoutubeReaction(bot, message, emoji) {
  try {
    if (emoji !== '⏬') return false;
    
    // Obtém texto da mensagem original
    const messageText = message.type === 'text' ? message.content : message.caption;
    if (!messageText) return false;
    
    // Verifica se tem URL do YouTube
    const videoId = extractYoutubeVideoId(messageText);
    if (!videoId) return false;
    
    logger.info(`Processando reação para download de vídeo: ${videoId}`);
    
    // Envia reação de processamento
    try {
      await message.origin.react('⏳');
    } catch (reactError) {
      logger.error('Erro ao reagir à mensagem:', reactError);
    }
    
    // Envia mensagem de confirmação
    const chatId = message.group || message.author;
    await bot.sendMessage(chatId, 'Baixando vídeo do YouTube...');
    
    // Baixa como vídeo
    baixarVideoYoutube(videoId, message.author, false, async (error, result) => {
      if (error) {
        logger.error('Erro ao baixar vídeo:', error.message);
        await bot.sendMessage(chatId, `Erro ao baixar vídeo: ${error.message}`);
        
        // Reage com emoji de erro
        try {
          await message.origin.react('❌');
        } catch (reactError) {
          logger.error('Erro ao reagir à mensagem:', reactError);
        }
        return;
      }
      
      try {
        // Cria objeto de mídia
        const media = await bot.createMedia(result.arquivo);
        
        // Envia vídeo
        await bot.sendMessage(chatId, media, {
          caption: result.legenda
        });
        
        // Reage com emoji de sucesso
        try {
          await message.origin.react('✅');
        } catch (reactError) {
          logger.error('Erro ao reagir à mensagem:', reactError);
        }
      } catch (sendError) {
        logger.error('Erro ao enviar vídeo:', sendError);
        await bot.sendMessage(chatId, 'Erro ao enviar vídeo.');
        
        // Reage com emoji de erro
        try {
          await message.origin.react('❌');
        } catch (reactError) {
          logger.error('Erro ao reagir à mensagem:', reactError);
        }
      }
    });
    
    return true;
  } catch (error) {
    logger.error('Erro ao processar reação para download de YouTube:', error);
    return false;
  }
}

async function baixarVideoYoutube(idVideo,dadosSolicitante,videoHD=false,callback){
	try {
		idVideo = idVideo.replace(/[^a-z0-9_-]/gi, '');
		let urlSafe = `https://www.youtube.com/watch?v=${idVideo}`;

		
		// Baixa video
		const hash = crypto.randomBytes(2).toString('hex');
		let nomeVideoTemp = `ytdlp-${hash}`; // ${dadosSolicitante}
		let destinoVideo = path.join(process.env.YOUTUBE_DL_FOLDER,`${nomeVideoTemp}_v.mp4`);
		logger.info(`[baixarVideoYoutube][${nomeVideoTemp}] Buscando info do video '${urlSafe}'`);
		
		// Pega dados primeiro
		videoCacheManager.getVideoInfoWithCache(urlSafe, {dumpSingleJson: true}).then(videoInfo => {
			const autorVideo = videoInfo.uploader;
			const tituloVideo = videoInfo.title;
			logger.info(`[baixarVideoYoutube][${nomeVideoTemp}] Info do video '${videoInfo.id}': ${tituloVideo}, ${autorVideo}, ${videoInfo.duration}s.\nFazendo download para ${destinoVideo}`);

			if(videoInfo.duration > 600){
				callback( new Error(`Atualmente, só consigo baixar vídeos/músicas de até 10 minutos.`),null);
			} else {			
				videoCacheManager.downloadVideoWithCache(urlSafe, 
					{ 
						o: destinoVideo,
						f: "(bv*[vcodec~='^((he|a)vc|h264)'][filesize<55M]+ba) / (bv*+ba/b)",
						remuxVideo: "mp4",
						recodeVideo: "mp4",
						audioFormat: "aac",
						ffmpegLocation: process.env.FFMPEG_PATH,
					  	cookies: path.join(database.databasePath,"www.youtube.com_cookies.txt")
					}
				).then(output => {
					if(output.fromCache){
						logger.info(`[baixarVideoYoutube][${nomeVideoTemp}] Estava em cache!`);
						destinoVideo = output.lastDownloadLocation;
					} else {
						logger.info(`[baixarVideoYoutube][${nomeVideoTemp}] Não tinha cache, setando...`);
						videoCacheManager.setLastDownloadLocation(urlSafe, destinoVideo, "video");
					}
					const resultado = {"legenda": `[${autorVideo}] ${tituloVideo}`, "arquivo": destinoVideo};
					logger.info(`[baixarMusicaYoutube][${nomeVideoTemp}] Resultado: ${JSON.stringify(resultado)}`);
					callback(null, resultado);
				}).catch(error => {
					callback(error, null);1
				});
			}
		}).catch(error => {
			console.log(error);
			callback(error, null);
		});	
	} catch(e) {
		callback(e,null);
	}
}

async function baixarMusicaYoutube(idVideo,dadosSolicitante,callback){
	try {
		idVideo = idVideo.replace(/[^a-z0-9_-]/gi, '');
		let urlSafe = `https://www.youtube.com/watch?v=${idVideo}`;

		
		// Baixa video
		const hash = crypto.randomBytes(2).toString('hex');
		let nomeVideoTemp = `ytdlp-${hash}`; // ${dadosSolicitante}
		let destinoVideo = path.join(process.env.YOUTUBE_DL_FOLDER,`${nomeVideoTemp}_a.mp3`);
		logger.info(`[baixarMusicaYoutube][${nomeVideoTemp}] Buscando info do video '${urlSafe}'`);
		
		// Pega dados primeiro
		videoCacheManager.getVideoInfoWithCache(urlSafe, {dumpSingleJson: true}).then(videoInfo => {
			const autorVideo = videoInfo.uploader;
			const tituloVideo = videoInfo.title;
			logger.info(`[baixarMusicaYoutube][${nomeVideoTemp}] Info do video '${videoInfo.id}': ${tituloVideo}, ${autorVideo}, ${videoInfo.duration}s.\nFazendo download para ${destinoVideo}`);
			if(videoInfo.duration > 600){
				callback( new Error(`Atualmente, só consigo baixar vídeos/músicas de até 10 minutos.`),null);
			} else {			
				videoCacheManager.downloadMusicWithCache(urlSafe, 
					{ 
						o: destinoVideo,
						f: "ba",
						audioFormat: "mp3",
						extractAudio: true,
						ffmpegLocation: process.env.FFMPEG_PATH,
					  	cookies: path.join(database.databasePath,"www.youtube.com_cookies.txt")
					}
				).then(output => {
					if(output.fromCache){
						logger.info(`[baixarMusicaYoutube][${nomeVideoTemp}] Estava em cache!`);
						destinoVideo = output.lastDownloadLocation;
					} else {
						logger.info(`[baixarMusicaYoutube][${nomeVideoTemp}] Não tinha cache, setando...`);
						videoCacheManager.setLastDownloadLocation(urlSafe, destinoVideo, "audio");
					}
					const resultado = {"legenda": `[${autorVideo}] ${tituloVideo}`, "arquivo": destinoVideo};
					logger.info(`[baixarMusicaYoutube][${nomeVideoTemp}] Resultado: ${JSON.stringify(resultado)}`);
					callback(null, resultado);
				}).catch(error => {
					console.log(error);
					callback(new Error(`Não consegui baixar este vídeo 😭`),null);
				});
			}
		}).catch(error => {
			console.log(error);
			callback(new Error(`Não consegui pegar informações sobre este vídeo 😭`),null);
		});	
	} catch(e) {
		callback(e,null);
	}
}


const commands = [
  {
    name: 'yt',
    description: 'Baixa um vídeo do YouTube',
    reactions: {
      before: "⏳",
      after: "✅",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      if (args.length === 0) {
        logger.debug('Comando yt chamado sem argumentos');
        await bot.sendMessage(chatId, 'Por favor, forneça um link do YouTube ou termo de busca. Exemplo: !yt https://youtu.be/dQw4w9WgXcQ ou !yt despacito');
        return;
      }
      
      let videoId = null;
      const input = args.join(' ');
      
      // Verifica se é um link do YouTube
      videoId = extractYoutubeVideoId(input);
      
      // Se não for um link, busca pelo termo
      if (!videoId) {
        logger.debug(`Buscando vídeo no YouTube: "${input}"`);
        await bot.sendMessage(chatId, `🔍 Buscando: "${input}" no YouTube...`);
        videoId = await searchYoutubeVideo(input);
        
        if (!videoId) {
          await bot.sendMessage(chatId, `❌ Nenhum vídeo encontrado para: "${input}"`);
          return;
        }
      }
      
      logger.debug(`Baixando vídeo: ${videoId}`);
      await bot.sendMessage(chatId, '⏬ Baixando vídeo...');
      
      // Baixa o vídeo
      baixarVideoYoutube(videoId, message.author, false, async (error, result) => {
        if (error) {
          logger.error('Erro ao baixar vídeo:', error.message);
          await bot.sendMessage(chatId, `Erro ao baixar vídeo: ${error.message}`);
          return;
        }
        
        try {
          // Cria objeto de mídia
          const media = await bot.createMedia(result.arquivo);
          
          // Envia vídeo
          await bot.sendMessage(chatId, media, {
            caption: result.legenda
          });
        } catch (sendError) {
          logger.error('Erro ao enviar vídeo:', sendError);
          await bot.sendMessage(chatId, 'Erro ao enviar vídeo.');
        }
      });
    }
  },
  {
    name: 'sr',
    description: 'Baixa um áudio do YouTube',
    reactions: {
      before: "⏳",
      after: "✅",
      error: "❌"
    },
    method: async (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      if (args.length === 0) {
        logger.debug('Comando sr chamado sem argumentos');
        await bot.sendMessage(chatId, 'Por favor, forneça um link do YouTube ou termo de busca. Exemplo: !sr https://youtu.be/dQw4w9WgXcQ ou !sr despacito');
        return;
      }
      
      let videoId = null;
      const input = args.join(' ');
      
      // Verifica se é um link do YouTube
      videoId = extractYoutubeVideoId(input);
      
      // Se não for um link, busca pelo termo
      if (!videoId) {
        logger.debug(`Buscando vídeo no YouTube: "${input}"`);
        await bot.sendMessage(chatId, `🔍 Buscando: "${input}" no YouTube...`);
        videoId = await searchYoutubeVideo(input);
        
        if (!videoId) {
          await bot.sendMessage(chatId, `❌ Nenhum vídeo encontrado para: "${input}"`);
          return;
        }
      }
      
      logger.debug(`Baixando áudio: ${videoId}`);
      await bot.sendMessage(chatId, '⏬ Baixando áudio...');
      
      // Baixa o áudio
      baixarMusicaYoutube(videoId, message.author, async (error, result) => {
        if (error) {
          logger.error('Erro ao baixar áudio:', error.message);
          await bot.sendMessage(chatId, `Erro ao baixar áudio: ${error.message}`);
          return;
        }
        
        try {
          // Cria objeto de mídia
          const media = await bot.createMedia(result.arquivo);
          
          // Envia áudio
          await bot.sendMessage(chatId, media, {
            caption: result.legenda
          });
        } catch (sendError) {
          logger.error('Erro ao enviar áudio:', sendError);
          await bot.sendMessage(chatId, 'Erro ao enviar áudio.');
        }
      });
    }
  }
];

// Registra os comandos sendo exportados
logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { commands, processYoutubeReaction };