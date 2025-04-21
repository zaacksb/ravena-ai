const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const NSFWPredict = require('../utils/NSFWPredict');
const ReturnMessage = require('../models/ReturnMessage');

/**
 * Manipula comandos de gerenciamento para grupos
 */
class Management {
  constructor() {
    this.logger = new Logger('management');
    this.database = Database.getInstance();
    this.nsfwPredict = NSFWPredict.getInstance();
    this.dataPath = path.join(__dirname, '../../data');
    
    // Mapeamento de comando para método
    this.commandMap = {
      'setName': {
        method: 'setGroupName',
        description: 'Define um nome personalizado para o grupo'
      },
      'addCmd': {
        method: 'addCustomCommand',
        description: 'Adiciona um comando personalizado (deve ser usado como resposta)'
      },
      'addCmdReply': {
        method: 'addCustomCommandReply',
        description: 'Adiciona outra resposta a um comando existente'
      },
      'delCmd': {
        method: 'deleteCustomCommand',
        description: 'Exclui um comando personalizado'
      },
      'enableCmd': {
        method: 'enableCustomCommand',
        description: 'Habilita um comando desabilitado'
      },
      'disableCmd': {
        method: 'disableCustomCommand',
        description: 'Desabilita um comando'
      },
      'setPrefixo': {
        method: 'setCustomPrefix',
        description: 'Altera o prefixo de comando'
      },
      'setBemvindo': {
        method: 'setWelcomeMessage',
        description: 'Define mensagem de boas-vindas para novos membros'
      },
      'setDespedida': {
        method: 'setFarewellMessage',
        description: 'Define mensagem de despedida para membros que saem'
      },
      'ajuda': {
        method: 'showManagementHelp',
        description: 'Mostra ajuda de comandos de gerenciamento'
      },
      'cmdReact': {
        method: 'setReaction',
        description: 'Define reação "depois" para um comando'
      },
      'cmdStartReact': {
        method: 'setStartReaction',
        description: 'Define reação "antes" para um comando'
      },
      'autoStt': {
        method: 'toggleAutoStt',
        description: 'Ativa/desativa conversão automática de voz para texto'
      },
      'info': {
        method: 'showGroupInfo',
        description: 'Mostra informações detalhadas do grupo'
      },
      'filtro-palavra': {
        method: 'filterWord',
        description: 'Adiciona/remove palavra do filtro'
      },
      'filtro-links': {
        method: 'filterLinks',
        description: 'Ativa/desativa filtro de links'
      },
      'filtro-pessoa': {
        method: 'filterPerson',
        description: 'Adiciona/remove número do filtro'
      },
      'filtro-nsfw': {
        method: 'filterNSFW',
        description: 'Ativa/desativa filtro de conteúdo NSFW'
      },
      'apelido': {
        method: 'setUserNickname',
        description: 'Define um apelido para o usuário no grupo'
      },
      'ignorar': {
        method: 'ignoreUser',
        description: 'Ignora mensagens de um usuário específico'
      },
      'mute': {
        method: 'muteCommand',
        description: 'Silencia mensagens que começam com determinado texto'
      },
      'customAdmin': {
        method: 'customAdmin',
        description: 'Gerencia administradores adicionais do grupo'
      },
      'pausar': {
        method: 'pauseGroup',
        description: 'Pausa/retoma a atividade do bot no grupo'
      },
      'setTempoRoleta': {
        method: 'definirTempoRoleta',
        description: 'Define tempo de timeout da roleta russa'
      },
      'interagir': {
        method: 'toggleInteraction',
        description: 'Ativa/desativa interações automáticas do bot'
      },
      'interagir-cd': {
        method: 'setInteractionCooldown',
        description: 'Define o tempo de espera entre interações automáticas'
      },
      'interagir-chance': {
        method: 'setInteractionChance',
        description: 'Define a chance de ocorrer interações automáticas'
      },
      'twitch-canal': {
        method: 'toggleTwitchChannel',
        description: 'Adiciona/remove canal da Twitch para monitoramento'
      },
      'twitch-midia-on': {
        method: 'setTwitchOnlineMedia',
        description: 'Define mídia para notificação quando canal ficar online'
      },
      'twitch-midia-off': {
        method: 'setTwitchOfflineMedia',
        description: 'Define mídia para notificação quando canal ficar offline'
      },
      'twitch-mudarTitulo': {
        method: 'toggleTwitchTitleChange',
        description: 'Ativa/desativa mudança de título do grupo para eventos da Twitch'
      },
      'twitch-titulo-on': {
        method: 'setTwitchOnlineTitle',
        description: 'Define título do grupo para quando canal ficar online'
      },
      'twitch-titulo-off': {
        method: 'setTwitchOfflineTitle',
        description: 'Define título do grupo para quando canal ficar offline'
      },
      'twitch-usarIA': {
        method: 'toggleTwitchAI',
        description: 'Ativa/desativa uso de IA para gerar mensagens de notificação'
      },
      'kick-canal': {
        method: 'toggleKickChannel',
        description: 'Adiciona/remove canal do Kick para monitoramento'
      },
      'kick-midia-on': {
        method: 'setKickOnlineMedia',
        description: 'Define mídia para notificação quando canal ficar online'
      },
      'kick-midia-off': {
        method: 'setKickOfflineMedia',
        description: 'Define mídia para notificação quando canal ficar offline'
      },
      'kick-mudarTitulo': {
        method: 'toggleKickTitleChange',
        description: 'Ativa/desativa mudança de título do grupo para eventos do Kick'
      },
      'kick-titulo-on': {
        method: 'setKickOnlineTitle',
        description: 'Define título do grupo para quando canal ficar online'
      },
      'kick-titulo-off': {
        method: 'setKickOfflineTitle',
        description: 'Define título do grupo para quando canal ficar offline'
      },
      'kick-usarIA': {
        method: 'toggleKickAI',
        description: 'Ativa/desativa uso de IA para gerar mensagens de notificação'
      },
      'youtube-canal': {
        method: 'toggleYoutubeChannel',
        description: 'Adiciona/remove canal do YouTube para monitoramento'
      },
      'youtube-midia-on': {
        method: 'setYoutubeOnlineMedia',
        description: 'Define mídia para notificação de novos vídeos'
      },
      'youtube-midia-off': {
        method: 'setYoutubeOfflineMedia',
        description: 'Define mídia para notificação quando canal ficar offline'
      },
      'youtube-mudarTitulo': {
        method: 'toggleYoutubeTitleChange',
        description: 'Ativa/desativa mudança de título do grupo para eventos do YouTube'
      },
      'youtube-titulo-on': {
        method: 'setYoutubeOnlineTitle',
        description: 'Define título do grupo para quando canal postar novo vídeo'
      },
      'youtube-titulo-off': {
        method: 'setYoutubeOfflineTitle',
        description: 'Define título do grupo para quando canal ficar offline'
      },
      'youtube-usarIA': {
        method: 'toggleYoutubeAI',
        description: 'Ativa/desativa uso de IA para gerar mensagens de notificação'
      }
    };
  }

  /**
   * Obtém a lista de comandos de gerenciamento e suas descrições
   * @returns {Object} - Objeto com comandos e descrições
   */
  getCommandMethod(command) {
    return this.commandMap[command]?.method || null;
  }

  /**
   * Obtém a lista de comandos de gerenciamento e suas descrições
   * @returns {Object} - Objeto com comandos e descrições
   */
  getManagementCommands() {
    const commands = {};
    
    // Constrói objeto de comandos a partir do commandMap
    for (const [cmdName, cmdData] of Object.entries(this.commandMap)) {
      commands[cmdName] = {
        description: cmdData.description || 'Sem descrição disponível',
        method: cmdData.method
      };
    }
    
    return commands;
  }
  
  /**
   * Substituto para hasMedia
   * @param {Message} message - Objeto msg do wwebjs
   * @returns {bool|null} - Tem ou não
   */
  isMediaMsg(message) {
    return ["audio","voice","image","video","document","sticker"].some(t => message.type.toLowerCase() == t);
  }

  /**
   * Define nome do grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setGroupName(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça um novo nome para o grupo. Exemplo: !g-setName NovoNomeGrupo'
      });
    }
    
    const newName = args.join(' ');
    
    // Atualiza nome do grupo no banco de dados
    group.name = newName.toLowerCase().replace(/\s+/g, '').substring(0, 16);
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Nome do grupo atualizado para: ${group.name}`
    });
  }
  
  /**
   * Adiciona um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async addCustomCommand(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se a mensagem é uma resposta
    const quotedMsg = await message.origin.getQuotedMessage();

    if (!quotedMsg) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Este comando deve ser usado como resposta a uma mensagem.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça um gatilho para o comando personalizado. Exemplo: !g-addCmd saudação'
      });
    }
    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    const commandTrigger = args.join(' ').toLowerCase();
    
    // Obtém o conteúdo da mensagem citada
    let responseContent = false;
    
    // Trata mensagens de mídia
    if (quotedMsg.hasMedia) {
      this.logger.info(`tem mídia, baixando...`);
      const caption = quotedMsg.caption ?? quotedMsg._data.caption;
      try {
        const media = await quotedMsg.downloadMedia();
        let mediaType = media.mimetype.split('/')[0]; // 'image', 'audio', 'video', etc.

        if(quotedMsg.type.toLowerCase() == "sticker"){
          mediaType = "sticker";
        }
        if(quotedMsg.type.toLowerCase() == "voice"){
          mediaType = "voice";
        }

        
        // Gera nome de arquivo com extensão apropriada
        let fileExt = media.mimetype.split('/')[1];
        if(fileExt.includes(";")){
          fileExt = fileExt.split(";")[0];
        }
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        
        // Cria diretório de mídia se não existir
        const mediaDir = path.join(this.dataPath, 'media');
        await fs.mkdir(mediaDir, { recursive: true });
        
        // Salva arquivo de mídia (sem base64 na resposta)
        const filePath = path.join(mediaDir, fileName);
        await fs.writeFile(filePath, Buffer.from(media.data, 'base64'));
        
        this.logger.info(`Arquivo de mídia salvo para comando: ${filePath}`);
        
        // Formata a resposta adequadamente para sendCustomCommandResponse
        // Este é o formato: {mediaType-fileName} Caption
        responseContent = `{${mediaType}-${fileName}}${caption ? ' ' + caption : ''}`;
      } catch (error) {
        this.logger.error('Erro ao salvar mídia para comando personalizado:', error);
        return new ReturnMessage({
          chatId: group.id,
          content: 'Erro ao salvar mídia para comando personalizado.'
        });
      }
    } else {
      responseContent = quotedMsg.body ?? quotedMsg._data.body;
    }
    
    // Cria o comando personalizado
    const customCommand = {
      startsWith: commandTrigger,
      responses: [responseContent],
      sendAllResponses: false,
      mentions: [],
      cooldown: 0,
      react: null,
      reply: true,
      count: 0,
      metadata: {
        createdBy: message.author,
        createdAt: Date.now()
      },
      active: true,
      deleted: false
    };
    
    // Salva o comando personalizado
    await this.database.saveCustomCommand(group.id, customCommand);
    
    // Limpa cache de comandos para garantir que o novo comando seja carregado
    this.database.clearCache(`commands:${group.id}`);
    
    // Recarrega comandos
    await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Comando personalizado '${commandTrigger}' adicionado com sucesso.`
    });
  }
  
  /**
   * Adiciona uma resposta a um comando personalizado existente
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async addCustomCommandReply(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se a mensagem é uma resposta
    const quotedMsg = await message.origin.getQuotedMessage();
    if (!quotedMsg) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Este comando deve ser usado como resposta a uma mensagem.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o comando para adicionar uma resposta. Exemplo: !g-addCmdReply saudação'
      });
    }
    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    const commandTrigger = args.join(' ').toLowerCase();
    
    // Obtém comandos personalizados para este grupo
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandTrigger && !cmd.deleted);
    
    if (!command) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Comando personalizado '${commandTrigger}' não encontrado.`
      });
    }
    
    // Obtém o conteúdo da mensagem citada
    let responseContent = quotedMsg.body;
    
    // Trata mensagens de mídia
    if (quotedMsg.hasMedia) {
      try {
        const media = await quotedMsg.downloadMedia();
        let mediaType = media.mimetype.split('/')[0]; // 'image', 'audio', 'video', etc.

        if(quotedMsg.type.toLowerCase() == "sticker"){
          mediaType = "sticker";
        }
        if(quotedMsg.type.toLowerCase() == "voice"){
          mediaType = "voice";
        }
        
        // Gera nome de arquivo com extensão apropriada
        let fileExt = media.mimetype.split('/')[1];
        if(fileExt.includes(";")){
          fileExt = fileExt.split(";")[0];
        }
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        
        // Cria diretório de mídia se não existir
        const mediaDir = path.join(this.dataPath, 'media');
        await fs.mkdir(mediaDir, { recursive: true });
        
        // Salva arquivo de mídia
        const filePath = path.join(mediaDir, fileName);
        await fs.writeFile(filePath, Buffer.from(media.data, 'base64'));
        
        this.logger.info(`Arquivo de mídia salvo para resposta de comando: ${filePath}`);
        
        // Formata a resposta adequadamente para sendCustomCommandResponse
        responseContent = `{${mediaType}-${fileName}}${quotedMsg.caption ? ' ' + quotedMsg.caption : ''}`;
      } catch (error) {
        this.logger.error('Erro ao salvar mídia para resposta de comando personalizado:', error);
        return new ReturnMessage({
          chatId: group.id,
          content: 'Erro ao salvar mídia para resposta de comando personalizado.'
        });
      }
    }
    
    // Adiciona a nova resposta
    if (!command.responses) {
      command.responses = [];
    }
    command.responses.push(responseContent);
    
    // Atualiza o comando
    await this.database.updateCustomCommand(group.id, command);
    
    // Limpa cache de comandos para garantir que o comando atualizado seja carregado
    this.database.clearCache(`commands:${group.id}`);

    // Recarrega comandos
    await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Adicionada nova resposta ao comando personalizado '${commandTrigger}'.`
    });
  }
  
  /**
   * Exclui um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async deleteCustomCommand(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o comando personalizado a ser excluído. Exemplo: !g-delCmd saudação'
      });
    }
    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    const commandTrigger = args.join(' ').toLowerCase();
    
    // Obtém comandos personalizados para este grupo
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandTrigger && !cmd.deleted);
    
    if (!command) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Comando personalizado '${commandTrigger}' não encontrado.`
      });
    }
    
    // Marca comando como excluído
    command.deleted = true;
    command.active = false;
    
    // Atualiza o comando
    await this.database.updateCustomCommand(group.id, command);
    
    // Limpa cache de comandos para garantir que o comando atualizado seja carregado
    this.database.clearCache(`commands:${group.id}`);

    // Recarrega comandos
    await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Comando personalizado '${commandTrigger}' excluído.`
    });
  }
  
  /**
   * Habilita um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async enableCustomCommand(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o comando personalizado a ser habilitado. Exemplo: !g-enableCmd saudação'
      });
    }
    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    const commandTrigger = args.join(' ').toLowerCase();
    
    // Obtém comandos personalizados para este grupo
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandTrigger && !cmd.deleted);
    
    if (!command) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Comando personalizado '${commandTrigger}' não encontrado.`
      });
    }
    
    // Habilita comando
    command.active = true;
    
    // Atualiza o comando
    await this.database.updateCustomCommand(group.id, command);
    
    // Limpa cache de comandos para garantir que o comando atualizado seja carregado
    this.database.clearCache(`commands:${group.id}`);

    // Recarrega comandos
    await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Comando personalizado '${commandTrigger}' habilitado.`
    });
  }
  
  /**
   * Desabilita um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async disableCustomCommand(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o comando personalizado a ser desabilitado. Exemplo: !g-disableCmd saudação'
      });
    }
    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    const commandTrigger = args.join(' ').toLowerCase();
    
    // Obtém comandos personalizados para este grupo
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandTrigger && !cmd.deleted);
    
    if (!command) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Comando personalizado '${commandTrigger}' não encontrado.`
      });
    }
    
    // Desabilita comando
    command.active = false;
    
    // Atualiza o comando
    await this.database.updateCustomCommand(group.id, command);
    
    // Limpa cache de comandos para garantir que o comando atualizado seja carregado
    this.database.clearCache(`commands:${group.id}`);

    // Recarrega comandos
    await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Comando personalizado '${commandTrigger}' desabilitado.`
    });
  }
  
  /**
   * Define prefixo personalizado para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setCustomPrefix(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // MELHORIA: Permite definir prefixo vazio quando não há argumentos
    let newPrefix = '';
    if (args.length > 0) {
      newPrefix = args[0];
    }
    
    // Atualiza prefixo do grupo
    group.prefix = newPrefix;
    await this.database.saveGroup(group);
    
    // Mensagem especial para prefixo vazio
    if (newPrefix === '') {
      return new ReturnMessage({
        chatId: group.id,
        content: `Prefixo de comando removido. Qualquer mensagem agora pode ser um comando.`
      });
    } else {
      return new ReturnMessage({
        chatId: group.id,
        content: `Prefixo de comando atualizado para: ${newPrefix}`
      });
    }
  }
  
  /**
   * Define mensagem de boas-vindas para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setWelcomeMessage(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça uma mensagem de boas-vindas. Exemplo: !g-setWelcome Bem-vindo ao grupo, {pessoa}!'
      });
    }
    
    const welcomeText = args.join(' ');
    
    // Atualiza mensagem de boas-vindas do grupo
    if (!group.greetings) {
      group.greetings = {};
    }
    group.greetings.text = welcomeText;
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Mensagem de boas-vindas atualizada para: ${welcomeText}`
    });
  }
  
  /**
   * Define mensagem de despedida para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setFarewellMessage(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça uma mensagem de despedida. Exemplo: !g-setFarewell Adeus, {pessoa}!'
      });
    }
    
    const farewellText = args.join(' ');
    
    // Atualiza mensagem de despedida do grupo
    if (!group.farewells) {
      group.farewells = {};
    }
    group.farewells.text = farewellText;
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Mensagem de despedida atualizada para: ${farewellText}`
    });
  }
  
  /**
   * Mostra mensagem de ajuda de gerenciamento
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async showManagementHelp(bot, message, args, group) {
    const chatId = group ? group.id : message.author;
    
    const helpText = `*Comandos de Gerenciamento de Grupo:*

*!g-setName* <nome> - Define um nome personalizado para o grupo
*!g-addCmd* <gatilho> - Adiciona um comando personalizado (deve ser usado como resposta)
*!g-addCmdReply* <comando> - Adiciona outra resposta a um comando existente
*!g-delCmd* <comando> - Exclui um comando personalizado
*!g-enableCmd* <comando> - Habilita um comando desabilitado
*!g-disableCmd* <comando> - Desabilita um comando
*!g-setCustomPrefix* <prefixo> - Altera o prefixo de comando
*!g-setWelcome* <mensagem> - Define mensagem de boas-vindas para novos membros
*!g-setFarewell* <mensagem> - Define mensagem de despedida para membros que saem
*!g-info* - Mostra informações detalhadas do grupo
*!g-manage* <nomeGrupo> - Gerencia um grupo a partir de chat privado

*Comandos de Filtro:*
*!g-filtro-palavra* <palavra> - Adiciona/remove palavra do filtro
*!g-filtro-links* - Ativa/desativa filtro de links
*!g-filtro-pessoa* <número> - Adiciona/remove número do filtro
*!g-filtro-nsfw* - Ativa/desativa filtro de conteúdo NSFW

*Variáveis em mensagens:*
{pessoa} - Nome da pessoa que entrou/saiu do grupo
{day} - Dia atual
{date} - Data atual
{time} - Hora atual
{cmd-!comando arg} - Executa outro comando (criando um alias)`;

    return new ReturnMessage({
      chatId: chatId,
      content: helpText
    });
  }


   /**
   * Mostra informações detalhadas do grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async showGroupInfo(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    try {
      // Obtém comandos personalizados para este grupo
      const customCommands = await this.database.getCustomCommands(group.id);
      const activeCommands = customCommands.filter(cmd => cmd.active && !cmd.deleted);
      
      // Formata mensagem de boas-vindas e despedida
      const welcomeMessage = group.greetings && group.greetings.text 
        ? group.greetings.text 
        : 'Não definida';
      
      const farewellMessage = group.farewells && group.farewells.text 
        ? group.farewells.text 
        : 'Não definida';
      
      // Formata informações de filtro
      const wordFilters = group.filters && group.filters.words && group.filters.words.length > 0
        ? group.filters.words.join(', ')
        : 'Nenhuma palavra filtrada';
      
      const linkFiltering = group.filters && group.filters.links 
        ? 'Ativado' 
        : 'Desativado';
      
      const personFilters = group.filters && group.filters.people && group.filters.people.length > 0
        ? group.filters.people.join(', ')
        : 'Nenhuma pessoa filtrada';
      
      const nsfwFiltering = group.filters && group.filters.nsfw 
        ? 'Ativado' 
        : 'Desativado';
      
      // Formata data de criação
      const creationDate = new Date(group.createdAt).toLocaleString();
      
      // Obtém informações do sistema de arquivos para o grupo
      let filesInfo = {
        totalFiles: 0,
        totalSize: 0
      };
      
      try {
        // Carrega informações do banco de dados de arquivos
        const filesDb = await this.loadFilesDB();
        
        if (filesDb && filesDb.chats && filesDb.chats[group.id]) {
          const groupStorage = filesDb.chats[group.id];
          
          // Conta o número de arquivos (não pastas)
          const files = Object.values(groupStorage.files || {})
            .filter(file => !file.isFolder);
          
          filesInfo.totalFiles = files.length;
          filesInfo.totalSize = groupStorage.totalSize || 0;
        }
      } catch (filesError) {
        this.logger.error('Erro ao obter informações de arquivos:', filesError);
      }
      
      // Formata tamanho do armazenamento
      const formatSize = (bytes) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
      };
      
      // Formata informações de streams configurados
      const twitchChannels = Array.isArray(group.twitch) ? group.twitch : [];
      const kickChannels = Array.isArray(group.kick) ? group.kick : [];
      const youtubeChannels = Array.isArray(group.youtube) ? group.youtube : [];
      
      // Constrói mensagem informativa
      let infoMessage = `*📊 Informações do Grupo*\n\n`;
      infoMessage += `*Nome:* ${group.name}\n`;
      infoMessage += `*ID:* ${group.id}\n`;
      infoMessage += `*Prefixo:* "${group.prefix}"\n`;
      infoMessage += `*Data de Criação:* ${creationDate}\n\n`;
      
      // Adiciona informações de armazenamento
      infoMessage += `*Armazenamento:*\n`;
      infoMessage += `- *Arquivos:* ${filesInfo.totalFiles} arquivos\n`;
      infoMessage += `- *Espaço usado:* ${formatSize(filesInfo.totalSize)}\n\n`;
      
      infoMessage += `*Configurações de Mensagens:*\n`;
      infoMessage += `- *Boas-vindas:* ${welcomeMessage}\n`;
      infoMessage += `- *Despedidas:* ${farewellMessage}\n`;
      infoMessage += `- *Auto-STT:* ${group.autoStt ? 'Ativado' : 'Desativado'}\n\n`;
      
      infoMessage += `*Filtros:*\n`;
      infoMessage += `- *Palavras:* ${wordFilters}\n`;
      infoMessage += `- *Links:* ${linkFiltering}\n`;
      infoMessage += `- *Pessoas:* ${personFilters}\n`;
      infoMessage += `- *NSFW:* ${nsfwFiltering}\n\n`;
      
      // NOVA SEÇÃO: Adiciona informações de streams configurados
      infoMessage += `*Canais Monitorados:*\n`;
      
      // Twitch
      if (twitchChannels.length > 0) {
        infoMessage += `*Twitch (${twitchChannels.length}):*\n`;
        
        // Lista no máximo 3 canais para não tornar a mensagem muito longa
        const maxChannels = Math.min(3, twitchChannels.length);
        for (let i = 0; i < maxChannels; i++) {
          const channel = twitchChannels[i];
          infoMessage += `- *${channel.channel}*: `;
          infoMessage += `${channel.onConfig?.media?.length || 0} notif. online, `;
          infoMessage += `${channel.offConfig?.media?.length || 0} notif. offline, `;
          infoMessage += `título: ${channel.changeTitleOnEvent ? 'Sim' : 'Não'}, `;
          infoMessage += `IA: ${channel.useAI ? 'Sim' : 'Não'}\n`;
        }
        
        // Indica se existem mais canais
        if (twitchChannels.length > maxChannels) {
          infoMessage += `... e mais ${twitchChannels.length - maxChannels} canais\n`;
        }
        
        infoMessage += '\n';
      }
      
      // Kick
      if (kickChannels.length > 0) {
        infoMessage += `*Kick (${kickChannels.length}):*\n`;
        
        // Lista no máximo 3 canais
        const maxChannels = Math.min(3, kickChannels.length);
        for (let i = 0; i < maxChannels; i++) {
          const channel = kickChannels[i];
          infoMessage += `- *${channel.channel}*: `;
          infoMessage += `${channel.onConfig?.media?.length || 0} notif. online, `;
          infoMessage += `${channel.offConfig?.media?.length || 0} notif. offline, `;
          infoMessage += `título: ${channel.changeTitleOnEvent ? 'Sim' : 'Não'}, `;
          infoMessage += `IA: ${channel.useAI ? 'Sim' : 'Não'}\n`;
        }
        
        // Indica se existem mais canais
        if (kickChannels.length > maxChannels) {
          infoMessage += `... e mais ${kickChannels.length - maxChannels} canais\n`;
        }
        
        infoMessage += '\n';
      }
      
      // YouTube
      if (youtubeChannels.length > 0) {
        infoMessage += `*YouTube (${youtubeChannels.length}):*\n`;
        
        // Lista no máximo 3 canais
        const maxChannels = Math.min(3, youtubeChannels.length);
        for (let i = 0; i < maxChannels; i++) {
          const channel = youtubeChannels[i];
          infoMessage += `- *${channel.channel}*: `;
          infoMessage += `${channel.onConfig?.media?.length || 0} notif. novos vídeos, `;
          infoMessage += `título: ${channel.changeTitleOnEvent ? 'Sim' : 'Não'}, `;
          infoMessage += `IA: ${channel.useAI ? 'Sim' : 'Não'}\n`;
        }
        
        // Indica se existem mais canais
        if (youtubeChannels.length > maxChannels) {
          infoMessage += `... e mais ${youtubeChannels.length - maxChannels} canais\n`;
        }
        
        infoMessage += '\n';
      }
      
      if (twitchChannels.length === 0 && kickChannels.length === 0 && youtubeChannels.length === 0) {
        infoMessage += `Nenhum canal configurado. Use !g-twitch-canal, !g-kick-canal ou !g-youtube-canal para adicionar.\n\n`;
      }
      
      // Adiciona informação sobre comandos personalizados
      infoMessage += `*Comandos Personalizados (${activeCommands.length}):*\n`;
      
      // Lista comandos personalizados com suas respostas (limitado a 10 para não ficar muito grande)
      const maxCommands = Math.min(10, activeCommands.length);
      for (let i = 0; i < maxCommands; i++) {
        const cmd = activeCommands[i];
        infoMessage += `- *${group.prefix}${cmd.startsWith}*: `;
        
        // Mostra respostas (limitado a 2 por comando)
        if (cmd.responses && cmd.responses.length > 0) {
          const responsesCount = cmd.responses.length;
          const maxResponses = Math.min(2, responsesCount);
          
          for (let j = 0; j < maxResponses; j++) {
            // Limita tamanho da resposta para exibição
            let response = cmd.responses[j];
            if (response.length > 50) {
              response = response.substring(0, 47) + '...';
            }
            infoMessage += `"${response}"`;
            
            if (j < maxResponses - 1) {
              infoMessage += `, `;
            }
          }
          
          if (responsesCount > maxResponses) {
            infoMessage += ` (+ ${responsesCount - maxResponses} mais)`;
          }
        } else {
          infoMessage += 'Sem respostas';
        }
        
        infoMessage += '\n';
      }
      
      // Indica se existem mais comandos
      if (activeCommands.length > maxCommands) {
        infoMessage += `_... e mais ${activeCommands.length - maxCommands} comandos_\n`;
      }
      
      return new ReturnMessage({
        chatId: group.id,
        content: infoMessage
      });
    } catch (error) {
      this.logger.error('Erro ao mostrar informações do grupo:', error);
      return new ReturnMessage({
        chatId: group.id,
        content: 'Erro ao recuperar informações do grupo. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Carrega o banco de dados de arquivos
   * @returns {Promise<Object>} Banco de dados de arquivos
   */
  async loadFilesDB() {
    try {
      const FILES_DB_FILE = 'files-db.json';
      return await this.database.loadJSON(path.join(this.database.databasePath, FILES_DB_FILE));
    } catch (error) {
      this.logger.error('Erro ao carregar banco de dados de arquivos:', error);
      return null;
    }
  }

  /**
   * Verifica se o bot é admin no grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {string} groupId - ID do grupo
   * @returns {Promise<boolean>} - Se o bot é admin
   */
  async isBotAdmin(bot, groupId) {
    try {
      // Obtém chat do grupo
      const chat = await bot.client.getChatById(groupId);
      
      if (!chat.isGroup) {
        return false;
      }
      
      // Obtém o ID do bot
      const botId = bot.client.info.wid._serialized;
      
      // Verifica se o bot é admin
      const participants = chat.participants || [];
      const botParticipant = participants.find(p => p.id._serialized === botId);
      
      return botParticipant && botParticipant.isAdmin;
    } catch (error) {
      this.logger.error(`Erro ao verificar se o bot é admin em ${groupId}:`, error);
      return false;
    }
  }
  
  /**
   * Adiciona ou remove uma palavra do filtro
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async filterWord(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se o bot é admin para filtros efetivos
    const isAdmin = await this.isBotAdmin(bot, group.id);
    if (!isAdmin) {
      await bot.sendMessage(group.id, '⚠️ Atenção: O bot não é administrador do grupo. Ele não poderá apagar mensagens filtradas. Para usar filtros efetivamente, adicione o bot como administrador.');
    }
    
    if (args.length === 0) {
      // Mostra lista de palavras filtradas atual
      const wordFilters = group.filters && group.filters.words && group.filters.words.length > 0
        ? group.filters.words.join(', ')
        : 'Nenhuma palavra filtrada';
      
      return new ReturnMessage({
        chatId: group.id,
        content: `*Palavras filtradas atualmente:*\n${wordFilters}\n\nPara adicionar ou remover uma palavra do filtro, use: !g-filtro-palavra <palavra ou frase>`
      });
    }
    
    // Inicializa filtros se não existirem
    if (!group.filters) {
      group.filters = {};
    }
    
    if (!group.filters.words || !Array.isArray(group.filters.words)) {
      group.filters.words = [];
    }
    
    // Junta todos os argumentos como uma única frase
    const word = args.join(' ').toLowerCase();
    
    // Verifica se a palavra já está no filtro
    const index = group.filters.words.findIndex(w => w.toLowerCase() === word);
    
    if (index !== -1) {
      // Remove a palavra
      group.filters.words.splice(index, 1);
      await this.database.saveGroup(group);
      
      // Mostra lista atualizada
      const wordFilters = group.filters.words.length > 0
        ? group.filters.words.join(', ')
        : 'Nenhuma palavra filtrada';
      
      return new ReturnMessage({
        chatId: group.id,
        content: `✅ Palavra removida do filtro: "${word}"\n\n*Palavras filtradas atualmente:*\n${wordFilters}`
      });
    } else {
      // Adiciona a palavra
      group.filters.words.push(word);
      await this.database.saveGroup(group);
      
      // Mostra lista atualizada
      const wordFilters = group.filters.words.length > 0
        ? group.filters.words.join(', ')
        : 'Nenhuma palavra filtrada';
      
      return new ReturnMessage({
        chatId: group.id,
        content: `✅ Palavra adicionada ao filtro: "${word}"\n\n*Palavras filtradas atualmente:*\n${wordFilters}`
      });
    }
  }
  
  /**
   * Ativa ou desativa filtro de links
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async filterLinks(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se o bot é admin para filtros efetivos
    const isAdmin = await this.isBotAdmin(bot, group.id);
    if (!isAdmin) {
      await bot.sendMessage(group.id, '⚠️ Atenção: O bot não é administrador do grupo. Ele não poderá apagar mensagens filtradas. Para usar filtros efetivamente, adicione o bot como administrador.');
    }
    
    // Inicializa filtros se não existirem
    if (!group.filters) {
      group.filters = {};
    }
    
    // Alterna estado do filtro
    group.filters.links = !group.filters.links;
    await this.database.saveGroup(group);
    
    if (group.filters.links) {
      return new ReturnMessage({
        chatId: group.id,
        content: '✅ Filtro de links ativado. Mensagens contendo links serão apagadas automaticamente.'
      });
    } else {
      return new ReturnMessage({
        chatId: group.id,
        content: '❌ Filtro de links desativado. Mensagens contendo links não serão mais filtradas.'
      });
    }
  }
  
  /**
   * Adiciona ou remove uma pessoa do filtro
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async filterPerson(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se o bot é admin para filtros efetivos
    const isAdmin = await this.isBotAdmin(bot, group.id);
    if (!isAdmin) {
      await bot.sendMessage(group.id, '⚠️ Atenção: O bot não é administrador do grupo. Ele não poderá apagar mensagens filtradas. Para usar filtros efetivamente, adicione o bot como administrador.');
    }
    
    // Inicializa filtros se não existirem
    if (!group.filters) {
      group.filters = {};
    }
    
    if (!group.filters.people || !Array.isArray(group.filters.people)) {
      group.filters.people = [];
    }
    
    if (args.length === 0) {
      // Mostra lista de pessoas filtradas
      const personFilters = group.filters.people.length > 0
        ? group.filters.people.join(', ')
        : 'Nenhuma pessoa filtrada';
      
      return new ReturnMessage({
        chatId: group.id,
        content: `*Pessoas filtradas atualmente:*\n${personFilters}\n\nPara adicionar ou remover uma pessoa do filtro, use: !g-filtro-pessoa <número>`
      });
    }
    
    // Obtém número do primeiro argumento
    let numero = args[0].replace(/\D/g, ''); // Remove não-dígitos
    
    // Verifica se o número tem pelo menos 8 dígitos
    if (numero.length < 8) {
      return new ReturnMessage({
        chatId: group.id,
        content: '❌ O número deve ter pelo menos 8 dígitos.'
      });
    }
    
    // Adiciona @c.us ao número se não estiver completo
    if (!numero.includes('@')) {
      numero = `${numero}@c.us`;
    }
    
    // Verifica se o número já está no filtro
    const index = group.filters.people.indexOf(numero);
    
    if (index !== -1) {
      // Remove o número
      group.filters.people.splice(index, 1);
      await this.database.saveGroup(group);
      
      // Mostra lista atualizada
      const personFilters = group.filters.people.length > 0
        ? group.filters.people.join(', ')
        : 'Nenhuma pessoa filtrada';
      
      return new ReturnMessage({
        chatId: group.id,
        content: `✅ Pessoa removida do filtro: ${numero}\n\n*Pessoas filtradas atualmente:*\n${personFilters}`
      });
    } else {
      // Adiciona o número
      group.filters.people.push(numero);
      await this.database.saveGroup(group);
      
      // Mostra lista atualizada
      const personFilters = group.filters.people.length > 0
        ? group.filters.people.join(', ')
        : 'Nenhuma pessoa filtrada';
      
      return new ReturnMessage({
        chatId: group.id,
        content: `✅ Pessoa adicionada ao filtro: ${numero}\n\n*Pessoas filtradas atualmente:*\n${personFilters}`
      });
    }
  }
  
  /**
   * Ativa ou desativa filtro de conteúdo NSFW
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async filterNSFW(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se o bot é admin para filtros efetivos
    const isAdmin = await this.isBotAdmin(bot, group.id);
    if (!isAdmin) {
      await bot.sendMessage(group.id, '⚠️ Atenção: O bot não é administrador do grupo. Ele não poderá apagar mensagens filtradas. Para usar filtros efetivamente, adicione o bot como administrador.');
    }
    
    // Inicializa filtros se não existirem
    if (!group.filters) {
      group.filters = {};
    }
    
    // Alterna estado do filtro
    group.filters.nsfw = !group.filters.nsfw;
    await this.database.saveGroup(group);
    
    if (group.filters.nsfw) {
      return new ReturnMessage({
        chatId: group.id,
        content: '✅ Filtro de conteúdo NSFW ativado. Imagens e vídeos detectados como conteúdo adulto serão automaticamente removidos.'
      });
    } else {
      return new ReturnMessage({
        chatId: group.id,
        content: '❌ Filtro de conteúdo NSFW desativado. Imagens e vídeos não serão filtrados para conteúdo adulto.'
      });
    }
  }



  /**
   * Define reação 'depois' personalizada para um comando
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setReaction(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length < 2) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça um nome de comando e emoji. Exemplo: !g-setReact sticker 🎯'
      });
    }
    
    const commandName = args[0].toLowerCase();
    const emoji = args[1];
    
    // Verifica se é um comando fixo
    const fixedCommand = bot.eventHandler.commandHandler.fixedCommands.getCommand(commandName);
    if (fixedCommand) {
      // Atualiza reação do comando fixo
      if (!fixedCommand.reactions) {
        fixedCommand.reactions = {
          before: "⏳",
          after: emoji,
          error: "❌"
        };
      } else {
        fixedCommand.reactions.after = emoji;
      }
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Definida reação 'depois' de '${commandName}' para ${emoji}`
      });
    }
    
    // Verifica se é um comando personalizado
    const customCommands = await this.database.getCustomCommands(group.id);
    const customCommand = customCommands.find(cmd => cmd.startsWith === commandName && !cmd.deleted);
    
    if (customCommand) {
      // Inicializa reações se necessário
      if (!customCommand.reactions) {
        customCommand.reactions = {
          after: emoji,
          error: "❌"
        };
      } else {
        customCommand.reactions.after = emoji;
      }
      
      // Atualiza o comando
      await this.database.updateCustomCommand(group.id, customCommand);
      
      // Limpa cache de comandos para garantir que o comando atualizado seja carregado
      this.database.clearCache(`commands:${group.id}`);

      // Recarrega comandos
      await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Definida reação 'depois' de '${commandName}' para ${emoji}`
      });
    }
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Comando '${commandName}' não encontrado.`
    });
  }

  /**
   * Define reação 'antes' personalizada para um comando
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setStartReaction(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length < 2) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça um nome de comando e emoji. Exemplo: !g-setStartReact sticker 🎯'
      });
    }
    
    const commandName = args[0].toLowerCase();
    const emoji = args[1];
    
    // Verifica se é um comando fixo
    const fixedCommand = bot.eventHandler.commandHandler.fixedCommands.getCommand(commandName);
    if (fixedCommand) {
      // Atualiza reação do comando fixo
      if (!fixedCommand.reactions) {
        fixedCommand.reactions = {
          before: emoji,
          after: "✅",
          error: "❌"
        };
      } else {
        fixedCommand.reactions.before = emoji;
      }
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Definida reação 'antes' de '${commandName}' para ${emoji}`
      });
    }
    
    // Verifica se é um comando personalizado
    const customCommands = await this.database.getCustomCommands(group.id);
    const customCommand = customCommands.find(cmd => cmd.startsWith === commandName && !cmd.deleted);
    
    if (customCommand) {
      // Inicializa reações se necessário
      if (!customCommand.reactions) {
        customCommand.reactions = {
          before: emoji,
          error: "❌"
        };
      } else {
        customCommand.reactions.before = emoji;
      }
      
      // Atualiza o comando
      await this.database.updateCustomCommand(group.id, customCommand);
      
      // Limpa cache de comandos para garantir que o comando atualizado seja carregado
      this.database.clearCache(`commands:${group.id}`);

      // Recarrega comandos
      await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Definida reação 'antes' de '${commandName}' para ${emoji}`
      });
    }
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Comando '${commandName}' não encontrado.`
    });
  }

  /**
   * Alterna conversão automática de voz para texto em mensagens de voz em um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleAutoStt(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Alterna a configuração de auto-STT
    group.autoStt = !group.autoStt;
    
    // Atualiza grupo no banco de dados
    await this.database.saveGroup(group);
    
    // Envia mensagem de confirmação
    const statusMsg = group.autoStt ? 
      'Conversão automática de voz para texto agora está *ativada* para este grupo.' : 
      'Conversão automática de voz para texto agora está *desativada* para este grupo.';
    
    return new ReturnMessage({
      chatId: group.id,
      content: statusMsg
    });
  }

  /**
   * Gets the platform-specific channel configuration from the group
   * @param {Object} group - The group object
   * @param {string} platform - The platform ('twitch', 'kick', 'youtube')
   * @returns {Array} - Array of channel configurations for the platform
   */
  getChannelConfig(group, platform) {
    if (!group[platform]) {
      group[platform] = [];
    }
    return group[platform];
  }

  /**
   * Finds a channel configuration in the group
   * @param {Object} group - The group object
   * @param {string} platform - The platform ('twitch', 'kick', 'youtube')
   * @param {string} channelName - The channel name to find
   * @returns {Object|null} - The channel configuration or null if not found
   */
  findChannelConfig(group, platform, channelName) {
    const channels = this.getChannelConfig(group, platform);
    return channels.find(c => c.channel.toLowerCase() === channelName.toLowerCase()) || null;
  }

  /**
   * Validates and gets the channel name for commands
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @param {string} platform - The platform ('twitch', 'kick', 'youtube')
   * @returns {Promise<string|null>} - The validated channel name or null if invalid
   */
  async validateChannelName(bot, message, args, group, platform) {
    // If a channel name is provided, use it
    if (args.length > 0) {
      return args[0].toLowerCase();
    }
    
    // If no channel name provided, check if there's only one configured channel
    const channels = this.getChannelConfig(group, platform);
    
    if (channels.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Nenhum canal de ${platform} configurado. Use !g-${platform}-canal <nome do canal> para configurar.`
      });
    }
    
    if (channels.length === 1) {
      return channels[0].channel;
    }
    
    // If multiple channels, show list and instructions
    const channelsList = channels.map(c => c.channel).join(', ');
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Múltiplos canais de ${platform} configurados. Especifique o canal:\n` +
        `!g-${platform}-midia-on <canal>\n\n` +
        `Canais configurados: ${channelsList}`
    });
  }

  /**
   * Creates default notification configuration
   * @param {string} platform - The platform ('twitch', 'kick', 'youtube')
   * @param {string} channelName - The channel name
   * @returns {Object} - Default notification configuration
   */
  createDefaultNotificationConfig(platform, channelName) {
    let defaultText = '';
    
    if (platform === 'twitch' || platform === 'kick') {
      defaultText = `⚠️ ATENÇÃO!⚠️\n\n🌟 *${channelName}* ✨ está *online* streamando *{jogo}*!\n_{titulo}_\n\n` +
                   `https://${platform}.tv/${channelName}`;
    } else if (platform === 'youtube') {
      defaultText = `*⚠️ Vídeo novo! ⚠️*\n\n*{author}:* *{title}* \n{link}`;
    }
    
    return {
      media: [
        {
          type: "text",
          content: defaultText
        }
      ]
    };
  }

  /**
   * Toggles monitoring of a Twitch channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleTwitchChannel(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o nome do canal da Twitch. Exemplo: !g-twitch-canal nomeDoCanal'
      });
    }
    
    const channelName = args[0].toLowerCase();
    
    // Get current channels
    const channels = this.getChannelConfig(group, 'twitch');
    
    // Check if channel is already configured
    const existingChannel = this.findChannelConfig(group, 'twitch', channelName);
    
    if (existingChannel) {
      // Remove channel
      const updatedChannels = channels.filter(c => c.channel.toLowerCase() !== channelName.toLowerCase());
      group.twitch = updatedChannels;
      
      await this.database.saveGroup(group);
      
      // Unsubscribe from StreamMonitor if it exists
      if (bot.streamMonitor) {
        bot.streamMonitor.unsubscribe(channelName, 'twitch');
      }
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal da Twitch removido: ${channelName}`
      });
    } else {
      // Add channel with default configuration
      const newChannel = {
        channel: channelName,
        onConfig: this.createDefaultNotificationConfig('twitch', channelName),
        offConfig: {
          media: []
        },
        changeTitleOnEvent: false,
        useAI: false
      };
      
      channels.push(newChannel);
      await this.database.saveGroup(group);
      
      // Subscribe to the channel in StreamMonitor
      if (bot.streamMonitor) {
        bot.streamMonitor.subscribe(channelName, 'twitch');
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Canal da Twitch adicionado: ${channelName}\n\n` +
            `Configuração padrão de notificação "online" definida. Use !g-twitch-midia-on ${channelName} para personalizar.`
        });
      } else {
        return new ReturnMessage({
          chatId: group.id,
          content: `Canal da Twitch adicionado: ${channelName}\n\n` +
            `⚠️ Aviso: O monitoramento de streams não está inicializado no bot. Entre em contato com o administrador.`
        });
      }
    }
  }

  /**
   * Sets the "online" media notification for a Twitch channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setTwitchOnlineMedia(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'twitch');
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`
      });
    }
    
    // Verify if this is a reply to a message
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      // Reset to default if no quoted message and no additional args
      channelConfig.onConfig = this.createDefaultNotificationConfig('twitch', channelName);
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "online" para o canal ${channelName} redefinida para o padrão.`
      });
    }
    
    if (!quotedMsg) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.'
      });
    }
    
    // Handle media message
    try {
      // Create media configuration
      const mediaConfig = {
        type: "text",
        content: quotedMsg.body || ""
      };
      
      // For media messages, add the media type
      if (quotedMsg.hasMedia) {
        const media = await quotedMsg.downloadMedia();
        let mediaType = media.mimetype.split('/')[0]; // 'image', 'audio', 'video', etc.
        
        if (quotedMsg.type.toLowerCase() === "sticker") {
          mediaType = "sticker";
        }
        if (quotedMsg.type.toLowerCase() === "voice") {
          mediaType = "voice";
        }
        
        // Save media file
        let fileExt = media.mimetype.split('/')[1];
        if (fileExt.includes(";")) {
          fileExt = fileExt.split(";")[0];
        }
        
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const mediaDir = path.join(this.dataPath, 'media');
        await fs.mkdir(mediaDir, { recursive: true });
        
        const filePath = path.join(mediaDir, fileName);
        await fs.writeFile(filePath, Buffer.from(media.data, 'base64'));
        
        mediaConfig.type = mediaType;
        mediaConfig.content = fileName;
        mediaConfig.caption = quotedMsg.caption || "";
      }
      
      // Set the new config (replace existing)
      channelConfig.onConfig = {
        media: [mediaConfig]
      };
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "online" para o canal ${channelName} atualizada com sucesso.`
      });
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação "online" para o canal ${channelName}:`, error);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Erro ao configurar notificação: ${error.message}`
      });
    }
  }

  /**
   * Sets the "offline" media notification for a Twitch channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setTwitchOfflineMedia(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'twitch');
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`
      });
    }
    
    // Verify if this is a reply to a message
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      // Reset to empty if no quoted message and no additional args
      channelConfig.offConfig = {
        media: []
      };
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "offline" para o canal ${channelName} removida.`
      });
    }
    
    if (!quotedMsg) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.'
      });
    }
    
    // Handle media message (similar to setTwitchOnlineMedia)
    try {
      // Create media configuration
      const mediaConfig = {
        type: "text",
        content: quotedMsg.body || ""
      };
      
      // For media messages, add the media type
      if (quotedMsg.hasMedia) {
        const media = await quotedMsg.downloadMedia();
        let mediaType = media.mimetype.split('/')[0]; // 'image', 'audio', 'video', etc.
        
        if (quotedMsg.type.toLowerCase() === "sticker") {
          mediaType = "sticker";
        }
        if (quotedMsg.type.toLowerCase() === "voice") {
          mediaType = "voice";
        }
        
        // Save media file
        let fileExt = media.mimetype.split('/')[1];
        if (fileExt.includes(";")) {
          fileExt = fileExt.split(";")[0];
        }
        
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const mediaDir = path.join(this.dataPath, 'media');
        await fs.mkdir(mediaDir, { recursive: true });
        
        const filePath = path.join(mediaDir, fileName);
        await fs.writeFile(filePath, Buffer.from(media.data, 'base64'));
        
        mediaConfig.type = mediaType;
        mediaConfig.content = fileName;
        mediaConfig.caption = quotedMsg.caption || "";
      }
      
      // Set the new config (replace existing)
      channelConfig.offConfig = {
        media: [mediaConfig]
      };
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "offline" para o canal ${channelName} atualizada com sucesso.`
      });
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação "offline" para o canal ${channelName}:`, error);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Erro ao configurar notificação: ${error.message}`
      });
    }
  }

  /**
   * Toggles title change on stream events
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleTwitchTitleChange(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'twitch');
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`
      });
    }
    
    // Check if bot is admin in the group
    const isAdmin = await this.isBotAdmin(bot, group.id);
    
    if (!isAdmin) {
      return new ReturnMessage({
        chatId: group.id,
        content: '⚠️ O bot não é administrador do grupo. Para alterar o título do grupo, o bot precisa ser um administrador. ' +
          'Por favor, adicione o bot como administrador e tente novamente.'
      });
    }
    
    // Toggle the setting
    channelConfig.changeTitleOnEvent = !channelConfig.changeTitleOnEvent;
    
    await this.database.saveGroup(group);
    
    const status = channelConfig.changeTitleOnEvent ? 'ativada' : 'desativada';
    
    if (channelConfig.changeTitleOnEvent) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Alteração de título para eventos do canal ${channelName} ${status}.\n\n` +
          `Você pode definir títulos personalizados com:\n` +
          `!g-twitch-titulo-on ${channelName} [título]\n` +
          `!g-twitch-titulo-off ${channelName} [título]`
      });
    } else {
      return new ReturnMessage({
        chatId: group.id,
        content: `Alteração de título para eventos do canal ${channelName} ${status}.`
      });
    }
  }

  /**
   * Sets the custom "online" title for a Twitch channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setTwitchOnlineTitle(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-twitch-titulo-on nomeDoCanal Título Personalizado'
      });
    }
    
    // Get channel name (first arg) and title (remaining args)
    let channelName, customTitle;
    
    // Check if first argument is a configured channel
    const firstArg = args[0].toLowerCase();
    const channels = this.getChannelConfig(group, 'twitch');
    const isChannelArg = channels.some(c => c.channel.toLowerCase() === firstArg);
    
    if (isChannelArg) {
      channelName = firstArg;
      customTitle = args.slice(1).join(' ');
    } else if (channels.length === 1) {
      // If only one channel is configured, use it
      channelName = channels[0].channel;
      customTitle = args.join(' ');
    } else {
      // Multiple channels, none specified
      const channelsList = channels.map(c => c.channel).join(', ');
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Múltiplos canais da Twitch configurados. Especifique o canal:\n` +
          `!g-twitch-titulo-on <canal> <título>\n\n` +
          `Canais configurados: ${channelsList}`
      });
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`
      });
    }
    
    // If no title provided, remove custom title
    if (!customTitle) {
      delete channelConfig.onlineTitle;
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Título personalizado para eventos "online" do canal ${channelName} removido.\n` +
          `O bot irá substituir automaticamente "OFF" por "ON" no título do grupo quando o canal ficar online.`
      });
    }
    
    // Set custom title
    channelConfig.onlineTitle = customTitle;
    
    // Make sure title change is enabled
    if (!channelConfig.changeTitleOnEvent) {
      channelConfig.changeTitleOnEvent = true;
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Título personalizado para eventos "online" do canal ${channelName} definido: "${customTitle}"\n` +
          `Alteração de título para eventos foi automaticamente ativada.`
      });
    }
    
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Título personalizado para eventos "online" do canal ${channelName} definido: "${customTitle}"`
    });
  }

  /**
   * Sets the custom "offline" title for a Twitch channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setTwitchOfflineTitle(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-twitch-titulo-off nomeDoCanal Título Personalizado'
      });
    }
    
    // Get channel name (first arg) and title (remaining args)
    let channelName, customTitle;
    
    // Check if first argument is a configured channel
    const firstArg = args[0].toLowerCase();
    const channels = this.getChannelConfig(group, 'twitch');
    const isChannelArg = channels.some(c => c.channel.toLowerCase() === firstArg);
    
    if (isChannelArg) {
      channelName = firstArg;
      customTitle = args.slice(1).join(' ');
    } else if (channels.length === 1) {
      // If only one channel is configured, use it
      channelName = channels[0].channel;
      customTitle = args.join(' ');
    } else {
      // Multiple channels, none specified
      const channelsList = channels.map(c => c.channel).join(', ');
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Múltiplos canais da Twitch configurados. Especifique o canal:\n` +
          `!g-twitch-titulo-off <canal> <título>\n\n` +
          `Canais configurados: ${channelsList}`
      });
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`
      });
    }
    
    // If no title provided, remove custom title
    if (!customTitle) {
      delete channelConfig.offlineTitle;
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Título personalizado para eventos "offline" do canal ${channelName} removido.\n` +
          `O bot irá substituir automaticamente "ON" por "OFF" no título do grupo quando o canal ficar offline.`
      });
    }
    
    // Set custom title
    channelConfig.offlineTitle = customTitle;
    
    // Make sure title change is enabled
    if (!channelConfig.changeTitleOnEvent) {
      channelConfig.changeTitleOnEvent = true;
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Título personalizado para eventos "offline" do canal ${channelName} definido: "${customTitle}"\n` +
          `Alteração de título para eventos foi automaticamente ativada.`
      });
    }
    
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Título personalizado para eventos "offline" do canal ${channelName} definido: "${customTitle}"`
    });
  }

  /**
   * Toggles AI generated messages for stream events
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleTwitchAI(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'twitch');
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`
      });
    }
    
    // Toggle the setting
    channelConfig.useAI = !channelConfig.useAI;
    
    await this.database.saveGroup(group);
    
    const status = channelConfig.useAI ? 'ativadas' : 'desativadas';
    
    if (channelConfig.useAI) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Mensagens geradas por IA para eventos do canal ${channelName} ${status}.\n\n` +
          `O bot usará IA para gerar mensagens personalizadas quando o canal ficar online.`
      });
    } else {
      return new ReturnMessage({
        chatId: group.id,
        content: `Mensagens geradas por IA para eventos do canal ${channelName} ${status}.`
      });
    }
  }

  /**
   * Toggles monitoring of a Kick channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleKickChannel(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o nome do canal do Kick. Exemplo: !g-kick-canal nomeDoCanal'
      });
    }
    
    const channelName = args[0].toLowerCase();
    
    // Get current channels
    const channels = this.getChannelConfig(group, 'kick');
    
    // Check if channel is already configured
    const existingChannel = this.findChannelConfig(group, 'kick', channelName);
    
    if (existingChannel) {
      // Remove channel
      // Remove channel
      const updatedChannels = channels.filter(c => c.channel.toLowerCase() !== channelName.toLowerCase());
      group.kick = updatedChannels;
      
      await this.database.saveGroup(group);
      
      // Unsubscribe from StreamMonitor if it exists
      if (bot.streamMonitor) {
        bot.streamMonitor.unsubscribe(channelName, 'kick');
      }
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do Kick removido: ${channelName}`
      });
    } else {
      // Add channel with default configuration
      const newChannel = {
        channel: channelName,
        onConfig: this.createDefaultNotificationConfig('kick', channelName),
        offConfig: {
          media: []
        },
        changeTitleOnEvent: false,
        useAI: false
      };
      
      channels.push(newChannel);
      await this.database.saveGroup(group);
      
      // Subscribe to the channel in StreamMonitor
      if (bot.streamMonitor) {
        bot.streamMonitor.subscribe(channelName, 'kick');
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Canal do Kick adicionado: ${channelName}\n\n` +
            `Configuração padrão de notificação "online" definida. Use !g-kick-midia-on ${channelName} para personalizar.`
        });
      } else {
        return new ReturnMessage({
          chatId: group.id,
          content: `Canal do Kick adicionado: ${channelName}\n\n` +
            `⚠️ Aviso: O monitoramento de streams não está inicializado no bot. Entre em contato com o administrador.`
        });
      }
    }
  }

  /**
   * Sets the "online" media notification for a Kick channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setKickOnlineMedia(bot, message, args, group) {
    // This is identical to setTwitchOnlineMedia except for platform name differences
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'kick');
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    const channelConfig = this.findChannelConfig(group, 'kick', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do Kick não configurado: ${channelName}. Use !g-kick-canal ${channelName} para configurar.`
      });
    }
    
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      channelConfig.onConfig = this.createDefaultNotificationConfig('kick', channelName);
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "online" para o canal ${channelName} redefinida para o padrão.`
      });
    }
    
    if (!quotedMsg) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.'
      });
    }
    
    try {
      const mediaConfig = {
        type: "text",
        content: quotedMsg.body || ""
      };
      
      if (quotedMsg.hasMedia) {
        const media = await quotedMsg.downloadMedia();
        let mediaType = media.mimetype.split('/')[0];
        
        if(quotedMsg.type.toLowerCase() == "sticker") {
          mediaType = "sticker";
        }
        if(quotedMsg.type.toLowerCase() == "voice") {
          mediaType = "voice";
        }
        
        let fileExt = media.mimetype.split('/')[1];
        if(fileExt.includes(";")) {
          fileExt = fileExt.split(";")[0];
        }
        
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const mediaDir = path.join(this.dataPath, 'media');
        await fs.mkdir(mediaDir, { recursive: true });
        
        const filePath = path.join(mediaDir, fileName);
        await fs.writeFile(filePath, Buffer.from(media.data, 'base64'));
        
        mediaConfig.type = mediaType;
        mediaConfig.content = fileName;
        mediaConfig.caption = quotedMsg.caption || "";
      }
      
      channelConfig.onConfig = {
        media: [mediaConfig]
      };
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "online" para o canal ${channelName} atualizada com sucesso.`
      });
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação "online" para o canal ${channelName}:`, error);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Erro ao configurar notificação: ${error.message}`
      });
    }
  }

  /**
   * Sets the "offline" media notification for a Kick channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setKickOfflineMedia(bot, message, args, group) {
    // Identical to setTwitchOfflineMedia with platform name differences
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'kick');
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    const channelConfig = this.findChannelConfig(group, 'kick', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do Kick não configurado: ${channelName}. Use !g-kick-canal ${channelName} para configurar.`
      });
    }
    
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      channelConfig.offConfig = { media: [] };
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "offline" para o canal ${channelName} removida.`
      });
    }
    
    if (!quotedMsg) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.'
      });
    }
    
    try {
      // Similar media handling as in setKickOnlineMedia but for offConfig
      const mediaConfig = {
        type: "text",
        content: quotedMsg.body || ""
      };
      
      if (quotedMsg.hasMedia) {
        // Identical media handling code
        const media = await quotedMsg.downloadMedia();
        let mediaType = media.mimetype.split('/')[0];
        
        if(quotedMsg.type.toLowerCase() == "sticker") {
          mediaType = "sticker";
        }
        if(quotedMsg.type.toLowerCase() == "voice") {
          mediaType = "voice";
        }
        
        let fileExt = media.mimetype.split('/')[1];
        if(fileExt.includes(";")) {
          fileExt = fileExt.split(";")[0];
        }
        
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const mediaDir = path.join(this.dataPath, 'media');
        await fs.mkdir(mediaDir, { recursive: true });
        
        const filePath = path.join(mediaDir, fileName);
        await fs.writeFile(filePath, Buffer.from(media.data, 'base64'));
        
        mediaConfig.type = mediaType;
        mediaConfig.content = fileName;
        mediaConfig.caption = quotedMsg.caption || "";
      }
      
      channelConfig.offConfig = {
        media: [mediaConfig]
      };
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "offline" para o canal ${channelName} atualizada com sucesso.`
      });
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação "offline" para o canal ${channelName}:`, error);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Erro ao configurar notificação: ${error.message}`
      });
    }
  }

  /**
   * Toggles title change on Kick stream events
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleKickTitleChange(bot, message, args, group) {
    // Identical to Twitch version with platform name differences
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'kick');
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    const channelConfig = this.findChannelConfig(group, 'kick', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do Kick não configurado: ${channelName}. Use !g-kick-canal ${channelName} para configurar.`
      });
    }
    
    const isAdmin = await this.isBotAdmin(bot, group.id);
    
    if (!isAdmin) {
      return new ReturnMessage({
        chatId: group.id,
        content: '⚠️ O bot não é administrador do grupo. Para alterar o título do grupo, o bot precisa ser um administrador. ' +
          'Por favor, adicione o bot como administrador e tente novamente.'
      });
    }
    
    // Toggle the setting
    channelConfig.changeTitleOnEvent = !channelConfig.changeTitleOnEvent;
    
    await this.database.saveGroup(group);
    
    const status = channelConfig.changeTitleOnEvent ? 'ativada' : 'desativada';
    
    if (channelConfig.changeTitleOnEvent) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Alteração de título para eventos do canal ${channelName} ${status}.\n\n` +
          `Você pode definir títulos personalizados com:\n` +
          `!g-kick-titulo-on ${channelName} [título]\n` +
          `!g-kick-titulo-off ${channelName} [título]`
      });
    } else {
      return new ReturnMessage({
        chatId: group.id,
        content: `Alteração de título para eventos do canal ${channelName} ${status}.`
      });
    }
  }

  /**
   * Sets the custom "online" title for a Kick channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setKickOnlineTitle(bot, message, args, group) {
    // Identical to Twitch version with platform name differences
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-kick-titulo-on nomeDoCanal Título Personalizado'
      });
    }
    
    // Get channel name (first arg) and title (remaining args)
    let channelName, customTitle;
    
    // Check if first argument is a configured channel
    const firstArg = args[0].toLowerCase();
    const channels = this.getChannelConfig(group, 'kick');
    const isChannelArg = channels.some(c => c.channel.toLowerCase() === firstArg);
    
    if (isChannelArg) {
      channelName = firstArg;
      customTitle = args.slice(1).join(' ');
    } else if (channels.length === 1) {
      // If only one channel is configured, use it
      channelName = channels[0].channel;
      customTitle = args.join(' ');
    } else {
      // Multiple channels, none specified
      const channelsList = channels.map(c => c.channel).join(', ');
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Múltiplos canais do Kick configurados. Especifique o canal:\n` +
          `!g-kick-titulo-on <canal> <título>\n\n` +
          `Canais configurados: ${channelsList}`
      });
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'kick', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do Kick não configurado: ${channelName}. Use !g-kick-canal ${channelName} para configurar.`
      });
    }
    
    // If no title provided, remove custom title
    if (!customTitle) {
      delete channelConfig.onlineTitle;
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Título personalizado para eventos "online" do canal ${channelName} removido.\n` +
          `O bot irá substituir automaticamente "OFF" por "ON" no título do grupo quando o canal ficar online.`
      });
    }
    
    // Set custom title
    channelConfig.onlineTitle = customTitle;
    
    // Make sure title change is enabled
    if (!channelConfig.changeTitleOnEvent) {
      channelConfig.changeTitleOnEvent = true;
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Título personalizado para eventos "online" do canal ${channelName} definido: "${customTitle}"\n` +
          `Alteração de título para eventos foi automaticamente ativada.`
      });
    }
    
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Título personalizado para eventos "online" do canal ${channelName} definido: "${customTitle}"`
    });
  }

  /**
   * Sets the custom "offline" title for a Kick channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setKickOfflineTitle(bot, message, args, group) {
    // Identical to Twitch version with platform name differences
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-kick-titulo-off nomeDoCanal Título Personalizado'
      });
    }
    
    // Get channel name (first arg) and title (remaining args)
    let channelName, customTitle;
    
    // Check if first argument is a configured channel
    const firstArg = args[0].toLowerCase();
    const channels = this.getChannelConfig(group, 'kick');
    const isChannelArg = channels.some(c => c.channel.toLowerCase() === firstArg);
    
    if (isChannelArg) {
      channelName = firstArg;
      customTitle = args.slice(1).join(' ');
    } else if (channels.length === 1) {
      // If only one channel is configured, use it
      channelName = channels[0].channel;
      customTitle = args.join(' ');
    } else {
      // Multiple channels, none specified
      const channelsList = channels.map(c => c.channel).join(', ');
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Múltiplos canais do Kick configurados. Especifique o canal:\n` +
          `!g-kick-titulo-off <canal> <título>\n\n` +
          `Canais configurados: ${channelsList}`
      });
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'kick', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do Kick não configurado: ${channelName}. Use !g-kick-canal ${channelName} para configurar.`
      });
    }
    
    // If no title provided, remove custom title
    if (!customTitle) {
      delete channelConfig.offlineTitle;
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Título personalizado para eventos "offline" do canal ${channelName} removido.\n` +
          `O bot irá substituir automaticamente "ON" por "OFF" no título do grupo quando o canal ficar offline.`
      });
    }
    
    // Set custom title
    channelConfig.offlineTitle = customTitle;
    
    // Make sure title change is enabled
    if (!channelConfig.changeTitleOnEvent) {
      channelConfig.changeTitleOnEvent = true;
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Título personalizado para eventos "offline" do canal ${channelName} definido: "${customTitle}"\n` +
          `Alteração de título para eventos foi automaticamente ativada.`
      });
    }
    
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Título personalizado para eventos "offline" do canal ${channelName} definido: "${customTitle}"`
    });
  }

  /**
   * Toggles AI generated messages for Kick stream events
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleKickAI(bot, message, args, group) {
    // Identical to Twitch version with platform name differences
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'kick');
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'kick', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do Kick não configurado: ${channelName}. Use !g-kick-canal ${channelName} para configurar.`
      });
    }
    
    // Toggle the setting
    channelConfig.useAI = !channelConfig.useAI;
    
    await this.database.saveGroup(group);
    
    const status = channelConfig.useAI ? 'ativadas' : 'desativadas';
    
    if (channelConfig.useAI) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Mensagens geradas por IA para eventos do canal ${channelName} ${status}.\n\n` +
          `O bot usará IA para gerar mensagens personalizadas quando o canal ficar online.`
      });
    } else {
      return new ReturnMessage({
        chatId: group.id,
        content: `Mensagens geradas por IA para eventos do canal ${channelName} ${status}.`
      });
    }
  }

  /**
   * Toggles monitoring of a YouTube channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleYoutubeChannel(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o nome ou ID do canal do YouTube. Exemplo: !g-youtube-canal nomeDoCanal'
      });
    }
    
    const channelName = args[0];
    
    // Get current channels
    const channels = this.getChannelConfig(group, 'youtube');
    
    // Check if channel is already configured
    const existingChannel = this.findChannelConfig(group, 'youtube', channelName);
    
    if (existingChannel) {
      // Remove channel
      const updatedChannels = channels.filter(c => c.channel.toLowerCase() !== channelName.toLowerCase());
      group.youtube = updatedChannels;
      
      await this.database.saveGroup(group);
      
      // Unsubscribe from StreamMonitor if it exists
      if (bot.streamMonitor) {
        bot.streamMonitor.unsubscribe(channelName, 'youtube');
      }
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do YouTube removido: ${channelName}`
      });
    } else {
      // Add channel with default configuration
      const newChannel = {
        channel: channelName,
        onConfig: this.createDefaultNotificationConfig('youtube', channelName),
        offConfig: {
          media: []
        },
        changeTitleOnEvent: false,
        useAI: false
      };
      
      channels.push(newChannel);
      await this.database.saveGroup(group);
      
      // Subscribe to the channel in StreamMonitor
      if (bot.streamMonitor) {
        bot.streamMonitor.subscribe(channelName, 'youtube');
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Canal do YouTube adicionado: ${channelName}\n\n` +
            `Configuração padrão de notificação de vídeo definida. Use !g-youtube-midia-on ${channelName} para personalizar.`
        });
      } else {
        return new ReturnMessage({
          chatId: group.id,
          content: `Canal do YouTube adicionado: ${channelName}\n\n` +
            `⚠️ Aviso: O monitoramento de canais não está inicializado no bot. Entre em contato com o administrador.`
        });
      }
    }
  }

  /**
   * Sets the video notification media for a YouTube channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setYoutubeOnlineMedia(bot, message, args, group) {
    // Similar to Twitch/Kick but with YouTube specific terms
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'youtube');
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    const channelConfig = this.findChannelConfig(group, 'youtube', channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do YouTube não configurado: ${channelName}. Use !g-youtube-canal ${channelName} para configurar.`
      });
    }
    
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      channelConfig.onConfig = this.createDefaultNotificationConfig('youtube', channelName);
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação de vídeo para o canal ${channelName} redefinida para o padrão.`
      });
    }
    
    if (!quotedMsg) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.'
      });
    }
    
    // Rest of the method is identical to Twitch/Kick versions with platform name differences
    try {
      const mediaConfig = {
        type: "text",
        content: quotedMsg.body || ""
      };
      
      if (quotedMsg.hasMedia) {
        // Media handling code (identical to previous handlers)
        const media = await quotedMsg.downloadMedia();
        let mediaType = media.mimetype.split('/')[0];
        
        if(quotedMsg.type.toLowerCase() == "sticker") {
          mediaType = "sticker";
        }
        if(quotedMsg.type.toLowerCase() == "voice") {
          mediaType = "voice";
        }
        
        let fileExt = media.mimetype.split('/')[1];
        if(fileExt.includes(";")) {
          fileExt = fileExt.split(";")[0];
        }
        
        const fileName = `${Date.now()}-${Math.floor(Math.random() * 1000)}.${fileExt}`;
        const mediaDir = path.join(this.dataPath, 'media');
        await fs.mkdir(mediaDir, { recursive: true });
        
        const filePath = path.join(mediaDir, fileName);
        await fs.writeFile(filePath, Buffer.from(media.data, 'base64'));
        
        mediaConfig.type = mediaType;
        mediaConfig.content = fileName;
        mediaConfig.caption = quotedMsg.caption || "";
      }
      
      channelConfig.onConfig = {
        media: [mediaConfig]
      };
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação de vídeo para o canal ${channelName} atualizada com sucesso.`
      });
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação de vídeo para o canal ${channelName}:`, error);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Erro ao configurar notificação: ${error.message}`
      });
    }
  }

  /**
   * Sets a nickname for a user in a group
   * @param {WhatsAppBot} bot - Bot instance
   * @param {Object} message - Message data
   * @param {Array} args - Command arguments
   * @param {Object} group - Group data
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setUserNickname(bot, message, args, group) {
    try {
      if (!group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      // If no args, show current nickname if exists
      if (args.length === 0) {
        const userNick = this.getUserNickname(group, message.author);
        if (userNick) {
          return new ReturnMessage({
            chatId: group.id,
            content: `Seu apelido atual é: ${userNick}`
          });
        } else {
          return new ReturnMessage({
            chatId: group.id,
            content: 'Você não tem um apelido definido. Use !g-apelido [apelido] para definir um.'
          });
        }
      }
      
      // Get nickname from arguments
      let nickname = args.join(' ');
      
      // Limit to 20 characters
      if (nickname.length > 20) {
        nickname = nickname.substring(0, 20);
        
        return new ReturnMessage({
          chatId: group.id,
          content: `O apelido foi limitado a 20 caracteres: ${nickname}`
        });
      }
      
      // Initialize nicks array if it doesn't exist
      if (!group.nicks) {
        group.nicks = [];
      }
      
      // Check if user already has a nickname
      const existingIndex = group.nicks.findIndex(nick => nick.numero === message.author);
      
      if (existingIndex !== -1) {
        // Update existing nickname
        group.nicks[existingIndex].apelido = nickname;
      } else {
        // Add new nickname
        group.nicks.push({
          numero: message.author,
          apelido: nickname
        });
      }
      
      // Save group data
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Apelido definido: ${nickname}`
      });
    } catch (error) {
      this.logger.error('Erro ao definir apelido:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao definir apelido. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Gets a user's nickname from the group
   * @param {Object} group - Group data
   * @param {string} userId - User ID
   * @returns {string|null} - User's nickname or null if not set
   */
  getUserNickname(group, userId) {
    if (!group || !group.nicks || !Array.isArray(group.nicks)) {
      return null;
    }
    
    const nickData = group.nicks.find(nick => nick.numero === userId);
    return nickData ? nickData.apelido : null;
  }

  /**
   * Ignores messages from a specific number
   * @param {WhatsAppBot} bot - Bot instance
   * @param {Object} message - Message data
   * @param {Array} args - Command arguments
   * @param {Object} group - Group data
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async ignoreUser(bot, message, args, group) {
    try {
      if (!group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      if (args.length === 0) {
        // Show currently ignored users
        if (!group.ignoredNumbers || !Array.isArray(group.ignoredNumbers) || group.ignoredNumbers.length === 0) {
          return new ReturnMessage({
            chatId: group.id,
            content: 'Nenhum número está sendo ignorado neste grupo.'
          });
        } else {
          let ignoredList = '*Números ignorados:*\n';
          group.ignoredNumbers.forEach(number => {
            ignoredList += `- ${number}\n`;
          });
          
          return new ReturnMessage({
            chatId: group.id,
            content: ignoredList
          });
        }
      }
      
      // Get number from argument and clean it (keep only digits)
      let number = args[0].replace(/\D/g, '');
      
      // Check if number has at least 8 digits
      if (number.length < 8) {
        return new ReturnMessage({
          chatId: group.id,
          content: 'O número deve ter pelo menos 8 dígitos.'
        });
      }
      
      // Initialize ignoredNumbers array if it doesn't exist
      if (!group.ignoredNumbers) {
        group.ignoredNumbers = [];
      }
      
      // Check if number is already in the list
      const index = group.ignoredNumbers.indexOf(number);
      
      if (index !== -1) {
        // Remove number from ignored list
        group.ignoredNumbers.splice(index, 1);
        await this.database.saveGroup(group);
        
        return new ReturnMessage({
          chatId: group.id,
          content: `O número ${number} não será mais ignorado.`
        });
      } else {
        // Add number to ignored list
        group.ignoredNumbers.push(number);
        await this.database.saveGroup(group);
        
        return new ReturnMessage({
          chatId: group.id,
          content: `O número ${number} será ignorado.`
        });
      }
    } catch (error) {
      this.logger.error('Erro ao ignorar usuário:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao processar comando. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Mutes messages starting with a specific string
   * @param {WhatsAppBot} bot - Bot instance
   * @param {Object} message - Message data
   * @param {Array} args - Command arguments
   * @param {Object} group - Group data
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async muteCommand(bot, message, args, group) {
    try {
      if (!group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      if (args.length === 0) {
        // Show currently muted strings
        if (!group.mutedStrings || !Array.isArray(group.mutedStrings) || group.mutedStrings.length === 0) {
          return new ReturnMessage({
            chatId: group.id,
            content: 'Nenhuma string está sendo ignorada neste grupo.'
          });
        } else {
          let mutedList = '*Strings ignoradas:*\n';
          group.mutedStrings.forEach(str => {
            mutedList += `- "${str}"\n`;
          });
          
          return new ReturnMessage({
            chatId: group.id,
            content: mutedList
          });
        }
      }
      
      // Get the string to mute (full argument string)
      const muteString = args.join(' ');
      
      // Initialize mutedStrings array if it doesn't exist
      if (!group.mutedStrings) {
        group.mutedStrings = [];
      }
      
      // Check if string is already in the list
      const index = group.mutedStrings.indexOf(muteString);
      
      if (index !== -1) {
        // Remove string from muted list
        group.mutedStrings.splice(index, 1);
        await this.database.saveGroup(group);
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Mensagens começando com "${muteString}" não serão mais ignoradas.`
        });
      } else {
        // Add string to muted list
        group.mutedStrings.push(muteString);
        await this.database.saveGroup(group);
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Mensagens começando com "${muteString}" serão ignoradas.`
        });
      }
    } catch (error) {
      this.logger.error('Erro ao configurar mute:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao processar comando. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Add custom admin
   * @param {WhatsAppBot} bot - Bot instance
   * @param {Object} message - Message data
   * @param {Array} args - Command arguments
   * @param {Object} group - Group data
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async customAdmin(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      // Mostra lista atual de admins adicionais
      const admins = group.additionalAdmins || [];
      if (admins.length === 0) {
        return new ReturnMessage({
          chatId: group.id,
          content: 'Não há administradores adicionais configurados para este grupo.'
        });
      } else {
        let adminList = '*Administradores adicionais:*\n';
        for (const admin of admins) {
          // Formata o número para exibição
          const formattedNumber = this.formatPhoneNumber(admin);
          adminList += `- ${formattedNumber}\n`;
        }
        
        return new ReturnMessage({
          chatId: group.id,
          content: adminList
        });
      }
    }
    
    // Obtém e formata o número do argumento
    let numero = args[0].replace(/\D/g, '');
    
    // Verifica se o número tem pelo menos 8 dígitos
    if (numero.length < 8) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'O número deve ter pelo menos 8 dígitos.'
      });
    }
    
    // Formata o número como 123456789012@c.us
    if (!numero.includes('@')) {
      numero = `${numero}@c.us`;
    }
    
    // Inicializa additionalAdmins se não existir
    if (!group.additionalAdmins) {
      group.additionalAdmins = [];
    }
    
    // Verifica se o número já está na lista
    const index = group.additionalAdmins.indexOf(numero);
    
    if (index !== -1) {
      // Remove o número
      group.additionalAdmins.splice(index, 1);
      await this.database.saveGroup(group);
      
      // Exibe a lista atualizada
      const admins = group.additionalAdmins || [];
      if (admins.length === 0) {
        return new ReturnMessage({
          chatId: group.id,
          content: `Número removido da lista de administradores adicionais: ${this.formatPhoneNumber(numero)}\n\n` +
            `Lista de administradores adicionais está vazia agora.`
        });
      } else {
        let adminList = '*Administradores adicionais:*\n';
        for (const admin of admins) {
          const formattedNumber = this.formatPhoneNumber(admin);
          adminList += `- ${formattedNumber}\n`;
        }
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Número removido da lista de administradores adicionais: ${this.formatPhoneNumber(numero)}\n\n` +
            adminList
        });
      }
    } else {
      // Adiciona o número
      group.additionalAdmins.push(numero);
      await this.database.saveGroup(group);
      
      // Exibe a lista atualizada
      let adminList = '*Administradores adicionais:*\n';
      for (const admin of group.additionalAdmins) {
        const formattedNumber = this.formatPhoneNumber(admin);
        adminList += `- ${formattedNumber}\n`;
      }
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Número adicionado à lista de administradores adicionais: ${this.formatPhoneNumber(numero)}\n\n` +
          adminList
      });
    }
  }

  // Método auxiliar para formatar números de telefone
  formatPhoneNumber(phoneNumber) {
    // Remove a parte @c.us
    let number = phoneNumber.replace('@c.us', '');
    
    // Formata como +XX (XX) 9XXXX-XXXX se tiver comprimento suficiente
    if (number.length >= 12) {
      return `+${number.substring(0, 2)} (${number.substring(2, 4)}) ${number.substring(4, 9)}-${number.substring(9)}`;
    } else {
      return number;
    }
  }

  /**
   * Pausa ou retoma a atividade do bot no grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async pauseGroup(bot, message, args, group) {
    try {
      if (!group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      // Alterna o estado de pausa do grupo
      group.paused = !group.paused;
      
      // Salva a configuração atualizada
      await this.database.saveGroup(group);
      
      if (group.paused) {
        return new ReturnMessage({
          chatId: group.id,
          content: '⏸️ Bot pausado neste grupo. Somente o comando `!g-pausar` será processado até que seja reativado.'
        });
      } else {
        return new ReturnMessage({
          chatId: group.id,
          content: '▶️ Bot reativado neste grupo. Todos os comandos estão disponíveis novamente.'
        });
      }
    } catch (error) {
      this.logger.error('Erro ao pausar/retomar grupo:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao processar comando. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Define tempo de timeout da roleta russa (comando de administrador)
   * @param {WhatsAppBot} bot Instância do bot
   * @param {Object} message Dados da mensagem
   * @param {Array} args Argumentos do comando
   * @param {Object} group Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async definirTempoRoleta(bot, message, args, group) {
    try {
      // Verifica se está em um grupo
      if (!message.group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      const groupId = message.group;
      
      // Verifica se há argumento de tempo
      if (args.length === 0 || isNaN(parseInt(args[0]))) {
        return new ReturnMessage({
          chatId: groupId,
          content: 'Por favor, forneça um tempo em segundos. Exemplo: !g-setTempoRoleta 300'
        });
      }
      
      // Obtém e valida o tempo
      let segundos = parseInt(args[0]);
      
      // Limita o tempo máximo
      if (segundos > 3600) {
        segundos = 3600;
      } else if (segundos < 10) {
        segundos = 10; // Mínimo de 10 segundos
      }
      
      // Carrega dados da roleta
      let dados = await carregarDadosRoleta();
      
      // Inicializa dados do grupo se necessário
      dados = inicializarGrupo(dados, groupId);
      
      // Atualiza tempo de timeout
      dados.grupos[groupId].tempoTimeout = segundos;
      
      // Salva dados
      await salvarDadosRoleta(dados);
      
      // Formata tempo para exibição
      const minutos = Math.floor(segundos / 60);
      const segundosRestantes = segundos % 60;
      let tempoFormatado = '';
      
      if (minutos > 0) {
        tempoFormatado += `${minutos} minuto(s)`;
        if (segundosRestantes > 0) {
          tempoFormatado += ` e ${segundosRestantes} segundo(s)`;
        }
      } else {
        tempoFormatado = `${segundos} segundo(s)`;
      }
      
      return new ReturnMessage({
        chatId: groupId,
        content: `⏱️ Tempo de "morte" na roleta russa definido para ${tempoFormatado}.`
      });
    } catch (error) {
      this.logger.error('Erro ao definir tempo de roleta:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao definir tempo da roleta russa. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Alterna interações automáticas para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleInteraction(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Inicializa objeto de interação se não existir
    if (!group.interact) {
      group.interact = {
        enabled: false,
        chance: 100, // Padrão: 1%
        cooldown: 30, // Padrão: 30 minutos
        lastInteraction: 0
      };
    }
    
    // Alterna estado de habilitado
    group.interact.enabled = !group.interact.enabled;
    
    // Salva mudanças
    await this.database.saveGroup(group);
    
    // Constrói mensagem de resposta
    let response = group.interact.enabled
      ? 'Interações automáticas **ativadas** para este grupo.\n\n'
      : 'Interações automáticas **desativadas** para este grupo.\n\n';
    
    if (group.interact.enabled) {
      response += `📊 Chance atual: ${group.interact.chance/100}% (${group.interact.chance}/10000)\n`;
      response += `⏱️ Cooldown atual: ${group.interact.cooldown} minutos\n\n`;
      response += 'Use `!g-interagir-chance` e `!g-interagir-cd` para ajustar estes valores.';
    }
    
    return new ReturnMessage({
      chatId: group.id,
      content: response
    });
  }

  /**
   * Define o cooldown para interações automáticas
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setInteractionCooldown(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Inicializa objeto de interação se não existir
    if (!group.interact) {
      group.interact = {
        enabled: false,
        chance: 100, // Padrão: 1%
        cooldown: 30, // Padrão: 30 minutos
        lastInteraction: 0
      };
    }
    
    // Verifica se valor de cooldown foi fornecido
    if (args.length === 0 || isNaN(parseInt(args[0]))) {
      return new ReturnMessage({
        chatId: group.id,
        content: `⏱️ Cooldown atual: ${group.interact.cooldown} minutos\n\nUse !g-interagir-cd [minutos] para alterar. Valores entre 5 minutos e 30 dias (43200 minutos).`
      });
    }
    
    // Analisa e valida o cooldown
    let cooldown = parseInt(args[0]);
    if (cooldown < 5) cooldown = 5; // Mínimo 5 minutos
    if (cooldown > 43200) cooldown = 43200; // Máximo 30 dias
    
    // Atualiza cooldown
    group.interact.cooldown = cooldown;
    
    // Salva mudanças
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `⏱️ Cooldown de interações definido para ${cooldown} minutos.`
    });
  }

  /**
   * Define a chance para interações automáticas
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setInteractionChance(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Inicializa objeto de interação se não existir
    if (!group.interact) {
      group.interact = {
        enabled: false,
        chance: 100, // Padrão: 1%
        cooldown: 30, // Padrão: 30 minutos
        lastInteraction: 0
      };
    }
    
    // Verifica se valor de chance foi fornecido
    if (args.length === 0 || isNaN(parseInt(args[0]))) {
      return new ReturnMessage({
        chatId: group.id,
        content: `📊 Chance atual: ${group.interact.chance/100}% (${group.interact.chance}/10000)\n\nUse !g-interagir-chance [1-1000] para alterar. Valores entre 0.01% e 10%.`
      });
    }
    
    // Analisa e valida a chance
    let chance = parseInt(args[0]);
    if (chance < 1) chance = 1; // Mínimo 0.01%
    if (chance > 1000) chance = 1000; // Máximo 10%
    
    // Atualiza chance
    group.interact.chance = chance;
    
    // Salva mudanças
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `📊 Chance de interações definida para ${chance/100}% (${chance}/10000).`
    });
  }
}

module.exports = Management;