const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const ReturnMessage = require('../models/ReturnMessage');
const AdminUtils = require('../utils/AdminUtils');

/**
 * Manipula comandos super admin (apenas para admins do sistema)
 */
class SuperAdmin {
  constructor() {
    this.logger = new Logger('superadmin');
    this.adminUtils = AdminUtils.getInstance();
    this.database = Database.getInstance();
    this.dataPath = path.join(__dirname, '../../data');
    
    // Lista de superadmins do sistema
    this.superAdmins = process.env.SUPER_ADMINS ? 
      process.env.SUPER_ADMINS.split(',') : 
      [];
    
    this.logger.info(`SuperAdmin inicializado com ${this.superAdmins.length} administradores`);
    
    // Mapeamento de comando para método
    this.commandMap = {
      'joinGrupo': {'method': 'joinGroup', 'description': 'Entra em um grupo via link de convite'},
      'addDonateNumero': {'method': 'addDonorNumber', 'description': 'Adiciona número de um doador'},
      'addDonateValor': {'method': 'updateDonationAmount', 'description': 'Atualiza valor de doação'},
      'mergeDonates': {'method': 'mergeDonors', 'description': 'Une dois doadores em um'},
      'block': {'method': 'blockUser', 'description': 'Bloqueia um usuário'},
      'unblock': {'method': 'unblockUser', 'description': 'Desbloqueia um usuário'},
      'leaveGrupo': {'method': 'leaveGroup', 'description': 'Sai de um grupo com opção de bloquear membros'},
      'foto': {'method': 'changeProfilePicture', 'description': 'Altera foto de perfil do bot'},
      'simular': {'method': 'simulateStreamEvent', 'description': 'Simula evento de stream'},
      'restart': {'method': 'restartBot', 'description': 'Reinicia o bot'},
      'addpeixe': {'method': 'addFishTypeCommand', 'description': 'Adiciona um tipo de peixe'},
      'removepeixe': {'method': 'removeFishTypeCommand', 'description': 'Remove um tipo de peixe'},
      'getGroupInfo': {'method': 'getGroupInfo', 'description': 'Dump de dados de grupo por nome cadastro'},
      'getMembros': {'method': 'getMembros', 'description': 'Lista todos os membros do grupo separados por admin e membros normais'},
      'blockList': {'method': 'blockList', 'description': 'Bloqueia todos os contatos recebidos separados por vírgula'},
      'blockTudoList': {'method': 'blockTudoList', 'description': 'Sai de todos os grupos em comum com uma lista de pessoas e bloqueia todos os membros'},
      'unblockList': {'method': 'unblockList', 'description': 'Desbloqueia todos os contatos recebidos separados por vírgula'},
      'listaGruposPessoa': {'method': 'listaGruposPessoa', 'description': 'Lista todos os grupos em comum com uma pessoa'},
      'blockTudoPessoa': {'method': 'blockTudoPessoa', 'description': 'Sai de todos os grupos em comum com uma pessoa e bloqueia todos os membros'}
    };
  }

  /**
   * Obtém o nome do método para um comando super admin
   * @param {string} command - Nome do comando
   * @returns {string|null} - Nome do método ou null se não encontrado
   */
  getCommandMethod(command) {
    return this.commandMap[command]?.method || null;
  }

  /**
   * Verifica se um usuário é super admin
   * @param {string} userId - ID do usuário a verificar
   * @returns {boolean} - True se o usuário for super admin
   */
  isSuperAdmin(userId) {
    return this.adminUtils.isSuperAdmin(userId);
  }

  /**
   * Entra em um grupo via link de convite
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem de sucesso ou erro
   */
  async joinGroup(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça um código de convite. Exemplo: !sa-joinGrupo abcd1234'
        });
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
          // Salva os dados do autor que enviou o convite para uso posterior
          if (authorId) {
            await this.database.savePendingJoin(inviteCode, { authorId, authorName });
          }
          
          // Remove dos convites pendentes se existir
          await this.database.removePendingJoin(inviteCode);
          
          return new ReturnMessage({
            chatId: chatId,
            content: `✅ Entrou com sucesso no grupo com código de convite ${inviteCode}`
          });
        } else {
          return new ReturnMessage({
            chatId: chatId,
            content: `❌ Falha ao entrar no grupo com código de convite ${inviteCode}`
          });
        }
      } catch (error) {
        this.logger.error('Erro ao aceitar convite de grupo:', error);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao entrar no grupo: ${error.message}`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando joinGroup:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Adiciona ou atualiza o número de WhatsApp de um doador
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem de sucesso ou erro
   */
  async addDonorNumber(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length < 2) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça um número e nome do doador. Exemplo: !sa-addDonateNumero 5512345678901 João Silva'
        });
      }
      
      // Extrai número e nome
      const numero = args[0].replace(/\D/g, ''); // Remove não-dígitos
      const donorName = args.slice(1).join(' ');
      
      if (!numero || numero.length < 10) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça um número válido com código de país. Exemplo: 5512345678901'
        });
      }
      
      // Atualiza número do doador no banco de dados
      const success = await this.database.updateDonorNumber(donorName, numero);
      
      if (success) {
        return new ReturnMessage({
          chatId: chatId,
          content: `✅ Número ${numero} adicionado com sucesso ao doador ${donorName}`
        });
      } else {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Falha ao atualizar doador. Certifique-se que ${donorName} existe no banco de dados de doações.`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando addDonorNumber:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }
  
  /**
   * Une dois doadores
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async mergeDonors(bot, message, args, group) {
    try {
      const chatId = message.group || message.author;
      
      // Obtém o texto completo do argumento
      const fullText = args.join(' ');
      
      if (!fullText.includes('##')) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, use o formato: !g-mergeDonates PrimeiroDoador##SegundoDoador'
        });
      }
      
      // Divide os nomes
      const [targetName, sourceName] = fullText.split('##').map(name => name.trim());
      
      if (!targetName || !sourceName) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Ambos os nomes de doadores devem ser fornecidos. Formato: !g-mergeDonates PrimeiroDoador##SegundoDoador'
        });
      }
      
      // Une doadores no banco de dados
      const success = await this.database.mergeDonors(targetName, sourceName);
      
      if (success) {
        return new ReturnMessage({
          chatId: chatId,
          content: `Doador ${sourceName} unido com sucesso a ${targetName}`
        });
      } else {
        return new ReturnMessage({
          chatId: chatId,
          content: `Falha ao unir doadores. Certifique-se que tanto ${targetName} quanto ${sourceName} existem no banco de dados de doações.`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando mergeDonors:', error);
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: 'Erro ao processar comando.'
      });
    }
  }

  /**
   * Atualiza valor de doação para um doador
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem de sucesso ou erro
   */
  async updateDonationAmount(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length < 2) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça um valor e nome do doador. Exemplo: !sa-addDonateValor 50.5 João Silva'
        });
      }
      
      // Extrai valor e nome
      const amountStr = args[0].replace(',', '.'); // Trata vírgula como separador decimal
      const amount = parseFloat(amountStr);
      const donorName = args.slice(1).join(' ');
      
      if (isNaN(amount)) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça um valor válido. Exemplo: 50.5'
        });
      }
      
      // Atualiza valor de doação no banco de dados
      const success = await this.database.updateDonationAmount(donorName, amount);
      
      if (success) {
        return new ReturnMessage({
          chatId: chatId,
          content: `✅ ${amount >= 0 ? 'Adicionado' : 'Subtraído'} ${Math.abs(amount).toFixed(2)} com sucesso ao doador ${donorName}`
        });
      } else {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Falha ao atualizar doação. Certifique-se que ${donorName} existe no banco de dados de doações.`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando updateDonationAmount:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  async removeFromSpecialGroups(bot, phoneNumber, specialGroups = []) {
    const results = {
      successes: 0,
      failures: 0,
      details: []
    };
    
    for (const groupId of specialGroups) {
      try {
        const chat = await bot.client.getChatById(groupId);
        
        // Verifica se o contato está no grupo
        const isInGroup = chat.participants.some(p => p.id._serialized === phoneNumber);
        
        if (isInGroup) {
          // Remove a pessoa do grupo
          await chat.removeParticipants([phoneNumber]);
          results.successes++;
          results.details.push({
            groupId,
            groupName: chat.name,
            status: 'success'
          });
        } else {
          results.details.push({
            groupId,
            groupName: chat.name,
            status: 'not_present'
          });
        }
      } catch (error) {
        this.logger.error(`Erro ao remover ${phoneNumber} do grupo especial ${groupId}:`, error);
        results.failures++;
        results.details.push({
          groupId,
          error: error.message,
          status: 'error'
        });
      }
    }
    
    return results;
  }


  /**
   * Bloqueia um usuário
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem de sucesso ou erro
   */
  async blockUser(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça um número de telefone para bloquear. Exemplo: !sa-block +5511999999999'
        });
      }
      
      // Processa o número para formato padrão (apenas dígitos)
      let phoneNumber = args.join(" ").replace(/\D/g, '');
      
      // Se o número não tiver o formato @c.us, adicione
      if (!phoneNumber.includes('@')) {
        phoneNumber = `${phoneNumber}@c.us`;
      }
      
      // Grupos especiais que não devem ser deixados, apenas remover a pessoa
      const specialGroups = [];
      
      // Adicionar grupos especiais se estiverem definidos
      if (bot.grupoInteracao) specialGroups.push(bot.grupoInteracao);
      if (bot.grupoAvisos) specialGroups.push(bot.grupoAvisos);
      
      try {
        // Tenta remover o contato de grupos especiais primeiro
        if (specialGroups.length > 0) {
          const removeResults = await this.removeFromSpecialGroups(bot, phoneNumber, specialGroups);
          this.logger.info(`Resultados da remoção de grupos especiais: ${JSON.stringify(removeResults)}`);
        }
        
        // Tenta bloquear o contato
        const contatoBloquear = await bot.client.getContactById(phoneNumber);
        await contatoBloquear.block();
        
        // Cria a resposta
        let responseMessage = `✅ Contato ${phoneNumber} bloqueado com sucesso.`;
        
        return new ReturnMessage({
          chatId: chatId,
          content: responseMessage
        });
      } catch (blockError) {
        this.logger.error('Erro ao bloquear contato:', blockError);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao bloquear contato: ${blockError.message}`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando blockUser:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Desbloqueia um usuário
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem de sucesso ou erro
   */
  async unblockUser(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça um número de telefone para desbloquear. Exemplo: !sa-unblock +5511999999999'
        });
      }
      
      // Processa o número para formato padrão (apenas dígitos)
      let phoneNumber = args.join(" ").replace(/\D/g, '');
      
      // Se o número não tiver o formato @c.us, adicione
      if (!phoneNumber.includes('@')) {
        phoneNumber = `${phoneNumber}@c.us`;
      }
      
      try {
        // Tenta desbloquear o contato
        const contatoDesbloquear = await bot.client.getContactById(phoneNumber);
        await contatoDesbloquear.unblock();
        
        return new ReturnMessage({
          chatId: chatId,
          content: `✅ Contato ${phoneNumber} desbloqueado com sucesso.`
        });
      } catch (unblockError) {
        this.logger.error('Erro ao desbloquear contato:', unblockError);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao desbloquear contato: ${unblockError.message}`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando unblockUser:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Versão melhorada do comando leaveGroup com lista de bloqueio
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem de sucesso ou erro
   */
  async leaveGroup(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length === 0 && !message.group) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça o ID do grupo ou execute o comando dentro de um grupo. Exemplo: !sa-leaveGrupo 123456789@g.us ou !sa-leaveGrupo nomeGrupo'
        });
      }
      
      const groupIdentifier = args.length > 0 ? args[0] : message.group;
      let groupId;
      
      // Verifica se o formato é um ID de grupo
      if (groupIdentifier.includes('@g.us')) {
        groupId = groupIdentifier;
      } else if (message.group) {
        groupId = message.group;
      } else {
        // Busca o grupo pelo nome
        const groups = await this.database.getGroups();
        const group = groups.find(g => g.name.toLowerCase() === groupIdentifier.toLowerCase());
        
        if (!group) {
          return new ReturnMessage({
            chatId: chatId,
            content: `❌ Grupo '${groupIdentifier}' não encontrado no banco de dados.`
          });
        }
        
        groupId = group.id;
      }
      
      try {
        // Obtém o chat do grupo
        const chat = await bot.client.getChatById(groupId);
        
        if (!chat.isGroup) {
          return new ReturnMessage({
            chatId: chatId,
            content: `O ID fornecido (${groupId}) não corresponde a um grupo.`
          });
        }
        
        // Obtém participantes do grupo
        const participants = chat.participants || [];
        
        // Separa administradores e membros normais
        const admins = [];
        const members = [];
        
        for (const participant of participants) {
          const contactId = participant.id._serialized;
          
          if (participant.isAdmin || participant.isSuperAdmin) {
            admins.push(contactId);
          } else {
            members.push(contactId);
          }
        }
        
        // Constrói os comandos de bloqueio
        const blockAdminsCmd = `!sa-blockList ${admins.join(', ')}`;
        const blockMembersCmd = `!sa-blockList ${members.join(', ')}`;
        
        // Envia mensagem de despedida para o grupo
        //await bot.sendMessage(groupId, '👋 Saindo do grupo por comando administrativo. Até mais!');
        
        // Tenta sair do grupo
        await bot.client.leaveGroup(groupId);
        
        // Prepara mensagem de retorno com comandos de bloqueio
        let responseMessage = `✅ Bot saiu do grupo ${chat.name} (${groupId}) com sucesso.\n\n`;
        responseMessage += `*Para bloquear administradores:*\n\`\`\`${blockAdminsCmd}\`\`\`\n\n`;
        responseMessage += `*Para bloquear demais membros:*\n\`\`\`${blockMembersCmd}\`\`\``;
        
        return new ReturnMessage({
          chatId: chatId,
          content: responseMessage
        });
      } catch (leaveError) {
        this.logger.error('Erro ao sair do grupo:', leaveError);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao sair do grupo: ${leaveError.message}`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando leaveGroup:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Altera a foto de perfil do bot
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem de sucesso ou erro
   */
  async changeProfilePicture(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      // Verifica se a mensagem contém uma imagem
      if (message.type !== 'image') {
        return new ReturnMessage({
          chatId: chatId,
          content: '❌ Este comando deve ser usado como legenda de uma imagem.'
        });
      }
      
      try {
        // Obtém a mídia da mensagem
        const media = message.content;
        
        // Altera a foto de perfil
        await bot.client.setProfilePicture(media);
        
        return new ReturnMessage({
          chatId: chatId,
          content: '✅ Foto de perfil alterada com sucesso!'
        });
      } catch (pictureError) {
        this.logger.error('Erro ao alterar foto de perfil:', pictureError);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao alterar foto de perfil: ${pictureError.message}`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando changeProfilePicture:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }


  /**
   * Simula um evento de stream online/offline
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem de sucesso ou erro
   */
  async simulateStreamEvent(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length < 3) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça a plataforma, o nome do canal e o estado. Exemplo: !sa-simular twitch canal_teste on [vidYoutube]'
        });
      }
      
      // Extrai argumentos
      const platform = args[0].toLowerCase();
      const channelName = args[1].toLowerCase();
      const state = args[2].toLowerCase();
      
      // Verifica se a plataforma é válida
      if (!['twitch', 'kick', 'youtube'].includes(platform)) {
        return new ReturnMessage({
          chatId: chatId,
          content: `Plataforma inválida: ${platform}. Use 'twitch', 'kick' ou 'youtube'.`
        });
      }
      
      // Verifica se o estado é válido
      if (!['on', 'off'].includes(state)) {
        return new ReturnMessage({
          chatId: chatId,
          content: `Estado inválido: ${state}. Use 'on' ou 'off'.`
        });
      }
      
      // Verifica se o StreamMonitor está disponível
      if (!bot.streamMonitor) {
        return new ReturnMessage({
          chatId: chatId,
          content: '❌ StreamMonitor não está inicializado no bot.'
        });
      }
      
      // Preparar dados do evento
      const now = new Date();
      const eventData = {
        platform,
        channelName,
        title: state === 'on' ? `${channelName} fazendo stream simulada em ${platform}` : null,
        game: state === 'on' ? 'Jogo Simulado Fantástico' : null,
        startedAt: now.toISOString(),
        viewerCount: Math.floor(Math.random() * 1000) + 1
      };
      
      // Adicionar dados específicos para cada plataforma
      if (platform === 'twitch') {
        eventData.title = `${channelName} jogando ao vivo em uma simulação épica!`;
        eventData.game = 'Super Simulator 2025';
      } else if (platform === 'kick') {
        eventData.title = `LIVE de ${channelName} na maior simulação de todos os tempos!`;
        eventData.game = 'Kick Streaming Simulator';
      } else if (platform === 'youtube') {
        eventData.title = `Não acredite nos seus olhos! ${channelName} ao vivo agora!`;
        eventData.url = `https://youtube.com/watch?v=simulado${Math.floor(Math.random() * 10000)}`;
        eventData.videoId = args[3] ?? `simulado${Math.floor(Math.random() * 10000)}`;
      }
      
      // Adicionar thumbnail simulada
      const mediaPath = path.join(__dirname, '../../data/simulado-live.jpg');
      try {
        if (platform === 'youtube') {
          eventData.thumbnail = `https://i.ytimg.com/vi/${eventData.videoId}/maxresdefault.jpg`;
        } else {
          const stats = await fs.stat(mediaPath);
          if (stats.isFile()) {
            //eventData.thumbnail = `data:image/jpeg;base64,simulado`;
            eventData.thumbnail = `https://cdn.m7g.twitch.tv/ba46b4e5e395b11efd34/assets/uploads/generic-email-header-1.jpg?w=1200&h=630&fm=jpg&auto=format`;
          }
        }
      } catch (error) {
        this.logger.warn(`Arquivo simulado-live.jpg não encontrado: ${error.message}`);
        eventData.thumbnail = null;
      }
      
      // Emitir evento
      this.logger.info(`Emitindo evento simulado: ${platform}/${channelName} ${state === 'on' ? 'online' : 'offline'}`);
      
      if (state === 'on') {
        bot.streamMonitor.emit('streamOnline', eventData);
      } else {
        bot.streamMonitor.emit('streamOffline', eventData);
      }
      
      return new ReturnMessage({
        chatId: chatId,
        content: `✅ Evento ${state === 'on' ? 'online' : 'offline'} simulado com sucesso para ${platform}/${channelName}\n\n` +
          `Título: ${eventData.title || 'N/A'}\n` +
          `Jogo: ${eventData.game || 'N/A'}\n` +
          `Thumbnail: ${eventData.thumbnail ? '[Configurado]' : '[Não disponível]'}\n\n` +
          `O evento foi despachado para todos os grupos que monitoram este canal.`
      });
    } catch (error) {
      this.logger.error('Erro no comando simulateStreamEvent:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Reinicia um bot específico
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem de sucesso ou erro
   */
  async restartBot(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça o ID do bot a reiniciar. Exemplo: !sa-restart ravena-testes Manutenção programada'
        });
      }
      
      // Obtém ID do bot e motivo
      const targetBotId = args[0];
      const reason = args.length > 1 ? args.slice(1).join(' ') : 'Reinicialização solicitada por admin';
      
      // Obtém instância do bot alvo
      let targetBot = null;
      
      // Verifica se estamos tentando reiniciar o bot atual
      if (targetBotId === bot.id) {
        targetBot = bot;
      } else {
        // Verifica se o bot está na lista de outros bots
        if (bot.otherBots && Array.isArray(bot.otherBots)) {
          targetBot = bot.otherBots.find(b => b.id === targetBotId);
        }
      }
      
      if (!targetBot) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Bot com ID '${targetBotId}' não encontrado. Verifique se o ID está correto.`
        });
      }
      
      // Verifica se o bot tem método de reinicialização
      if (typeof targetBot.restartBot !== 'function') {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ O bot '${targetBotId}' não possui o método de reinicialização.`
        });
      }
      
      // Envia mensagem de resposta antes de reiniciar
      this.logger.info(`Reiniciando bot ${targetBotId} por comando de ${message.authorName}`);
      
      // Iniciar processo de reinicialização em um setTimeout para permitir que a resposta seja enviada primeiro
      setTimeout(async () => {
        try {
          // Tenta reiniciar o bot
          await targetBot.restartBot(reason);
        } catch (restartError) {
          this.logger.error(`Erro ao reiniciar bot ${targetBotId}:`, restartError);
          
          // Tenta enviar mensagem de erro (se possível)
          try {
            await bot.sendMessage(chatId, `❌ Erro ao reiniciar bot ${targetBotId}: ${restartError.message}`);
          } catch (sendError) {
            this.logger.error('Erro ao enviar mensagem de falha de reinicialização:', sendError);
          }
        }
      }, 1000);
      
      return new ReturnMessage({
        chatId: chatId,
        content: `✅ Iniciando reinicialização do bot '${targetBotId}'...\nMotivo: ${reason}\n\nEste processo pode levar alguns segundos. Você receberá notificações sobre o progresso no grupo de avisos.`
      });
    } catch (error) {
      this.logger.error('Erro no comando restartBot:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Adiciona um tipo de peixe à lista de peixes disponíveis
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async addFishTypeCommand(bot, message, args, group) {
    try {
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: message.group || message.author,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      // Obtém ID do chat
      const chatId = message.group || message.author;
      
      // Verifica se há argumentos
      if (args.length === 0) {
        return new ReturnMessage({
          chatId,
          content: '⚠️ Por favor, forneça o nome do peixe a ser adicionado. Exemplo: !sa-addpeixe Tilápia'
        });
      }
      
      // Obtém o nome do peixe
      const fishName = args.join(' ');
      
      // Obtém variáveis personalizadas
      const customVariables = await this.database.getCustomVariables();
      
      // Inicializa peixes se não existir
      if (!customVariables.peixes) {
        customVariables.peixes = [];
      }
      
      // Verifica se o peixe já existe
      if (customVariables.peixes.includes(fishName)) {
        return new ReturnMessage({
          chatId,
          content: `⚠️ O peixe "${fishName}" já está na lista.`
        });
      }
      
      // Adiciona o peixe à lista
      customVariables.peixes.push(fishName);
      
      // Salva as variáveis atualizadas
      await this.database.saveCustomVariables(customVariables);
      
      return new ReturnMessage({
        chatId,
        content: `✅ Peixe "${fishName}" adicionado à lista com sucesso! A lista agora tem ${customVariables.peixes.length} tipos de peixes.`
      });
    } catch (error) {
      this.logger.error('Erro ao adicionar tipo de peixe:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Ocorreu um erro ao adicionar o peixe. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Remove um tipo de peixe da lista
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @param {Object} group - Dados do grupo
   * @returns {Promise<ReturnMessage>} Mensagem de retorno
   */
  async removeFishTypeCommand(bot, message, args, group) {
    try {
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: message.group || message.author,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      // Obtém ID do chat
      const chatId = message.group || message.author;
      
      // Verifica se há argumentos
      if (args.length === 0) {
        return new ReturnMessage({
          chatId,
          content: '⚠️ Por favor, forneça o nome do peixe a ser removido. Exemplo: !sa-removepeixe Tilápia'
        });
      }
      
      // Obtém o nome do peixe
      const fishName = args.join(' ');
      
      // Obtém variáveis personalizadas
      const customVariables = await this.database.getCustomVariables();
      
      // Verifica se há peixes
      if (!customVariables.peixes || customVariables.peixes.length === 0) {
        return new ReturnMessage({
          chatId,
          content: '🎣 Ainda não há tipos de peixes definidos.'
        });
      }
      
      // Verifica se o peixe existe
      const index = customVariables.peixes.findIndex(
        fish => fish.toLowerCase() === fishName.toLowerCase()
      );
      
      if (index === -1) {
        return new ReturnMessage({
          chatId,
          content: `⚠️ O peixe "${fishName}" não está na lista.`
        });
      }
      
      // Remove o peixe da lista
      customVariables.peixes.splice(index, 1);
      
      // Salva as variáveis atualizadas
      await this.database.saveCustomVariables(customVariables);
      
      return new ReturnMessage({
        chatId,
        content: `✅ Peixe "${fishName}" removido da lista com sucesso! A lista agora tem ${customVariables.peixes.length} tipos de peixes.`
      });
    } catch (error) {
      this.logger.error('Erro ao remover tipo de peixe:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Ocorreu um erro ao remover o peixe. Por favor, tente novamente.'
      });
    }
  }

  /**
   * Lista os membros de um grupo separando administradores e membros normais
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem com a lista de membros
   */
  async getMembros(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      // Verifica se é um grupo ou se recebeu o ID do grupo
      let groupId = message.group;
      
      if (!groupId && args.length > 0) {
        groupId = args[0];
        
        // Verifica se o formato é válido para ID de grupo
        if (!groupId.endsWith('@g.us')) {
          groupId = `${groupId}@g.us`;
        }
      }
      
      if (!groupId) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça o ID do grupo ou execute o comando dentro de um grupo.'
        });
      }
      
      try {
        // Obtém o chat do grupo
        const chat = await bot.client.getChatById(groupId);
        
        if (!chat.isGroup) {
          return new ReturnMessage({
            chatId: chatId,
            content: `O ID fornecido (${groupId}) não corresponde a um grupo.`
          });
        }
        
        // Obtém participantes do grupo
        const participants = chat.participants || [];
        
        // Separa administradores e membros normais
        const admins = [];
        const members = [];
        
        for (const participant of participants) {
          const contactId = participant.id._serialized;
          let contactName = 'Desconhecido';
          
          try {
            // Tenta obter dados do contato
            const contact = await bot.client.getContactById(contactId);
            contactName = contact.pushname || contact.name || contactId.replace('@c.us', '');
          } catch (contactError) {
            this.logger.debug(`Não foi possível obter informações do contato ${contactId}:`, contactError);
          }
          
          if (participant.isAdmin || participant.isSuperAdmin) {
            admins.push({ id: contactId, name: contactName });
          } else {
            members.push({ id: contactId, name: contactName });
          }
        }
        
        // Constrói a mensagem de resposta
        let responseMessage = `*Membros do Grupo:* ${chat.name}\n\n`;
        
        responseMessage += `*Administradores (${admins.length}):*\n`;
        for (const admin of admins) {
          responseMessage += `• ${admin.id} - ${admin.name}\n`;
        }
        
        responseMessage += `\n*Membros (${members.length}):*\n`;
        for (const member of members) {
          responseMessage += `• ${member.id} - ${member.name}\n`;
        }
        
        return new ReturnMessage({
          chatId: chatId,
          content: responseMessage
        });
      } catch (error) {
        this.logger.error(`Erro ao obter membros do grupo ${groupId}:`, error);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao obter membros do grupo: ${error.message}`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando getMembros:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Bloqueia uma lista de contatos de uma vez
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem com resultados dos bloqueios
   */
  async blockList(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      // Obtém o texto completo de argumentos e divide por vírgulas
      const contactsText = args.join(' ');
      if (!contactsText.trim()) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça uma lista de contatos separados por vírgula. Exemplo: !sa-blockList 5511999999999@c.us, 5511888888888@c.us'
        });
      }
      
      // Divide a lista de contatos por vírgula
      const contactsList = contactsText.split(',').map(contact => contact.trim());
      
      if (contactsList.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Nenhum contato válido encontrado na lista.'
        });
      }
      
      // Grupos especiais que não devem ser deixados, apenas remover a pessoa
      const specialGroups = [];
      
      // Adicionar grupos especiais se estiverem definidos
      if (bot.grupoInteracao) specialGroups.push(bot.grupoInteracao);
      if (bot.grupoAvisos) specialGroups.push(bot.grupoAvisos);
      
      // Resultados do bloqueio
      const results = [];
      const specialGroupResults = {};
      
      // Processa cada contato
      for (const contactItem of contactsList) {
        // Processa o número para formato padrão
        let phoneNumber = contactItem.replace(/\D/g, '');
        
        // Se o número estiver vazio, pula para o próximo
        if (!phoneNumber) {
          results.push({ id: contactItem, status: 'Erro', message: 'Número inválido' });
          continue;
        }
        
        // Se o número não tiver o formato @c.us, adicione
        if (!contactItem.includes('@')) {
          phoneNumber = `${phoneNumber}@c.us`;
        } else {
          phoneNumber = contactItem;
        }
        
        try {
          // Tenta remover o contato de grupos especiais primeiro
          if (specialGroups.length > 0) {
            const removeResults = await this.removeFromSpecialGroups(bot, phoneNumber, specialGroups);
            specialGroupResults[phoneNumber] = removeResults;
          }
          
          // Tenta bloquear o contato
          const contact = await bot.client.getContactById(phoneNumber);
          await contact.block();
          
          results.push({ id: phoneNumber, status: 'Bloqueado', message: 'Sucesso' });
        } catch (blockError) {
          this.logger.error(`Erro ao bloquear contato ${phoneNumber}:`, blockError);
          
          results.push({ 
            id: phoneNumber, 
            status: 'Erro', 
            message: blockError.message || 'Erro desconhecido'
          });
        }
      }
      
      // Constrói a mensagem de resposta
      let responseMessage = `*Resultados do bloqueio (${results.length} contatos):*\n\n`;
      
      // Conta bloqueados e erros
      const blocked = results.filter(r => r.status === 'Bloqueado').length;
      const errors = results.filter(r => r.status === 'Erro').length;
      
      responseMessage += `✅ *Bloqueados com sucesso:* ${blocked}\n`;
      responseMessage += `❌ *Erros:* ${errors}\n\n`;
      
      // Lista detalhada
      responseMessage += `*Detalhes:*\n`;
      for (const result of results) {
        const statusEmoji = result.status === 'Bloqueado' ? '✅' : '❌';
        responseMessage += `${statusEmoji} ${result.id}: ${result.status}\n`;
        
        // Adiciona informações sobre remoção de grupos especiais se disponível
        if (specialGroupResults[result.id]) {
          const sgr = specialGroupResults[result.id];
          if (sgr.successes > 0) {
            responseMessage += `  └ Removido de ${sgr.successes} grupos especiais\n`;
          }
        }
      }
      
      return new ReturnMessage({
        chatId: chatId,
        content: responseMessage
      });
    } catch (error) {
      this.logger.error('Erro no comando blockList:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  async blockTudoList(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      // Obtém o texto completo de argumentos e divide por vírgulas
      const contactsText = args.join(' ');
      if (!contactsText.trim()) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça uma lista de contatos separados por vírgula. Exemplo: !sa-blockTudoList 5511999999999, 5511888888888'
        });
      }
      
      // Divide a lista de contatos por vírgula
      const contactsList = contactsText.split(',').map(contact => contact.trim());
      
      if (contactsList.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Nenhum contato válido encontrado na lista.'
        });
      }
      
      // Grupos especiais que não devem ser deixados, apenas remover a pessoa
      const specialGroups = [];
      
      // Adicionar grupos especiais se estiverem definidos
      if (bot.grupoInteracao) specialGroups.push(bot.grupoInteracao);
      if (bot.grupoAvisos) specialGroups.push(bot.grupoAvisos);
      
      this.logger.info(`Grupos especiais configurados: ${specialGroups.join(', ')}`);
      
      // Resultados da operação para cada contato
      const contactResults = [];
      
      // Conjunto para armazenar todos os contatos únicos de todos os grupos
      const allContactsSet = new Set();
      
      // Conjunto para armazenar todos os grupos processados
      const processedGroups = new Set();
      
      // Processa cada contato na lista
      for (const contactItem of contactsList) {
        // Processa o número para formato padrão
        let phoneNumber = contactItem.replace(/\D/g, '');
        
        // Se o número estiver vazio, pula para o próximo
        if (!phoneNumber) {
          contactResults.push({ 
            phoneNumber: contactItem, 
            status: 'Erro', 
            message: 'Número inválido',
            groups: [],
            totalGroups: 0
          });
          continue;
        }
        
        // Se o número não tiver o formato @c.us, adicione
        if (!phoneNumber.includes('@')) {
          phoneNumber = `${phoneNumber}@c.us`;
        } else {
          phoneNumber = contactItem;
        }
        
        try {
          // Obtém o contato
          const contact = await bot.client.getContactById(phoneNumber);
          const contactName = contact.pushname || contact.name || phoneNumber;
          
          // Obtém grupos em comum
          const commonGroups = await contact.getCommonGroups();
          
          if (!commonGroups || commonGroups.length === 0) {
            contactResults.push({
              phoneNumber,
              contactName,
              status: 'Sem grupos',
              message: 'Nenhum grupo em comum encontrado',
              groups: [],
              totalGroups: 0
            });
            continue;
          }
          
          // Resultados para este contato
          const results = {
            phoneNumber,
            contactName,
            totalGroups: commonGroups.length,
            leftGroups: 0,
            specialGroups: 0,
            errors: 0,
            status: 'Processado',
            groups: []
          };
          
          // Processa cada grupo
          for (const groupId of commonGroups) {
            try {
              // Se já processamos este grupo, pula
              if (processedGroups.has(groupId)) {
                this.logger.debug(`Grupo ${groupId} já foi processado anteriormente, pulando.`);
                results.groups.push({
                  id: groupId,
                  status: 'Já processado'
                });
                continue;
              }
              
              // Obtém o chat do grupo
              const chat = await bot.client.getChatById(groupId);
              const groupName = chat.name || groupId;
              
              // Verifica se é um grupo especial
              const isSpecialGroup = specialGroups.includes(groupId);
              
              if (isSpecialGroup) {
                this.logger.info(`Grupo especial detectado: ${groupId} (${groupName}). Removendo o contato.`);
                results.specialGroups++;
                
                try {
                  // Verifica se o contato está no grupo
                  const isInGroup = chat.participants.some(p => p.id._serialized === phoneNumber);
                  
                  if (isInGroup) {
                    // Remove apenas a pessoa do grupo
                    await chat.removeParticipants([phoneNumber]);
                    
                    results.groups.push({
                      id: groupId,
                      name: groupName,
                      status: 'Especial',
                      action: 'Removido'
                    });
                  } else {
                    results.groups.push({
                      id: groupId,
                      name: groupName,
                      status: 'Especial',
                      action: 'Não presente'
                    });
                  }
                } catch (removeError) {
                  this.logger.error(`Erro ao remover contato do grupo especial ${groupId}:`, removeError);
                  
                  results.errors++;
                  results.groups.push({
                    id: groupId,
                    name: groupName,
                    status: 'Erro',
                    action: 'Remover',
                    error: removeError.message
                  });
                }
              } else {
                // Para grupos normais, obtém participantes e sai do grupo
                const participants = chat.participants || [];
                
                // Adiciona ID de cada participante ao conjunto global e marca o grupo como processado
                if (!processedGroups.has(groupId)) {
                  participants.forEach(participant => {
                    // Não adicione os contatos da lista sendo processada
                    const participantId = participant.id._serialized;
                    if (!contactsList.includes(participantId) && !contactsList.includes(participantId.replace('@c.us', ''))) {
                      allContactsSet.add(participantId);
                    }
                  });
                  
                  // Marca o grupo como processado
                  processedGroups.add(groupId);
                  
                  // Envia mensagem de despedida (opcional)
                  //await bot.sendMessage(groupId, '👋 Saindo deste grupo por comando administrativo. Até mais!');
                  
                  // Sai do grupo
                  await bot.client.leaveGroup(groupId);
                  
                  results.leftGroups++;
                  results.groups.push({
                    id: groupId,
                    name: groupName,
                    status: 'Sucesso',
                    action: 'Saiu',
                    members: participants.length
                  });
                } else {
                  results.groups.push({
                    id: groupId,
                    name: groupName,
                    status: 'Já processado'
                  });
                }
              }
            } catch (groupError) {
              this.logger.error(`Erro ao processar grupo ${groupId}:`, groupError);
              
              results.errors++;
              results.groups.push({
                id: groupId,
                status: 'Erro',
                error: groupError.message
              });
            }
          }
          
          // Adiciona os resultados deste contato
          contactResults.push(results);
          
          // Tenta bloquear este contato
          try {
            await contact.block();
            this.logger.info(`Contato ${phoneNumber} bloqueado.`);
          } catch (blockError) {
            this.logger.error(`Erro ao bloquear contato ${phoneNumber}:`, blockError);
            results.status = 'Erro ao bloquear';
            results.error = blockError.message;
          }
        } catch (contactError) {
          this.logger.error(`Erro ao processar contato ${phoneNumber}:`, contactError);
          
          contactResults.push({
            phoneNumber,
            status: 'Erro',
            message: contactError.message,
            groups: [],
            totalGroups: 0
          });
        }
      }
      
      // Converte o conjunto para array para facilitar o processamento
      const allContacts = Array.from(allContactsSet);
      
      // Bloqueia todos os contatos coletados dos grupos
      let blockedCount = 0;
      let blockErrors = 0;
      
      for (const contactId of allContacts) {
        try {
          // Verifica se não é o próprio usuário ou um dos contatos da lista
          if (contactId === message.author || contactsList.includes(contactId) || contactsList.includes(contactId.replace('@c.us', ''))) {
            continue;
          }
          
          // Tenta bloquear o contato
          const contactToBlock = await bot.client.getContactById(contactId);
          await contactToBlock.block();
          
          blockedCount++;
        } catch (blockError) {
          this.logger.error(`Erro ao bloquear contato ${contactId}:`, blockError);
          blockErrors++;
        }
      }
      
      // Constrói a mensagem de resposta
      let responseMessage = `*Operação de Bloqueio em Massa Concluída*\n\n`;
      responseMessage += `📊 *Resumo Geral:*\n`;
      responseMessage += `• Contatos processados: ${contactResults.length}\n`;
      responseMessage += `• Grupos únicos processados: ${processedGroups.size}\n`;
      responseMessage += `• Contatos únicos encontrados: ${allContacts.length}\n`;
      responseMessage += `• Contatos bloqueados: ${blockedCount}\n`;
      responseMessage += `• Erros de bloqueio: ${blockErrors}\n\n`;
      
      // Adiciona detalhes para cada contato processado
      responseMessage += `*Detalhes por Contato:*\n`;
      for (const result of contactResults) {
        const statusEmoji = result.status === 'Processado' ? '✅' : 
                             result.status === 'Sem grupos' ? '⚠️' : '❌';
        
        responseMessage += `${statusEmoji} *${result.contactName || result.phoneNumber}*: `;
        
        if (result.status === 'Processado') {
          responseMessage += `${result.totalGroups} grupos (${result.leftGroups} saídos, ${result.specialGroups} especiais)\n`;
        } else {
          responseMessage += `${result.status} - ${result.message || ''}\n`;
        }
      }
      
      // Se a mensagem for muito longa, truncar e adicionar nota
      if (responseMessage.length > 4000) {
        responseMessage = responseMessage.substring(0, 4000);
        responseMessage += '\n... (mensagem truncada devido ao tamanho)';
      }
      
      return new ReturnMessage({
        chatId: chatId,
        content: responseMessage
      });
    } catch (error) {
      this.logger.error('Erro no comando blockTudoList:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Desbloqueia uma lista de contatos de uma vez
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem com resultados dos desbloqueios
   */
  async unblockList(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      // Obtém o texto completo de argumentos e divide por vírgulas
      const contactsText = args.join(' ');
      if (!contactsText.trim()) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça uma lista de contatos separados por vírgula. Exemplo: !sa-unblockList 5511999999999@c.us, 5511888888888@c.us'
        });
      }
      
      // Divide a lista de contatos por vírgula
      const contactsList = contactsText.split(',').map(contact => contact.trim());
      
      if (contactsList.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Nenhum contato válido encontrado na lista.'
        });
      }
      
      // Resultados do desbloqueio
      const results = [];
      
      // Processa cada contato
      for (const contactItem of contactsList) {
        // Processa o número para formato padrão
        let phoneNumber = contactItem.replace(/\D/g, '');
        
        // Se o número estiver vazio, pula para o próximo
        if (!phoneNumber) {
          results.push({ id: contactItem, status: 'Erro', message: 'Número inválido' });
          continue;
        }
        
        // Se o número não tiver o formato @c.us, adicione
        if (!contactItem.includes('@')) {
          phoneNumber = `${phoneNumber}@c.us`;
        } else {
          phoneNumber = contactItem;
        }
        
        try {
          // Tenta desbloquear o contato
          const contact = await bot.client.getContactById(phoneNumber);
          await contact.unblock();
          
          results.push({ id: phoneNumber, status: 'Desbloqueado', message: 'Sucesso' });
        } catch (unblockError) {
          this.logger.error(`Erro ao desbloquear contato ${phoneNumber}:`, unblockError);
          
          results.push({ 
            id: phoneNumber, 
            status: 'Erro', 
            message: unblockError.message || 'Erro desconhecido'
          });
        }
      }
      
      // Constrói a mensagem de resposta
      let responseMessage = `*Resultados do desbloqueio (${results.length} contatos):*\n\n`;
      
      // Conta desbloqueados e erros
      const unblocked = results.filter(r => r.status === 'Desbloqueado').length;
      const errors = results.filter(r => r.status === 'Erro').length;
      
      responseMessage += `✅ *Desbloqueados com sucesso:* ${unblocked}\n`;
      responseMessage += `❌ *Erros:* ${errors}\n\n`;
      
      // Lista detalhada
      responseMessage += `*Detalhes:*\n`;
      for (const result of results) {
        const statusEmoji = result.status === 'Desbloqueado' ? '✅' : '❌';
        responseMessage += `${statusEmoji} ${result.id}: ${result.status}\n`;
      }
      
      return new ReturnMessage({
        chatId: chatId,
        content: responseMessage
      });
    } catch (error) {
      this.logger.error('Erro no comando unblockList:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Lista todos os grupos em comum com um contato
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem com a lista de grupos
   */
  async listaGruposPessoa(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça o número do contato. Exemplo: !sa-listaGruposPessoa 5511999999999'
        });
      }
      
      // Processa o número para formato padrão
      let phoneNumber = args[0].replace(/\D/g, '');
      
      // Se o número não tiver o formato @c.us, adicione
      if (!phoneNumber.includes('@')) {
        phoneNumber = `${phoneNumber}@c.us`;
      }
      
      try {
        // Obtém o contato
        const contact = await bot.client.getContactById(phoneNumber);
        const contactName = contact.pushname || contact.name || phoneNumber;
        
        // Obtém grupos em comum
        const commonGroups = await contact.getCommonGroups();
        
        if (!commonGroups || commonGroups.length === 0) {
          return new ReturnMessage({
            chatId: chatId,
            content: `Nenhum grupo em comum encontrado com ${contactName} (${phoneNumber}).`
          });
        }
        
        // Obtém informações dos grupos do banco de dados
        const groups = await this.database.getGroups();
        
        // Constrói a mensagem de resposta
        let responseMessage = `*Grupos em comum com ${contactName} (${phoneNumber}):*\n\n`;
        
        // Adiciona cada grupo à resposta
        for (const groupId of commonGroups) {
          // Busca informações do banco de dados
          const groupData = groups.find(g => g.id === groupId);
          const groupName = groupData ? groupData.name : 'Nome desconhecido';
          
          // Tenta obter nome do chat
          let chatName = groupName;
          try {
            const chat = await bot.client.getChatById(groupId);
            chatName = chat.name || groupName;
          } catch (error) {
            this.logger.debug(`Erro ao obter informações do chat ${groupId}:`, error);
          }
          
          responseMessage += `• ${groupId} - ${chatName}\n`;
        }
        
        return new ReturnMessage({
          chatId: chatId,
          content: responseMessage
        });
      } catch (error) {
        this.logger.error(`Erro ao listar grupos em comum com ${phoneNumber}:`, error);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao listar grupos em comum: ${error.message}`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando listaGruposPessoa:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }

  /**
   * Sai de todos os grupos em comum com um contato e bloqueia todos os membros
   * Comportamento especial: Não sai dos grupos de interação e avisos, apenas remove a pessoa
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem com o resultado da operação
   */
  async blockTudoPessoa(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça o número do contato. Exemplo: !sa-blockTudoPessoa 5511999999999'
        });
      }
      
      // Grupos especiais que não devem ser deixados, apenas remover a pessoa
      const specialGroups = [];
      
      // Adicionar grupos especiais se estiverem definidos
      if (bot.grupoInteracao) specialGroups.push(bot.grupoInteracao);
      if (bot.grupoAvisos) specialGroups.push(bot.grupoAvisos);
      
      this.logger.info(`Grupos especiais configurados: ${specialGroups.join(', ')}`);
      
      // Processa o número para formato padrão
      let phoneNumber = args[0].replace(/\D/g, '');
      
      // Se o número não tiver o formato @c.us, adicione
      if (!phoneNumber.includes('@')) {
        phoneNumber = `${phoneNumber}@c.us`;
      }
      
      try {
        // Obtém o contato
        const contact = await bot.client.getContactById(phoneNumber);
        const contactName = contact.pushname || contact.name || phoneNumber;
        
        // Obtém grupos em comum
        const commonGroups = await contact.getCommonGroups();
        
        if (!commonGroups || commonGroups.length === 0) {
          return new ReturnMessage({
            chatId: chatId,
            content: `Nenhum grupo em comum encontrado com ${contactName} (${phoneNumber}).`
          });
        }
        
        // Resultados da operação
        const results = {
          totalGroups: commonGroups.length,
          leftGroups: 0,
          specialGroups: 0,
          totalContacts: 0,
          blockedContacts: 0,
          errors: 0,
          groupsInfo: []
        };
        
        // Conjunto para armazenar todos os contatos únicos
        const allContacts = new Set();
        
        // Processa cada grupo
        for (const groupId of commonGroups) {
          try {
            // Obtém o chat do grupo
            const chat = await bot.client.getChatById(groupId);
            const groupName = chat.name || groupId;
            
            // Verifica se é um grupo especial
            const isSpecialGroup = specialGroups.includes(groupId);
            
            if (isSpecialGroup) {
              this.logger.info(`Grupo especial detectado: ${groupId} (${groupName}). Removendo o contato.`);
              results.specialGroups++;
              
              try {
                // Verifica se o contato está no grupo
                const isInGroup = chat.participants.some(p => p.id._serialized === phoneNumber);
                
                if (isInGroup) {
                  // Remove apenas a pessoa do grupo
                  await chat.removeParticipants([phoneNumber]);
                  
                  results.groupsInfo.push({
                    id: groupId,
                    name: groupName,
                    status: 'Especial',
                    action: 'Removido',
                    members: chat.participants.length
                  });
                  
                  //await bot.sendMessage(groupId, `👤 Contato ${contactName} removido do grupo por comando administrativo.`);
                } else {
                  results.groupsInfo.push({
                    id: groupId,
                    name: groupName,
                    status: 'Especial',
                    action: 'Não presente',
                    members: chat.participants.length
                  });
                }
              } catch (removeError) {
                this.logger.error(`Erro ao remover contato do grupo especial ${groupId}:`, removeError);
                
                results.errors++;
                results.groupsInfo.push({
                  id: groupId,
                  name: groupName,
                  status: 'Erro',
                  action: 'Remover',
                  error: removeError.message
                });
              }
            } else {
              // Para grupos normais, obtém participantes e sai do grupo
              const participants = chat.participants || [];
              
              // Adiciona ID de cada participante ao conjunto
              participants.forEach(participant => {
                // Não adicione o próprio contato sendo bloqueado
                if (participant.id._serialized !== phoneNumber) {
                  allContacts.add(participant.id._serialized);
                }
              });
              
              // Envia mensagem de despedida
              //await bot.sendMessage(groupId, '👋 Saindo deste grupo por comando administrativo. Até mais!');
              
              // Sai do grupo
              await bot.client.leaveGroup(groupId);
              
              results.leftGroups++;
              results.groupsInfo.push({
                id: groupId,
                name: groupName,
                status: 'Sucesso',
                action: 'Saiu',
                members: participants.length
              });
            }
          } catch (groupError) {
            this.logger.error(`Erro ao processar grupo ${groupId}:`, groupError);
            
            results.errors++;
            results.groupsInfo.push({
              id: groupId,
              status: 'Erro',
              error: groupError.message
            });
          }
        }
        
        results.totalContacts = allContacts.size;
        
        // Bloqueia todos os contatos coletados dos grupos não-especiais
        for (const contactId of allContacts) {
          try {
            // Verifica se não é o próprio usuário ou o contato alvo
            if (contactId === message.author || contactId === phoneNumber) continue;
            
            // Tenta bloquear o contato
            const contactToBlock = await bot.client.getContactById(contactId);
            await contactToBlock.block();
            
            results.blockedContacts++;
          } catch (blockError) {
            this.logger.error(`Erro ao bloquear contato ${contactId}:`, blockError);
            results.errors++;
          }
        }
        
        // Bloqueia o contato alvo por último
        try {
          await contact.block();
          this.logger.info(`Contato alvo ${phoneNumber} bloqueado.`);
        } catch (blockTargetError) {
          this.logger.error(`Erro ao bloquear contato alvo ${phoneNumber}:`, blockTargetError);
          results.errors++;
        }
        
        // Constrói a mensagem de resposta
        let responseMessage = `*Operação completa para ${contactName} (${phoneNumber}):*\n\n`;
        responseMessage += `📊 *Resumo:*\n`;
        responseMessage += `• Grupos encontrados: ${results.totalGroups}\n`;
        responseMessage += `• Grupos especiais (apenas remoção): ${results.specialGroups}\n`;
        responseMessage += `• Grupos deixados: ${results.leftGroups}\n`;
        responseMessage += `• Contatos únicos: ${results.totalContacts}\n`;
        responseMessage += `• Contatos bloqueados: ${results.blockedContacts}\n`;
        responseMessage += `• Erros: ${results.errors}\n\n`;
        
        responseMessage += `*Detalhes dos grupos:*\n`;
        for (const group of results.groupsInfo) {
          let statusEmoji;
          if (group.status === 'Sucesso') statusEmoji = '✅';
          else if (group.status === 'Especial') statusEmoji = '⭐';
          else statusEmoji = '❌';
          
          // Melhoria na exibição dos detalhes do grupo
          const groupName = group.name || 'Nome desconhecido';
          
          // Verifica se o ID é um objeto e exibe adequadamente
          let groupId;
          if (typeof group.id === 'object') {
            groupId = group.id?._serialized || JSON.stringify(group.id);
          } else {
            groupId = group.id;
          }
          
          responseMessage += `${statusEmoji} ${groupId} - ${groupName} (${group.action || group.status})`;
          
          // Adicionar detalhes do erro se houver
          if (group.error) {
            responseMessage += `: ${group.error}`;
          }
          
          responseMessage += '\n';
        }
        
        return new ReturnMessage({
          chatId: chatId,
          content: responseMessage
        });
      } catch (error) {
        this.logger.error(`Erro ao processar blockTudoPessoa para ${phoneNumber}:`, error);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao processar operação: ${error.message}`
        });
      }
    } catch (error) {
      this.logger.error('Erro no comando blockTudoPessoa:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: '❌ Erro ao processar comando.'
      });
    }
  }


  /**
   * Exibe informações detalhadas de um grupo pelo nome de cadastro
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - Dados da mensagem
   * @param {Array} args - Argumentos do comando
   * @returns {Promise<ReturnMessage>} - Retorna mensagem com as informações do grupo
   */
  async getGroupInfo(bot, message, args) {
    try {
      const chatId = message.group || message.author;
      
      // Verifica se o usuário é um super admin
      if (!this.isSuperAdmin(message.author)) {
        return new ReturnMessage({
          chatId: chatId,
          content: '⛔ Apenas super administradores podem usar este comando.'
        });
      }
      
      if (args.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça o nome de cadastro do grupo. Exemplo: !sa-getGroupInfo nomeGrupo'
        });
      }
      
      // Obtém nome do grupo a partir dos argumentos
      const groupName = args.join(' ').toLowerCase();
      
      // Busca o grupo no banco de dados
      const groups = await this.database.getGroups();
      const group = groups.find(g => g.name.toLowerCase() === groupName);
      
      if (!group) {
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Grupo '${groupName}' não encontrado no banco de dados.`
        });
      }
      
      // Tenta obter informações do chat do grupo
      let chatInfo = null;
      try {
        const chat = await bot.client.getChatById(group.id);
        chatInfo = JSON.stringify(chat, null, 2);
      } catch (chatError) {
        this.logger.error(`Erro ao obter informações do chat ${group.id}:`, chatError);
        chatInfo = `Erro ao obter informações do chat: ${chatError.message}`;
      }
      
      // Formata os dados do grupo para exibição
      const groupData = JSON.stringify(group, null, 2);
      
      // Informações resumidas do grupo
      let responseMessage = `*Informações do Grupo: ${group.name}*\n\n`;
      responseMessage += `*ID:* ${group.id}\n`;
      responseMessage += `*Nome de Cadastro:* ${group.name}\n`;
      responseMessage += `*Prefixo:* ${group.prefix || '!'}\n`;
      responseMessage += `*Pausado:* ${group.paused ? 'Sim' : 'Não'}\n`;
      responseMessage += `*Auto STT:* ${group.autoStt ? 'Ativado' : 'Desativado'}\n`;
      
      // Informações sobre filtros
      if (group.filters) {
        responseMessage += `\n*Filtros:*\n`;
        responseMessage += `- *NSFW:* ${group.filters.nsfw ? 'Ativado' : 'Desativado'}\n`;
        responseMessage += `- *Links:* ${group.filters.links ? 'Ativado' : 'Desativado'}\n`;
        
        if (group.filters.words && group.filters.words.length > 0) {
          responseMessage += `- *Palavras:* ${group.filters.words.join(', ')}\n`;
        }
        
        if (group.filters.people && group.filters.people.length > 0) {
          responseMessage += `- *Pessoas:* ${group.filters.people.length} pessoas filtradas\n`;
        }
      }
      
      // Comandos personalizados
      const commands = await this.database.getCustomCommands(group.id);
      const activeCommands = commands.filter(cmd => cmd.active && !cmd.deleted);
      responseMessage += `\n*Comandos Personalizados:* ${activeCommands.length}\n`;
      
      // Resposta completa com os dados em formato JSON
      responseMessage += `\n*Detalhes completos do grupo serão enviados como mensagens separadas.*`;
      
      // Envia mensagem inicial
      await bot.sendMessage(chatId, responseMessage);
      
      // Envia dados do banco de dados
      await bot.sendMessage(chatId, `*Dados do Banco de Dados (group):*\n\n\`\`\`json\n${groupData}\n\`\`\``);
      
      // Envia informações do chat
      await bot.sendMessage(chatId, `*Dados do Chat API (client.getChatById):*\n\n\`\`\`json\n${chatInfo}\n\`\`\``);
      
      return new ReturnMessage({
        content: 'Informações enviadas com sucesso.',
        chatId: chatId
      });
    } catch (error) {
      this.logger.error('Erro no comando getGroupInfo:', error);
      
      return new ReturnMessage({
        chatId: message.group || message.author,
        content: `❌ Erro ao processar comando: ${error.message}`
      });
    }
  }

}

module.exports = SuperAdmin;