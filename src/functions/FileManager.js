const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('file-manager');
const database = Database.getInstance();

// Configurações de limites
const CONFIG = {
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_GROUP_STORAGE: 1 * 1024 * 1024 * 1024, // 1GB
  MAX_FILENAME_LENGTH: 10,
  MAX_FOLDER_DEPTH: 5,
  VALID_FILENAME_REGEX: /^[a-zA-Z0-9_]+$/
};

// Nome do banco de dados de arquivos
const FILES_DB_FILE = 'files-db.json';

//logger.info('Módulo FileManager carregado');

/**
 * Estrutura do banco de dados de arquivos:
 * {
 *   "chats": {
 *     "12345@g.us": {
 *       "totalSize": 12345,
 *       "files": {
 *         "pasta/arquivo.txt": {
 *           "path": "local/path/to/file.txt",
 *           "size": 1234,
 *           "name": "arquivo.txt",
 *           "type": "text/plain",
 *           "createdAt": 1234567890,
 *           "createdBy": "user@c.us",
 *           "isFolder": false
 *         },
 *         "pasta": {
 *           "isFolder": true,
 *           "createdAt": 1234567890,
 *           "createdBy": "user@c.us"
 *         }
 *       }
 *     }
 *   }
 * }
 */

/**
 * Carrega o banco de dados de arquivos
 * @returns {Promise<Object>} Banco de dados de arquivos
 */
async function loadFilesDB() {
  try {
    const db = await database.loadJSON(path.join(database.databasePath, FILES_DB_FILE));
    if (!db || !db.chats) {
      return { chats: {} };
    }
    return db;
  } catch (error) {
    logger.error('Erro ao carregar banco de dados de arquivos:', error);
    return { chats: {} };
  }
}

/**
 * Salva o banco de dados de arquivos
 * @param {Object} db Banco de dados de arquivos
 * @returns {Promise<boolean>} Status de sucesso
 */
async function saveFilesDB(db) {
  try {
    return await database.saveJSON(path.join(database.databasePath, FILES_DB_FILE), db);
  } catch (error) {
    logger.error('Erro ao salvar banco de dados de arquivos:', error);
    return false;
  }
}

/**
 * Inicializa o banco de dados para um chat
 * @param {Object} db Banco de dados de arquivos
 * @param {string} chatId ID do chat
 * @returns {Object} Banco de dados atualizado
 */
function initChatDB(db, chatId) {
  if (!db.chats[chatId]) {
    db.chats[chatId] = {
      totalSize: 0,
      files: {}
    };
  }
  return db;
}

/**
 * Obtém o caminho base para armazenar arquivos
 * @param {string} chatId ID do chat
 * @returns {string} Caminho base para arquivos
 */
function getBasePath(chatId) {
  return path.join(__dirname, '../../media', chatId, 'files');
}

/**
 * Normaliza um caminho de arquivo
 * @param {string} filePath Caminho de arquivo
 * @returns {string} Caminho normalizado
 */
function normalizePath(filePath) {
  // Remove barra inicial e final
  let normalized = filePath ? filePath.trim() : '';
  normalized = normalized.replace(/^[\/\\]+|[\/\\]+$/g, '');
  
  // Substitui barras invertidas por barras normais
  normalized = normalized.replace(/[\\]/g, '/');
  
  // Remove pontos duplos e barras duplicadas
  const parts = normalized.split('/').filter(p => p && p !== '.' && p !== '..');
  
  return parts.join('/');
}

/**
 * Valida um nome de arquivo
 * @param {string} filename Nome do arquivo
 * @returns {boolean} Se o nome é válido
 */
function isValidFilename(filename) {
  if (!filename || filename.length > CONFIG.MAX_FILENAME_LENGTH) {
    return false;
  }
  
  return CONFIG.VALID_FILENAME_REGEX.test(filename);
}

/**
 * Valida um caminho para profundidade máxima
 * @param {string} path Caminho a validar
 * @returns {boolean} Se o caminho é válido
 */
function isValidPath(path) {
  if (!path) return true;
  
  const parts = normalizePath(path).split('/');
  return parts.length <= CONFIG.MAX_FOLDER_DEPTH && parts.every(isValidFilename);
}

/**
 * Gera nome de arquivo único
 * @param {string} originalName Nome original do arquivo
 * @returns {string} Nome de arquivo único
 */
function generateUniqueFilename(originalName) {
  const basename = path.basename(originalName);
  const ext = path.extname(basename);
  let name = path.basename(basename, ext);
  
  // Garante que o nome seja válido
  name = name.replace(/[^a-zA-Z0-9_]/g, '');
  
  // Trunca se for muito longo
  if (name.length > CONFIG.MAX_FILENAME_LENGTH) {
    name = name.substring(0, CONFIG.MAX_FILENAME_LENGTH);
  }
  
  // Adiciona hash para unicidade
  const hash = crypto.randomBytes(2).toString('hex');
  
  // Se o nome estiver vazio, cria um nome genérico
  if (!name) {
    name = 'file';
  }
  
  return `${name}_${hash}${ext}`;
}

/**
 * Formata tamanho em bytes para exibição
 * @param {number} bytes Tamanho em bytes
 * @returns {string} Tamanho formatado
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

/**
 * Lista os arquivos e pastas de um chat
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com a lista de arquivos
 */
async function listFiles(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Carrega banco de dados
    let db = await loadFilesDB();
    db = initChatDB(db, chatId);
    
    // Obtém diretório a listar
    let targetDir = '';
    if (args.length > 0) {
      targetDir = normalizePath(args.join(' '));
    }
    
    // Verifica se o diretório existe (caso não seja a raiz)
    if (targetDir && !db.chats[chatId].files[targetDir]) {
      const exists = Object.keys(db.chats[chatId].files).some(key => 
        key.startsWith(`${targetDir}/`) || key === targetDir);
      
      if (!exists) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Pasta não encontrada: ${targetDir}`
        });
      }
    }
    
    // Obtém o nome do grupo ou autor para exibir no cabeçalho
    let chatName = "Chat";
    if (group) {
      chatName = group.name || "Grupo";
    } else {
      try {
        const contact = await bot.client.getContactById(message.author);
        chatName = contact.pushname || contact.name || "Contato";
      } catch (error) {
        logger.error('Erro ao obter nome de contato:', error);
      }
    }
    
    // Monta mensagem de listagem
    let messageContent = targetDir 
      ? `📂 *Conteúdo da pasta: ${targetDir}*\n_${chatName}_\n\n`
      : `📂 *Arquivos e Pastas*\n_${chatName}_\n\n`;
    
    // Adiciona pasta pai, se estiver em subpasta
    if (targetDir) {
      const parentDir = targetDir.split('/').slice(0, -1).join('/');
      messageContent += `📁 [..] (Pasta pai: ${parentDir || 'raiz'})\n\n`;
      
      // Modo específico: listar apenas o conteúdo da pasta alvo
      const fileEntries = [];
      const folderEntries = new Set();
      
      // Itera sobre todos os arquivos no banco de dados para encontrar conteúdo da pasta específica
      for (const [filePath, fileInfo] of Object.entries(db.chats[chatId].files)) {
        if (filePath === targetDir) {
          // É a própria pasta, ignora
          continue;
        } else if (filePath.startsWith(`${targetDir}/`)) {
          // Está dentro da pasta alvo
          const relativePath = filePath.substring(targetDir.length + 1);
          const parts = relativePath.split('/');
          
          if (parts.length === 1) {
            // Arquivo ou pasta diretamente na pasta alvo
            if (fileInfo.isFolder) {
              folderEntries.add(parts[0]);
            } else {
              fileEntries.push({
                name: parts[0],
                path: filePath,
                size: fileInfo.size || 0,
                isFolder: false
              });
            }
          } else {
            // Subpasta dentro da pasta alvo
            folderEntries.add(parts[0]);
          }
        }
      }
      
      // Converte conjuntos em arrays e ordena
      const folders = Array.from(folderEntries).sort();
      
      // Ordena arquivos por nome
      fileEntries.sort((a, b) => a.name.localeCompare(b.name));
      
      // Adiciona pastas
      if (folders.length > 0) {
        messageContent += '*Pastas:*\n';
        folders.forEach(folder => {
          messageContent += `📁 [${folder}]\n`;
        });
        messageContent += '\n';
      }
      
      // Adiciona arquivos
      if (fileEntries.length > 0) {
        messageContent += '*Arquivos:*\n';
        let totalSize = 0;
        
        fileEntries.forEach(file => {
          messageContent += `📄 ${file.name} (${formatSize(file.size)})\n`;
          totalSize += file.size;
        });
        
        messageContent += `\n*Total:* ${fileEntries.length} arquivo(s), ${formatSize(totalSize)}\n`;
      } else if (folders.length === 0) {
        // Adiciona mensagem quando não há arquivos nem pastas
        messageContent += '_Nenhum arquivo ou pasta encontrado._\n\n';
      }
    } else {
      // Modo retroativo: listar todos os arquivos e pastas organizados hierarquicamente
      
      // Coleta todas as pastas
      const allFolders = [];
      // Coleta todos os arquivos agrupados por pasta
      const filesByFolder = {};
      filesByFolder['raiz'] = [];
      let totalFileCount = 0;
      let totalSize = 0;
      
      // Organiza arquivos e pastas
      for (const [filePath, fileInfo] of Object.entries(db.chats[chatId].files)) {
        if (fileInfo.isFolder) {
          // Adiciona a pasta à lista de pastas
          allFolders.push(filePath);
        } else {
          // É um arquivo
          totalFileCount++;
          totalSize += fileInfo.size || 0;
          
          // Determina a pasta pai
          const lastSlashIndex = filePath.lastIndexOf('/');
          let folder = 'raiz';
          
          if (lastSlashIndex !== -1) {
            folder = filePath.substring(0, lastSlashIndex);
            // Garante que a pasta existe no objeto
            if (!filesByFolder[folder]) {
              filesByFolder[folder] = [];
            }
          }
          
          // Adiciona o arquivo à pasta apropriada
          filesByFolder[folder].push({
            name: filePath.substring(lastSlashIndex + 1),
            path: filePath,
            size: fileInfo.size || 0
          });
        }
      }
      
      // Ordena as pastas
      allFolders.sort();
      
      // Adiciona arquivos na raiz
      if (filesByFolder['raiz'].length > 0) {
        messageContent += '*Arquivos na raiz:*\n';
        filesByFolder['raiz'].sort((a, b) => a.name.localeCompare(b.name));
        
        filesByFolder['raiz'].forEach(file => {
          messageContent += `📄 ${file.name} (${formatSize(file.size)})\n`;
        });
        messageContent += '\n';
      }
      
      // Lista arquivos em cada pasta (recursivamente)
      messageContent += '*Arquivos em Pastas:*\n';
      
      // Função para gerar hierarquia visual
      function getHierarchyPrefix(depth) {
        let prefix = '';
        for (let i = 0; i < depth; i++) {
          prefix += '  ';
        }
        return prefix;
      }
      
      // Função para listar pastas recursivamente
      function listFoldersRecursively(currentPath, depth) {
        const foldersInPath = allFolders.filter(folder => {
          const parts = folder.split('/');
          return parts.length === depth + 1 && 
                (depth === 0 || folder.startsWith(currentPath + '/'));
        });
        
        foldersInPath.sort();
        
        for (const folder of foldersInPath) {
          const folderName = folder.split('/').pop();
          const prefix = getHierarchyPrefix(depth);
          
          // Adiciona a pasta
          messageContent += `${prefix}📁 [${folderName}]\n`;
          
          // Adiciona os arquivos nesta pasta
          if (filesByFolder[folder] && filesByFolder[folder].length > 0) {
            filesByFolder[folder].sort((a, b) => a.name.localeCompare(b.name));
            
            filesByFolder[folder].forEach(file => {
              messageContent += `${prefix}  └─ ${file.name} (${formatSize(file.size)})\n`;
            });
          }
          
          // Recursivamente lista subpastas
          listFoldersRecursively(folder, depth + 1);
        }
      }
      
      // Começa a listar a partir da raiz
      listFoldersRecursively('', 0);
      
      // Adiciona resumo de arquivos
      messageContent += `\n*Total:* ${totalFileCount} arquivo(s), ${formatSize(totalSize)}\n`;
      
      if (totalFileCount === 0 && allFolders.length === 0) {
        // Adiciona mensagem quando não há arquivos nem pastas
        messageContent += '_Nenhum arquivo ou pasta encontrado._\n\n';
      }
    }
    
    // Adiciona uso total
    messageContent += `\n*Espaço usado:* ${formatSize(db.chats[chatId].totalSize || 0)} de ${formatSize(CONFIG.MAX_GROUP_STORAGE)}`;
    
    // Adiciona texto de ajuda
    messageContent += `\n\n💡 Use *!pastas [nome_da_pasta]* para ver apenas o conteúdo de uma pasta específica.`;
    
    return new ReturnMessage({
      chatId: chatId,
      content: messageContent
    });
  } catch (error) {
    logger.error('Erro ao listar arquivos:', error);
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao listar arquivos. Por favor, tente novamente.'
    });
  }
}

/**
 * Baixa um arquivo ou pasta
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage|Array<ReturnMessage>>} - ReturnMessage ou array de ReturnMessages
 */
async function downloadFile(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    const returnMessages = [];
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça o caminho do arquivo ou pasta a ser baixado.'
      });
    }
    
    // Obtém caminho do arquivo/pasta
    const filePath = normalizePath(args.join(' '));
    
    // Carrega banco de dados
    let db = await loadFilesDB();
    db = initChatDB(db, chatId);
    
    // Verifica se o arquivo/pasta existe
    if (!db.chats[chatId].files[filePath]) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Arquivo ou pasta não encontrado: ${filePath}`
      });
    }
    
    const fileInfo = db.chats[chatId].files[filePath];
    const isFolder = fileInfo.isFolder;
    
    if (isFolder) {
      // Busca todos os arquivos na pasta
      const filesInFolder = Object.entries(db.chats[chatId].files)
        .filter(([path, info]) => !info.isFolder && path.startsWith(`${filePath}/`))
        .map(([path, info]) => ({ path, info }));
      
      if (filesInFolder.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ A pasta está vazia: ${filePath}`
        });
      }
      
      // Informa quantos arquivos serão enviados
      returnMessages.push(
        new ReturnMessage({
          chatId: chatId,
          content: `📤 Enviando ${filesInFolder.length} arquivo(s) da pasta: ${filePath}`
        })
      );
      
      // Envia até 5 arquivos para evitar spam e bloqueio
      const maxFiles = Math.min(5, filesInFolder.length);
      for (let i = 0; i < maxFiles; i++) {
        const { path: folderFilePath, info } = filesInFolder[i];
        
        try {
          // Caminho do arquivo físico
          const physicalPath = info.path || path.join(getBasePath(chatId), folderFilePath);
          
          // Lê o arquivo
          const fileBuffer = await fs.readFile(physicalPath);
          
          // Cria mídia
          const media = new MessageMedia(
            info.type || 'application/octet-stream',
            fileBuffer.toString('base64'),
            path.basename(folderFilePath)
          );
          
          // Adiciona mensagem com o arquivo ao array de retorno
          returnMessages.push(
            new ReturnMessage({
              chatId: chatId,
              content: media,
              options: {
                caption: `Arquivo: ${folderFilePath} (${formatSize(info.size || fileBuffer.length)})`
              }
            })
          );
        } catch (error) {
          logger.error(`Erro ao enviar arquivo: ${folderFilePath}`, error);
          returnMessages.push(
            new ReturnMessage({
              chatId: chatId,
              content: `⚠️ Erro ao enviar arquivo: ${folderFilePath}`
            })
          );
        }
      }
      
      // Avisa se existem mais arquivos
      if (filesInFolder.length > maxFiles) {
        returnMessages.push(
          new ReturnMessage({
            chatId: chatId,
            content: `⚠️ Só foram enviados ${maxFiles} de ${filesInFolder.length} arquivos para evitar spam. Use comandos específicos para baixar os demais.`
          })
        );
      }
    } else {
      // Baixa um único arquivo
      try {
        // Caminho do arquivo físico
        const physicalPath = fileInfo.path || path.join(getBasePath(chatId), filePath);
        
        // Lê o arquivo
        const fileBuffer = await fs.readFile(physicalPath);
        
        // Cria mídia
        const media = new MessageMedia(
          fileInfo.type || 'application/octet-stream',
          fileBuffer.toString('base64'),
          path.basename(filePath)
        );
        
        // Retorna a mídia em uma ReturnMessage
        return new ReturnMessage({
          chatId: chatId,
          content: media,
          options: {
            caption: `Arquivo: ${filePath} (${formatSize(fileInfo.size || fileBuffer.length)})`
          }
        });
      } catch (error) {
        logger.error(`Erro ao enviar arquivo: ${filePath}`, error);
        return new ReturnMessage({
          chatId: chatId,
          content: `⚠️ Erro ao enviar arquivo: ${filePath}`
        });
      }
    }
    
    return returnMessages;
  } catch (error) {
    logger.error('Erro ao baixar arquivo/pasta:', error);
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao baixar arquivo/pasta. Por favor, tente novamente.'
    });
  }
}

/**
 * Cria uma nova pasta
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com o resultado
 */
async function createFolder(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça o nome da pasta a ser criada.'
      });
    }
    
    // Obtém caminho da pasta
    const folderPath = normalizePath(args.join(' '));
    
    // Valida o caminho
    if (!isValidPath(folderPath)) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Caminho inválido. Certifique-se de que:
- Cada pasta tenha no máximo ${CONFIG.MAX_FILENAME_LENGTH} caracteres
- Use apenas letras, números e underscore (_)
- A profundidade máxima é de ${CONFIG.MAX_FOLDER_DEPTH} níveis`
      });
    }
    
    // Carrega banco de dados
    let db = await loadFilesDB();
    db = initChatDB(db, chatId);
    
    // Verifica se a pasta já existe
    if (db.chats[chatId].files[folderPath]) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Já existe um arquivo ou pasta com o nome: ${folderPath}`
      });
    }
    
    // Verifica se as pastas pai existem
    const parts = folderPath.split('/');
    if (parts.length > 1) {
      const parentPath = parts.slice(0, -1).join('/');
      if (!db.chats[chatId].files[parentPath] && !db.chats[chatId].files[parentPath]?.isFolder) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Pasta pai não existe: ${parentPath}`
        });
      }
    }
    
    // Cria pasta no sistema de arquivos
    const physicalBasePath = getBasePath(chatId);
    const physicalPath = path.join(physicalBasePath, folderPath);
    
    await fs.mkdir(physicalPath, { recursive: true });
    
    // Adiciona pasta ao banco de dados
    db.chats[chatId].files[folderPath] = {
      isFolder: true,
      createdAt: Date.now(),
      createdBy: message.author
    };
    
    // Salva banco de dados
    await saveFilesDB(db);
    
    return new ReturnMessage({
      chatId: chatId,
      content: `✅ Pasta criada com sucesso: ${folderPath}`
    });
  } catch (error) {
    logger.error('Erro ao criar pasta:', error);
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao criar pasta. Por favor, tente novamente.'
    });
  }
}

/**
 * Envia um arquivo para uma pasta
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com o resultado
 */
async function uploadFile(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Obtém caminho de destino (pode ser vazio para a raiz)
    let destination = '';
    if (args.length > 0) {
      destination = normalizePath(args.join(' '));
    }
    
    // Valida o caminho se não for a raiz
    if (destination && !isValidPath(destination)) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Caminho inválido. Certifique-se de que:
- Cada pasta tenha no máximo ${CONFIG.MAX_FILENAME_LENGTH} caracteres
- Use apenas letras, números e underscore (_)
- A profundidade máxima é de ${CONFIG.MAX_FOLDER_DEPTH} níveis`
      });
    }
    
    // Obtém mensagem citada com mídia
    const quotedMsg = await message.origin.getQuotedMessage();
    if (!quotedMsg || !quotedMsg.hasMedia) {
      return new ReturnMessage({
        chatId: chatId,
        content: '❌ Por favor, mencione uma mensagem com arquivo.'
      });
    }
    
    // Baixa a mídia
    const media = await quotedMsg.downloadMedia();
    if (!media || !media.data) {
      return new ReturnMessage({
        chatId: chatId,
        content: '❌ Não foi possível baixar o arquivo.'
      });
    }
    
    // Verifica o tamanho do arquivo
    const fileBuffer = Buffer.from(media.data, 'base64');
    const fileSize = fileBuffer.length;
    
    if (fileSize > CONFIG.MAX_FILE_SIZE) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ O arquivo excede o tamanho máximo permitido (${formatSize(CONFIG.MAX_FILE_SIZE)}).`
      });
    }
    
    // Carrega banco de dados
    let db = await loadFilesDB();
    db = initChatDB(db, chatId);
    
    // Verifica espaço disponível
    const currentSize = db.chats[chatId].totalSize || 0;
    if (currentSize + fileSize > CONFIG.MAX_GROUP_STORAGE) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Espaço insuficiente. Usado: ${formatSize(currentSize)}, Disponível: ${formatSize(CONFIG.MAX_GROUP_STORAGE - currentSize)}, Necessário: ${formatSize(fileSize)}`
      });
    }
    
    // Obtém nome de arquivo
    let targetPath = destination;
    let fileName = '';
    
    // Se o destino já é um arquivo (tem extensão), usa como nome de arquivo
    if (path.extname(destination)) {
      const parts = destination.split('/');
      fileName = parts.pop();
      targetPath = parts.join('/');
    } else {
      // Usa o nome original do arquivo ou gera um nome
      if (media.filename) {
        fileName = generateUniqueFilename(media.filename);
      } else {
        // Determina extensão a partir do mimetype
        let ext = '.bin';
        if (media.mimetype) {
          const mimeExt = media.mimetype.split('/')[1];
          if (mimeExt) {
            ext = `.${mimeExt}`;
          }
        }
        fileName = generateUniqueFilename(`file${ext}`);
      }
    }
    
    // Verifica se a pasta de destino existe (se não for a raiz)
    if (targetPath) {
      if (!db.chats[chatId].files[targetPath] || !db.chats[chatId].files[targetPath].isFolder) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Pasta de destino não existe: ${targetPath}`
        });
      }
    }
    
    // Caminho completo para o arquivo no banco de dados
    const dbFilePath = targetPath ? `${targetPath}/${fileName}` : fileName;
    
    // Verifica se o arquivo já existe
    if (db.chats[chatId].files[dbFilePath]) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Já existe um arquivo com este nome: ${dbFilePath}`
      });
    }
    
    // Caminho físico para salvar o arquivo
    const physicalBasePath = getBasePath(chatId);
    const targetFolder = path.join(physicalBasePath, targetPath);
    const physicalFilePath = path.join(targetFolder, fileName);
    
    // Garante que a pasta exista
    await fs.mkdir(targetFolder, { recursive: true });
    
    // Salva o arquivo
    await fs.writeFile(physicalFilePath, fileBuffer);
    
    // Atualiza o banco de dados
    db.chats[chatId].files[dbFilePath] = {
      path: physicalFilePath,
      size: fileSize,
      name: fileName,
      type: media.mimetype || 'application/octet-stream',
      createdAt: Date.now(),
      createdBy: message.author,
      isFolder: false
    };
    
    // Atualiza tamanho total
    db.chats[chatId].totalSize = (db.chats[chatId].totalSize || 0) + fileSize;
    
    // Salva banco de dados
    await saveFilesDB(db);
    
    const displayPath = targetPath ? `${targetPath}/${fileName}` : fileName;
    
    // Prepara comandos para exibição ao usuário
    const downloadCommand = `!p-baixar ${displayPath}`;
    const fileVariable = `{file-${displayPath}}`;
    
    // Retorna mensagem de sucesso com comandos
    return new ReturnMessage({
      chatId: chatId,
      content: `✅ Arquivo salvo com sucesso: ${displayPath} (${formatSize(fileSize)})\n\n` +
               `📥 *Para baixar:* \`${downloadCommand}\`\n` +
               `🔗 *Para usar em comandos:* \`${fileVariable}\``
    });
  } catch (error) {
    logger.error('Erro ao enviar arquivo:', error);
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao enviar arquivo. Por favor, tente novamente.'
    });
  }
}

/**
 * Apaga um arquivo ou pasta
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com o resultado
 */
async function deleteFile(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça o caminho do arquivo ou pasta a ser excluído.'
      });
    }
    
    // Obtém caminho do arquivo/pasta
    const filePath = normalizePath(args.join(' '));
    
    // Carrega banco de dados
    let db = await loadFilesDB();
    db = initChatDB(db, chatId);
    
    // Verifica se o arquivo/pasta existe
    if (!db.chats[chatId].files[filePath]) {
      return new ReturnMessage({
        chatId: chatId,
        content: `❌ Arquivo ou pasta não encontrado: ${filePath}`
      });
    }
    
    const fileInfo = db.chats[chatId].files[filePath];
    const isFolder = fileInfo.isFolder;
    
    if (isFolder) {
      // Verifica se a pasta está vazia
      const hasChildren = Object.keys(db.chats[chatId].files).some(path => 
        path !== filePath && path.startsWith(`${filePath}/`));
      
      if (hasChildren) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ A pasta não está vazia: ${filePath}. Remova seus arquivos primeiro.`
        });
      }
      
      // Exclui a pasta fisicamente
      const physicalPath = path.join(getBasePath(chatId), filePath);
      try {
        await fs.rmdir(physicalPath);
      } catch (error) {
        logger.error(`Erro ao excluir pasta física: ${physicalPath}`, error);
        // Continua mesmo se falhar a exclusão física
      }
      
      // Remove do banco de dados
      delete db.chats[chatId].files[filePath];
      
      // Salva banco de dados
      await saveFilesDB(db);
      
      return new ReturnMessage({
        chatId: chatId,
        content: `✅ Pasta excluída com sucesso: ${filePath}`
      });
    } else {
      // Arquivo - Recupera tamanho
      const fileSize = fileInfo.size || 0;
      
      // Exclui o arquivo fisicamente
      try {
        if (fileInfo.path) {
          await fs.unlink(fileInfo.path);
        } else {
          const physicalPath = path.join(getBasePath(chatId), filePath);
          await fs.unlink(physicalPath);
        }
      } catch (error) {
        logger.error(`Erro ao excluir arquivo físico: ${fileInfo.path || filePath}`, error);
        // Continua mesmo se falhar a exclusão física
      }
      
      // Remove do banco de dados
      delete db.chats[chatId].files[filePath];
      
      // Atualiza tamanho total
      db.chats[chatId].totalSize = Math.max(0, (db.chats[chatId].totalSize || 0) - fileSize);
      
      // Salva banco de dados
      await saveFilesDB(db);
      
      return new ReturnMessage({
        chatId: chatId,
        content: `✅ Arquivo excluído com sucesso: ${filePath} (${formatSize(fileSize)})`
      });
    }
  } catch (error) {
    logger.error('Erro ao excluir arquivo/pasta:', error);
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao excluir arquivo/pasta. Por favor, tente novamente.'
    });
  }
}

/**
 * Processa variável de arquivo para comandos personalizados
 * @param {string} filePath Caminho do arquivo no formato {file-path/to/file.ext} ou {file-path/to/folder}
 * @param {WhatsAppBot} bot Instância do bot
 * @param {string} chatId ID do chat
 * @returns {Promise<MessageMedia|Array<MessageMedia>|null>} Objeto de mídia, array de objetos de mídia, ou null
 */
async function processFileVariable(filePath, bot, chatId) {
  try {
    // Extrai caminho do arquivo da variável {file-path/to/file.ext} ou {file-path/to/folder}
    const filePathMatch = filePath.match(/^\{file-(.*?)\}$/);
    if (!filePathMatch) return null;
    
    const normalizedPath = normalizePath(filePathMatch[1]);
    
    // Carrega banco de dados
    let db = await loadFilesDB();
    db = initChatDB(db, chatId);
    
    // Verifica se o caminho existe
    const fileInfo = db.chats[chatId].files[normalizedPath];
    if (!fileInfo) return null;
    
    // Verifica se é uma pasta
    if (fileInfo.isFolder) {
      // Busca todos os arquivos na pasta
      const filesInFolder = Object.entries(db.chats[chatId].files)
        .filter(([path, info]) => !info.isFolder && path.startsWith(`${normalizedPath}/`))
        .map(([path, info]) => ({ path, info }));
      
      if (filesInFolder.length === 0) {
        logger.warn(`Pasta vazia: ${normalizedPath}`);
        return null;
      }
      
      // Limita a 5 arquivos para evitar sobrecarga
      const maxFiles = Math.min(5, filesInFolder.length);
      const mediaFiles = [];
      
      for (let i = 0; i < maxFiles; i++) {
        const { path: filePath, info } = filesInFolder[i];
        
        try {
          // Caminho do arquivo físico
          const physicalPath = info.path || path.join(getBasePath(chatId), filePath);
          
          // Lê o arquivo
          const fileBuffer = await fs.readFile(physicalPath);
          
          // Cria mídia
          const media = new MessageMedia(
            info.type || 'application/octet-stream',
            fileBuffer.toString('base64'),
            path.basename(filePath)
          );
          
          mediaFiles.push({
            media,
            caption: `Arquivo: ${filePath} (${formatSize(info.size || fileBuffer.length)})`
          });
        } catch (error) {
          logger.error(`Erro ao processar arquivo na pasta: ${filePath}`, error);
        }
      }
      
      if (mediaFiles.length > 0) {
        // Retorna o array de arquivos de mídia
        return mediaFiles;
      }
      return null;
    } else {
      // É um arquivo único
      try {
        // Caminho do arquivo físico
        const physicalPath = fileInfo.path || path.join(getBasePath(chatId), normalizedPath);
        
        // Lê o arquivo
        const fileBuffer = await fs.readFile(physicalPath);
        
        // Cria mídia
        return new MessageMedia(
          fileInfo.type || 'application/octet-stream',
          fileBuffer.toString('base64'),
          path.basename(normalizedPath)
        );
      } catch (error) {
        logger.error(`Erro ao processar variável de arquivo: ${normalizedPath}`, error);
        return null;
      }
    }
  } catch (error) {
    logger.error('Erro ao processar variável de arquivo:', error);
    return null;
  }
}

// Garante que o diretório base existe ao carregar
(async () => {
  try {
    // Carrega banco de dados
    const db = await loadFilesDB();
    
    // Para cada chat, garante que o diretório base existe
    for (const chatId in db.chats) {
      const basePath = getBasePath(chatId);
      await fs.mkdir(basePath, { recursive: true });
    }
  } catch (error) {
    logger.error('Erro ao inicializar diretórios de arquivo:', error);
  }
})();

// Lista de comandos usando a classe Command
const commands = [
  new Command({
    name: 'pastas',
    category: "arquivos",
    description: 'Lista as pastas e arquivos criadas no grupo/chat',
    reactions: {
      before: "⏳",
      after: "📂"
    },
    method: listFiles
  }),
  
  new Command({
    name: 'p-criar',
    description: 'Cria nova pasta',
    category: "arquivos",
    reactions: {
      before: "⏳",
      after: "📁"
    },
    method: createFolder
  }),
  
  new Command({
    name: 'p-enviar',
    description: 'Envia arquivo para a pasta destino',
    category: "arquivos",
    reactions: {
      before: "⏳",
      after: "📤"
    },
    method: uploadFile
  }),
  
  new Command({
    name: 'p-excluir',
    description: 'Apaga arquivo ou pasta',
    category: "arquivos",
    reactions: {
      before: "⏳",
      after: "🗑️"
    },
    method: deleteFile
  }),
  
  new Command({
    name: 'p-baixar',
    description: 'Baixa arquivo ou pasta',
    category: "arquivos",
    reactions: {
      before: "⏳",
      after: "📥"
    },
    method: downloadFile
  })
];

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { 
  commands,
  processFileVariable 
};