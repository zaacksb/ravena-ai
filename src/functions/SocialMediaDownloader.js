const path = require('path');
const { exec } = require('child_process');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');
const SocialMediaCacheManager = require('../utils/SocialMediaCacheManager')
const Database = require('../utils/Database');
const crypto = require('crypto');

const logger = new Logger('social-media-downloader');
const database = Database.getInstance();

// Inicializa o cache manager
const smdCacheManager = new SocialMediaCacheManager(database.databasePath);

/**
 * Extrai a plataforma da URL
 * @param {string} url - URL do conteúdo
 * @returns {string|null} - Nome da plataforma ou null se não for reconhecida
 */
function detectPlatform(url) {
  if (!url) return null;
  
  const platforms = {
    'youtube.com': 'youtube',
    'youtu.be': 'youtube',
    'tiktok.com': 'tiktok',
    'instagram.com': 'instagram',
    'facebook.com': 'facebook',
    'fb.watch': 'facebook',
    'twitter.com': 'twitter',
    'x.com': 'twitter',
    'twitch.tv': 'twitch',
    'snapchat.com': 'snapchat',
    'reddit.com': 'reddit',
    'vimeo.com': 'vimeo',
    'streamable.com': 'streamable',
    'pinterest.com': 'pinterest',
    'linkedin.com': 'linkedin',
    'bilibili.com': 'bilibili'
  };
  
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    
    for (const [domain, platform] of Object.entries(platforms)) {
      if (hostname.includes(domain)) {
        return platform;
      }
    }
  } catch (error) {
    logger.error('Erro ao analisar URL:', error);
  }
  
  return null;
}

/**
 * Executa o programa SMD para baixar o conteúdo
 * @param {string} url - URL do conteúdo
 * @returns {Promise<Array<string>>} - Array com caminhos dos arquivos baixados
 */
function executeSMD(url) {
  return new Promise((resolve, reject) => {
    const smdPath = process.env.SMD_PATH;
    const outputFolder = process.env.DL_FOLDER;
    
    if (!smdPath || !outputFolder) {
      return reject(new Error('Configuração SMD_PATH ou DL_FOLDER não definida no .env'));
    }
    
    const command = `"${smdPath}" -u "${url}" -o "${outputFolder}"`;
    logger.info(`Executando: ${command}`);
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        logger.error(`Erro ao executar SMD: ${error.message}`);
        return reject(error);
      }
      
      if (stderr) {
        logger.warn(`SMD stderr: ${stderr}`);
      }
      
      logger.info(`SMD stdout: ${stdout}`);
      
      // Extrai o JSON da saída (último item na saída)
      try {
        // Encontra o último [ para começar o JSON
        const startJsonIndex = stdout.lastIndexOf('[');
        
        if (startJsonIndex === -1) {
          return reject(new Error('Não foi possível encontrar a lista de arquivos na saída'));
        }
        
        const jsonOutput = stdout.substring(startJsonIndex);
        const files = JSON.parse(jsonOutput);
        
        if (!Array.isArray(files)) {
          return reject(new Error('A saída do SMD não é um array válido'));
        }
        
        resolve(files);
      } catch (parseError) {
        logger.error(`Erro ao processar saída do SMD: ${parseError.message}`);
        reject(parseError);
      }
    });
  });
}

/**
 * Lê o conteúdo de arquivos de texto encontrados nos arquivos baixados
 * @param {Array<string>} filePaths - Caminhos dos arquivos baixados
 * @returns {Promise<string|null>} - Conteúdo do arquivo de texto ou null
 */
async function readTextFileContent(filePaths) {
  const textFiles = filePaths.filter(file => file.toLowerCase().endsWith('.txt'));
  
  if (textFiles.length === 0) {
    return null;
  }
  
  try {
    // Lê apenas o primeiro arquivo de texto encontrado
    const content = await fs.readFile(textFiles[0], 'utf8');
    return content;
  } catch (error) {
    logger.error(`Erro ao ler arquivo de texto: ${error.message}`);
    return null;
  }
}

/**
 * Baixa conteúdo da URL da mídia social
 * @param {string} url - URL do conteúdo
 * @param {string} userId - ID do usuário que solicitou o download
 * @param {Function} callback - Função callback(error, result)
 */
async function downloadSocialMedia(url, userId, callback) {
  try {
    // Verifica se a URL é válida
    if (!url || typeof url !== 'string') {
      return callback(new Error('URL inválida'), null);
    }
    
    url = url.trim();
    
    // Verifica se é uma URL
    try {
      new URL(url);
    } catch (e) {
      return callback(new Error('URL inválida ou mal formatada'), null);
    }
    
    // Detecta a plataforma
    const platform = detectPlatform(url);
    if (!platform) {
      return callback(new Error('Plataforma não suportada ou URL não reconhecida'), null);
    }
    
    logger.info(`Baixando conteúdo de ${platform}: ${url}`);
    
    // Verifica se já existe no cache
    const cachedDownload = await smdCacheManager.getCachedDownload(url);
    if (cachedDownload) {
      logger.info(`Usando cache para URL: ${url}`);
      
      // Lê o conteúdo do arquivo de texto, se existir
      const textContent = await readTextFileContent(cachedDownload.files);
      
      // Filtra arquivos que não são de texto
      const mediaFiles = cachedDownload.files.filter(file => !file.toLowerCase().endsWith('.txt'));
      
      return callback(null, {
        platform: cachedDownload.platform,
        url: url,
        files: mediaFiles,
        textContent: textContent,
        fromCache: true
      });
    }
    
    // Executa o downloader
    const files = await executeSMD(url);
    logger.info(`Arquivos baixados: ${JSON.stringify(files)}`);
    
    // Armazena no cache
    await smdCacheManager.storeDownloadInfo(url, files, platform);
    
    // Lê o conteúdo do arquivo de texto, se existir
    const textContent = await readTextFileContent(files);
    
    // Filtra arquivos que não são de texto
    const mediaFiles = files.filter(file => !file.toLowerCase().endsWith('.txt'));
    
    // Retorna os resultados
    callback(null, {
      platform: platform,
      url: url,
      files: mediaFiles,
      textContent: textContent,
      fromCache: false
    });
    
  } catch (error) {
    logger.error(`Erro ao baixar conteúdo: ${error.message}`);
    callback(error, null);
  }
}

/**
 * Comando para baixar conteúdo de mídias sociais
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function downloadCommand(bot, message, args, group) {
  const chatId = message.group || message.author;
  const returnMessages = [];
  
  if (args.length === 0) {
    // Lista das plataformas suportadas
    const supportedPlatforms = [
      '📹 *YouTube*',
      '📱 *TikTok*',
      '📸 *Instagram*',
      '👥 *Facebook*',
      '🐦 *X (Twitter)*',
      '🎮 *Twitch*',
      '👻 *Snapchat*',
      '🔴 *Reddit*',
      '🎬 *Vimeo*',
      '🎥 *Streamable*',
      '📌 *Pinterest*',
      '👔 *LinkedIn*',
      '🌟 *BiliBili*'
    ];
    
    return new ReturnMessage({
      chatId: chatId,
      content: `*SocialMediaDownloader*\n\nBaixe vídeos e fotos das suas redes sociais favoritas!\n\nUso: !download [URL]\n\nPlataformas suportadas:\n${supportedPlatforms.join('\n')}\n\nVocê também pode usar atalhos para algumas plataformas:\n!insta, !tiktok, !x ou !twitter`
    });
  }
  
  const url = args.join(' ');
  
  // Envia mensagem de processamento
  bot.sendReturnMessages(new ReturnMessage({
    chatId: chatId,
    content: `🔄 Processando download da URL: ${url}\nEste processo pode levar alguns segundos...`
  }));
  
  return new Promise((resolve) => {
    downloadSocialMedia(url, message.author, async (error, result) => {
      if (error) {
        logger.error(`Erro ao baixar conteúdo: ${error.message}`);
        
        const errorMsg = new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao baixar conteúdo: ${error.message}`
        });
        
        await bot.sendReturnMessages(errorMsg);
        resolve(returnMessages);
        return;
      }
      
      try {
        // Prepara a legenda/mensagem de texto
        let caption = `*SocialMediaDownloader* - ${result.platform.charAt(0).toUpperCase() + result.platform.slice(1)}\nLink: ${result.url}`;
        
        if (result.fromCache) {
          caption += '\n(Conteúdo em cache)';
        }
        
        // Se há conteúdo de texto e apenas 1 arquivo de mídia, adiciona o texto na legenda
        if (result.textContent && result.files.length === 1) {
          caption += `\n\n${result.textContent}`;
        }
        
        // Envia os arquivos de mídia
        for (const filePath of result.files) {
          const media = await bot.createMedia(filePath);
          
          const mediaMsg = new ReturnMessage({
            chatId: chatId,
            content: media,
            options: {
              caption: caption
            }
          });
          
          // Limpa a legenda após o primeiro arquivo para não repetir
          caption = '';
          
          await bot.sendReturnMessages(mediaMsg);
        }
        
        // Se há conteúdo de texto e mais de 1 arquivo de mídia, envia o texto como mensagem separada
        if (result.textContent && result.files.length > 1) {
          const textMsg = new ReturnMessage({
            chatId: chatId,
            content: `*SocialMediaDownloader* - Descrição do conteúdo:\n\n${result.textContent}`
          });
          
          await bot.sendReturnMessages(textMsg);
        }
        
        // Se não houver arquivos de mídia, envia uma mensagem informativa
        if (result.files.length === 0) {
          const noMediaMsg = new ReturnMessage({
            chatId: chatId,
            content: `⚠️ Nenhum arquivo de mídia encontrado na URL: ${result.url}`
          });
          
          await bot.sendReturnMessages(noMediaMsg);
        }
        
        resolve(returnMessages);
      } catch (sendError) {
        logger.error(`Erro ao enviar mídia: ${sendError}`);
        
        const errorMsg = new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao enviar mídia: ${sendError.message}`
        });
        
        await bot.sendReturnMessages(errorMsg);
        resolve(returnMessages);
      }
    });
  });
}

// Comandos utilizando a classe Command
const commands = [
  new Command({
    name: 'download',
    caseSensitive: false,
    description: 'Baixa conteúdo de várias plataformas de mídia social',
    category: "downloaders",
    reactions: {
      before: "⏳",
      after: "✅",
      error: "❌"
    },
    method: downloadCommand
  }),
  
  new Command({
    name: 'insta',
    caseSensitive: false,
    description: 'Baixa conteúdo do Instagram',
    category: "downloaders",
    reactions: {
      before: "⏳",
      after: "✅",
      error: "❌"
    },
    method: downloadCommand
  }),
  
  new Command({
    name: 'tiktok',
    caseSensitive: false,
    description: 'Baixa conteúdo do TikTok',
    category: "downloaders",
    reactions: {
      before: "⏳",
      after: "✅",
      error: "❌"
    },
    method: downloadCommand
  }),
  
  new Command({
    name: 'x',
    caseSensitive: false,
    description: 'Baixa conteúdo do X (Twitter)',
    category: "downloaders",
    reactions: {
      before: "⏳",
      after: "✅",
      error: "❌"
    },
    method: downloadCommand
  }),
  
  new Command({
    name: 'twitter',
    caseSensitive: false,
    description: 'Baixa conteúdo do Twitter',
    category: "downloaders",
    reactions: {
      before: "⏳",
      after: "✅",
      error: "❌"
    },
    method: downloadCommand
  })
];

module.exports = { commands };