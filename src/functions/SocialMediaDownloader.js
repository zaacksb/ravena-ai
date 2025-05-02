const path = require('path');
const { exec } = require('child_process');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');
const Database = require('../utils/Database');
const crypto = require('crypto');
const youtubedl = require('youtube-dl-exec');

const logger = new Logger('social-media-downloader');
const database = Database.getInstance();

// Sistema de cache para o SocialMediaDownloader
class SMDCacheManager {
  constructor(databasePath) {
    this.cachePath = path.join(databasePath, "smd-cache.json");
  }

  /**
   * Obtém o timestamp atual no formato legível
   * @returns {string} Timestamp formatado
   */
  getTimestamp() {
    const tzoffset = (new Date()).getTimezoneOffset() * 60000; // Offset em milissegundos
    const localISOTime = (new Date(Date.now() - tzoffset)).toISOString().replace(/T/, ' ').replace(/\..+/, '');
    return localISOTime;
  }

  /**
   * Lê o arquivo de cache, criando-o se não existir
   * @returns {Promise<Object>} Objeto de cache parseado
   */
  async _readCache() {
    try {
      const cacheContent = await fs.readFile(this.cachePath, 'utf8');
      return JSON.parse(cacheContent);
    } catch (error) {
      // Se o arquivo não existe ou não pode ser lido, retorna um cache vazio
      logger.error(`[_readCache] Erro, reiniciando cache.`);
      await this._writeCache({});
      return {};
    }
  }

  /**
   * Escreve o cache inteiro no arquivo
   * @param {Object} cache - O objeto de cache a ser escrito
   */
  async _writeCache(cache) {
    try {
      await fs.writeFile(this.cachePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
      logger.error('Erro ao escrever cache:', error);
      throw error;
    }
  }

  /**
   * Verifica se um arquivo existe
   * @param {string} filePath - Caminho do arquivo
   * @returns {Promise<boolean>} Verdadeiro se o arquivo existir
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Armazena informações de download no cache
   * @param {string} url - URL do conteúdo baixado
   * @param {Array<string>} filePaths - Caminhos dos arquivos baixados
   * @param {string} platform - Plataforma de origem (instagram, tiktok, etc)
   */
  async storeDownloadInfo(url, filePaths, platform) {
    const cache = await this._readCache();
    
    // Normaliza a URL como chave do cache
    const normalizedUrl = url.trim().toLowerCase();
    
    // Armazena os dados no cache
    cache[normalizedUrl] = {
      url: url,
      platform: platform,
      files: filePaths,
      timestamp: this.getTimestamp(),
      ts: Math.round(+new Date()/1000)
    };
    
    // Salva o cache atualizado
    await this._writeCache(cache);
  }

  /**
   * Verifica se o conteúdo da URL já foi baixado e ainda existe
   * @param {string} url - URL do conteúdo
   * @returns {Promise<Object|null>} Informações do cache ou null se não existe
   */
  async getCachedDownload(url) {
    const cache = await this._readCache();
    const normalizedUrl = url.trim().toLowerCase();
    
    if (!cache[normalizedUrl]) {
      return null;
    }
    
    const cacheEntry = cache[normalizedUrl];
    
    // Verifica se todos os arquivos ainda existem
    if (cacheEntry.files && Array.isArray(cacheEntry.files)) {
      for (const filePath of cacheEntry.files) {
        const fileStillExists = await this.fileExists(filePath);
        if (!fileStillExists) {
          // Se algum arquivo não existir, considera o cache inválido
          logger.info(`[getCachedDownload] Arquivo em cache não encontrado: ${filePath}`);
          return null;
        }
      }
      
      // Todos os arquivos existem, retorna a entrada do cache
      logger.info(`[getCachedDownload] Cache encontrado para: ${url}`);
      return {
        files: cacheEntry.files,
        platform: cacheEntry.platform,
        fromCache: true
      };
    }
    
    return null;
  }
}

// Inicializa o cache manager
const smdCacheManager = new SMDCacheManager(database.databasePath);

/**
 * Detecta a plataforma da URL
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
 * Download genérico usando youtube-dl-exec
 * @param {string} url - URL do conteúdo
 * @param {string} platform - Plataforma identificada
 * @returns {Promise<Array<string>>} - Array com caminhos dos arquivos baixados
 */
async function downloadWithYoutubeDL(url, platform) {
  // Gera um nome temporário para o arquivo
  const hash = crypto.randomBytes(2).toString('hex');
  const tempName = `smd-${platform}-${hash}`;
  const outputPath = path.join(process.env.DL_FOLDER, `${tempName}.%(ext)s`);
  
  try {
    logger.info(`Baixando de ${platform}: ${url}`);
    
    const options = {
      o: outputPath,
      f: "best",
      cookies: path.join(database.databasePath, "smd_cookies.txt"),
      ffmpegLocation: process.env.FFMPEG_PATH,
    };
    
    // Para outros sites, ajusta as opções conforme necessário
    if (platform === 'tiktok') {
      options.f = "(bestvideo+bestaudio/best)[filesize<55M]";
    } else if (['facebook', 'twitter', 'x'].includes(platform)) {
      options.f = "(bestvideo+bestaudio/best)[filesize<55M]";
    }
    
    const result = await youtubedl(url, options);
    logger.info(`Download concluído: ${result}`);
    
    // Busca arquivos baixados na pasta de destino
    const dlFolder = process.env.DL_FOLDER;
    const files = await fs.readdir(dlFolder);
    const downloadedFiles = files
      .filter(file => file.startsWith(`smd-${platform}-${hash}`))
      .map(file => path.join(dlFolder, file));
    
    return downloadedFiles;
  } catch (error) {
    logger.error(`Erro ao baixar com youtube-dl: ${error.message}`);
    throw error;
  }
}

/**
 * Download de conteúdo do Instagram usando instaloader
 * @param {string} url - URL do Instagram
 * @returns {Promise<Array<string>>} - Array com caminhos dos arquivos baixados
 */
async function downloadInstagram(url) {
  try {
    // Extrai o shortcode da URL
    let shortcode = '';
    if (url.includes('/p/')) {
      shortcode = url.split('/p/')[1].split('/')[0];
    } else if (url.includes('/reel/')) {
      shortcode = url.split('/reel/')[1].split('/')[0];
    } else {
      // Tenta extrair de qualquer URL
      const segments = url.split('/').filter(s => s.length > 0);
      shortcode = segments[segments.length - 1] || segments[segments.length - 2];
    }
    
    if (!shortcode) {
      throw new Error('Não foi possível extrair o ID da postagem do Instagram');
    }
    
    logger.info(`Baixando postagem do Instagram ${shortcode}`);
    
    // Pasta temporária para download
    const hash = crypto.randomBytes(2).toString('hex');
    const tempFolder = path.join(process.env.DL_FOLDER, `insta-${hash}`);
    await fs.mkdir(tempFolder, { recursive: true });
    
    // Constrói o comando instaloader
    let instaloaderCmd = `"${process.env.INSTALOADER_PATH}" --dirname-pattern "${tempFolder}" --no-video-thumbnails --no-metadata-json --no-captions`;
    
    // Adiciona login se disponível
    if (process.env.INSTA_SESSION) {
      instaloaderCmd += ` --login "${process.env.INSTA_SESSION}"`;
    }
    
    // Adiciona o shortcode
    instaloaderCmd += ` -- -p ${shortcode}`;
    
    logger.info(`Executando comando: ${instaloaderCmd}`);
    
    // Executa o instaloader
    return new Promise((resolve, reject) => {
      exec(instaloaderCmd, async (error, stdout, stderr) => {
        if (error) {
          logger.error(`Erro ao executar instaloader: ${error.message}`);
          return reject(error);
        }
        
        // Lista arquivos da pasta temporária
        try {
          const files = await fs.readdir(tempFolder);
          const downloadedFiles = files.map(file => path.join(tempFolder, file));
          
          logger.info(`Arquivos baixados do Instagram: ${JSON.stringify(downloadedFiles)}`);
          resolve(downloadedFiles);
        } catch (fsError) {
          logger.error(`Erro ao listar arquivos baixados: ${fsError.message}`);
          reject(fsError);
        }
      });
    });
  } catch (error) {
    logger.error(`Erro ao baixar do Instagram: ${error.message}`);
    throw error;
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
    
    // Redireciona para o YouTube Downloader para links do YouTube
    if (platform === 'youtube') {
      return callback(new Error('Para baixar vídeos do YouTube, use o comando !yt'), null);
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
    
    // Baixa o conteúdo dependendo da plataforma
    let files = [];
    
    if (platform === 'instagram') {
      files = await downloadInstagram(url);
    } else {
      files = await downloadWithYoutubeDL(url, platform);
    }
    
    logger.info(`Arquivos baixados: ${JSON.stringify(files)}`);
    
    // Verifica se baixou algum arquivo
    if (!files || files.length === 0) {
      return callback(new Error('Não foi possível baixar nenhum arquivo da URL fornecida'), null);
    }
    
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
      '📹 *YouTube* (use !yt)',
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

//module.exports = { commands };