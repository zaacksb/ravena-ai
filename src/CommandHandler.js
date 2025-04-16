const path = require('path');
const fs = require('fs/promises');
const Database = require('./utils/Database');
const Logger = require('./utils/Logger');
const FixedCommands = require('./commands/FixedCommands');
const Management = require('./commands/Management');
const CustomVariableProcessor = require('./utils/CustomVariableProcessor');

class CommandHandler {
  constructor() {
    this.logger = new Logger('command-handler');
    this.database = Database.getInstance();
    this.fixedCommands = new FixedCommands();
    this.management = new Management();
    this.variableProcessor = new CustomVariableProcessor();
    this.customCommands = {}; // Agrupados por groupId
    this.privateManagement = {}; // Para gerenciar grupos a partir de chats privados
    
    // Emojis de reação padrão
    this.defaultReactions = {
      before: "⏳",
      after: "✅",
      error: "❌" 
    };
    
    // Inicializa cache de comandos
    this.loadAllCommands();
  }

  /**
   * Carrega todos os comandos de arquivos e banco de dados
   */
  async loadAllCommands() {
    try {
      // Carrega comandos fixos
      await this.fixedCommands.loadCommands();
      this.logger.debug(`Carregados ${this.fixedCommands.getAllCommands().length} comandos fixos`);
      
      // Imprime comandos fixos carregados
      this.logger.debug('Comandos fixos:', this.fixedCommands.getAllCommands().map(cmd => cmd.name));
      
      // Carrega comandos personalizados para todos os grupos
      const groups = await this.database.getGroups();
      if (groups && Array.isArray(groups)) {
        for (const group of groups) {
          await this.loadCustomCommandsForGroup(group.id);
        }

        this.logger.debug(`Carregados comandos personalizados para ${groups.length} grupos`);
        
        // Imprime comandos personalizados por grupo
        for (const groupId in this.customCommands) {
          this.logger.debug(`Comandos personalizados para o grupo ${groupId}:`, 
            this.customCommands[groupId].map(cmd => cmd.startsWith));
        }
      }
      
      this.logger.info('Todos os comandos carregados com sucesso');
    } catch (error) {
      this.logger.error('Erro ao carregar comandos:', error);
    }
  }

  /**
   * Carrega comandos personalizados para um grupo específico
   * @param {string} groupId - O ID do grupo
   */
  async loadCustomCommandsForGroup(groupId) {
    try {
      const customCommands = await this.database.getCustomCommands(groupId);
      if (customCommands && Array.isArray(customCommands)) {
        this.customCommands[groupId] = customCommands.filter(cmd => cmd.active && !cmd.deleted);
        this.logger.info(`Carregados ${this.customCommands[groupId].length} comandos personalizados para o grupo ${groupId}`);
      } else {
        this.customCommands[groupId] = [];
        this.logger.debug(`Nenhum comando personalizado encontrado para o grupo ${groupId}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao carregar comandos personalizados para o grupo ${groupId}:`, error);
      this.customCommands[groupId] = [];
    }
  }

  /**
   * Manipula uma mensagem de comando
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {string} commandText - O texto do comando (sem prefixo)
   * @param {Group} group - O objeto do grupo (se em grupo)
   */
  async handleCommand(bot, message, commandText, group) {
    try {
      // Obtém a primeira palavra como nome do comando
      const [command, ...args] = commandText.trim().split(/\s+/);
      
      this.logger.debug(`Processando comando: ${command}, args: ${args.join(', ')}`);
      
      // Verifica se é um comando de gerenciamento privado
      if (!message.group && this.privateManagement[message.author]) {
        const managedGroupId = this.privateManagement[message.author];
        const managedGroup = await this.database.getGroup(managedGroupId);
        
        if (managedGroup) {
          // Processa como se a mensagem fosse enviada no grupo gerenciado
          this.logger.info(`Processando comando de gerenciamento para o grupo ${managedGroupId} de chat privado por ${message.author}`);
          return this.processCommand(bot, { ...message, group: managedGroupId }, command, args, managedGroup);
        } else {
          this.logger.warn(`Falha ao encontrar grupo gerenciado ${managedGroupId} para o usuário ${message.author}`);
        }
      }
      
      // Processa comando normalmente
      this.processCommand(bot, message, command, args, group).catch(error => {
        this.logger.error('Erro em processCommand:', error);
      });
      
      // Nota: Não esperamos processCommand para evitar bloquear a thread de eventos
    } catch (error) {
      this.logger.error('Erro ao manipular comando:', error);
    }
  }

  /**
   * Processa um comando após determinar seu tipo
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {string} command - O nome do comando
   * @param {Array} args - Argumentos do comando
   * @param {Group} group - O objeto do grupo (se em grupo)
   */
  async processCommand(bot, message, command, args, group) {
    this.logger.debug(`Processando comando: ${command}, determinação de tipo`);
    
    // Verifica se é um comando de gerenciamento
    if (command.startsWith('g-')) {
      this.logger.debug(`Identificado como comando de gerenciamento: ${command}`);
      await this.processManagementCommand(bot, message, command, args, group);
      return;
    }
    
    // Verifica se é um comando fixo
    const fixedCommand = this.fixedCommands.getCommand(command);
    if (fixedCommand) {
      this.logger.debug(`Identificado como comando fixo: ${command}`);
      await this.executeFixedCommand(bot, message, fixedCommand, args, group);
      return;
    }
    
    // Verifica se é um comando personalizado (apenas para mensagens de grupo)
    if (group && this.customCommands[group.id]) {
      const customCommand = this.findCustomCommand(command, this.customCommands[group.id]);
      if (customCommand) {
        this.logger.debug(`Identificado como comando personalizado: ${command} (${customCommand.startsWith})`);
        await this.executeCustomCommand(bot, message, customCommand, args, group);
        return;
      }
    }
    
    // Nenhum comando encontrado
    this.logger.info(`Comando desconhecido: ${command}`);
    
    // Se em um grupo, podemos querer notificar sobre comando desconhecido (opcional)
    if (group && process.env.NOTIFY_UNKNOWN_COMMANDS === 'true') {
      await bot.sendMessage(group.id, `Comando desconhecido: ${command}`);
    }
  }

  /**
   * Processa um comando de gerenciamento
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {string} command - O nome do comando
   * @param {Array} args - Argumentos do comando
   * @param {Group} group - O objeto do grupo (se em grupo)
   */
  async processManagementCommand(bot, message, command, args, group) {
    try {
      this.logger.debug(`Processando comando de gerenciamento: ${command}, args: ${args.join(', ')}`);
      
      // Reage com o emoji "antes"
      try {
        // Usa emoji de reação padrão
        await message.origin.react(this.defaultReactions.before);
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "antes":', reactError);
      }
      
      // Caso especial para gerenciar grupos a partir de chat privado
      if (command === 'g-manage' && args.length > 0 && !message.group) {
        const groupName = args[0].toLowerCase();
        const groups = await this.database.getGroups();
        const targetGroup = groups.find(g => g.name.toLowerCase() === groupName);
        
        if (targetGroup) {
          this.privateManagement[message.author] = targetGroup.id;
          this.logger.info(`Usuário ${message.author} agora está gerenciando o grupo: ${targetGroup.name} (${targetGroup.id})`);
          await bot.sendMessage(message.author, `Você agora está gerenciando o grupo: ${targetGroup.name}`);
          
          // Reage com o emoji "depois"
          try {
            await message.origin.react(this.defaultReactions.after);
          } catch (reactError) {
            this.logger.error('Erro ao aplicar reação "depois":', reactError);
          }
          
          return;
        } else {
          this.logger.warn(`Grupo não encontrado: ${groupName}`);
          await bot.sendMessage(message.author, `Grupo não encontrado: ${groupName}`);
          
          // Reage com o emoji "depois" mesmo para erro
          try {
            await message.origin.react(this.defaultReactions.after);
          } catch (reactError) {
            this.logger.error('Erro ao aplicar reação "depois":', reactError);
          }
          
          return;
        }
      }
      
      // Comandos de gerenciamento regulares requerem um grupo
      if (!group) {
        this.logger.warn(`Comando de gerenciamento ${command} tentado em chat privado`);
        await bot.sendMessage(message.author, 'Comandos de gerenciamento só podem ser usados em grupos');
        
        // Reage com o emoji "depois" mesmo para erro
        try {
          await message.origin.react(this.defaultReactions.after);
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "depois":', reactError);
        }
        
        return;
      }
      
      // Remove o prefixo 'g-'
      const managementCommand = command.substring(2);
      
      // Encontra o método de gerenciamento apropriado
      const methodName = this.management.getCommandMethod(managementCommand);
      if (methodName && typeof this.management[methodName] === 'function') {
        this.logger.debug(`Executando método de gerenciamento: ${methodName}`);
        await this.management[methodName](bot, message, args, group);
      } else {
        this.logger.warn(`Comando de gerenciamento desconhecido: ${managementCommand}`);
        await bot.sendMessage(message.group, `Comando de gerenciamento desconhecido: ${managementCommand}`);
      }
      
      // Reage com o emoji "depois"
      try {
        await message.origin.react(this.defaultReactions.after);
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "depois":', reactError);
      }
      
    } catch (error) {
      this.logger.error('Erro ao processar comando de gerenciamento:', error);
      try {
        const chatId = message.group || message.author;
        await bot.sendMessage(chatId, 'Erro ao processar comando de gerenciamento');
        
        // Reage com o emoji "depois" mesmo para erro
        try {
          await message.origin.react(this.defaultReactions.after);
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "depois":', reactError);
        }
      } catch (sendError) {
        this.logger.error('Erro ao enviar mensagem de erro:', sendError);
      }
    }
  }

  /**
   * Executa um comando fixo
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {Object} command - O objeto de comando
   * @param {Array} args - Argumentos do comando
   * @param {Group} group - O objeto do grupo (se em grupo)
   */
  async executeFixedCommand(bot, message, command, args, group) {
    try {
      this.logger.info(`Executando comando fixo: ${command.name}, args: ${args.join(', ')}`);
      
      // Verifica se o comando requer mensagem citada
      if (command.needsQuotedMsg) {
        const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
        if (!quotedMsg) {
          this.logger.debug(`Comando ${command.name} requer mensagem citada, mas nenhuma foi fornecida`);
          return; // Ignora o comando silenciosamente
        }
      }
      
      // Verifica se o comando requer mídia
      if (command.needsMedia) {
        const hasDirectMedia = message.type !== 'text';
        
        // Verifica a mensagem citada para mídia se a mensagem direta não tiver
        let hasQuotedMedia = false;
        if (!hasDirectMedia) {
          const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
          hasQuotedMedia = quotedMsg && quotedMsg.hasMedia;
        }
        
        if (!hasDirectMedia && !hasQuotedMedia) {
          this.logger.debug(`Comando ${command.name} requer mídia, mas nenhuma foi fornecida`);
          return; // Ignora o comando silenciosamente
        }
      }
      
      // Reage com emoji "antes" (específico do comando ou padrão)
      const beforeEmoji = command.reactions?.before || this.defaultReactions.before;
      try {
        await message.origin.react(beforeEmoji);
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "antes":', reactError);
      }
      
      // Executa método do comando
      if (typeof command.method === 'function') {
        await command.method(bot, message, args, group);
        this.logger.debug(`Comando ${command.name} executado com sucesso`);
        
        // Reage com emoji "depois" (específico do comando ou padrão)
        const afterEmoji = command.reactions?.after || this.defaultReactions.after;
        try {
          await message.origin.react(afterEmoji);
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "depois":', reactError);
        }
      } else {
        this.logger.error(`Método de comando inválido para ${command.name}`);
        
        // Reage com emoji "depois" mesmo para erro
        const afterEmoji = command.reactions?.after || this.defaultReactions.after;
        try {
          await message.origin.react(afterEmoji);
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "depois":', reactError);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao executar comando fixo ${command.name}:`, error);
      try {
        const chatId = message.group || message.author;
        await bot.sendMessage(chatId, `Erro ao executar comando: ${command.name}`);
        
        // Aplica reação de erro
        const errorEmoji = command.reactions?.error || this.defaultReactions.error;
        try {
          await message.origin.react(errorEmoji);
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação de erro:', reactError);
        }
      } catch (sendError) {
        this.logger.error('Erro ao enviar mensagem de erro:', sendError);
      }
    }
  }

  /**
   * Encontra um comando personalizado pelo nome na lista
   * @param {string} commandName - O nome do comando
   * @param {Array} commands - Lista de comandos personalizados
   * @returns {Object|null} - O objeto de comando personalizado ou null
   */
  findCustomCommand(commandName, commands) {
    const matchedCommand = commands.find(cmd => {
      // Verifica se o comando começa com o nome fornecido
      if (cmd.startsWith && commandName.toLowerCase().startsWith(cmd.startsWith.toLowerCase())) {
        return true;
      }
      return false;
    });
    
    this.logger.debug(`Buscando comando personalizado '${commandName}': ${matchedCommand ? 'encontrado' : 'não encontrado'}`);
    return matchedCommand || null;
  }

  /**
   * Executa um comando personalizado
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {Object} command - O objeto de comando personalizado
   * @param {Array} args - Argumentos do comando
   * @param {Group} group - O objeto do grupo
   */
  async executeCustomCommand(bot, message, command, args, group) {
    try {
      this.logger.info(`Executando comando personalizado: ${command.startsWith}`);
      
      // Verifica se o comando está em cooldown
      if (command.cooldown && command.lastUsed) {
        const now = Date.now();
        const timeSinceLastUse = now - command.lastUsed;
        if (timeSinceLastUse < command.cooldown * 1000) {
          const secondsLeft = Math.ceil((command.cooldown * 1000 - timeSinceLastUse) / 1000);
          this.logger.debug(`Comando ${command.startsWith} está em cooldown por mais ${secondsLeft} segundos`);
          const response = `Comando está em cooldown. Tente novamente em ${secondsLeft} segundos.`;
          await bot.sendMessage(message.group, response);
          return;
        }
      }
      
      // Verificar período de tempo e expiração como no código original...
      
      // Obtém as respostas
      const responses = command.responses || [];
      if (responses.length === 0) {
        this.logger.warn(`Comando ${command.startsWith} não tem respostas`);
        return;
      }
      
      // Reage com emoji antes (do comando ou padrão)
      const beforeEmoji = command.reactions?.before || null;
      try {
        if (beforeEmoji && command.react !== false) {
          await message.origin.react(beforeEmoji);
        }
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "antes":', reactError);
      }
      
      // Atualiza estatísticas de uso do comando
      command.count = (command.count || 0) + 1;
      command.lastUsed = Date.now();
      await this.database.updateCustomCommand(group.id, command);
      this.logger.debug(`Atualizadas estatísticas de uso para o comando ${command.startsWith}, contagem: ${command.count}`);
      
      // Reage à mensagem se especificado (esta é a reação específica do comando)
      if (command.react) {
        try {
          this.logger.debug(`Reagindo à mensagem com: ${command.react}`);
          await message.origin.react(command.react);
        } catch (error) {
          this.logger.error('Erro ao reagir à mensagem:', error);
        }
      }
      
      // Envia todas as respostas ou seleciona uma aleatória
      if (command.sendAllResponses) {
        this.logger.debug(`Enviando todas as ${responses.length} respostas para o comando ${command.startsWith}`);
        for (const response of responses) {
          await this.sendCustomCommandResponse(bot, message, response, command, group);
        }
      } else {
        const randomIndex = Math.floor(Math.random() * responses.length);
        this.logger.debug(`Enviando resposta aleatória (${randomIndex + 1}/${responses.length}) para o comando ${command.startsWith}`);
        await this.sendCustomCommandResponse(bot, message, responses[randomIndex], command, group);
      }
      
      // Reage com emoji depois (do comando ou padrão)
      const afterEmoji = command.reactions?.after || null;
      try {
        if (afterEmoji && command.react !== false) {
          await message.origin.react(afterEmoji);
        }
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "depois":', reactError);
      }
      
    } catch (error) {
      this.logger.error(`Erro ao executar comando personalizado ${command.startsWith}:`, error);
      try {
        await bot.sendMessage(message.group, `Erro ao executar comando personalizado: ${command.startsWith}`);
        
        // Reage com emoji de erro
        const errorEmoji = command.reactions?.error || "❌";
        try {
          if (command.react !== false) {
            await message.origin.react(errorEmoji);
          }
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação de erro:', reactError);
        }
      } catch (sendError) {
        this.logger.error('Erro ao enviar mensagem de erro:', sendError);
      }
    }
  }
  
  /**
   * Envia uma resposta para um comando personalizado
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem original
   * @param {string} responseText - O texto da resposta
   * @param {Object} command - O objeto de comando personalizado
   * @param {Group} group - O objeto do grupo
   */
  async sendCustomCommandResponse(bot, message, responseText, command, group) {
    try {
      this.logger.debug(`Processando resposta para comando ${command.startsWith}: ${responseText.substring(0, 50)}${responseText.length > 50 ? '...' : ''}`);
      
      // Processa variáveis na resposta
      let processedResponse = await this.variableProcessor.process(responseText, {
        message,
        group,
        command,
        bot  // Incluindo o bot no contexto para processar variáveis de arquivo
      });
      
      // NOVA FUNCIONALIDADE: Verifica se a resposta é um comando embutido
      if (processedResponse && typeof processedResponse === 'object' && processedResponse.type === 'embedded-command') {
        this.logger.info(`Executando comando embutido: ${processedResponse.command}`);
        
        try {
          // Extrai o comando (pode incluir prefixo ou não)
          let cmdText = processedResponse.command;
          let prefix = group.prefix || '!';
          
          // Se o comando já tem um prefixo, usamos ele; senão, usamos o prefixo do grupo
          if (cmdText.startsWith(prefix)) {
            cmdText = cmdText.substring(prefix.length);
          } else if (cmdText.startsWith('!')) {
            // Trata caso especial onde o comando está com prefixo padrão
            cmdText = cmdText.substring(1);
          }
          
          // Divide o comando em nome e argumentos
          const [embeddedCmd, ...embeddedArgs] = cmdText.trim().split(/\s+/);
          
          // Executamos o comando
          await this.processCommand(bot, message, embeddedCmd, embeddedArgs, group);
          
          return; // Não continua o processamento normal
        } catch (embeddedError) {
          this.logger.error(`Erro ao executar comando embutido: ${processedResponse.command}`, embeddedError);
          await bot.sendMessage(
            message.group,
            `Erro ao executar comando embutido: ${processedResponse.command}`,
            { quotedMessageId: command.reply ? message.origin.id._serialized : undefined }
          );
          return;
        }
      }
      
      // Verifica se a resposta é um array de objetos MessageMedia (caso de variável {file-pasta/})
      if (processedResponse && Array.isArray(processedResponse)) {
        this.logger.debug(`Enviando múltiplas respostas de mídia para comando ${command.startsWith} (via variável file para pasta)`);
        
        // Envia cada arquivo de mídia, máximo de 5
        for (const mediaItem of processedResponse) {
          await bot.sendMessage(
            message.group,
            mediaItem.media,
            { 
              caption: mediaItem.caption,
              quotedMessageId: command.reply ? message.origin.id._serialized : undefined 
            }
          );
          
          // Pequena pausa para evitar flood
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return;
      }
      
      // Verifica se a resposta é um objeto MessageMedia (caso de variável {file-...})
      if (processedResponse && typeof processedResponse === 'object' && processedResponse.mimetype) {
        this.logger.debug(`Enviando resposta de mídia para comando ${command.startsWith} (via variável file)`);
        
        await bot.sendMessage(
          message.group,
          processedResponse,
          { quotedMessageId: command.reply ? message.origin.id._serialized : undefined }
        );
        
        return;
      }
      
      // Verifica se é uma resposta de mídia (formato: "{img-filename.png} Legenda")
      const mediaMatch = processedResponse.match(/^\{(audio|voice|image|video|document|sticker)-([^}]+)\}\s*(.*)/);
      
      if (mediaMatch) {
        const [, mediaType, fileName, caption] = mediaMatch;
        
        // Atualiza caminho para procurar no diretório de mídia
        const mediaPath = path.join(__dirname, '..', 'data', 'media', fileName);
        
        this.logger.debug(`Enviando resposta de mídia (${mediaType}): ${mediaPath}`);
        
        try {
          const media = await bot.createMedia(mediaPath);
          await bot.sendMessage(message.group, media, {
            caption: caption || undefined,
            sendMediaAsSticker: mediaType === 'sticker',
            quotedMessageId: command.reply ? message.origin.id._serialized : undefined
          });
          this.logger.debug(`Mídia enviada com sucesso para o comando ${command.startsWith}`);
        } catch (error) {
          this.logger.error(`Erro ao enviar resposta de mídia (${mediaPath}):`, error);
          await bot.sendMessage(message.group, `Erro: Não foi possível enviar o arquivo de mídia ${fileName}`);
        }
      } else {
        // Resposta de texto
        this.logger.debug(`Enviando resposta de texto para o comando ${command.startsWith}`);
        await bot.sendMessage(
          message.group,
          processedResponse,
          { quotedMessageId: command.reply ? message.origin.id._serialized : undefined }
        );
        this.logger.debug(`Resposta de texto enviada com sucesso para o comando ${command.startsWith}`);
      }
    } catch (error) {
      this.logger.error('Erro ao enviar resposta de comando personalizado:', error);
    }
  }
  
  /**
   * Verifica comandos acionados automaticamente (aqueles que não requerem prefixo)
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {string} text - O texto da mensagem
   * @param {Group} group - O objeto do grupo
   */
  async checkAutoTriggeredCommands(bot, message, text, group) {
    try {
      // Pula se não houver comandos personalizados para este grupo
      if (!this.customCommands[group.id]) {
        this.logger.debug(`Sem comandos personalizados para o grupo ${group.id}, pulando verificação de auto-trigger`);
        return;
      }
      
      this.logger.debug(`Verificando comandos auto-acionados para o texto: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      
      // Verifica cada comando personalizado
      for (const command of this.customCommands[group.id]) {
        // Processa apenas comandos com startsWith que não precisam de prefixo
        if (command.startsWith && command.ignorePrefix && text.toLowerCase().includes(command.startsWith.toLowerCase())) {
          this.logger.debug(`Encontrado comando auto-acionado: ${command.startsWith}`);
          // Executa o comando, mas não espera para evitar bloqueio
          this.executeCustomCommand(bot, message, command, [], group).catch(error => {
            this.logger.error(`Erro no comando auto-acionado ${command.startsWith}:`, error);
          });
          break; // Executa apenas o primeiro comando correspondente
        }
      }
      
      this.logger.debug(`Verificação de comando auto-acionado concluída para o grupo ${group.id}`);
    } catch (error) {
      this.logger.error('Erro ao verificar comandos auto-acionados:', error);
    }
  }
  
  /**
   * Recarrega comandos de arquivos e banco de dados
   */
  async reloadCommands() {
    this.logger.info('Recarregando todos os comandos...');
    
    // Limpa cache de comandos
    this.customCommands = {};
    this.database.clearCache('commands');
    
    // Recarrega comandos
    await this.loadAllCommands();
    
    this.logger.info('Todos os comandos recarregados');
  }
}

module.exports = CommandHandler;