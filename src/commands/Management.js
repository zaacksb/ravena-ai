const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const NSFWPredict = require('../utils/NSFWPredict');
const ReturnMessage = require('../models/ReturnMessage');
const { inicializarGrupo, carregarDadosRoleta, salvarDadosRoleta } = require('../functions/RoletaRussaCommands.js');

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
        description: 'ID/Nome do grupo (nome stickers, gerenciamento)'
      },
      'addCmd': {
        method: 'addCustomCommand',
        description: 'Cria um comando personalizado'
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
        description: 'Altera o prefixo de comandos (padrão !)'
      },
      'setBemvindo': {
        method: 'setWelcomeMessage',
        description: 'Mensagem quando alguém entra '
      },
      'setDespedida': {
        method: 'setFarewellMessage',
        description: 'Mensagem quando alguém sai/é removido'
      },
      'cmdReact': {
        method: 'setReaction',
        description: 'Reaçao pós-comando (apeas cmds do grupo)'
      },
      'cmdStartReact': {
        method: 'setStartReaction',
        description: 'Reaçao pré-comando (apeas cmds do grupo)'
      },
      'autoStt': {
        method: 'toggleAutoStt',
        description: 'Ativa/desativa conversão automática de voz para texto'
      },
      'info': {
        method: 'showGroupInfo',
        description: 'Mostra informações detalhadas do grupo (debug)'
      },
      'manage': {
        method: 'manageCommand',
        description: 'Ativa o gerenciamento do grupo pelo PV do bot (apenas g-xxx)'
      },
      'filtro-palavra': {
        method: 'filterWord',
        description: 'Apaga mensagens com a palavra/frase especificada'
      },
      'filtro-links': {
        method: 'filterLinks',
        description: 'Apaga mensagens com links'
      },
      'filtro-pessoa': {
        method: 'filterPerson',
        description: 'Apaga mensagens desta pessoa'
      },
      'filtro-nsfw': {
        method: 'filterNSFW',
        description: 'Apaga mensagens NSFW'
      },
      'apelido': {
        method: 'setUserNickname',
        description: 'Define seu apelido no grupo'
      },
      'ignorar': {
        method: 'ignoreUser',
        description: 'O bot irá ignorar as mensagens desta pessoa'
      },
      'mute': {
        method: 'muteCommand',
        description: 'Desativa comando com a palavra especificada'
      },
      'customAdmin': {
        method: 'customAdmin',
        description: 'Adiciona pessoas como administradoras fixas do bot no grupo'
      },
      'pausar': {
        method: 'pauseGroup',
        description: 'Pausa/retoma a atividade do bot no grupo'
      },
      'setTempoRoleta': {
        method: 'definirTempoRoleta',
        description: 'Define tempo de timeout da roleta russa'
      },
      'roleta-reset':{
        method: 'resetRoletaRanking',
        description: 'Apaga os dados do ranking atuais da roleta russa'
      },
      'pesca-reset': {
        method: 'resetPescaRanking',
        description: 'Reseta o ranking do jogo de pesca'
      },
      'geo-reset': {
        method: 'resetGeoguesserRanking',
        description: 'Reseta o ranking do jogo Geoguesser'
      },
      'stop-reset': {
        method: 'resetStopGameRanking',
        description: 'Reseta o ranking do jogo Stop/Adedona'
      },
      'pinto-reset': {
        method: 'resetPintoRanking',
        description: 'Reseta o ranking do jogo Pinto'
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
      'fechar': { 
        method: 'closeGroup',
        description: 'Fecha o grupo (apenas admins enviam msgs)' 
      },
      'abrir': { 
        method: 'openGroup',
        description: 'Abre o grupo (todos podem envar msgs)' 
      },
      'setApelido': { 
        method: 'setUserNicknameAdmin',
        description: 'Define um apelido para um usuário específico' 
      },
      'cmd-setHoras': {
        method: 'setCmdAllowedHours',
        description: 'Define horários permitidos para um comando'
      },
      'cmd-setDias': {
        method: 'setCmdAllowedDays',
        description: 'Define dias permitidos para um comando'
      },
      'twitch-canal': {
        method: 'toggleTwitchChannel',
        description: 'Adiciona/remove canal da Twitch para monitoramento'
      },
      'twitch-mudarTitulo': {
        method: 'toggleTwitchTitleChange',
        description: 'Ativa/desativa mudança de título do grupo para eventos da Twitch'
      },
      'twitch-titulo': {
        method: 'setTwitchTitle',
        description: 'Define título do grupo para eventos de canal da Twitch'
      },
      'twitch-fotoGrupo': {
        method: 'setTwitchGroupPhoto',
        description: 'Define foto do grupo para eventos de canal da Twitch'
      },
      'twitch-midia': {
        method: 'setTwitchMedia',
        description: 'Define mídia para notificação de canal da Twitch'
      },
      'twitch-midia-del': {
        method: 'deleteTwitchMedia',
        description: 'Remove mídia específica da notificação de canal da Twitch'
      },
      'twitch-usarIA': {
        method: 'toggleTwitchAI',
        description: 'Ativa/desativa uso de IA para gerar mensagens de notificação'
      },
      'twitch-usarThumbnail': {
        method: 'toggleTwitchThumbnail',
        description: 'Ativa/desativa o envio da thumbnail da stream junto com o texto'
      },
      'twitch-marcar': {
        method: 'toggleTwitchMentions',
        description: 'Ativa/desativa menção a todos os membros nas notificações de canal da Twitch'
      },
      'kick-canal': {
        method: 'toggleKickChannel',
        description: 'Adiciona/remove canal do Kick para monitoramento'
      },
      'kick-mudarTitulo': {
        method: 'toggleKickTitleChange',
        description: 'Ativa/desativa mudança de título do grupo para eventos do Kick'
      },
      'kick-titulo': {
        method: 'setKickTitle',
        description: 'Define título do grupo para eventos de canal do Kick'
      },
      'kick-fotoGrupo': {
        method: 'setKickGroupPhoto',
        description: 'Define foto do grupo para eventos de canal do Kick'
      },
      'kick-midia': {
        method: 'setKickMedia',
        description: 'Define mídia para notificação de canal do Kick'
      },
      'kick-midia-del': {
        method: 'deleteKickMedia',
        description: 'Remove mídia específica da notificação de canal do Kick'
      },
      'kick-usarIA': {
        method: 'toggleKickAI',
        description: 'Ativa/desativa uso de IA para gerar mensagens de notificação'
      },
      'kick-marcar': {
        method: 'toggleKickMentions',
        description: 'Ativa/desativa menção a todos os membros nas notificações de canal do Kick'
      },
      'youtube-canal': {
        method: 'toggleYoutubeChannel',
        description: 'Adiciona/remove canal do YouTube para monitoramento'
      },
      'youtube-mudarTitulo': {
        method: 'toggleYoutubeTitleChange',
        description: 'Ativa/desativa mudança de título do grupo para eventos do YouTube'
      },
      'youtube-titulo': {
        method: 'setYoutubeTitle',
        description: 'Define título do grupo para eventos de canal do YouTube'
      },
      'youtube-fotoGrupo': {
        method: 'setYoutubeGroupPhoto',
        description: 'Define foto do grupo para eventos de canal do YouTube'
      },
      'youtube-midia': {
        method: 'setYoutubeMedia',
        description: 'Define mídia para notificação de canal do YouTube'
      },
      'youtube-midia-del': {
        method: 'deleteYoutubeMedia',
        description: 'Remove mídia específica da notificação de canal do YouTube'
      },
      'youtube-usarIA': {
        method: 'toggleYoutubeAI',
        description: 'Ativa/desativa uso de IA para gerar mensagens de notificação'
      },
      'youtube-marcar': {
        method: 'toggleYoutubeMentions',
        description: 'Ativa/desativa menção a todos os membros nas notificações de canal do YouTube'
      },
      'variaveis': {
        method: 'listVariables',
        description: 'Lista todas as variáveis disponíveis para comandos personalizados'
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

    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça um gatilho para o comando personalizado. Exemplo: !g-addCmd saudação'
      });
    }

    let commandTrigger = args.join(' ').toLowerCase();

    // Verifica se a mensagem é uma resposta
    const quotedMsg = await message.origin.getQuotedMessage();

    let bodyTexto;
    if (!quotedMsg) {
      if(args.length > 1){
        bodyTexto = args.slice(1).join(" ");
        commandTrigger = args[0];
      } else {
        return new ReturnMessage({
          chatId: group.id,
          content: 'Este comando deve ser usado como resposta a uma mensagem.'
        });
      }
    } else {
      bodyTexto = quotedMsg.body ?? quotedMsg._data.body;
    }
    
    
    
    
    // Obtém o conteúdo da mensagem citada
    let responseContent = false;
    
    // Trata mensagens de mídia
    if (quotedMsg?.hasMedia) {
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
      responseContent = bodyTexto;
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
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o comando para adicionar uma resposta. Exemplo: !g-addCmdReply saudação'
      });
    }
    
    let commandTrigger = args.join(' ').toLowerCase();

    // Verifica se a mensagem é uma resposta
    const quotedMsg = await message.origin.getQuotedMessage();

    let bodyTexto;
    if (!quotedMsg) {
      if(args.length > 1){
        bodyTexto = args.slice(1).join(" ");
        commandTrigger = args[0];
      } else {
        return new ReturnMessage({
          chatId: group.id,
          content: 'Este comando deve ser usado como resposta a uma mensagem.'
        });
      }
    } else {
      bodyTexto = quotedMsg.body ?? quotedMsg._data.body;
    }
    

    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    
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
    let responseContent = bodyTexto;
    
    // Trata mensagens de mídia
    if (quotedMsg?.hasMedia) {
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
  
  // Verifica se a mensagem é uma resposta a outra mensagem
  const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
  
  // Se tiver mensagem citada, usa o corpo dela
  if (quotedMsg && quotedMsg.body) {
    // Atualiza mensagem de boas-vindas do grupo
    if (!group.greetings) {
      group.greetings = {};
    }
    group.greetings.text = quotedMsg.body;
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Mensagem de boas-vindas atualizada para: ${quotedMsg.body}`
    });
  } 
  // Se tiver argumentos, usa o corpo da mensagem completa
  else if (message.origin && message.origin.body) {
    // Extrai o texto após o comando
    const prefixo = group.prefix || '!';
    const comandoCompleto = `${prefixo}g-setBoasvindas`;
    const texto = message.origin.body.substring(message.origin.body.indexOf(comandoCompleto) + comandoCompleto.length).trim();
    
    // Se não tem texto, desativa a mensagem de boas-vindas
    if (!texto) {
      if (group.greetings) {
        delete group.greetings.text;
      }
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: 'Mensagem de boas-vindas desativada.'
      });
    }
    
    // Atualiza mensagem de boas-vindas do grupo
    if (!group.greetings) {
      group.greetings = {};
    }
    group.greetings.text = texto;
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Mensagem de boas-vindas atualizada para: ${texto}`
    });
  }
  else {
    // Se não tem argumentos nem mensagem citada, mostra a mensagem atual ou instrui como usar
    if (group.greetings && group.greetings.text) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Mensagem de boas-vindas atual: ${group.greetings.text}\n\nPara alterar, use:\n!g-setBoasvindas Nova mensagem\nou responda a uma mensagem com !g-setBoasvindas`
      });
    } else {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Não há mensagem de boas-vindas definida. Para definir, use:\n!g-setBoasvindas Bem-vindo ao grupo {tituloGrupo} (id {nomeGrupo}), {pessoa}!\nou responda a uma mensagem com !g-setBoasvindas'
      });
    }
  }
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
    
    // Verifica se a mensagem é uma resposta a outra mensagem
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    // Se tiver mensagem citada, usa o corpo dela
    if (quotedMsg && quotedMsg.body) {
      // Atualiza mensagem de despedida do grupo
      if (!group.farewells) {
        group.farewells = {};
      }
      group.farewells.text = quotedMsg.body;
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Mensagem de despedida atualizada para: ${quotedMsg.body}`
      });
    } 
    // Se tiver argumentos, usa o corpo da mensagem completa
    else if (message.origin && message.origin.body) {
      // Extrai o texto após o comando
      const prefixo = group.prefix || '!';
      const comandoCompleto = `${prefixo}g-setDespedida`;
      const texto = message.origin.body.substring(message.origin.body.indexOf(comandoCompleto) + comandoCompleto.length).trim();
      
      // Se não tem texto, desativa a mensagem de despedida
      if (!texto) {
        if (group.farewells) {
          delete group.farewells.text;
        }
        await this.database.saveGroup(group);
        
        return new ReturnMessage({
          chatId: group.id,
          content: 'Mensagem de despedida desativada.'
        });
      }
      
      // Atualiza mensagem de despedida do grupo
      if (!group.farewells) {
        group.farewells = {};
      }
      group.farewells.text = texto;
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Mensagem de despedida atualizada para: ${texto}`
      });
    }
    else {
      // Se não tem argumentos nem mensagem citada, mostra a mensagem atual ou instrui como usar
      if (group.farewells && group.farewells.text) {
        return new ReturnMessage({
          chatId: group.id,
          content: `Mensagem de despedida atual: ${group.farewells.text}\n\nPara alterar, use:\n!g-setDespedida Nova mensagem\nou responda a uma mensagem com !g-setDespedida`
        });
      } else {
        return new ReturnMessage({
          chatId: group.id,
          content: 'Não há mensagem de despedida definida. Para definir, use:\n!g-setDespedida Adeus, {pessoa}!\nou responda a uma mensagem com !g-setDespedida'
        });
      }
    }
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
  *!g-setPrefixo* <prefixo> - Altera o prefixo de comando
  *!g-setBoasvindas* <mensagem> - Define mensagem de boas-vindas para novos membros
  *!g-setDespedida* <mensagem> - Define mensagem de despedida para membros que saem
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
        ? 'Sim' 
        : 'Não';
      
      const personFilters = group.filters && group.filters.people && group.filters.people.length > 0
        ? group.filters.people.join(', ')
        : 'Nenhuma pessoa filtrada';
      
      const nsfwFiltering = group.filters && group.filters.nsfw 
        ? 'Sim' 
        : 'Não';
      
      // Formata data de criação
      const creationDate = new Date(group.createdAt).toLocaleString("pt-BR");
      
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
      
      // Função auxiliar para formatar as configurações de mídia
      const formatMediaConfig = (config) => {
        if (!config || !config.media || config.media.length === 0) {
          return "Nenhuma mídia configurada";
        }
        
        const mediaTypes = config.media.reduce((types, media) => {
          if (!types.includes(media.type)) {
            types.push(media.type);
          }
          return types;
        }, []);
        
        return mediaTypes.join(", ");
      };
      
      // Constrói mensagem informativa
      let infoMessage = `*📊 Informações do Grupo*\n\n`;
      infoMessage += `*Nome:* ${group.name}\n`;
      infoMessage += `*ID:* ${group.id}\n`;
      infoMessage += `*Prefixo:* "${group.prefix}"\n`;
      infoMessage += `*Data de Criação:* ${creationDate}\n`;
      infoMessage += `*Pausado:* ${group.paused ? 'Sim' : 'Não'}\n\n`;
      
      // Adiciona informações de admins adicionais
      const admins = group.additionalAdmins || [];
      if (admins.length > 0) {
        infoMessage += `*Administradores Adicionais:* ${admins.length}\n`;
        for (let i = 0; i < Math.min(3, admins.length); i++) {
          infoMessage += `- ${this.formatPhoneNumber(admins[i])}\n`;
        }
        if (admins.length > 3) {
          infoMessage += `... e mais ${admins.length - 3} administradores\n`;
        }
        infoMessage += '\n';
      }
      
      // Adiciona informações de armazenamento
      infoMessage += `*Armazenamento:*\n`;
      infoMessage += `- *Arquivos:* ${filesInfo.totalFiles} arquivos\n`;
      infoMessage += `- *Espaço usado:* ${formatSize(filesInfo.totalSize)}\n\n`;
      
      infoMessage += `*Configurações de Mensagens:*\n`;
      infoMessage += `- *Boas-vindas:* ${welcomeMessage}\n`;
      infoMessage += `- *Despedidas:* ${farewellMessage}\n`;
      infoMessage += `- *Auto-STT:* ${group.autoStt ? 'Sim' : 'Não'}\n\n`;
      
      infoMessage += `*Filtros:*\n`;
      infoMessage += `- *Palavras:* ${wordFilters}\n`;
      infoMessage += `- *Links:* ${linkFiltering}\n`;
      infoMessage += `- *Pessoas:* ${personFilters}\n`;
      infoMessage += `- *NSFW:* ${nsfwFiltering}\n\n`;
      
      // Adiciona informações de interações automáticas
      if (group.interact) {
        infoMessage += `*Interações Automáticas:*\n`;
        infoMessage += `- *Ativado:* ${group.interact.enabled ? 'Sim' : 'Não'}\n`;
        infoMessage += `- *Chance:* ${group.interact.chance/100}% (${group.interact.chance}/10000)\n`;
        infoMessage += `- *Cooldown:* ${group.interact.cooldown} minutos\n\n`;
      }
      
      // SEÇÃO DETALHADA: Adiciona informações de streams configurados
      infoMessage += `*Canais Monitorados:*\n`;
      
      // Twitch
      if (twitchChannels.length > 0) {
        infoMessage += `*Twitch (${twitchChannels.length}):*\n`;
        
        for (const channel of twitchChannels) {
          infoMessage += `- *${channel.channel}*:\n`;
          
          // Tipos de mídia configurados para online/offline
          const onlineMedia = formatMediaConfig(channel.onConfig);
          const offlineMedia = formatMediaConfig(channel.offConfig);
          
          infoMessage += `  • Mídias Online: ${onlineMedia}\n`;
          infoMessage += `  • Mídias Offline: ${offlineMedia}\n`;
          
          // Configurações adicionais
          infoMessage += `  • Mudar título do grupo: ${channel.changeTitleOnEvent ? 'Sim' : 'Não'}\n`;
          
          if (channel.changeTitleOnEvent) {
            if (channel.onlineTitle) {
              infoMessage += `  • Título Online: "${channel.onlineTitle}"\n`;
            }
            if (channel.offlineTitle) {
              infoMessage += `  • Título Offline: "${channel.offlineTitle}"\n`;
            }
          }
          
          infoMessage += `  • Marcar Todos: ${channel.mentionAllMembers ? 'Sim' : 'Não'}\n`;
          infoMessage += `  • Usar Thumbnail: ${channel.useThumbnail ? 'Sim' : 'Não'}\n`;
          infoMessage += `  • Usar IA: ${channel.useAI ? 'Sim' : 'Não'}\n`;
          
          if (channel.groupPhotoOnline) {
            infoMessage += `  • Foto de grupo Online: Configurada\n`;
          }
          
          if (channel.groupPhotoOffline) {
            infoMessage += `  • Foto de grupo Offline: Configurada\n`;
          }
          
          infoMessage += '\n';
        }
      }
      
      // Kick
      if (kickChannels.length > 0) {
        infoMessage += `*Kick (${kickChannels.length}):*\n`;
        
        for (const channel of kickChannels) {
          infoMessage += `- *${channel.channel}*:\n`;
          
          // Tipos de mídia configurados para online/offline
          const onlineMedia = formatMediaConfig(channel.onConfig);
          const offlineMedia = formatMediaConfig(channel.offConfig);
          
          infoMessage += `  • Mídias Online: ${onlineMedia}\n`;
          infoMessage += `  • Mídias Offline: ${offlineMedia}\n`;
          
          // Configurações adicionais
          infoMessage += `  • Mudar título do grupo: ${channel.changeTitleOnEvent ? 'Sim' : 'Não'}\n`;
          
          if (channel.changeTitleOnEvent) {
            if (channel.onlineTitle) {
              infoMessage += `  • Título Online: "${channel.onlineTitle}"\n`;
            }
            if (channel.offlineTitle) {
              infoMessage += `  • Título Offline: "${channel.offlineTitle}"\n`;
            }
          }
          
          infoMessage += `  • Usar IA: ${channel.useAI ? 'Sim' : 'Não'}\n`;
          
          if (channel.groupPhotoOnline) {
            infoMessage += `  • Foto de grupo Online: Configurada\n`;
          }
          
          if (channel.groupPhotoOffline) {
            infoMessage += `  • Foto de grupo Offline: Configurada\n`;
          }
          
          infoMessage += '\n';
        }
      }
      
      // YouTube
      if (youtubeChannels.length > 0) {
        infoMessage += `*YouTube (${youtubeChannels.length}):*\n`;
        
        for (const channel of youtubeChannels) {
          infoMessage += `- *${channel.channel}*:\n`;
          
          // Tipos de mídia configurados 
          const mediaConfig = formatMediaConfig(channel.onConfig);
          
          infoMessage += `  • Mídias Notificação: ${mediaConfig}\n`;
          
          // Configurações adicionais
          infoMessage += `  • Mudar título do grupo: ${channel.changeTitleOnEvent ? 'Sim' : 'Não'}\n`;
          
          if (channel.changeTitleOnEvent && channel.onlineTitle) {
            infoMessage += `  • Título Novo Vídeo: "${channel.onlineTitle}"\n`;
          }
          
          infoMessage += `  • Usar IA: ${channel.useAI ? 'Sim' : 'Não'}\n`;
          
          if (channel.groupPhotoOnline) {
            infoMessage += `  • Foto de grupo Novo Vídeo: Configurada\n`;
          }
          
          infoMessage += '\n';
        }
      }
      
      if (twitchChannels.length === 0 && kickChannels.length === 0 && youtubeChannels.length === 0) {
        infoMessage += `Nenhum canal configurado. Use !g-twitch-canal, !g-kick-canal ou !g-youtube-canal para adicionar.\n\n`;
      }
      
      // Adiciona informação sobre comandos personalizados
      infoMessage += `*Comandos Personalizados (${activeCommands.length}):*\n`;
      
      // Lista comandos personalizados com suas informações detalhadas
      const maxCommands = Math.min(5, activeCommands.length);
      for (let i = 0; i < maxCommands; i++) {
        const cmd = activeCommands[i];
        infoMessage += `- *${group.prefix}${cmd.startsWith}*: `;
        
        // Mostra contagem de respostas
        if (cmd.responses && cmd.responses.length > 0) {
          infoMessage += `${cmd.responses.length} respostas`;
          
          // Mostra se tem restrições de horário/dias
          if (cmd.allowedTimes) {
            infoMessage += `, `;
            if (cmd.allowedTimes.start && cmd.allowedTimes.end) {
              infoMessage += `${cmd.allowedTimes.start}-${cmd.allowedTimes.end}`;
            }
            if (cmd.allowedTimes.daysOfWeek && cmd.allowedTimes.daysOfWeek.length > 0) {
              infoMessage += ` [${cmd.allowedTimes.daysOfWeek.join(', ')}]`;
            }
          }
          
          // Mostra contador de uso
          if (cmd.count) {
            infoMessage += `, usado ${cmd.count} vezes`;
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
      
      // Números e strings ignorados
      if (group.ignoredNumbers && group.ignoredNumbers.length > 0) {
        infoMessage += `\n*Números Ignorados:* ${group.ignoredNumbers.length}\n`;
      }
      
      if (group.mutedStrings && group.mutedStrings.length > 0) {
        infoMessage += `*Strings Ignoradas:* ${group.mutedStrings.length}\n`;
      }
      
      // Apelidos configurados
      if (group.nicks && group.nicks.length > 0) {
        infoMessage += `\n*Apelidos Configurados:* ${group.nicks.length}\n`;
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
        `!g-${platform}-midia on <canal>\n\n` +
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
          "media": []
        },
        changeTitleOnEvent: true,
        useThumbnail: true,
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
            `Configuração padrão de notificação "online" definida. Use !g-twitch-midia on ${channelName} para personalizar.`
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
          `!g-twitch-titulo on ${channelName} [título]\n` +
          `!g-twitch-titulo off ${channelName} [título]`
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
        content: 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-twitch-titulo on nomeDoCanal Título Personalizado'
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
          `!g-twitch-titulo on <canal> <título>\n\n` +
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
        content: 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-twitch-titulo off nomeDoCanal Título Personalizado'
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
          `!g-twitch-titulo off <canal> <título>\n\n` +
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

  async toggleTwitchThumbnail(bot, message, args, group) {
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
    if(!channelConfig.useThumbnail){
      channelConfig.useThumbnail = true;
    } else {
      channelConfig.useThumbnail = false;
    }
    
    await this.database.saveGroup(group);
    
    const status = channelConfig.useThumbnail ? 'irá enviar' : 'não irá enviar';
    
    
    return new ReturnMessage({
      chatId: group.id,
      content: `O bot agora ${status} junto a thumbnail da stream do canal ${channelName}.\n\n` 
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
        changeTitleOnEvent: true,
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
            `Configuração padrão de notificação "online" definida. Use !g-kick-midia on ${channelName} para personalizar.`
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
          `!g-kick-titulo on ${channelName} [título]\n` +
          `!g-kick-titulo off ${channelName} [título]`
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
        content: 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-kick-titulo on nomeDoCanal Título Personalizado'
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
          `!g-kick-titulo on <canal> <título>\n\n` +
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
        content: 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-kick-titulo off nomeDoCanal Título Personalizado'
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
          `!g-kick-titulo off <canal> <título>\n\n` +
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
        changeTitleOnEvent: true,
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
            `Configuração padrão de notificação de vídeo definida. Use !g-youtube-midia on ${channelName} para personalizar.`
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
      
      if(muteString.length < 3){
        return new ReturnMessage({
          chatId: group.id,
          content: `O *mute* precisa de pelo menos *3* caracteres (informado: '${muteString})'`
        });
      } else {        
        // Initialize mutedStringsgs array if it doesn't exist
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
      
      // Limita o tempo máximo (24hrs)
      if (segundos > 86400) {
        segundos = 86400;
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

  /**
   * Comando !g-manage sem argumentos para usar no grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async manageCommand(bot, message, args, group, privateManagement) {
    try {
      // Verifica se está em um grupo
      if (!message.group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Você já está em um chat privado comigo. Para gerenciar um grupo, use: !g-manage [nomeDoGrupo]'
        });
      }
      
      // Configura o gerenciamento do grupo pelo PV
      privateManagement[message.author] = group.id;
      this.logger.info(`Usuário ${message.author} ativou gerenciamento do grupo ${group.name} (${group.id}) via comando direto no grupo`);
      
      // Envia mensagem para o autor no PV
      const returnMessagePV = new ReturnMessage({
        chatId: message.author,
        content: `🔧 Você agora está gerenciando o grupo: *${group.name}*\n\nVocê pode usar os comandos de administração aqui no privado para configurar o grupo sem poluí-lo com mensagens de configuração.`
      });
      
      // Envia mensagem no grupo
      const returnMessageGroup = new ReturnMessage({
        chatId: group.id,
        content: `✅ ${message.authorName || 'Administrador'} agora está gerenciando o grupo pelo chat privado.`
      });
      
      return [returnMessageGroup, returnMessagePV];
    } catch (error) {
      this.logger.error('Erro ao configurar gerenciamento de grupo:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao configurar gerenciamento de grupo. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Sets the "online" or "offline" media notification for a platform channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   * @param {string} platform - The platform name (twitch, kick, youtube)
   * @param {string} mode - The mode (on or off)
   * @returns {Promise<ReturnMessage>} Return message
   */
  async setStreamMedia(bot, message, args, group, platform, mode = 'on') {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    this.logger.debug(`[setStreamMedia] Recebido pedido para: ${args.join("|")}, modo ${mode}`);

    // Determina o modo (online/offline) a partir dos argumentos
    if (args.length > 0) {
      const modeArg = args[0].toLowerCase();
      if (modeArg === 'on' || modeArg === 'online') {
        mode = 'on';
        args = args.slice(1); // Remove o primeiro argumento
      } else if (modeArg === 'off' || modeArg === 'offline') {
        mode = 'off';
        args = args.slice(1); // Remove o primeiro argumento
      }
    }
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, platform);
    
    // If validateChannelName returned a ReturnMessage, return it
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, platform, channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do ${platform} não configurado: ${channelName}. Use !g-${platform}-canal ${channelName} para configurar.`
      });
    }
    
    // Verify if this is a reply to a message
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    const configKey = mode === 'on' ? 'onConfig' : 'offConfig';
    
    if (!quotedMsg && args.length <= 1) {
      // Reset to default if no quoted message and no additional args
      if (mode === 'on') {
        channelConfig[configKey] = this.createDefaultNotificationConfig(platform, channelName);
      } else {
        channelConfig[configKey] = { media: [] };
      }
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "${mode === 'on' ? 'online' : 'offline'}" para o canal ${channelName} redefinida para o padrão.`
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
      let mediaType = "text";
      if (quotedMsg.hasMedia) {
        const media = await quotedMsg.downloadMedia();
        mediaType = media.mimetype.split('/')[0]; // 'image', 'audio', 'video', etc.
        
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
      
      // Initialize the config if it doesn't exist
      if (!channelConfig[configKey]) {
        channelConfig[configKey] = { media: [] };
      }
      
      // Make sure media array exists
      if (!channelConfig[configKey].media) {
        channelConfig[configKey].media = [];
      }
      
      // FIX: Check if we already have a media of this type
      const existingMediaIndex = channelConfig[configKey].media.findIndex(m => m.type === mediaConfig.type);
      
      if (existingMediaIndex !== -1) {
        // Replace just this media type entry
        channelConfig[configKey].media[existingMediaIndex] = mediaConfig;
      } else {
        // Add the new media entry
        channelConfig[configKey].media.push(mediaConfig);
      }
      
      await this.database.saveGroup(group);
      
      const mediaTypeDesc = {
        "text": "texto",
        "image": "imagem",
        "audio": "áudio",
        "video": "vídeo",
        "voice": "audio de voz",
        "sticker": "sticker"
      };
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de notificação "${mode === 'on' ? 'online' : 'offline'}" para o canal ${channelName} atualizada com sucesso.\n\nAdicionado conteúdo do tipo: ${mediaTypeDesc[mediaType] || mediaType}\n\nPara remover este tipo de conteúdo, use:\n!g-${platform}-midia-del ${mode} ${mediaType} ${channelName}`
      });
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação "${mode}" para o canal ${channelName}:`, error);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Erro ao configurar notificação: ${error.message}`
      });
    }
  }
  /**
   * Remove um tipo específico de mídia da configuração de stream
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @param {string} platform - Plataforma (twitch, kick, youtube)
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async deleteStreamMedia(bot, message, args, group, platform) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se todos os argumentos necessários foram fornecidos
    if (args.length < 2) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Argumentos insuficientes. Uso: !g-${platform}-midia-del [on/off] [tipo]
        
  Onde:
  - [on/off]: Especifica se é para notificação online ou offline
  - [tipo]: Tipo de mídia (text, image, audio, video, sticker)`
      });
    }
    
    // Determina o modo (online/offline)
    const mode = args[0].toLowerCase();
    if (mode !== 'on' && mode !== 'off') {
      return new ReturnMessage({
        chatId: group.id,
        content: `Modo inválido: ${mode}. Use "on" ou "off".`
      });
    }
    
    // Determina o tipo de mídia
    const mediaType = args[1].toLowerCase();
    if (!['text', 'image', 'audio', 'video', 'sticker'].includes(mediaType)) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Tipo de mídia inválido: ${mediaType}. Tipos válidos: text, image, audio, video, sticker`
      });
    }
    
    // Valida e obtém o nome do canal
    const channelName = await this.validateChannelName(bot, message, args.slice(2), group, platform);
    
    // Se validateChannelName retornou um ReturnMessage, retorna-o
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    // Encontra a configuração do canal
    const channelConfig = this.findChannelConfig(group, platform, channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal não configurado: ${channelName}. Use !g-${platform}-canal ${channelName} para configurar.`
      });
    }
    
    // Seleciona a configuração correta com base no modo
    const configKey = mode === 'on' ? 'onConfig' : 'offConfig';
    
    // Verifica se a configuração e o array de mídia existem
    if (!channelConfig[configKey] || !channelConfig[configKey].media) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Nenhuma mídia configurada para ${mode} no canal ${channelName}.`
      });
    }
    
    // Filtra para remover o tipo de mídia especificado
    const originalLength = channelConfig[configKey].media.length;
    channelConfig[configKey].media = channelConfig[configKey].media.filter(item => item.type !== mediaType);
    
    // Verifica se algo foi removido
    if (channelConfig[configKey].media.length === originalLength) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Nenhuma mídia do tipo "${mediaType}" encontrada para ${mode} no canal ${channelName}.`
      });
    }
    
    // Salva a configuração atualizada
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Mídia do tipo "${mediaType}" removida com sucesso da configuração ${mode} para o canal ${channelName}.`
    });
  }

  /**
   * Define a foto do grupo para quando uma stream ficar online/offline
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @param {string} platform - Plataforma (twitch, kick, youtube)
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setStreamGroupPhoto(bot, message, args, group, platform) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Verifica se o bot é administrador do grupo
    const isAdmin = await this.isBotAdmin(bot, group.id);
    if (!isAdmin) {
      return new ReturnMessage({
        chatId: group.id,
        content: '⚠️ O bot não é administrador do grupo. Para alterar a foto do grupo, o bot precisa ser um administrador.'
      });
    }
    
    // Determina o modo (online/offline) a partir dos argumentos
    let mode = 'on';
    if (args.length > 0) {
      const modeArg = args[0].toLowerCase();
      if (modeArg === 'on' || modeArg === 'online') {
        mode = 'on';
        args = args.slice(1); // Remove o primeiro argumento
      } else if (modeArg === 'off' || modeArg === 'offline') {
        mode = 'off';
        args = args.slice(1); // Remove o primeiro argumento
      }
    }
    
    // Valida e obtém o nome do canal
    const channelName = await this.validateChannelName(bot, message, args, group, platform);
    
    // Se validateChannelName retornou um ReturnMessage, retorna-o
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    // Encontra a configuração do canal
    const channelConfig = this.findChannelConfig(group, platform, channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal não configurado: ${channelName}. Use !g-${platform}-canal ${channelName} para configurar.`
      });
    }
    
    // Verifica se há uma mensagem citada com mídia ou se a mensagem atual tem mídia
    let mediaData = null;
    
    // 1. Tenta obter da mensagem citada
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    if (quotedMsg && quotedMsg.hasMedia) {
      try {
        const media = await quotedMsg.downloadMedia();
        if (media.mimetype.startsWith('image/')) {
          mediaData = {
            data: media.data,
            mimetype: media.mimetype
          };
        }
      } catch (error) {
        this.logger.error('Erro ao baixar mídia da mensagem citada:', error);
      }
    }
    
    // 2. Se não encontrou na mensagem citada, verifica a mensagem atual
    if (!mediaData && message.type === 'image' && message.content && message.content.data) {
      mediaData = {
        data: message.content.data,
        mimetype: message.content.mimetype
      };
    }
    
    // Se não há argumentos e não há mídia, remove a configuração de foto
    if (args.length === 0 && !mediaData) {
      if (mode === 'on') {
        delete channelConfig.groupPhotoOnline;
      } else {
        delete channelConfig.groupPhotoOffline;
      }
      
      await this.database.saveGroup(group);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Configuração de foto do grupo para eventos ${mode} do canal ${channelName} removida.`
      });
    }
    
    // Se não há mídia, instrui o usuário
    if (!mediaData) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Para definir a foto do grupo para eventos ${mode} do canal ${channelName}, envie uma imagem com o comando na legenda ou use o comando como resposta a uma imagem.`
      });
    }
    
    // Salva a configuração de foto
    if (mode === 'on') {
      channelConfig.groupPhotoOnline = mediaData;
    } else {
      channelConfig.groupPhotoOffline = mediaData;
    }
    
    // Ativa mudança de título se não estiver ativa
    if (!channelConfig.changeTitleOnEvent) {
      channelConfig.changeTitleOnEvent = true;
    }
    
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Foto do grupo para eventos ${mode === 'on' ? 'online' : 'offline'} do canal ${channelName} configurada com sucesso.
      
  A mudança de título para eventos também foi automaticamente ativada.`
    });
  }

  /**
   * Manipulador unificado para comandos de título de stream
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @param {string} platform - Plataforma (twitch, kick, youtube)
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setStreamTitle(bot, message, args, group, platform) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Determina o modo (online/offline) a partir dos argumentos
    let mode = 'on';
    let titleArgs = [...args];
    
    if (args.length > 0) {
      const modeArg = args[0].toLowerCase();
      if (modeArg === 'on' || modeArg === 'online') {
        mode = 'on';
        titleArgs = args.slice(1); // Remove o primeiro argumento
      } else if (modeArg === 'off' || modeArg === 'offline') {
        mode = 'off';
        titleArgs = args.slice(1); // Remove o primeiro argumento
      }
    }
    
    // Separa o primeiro argumento como possível nome de canal e o resto como título
    let channelArg = null;
    let customTitle = null;
    
    if (titleArgs.length > 0) {
      // Verifica se o primeiro argumento é um canal configurado
      const firstArg = titleArgs[0].toLowerCase();
      const channels = this.getChannelConfig(group, platform);
      const isChannelArg = channels.some(c => c.channel.toLowerCase() === firstArg);
      
      if (isChannelArg) {
        channelArg = firstArg;
        customTitle = titleArgs.slice(1).join(' ');
      } else if (channels.length === 1) {
        // Se há apenas um canal configurado, usa ele
        channelArg = channels[0].channel;
        customTitle = titleArgs.join(' ');
      } else if (channels.length === 0) {
        return new ReturnMessage({
          chatId: group.id,
          content: `Nenhum canal de ${platform} configurado. Use !g-${platform}-canal <nome do canal> para configurar.`
        });
      } else {
        // Múltiplos canais, nenhum especificado
        const channelsList = channels.map(c => c.channel).join(', ');
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Múltiplos canais de ${platform} configurados. Especifique o canal:\n` +
            `!g-${platform}-titulo ${mode} <canal> <título>\n\n` +
            `Canais configurados: ${channelsList}`
        });
      }
    } else if (args.length === 0 || (args.length === 1 && (args[0] === 'on' || args[0] === 'off'))) {
      // Sem argumentos além do modo, verifica se há apenas um canal
      const channels = this.getChannelConfig(group, platform);
      
      if (channels.length === 1) {
        channelArg = channels[0].channel;
        customTitle = null; // Removerá o título personalizado
      } else if (channels.length === 0) {
        return new ReturnMessage({
          chatId: group.id,
          content: `Nenhum canal de ${platform} configurado. Use !g-${platform}-canal <nome do canal> para configurar.`
        });
      } else {
        // Múltiplos canais, nenhum especificado
        const channelsList = channels.map(c => c.channel).join(', ');
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Múltiplos canais de ${platform} configurados. Especifique o canal:\n` +
            `!g-${platform}-titulo ${mode} <canal>\n\n` +
            `Canais configurados: ${channelsList}`
        });
      }
    }
    
    // Encontra a configuração do canal
    const channelConfig = this.findChannelConfig(group, platform, channelArg);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal de ${platform} não configurado: ${channelArg}. Use !g-${platform}-canal ${channelArg} para configurar.`
      });
    }
    
    // Verifica se o bot é administrador para alterar título
    const isAdmin = await this.isBotAdmin(bot, group.id);
    if (!isAdmin) {
      return new ReturnMessage({
        chatId: group.id,
        content: '⚠️ O bot não é administrador do grupo. Para alterar o título do grupo, o bot precisa ser um administrador.'
      });
    }
    
    // Atualiza ou remove título personalizado com base no modo
    if (mode === 'on') {
      if (customTitle === null || customTitle === '') {
        delete channelConfig.onlineTitle;
        await this.database.saveGroup(group);
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Título personalizado para eventos "online" do canal ${channelArg} removido.\n` +
            `O bot irá substituir automaticamente "OFF" por "ON" no título do grupo quando o canal ficar online.`
        });
      } else {
        channelConfig.onlineTitle = customTitle;
      }
    } else {
      if (customTitle === null || customTitle === '') {
        delete channelConfig.offlineTitle;
        await this.database.saveGroup(group);
        
        return new ReturnMessage({
          chatId: group.id,
          content: `Título personalizado para eventos "offline" do canal ${channelArg} removido.\n` +
            `O bot irá substituir automaticamente "ON" por "OFF" no título do grupo quando o canal ficar offline.`
        });
      } else {
        channelConfig.offlineTitle = customTitle;
      }
    }
    
    // Ativa mudança de título se não estiver ativa
    if (!channelConfig.changeTitleOnEvent) {
      channelConfig.changeTitleOnEvent = true;
    }
    
    await this.database.saveGroup(group);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Título personalizado para eventos "${mode}" do canal ${channelArg} definido: "${customTitle}"\n` +
        `Alteração de título para eventos foi ativada.`
    });
  }

  /**
   * Lista todas as variáveis disponíveis para uso em comandos personalizados
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async listVariables(bot, message, args, group) {
    try {
      const chatId = message.group || message.author;
      
      // Obtém variáveis personalizadas do banco de dados
      const customVariables = await this.database.getCustomVariables();
      
      // Lista de variáveis de sistema
      const systemVariables = [
        { name: "{day}", description: "Nome do dia atual (ex: Segunda-feira)" },
        { name: "{date}", description: "Data atual" },
        { name: "{time}", description: "Hora atual" },
        { name: "{data-hora}", description: "Hora atual (apenas o número)" },
        { name: "{data-minuto}", description: "Minuto atual (apenas o número)" },
        { name: "{data-segundo}", description: "Segundo atual (apenas o número)" },
        { name: "{data-dia}", description: "Dia atual (apenas o número)" },
        { name: "{data-mes}", description: "Mês atual (apenas o número)" },
        { name: "{data-ano}", description: "Ano atual (apenas o número)" }
      ];
      
      // Lista de variáveis de números aleatórios
      const randomVariables = [
        { name: "{randomPequeno}", description: "Número aleatório de 1 a 10" },
        { name: "{randomMedio}", description: "Número aleatório de 1 a 100" },
        { name: "{randomGrande}", description: "Número aleatório de 1 a 1000" },
        { name: "{randomMuitoGrande}", description: "Número aleatório de 1 a 10000" },
        { name: "{rndDado-X}", description: "Simula dado de X lados (substitua X pelo número)" },
        { name: "{rndDadoRange-X-Y}", description: "Número aleatório entre X e Y (substitua X e Y)" },
        { name: "{somaRandoms}", description: "Soma dos números aleatórios anteriores na mensagem" }
      ];
      
      // Lista de variáveis de contexto
      const contextVariables = [
        { name: "{pessoa}", description: "Nome do autor da mensagem" },
        { name: "{nomeAutor}", description: "Nome do autor da mensagem (mesmo que {pessoa})" },
        { name: "{group}", description: "Nome do grupo" },
        { name: "{nomeCanal}", description: "Nome do grupo (mesmo que {group})" },
        { name: "{nomeGrupo}", description: "Nome do grupo (mesmo que {group})" },
        { name: "{contador}", description: "Número de vezes que o comando foi executado" },
        { name: "{mention}", description: "Nome da pessoa mencionada em mensagem citada" },
        { name: "{mention-número@c.us}", description: "Menciona usuário específico" }
      ];
      
      // Lista de variáveis de API
      const apiVariables = [
        { name: "{API#GET#TEXT#url}", description: "Faz uma requisição GET e retorna o texto" },
        { name: "{API#GET#JSON#url\ntemplate}", description: "Faz uma requisição GET e formata o JSON" },
        { name: "{API#POST#TEXT#url?param=valor}", description: "Faz uma requisição POST com parâmetros" }
      ];
      
      // Lista de variáveis de arquivo
      const fileVariables = [
        { name: "{file-nomeArquivo}", description: "Envia arquivo da pasta 'data/media/'" },
        { name: "{file-pasta/}", description: "Envia até 5 arquivos da pasta 'data/media/pasta/'" }
      ];
      
      // Lista de variáveis de comando
      const commandVariables = [
        { name: "{cmd-!comando arg1 arg2}", description: "Executa outro comando (criando um alias)" }
      ];
      
      // Lista de variáveis de Boas Vindas/despedidas
      const welcomeVaribles = [
        { name: "{pessoa}", description: "Nome(s) da(s) pessoa(s) adicionada(s) no grupo" },
        { name: "{tituloGrupo}", description: "Título do grupo no whatsApp" },
        { name: "{nomeGrupo}", description: "ID do grupo na ravena" }
      ];

      // Constrói a mensagem de resposta
      let response = `*📝 Variáveis Disponíveis para Comandos Personalizados*\n\n> Quando você colocar {estas} {coisas} na resposta de um comando, o bot irár substituir por um texto conforme a tabela apresentada abaixo.\n\n`;
      
      // Adiciona variáveis de boas vindas/despedida
      response += `🚪 *Boas vindas/despedidas*:\n`;
      for (const variable of welcomeVaribles) {
        response += `• ${variable.name} - ${variable.description}\n`;
      }
      response += '\n';

      // Adiciona variáveis de sistema
      response += `⏱️ *Variáveis de Sistema*:\n`;
      for (const variable of systemVariables) {
        response += `• ${variable.name} - ${variable.description}\n`;
      }
      response += '\n';
      
      // Adiciona variáveis de números aleatórios
      response += `🎲 *Variáveis de Números Aleatórios*:\n`;
      for (const variable of randomVariables) {
        response += `• ${variable.name} - ${variable.description}\n`;
      }
      response += '\n';
      
      // Adiciona variáveis de contexto
      response += `👤 *Variáveis de Contexto*:\n`;
      for (const variable of contextVariables) {
        response += `• ${variable.name} - ${variable.description}\n`;
      }
      response += '\n';
      
      // Adiciona variáveis de API
      response += `🌐 *Variáveis de API*:\n`;
      for (const variable of apiVariables) {
        response += `• ${variable.name} - ${variable.description}\n`;
      }
      response += '\n';
      
      // Adiciona variáveis de arquivo
      response += `📁 *Variáveis de Arquivo*:\n`;
      for (const variable of fileVariables) {
        response += `• ${variable.name} - ${variable.description}\n`;
      }
      response += '\n';
      
      // Adiciona variáveis de comando
      response += `⚙️ *Variáveis de Comando*:\n`;
      for (const variable of commandVariables) {
        response += `• ${variable.name} - ${variable.description}\n`;
      }
      response += '\n';
      
      // Adiciona variáveis personalizadas
      if (customVariables && Object.keys(customVariables).length > 0) {
        response += `🔍 *Variáveis Personalizadas*:\n`;
        for (const [key, value] of Object.entries(customVariables)) {
          const valueType = Array.isArray(value) ? 
            `Array com ${value.length} items` : 
            typeof value === 'string' ? 'Texto' : typeof value;
          
          response += `• {${key}} - ${valueType}\n`;
        }
      }
      
      return new ReturnMessage({
        chatId: chatId,
        content: response
      });
    } catch (error) {
      this.logger.error('Erro ao listar variáveis:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao listar variáveis disponíveis. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Métodos auxiliares para encaminhar comandos unificados para cada plataforma específica
   */

  // Métodos para mídia
  async setTwitchMedia(bot, message, args, group) {
    return this.setStreamMedia(bot, message, args, group, 'twitch');
  }

  async setKickMedia(bot, message, args, group) {
    return this.setStreamMedia(bot, message, args, group, 'kick');
  }

  async setYoutubeMedia(bot, message, args, group) {
    return this.setStreamMedia(bot, message, args, group, 'youtube');
  }

  // Métodos para excluir mídia
  async deleteTwitchMedia(bot, message, args, group) {
    return this.deleteStreamMedia(bot, message, args, group, 'twitch');
  }

  async deleteKickMedia(bot, message, args, group) {
    return this.deleteStreamMedia(bot, message, args, group, 'kick');
  }

  async deleteYoutubeMedia(bot, message, args, group) {
    return this.deleteStreamMedia(bot, message, args, group, 'youtube');
  }

  // Métodos para título
  async setTwitchTitle(bot, message, args, group) {
    return this.setStreamTitle(bot, message, args, group, 'twitch');
  }

  async setKickTitle(bot, message, args, group) {
    return this.setStreamTitle(bot, message, args, group, 'kick');
  }

  async setYoutubeTitle(bot, message, args, group) {
    return this.setStreamTitle(bot, message, args, group, 'youtube');
  }

  // Métodos para foto do grupo
  async setTwitchGroupPhoto(bot, message, args, group) {
    return this.setStreamGroupPhoto(bot, message, args, group, 'twitch');
  }

  async setKickGroupPhoto(bot, message, args, group) {
    return this.setStreamGroupPhoto(bot, message, args, group, 'kick');
  }

  async setYoutubeGroupPhoto(bot, message, args, group) {
    return this.setStreamGroupPhoto(bot, message, args, group, 'youtube');
  }
  
  /**
   * Define horários permitidos para um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setCmdAllowedHours(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o nome do comando e, opcionalmente, os horários permitidos. Exemplo: !g-cmd-setHoras comando 08:00 20:00'
      });
    }
    
    // Obtém o nome do comando
    const commandName = args[0].toLowerCase();
    
    // Obtém os horários (start e end)
    let startTime = null;
    let endTime = null;
    
    if (args.length >= 3) {
      startTime = args[1];
      endTime = args[2];
      
      // Valida o formato das horas (HH:MM)
      const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timeRegex.test(startTime) || !timeRegex.test(endTime)) {
        return new ReturnMessage({
          chatId: group.id,
          content: 'Formato de hora inválido. Use o formato HH:MM, por exemplo: 08:00 20:00'
        });
      }
    }
    
    // Busca o comando personalizado
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandName && !cmd.deleted);
    
    if (!command) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Comando personalizado '${commandName}' não encontrado.`
      });
    }
    
    // Inicializa ou atualiza a propriedade allowedTimes
    if (!command.allowedTimes) {
      command.allowedTimes = {};
    }
    
    // Se não forneceu horários, remove a restrição
    if (!startTime || !endTime) {
      if (command.allowedTimes) {
        delete command.allowedTimes.start;
        delete command.allowedTimes.end;
        
        // Se não houver mais restrições, remove a propriedade inteira
        if (!command.allowedTimes.daysOfWeek || command.allowedTimes.daysOfWeek.length === 0) {
          delete command.allowedTimes;
        }
      }
      
      // Atualiza o comando
      await this.database.updateCustomCommand(group.id, command);
      
      // Limpa cache de comandos
      this.database.clearCache(`commands:${group.id}`);
      await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Restrição de horário removida para o comando '${commandName}'.`
      });
    }
    
    // Atualiza os horários permitidos
    command.allowedTimes.start = startTime;
    command.allowedTimes.end = endTime;
    
    // Atualiza o comando
    await this.database.updateCustomCommand(group.id, command);
    
    // Limpa cache de comandos
    this.database.clearCache(`commands:${group.id}`);
    await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Horários permitidos para o comando '${commandName}' definidos: das ${startTime} às ${endTime}.`
    });
  }

  /**
   * Define dias permitidos para um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setCmdAllowedDays(bot, message, args, group) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: 'Por favor, forneça o nome do comando e, opcionalmente, os dias permitidos. Exemplo: !g-cmd-setDias comando seg ter qua'
      });
    }
    
    // Obtém o nome do comando
    const commandName = args[0].toLowerCase();
    
    // Obtém os dias
    const days = args.slice(1).map(day => day.toLowerCase());
    
    // Valida os dias (deve ser seg, ter, qua, qui, sex, sab, dom)
    const validDays = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab', 
                       'domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
    
    const invalidDays = days.filter(day => !validDays.includes(day));
    if (invalidDays.length > 0 && days.length > 0) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Dias inválidos: ${invalidDays.join(', ')}. Use abreviações de três letras (seg, ter, qua, qui, sex, sab, dom).`
      });
    }
    
    // Busca o comando personalizado
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandName && !cmd.deleted);
    
    if (!command) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Comando personalizado '${commandName}' não encontrado.`
      });
    }
    
    // Inicializa ou atualiza a propriedade allowedTimes
    if (!command.allowedTimes) {
      command.allowedTimes = {};
    }
    
    // Se não forneceu dias, remove a restrição
    if (days.length === 0) {
      if (command.allowedTimes) {
        delete command.allowedTimes.daysOfWeek;
        
        // Se não houver mais restrições, remove a propriedade inteira
        if (!command.allowedTimes.start || !command.allowedTimes.end) {
          delete command.allowedTimes;
        }
      }
      
      // Atualiza o comando
      await this.database.updateCustomCommand(group.id, command);
      
      // Limpa cache de comandos
      this.database.clearCache(`commands:${group.id}`);
      await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
      
      return new ReturnMessage({
        chatId: group.id,
        content: `Restrição de dias removida para o comando '${commandName}'.`
      });
    }
    
    // Atualiza os dias permitidos
    command.allowedTimes.daysOfWeek = days;
    
    // Atualiza o comando
    await this.database.updateCustomCommand(group.id, command);
    
    // Limpa cache de comandos
    this.database.clearCache(`commands:${group.id}`);
    await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
    
    return new ReturnMessage({
      chatId: group.id,
      content: `Dias permitidos para o comando '${commandName}' definidos: ${days.join(', ')}.`
    });
  }

  /**
   * Abre ou fecha o grupo para que apenas admins possam enviar mensagens
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @param {boolean} setAdminsOnly - Se true, apenas admins podem enviar mensagens
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleGroupMessagesAdminsOnly(bot, message, args, group, setAdminsOnly) {
    try {
      if (!group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      // Verifica se o bot é administrador do grupo (necessário para esta operação)
      const isAdmin = await this.isBotAdmin(bot, group.id);
      
      if (!isAdmin) {
        return new ReturnMessage({
          chatId: group.id,
          content: '⚠️ O bot precisa ser administrador do grupo para poder alterar as configurações do grupo.'
        });
      }
      
      // Obtém o chat do grupo
      try {
        const chat = await bot.client.getChatById(group.id);
        
        // Define configuração de apenas admins para mensagens
        await chat.setMessagesAdminsOnly(setAdminsOnly);
        
        const statusMsg = setAdminsOnly ? 
          '🔒 Grupo fechado. Apenas administradores podem enviar mensagens agora.' : 
          '🔓 Grupo aberto. Todos os participantes podem enviar mensagens agora.';
        
        return new ReturnMessage({
          chatId: group.id,
          content: statusMsg
        });
      } catch (error) {
        this.logger.error(`Erro ao ${setAdminsOnly ? 'fechar' : 'abrir'} grupo:`, error);
        
        return new ReturnMessage({
          chatId: group.id,
          content: `❌ Erro ao ${setAdminsOnly ? 'fechar' : 'abrir'} grupo: ${error.message}`
        });
      }
    } catch (error) {
      this.logger.error(`Erro ao executar comando de ${setAdminsOnly ? 'fechar' : 'abrir'} grupo:`, error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: `❌ Erro ao executar o comando. Por favor, tente novamente.`
      });
    }
  }

  /**
   * Fecha o grupo para que apenas admins possam enviar mensagens
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async closeGroup(bot, message, args, group) {
    return this.toggleGroupMessagesAdminsOnly(bot, message, args, group, true);
  }

  /**
   * Abre o grupo para que todos possam enviar mensagens
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async openGroup(bot, message, args, group) {
    return this.toggleGroupMessagesAdminsOnly(bot, message, args, group, false);
  }

  /**
   * Define um apelido para um usuário específico (para admins)
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async setUserNicknameAdmin(bot, message, args, group) {
    try {
      if (!group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      if (args.length < 2) {
        return new ReturnMessage({
          chatId: group.id,
          content: 'Por favor, forneça o número do usuário e o apelido. Exemplo: !g-setApelido 5511999999999 Novo Apelido'
        });
      }
      
      // Processa o número do usuário
      let userNumber = args[0].replace(/\D/g, ''); // Remove não-dígitos
      
      // Verifica se o número tem pelo menos 8 dígitos
      if (userNumber.length < 8) {
        return new ReturnMessage({
          chatId: group.id,
          content: 'O número deve ter pelo menos 8 dígitos.'
        });
      }
      
      // Adiciona @c.us ao número se não estiver completo
      if (!userNumber.includes('@')) {
        userNumber = `${userNumber}@c.us`;
      }
      
      // Obtém o apelido a partir do resto dos argumentos
      const nickname = args.slice(1).join(' ');
      
      // Limita o apelido a 20 caracteres
      const trimmedNickname = nickname.length > 20 ? nickname.substring(0, 20) : nickname;
      
      // Inicializa o array de apelidos se não existir
      if (!group.nicks) {
        group.nicks = [];
      }
      
      // Verifica se o usuário já tem um apelido
      const existingIndex = group.nicks.findIndex(nick => nick.numero === userNumber);
      
      if (existingIndex !== -1) {
        // Atualiza o apelido existente
        group.nicks[existingIndex].apelido = trimmedNickname;
      } else {
        // Adiciona novo apelido
        group.nicks.push({
          numero: userNumber,
          apelido: trimmedNickname
        });
      }
      
      // Salva o grupo atualizado
      await this.database.saveGroup(group);
      
      // Tenta obter o nome do contato
      let contactName = "usuário";
      try {
        const contact = await bot.client.getContactById(userNumber);
        contactName = contact.pushname || contact.name || userNumber.replace('@c.us', '');
      } catch (contactError) {
        this.logger.debug(`Não foi possível obter informações do contato ${userNumber}:`, contactError);
      }
      
      return new ReturnMessage({
        chatId: group.id,
        content: `✅ Apelido definido para ${contactName}: "${trimmedNickname}"`
      });
    } catch (error) {
      this.logger.error('Erro ao definir apelido para usuário:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao definir apelido. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Reseta o ranking da roleta russa para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async resetRoletaRanking(bot, message, args, group) {
    try {
      // Verifica se está em um grupo
      if (!message.group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      const groupId = message.group;
      
      // Carrega dados da roleta
      const { carregarDadosRoleta, salvarDadosRoleta } = require('../functions/RoletaRussaCommands.js');
      let dados = await carregarDadosRoleta();
      
      // Verifica se existem dados para este grupo
      if (!dados.grupos[groupId]) {
        return new ReturnMessage({
          chatId: groupId,
          content: '🎮 Não há dados de roleta russa para este grupo.'
        });
      }

      // Primeiro, vamos mostrar o ranking atual antes de resetar
      try {
        // Executa o comando de ranking
        const rankingCommand = bot.eventHandler.commandHandler.fixedCommands.getCommand('roletaranking');
        if (rankingCommand) {
          await rankingCommand.execute(bot, message, [], group);
        }
      } catch (rankingError) {
        this.logger.error('Erro ao mostrar ranking antes do reset:', rankingError);
      }

      // Aguarda um momento para garantir que o ranking seja exibido
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Armazena uma cópia dos dados para backup
      const backupData = JSON.stringify(dados.grupos[groupId]);
      
      // Reseta os dados do grupo
      dados.grupos[groupId] = {
        tempoTimeout: dados.grupos[groupId].tempoTimeout || dados.configuracoes.tempoDefault,
        jogadores: {},
        ultimoJogador: null,
        historicoResets: dados.grupos[groupId].historicoResets || []
      };
      
      // Adiciona dados do reset ao histórico
      const timestamp = Date.now();
      dados.grupos[groupId].historicoResets.push({
        timestamp,
        dadosAnteriores: backupData
      });
      
      // Mantém apenas os últimos 5 resets no histórico
      if (dados.grupos[groupId].historicoResets.length > 5) {
        dados.grupos[groupId].historicoResets = dados.grupos[groupId].historicoResets.slice(-5);
      }
      
      // Salva os dados atualizados
      await salvarDadosRoleta(dados);
      
      return new ReturnMessage({
        chatId: groupId,
        content: '🎮 Ranking da roleta russa foi resetado com sucesso para este grupo!\n\nO histórico do ranking anterior foi salvo.'
      });
    } catch (error) {
      this.logger.error('Erro ao resetar ranking da roleta russa:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao resetar ranking da roleta russa. Por favor, tente novamente.'
      });
    }
  }

/**
 * Reseta o ranking do jogo de pesca para um grupo
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async resetPescaRanking(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    const groupId = message.group;
    
    // Carrega dados de pesca do arquivo JSON
    const FISHING_DATA_PATH = path.join(__dirname, '../../data/fishing.json');
    let fishingData;
    
    try {
      const data = await fs.readFile(FISHING_DATA_PATH, 'utf8');
      fishingData = JSON.parse(data);
    } catch (error) {
      return new ReturnMessage({
        chatId: groupId,
        content: '🎣 Não há dados de pescaria para resetar.'
      });
    }

    // Verifica se há dados do grupo
    if (!fishingData.groupData || !fishingData.groupData[groupId]) {
      return new ReturnMessage({
        chatId: groupId,
        content: '🎣 Não há dados de pescaria para este grupo específico.'
      });
    }

    // Faz backup dos dados antes de resetar
    const backupData = JSON.stringify(fishingData.groupData[groupId]);

    // Cria estrutura de histórico se não existir
    if (!fishingData.rankingHistory) {
      fishingData.rankingHistory = [];
    }

    // Adiciona backup ao histórico
    fishingData.rankingHistory.push({
      type: 'group',
      groupId,
      timestamp: Date.now(),
      data: backupData
    });

    // Limita histórico a 5 entradas por grupo
    fishingData.rankingHistory = fishingData.rankingHistory.filter(h => 
      h.groupId !== groupId || 
      h.timestamp > Date.now() - (30 * 24 * 60 * 60 * 1000) // mantém últimos 30 dias
    ).slice(-5);

    // Reseta dados do grupo
    delete fishingData.groupData[groupId];

    // Reseta dados individuais dos jogadores para este grupo
    for (const userId in fishingData.fishingData) {
      if (fishingData.fishingData[userId].groupData) {
        delete fishingData.fishingData[userId].groupData[groupId];
      }
    }

    // Salva os dados atualizados
    await fs.writeFile(FISHING_DATA_PATH, JSON.stringify(fishingData, null, 2));

    return new ReturnMessage({
      chatId: groupId,
      content: `🎣 O ranking de pescaria para este grupo foi resetado com sucesso!\n\nUm backup do ranking anterior foi salvo.`
    });
  } catch (error) {
    this.logger.error('Erro ao resetar ranking de pescaria:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao resetar ranking de pescaria. Por favor, tente novamente.'
    });
  }
}

  /**
   * Verifica se o usuário é um super admin
   * @param {string} userId - ID do usuário
   * @returns {Promise<boolean>} - Se o usuário é super admin
   */
  async isSuperAdmin(userId) {
    // Implemente sua própria lógica aqui
    // Por exemplo, verificar contra uma lista de super admins no banco de dados
    const superAdmins = process.env.SUPER_ADMINS ? process.env.SUPER_ADMINS.split(',') : [];
    return superAdmins.includes(userId);
  }

  /**
   * Reseta o ranking do jogo Geoguesser para um grupo ou globalmente
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async resetGeoguesserRanking(bot, message, args, group) {
    try {
      // Verifica se está em um grupo
      if (!message.group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      const groupId = message.group;
      
      // Obtém variáveis customizadas
      const customVariables = await this.database.getCustomVariables();
      
      // Verifica se existe ranking de Geoguesser
      if (!customVariables.geoguesserRanking) {
        return new ReturnMessage({
          chatId: groupId,
          content: '🌍 Não há dados de Geoguesser para resetar.'
        });
      }

      // Verifica o tipo de reset
      const isGlobal = args.length > 0 && args[0].toLowerCase() === 'global';
      
      if (isGlobal) {
        // Verifica se o usuário é um super admin
        const isSuperAdmin = await this.isSuperAdmin(message.author);
        if (!isSuperAdmin) {
          return new ReturnMessage({
            chatId: groupId,
            content: '⚠️ Apenas super administradores podem resetar o ranking global de Geoguesser.'
          });
        }
        
        // Armazena o backup antes de resetar
        const backupData = JSON.stringify(customVariables.geoguesserRanking);
        
        // Registra o backup no histórico
        if (!customVariables.geoguesserRankingHistory) {
          customVariables.geoguesserRankingHistory = [];
        }
        
        customVariables.geoguesserRankingHistory.push({
          type: 'global',
          timestamp: Date.now(),
          data: backupData
        });
        
        // Limita o histórico a 5 entradas
        if (customVariables.geoguesserRankingHistory.length > 5) {
          customVariables.geoguesserRankingHistory = customVariables.geoguesserRankingHistory.slice(-5);
        }
        
        // Reseta os dados de Geoguesser
        customVariables.geoguesserRanking = {
          global: {},
          groups: {}
        };
        
        // Salva as variáveis atualizadas
        await this.database.saveCustomVariables(customVariables);
        
        return new ReturnMessage({
          chatId: groupId,
          content: '🌍 O ranking global de Geoguesser foi resetado com sucesso!\n\nUm backup do ranking anterior foi salvo.'
        });
      } else {
        // Reset apenas para este grupo
        
        // Verifica se existem dados para este grupo
        if (!customVariables.geoguesserRanking.groups || !customVariables.geoguesserRanking.groups[groupId]) {
          return new ReturnMessage({
            chatId: groupId,
            content: '🌍 Não há dados de Geoguesser para este grupo específico.'
          });
        }
        
        // Armazena o backup antes de resetar
        const backupData = JSON.stringify(customVariables.geoguesserRanking.groups[groupId]);
        
        // Registra o backup no histórico
        if (!customVariables.geoguesserRankingHistory) {
          customVariables.geoguesserRankingHistory = [];
        }
        
        customVariables.geoguesserRankingHistory.push({
          type: 'group',
          groupId,
          timestamp: Date.now(),
          data: backupData
        });
        
        // Limita o histórico a 5 entradas por grupo
        const groupHistories = customVariables.geoguesserRankingHistory.filter(h => h.type === 'group' && h.groupId === groupId);
        if (groupHistories.length > 5) {
          // Remove os históricos mais antigos
          const toRemove = groupHistories.length - 5;
          let removed = 0;
          
          customVariables.geoguesserRankingHistory = customVariables.geoguesserRankingHistory.filter(h => {
            if (h.type === 'group' && h.groupId === groupId && removed < toRemove) {
              removed++;
              return false;
            }
            return true;
          });
        }
        
        // Reseta os dados de Geoguesser deste grupo
        customVariables.geoguesserRanking.groups[groupId] = {};
        
        // Salva as variáveis atualizadas
        await this.database.saveCustomVariables(customVariables);
        
        return new ReturnMessage({
          chatId: groupId,
          content: `🌍 O ranking de Geoguesser para este grupo foi resetado com sucesso!\n\nUm backup do ranking anterior foi salvo.`
        });
      }
    } catch (error) {
      this.logger.error('Erro ao resetar ranking de Geoguesser:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao resetar ranking de Geoguesser. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Reseta o ranking do jogo Stop/Adedona para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async resetStopGameRanking(bot, message, args, group) {
    try {
      // Verifica se está em um grupo
      if (!message.group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      const groupId = message.group;
      
      // Obtém variáveis customizadas
      const customVariables = await this.database.getCustomVariables();
      
      // Verifica se existe ranking de Stop/Adedona para este grupo
      if (!customVariables.stopGameRanking || 
          !customVariables.stopGameRanking.groups || 
          !customVariables.stopGameRanking.groups[groupId]) {
        return new ReturnMessage({
          chatId: groupId,
          content: '🛑 Não há dados do jogo Stop/Adedona para resetar neste grupo.'
        });
      }
      
      // Armazena o backup antes de resetar
      const backupData = JSON.stringify(customVariables.stopGameRanking.groups[groupId]);
      
      // Registra o backup no histórico
      if (!customVariables.stopGameRankingHistory) {
        customVariables.stopGameRankingHistory = [];
      }
      
      customVariables.stopGameRankingHistory.push({
        groupId,
        timestamp: Date.now(),
        data: backupData,
        performedBy: message.author,
        performedByName: message.authorName || "Admin"
      });
      
      // Limita o histórico a 5 entradas por grupo
      const groupHistories = customVariables.stopGameRankingHistory.filter(h => h.groupId === groupId);
      if (groupHistories.length > 5) {
        // Remove os históricos mais antigos
        const toRemove = groupHistories.length - 5;
        let removed = 0;
        
        customVariables.stopGameRankingHistory = customVariables.stopGameRankingHistory.filter(h => {
          if (h.groupId === groupId && removed < toRemove) {
            removed++;
            return false;
          }
          return true;
        });
      }
      
      // Reseta os dados do Stop/Adedona deste grupo
      customVariables.stopGameRanking.groups[groupId] = {};
      
      // Salva as variáveis atualizadas
      await this.database.saveCustomVariables(customVariables);
      
      return new ReturnMessage({
        chatId: groupId,
        content: `🛑 O ranking do jogo Stop/Adedona para este grupo foi resetado com sucesso!\n\nUm backup do ranking anterior foi salvo.`
      });
    } catch (error) {
      this.logger.error('Erro ao resetar ranking do jogo Stop/Adedona:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao resetar ranking do jogo Stop/Adedona. Por favor, tente novamente.'
      });
    }
  }


  /**
   * Reseta o ranking do jogo Pinto para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async resetPintoRanking(bot, message, args, group) {
    try {
      // Verifica se está em um grupo
      if (!message.group) {
        return new ReturnMessage({
          chatId: message.author,
          content: 'Este comando só pode ser usado em grupos.'
        });
      }
      
      const groupId = message.group;
      
      // Obtém variáveis customizadas
      const customVariables = await this.database.getCustomVariables();
      
      // Verifica se existe ranking do jogo para este grupo
      if (!customVariables.pintoGame || 
          !customVariables.pintoGame.groups || 
          !customVariables.pintoGame.groups[groupId]) {
        return new ReturnMessage({
          chatId: groupId,
          content: '🍆 Não há dados do jogo para resetar neste grupo.'
        });
      }

      // Verifica o tipo de reset (completo ou apenas cooldowns)
      const resetType = args.length > 0 ? args[0].toLowerCase() : 'full';
      
      if (resetType === 'cooldown' || resetType === 'cooldowns') {
        // Reset apenas dos cooldowns para este grupo
        const playerCooldowns = {};
        
        // Salva o histórico de reset
        if (!customVariables.pintoGameResetHistory) {
          customVariables.pintoGameResetHistory = [];
        }
        
        customVariables.pintoGameResetHistory.push({
          type: 'cooldowns',
          groupId,
          timestamp: Date.now(),
          performedBy: message.author,
          performedByName: message.authorName || "Admin"
        });
        
        // Limita o histórico a 5 entradas por grupo
        const groupHistories = customVariables.pintoGameResetHistory.filter(h => h.groupId === groupId);
        if (groupHistories.length > 5) {
          // Remove os históricos mais antigos
          const toRemove = groupHistories.length - 5;
          let removed = 0;
          
          customVariables.pintoGameResetHistory = customVariables.pintoGameResetHistory.filter(h => {
            if (h.groupId === groupId && removed < toRemove) {
              removed++;
              return false;
            }
            return true;
          });
        }
        
        // Salva as variáveis atualizadas
        await this.database.saveCustomVariables(customVariables);
        
        return new ReturnMessage({
          chatId: groupId,
          content: '🍆 Os cooldowns do jogo foram resetados para este grupo! Todos os jogadores podem jogar novamente imediatamente.'
        });
      } else {
        // Reset completo do ranking deste grupo
        
        // Armazena o backup antes de resetar
        const backupData = JSON.stringify(customVariables.pintoGame.groups[groupId]);
        
        // Registra o backup no histórico
        if (!customVariables.pintoGameResetHistory) {
          customVariables.pintoGameResetHistory = [];
        }
        
        customVariables.pintoGameResetHistory.push({
          type: 'full',
          groupId,
          timestamp: Date.now(),
          data: backupData,
          performedBy: message.author,
          performedByName: message.authorName || "Admin"
        });
        
        // Limita o histórico a 5 entradas por grupo
        const groupHistories = customVariables.pintoGameResetHistory.filter(h => h.groupId === groupId);
        if (groupHistories.length > 5) {
          // Remove os históricos mais antigos
          const toRemove = groupHistories.length - 5;
          let removed = 0;
          
          customVariables.pintoGameResetHistory = customVariables.pintoGameResetHistory.filter(h => {
            if (h.groupId === groupId && removed < toRemove) {
              removed++;
              return false;
            }
            return true;
          });
        }
        
        // Reseta os dados do jogo para este grupo
        customVariables.pintoGame.groups[groupId] = {};
        
        // Salva as variáveis atualizadas
        await this.database.saveCustomVariables(customVariables);
        
        return new ReturnMessage({
          chatId: groupId,
          content: '🍆 O ranking do jogo para este grupo foi completamente resetado!\n\nUm backup do ranking anterior foi salvo.'
        });
      }
    } catch (error) {
      this.logger.error('Erro ao resetar ranking do jogo Pinto:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao resetar ranking do jogo. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Alterna a funcionalidade de mencionar todos os membros nas notificações de stream
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @param {string} platform - Plataforma (twitch, kick, youtube)
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async toggleStreamMentions(bot, message, args, group, platform) {
    if (!group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'Este comando só pode ser usado em grupos.'
      });
    }
    
    // Valida e obtém o nome do canal
    const channelName = await this.validateChannelName(bot, message, args, group, platform);
    
    // Se validateChannelName retornou um ReturnMessage, retorna-o
    if (channelName instanceof ReturnMessage) {
      return channelName;
    }
    
    // Encontra a configuração do canal
    const channelConfig = this.findChannelConfig(group, platform, channelName);
    
    if (!channelConfig) {
      return new ReturnMessage({
        chatId: group.id,
        content: `Canal do ${platform} não configurado: ${channelName}. Use !g-${platform}-canal ${channelName} para configurar.`
      });
    }
    
    // Inicializa a propriedade mentionAllMembers se não existir
    if (channelConfig.mentionAllMembers === undefined) {
      channelConfig.mentionAllMembers = true;
    }
    
    // Alterna o valor
    channelConfig.mentionAllMembers = !channelConfig.mentionAllMembers;
    
    // Salva a configuração atualizada
    await this.database.saveGroup(group);
    
    // Retorna uma mensagem informando o novo estado
    const novoEstado = channelConfig.mentionAllMembers ? 'ativada' : 'desativada';
    
    return new ReturnMessage({
      chatId: group.id,
      content: `✅ Função de mencionar todos os membros ${novoEstado} para notificações do canal ${channelName} da ${platform}.`
    });
  }

  // Métodos para cada plataforma
  async toggleTwitchMentions(bot, message, args, group) {
    return this.toggleStreamMentions(bot, message, args, group, 'twitch');
  }

  async toggleKickMentions(bot, message, args, group) {
    return this.toggleStreamMentions(bot, message, args, group, 'kick');
  }

  async toggleYoutubeMentions(bot, message, args, group) {
    return this.toggleStreamMentions(bot, message, args, group, 'youtube');
  }
}

module.exports = Management;