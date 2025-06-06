const path = require('path');
const fs = require('fs').promises; // Using the promise-based fs module
const Logger = require('../utils/Logger');
const ReturnMessage = require('../models/ReturnMessage');
const Command = require('../models/Command');
const Database = require('../utils/Database');

const logger = new Logger('data-share');
const database = Database.getInstance();

/**
 * Stores a value in a variable specific to the group.
 * Command: !share <variableName> <data to store>
 * Example: !share frutas Laranja
 */
async function shareVariable(bot, message, args, group) {
  const chatId = message.group || message.author;

  try {
    // This command is only available in groups
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: "Este comando só está disponível em grupos."
      });
    }


    const quotedMsg = await message.origin.getQuotedMessage();

    if ((args.length < 1) || ((args.length < 2) && !quotedMsg)) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Formato incorreto. Use: `!share <variavel> <dado>`\nExemplo: `!share nomes João`\n\nOu apenas "!share nomes" mas marcando a mensagem com os dados',
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }

    const variableName = args[0];
    let dataToStore;
    if (!quotedMsg) {
      dataToStore = args.slice(1).join(' ');
    } else {
      dataToStore = quotedMsg.body ?? quotedMsg._data.body;
    }

    // Define the directory and file path for the group's shared data
    const dataShareDir = path.join(database.databasePath, 'data-share');
    const filePath = path.join(dataShareDir, `${group.id}.json`);

    // Ensure the data-share directory exists
    await fs.mkdir(dataShareDir, { recursive: true });

    let groupDataShare = {};
    try {
      // Read the existing file if it exists
      const fileContent = await fs.readFile(filePath, 'utf8');
      if (fileContent) {
        groupDataShare = JSON.parse(fileContent);
      }
    } catch (error) {
      // If the file doesn't exist (ENOENT), we'll create it.
      // For other errors, we log and notify the user.
      if (error.code !== 'ENOENT') {
        logger.error(`Error reading or parsing ${filePath}:`, error);
        return new ReturnMessage({
          chatId: chatId,
          content: 'Ocorreu um erro ao ler o arquivo de dados. O arquivo pode estar corrompido.',
          options: {
            quotedMessageId: message.origin.id._serialized
          }
        });
      }
    }

    // If the variable (key) doesn't exist, initialize it with an empty array
    if (!groupDataShare[variableName]) {
      groupDataShare[variableName] = [];
    }

    // Add the new data to the variable's array
    groupDataShare[variableName].push(dataToStore);

    // Write the updated data back to the JSON file
    await fs.writeFile(filePath, JSON.stringify(groupDataShare, null, "\t"), "utf8");

    const response = `✅ Dado salvo em '${variableName}'.\nTotal de itens agora: ${groupDataShare[variableName].length}.`;

    return new ReturnMessage({
      chatId: chatId,
      content: response,
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });

  } catch (error) {
    logger.error('Error in shareVariable:', error);

    return new ReturnMessage({
      chatId: chatId,
      content: 'Ocorreu um erro inesperado ao compartilhar estes dados.',
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  }
}

const commands = [
  new Command({
    name: 'share',
    description: 'Compartilhe dados com a API da ravena',
    category: "arquivos",
    reactions: {
      before: "⏳",
      after: "⬆️"
    },
    cooldown: 1,
    method: shareVariable
  }),
];

module.exports = { commands };