const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const NSFWPredict = require('../utils/NSFWPredict');

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
      'setName': 'setGroupName',
      'addCmd': 'addCustomCommand',
      'addCmdReply': 'addCustomCommandReply',
      'delCmd': 'deleteCustomCommand',
      'enableCmd': 'enableCustomCommand',
      'disableCmd': 'disableCustomCommand',
      'setCustomPrefix': 'setCustomPrefix',
      'setWelcome': 'setWelcomeMessage',
      'setFarewell': 'setFarewellMessage',
      'help': 'showManagementHelp',
      'addDonateNumero': 'addDonorNumber',
      'addDonateValor': 'updateDonationAmount',
      'mergeDonates': 'mergeDonors',
      'joinGrupo': 'joinGroup',
      'setReact': 'setReaction',
      'setStartReact': 'setStartReaction',
      'autoStt': 'toggleAutoStt',
      'info': 'showGroupInfo',
      'filtro-palavra': 'filterWord',
      'filtro-links': 'filterLinks',
      'filtro-pessoa': 'filterPerson',
      'filtro-nsfw': 'filterNSFW',
      'apelido': 'setUserNickname',
      'ignorar': 'ignoreUser',
      'mute': 'muteCommand',
      'customAdmin': 'customAdmin',
      'pausar': 'pauseGroup',

      // Twitch commands
      'twitch-canal': 'toggleTwitchChannel',
      'twitch-midia-on': 'setTwitchOnlineMedia',
      'twitch-midia-off': 'setTwitchOfflineMedia',
      'twitch-mudarTitulo': 'toggleTwitchTitleChange',
      'twitch-titulo-on': 'setTwitchOnlineTitle',
      'twitch-titulo-off': 'setTwitchOfflineTitle',
      'twitch-usarIA': 'toggleTwitchAI',

      // Kick commands
      'kick-canal': 'toggleKickChannel',
      'kick-midia-on': 'setKickOnlineMedia',
      'kick-midia-off': 'setKickOfflineMedia',
      'kick-mudarTitulo': 'toggleKickTitleChange',
      'kick-titulo-on': 'setKickOnlineTitle',
      'kick-titulo-off': 'setKickOfflineTitle',
      'kick-usarIA': 'toggleKickAI',

      // YouTube commands
      'youtube-canal': 'toggleYoutubeChannel',
      'youtube-midia-on': 'setYoutubeOnlineMedia',
      'youtube-midia-off': 'setYoutubeOfflineMedia',
      'youtube-mudarTitulo': 'toggleYoutubeTitleChange',
      'youtube-titulo-on': 'setYoutubeOnlineTitle',
      'youtube-titulo-off': 'setYoutubeOfflineTitle',
      'youtube-usarIA': 'toggleYoutubeAI',


    };
  }

  /**
   * Obtém o nome do método para um comando de gerenciamento
   * @param {string} command - Nome do comando
   * @returns {string|null} - Nome do método ou null se não encontrado
   */
  getCommandMethod(command) {
    return this.commandMap[command] || null;
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
   */
  async setGroupName(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça um novo nome para o grupo. Exemplo: !g-setName NovoNomeGrupo');
      return;
    }
    
    const newName = args.join(' ');
    
    // Atualiza nome do grupo no banco de dados
    group.name = newName.toLowerCase().replace(/\s+/g, '').substring(0, 16);
    await this.database.saveGroup(group);
    
    await bot.sendMessage(group.id, `Nome do grupo atualizado para: ${group.name}`);
  }
  
  /**
   * Adiciona um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async addCustomCommand(bot, message, args, group) {
    if (!group) return;
    
    // Verifica se a mensagem é uma resposta
    const quotedMsg = await message.origin.getQuotedMessage();

    if (!quotedMsg) {
      await bot.sendMessage(group.id, 'Este comando deve ser usado como resposta a uma mensagem.');
      console.log(message.origin);
      return;
    }
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça um gatilho para o comando personalizado. Exemplo: !g-addCmd saudação');
      return;
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
        await bot.sendMessage(group.id, 'Erro ao salvar mídia para comando personalizado.');
        return;
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
    
    await bot.sendMessage(group.id, `Comando personalizado '${commandTrigger}' adicionado com sucesso.`);
  }
  
  /**
   * Adiciona uma resposta a um comando personalizado existente
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async addCustomCommandReply(bot, message, args, group) {
    if (!group) return;
    
    // Verifica se a mensagem é uma resposta
    const quotedMsg = await message.origin.getQuotedMessage();
    if (!quotedMsg) {
      await bot.sendMessage(group.id, 'Este comando deve ser usado como resposta a uma mensagem.');
      return;
    }
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça o comando para adicionar uma resposta. Exemplo: !g-addCmdReply saudação');
      return;
    }
    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    const commandTrigger = args.join(' ').toLowerCase();
    
    // Obtém comandos personalizados para este grupo
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandTrigger && !cmd.deleted);
    
    if (!command) {
      await bot.sendMessage(group.id, `Comando personalizado '${commandTrigger}' não encontrado.`);
      return;
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
        await bot.sendMessage(group.id, 'Erro ao salvar mídia para resposta de comando personalizado.');
        return;
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
    
    await bot.sendMessage(group.id, `Adicionada nova resposta ao comando personalizado '${commandTrigger}'.`);
  }
  
  /**
   * Exclui um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async deleteCustomCommand(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça o comando personalizado a ser excluído. Exemplo: !g-delCmd saudação');
      return;
    }
    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    const commandTrigger = args.join(' ').toLowerCase();
    
    // Obtém comandos personalizados para este grupo
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandTrigger && !cmd.deleted);
    
    if (!command) {
      await bot.sendMessage(group.id, `Comando personalizado '${commandTrigger}' não encontrado.`);
      return;
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
    
    await bot.sendMessage(group.id, `Comando personalizado '${commandTrigger}' excluído.`);
  }
  
  /**
   * Habilita um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async enableCustomCommand(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça o comando personalizado a ser habilitado. Exemplo: !g-enableCmd saudação');
      return;
    }
    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    const commandTrigger = args.join(' ').toLowerCase();
    
    // Obtém comandos personalizados para este grupo
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandTrigger && !cmd.deleted);
    
    if (!command) {
      await bot.sendMessage(group.id, `Comando personalizado '${commandTrigger}' não encontrado.`);
      return;
    }
    
    // Habilita comando
    command.active = true;
    
    // Atualiza o comando
    await this.database.updateCustomCommand(group.id, command);
    
    // Limpa cache de comandos para garantir que o comando atualizado seja carregado
    this.database.clearCache(`commands:${group.id}`);

    // Recarrega comandos
    await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
    
    await bot.sendMessage(group.id, `Comando personalizado '${commandTrigger}' habilitado.`);
  }
  
  /**
   * Desabilita um comando personalizado
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async disableCustomCommand(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça o comando personalizado a ser desabilitado. Exemplo: !g-disableCmd saudação');
      return;
    }
    
    // MELHORIA: Usa o comando completo como gatilho em vez de apenas a primeira palavra
    const commandTrigger = args.join(' ').toLowerCase();
    
    // Obtém comandos personalizados para este grupo
    const commands = await this.database.getCustomCommands(group.id);
    const command = commands.find(cmd => cmd.startsWith === commandTrigger && !cmd.deleted);
    
    if (!command) {
      await bot.sendMessage(group.id, `Comando personalizado '${commandTrigger}' não encontrado.`);
      return;
    }
    
    // Desabilita comando
    command.active = false;
    
    // Atualiza o comando
    await this.database.updateCustomCommand(group.id, command);
    
    // Limpa cache de comandos para garantir que o comando atualizado seja carregado
    this.database.clearCache(`commands:${group.id}`);

    // Recarrega comandos
    await bot.eventHandler.commandHandler.loadCustomCommandsForGroup(group.id);
    
    await bot.sendMessage(group.id, `Comando personalizado '${commandTrigger}' desabilitado.`);
  }
  
  /**
   * Define prefixo personalizado para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async setCustomPrefix(bot, message, args, group) {
    if (!group) return;
    
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
      await bot.sendMessage(group.id, `Prefixo de comando removido. Qualquer mensagem agora pode ser um comando.`);
    } else {
      await bot.sendMessage(group.id, `Prefixo de comando atualizado para: ${newPrefix}`);
    }
  }
  
  /**
   * Define mensagem de boas-vindas para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async setWelcomeMessage(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça uma mensagem de boas-vindas. Exemplo: !g-setWelcome Bem-vindo ao grupo, {pessoa}!');
      return;
    }
    
    const welcomeText = args.join(' ');
    
    // Atualiza mensagem de boas-vindas do grupo
    if (!group.greetings) {
      group.greetings = {};
    }
    group.greetings.text = welcomeText;
    await this.database.saveGroup(group);
    
    await bot.sendMessage(group.id, `Mensagem de boas-vindas atualizada para: ${welcomeText}`);
  }
  
  /**
   * Define mensagem de despedida para um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async setFarewellMessage(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça uma mensagem de despedida. Exemplo: !g-setFarewell Adeus, {pessoa}!');
      return;
    }
    
    const farewellText = args.join(' ');
    
    // Atualiza mensagem de despedida do grupo
    if (!group.farewells) {
      group.farewells = {};
    }
    group.farewells.text = farewellText;
    await this.database.saveGroup(group);
    
    await bot.sendMessage(group.id, `Mensagem de despedida atualizada para: ${farewellText}`);
  }
  
  /**
   * Mostra mensagem de ajuda de gerenciamento
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
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

    await bot.sendMessage(chatId, helpText);
  }


   /**
   * Mostra informações detalhadas do grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async showGroupInfo(bot, message, args, group) {
    if (!group) return;
    
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
      
      // Envia a mensagem
      await bot.sendMessage(group.id, infoMessage);
    } catch (error) {
      this.logger.error('Erro ao mostrar informações do grupo:', error);
      await bot.sendMessage(group.id, 'Erro ao recuperar informações do grupo. Por favor, tente novamente.');
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
   */
  async filterWord(bot, message, args, group) {
    if (!group) return;
    
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
      
      await bot.sendMessage(group.id, `*Palavras filtradas atualmente:*\n${wordFilters}\n\nPara adicionar ou remover uma palavra do filtro, use: !g-filtro-palavra <palavra ou frase>`);
      return;
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
      
      await bot.sendMessage(group.id, `✅ Palavra removida do filtro: "${word}"`);
    } else {
      // Adiciona a palavra
      group.filters.words.push(word);
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, `✅ Palavra adicionada ao filtro: "${word}"`);
    }
    
    // Mostra lista atualizada
    const wordFilters = group.filters.words.length > 0
      ? group.filters.words.join(', ')
      : 'Nenhuma palavra filtrada';
    
    await bot.sendMessage(group.id, `*Palavras filtradas atualmente:*\n${wordFilters}`);
  }
  
  /**
   * Ativa ou desativa filtro de links
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async filterLinks(bot, message, args, group) {
    if (!group) return;
    
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
      await bot.sendMessage(group.id, '✅ Filtro de links ativado. Mensagens contendo links serão apagadas automaticamente.');
    } else {
      await bot.sendMessage(group.id, '❌ Filtro de links desativado. Mensagens contendo links não serão mais filtradas.');
    }
  }
  
  /**
   * Adiciona ou remove uma pessoa do filtro
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async filterPerson(bot, message, args, group) {
    if (!group) return;
    
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
      
      await bot.sendMessage(group.id, `*Pessoas filtradas atualmente:*\n${personFilters}\n\nPara adicionar ou remover uma pessoa do filtro, use: !g-filtro-pessoa <número>`);
      return;
    }
    
    // Obtém número do primeiro argumento
    let numero = args[0].replace(/\D/g, ''); // Remove não-dígitos
    
    // Verifica se o número tem pelo menos 8 dígitos
    if (numero.length < 8) {
      await bot.sendMessage(group.id, '❌ O número deve ter pelo menos 8 dígitos.');
      return;
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
      
      await bot.sendMessage(group.id, `✅ Pessoa removida do filtro: ${numero}`);
    } else {
      // Adiciona o número
      group.filters.people.push(numero);
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, `✅ Pessoa adicionada ao filtro: ${numero}`);
    }
    
    // Mostra lista atualizada
    const personFilters = group.filters.people.length > 0
      ? group.filters.people.join(', ')
      : 'Nenhuma pessoa filtrada';
    
    await bot.sendMessage(group.id, `*Pessoas filtradas atualmente:*\n${personFilters}`);
  }
  
  /**
   * Ativa ou desativa filtro de conteúdo NSFW
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async filterNSFW(bot, message, args, group) {
    if (!group) return;
    
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
      await bot.sendMessage(group.id, '✅ Filtro de conteúdo NSFW ativado. Imagens e vídeos detectados como conteúdo adulto serão automaticamente removidos.');
    } else {
      await bot.sendMessage(group.id, '❌ Filtro de conteúdo NSFW desativado. Imagens e vídeos não serão filtrados para conteúdo adulto.');
    }
  }

  /**
   * Adiciona ou atualiza o número de WhatsApp de um doador
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async addDonorNumber(bot, message, args, group) {
    try {
      const chatId = message.group || message.author;
      
      if (args.length < 2) {
        await bot.sendMessage(chatId, 'Por favor, forneça um número e nome do doador. Exemplo: !g-addDonateNumero 5512345678901 João Silva');
        return;
      }
      
      // Extrai número e nome
      const numero = args[0].replace(/\D/g, ''); // Remove não-dígitos
      const donorName = args.slice(1).join(' ');
      
      if (!numero || numero.length < 10) {
        await bot.sendMessage(chatId, 'Por favor, forneça um número válido com código de país. Exemplo: 5512345678901');
        return;
      }
      
      // Atualiza número do doador no banco de dados
      const success = await this.database.updateDonorNumber(donorName, numero);
      
      if (success) {
        await bot.sendMessage(chatId, `Número ${numero} adicionado com sucesso ao doador ${donorName}`);
      } else {
        await bot.sendMessage(chatId, `Falha ao atualizar doador. Certifique-se que ${donorName} existe no banco de dados de doações.`);
      }
    } catch (error) {
      this.logger.error('Erro no comando addDonorNumber:', error);
      await bot.sendMessage(message.group || message.author, 'Erro ao processar comando.');
    }
  }

  /**
   * Atualiza valor de doação para um doador
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async updateDonationAmount(bot, message, args, group) {
    try {
      const chatId = message.group || message.author;
      
      if (args.length < 2) {
        await bot.sendMessage(chatId, 'Por favor, forneça um valor e nome do doador. Exemplo: !g-addDonateValor 50.5 João Silva');
        return;
      }
      
      // Extrai valor e nome
      const amountStr = args[0].replace(',', '.'); // Trata vírgula como separador decimal
      const amount = parseFloat(amountStr);
      const donorName = args.slice(1).join(' ');
      
      if (isNaN(amount)) {
        await bot.sendMessage(chatId, 'Por favor, forneça um valor válido. Exemplo: 50.5');
        return;
      }
      
      // Atualiza valor de doação no banco de dados
      const success = await this.database.updateDonationAmount(donorName, amount);
      
      if (success) {
        await bot.sendMessage(chatId, `${amount >= 0 ? 'Adicionado' : 'Subtraído'} ${Math.abs(amount).toFixed(2)} com sucesso ao doador ${donorName}`);
      } else {
        await bot.sendMessage(chatId, `Falha ao atualizar doação. Certifique-se que ${donorName} existe no banco de dados de doações.`);
      }
    } catch (error) {
      this.logger.error('Erro no comando updateDonationAmount:', error);
      await bot.sendMessage(message.group || message.author, 'Erro ao processar comando.');
    }
  }

  /**
   * Une dois doadores
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async mergeDonors(bot, message, args, group) {
    try {
      const chatId = message.group || message.author;
      
      // Obtém o texto completo do argumento
      const fullText = args.join(' ');
      
      if (!fullText.includes('##')) {
        await bot.sendMessage(chatId, 'Por favor, use o formato: !g-mergeDonates PrimeiroDoador##SegundoDoador');
        return;
      }
      
      // Divide os nomes
      const [targetName, sourceName] = fullText.split('##').map(name => name.trim());
      
      if (!targetName || !sourceName) {
        await bot.sendMessage(chatId, 'Ambos os nomes de doadores devem ser fornecidos. Formato: !g-mergeDonates PrimeiroDoador##SegundoDoador');
        return;
      }
      
      // Une doadores no banco de dados
      const success = await this.database.mergeDonors(targetName, sourceName);
      
      if (success) {
        await bot.sendMessage(chatId, `Doador ${sourceName} unido com sucesso a ${targetName}`);
      } else {
        await bot.sendMessage(chatId, `Falha ao unir doadores. Certifique-se que tanto ${targetName} quanto ${sourceName} existem no banco de dados de doações.`);
      }
    } catch (error) {
      this.logger.error('Erro no comando mergeDonors:', error);
      await bot.sendMessage(message.group || message.author, 'Erro ao processar comando.');
    }
  }

  /**
   * Entra em um grupo via link de convite
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async joinGroup(bot, message, args, group) {
    try {
      const chatId = message.group || message.author;
      
      if (args.length === 0) {
        await bot.sendMessage(chatId, 'Por favor, forneça um código de convite. Exemplo: !g-joinGrupo abcd1234');
        return;
      }
      
      // Obtém código de convite
      const inviteCode = args[0];
      
      // Obtém dados do autor, se fornecidos
      let authorId = null;
      let authorName = null;
      
      if (args.length > 1) {
        authorId = args[1];
        // O nome pode conter espaços, então juntamos o resto dos argumentos
        if (args.length > 2) {
          authorName = args.slice(2).join(' ');
        }
      }
      
      try {
        // Aceita o convite
        const joinResult = await bot.client.acceptInvite(inviteCode);
        
        if (joinResult) {
          await bot.sendMessage(chatId, `Entrou com sucesso no grupo com código de convite ${inviteCode}`);
          
          // Salva os dados do autor que enviou o convite para uso posterior
          if (authorId) {
            await this.database.savePendingJoin(inviteCode, { authorId, authorName });
          }
          
          // Remove dos convites pendentes se existir
          await this.database.removePendingInvite(inviteCode);
        } else {
          await bot.sendMessage(chatId, `Falha ao entrar no grupo com código de convite ${inviteCode}`);
        }
      } catch (error) {
        this.logger.error('Erro ao aceitar convite de grupo:', error);
        await bot.sendMessage(chatId, `Erro ao entrar no grupo: ${error.message}`);
      }
    } catch (error) {
      this.logger.error('Erro no comando joinGroup:', error);
      await bot.sendMessage(message.group || message.author, 'Erro ao processar comando.');
    }
  }

  /**
   * Define reação 'depois' personalizada para um comando
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async setReaction(bot, message, args, group) {
    if (!group) return;
    
    if (args.length < 2) {
      await bot.sendMessage(group.id, 'Por favor, forneça um nome de comando e emoji. Exemplo: !g-setReact sticker 🎯');
      return;
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
      
      await bot.sendMessage(group.id, `Definida reação 'depois' de '${commandName}' para ${emoji}`);
      return;
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
      
      await bot.sendMessage(group.id, `Definida reação 'depois' de '${commandName}' para ${emoji}`);
      return;
    }
    
    await bot.sendMessage(group.id, `Comando '${commandName}' não encontrado.`);
  }

  /**
   * Define reação 'antes' personalizada para um comando
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async setStartReaction(bot, message, args, group) {
    if (!group) return;
    
    if (args.length < 2) {
      await bot.sendMessage(group.id, 'Por favor, forneça um nome de comando e emoji. Exemplo: !g-setStartReact sticker 🎯');
      return;
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
      
      await bot.sendMessage(group.id, `Definida reação 'antes' de '${commandName}' para ${emoji}`);
      return;
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
      
      await bot.sendMessage(group.id, `Definida reação 'antes' de '${commandName}' para ${emoji}`);
      return;
    }
    
    await bot.sendMessage(group.id, `Comando '${commandName}' não encontrado.`);
  }

  /**
   * Alterna conversão automática de voz para texto em mensagens de voz em um grupo
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   */
  async toggleAutoStt(bot, message, args, group) {
    if (!group) return;
    
    // Alterna a configuração de auto-STT
    group.autoStt = !group.autoStt;
    
    // Atualiza grupo no banco de dados
    await this.database.saveGroup(group);
    
    // Envia mensagem de confirmação
    const statusMsg = group.autoStt ? 
      'Conversão automática de voz para texto agora está *ativada* para este grupo.' : 
      'Conversão automática de voz para texto agora está *desativada* para este grupo.';
    
    await bot.sendMessage(group.id, statusMsg);
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
      await bot.sendMessage(group.id, `Nenhum canal de ${platform} configurado. Use !g-${platform}-canal <nome do canal> para configurar.`);
      return null;
    }
    
    if (channels.length === 1) {
      return channels[0].channel;
    }
    
    // If multiple channels, show list and instructions
    const channelsList = channels.map(c => c.channel).join(', ');
    await bot.sendMessage(group.id, 
      `Múltiplos canais de ${platform} configurados. Especifique o canal:\n` +
      `!g-${platform}-midia-on <canal>\n\n` +
      `Canais configurados: ${channelsList}`
    );
    
    return null;
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
   */
  async toggleTwitchChannel(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça o nome do canal da Twitch. Exemplo: !g-twitch-canal nomeDoCanal');
      return;
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
      await bot.sendMessage(group.id, `Canal da Twitch removido: ${channelName}`);
      
      // Unsubscribe from StreamMonitor if it exists
      if (bot.streamMonitor) {
        bot.streamMonitor.unsubscribe(channelName, 'twitch');
      }
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
      
      await bot.sendMessage(group.id, 
        `Canal da Twitch adicionado: ${channelName}\n\n` +
        `Configuração padrão de notificação "online" definida. Use !g-twitch-midia-on ${channelName} para personalizar.`
      );
      
      // Subscribe to the channel in StreamMonitor
      if (bot.streamMonitor) {
        bot.streamMonitor.subscribe(channelName, 'twitch');
      } else {
        await bot.sendMessage(group.id, `⚠️ Aviso: O monitoramento de streams não está inicializado no bot. Entre em contato com o administrador.`);
      }
    }
  }

  /**
   * Sets the "online" media notification for a Twitch channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async setTwitchOnlineMedia(bot, message, args, group) {
    if (!group) return;
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'twitch');
    if (!channelName) return;
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`);
      return;
    }
    
    // Verify if this is a reply to a message
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      // Reset to default if no quoted message and no additional args
      channelConfig.onConfig = this.createDefaultNotificationConfig('twitch', channelName);
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, `Configuração de notificação "online" para o canal ${channelName} redefinida para o padrão.`);
      return;
    }
    
    if (!quotedMsg) {
      await bot.sendMessage(group.id, 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.');
      return;
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
      
      await bot.sendMessage(group.id, `Configuração de notificação "online" para o canal ${channelName} atualizada com sucesso.`);
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação "online" para o canal ${channelName}:`, error);
      await bot.sendMessage(group.id, `Erro ao configurar notificação: ${error.message}`);
    }
  }

  /**
   * Sets the "offline" media notification for a Twitch channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async setTwitchOfflineMedia(bot, message, args, group) {
    if (!group) return;
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'twitch');
    if (!channelName) return;
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`);
      return;
    }
    
    // Verify if this is a reply to a message
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      // Reset to empty if no quoted message and no additional args
      channelConfig.offConfig = {
        media: []
      };
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, `Configuração de notificação "offline" para o canal ${channelName} removida.`);
      return;
    }
    
    if (!quotedMsg) {
      await bot.sendMessage(group.id, 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.');
      return;
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
      
      await bot.sendMessage(group.id, `Configuração de notificação "offline" para o canal ${channelName} atualizada com sucesso.`);
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação "offline" para o canal ${channelName}:`, error);
      await bot.sendMessage(group.id, `Erro ao configurar notificação: ${error.message}`);
    }
  }

  /**
   * Toggles title change on stream events
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async toggleTwitchTitleChange(bot, message, args, group) {
    if (!group) return;
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'twitch');
    if (!channelName) return;
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`);
      return;
    }
    
    // Check if bot is admin in the group
    const isAdmin = await this.isBotAdmin(bot, group.id);
    
    if (!isAdmin) {
      await bot.sendMessage(group.id, 
        '⚠️ O bot não é administrador do grupo. Para alterar o título do grupo, o bot precisa ser um administrador. ' +
        'Por favor, adicione o bot como administrador e tente novamente.'
      );
      return;
    }
    
    // Toggle the setting
    channelConfig.changeTitleOnEvent = !channelConfig.changeTitleOnEvent;
    
    await this.database.saveGroup(group);
    
    const status = channelConfig.changeTitleOnEvent ? 'ativada' : 'desativada';
    
    await bot.sendMessage(group.id, 
      `Alteração de título para eventos do canal ${channelName} ${status}.\n\n` +
      (channelConfig.changeTitleOnEvent ? 
        `Você pode definir títulos personalizados com:\n` +
        `!g-twitch-titulo-on ${channelName} [título]\n` +
        `!g-twitch-titulo-off ${channelName} [título]` : 
        '')
    );
  }

  /**
   * Sets the custom "online" title for a Twitch channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async setTwitchOnlineTitle(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-twitch-titulo-on nomeDoCanal Título Personalizado');
      return;
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
      await bot.sendMessage(group.id, 
        `Múltiplos canais da Twitch configurados. Especifique o canal:\n` +
        `!g-twitch-titulo-on <canal> <título>\n\n` +
        `Canais configurados: ${channelsList}`
      );
      return;
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`);
      return;
    }
    
    // If no title provided, remove custom title
    if (!customTitle) {
      delete channelConfig.onlineTitle;
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, 
        `Título personalizado para eventos "online" do canal ${channelName} removido.\n` +
        `O bot irá substituir automaticamente "OFF" por "ON" no título do grupo quando o canal ficar online.`
      );
      return;
    }
    
    // Set custom title
    channelConfig.onlineTitle = customTitle;
    
    // Make sure title change is enabled
    if (!channelConfig.changeTitleOnEvent) {
      channelConfig.changeTitleOnEvent = true;
      await bot.sendMessage(group.id, `Alteração de título para eventos foi automaticamente ativada.`);
    }
    
    await this.database.saveGroup(group);
    
    await bot.sendMessage(group.id, `Título personalizado para eventos "online" do canal ${channelName} definido: "${customTitle}"`);
  }

  /**
   * Sets the custom "offline" title for a Twitch channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async setTwitchOfflineTitle(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça o nome do canal ou título personalizado. Exemplo: !g-twitch-titulo-off nomeDoCanal Título Personalizado');
      return;
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
      await bot.sendMessage(group.id, 
        `Múltiplos canais da Twitch configurados. Especifique o canal:\n` +
        `!g-twitch-titulo-off <canal> <título>\n\n` +
        `Canais configurados: ${channelsList}`
      );
      return;
    }
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`);
      return;
    }
    
    // If no title provided, remove custom title
    if (!customTitle) {
      delete channelConfig.offlineTitle;
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, 
        `Título personalizado para eventos "offline" do canal ${channelName} removido.\n` +
        `O bot irá substituir automaticamente "ON" por "OFF" no título do grupo quando o canal ficar offline.`
      );
      return;
    }
    
    // Set custom title
    channelConfig.offlineTitle = customTitle;
    
    // Make sure title change is enabled
    if (!channelConfig.changeTitleOnEvent) {
      channelConfig.changeTitleOnEvent = true;
      await bot.sendMessage(group.id, `Alteração de título para eventos foi automaticamente ativada.`);
    }
    
    await this.database.saveGroup(group);
    
    await bot.sendMessage(group.id, `Título personalizado para eventos "offline" do canal ${channelName} definido: "${customTitle}"`);
  }

  /**
   * Toggles AI generated messages for stream events
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async toggleTwitchAI(bot, message, args, group) {
    if (!group) return;
    
    // Validate and get channel name
    const channelName = await this.validateChannelName(bot, message, args, group, 'twitch');
    if (!channelName) return;
    
    // Find the channel configuration
    const channelConfig = this.findChannelConfig(group, 'twitch', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal da Twitch não configurado: ${channelName}. Use !g-twitch-canal ${channelName} para configurar.`);
      return;
    }
    
    // Toggle the setting
    channelConfig.useAI = !channelConfig.useAI;
    
    await this.database.saveGroup(group);
    
    const status = channelConfig.useAI ? 'ativadas' : 'desativadas';
    
    await bot.sendMessage(group.id, 
      `Mensagens geradas por IA para eventos do canal ${channelName} ${status}.\n\n` +
      (channelConfig.useAI ? 
        `O bot usará IA para gerar mensagens personalizadas quando o canal ficar online.` : 
        '')
    );
  }

  /**
   * Toggles monitoring of a Kick channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async toggleKickChannel(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça o nome do canal do Kick. Exemplo: !g-kick-canal nomeDoCanal');
      return;
    }
    
    const channelName = args[0].toLowerCase();
    
    // Get current channels
    const channels = this.getChannelConfig(group, 'kick');
    
    // Check if channel is already configured
    const existingChannel = this.findChannelConfig(group, 'kick', channelName);
    
    if (existingChannel) {
      // Remove channel
      const updatedChannels = channels.filter(c => c.channel.toLowerCase() !== channelName.toLowerCase());
      group.kick = updatedChannels;
      
      await this.database.saveGroup(group);
      await bot.sendMessage(group.id, `Canal do Kick removido: ${channelName}`);
      
      // Unsubscribe from StreamMonitor if it exists
      if (bot.streamMonitor) {
        bot.streamMonitor.unsubscribe(channelName, 'kick');
      }
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
      
      await bot.sendMessage(group.id, 
        `Canal do Kick adicionado: ${channelName}\n\n` +
        `Configuração padrão de notificação "online" definida. Use !g-kick-midia-on ${channelName} para personalizar.`
      );
      
      // Subscribe to the channel in StreamMonitor
      if (bot.streamMonitor) {
        bot.streamMonitor.subscribe(channelName, 'kick');
      } else {
        await bot.sendMessage(group.id, `⚠️ Aviso: O monitoramento de streams não está inicializado no bot. Entre em contato com o administrador.`);
      }
    }
  }

  /**
   * Sets the "online" media notification for a Kick channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async setKickOnlineMedia(bot, message, args, group) {
    // This is identical to setTwitchOnlineMedia except for platform name differences
    if (!group) return;
    
    const channelName = await this.validateChannelName(bot, message, args, group, 'kick');
    if (!channelName) return;
    
    const channelConfig = this.findChannelConfig(group, 'kick', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal do Kick não configurado: ${channelName}. Use !g-kick-canal ${channelName} para configurar.`);
      return;
    }
    
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      channelConfig.onConfig = this.createDefaultNotificationConfig('kick', channelName);
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, `Configuração de notificação "online" para o canal ${channelName} redefinida para o padrão.`);
      return;
    }
    
    if (!quotedMsg) {
      await bot.sendMessage(group.id, 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.');
      return;
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
      
      await bot.sendMessage(group.id, `Configuração de notificação "online" para o canal ${channelName} atualizada com sucesso.`);
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação "online" para o canal ${channelName}:`, error);
      await bot.sendMessage(group.id, `Erro ao configurar notificação: ${error.message}`);
    }
  }

  /**
   * Sets the "offline" media notification for a Kick channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async setKickOfflineMedia(bot, message, args, group) {
    // Identical to setTwitchOfflineMedia with platform name differences
    if (!group) return;
    
    const channelName = await this.validateChannelName(bot, message, args, group, 'kick');
    if (!channelName) return;
    
    const channelConfig = this.findChannelConfig(group, 'kick', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal do Kick não configurado: ${channelName}. Use !g-kick-canal ${channelName} para configurar.`);
      return;
    }
    
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      channelConfig.offConfig = { media: [] };
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, `Configuração de notificação "offline" para o canal ${channelName} removida.`);
      return;
    }
    
    if (!quotedMsg) {
      await bot.sendMessage(group.id, 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.');
      return;
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
      
      await bot.sendMessage(group.id, `Configuração de notificação "offline" para o canal ${channelName} atualizada com sucesso.`);
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação "offline" para o canal ${channelName}:`, error);
      await bot.sendMessage(group.id, `Erro ao configurar notificação: ${error.message}`);
    }
  }

  // Other Kick command handlers (toggleKickTitleChange, setKickOnlineTitle, setKickOfflineTitle, toggleKickAI)
  // follow identical patterns to the Twitch versions with platform name changes

  /**
   * Toggles title change on Kick stream events
   */
  async toggleKickTitleChange(bot, message, args, group) {
    // Identical to Twitch version with platform name differences
    if (!group) return;
    
    const channelName = await this.validateChannelName(bot, message, args, group, 'kick');
    if (!channelName) return;
    
    const channelConfig = this.findChannelConfig(group, 'kick', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal do Kick não configurado: ${channelName}. Use !g-kick-canal ${channelName} para configurar.`);
      return;
    }
    
    const isAdmin = await this.isBotAdmin(bot, group.id);
    
    if (!isAdmin) {
      await bot.sendMessage(group.id, 
        '⚠️ O bot não é administrador do grupo. Para alterar o título do grupo, o bot precisa ser um administrador. ' +
        'Por favor, adicione o bot como administrador e tente novamente.'
      );
      return;
    }
    
    channelConfig.changeTitleOnEvent = !channelConfig.changeTitleOnEvent;
    
    await this.database.saveGroup(group);
    
    const status = channelConfig.changeTitleOnEvent ? 'ativada' : 'desativada';
    
    await bot.sendMessage(group.id, 
      `Alteração de título para eventos do canal ${channelName} ${status}.\n\n` +
      (channelConfig.changeTitleOnEvent ? 
        `Você pode definir títulos personalizados com:\n` +
        `!g-kick-titulo-on ${channelName} [título]\n` +
        `!g-kick-titulo-off ${channelName} [título]` : 
        '')
    );
  }

  /**
   * Toggles monitoring of a YouTube channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async toggleYoutubeChannel(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      await bot.sendMessage(group.id, 'Por favor, forneça o nome ou ID do canal do YouTube. Exemplo: !g-youtube-canal nomeDoCanal');
      return;
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
      await bot.sendMessage(group.id, `Canal do YouTube removido: ${channelName}`);
      
      // Unsubscribe from StreamMonitor if it exists
      if (bot.streamMonitor) {
        bot.streamMonitor.unsubscribe(channelName, 'youtube');
      }
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
      
      await bot.sendMessage(group.id, 
        `Canal do YouTube adicionado: ${channelName}\n\n` +
        `Configuração padrão de notificação de vídeo definida. Use !g-youtube-midia-on ${channelName} para personalizar.`
      );
      
      // Subscribe to the channel in StreamMonitor
      if (bot.streamMonitor) {
        bot.streamMonitor.subscribe(channelName, 'youtube');
      } else {
        await bot.sendMessage(group.id, `⚠️ Aviso: O monitoramento de canais não está inicializado no bot. Entre em contato com o administrador.`);
      }
    }
  }

  /**
   * Sets the video notification media for a YouTube channel
   * @param {WhatsAppBot} bot - The bot instance
   * @param {Object} message - The message object
   * @param {Array} args - Command arguments
   * @param {Object} group - The group object
   */
  async setYoutubeOnlineMedia(bot, message, args, group) {
    // Similar to Twitch/Kick but with YouTube specific terms
    if (!group) return;
    
    const channelName = await this.validateChannelName(bot, message, args, group, 'youtube');
    if (!channelName) return;
    
    const channelConfig = this.findChannelConfig(group, 'youtube', channelName);
    
    if (!channelConfig) {
      await bot.sendMessage(group.id, `Canal do YouTube não configurado: ${channelName}. Use !g-youtube-canal ${channelName} para configurar.`);
      return;
    }
    
    const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
    
    if (!quotedMsg && args.length <= 1) {
      channelConfig.onConfig = this.createDefaultNotificationConfig('youtube', channelName);
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, `Configuração de notificação de vídeo para o canal ${channelName} redefinida para o padrão.`);
      return;
    }
    
    if (!quotedMsg) {
      await bot.sendMessage(group.id, 'Este comando deve ser usado como resposta a uma mensagem ou mídia para definir a notificação.');
      return;
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
      
      await bot.sendMessage(group.id, `Configuração de notificação de vídeo para o canal ${channelName} atualizada com sucesso.`);
    } catch (error) {
      this.logger.error(`Erro ao configurar notificação de vídeo para o canal ${channelName}:`, error);
      await bot.sendMessage(group.id, `Erro ao configurar notificação: ${error.message}`);
    }
  }

  /**
   * Sets a nickname for a user in a group
   * @param {WhatsAppBot} bot - Bot instance
   * @param {Object} message - Message data
   * @param {Array} args - Command arguments
   * @param {Object} group - Group data
   */
  async setUserNickname(bot, message, args, group) {
    try {
      if (!group) {
        await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
        return;
      }
      
      // If no args, show current nickname if exists
      if (args.length === 0) {
        const userNick = this.getUserNickname(group, message.author);
        if (userNick) {
          await bot.sendMessage(group.id, `Seu apelido atual é: ${userNick}`);
        } else {
          await bot.sendMessage(group.id, 'Você não tem um apelido definido. Use !g-apelido [apelido] para definir um.');
        }
        return;
      }
      
      // Get nickname from arguments
      let nickname = args.join(' ');
      
      // Limit to 20 characters
      if (nickname.length > 20) {
        nickname = nickname.substring(0, 20);
        await bot.sendMessage(group.id, `O apelido foi limitado a 20 caracteres: ${nickname}`);
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
      
      await bot.sendMessage(group.id, `Apelido definido: ${nickname}`);
    } catch (error) {
      this.logger.error('Erro ao definir apelido:', error);
      await bot.sendMessage(message.group || message.author, 'Erro ao definir apelido. Por favor, tente novamente.');
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
   */
  async ignoreUser(bot, message, args, group) {
    try {
      if (!group) {
        await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
        return;
      }
      
      if (args.length === 0) {
        // Show currently ignored users
        if (!group.ignoredNumbers || !Array.isArray(group.ignoredNumbers) || group.ignoredNumbers.length === 0) {
          await bot.sendMessage(group.id, 'Nenhum número está sendo ignorado neste grupo.');
        } else {
          let ignoredList = '*Números ignorados:*\n';
          group.ignoredNumbers.forEach(number => {
            ignoredList += `- ${number}\n`;
          });
          await bot.sendMessage(group.id, ignoredList);
        }
        return;
      }
      
      // Get number from argument and clean it (keep only digits)
      let number = args[0].replace(/\D/g, '');
      
      // Check if number has at least 8 digits
      if (number.length < 8) {
        await bot.sendMessage(group.id, 'O número deve ter pelo menos 8 dígitos.');
        return;
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
        await bot.sendMessage(group.id, `O número ${number} não será mais ignorado.`);
      } else {
        // Add number to ignored list
        group.ignoredNumbers.push(number);
        await this.database.saveGroup(group);
        await bot.sendMessage(group.id, `O número ${number} será ignorado.`);
      }
    } catch (error) {
      this.logger.error('Erro ao ignorar usuário:', error);
      await bot.sendMessage(message.group || message.author, 'Erro ao processar comando. Por favor, tente novamente.');
    }
  }

  /**
   * Mutes messages starting with a specific string
   * @param {WhatsAppBot} bot - Bot instance
   * @param {Object} message - Message data
   * @param {Array} args - Command arguments
   * @param {Object} group - Group data
   */
  async muteCommand(bot, message, args, group) {
    try {
      if (!group) {
        await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
        return;
      }
      
      if (args.length === 0) {
        // Show currently muted strings
        if (!group.mutedStrings || !Array.isArray(group.mutedStrings) || group.mutedStrings.length === 0) {
          await bot.sendMessage(group.id, 'Nenhuma string está sendo ignorada neste grupo.');
        } else {
          let mutedList = '*Strings ignoradas:*\n';
          group.mutedStrings.forEach(str => {
            mutedList += `- "${str}"\n`;
          });
          await bot.sendMessage(group.id, mutedList);
        }
        return;
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
        await bot.sendMessage(group.id, `Mensagens começando com "${muteString}" não serão mais ignoradas.`);
      } else {
        // Add string to muted list
        group.mutedStrings.push(muteString);
        await this.database.saveGroup(group);
        await bot.sendMessage(group.id, `Mensagens começando com "${muteString}" serão ignoradas.`);
      }
    } catch (error) {
      this.logger.error('Erro ao configurar mute:', error);
      await bot.sendMessage(message.group || message.author, 'Erro ao processar comando. Por favor, tente novamente.');
    }
  }

  /**
   * Add custom admin
   * @param {WhatsAppBot} bot - Bot instance
   * @param {Object} message - Message data
   * @param {Array} args - Command arguments
   * @param {Object} group - Group data
   */
  async customAdmin(bot, message, args, group) {
    if (!group) return;
    
    if (args.length === 0) {
      // Mostra lista atual de admins adicionais
      const admins = group.additionalAdmins || [];
      if (admins.length === 0) {
        await bot.sendMessage(group.id, 'Não há administradores adicionais configurados para este grupo.');
      } else {
        let adminList = '*Administradores adicionais:*\n';
        for (const admin of admins) {
          // Formata o número para exibição
          const formattedNumber = this.formatPhoneNumber(admin);
          adminList += `- ${formattedNumber}\n`;
        }
        await bot.sendMessage(group.id, adminList);
      }
      return;
    }
    
    // Obtém e formata o número do argumento
    let numero = args[0].replace(/\D/g, '');
    
    // Verifica se o número tem pelo menos 8 dígitos
    if (numero.length < 8) {
      await bot.sendMessage(group.id, 'O número deve ter pelo menos 8 dígitos.');
      return;
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
      
      await bot.sendMessage(group.id, `Número removido da lista de administradores adicionais: ${this.formatPhoneNumber(numero)}`);
    } else {
      // Adiciona o número
      group.additionalAdmins.push(numero);
      await this.database.saveGroup(group);
      
      await bot.sendMessage(group.id, `Número adicionado à lista de administradores adicionais: ${this.formatPhoneNumber(numero)}`);
    }
    
    // Exibe a lista atualizada
    const admins = group.additionalAdmins || [];
    if (admins.length === 0) {
      await bot.sendMessage(group.id, 'Lista de administradores adicionais está vazia agora.');
    } else {
      let adminList = '*Lista de administradores adicionais atualizada:*\n';
      for (const admin of admins) {
        const formattedNumber = this.formatPhoneNumber(admin);
        adminList += `- ${formattedNumber}\n`;
      }
      await bot.sendMessage(group.id, adminList);
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
   */
  async function pauseGroup(bot, message, args, group) {
    try {
      if (!group) {
        await bot.sendMessage(message.author, 'Este comando só pode ser usado em grupos.');
        return;
      }
      
      // Alterna o estado de pausa do grupo
      group.paused = !group.paused;
      
      // Salva a configuração atualizada
      await this.database.saveGroup(group);
      
      if (group.paused) {
        await bot.sendMessage(group.id, '⏸️ Bot pausado neste grupo. Somente o comando `!g-pausar` será processado até que seja reativado.');
      } else {
        await bot.sendMessage(group.id, '▶️ Bot reativado neste grupo. Todos os comandos estão disponíveis novamente.');
      }
      
      this.logger.info(`Grupo ${group.id} ${group.paused ? 'pausado' : 'reativado'}`);
    } catch (error) {
      this.logger.error('Erro ao pausar/retomar grupo:', error);
      await bot.sendMessage(message.group || message.author, 'Erro ao processar comando. Por favor, tente novamente.');
    }
  }

}

module.exports = Management;