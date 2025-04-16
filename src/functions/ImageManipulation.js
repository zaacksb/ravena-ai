const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { exec } = require('child_process');
const sharp = require('sharp');
const { v4: uuidv4 } = require('uuid');
const imagemagick = require('imagemagick');
const util = require('util');
const Logger = require('../utils/Logger');

const execPromise = util.promisify(exec);
const logger = new Logger('image-commands');

// Encapsule os comandos do imagemagick em promessas
const convertPromise = util.promisify(imagemagick.convert);
const identifyPromise = util.promisify(imagemagick.identify);

// Diretório temporário para processamento
const tempDir = path.join(os.tmpdir(), 'whatsapp-bot-images');

// Garante que o diretório temporário exista
fs.mkdir(tempDir, { recursive: true })
  .then(() => {
    logger.info(`Diretório temporário criado: ${tempDir}`);
  })
  .catch(error => {
    logger.error('Erro ao criar diretório temporário:', error);
  });

// Auxiliar para obter mídia da mensagem
function getMediaFromMessage(message) {
  return new Promise((resolve, reject) => {
    // Se a mensagem tem mídia direta
    if (message.type !== 'text') {
      resolve(message.content);
      return;
    }
    
    // Tenta obter mídia da mensagem citada
    message.origin.getQuotedMessage()
      .then(quotedMsg => {
        if (quotedMsg && quotedMsg.hasMedia) {
          return quotedMsg.downloadMedia();
        }
        resolve(null);
      })
      .then(media => {
        if (media) resolve(media);
      })
      .catch(error => {
        logger.error('Erro ao obter mídia da mensagem citada:', error);
        resolve(null);
      });
  });
}

// Auxiliar para salvar mídia em arquivo temporário
function saveMediaToTemp(media, extension = 'png') {
  const filename = `${uuidv4()}.${extension}`;
  const filepath = path.join(tempDir, filename);
  
  return fs.writeFile(filepath, Buffer.from(media.data, 'base64'))
    .then(() => filepath)
    .catch(error => {
      logger.error('Erro ao salvar mídia em arquivo temporário:', error);
      throw error;
    });
}

// Auxiliar para remover fundo usando rembg
function removeBackground(inputPath) {
  const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '_nobg.png';
  
  // Executa rembg usando Python com Promise
  return execPromise(`rembg i "${inputPath}" "${outputPath}"`)
    .then(() => outputPath)
    .catch(error => {
      logger.error('Erro ao remover fundo:', error);
      throw error;
    });
}

// Auxiliar para recortar imagem usando sharp
function trimImage(inputPath) {
  const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '_trimmed.png';
  
  return sharp(inputPath)
    .trim()
    .toFile(outputPath)
    .then(() => outputPath)
    .catch(error => {
      logger.error('Erro ao recortar imagem:', error);
      throw error;
    });
}

// Auxiliar para aplicar distorção usando ImageMagick
function distortImage(inputPath, intensity = 50) {
  // Limita intensidade entre 30 e 70
  intensity = Math.max(30, Math.min(70, intensity));
  
  const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '_distorted.png';
  
  // Aplica efeito de redimensionamento líquido
  return convertPromise([
    inputPath,
    '-liquid-rescale', `${intensity}x${intensity}%!`,
    '-resize', '200%',
    outputPath
  ])
    .then(() => outputPath)
    .catch(error => {
      logger.error('Erro ao distorcer imagem:', error);
      throw error;
    });
}

// Auxiliar para aplicar efeitos artísticos usando ImageMagick
function applyArtistic(inputPath, effect) {
  const outputPath = inputPath.replace(/\.[^/.]+$/, '') + `_${effect}.png`;
  
  let convertArgs;
  
  switch (effect) {
    case 'sketch':
      convertArgs = [
        inputPath,
        '-colorspace', 'gray',
        '-sketch', '0x20+120',
        outputPath
      ];
      break;
    
    case 'oil':
      convertArgs = [
        inputPath,
        '-paint', '6',
        outputPath
      ];
      break;
    
    case 'neon':
      convertArgs = [
        inputPath,
        '-negate',
        '-edge', '2',
        '-negate',
        '-normalize',
        '-channel', 'RGB',
        '-blur', '0x.5',
        '-colorspace', 'sRGB',
        outputPath
      ];
      break;
      
    case 'pixelate':
      convertArgs = [
        inputPath,
        '-scale', '10%',
        '-scale', '1000%',
        outputPath
      ];
      break;
    
    default:
      return Promise.reject(new Error(`Efeito desconhecido: ${effect}`));
  }
  
  return convertPromise(convertArgs)
    .then(() => outputPath)
    .catch(error => {
      logger.error(`Erro ao aplicar efeito ${effect}:`, error);
      throw error;
    });
}

// Limpa arquivos temporários
function cleanupTempFiles(files) {
  return Promise.all(
    files.map(file => 
      fs.unlink(file).catch(error => {
        logger.error(`Erro ao excluir arquivo temporário ${file}:`, error);
      })
    )
  );
}

// Implementações de comandos
const commands = [
  {
    name: 'removebg',
    description: 'Remove o fundo de uma imagem',
    needsMedia: true,
    reactions: {
      before: "📸",
      after: "✨",
      error: "❌"
    },
    method: (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      // Cadeia de promessas sem bloqueio
      getMediaFromMessage(message)
        .then(media => {
          if (!media) {
            return bot.sendMessage(chatId, 'Por favor, forneça uma imagem ou responda a uma imagem com este comando.')
              .then(() => {
                // Aplica reação de erro
                try {
                  message.origin.react("❌");
                } catch (reactError) {
                  logger.error('Erro ao aplicar reação de erro:', reactError);
                }
                throw new Error('Nenhuma mídia fornecida');
              });
          }
          return media;
        })
        .then(media => saveMediaToTemp(media))
        .then(inputPath => {
          logger.debug(`Imagem de entrada salva em ${inputPath}`);
          
          // Armazena caminhos para limpeza
          const filePaths = [inputPath];
          
          // Processa imagem com cadeia de promessas
          return removeBackground(inputPath)
            .then(noBgPath => {
              logger.debug(`Fundo removido, salvo em ${noBgPath}`);
              filePaths.push(noBgPath);
              return trimImage(noBgPath);
            })
            .then(trimmedPath => {
              logger.debug(`Imagem recortada, salva em ${trimmedPath}`);
              filePaths.push(trimmedPath);
              return { trimmedPath, filePaths };
            });
        })
        .then(({ trimmedPath, filePaths }) => {
          return bot.createMedia(trimmedPath)
            .then(resultMedia => {
              return bot.sendMessage(chatId, resultMedia, {
                caption: 'Fundo removido e salvo como arquivo',
                sendMediaAsDocument: true, // Envia como arquivo em vez de imagem
                quotedMessageId: message.origin.id._serialized
              })
              .then(() => filePaths);
            });
        })
        .then(filePaths => {
          // Limpa arquivos após envio
          return cleanupTempFiles(filePaths);
        })
        .catch(error => {
          if (error.message !== 'Nenhuma mídia fornecida') {
            logger.error('Erro no comando removebg:', error);
            bot.sendMessage(chatId, 'Erro ao processar imagem. Certifique-se de que a imagem é válida e tente novamente.')
              .catch(sendError => {
                logger.error('Erro ao enviar mensagem de erro:', sendError);
              });
            
            // Aplica reação de erro
            try {
              message.origin.react("❌");
            } catch (reactError) {
              logger.error('Erro ao aplicar reação de erro:', reactError);
            }
          }
        });
      
      // Retorna imediatamente para evitar bloqueio
      return Promise.resolve();
    }
  },
  {
    name: 'distort',
    description: 'Aplica efeito de distorção a uma imagem',
    needsMedia: true,
    reactions: {
      before: "🌀",
      after: "🤪",
      error: "❌"
    },
    method: (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      // Obtém intensidade dos args se fornecida
      let intensity = 50; // Padrão
      if (args.length > 0 && !isNaN(args[0])) {
        intensity = Math.max(30, Math.min(70, parseInt(args[0])));
      }
      
      // Cadeia de promessas sem bloqueio
      getMediaFromMessage(message)
        .then(media => {
          if (!media) {
            return bot.sendMessage(chatId, 'Por favor, forneça uma imagem ou responda a uma imagem com este comando.')
              .then(() => {
                // Aplica reação de erro
                try {
                  message.origin.react("❌");
                } catch (reactError) {
                  logger.error('Erro ao aplicar reação de erro:', reactError);
                }
                throw new Error('Nenhuma mídia fornecida');
              });
          }
          return media;
        })
        .then(media => saveMediaToTemp(media))
        .then(inputPath => {
          logger.debug(`Imagem de entrada salva em ${inputPath}`);
          
          // Armazena caminhos para limpeza
          const filePaths = [inputPath];
          
          // Processa imagem com distorção
          return distortImage(inputPath, intensity)
            .then(distortedPath => {
              logger.debug(`Distorção aplicada, salva em ${distortedPath}`);
              filePaths.push(distortedPath);
              return { distortedPath, filePaths };
            });
        })
        .then(({ distortedPath, filePaths }) => {
          return bot.createMedia(distortedPath)
            .then(resultMedia => {
              return bot.sendMessage(chatId, resultMedia, {
                caption: `Distorção aplicada (intensidade: ${intensity}%)`,
                quotedMessageId: message.origin.id._serialized
              })
              .then(() => filePaths);
            });
        })
        .then(filePaths => {
          // Limpa arquivos após envio
          return cleanupTempFiles(filePaths);
        })
        .catch(error => {
          if (error.message !== 'Nenhuma mídia fornecida') {
            logger.error('Erro no comando distort:', error);
            bot.sendMessage(chatId, 'Erro ao processar imagem. Certifique-se de que a imagem é válida e tente novamente.')
              .catch(sendError => {
                logger.error('Erro ao enviar mensagem de erro:', sendError);
              });
            
            // Aplica reação de erro
            try {
              message.origin.react("❌");
            } catch (reactError) {
              logger.error('Erro ao aplicar reação de erro:', reactError);
            }
          }
        });
      
      // Retorna imediatamente para evitar bloqueio
      return Promise.resolve();
    }
  },
  {
    name: 'stickerbg',
    description: 'Cria um sticker após remover o fundo',
    aliases: ['sbg'],
    needsMedia: true,
    reactions: {
      before: "✂️",
      after: "🎯",
      error: "❌"
    },
    method: (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      // Cadeia de promessas sem bloqueio
      getMediaFromMessage(message)
        .then(media => {
          if (!media) {
            return bot.sendMessage(chatId, 'Por favor, forneça uma imagem ou responda a uma imagem com este comando.')
              .then(() => {
                // Aplica reação de erro
                try {
                  message.origin.react("❌");
                } catch (reactError) {
                  logger.error('Erro ao aplicar reação de erro:', reactError);
                }
                throw new Error('Nenhuma mídia fornecida');
              });
          }
          return media;
        })
        .then(media => saveMediaToTemp(media))
        .then(inputPath => {
          logger.debug(`Imagem de entrada salva em ${inputPath}`);
          
          // Armazena caminhos para limpeza
          const filePaths = [inputPath];
          
          // Processa imagem com remoção de fundo e recorte
          return removeBackground(inputPath)
            .then(noBgPath => {
              logger.debug(`Fundo removido, salvo em ${noBgPath}`);
              filePaths.push(noBgPath);
              return trimImage(noBgPath);
            })
            .then(trimmedPath => {
              logger.debug(`Imagem recortada, salva em ${trimmedPath}`);
              filePaths.push(trimmedPath);
              return { trimmedPath, filePaths };
            });
        })
        .then(({ trimmedPath, filePaths }) => {
          return bot.createMedia(trimmedPath)
            .then(resultMedia => {
              // Extrai nome do sticker dos args ou usa nome do grupo
              const stickerName = args.length > 0 ? args.join(' ') : (group ? group.name : 'sticker');
              
              return bot.sendMessage(chatId, resultMedia, {
                asSticker: true,
                stickerAuthor: "ravena",
                stickerName: stickerName,
                quotedMessageId: message.origin.id._serialized
              })
              .then(() => filePaths);
            });
        })
        .then(filePaths => {
          // Limpa arquivos após envio
          return cleanupTempFiles(filePaths);
        })
        .catch(error => {
          if (error.message !== 'Nenhuma mídia fornecida') {
            logger.error('Erro no comando stickerbg:', error);
            bot.sendMessage(chatId, 'Erro ao processar imagem. Certifique-se de que a imagem é válida e tente novamente.')
              .catch(sendError => {
                logger.error('Erro ao enviar mensagem de erro:', sendError);
              });
            
            // Aplica reação de erro
            try {
              message.origin.react("❌");
            } catch (reactError) {
              logger.error('Erro ao aplicar reação de erro:', reactError);
            }
          }
        });
      
      // Retorna imediatamente para evitar bloqueio
      return Promise.resolve();
    }
  }
];

// Adiciona modelos para os efeitos artísticos restantes
['sketch', 'oil', 'neon', 'pixelate'].forEach(effect => {
  commands.push({
    name: effect,
    description: `Aplica efeito ${effect} a uma imagem`,
    needsMedia: true,
    reactions: {
      before: "🎨",
      after: "✨",
      error: "❌"
    },
    method: (bot, message, args, group) => {
      const chatId = message.group || message.author;
      
      // Cadeia de promessas sem bloqueio
      getMediaFromMessage(message)
        .then(media => {
          if (!media) {
            return bot.sendMessage(chatId, 'Por favor, forneça uma imagem ou responda a uma imagem com este comando.')
              .then(() => {
                // Aplica reação de erro
                try {
                  message.origin.react("❌");
                } catch (reactError) {
                  logger.error('Erro ao aplicar reação de erro:', reactError);
                }
                throw new Error('Nenhuma mídia fornecida');
              });
          }
          return media;
        })
        .then(media => saveMediaToTemp(media))
        .then(inputPath => {
          logger.debug(`Imagem de entrada salva em ${inputPath}`);
          
          // Armazena caminhos para limpeza
          const filePaths = [inputPath];
          
          // Aplica efeito
          return applyArtistic(inputPath, effect)
            .then(effectPath => {
              logger.debug(`Efeito ${effect} aplicado, salvo em ${effectPath}`);
              filePaths.push(effectPath);
              return { effectPath, filePaths };
            });
        })
        .then(({ effectPath, filePaths }) => {
          return bot.createMedia(effectPath)
            .then(resultMedia => {
              return bot.sendMessage(chatId, resultMedia, {
                caption: `Efeito ${effect} aplicado`,
                quotedMessageId: message.origin.id._serialized
              })
              .then(() => filePaths);
            });
        })
        .then(filePaths => {
          // Limpa arquivos após envio
          return cleanupTempFiles(filePaths);
        })
        .catch(error => {
          if (error.message !== 'Nenhuma mídia fornecida') {
            logger.error(`Erro no comando ${effect}:`, error);
            bot.sendMessage(chatId, 'Erro ao processar imagem. Certifique-se de que a imagem é válida e tente novamente.')
              .catch(sendError => {
                logger.error('Erro ao enviar mensagem de erro:', sendError);
              });
            
            // Aplica reação de erro
            try {
              message.origin.react("❌");
            } catch (reactError) {
              logger.error('Erro ao aplicar reação de erro:', reactError);
            }
          }
        });
      
      // Retorna imediatamente para evitar bloqueio
      return Promise.resolve();
    }
  });
});

// Adiciona alias para stickerbg -> sbg
const stickerbgCommand = commands.find(cmd => cmd.name === 'stickerbg');
if (stickerbgCommand) {
  const sbgCommand = {
    ...stickerbgCommand,
    name: 'sbg'
  };
  commands.push(sbgCommand);
}

// Registra os comandos sendo exportados
logger.info(`Módulo ImageManipulation carregado. Exportados ${commands.length} comandos.`);

module.exports = { commands };