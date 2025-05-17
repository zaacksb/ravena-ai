const path = require('path');
const fs = require('fs/promises');
const Database = require('./utils/Database');
const Logger = require('./utils/Logger');
const FixedCommands = require('./commands/FixedCommands');
const Management = require('./commands/Management');
const SuperAdmin = require('./commands/SuperAdmin');
const CustomVariableProcessor = require('./utils/CustomVariableProcessor');
const ReturnMessage = require('./models/ReturnMessage');
const AdminUtils = require('./utils/AdminUtils');

class CommandHandler {
  constructor() {
    this.logger = new Logger('command-handler');
    this.database = Database.getInstance();
    this.fixedCommands = new FixedCommands();
    this.management = new Management();
    this.superAdmin = new SuperAdmin();
    this.variableProcessor = new CustomVariableProcessor();
    this.adminUtils = AdminUtils.getInstance();
    this.customCommands = {}; // Agrupados por groupId
    this.privateManagement = {}; // Para gerenciar grupos a partir de chats privados

    this.cooldowns = {}; // Armazena cooldowns por grupo e comando
    this.cooldownMessages = {}; // Rastreia quando a última mensagem de cooldown foi enviada
    this.cooldownsLastSaved = Date.now();
    this.loadCooldowns(); // Carrega cooldowns do arquivo ao inicializar
    
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
      this.logger.debug('Comandos fixos:', this.fixedCommands.getAllCommands().map(cmd => cmd.name).join(", "));
      
      // Carrega comandos personalizados para todos os grupos
      const groups = await this.database.getGroups();
      if (groups && Array.isArray(groups)) {
        for (const group of groups) {
          await this.loadCustomCommandsForGroup(group.id);
        }

        //this.logger.debug(`Carregados comandos personalizados para ${groups.length} grupos`);
        
        // Imprime comandos personalizados por grupo
        // for (const groupId in this.customCommands) {
        //   this.logger.debug(`Comandos personalizados para o grupo ${groupId}:`, 
        //     this.customCommands[groupId].map(cmd => cmd.startsWith));
        // }
      }
      
      this.logger.info('Todos os comandos carregados com sucesso');
    } catch (error) {
      this.logger.error('Erro ao carregar comandos:', error.message ?? "xxx");
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
        if(this.customCommands[groupId].length > 0){
          //this.logger.info(`Carregados ${this.customCommands[groupId].length} comandos personalizados para o grupo ${groupId}`);
        }
      } else {
        this.customCommands[groupId] = [];
        //this.logger.debug(`Nenhum comando personalizado encontrado para o grupo ${groupId}`);
      }
    } catch (error) {
      this.logger.error(`Erro ao carregar comandos personalizados para o grupo ${groupId}:`, error.message ?? "xxx");
      this.customCommands[groupId] = [];
    }
  }

  /**
   * Carrega cooldowns do arquivo
   */
  async loadCooldowns() {
    try {
      const cooldownsPath = path.join(__dirname, '../data/cooldowns.json');
      try {
        const data = await fs.readFile(cooldownsPath, 'utf8');
        this.cooldowns = JSON.parse(data);
        this.logger.info(`Cooldowns carregados: ${Object.keys(this.cooldowns).length} grupos`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.error('Erro ao carregar cooldowns:', error.message ?? "xxx");
        } else {
          this.logger.info('Arquivo de cooldowns não encontrado, iniciando com cooldowns vazios');
        }
        this.cooldowns = {};
      }
    } catch (error) {
      this.logger.error('Erro ao inicializar cooldowns:', error.message ?? "xxx");
      this.cooldowns = {};
    }
  }

  /**
   * Salva cooldowns em arquivo
   */
  async saveCooldowns() {
    try {
      const cooldownsPath = path.join(__dirname, '../data/cooldowns.json');
      
      // Cria o diretório data se não existir
      const dataDir = path.join(__dirname, '../data');
      try {
        await fs.access(dataDir);
      } catch (error) {
        await fs.mkdir(dataDir, { recursive: true });
      }
      
      await fs.writeFile(cooldownsPath, JSON.stringify(this.cooldowns, null, 2));
      this.cooldownsLastSaved = Date.now();
      //this.logger.debug('Cooldowns salvos com sucesso');
    } catch (error) {
      this.logger.error('Erro ao salvar cooldowns:', error.message ?? "xxx");
    }
  }

  /**
   * Verifica se um comando está em cooldown
   * @param {Command|string} command - Comando ou nome do comando
   * @param {string} groupId - ID do grupo ou chat
   * @returns {Object} - Informações sobre o cooldown
   */
  checkCooldown(command, groupId, botId) {
    const commandName = typeof command === 'string' ? command : command.name;
    
    const finalId = `${botId}_${groupId}`;

    // Se não existir cooldown para este grupo, cria
    if (!this.cooldowns[finalId]) {
      this.cooldowns[finalId] = {};
    }
    
    // Obtém timestamp do último uso
    const lastUsed = this.cooldowns[finalId][commandName] || 0;
    const now = Date.now();
    
    // Obtém valor de cooldown (em segundos)
    let cooldownValue = 0; // Valor padrão
    
    if (typeof command === 'object') {
      cooldownValue = command.cooldown || cooldownValue;
    }
    
    // Converte para milissegundos
    const cooldownMs = cooldownValue * 1000;
    
    // Verifica se ainda está em cooldown
    if (now - lastUsed < cooldownMs) {
      // Calcula tempo restante
      const timeLeft = Math.ceil((cooldownMs - (now - lastUsed)) / 1000);
      return {
        inCooldown: true,
        timeLeft: timeLeft,
        formattedTime: this.formatCooldownTime(timeLeft)
      };
    }
    
    // Não está em cooldown
    return {
      inCooldown: false,
      timeLeft: 0,
      formattedTime: ''
    };
  }

  /**
   * Formata o tempo de cooldown para exibição
   * @param {number} seconds - Tempo em segundos
   * @returns {string} - Tempo formatado
   */
  formatCooldownTime(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      if (minutes > 0) {
        return `${hours}h ${minutes}m`;
      } else {
        return `${hours}h`;
      }
    }
  }

  /**
   * Atualiza o timestamp de cooldown após uso do comando
   * @param {Command|string} command - Comando ou nome do comando
   * @param {string} groupId - ID do grupo ou chat
   */
  updateCooldown(command, groupId, botId) {
    const commandName = typeof command === 'string' ? command : command.name;
    
    const finalId = `${botId}_${groupId}`;

    // Se não existir cooldown para este grupo, cria
    if (!this.cooldowns[finalId]) {
      this.cooldowns[finalId] = {};
    }
    
    // Atualiza timestamp
    this.cooldowns[finalId][commandName] = Date.now();
    
    // Salva cooldowns a cada minuto
    if (Date.now() - this.cooldownsLastSaved > 60000) {
      this.saveCooldowns().catch(error => {
        this.logger.error('Erro ao salvar cooldowns:', error.message ?? "xxx");
      });
    }
  }

  /**
   * Envia mensagem de cooldown para o usuário
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Mensagem original
   * @param {Command|string} command - Comando ou nome do comando
   * @param {string} groupId - ID do grupo ou chat
   * @param {Object} cooldownInfo - Informações sobre o cooldown
   */
  async handleCooldownMessage(bot, message, command, groupId, cooldownInfo) {
    try {
      // Reage com emoji de relógio
      await message.origin.react("⏰");
      
      // Verifica se já enviamos uma mensagem de cooldown para este comando recentemente
      const cooldownMsgKey = `${groupId}:${command.name || command}`;
      const lastCooldownMsg = this.cooldownMessages[cooldownMsgKey] || 0;
      const now = Date.now();
      
      // Envia mensagem apenas se não enviamos uma recentemente (nos últimos 30 segundos)
      if (now - lastCooldownMsg > 30000) {
        const returnMessage = new ReturnMessage({
          chatId: groupId,
          content: `O comando '${command.name || command}' está em cooldown, aguarde ${cooldownInfo.formattedTime} para usar novamente.`
        });
        
        await bot.sendReturnMessages(returnMessage);
        
        // Atualiza timestamp da última mensagem de cooldown
        this.cooldownMessages[cooldownMsgKey] = now;
      }
    } catch (error) {
      this.logger.error('Erro ao enviar mensagem de cooldown:', error.message ?? "xxx");
    }
  }

  /**
   * Verifica se um comando pode ser executado com base em horário e dias
   * @param {Command|Object} command - Comando a verificar
   * @returns {boolean} - True se pode ser executado, false caso contrário
   */
  checkAllowedTimes(command) {
    // Se não tiver a propriedade allowedTimes, permite sempre
    if (!command.allowedTimes) {
      return true;
    }
    
    const allowedTimes = command.allowedTimes;
    const now = new Date();
    
    // Verifica dias da semana permitidos
    if (allowedTimes.daysOfWeek && Array.isArray(allowedTimes.daysOfWeek) && allowedTimes.daysOfWeek.length > 0) {
      // Mapeia dias da semana para seus equivalentes em português
      const dayMap = {
        'dom': 0, 'seg': 1, 'ter': 2, 'qua': 3, 'qui': 4, 'sex': 5, 'sab': 6,
        'domingo': 0, 'segunda': 1, 'terca': 2, 'quarta': 3, 'quinta': 4, 'sexta': 5, 'sabado': 6
      };
      
      // Obtém o dia atual da semana (0-6, onde 0 é domingo)
      const currentDay = now.getDay();
      
      // Verifica se o dia atual está na lista de dias permitidos
      const isDayAllowed = allowedTimes.daysOfWeek.some(day => {
        const mappedDay = dayMap[day.toLowerCase()];
        return mappedDay === currentDay;
      });
      
      // Se não estiver no dia permitido, retorna falso
      if (!isDayAllowed) {
        return false;
      }
    }
    
    // Verifica horário permitido
    if (allowedTimes.start && allowedTimes.end) {
      const [startHour, startMinute] = allowedTimes.start.split(':').map(Number);
      const [endHour, endMinute] = allowedTimes.end.split(':').map(Number);
      
      // Cria objetos Date para comparação
      const startTime = new Date();
      startTime.setHours(startHour, startMinute, 0, 0);
      
      const endTime = new Date();
      endTime.setHours(endHour, endMinute, 0, 0);
      
      // Se o horário de término for antes do início, significa que atravessa a meia-noite
      if (endTime <= startTime) {
        // Verifica se o horário atual está entre o início e meia-noite OU entre meia-noite e o término
        return now >= startTime || now <= endTime;
      } else {
        // Verifica se o horário atual está entre início e término
        return now >= startTime && now <= endTime;
      }
    }
    
    // Se chegou aqui, é porque passou em todas as verificações ou não tinha restrições
    return true;
  }

  /**
   * Formata os dias e horários permitidos para exibição
   * @param {Command|Object} command - Comando a formatar
   * @returns {string} - Texto formatado
   */
  formatAllowedTimes(command) {
    if (!command.allowedTimes) {
      return "qualquer horário e dia";
    }
    
    const allowedTimes = command.allowedTimes;
    let result = "";
    
    // Formata horários
    if (allowedTimes.start && allowedTimes.end) {
      result += `das ${allowedTimes.start} até ${allowedTimes.end}`;
    }
    
    // Formata dias
    if (allowedTimes.daysOfWeek && Array.isArray(allowedTimes.daysOfWeek) && allowedTimes.daysOfWeek.length > 0) {
      // Mapeia abreviações para nomes completos
      const dayMap = {
        'dom': 'domingos',
        'seg': 'segundas',
        'ter': 'terças',
        'qua': 'quartas',
        'qui': 'quintas',
        'sex': 'sextas',
        'sab': 'sábados'
      };
      
      // Formata lista de dias
      const daysText = allowedTimes.daysOfWeek.map(day => dayMap[day.toLowerCase()] || day).join(', ');
      
      if (result) {
        result += ` nos dias: ${daysText}`;
      } else {
        result += `nos dias: ${daysText}`;
      }
    }
    
    return result || "qualquer horário e dia";
  }


  delayedReaction(msg, emoji, delay){
    setTimeout((m,e) => {
      m.react(e).catch(reactError => {
        this.logger.error('Erro ao aplicar reação "antes":', reactError.message ?? "xxx");;
      });
    }, delay, msg, emoji);
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


      //this.logger.debug(`Processando comando: ${command}, args: ${args.join(', ')}`);
      
      // Verifica se é um comando de super admin (começa com 'sa-')
      if (command.startsWith('sa-')) {
          // Verifica se o usuário é um super admin
          if (this.superAdmin.isSuperAdmin(message.author)) {
              const saCommand = command.substring(3); // Remove o prefixo 'sa-'
              const methodName = this.superAdmin.getCommandMethod(saCommand);
              
              if (methodName && typeof this.superAdmin[methodName] === 'function') {
                  this.logger.debug(`Executando método de super admin: ${methodName}`);
                  const result = await this.superAdmin[methodName](bot, message, args, group);
                  if (result) {
                      await bot.sendReturnMessages(result);
                  }
              } else {
                  const chatId = message.group || message.author;
                  const returnMessage = new ReturnMessage({
                      chatId: chatId,
                      content: `Comando de super admin desconhecido: ${saCommand}`
                  });
                  await bot.sendReturnMessages(returnMessage);
              }
              return;
          } else {
              // Usuário não é super admin
              const chatId = message.group || message.author;
              const returnMessage = new ReturnMessage({
                  chatId: chatId,
                  content: '⛔ Apenas super administradores podem usar estes comandos.'
              });
              await bot.sendReturnMessages(returnMessage);
              return;
          }
      }

    
      // Processa comando normalmente
      this.processCommand(bot, message, command, args, group).catch(error => {
        this.logger.error('Erro em processCommand:', error.message ?? "xxx");
      });
      
      // Nota: Não esperamos processCommand para evitar bloquear a thread de eventos
    } catch (error) {
      this.logger.error('Erro ao manipular comando:', error.message ?? "xxx");
    }
  }

  /**
   * Processa um comando após determinar seu tipo
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {string} command - O nome do comando
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - O objeto do grupo (se em grupo)
   */
  async processCommand(bot, message, command, args, group, skipCustom = false) {
    //this.logger.debug(`Processando comando: ${command}, determinação de tipo`);
    
    // Definir o chatId de resposta - por padrão é o chatId original
    let replyToChat = message.group || message.author;
    let isManagingFromPrivate = false;
    const gidDebug = group?.name ?? 'pv';

    // Verifica se é um comando de gerenciamento
    if (command.startsWith('g-')) {
      this.logger.debug(`[${gidDebug}][${message.author}/${message.authorName}] Comando de gerenciamento: '${command}' '${args.join(" ")}'`);

      // Verifica se é gerenciamento de grupo via PV
      if (!message.group) {
        // Se veio no PV, primeiro vê se não é g-manage
        if (command === 'g-manage') {
          if(args.length > 0){
            // Tem argumento, está tentando definir um grupo no PV
            const groupName = args[0].toLowerCase();
            const groups = await this.database.getGroups();
            const targetGroup = groups.find(g => g.name.toLowerCase() === groupName);
            
            if (targetGroup) {
              const isUserAdminInTarget = await this.adminUtils.isAdmin(message.author, targetGroup, false, bot.client);
              if(isUserAdminInTarget){          
                this.privateManagement[message.author] = targetGroup.id;
                this.logger.info(`Usuário ${message.author} agora está gerenciando o grupo: ${targetGroup.name} (${targetGroup.id})`);
                
                const returnMessage = new ReturnMessage({
                  chatId: message.author,
                  content: `Você agora está gerenciando o grupo: ${targetGroup.name}`,
                  reactions: {
                    after: this.defaultReactions.after
                  }
                });
                await bot.sendReturnMessages(returnMessage);
                
                return;
              } else {
                const returnMessage = new ReturnMessage({
                  chatId: message.author,
                  content: `Você *NÃO É* administrador do grupo '${targetGroup.name}'.`,
                  reactions: {
                    after: "🙅‍♂️"
                  }
                });
                await bot.sendReturnMessages(returnMessage);
              }
            } else {
              this.logger.warn(`Grupo não encontrado: ${groupName}`);
              
              const returnMessage = new ReturnMessage({
                chatId: message.author,
                content: `Grupo não encontrado: ${groupName}`,
                reactions: {
                  after: this.defaultReactions.after
                }
              });
              await bot.sendReturnMessages(returnMessage);
              
              return;
            }
          } else {
            // No PV e sem argumentos = quer voltar ao normal
            this.privateManagement[message.author] = undefined;
            const returnMessage = new ReturnMessage({
              chatId: message.author,
              content: `Você agora não está mais gerenciando o grupo pelo pv.`,
              reactions: {
                after: this.defaultReactions.after
              }
            });
            await bot.sendReturnMessages(returnMessage);
            return;
          }
        } else {
          // Não é g-manage, então verifica se o cara já está gerenciando um pelo PV

          if (this.privateManagement[message.author]) {
            const managedGroupId = this.privateManagement[message.author];
            const managedGroup = await this.database.getGroup(managedGroupId);
            
            if (managedGroup) {
              // Processa como se a mensagem fosse enviada no grupo gerenciado
              this.logger.info(`Processando comando de gerenciamento para o grupo ${managedGroupId} de chat privado por ${message.author}`);
              //return this.processCommand(bot, { ...message, group: managedGroupId }, command, args, managedGroup);
              group = managedGroup;
            } else {
              this.logger.warn(`Falha ao encontrar grupo gerenciado ${managedGroupId} para o usuário ${message.author}`);
            }

            // Se estamos gerenciando um grupo a partir do PV, vamos responder no PV
            replyToChat = message.author;
            isManagingFromPrivate = true;
            
            // Registra que estamos respondendo no PV para um comando de gerenciamento de grupo
            this.logger.info(`Comando ${command} enviado por ${message.author} no PV para gerenciar o grupo ${group.id} - responderemos no PV`);
          }
        }
        // Fim PV
      }

      
      // Verifica se o grupo está pausado e se o comando NÃO é g-pausar
      // No privado não existe !pausar
      if (group && group.paused && command !== 'g-pausar' & !isManagingFromPrivate) {
        this.logger.info(`Ignorando comando de gerenciamento em grupo pausado: ${command}`);
        return;
      }
      
      // Modifica a mensagem para forçar o envio da resposta para o chatId correto
      const originalMessage = { ...message };
      if (isManagingFromPrivate) {
        // Cria um objeto temporário para usar no processamento
        message.managementResponseChatId = replyToChat;
      }
      
      const result = await this.processManagementCommand(bot, message, command, args, group);
      
      // Restaura a mensagem original se necessário
      if (isManagingFromPrivate) {
        message = originalMessage;
      }
      
      return result;
    }
    
    // Verifica se o grupo está pausado (para outros tipos de comandos)
    if (group && group.paused) {
      this.logger.info(`[${gidDebug}][${message.author}/${message.authorName}] Ignorando comando em grupo pausado (${command})`);
      return;
    }

    // Verifica se o bot deve ignorar mensagens no PV
    let ignorePV = bot.ignorePV && bot.notInWhitelist(message.author);

    if(ignorePV && message.group === null){ // Recebeu mensagem no PV
      if(bot.whitelistPV){

      }
    }
    
    // Verifica se é um comando fixo
    const fixedCommand = this.fixedCommands.getCommand(command);
    if (fixedCommand) {
      this.logger.debug(`[${gidDebug}][${message.author}/${message.authorName}] Comando fixo '${command}' '${args.join(" ")}'`);
      await this.executeFixedCommand(bot, message, fixedCommand, args, group);
      return;
    }
    
    // Verifica se é um comando personalizado (apenas para mensagens de grupo)
    if (group && this.customCommands[group.id] && !skipCustom) { // Quando é comando embutid ({cmd-xxx}), não roda personalizados, se não vira um loop
      const customCommand = this.findCustomCommand(command, this.customCommands[group.id]);
      if (customCommand) {
        this.logger.debug(`[${gidDebug}][${message.author}/${message.authorName}] Comando custom (${customCommand.startsWith}) '${command}' '${args.join(" ")}'`);
        await this.executeCustomCommand(bot, message, customCommand, args, group);
        return;
      } else {
        if (group.prefix && group.prefix !== '') {
          message.origin.react("🆖");
        }
      }
    }
    
    // Nenhum comando encontrado
    this.logger.debug(`[${gidDebug}][${message.author}/${message.authorName}] Comando desconhecido: '${command}' '${args.join(" ")}'`);
    
    // Se em um grupo, podemos querer notificar sobre comando desconhecido (opcional)
    if (group && process.env.NOTIFY_UNKNOWN_COMMANDS === 'true') {
      const returnMessage = new ReturnMessage({
        chatId: replyToChat, // Usa o chatId de resposta correto
        content: `Comando desconhecido: ${command}`
      });
      await bot.sendReturnMessages(returnMessage);
    }
  }

  /**
   * Processa um comando de gerenciamento
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {string} command - O nome do comando
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - O objeto do grupo (se em grupo)
   */
  async processManagementCommand(bot, message, command, args, group) {
    try {
      const gidDebug = group?.name ?? 'pv';
     
      // Determina o chatId correto para a resposta
      // Se estamos gerenciando via PV, a resposta deve ir para o PV
      const responseChatId = message.managementResponseChatId || message.group || message.author;
      
      // Reage com o emoji "antes"
      try {
        // Usa emoji de reação padrão
        await message.origin.react(this.defaultReactions.before);
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "antes":', reactError.message ?? "xxx");;
      }
      
      // Comandos de gerenciamento regulares requerem um grupo
      if (!group) {
        this.logger.warn(`Comando de gerenciamento ${command} tentado em chat privado`);
        
        const returnMessage = new ReturnMessage({
          chatId: responseChatId,
          content: 'Comandos de gerenciamento só podem ser usados em grupos. Use !g-manage [nomeDoGrupo] para gerenciar um grupo a partir do chat privado.'
        });
        await bot.sendReturnMessages(returnMessage);
        
        return;
      }

      const chat = await message.origin.getChat();
      const isUserAdmin = await this.adminUtils.isAdmin(message.author, group, chat, bot.client);
      
      if (!isUserAdmin) {
        this.logger.warn(`Usuário ${message.author} tentou usar comando de gerenciamento sem ser admin: ${command}`);
        
        const returnMessage = new ReturnMessage({
          chatId: responseChatId,
          content: '⛔ Apenas administradores podem usar comandos de gerenciamento.',
          reactions: {
            after: this.defaultReactions.error
          }
        });
        await bot.sendReturnMessages(returnMessage);
        
        return;
      }
      
      // Remove o prefixo 'g-'
      const managementCommand = command.substring(2);
      
      // Encontra o método de gerenciamento apropriado
      const methodName = this.management.getCommandMethod(managementCommand);
      if (methodName && typeof this.management[methodName] === 'function') {
        this.logger.debug(`Executando método de gerenciamento: ${methodName}`);
        
        // Importante: Criar uma cópia da mensagem para não afetar a original
        const messageClone = JSON.parse(JSON.stringify(message));
        
        // Força o grupo para o comando
        if (message.managementResponseChatId) {
          messageClone.group = group.id; // Importante: garante que o grupo correto seja usado
        }

        messageClone.origin = message.origin; // Aqui precisa, obrigatoriamente, ser a referência, não cópia
        
        const managementResponse = await this.management[methodName](bot, messageClone, args, group, this.privateManagement);
        
        // Se a resposta for ReturnMessage ou array de ReturnMessage, modifica chatId se necessário
        if (managementResponse) {
          if (Array.isArray(managementResponse)) {
            // Modifica o chatId de todas as mensagens para o chatId correto
            managementResponse.forEach(msg => {
              if (msg instanceof ReturnMessage && msg.chatId === group.id) {
                msg.chatId = responseChatId;
              }
            });
          } else if (managementResponse instanceof ReturnMessage && managementResponse.chatId === group.id) {
            managementResponse.chatId = responseChatId;
          }
        }
        
        await bot.sendReturnMessages(managementResponse);
      } else {
        this.logger.warn(`Comando de gerenciamento desconhecido: ${managementCommand}`);
        
        const returnMessage = new ReturnMessage({
          chatId: responseChatId,
          content: `Comando de gerenciamento desconhecido: ${managementCommand}`,
          reactions: {
            after: this.defaultReactions.after
          }
        });
        await bot.sendReturnMessages(returnMessage);
      }
      
      // Reage com o emoji "depois"
      try {
        await message.origin.react(this.defaultReactions.after);
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "depois":', reactError.message ?? "xxx");;
      }
      
    } catch (error) {
      this.logger.error('Erro ao processar comando de gerenciamento:', error.message ?? "xxx");
      
      const responseChatId = message.managementResponseChatId || message.group || message.author;
      const returnMessage = new ReturnMessage({
        chatId: responseChatId,
        content: 'Erro ao processar comando de gerenciamento',
        reactions: {
          after: this.defaultReactions.after
        }
      });
      await bot.sendReturnMessages(returnMessage);
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
      //this.logger.info(`Executando comando fixo: ${command.name}, args: ${args.join(', ')}`);
      
      // Verifica se o comando requer mensagem citada
      if (command.needsQuotedMsg) {
        const quotedMsg = await message.origin.getQuotedMessage().catch(() => null);
        if (!quotedMsg) {
          this.logger.debug(`Comando ${command.name} requer mensagem citada, mas nenhuma foi fornecida`);
          return; // Ignora o comando silenciosamente
        }
      }

      // Apenas para adminsitradores
      if (command.adminOnly) {  
        const chat = await message.origin.getChat();
        const isUserAdmin = await this.adminUtils.isAdmin(message.author, group, chat, bot.client);
        if (!isUserAdmin) {  
          this.logger.debug(`Comando ${command.name} requer administrador, mas o usuário não é`);
          return;
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

      // Comando exclusivo para alguns grupos, como APIs pagas
      if(command.exclusive){
        if(!command.exclusive.includes(group.name)){
          this.logger.debug(`Comando ${command.name} não está habilitado para este grupo ('${group.name}').`);
          return;
        }
      }

      // Verifica horários permitidos
      if (!this.checkAllowedTimes(command)) {
        this.logger.debug(`Comando ${command.name} não está disponível neste horário/dia`);
        
        // Reage com emoji de relógio
        try {
          await message.origin.react("🕒");
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "indisponível":', reactError.message ?? "xxx");;
        }
        
        const chatId = message.group || message.author;
        const returnMessage = new ReturnMessage({
          chatId: chatId,
          content: `O comando ${command.name} só está disponível ${this.formatAllowedTimes(command)}.`
        });
        
        await bot.sendReturnMessages(returnMessage);
        return;
      }

      // Verifica cooldown
      const groupId = message.group || message.author;
      const cooldownInfo = this.checkCooldown(command, groupId, bot.id);

      if (cooldownInfo.inCooldown) {
        this.logger.debug(`Comando ${command.name} em cooldown por mais ${cooldownInfo.timeLeft}s`);
        await this.handleCooldownMessage(bot, message, command, groupId, cooldownInfo);
        return;
      }
      
      // Reage com emoji "antes" (específico do comando ou padrão)
      if(command.reactions?.before){
        try {
          await message.origin.react(command.reactions?.before);
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "antes":', reactError.message ?? "xxx");;
        }
      }
      
      // Executa método do comando
      if (typeof command.method === 'function') {
        this.updateCooldown(command, groupId, bot.id);
        const result = await command.method(bot, message, args, group);
        
        // Verifica se o resultado é um ReturnMessage ou array de ReturnMessages
        if (result) {
          if (result instanceof ReturnMessage || 
              (Array.isArray(result) && result.length > 0 && result[0] instanceof ReturnMessage)) {
            // Adiciona reação "depois" nas mensagens se não estiver definida
            const afterEmoji = command.reactions?.after || this.defaultReactions.after;
            const errorEmoji = command.reactions?.error || this.defaultReactions.error;
            
            const messages = Array.isArray(result) ? result : [result];
            messages.forEach(msg => {
              if (!msg.reactions) {
                msg.reactions = { after: afterEmoji, error: errorEmoji };
              }
            });
            
            // Envia as ReturnMessages
            await bot.sendReturnMessages(result);
          }
        }
        
        //this.logger.debug(`Comando ${command.name} executado com sucesso, enviando after reaction`);

        // Reage com emoji "depois" (específico do comando ou padrão)
        if(command.reactions?.after){
          this.delayedReaction(message.origin, command.reactions.after, 1000);
        }
      } else {
        this.logger.error(`Método de comando inválido para ${command.name}`);
        
        // Reage com emoji "depois" mesmo para erro
        const afterEmoji = command.reactions?.after || this.defaultReactions.after;
        try {
          await message.origin.react(afterEmoji);
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "depois":', reactError.message ?? "xxx");;
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao executar comando fixo ${command.name}:`, error.message ?? "xxx");
      
      const chatId = message.group || message.author;
      const errorEmoji = command.reactions?.error || this.defaultReactions.error;
      
      const returnMessage = new ReturnMessage({
        chatId: chatId,
        content: `Erro ao executar comando: ${command.name}`,
        reactions: {
          before: errorEmoji
        }
      });
      await bot.sendReturnMessages(returnMessage);
    }
  }

  /**
   * Encontra um comando personalizado pelo nome na lista
   * @param {string} commandName - O nome do comando
   * @param {Array} commands - Lista de comandos personalizados
   * @returns {Object|null} - O objeto de comando personalizado ou null
   */
  findCustomCommand(commandName, commands) {
    // Primeiro, procura uma correspondência exata
    const exactMatch = commands.find(cmd => 
      cmd.startsWith && cmd.startsWith.toLowerCase() === commandName.toLowerCase()
    );
    
    if (exactMatch) {
      this.logger.debug(`Encontrada correspondência exata para comando '${commandName}'`);
      return exactMatch;
    }
    
    // Se não encontrar uma correspondência exata, procura uma correspondência parcial
    const partialMatch = commands.find(cmd => {
      if (cmd.startsWith && commandName.toLowerCase().startsWith(cmd.startsWith.toLowerCase())) {
        return true;
      }
      return false;
    });
    
    //this.logger.debug(`Buscando comando personalizado '${commandName}': ${partialMatch ? 'encontrado' : 'não encontrado'}`);
    return partialMatch || null;
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
      //this.logger.info(`Executando comando personalizado: ${command.startsWith}`);
          
      // Obtém as respostas
      const responses = command.responses || [];
      if (responses.length === 0) {
        this.logger.warn(`Comando ${command.startsWith} não tem respostas`);
        return;
      }

      // Apenas para adminsitradores
      if (command.adminOnly) {  
        const chat = await message.origin.getChat();
        const isUserAdmin = await this.adminUtils.isAdmin(message.author, group, chat, bot.client);
        if (!isUserAdmin) {  
          this.logger.debug(`Comando ${command.name} requer administrador, mas o usuário não é`);

          try {
            await message.origin.react("⛔️");
          } catch (reactError) {
            this.logger.error('Erro ao aplicar reação "indisponível":', reactError.message ?? "xxx");;
          }
          
          const returnMessage = new ReturnMessage({
            chatId: message.group,
            content: `o comando *${command.startsWith}* só pode ser usado por _administradores_.`
          });

          return;
        }  
      }
      
      if (command.allowedTimes && !this.checkAllowedTimes(command)) {
        this.logger.debug(`Comando ${command.startsWith} não está disponível neste horário/dia`);
        
        // Reage com emoji de relógio
        try {
          await message.origin.react("🕒");
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "indisponível":', reactError.message ?? "xxx");;
        }
        
        const returnMessage = new ReturnMessage({
          chatId: message.group,
          content: `o comando *${command.startsWith}* só está disponível ${this.formatAllowedTimes(command)}.`
        });
        
        await bot.sendReturnMessages(returnMessage);
        return;
      }

      // Verifica cooldown
      const cooldownInfo = this.checkCooldown(command.startsWith, message.group, bot.id);

      if (cooldownInfo.inCooldown) {
        this.logger.debug(`Comando ${command.startsWith} em cooldown por mais ${cooldownInfo.timeLeft}s`);
        await this.handleCooldownMessage(bot, message, command.startsWith, message.group, cooldownInfo);
        return;
      }

      // Reage com emoji antes (do comando ou padrão)
      if(command.reactions?.before){
        try {
          await message.origin.react(command.reactions?.before);
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "antes":', reactError.message ?? "xxx");;
        }
      }
      
      // Atualiza estatísticas de uso do comando
      command.count = (command.count || 0) + 1;
      command.lastUsed = Date.now();
      await this.database.updateCustomCommand(group.id, command);
      //this.logger.debug(`Atualizadas estatísticas de uso para o comando *${command.startsWith}*, contagem: ${command.count}`);
      
      // Reage à mensagem se especificado (esta é a reação específica do comando)
      if (command.react) {
        try {
          this.logger.debug(`Reagindo à mensagem com: ${command.react}`);
          await message.origin.react(command.react);
        } catch (error) {
          this.logger.error('Erro ao reagir à mensagem:', error.message ?? "xxx");
        }
      }
      
      this.updateCooldown(command.startsWith, message.group, bot.id);

      // Envia todas as respostas ou seleciona uma aleatória
      if (command.sendAllResponses) {
        this.logger.debug(`Enviando todas as ${responses.length} respostas para o comando *${command.startsWith}*`);
        const returnMessages = [];
        
        for (const response of responses) {
          const processedMessage = await this.processCustomCommandResponse(bot, message, response, command, group);
          if (processedMessage) {
            returnMessages.push(processedMessage);
          }
        }
        
        // Envia todas as mensagens de retorno
        if (returnMessages.length > 0) {
          await bot.sendReturnMessages(returnMessages);
        }
      } else {
        const randomIndex = Math.floor(Math.random() * responses.length);
        this.logger.debug(`Enviando resposta aleatória (${randomIndex + 1}/${responses.length}) para o comando *${command.startsWith}*`);
        
        const returnMessage = await this.processCustomCommandResponse(bot, message, responses[randomIndex], command, group);
        if (returnMessage) {
          await bot.sendReturnMessages(returnMessage);
        }
      }

      
      // Reage com emoji depois (do comando ou padrão)
      const afterEmoji = command.reactions?.after || null;
      try {
        if (afterEmoji && command.react !== false) {
          await message.origin.react(afterEmoji);
        }
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "depois":', reactError.message ?? "xxx");;
      }
      
    } catch (error) {
      this.logger.error(`Erro ao executar comando personalizado ${command.startsWith}:`, error.message ?? "xxx");
      
      const errorEmoji = command.reactions?.error || "❌";
      const returnMessage = new ReturnMessage({
        chatId: message.group,
        content: `Erro ao executar comando personalizado: ${command.startsWith}`,
        reactions: {
          before: command.react !== false ? errorEmoji : null
        }
      });
      await bot.sendReturnMessages(returnMessage);
    }
  }
  
  /**
   * Processa uma resposta para um comando personalizado
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem original
   * @param {string} responseText - O texto da resposta
   * @param {Object} command - O objeto de comando personalizado
   * @param {Group} group - O objeto do grupo
   * @returns {Promise<ReturnMessage|null>} - A mensagem de retorno processada
   */
  async processCustomCommandResponse(bot, message, responseText, command, group) {
    try {
      this.logger.debug(`Processando resposta para comando ${command.startsWith}: ${responseText.substring(0, 50)}${responseText.length > 50 ? '...' : ''}`);
      
      // Processa variáveis na resposta
      let options = {};
      let processedResponse = await this.variableProcessor.process(responseText, {
        message,
        group,
        command,
        options,
        bot  // Incluindo o bot no contexto para processar variáveis de arquivo
      });

      this.logger.debug(`Processada resposta: '${processedResponse}', options ${JSON.stringify(options)}`);
      
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
          await this.processCommand(bot, message, embeddedCmd, embeddedArgs, group, true);
          
          return null; // Não continua o processamento normal
        } catch (embeddedError) {
          this.logger.error(`Erro ao executar comando embutido: ${processedResponse.command}`, embeddedError);
          
          return new ReturnMessage({
            chatId: message.group,
            content: `Erro ao executar comando embutido: ${processedResponse.command}`,
            options: {
              quotedMessageId: command.reply ? message.origin.id._serialized : undefined,
              ...options
            }
          });
        }
      }
      
      // Verifica se a resposta é um array de objetos MessageMedia (caso de variável {file-pasta/})
      if (processedResponse && Array.isArray(processedResponse)) {
        this.logger.debug(`Enviando múltiplas respostas de mídia para comando ${command.startsWith} (via variável file para pasta)`);
        
        // Cria array de ReturnMessages, máximo de 5
        const returnMessages = [];
        for (let i = 0; i < Math.min(processedResponse.length, 5); i++) {
          const mediaItem = processedResponse[i];
          returnMessages.push(new ReturnMessage({
            chatId: message.group,
            content: mediaItem.media,
            options: {
              caption: mediaItem.caption,
              quotedMessageId: command.reply ? message.origin.id._serialized : undefined,
              ...options
            },
            delay: i * 1000 // Adiciona delay de 1 segundo entre mensagens
          }));
        }
        
        return returnMessages;
      }
      
      // Verifica se a resposta é um objeto MessageMedia (caso de variável {file-...})
      if (processedResponse && typeof processedResponse === 'object' && processedResponse.mimetype) {
        this.logger.debug(`Enviando resposta de mídia para comando ${command.startsWith} (via variável file)`);
        
        return new ReturnMessage({
          chatId: message.group,
          content: processedResponse,
          options: {
            quotedMessageId: command.reply ? message.origin.id._serialized : undefined,
            ...options
          }
        });
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
          
          return new ReturnMessage({
            chatId: message.group,
            content: media,
            options: {
              caption: caption || undefined,
              sendMediaAsSticker: mediaType === 'sticker',
              quotedMessageId: command.reply ? message.origin.id._serialized : undefined,
              ...options
            }
          });
        } catch (error) {
          this.logger.error(`Erro ao enviar resposta de mídia (${mediaPath}):`, error.message ?? "xxx");
          
          return new ReturnMessage({
            chatId: message.group,
            content: `Erro: Não foi possível enviar o arquivo de mídia ${fileName}`
          });
        }
      } else {
        // Resposta de texto
        this.logger.debug(`Enviando resposta de texto para o comando *${command.startsWith}*`);
        
        return new ReturnMessage({
          chatId: message.group,
          content: processedResponse,
          options: {
            quotedMessageId: command.reply ? message.origin.id._serialized : undefined,
            ...options
          }
        });
      }
    } catch (error) {
      this.logger.error('Erro ao processar resposta de comando personalizado:', error.message ?? "xxx");
      return null;
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

      // Verifica se o grupo está pausado
      if (group.paused) {
        this.logger.info(`Ignorando comandos auto-acionados em grupo pausado: ${group.id}`);
        return;
      }
      
      //this.logger.debug(`Verificando comandos auto-acionados para o texto: ${text.substring(0, 50)}${text.length > 50 ? '...' : ''}`);
      
      // Verifica se interações automáticas estão habilitadas para este grupo
      if (group.interact && group.interact.enabled) {
        // Verifica o último tempo de interação para cooldown
        const now = Date.now();
        const lastInteraction = group.interact.lastInteraction || 0;
        const cooldown = (group.interact.cooldown || 30) * 60 * 1000; // Converte minutos para milissegundos
        
        if (now - lastInteraction >= cooldown) {
          // Gera número aleatório entre 1 e 10000
          const randomValue = Math.floor(Math.random() * 10000) + 1;
          const interactionChance = group.interact.chance || 100; // Padrão 1% de chance (100/10000)
          
          //this.logger.debug(`Verificação de interação automática: ${randomValue} <= ${interactionChance}`);
          
          if (randomValue <= interactionChance) {
            // Seleciona um comando aleatório que tenha ignorePrefix definido como true
            const autoCommands = this.customCommands[group.id].filter(cmd => 
              cmd.ignorePrefix && cmd.active && !cmd.deleted
            );
            
            if (autoCommands.length > 0) {
              const randomCommand = autoCommands[Math.floor(Math.random() * autoCommands.length)];
              this.logger.info(`Acionando comando automaticamente: ${randomCommand.startsWith}`);
              
              // Atualiza último tempo de interação
              group.interact.lastInteraction = now;
              await this.database.saveGroup(group);
              
              // Executa o comando
              await this.executeCustomCommand(bot, message, randomCommand, [], group);
              return;
            }
          }
        }
      }

      // Verifica cada comando personalizado
      for (const command of this.customCommands[group.id]) {
        // Processa apenas comandos com startsWith que não precisam de prefixo
        if (command.startsWith && command.ignorePrefix && text.toLowerCase().includes(command.startsWith.toLowerCase())) {
          this.logger.debug(`Encontrado comando auto-acionado: ${command.startsWith}`);
          // Executa o comando, mas não espera para evitar bloqueio
          this.executeCustomCommand(bot, message, command, [], group).catch(error => {
            this.logger.error(`Erro no comando auto-acionado ${command.startsWith}:`, error.message ?? "xxx");
          });
          break; // Executa apenas o primeiro comando correspondente
        }
      }
      
      //this.logger.debug(`Verificação de comando auto-acionado concluída para o grupo ${group.id}`);
    } catch (error) {
      this.logger.error('Erro ao verificar comandos auto-acionados:', error.message ?? "xxx");
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