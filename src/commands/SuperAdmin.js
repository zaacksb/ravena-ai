const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const ReturnMessage = require('../models/ReturnMessage');

/**
 * Manipula comandos super admin (apenas para admins do sistema)
 */
class SuperAdmin {
  constructor() {
    this.logger = new Logger('superadmin');
    this.database = Database.getInstance();
    this.dataPath = path.join(__dirname, '../../data');
    
    // Lista de superadmins do sistema
    this.superAdmins = process.env.SUPER_ADMINS ? 
      process.env.SUPER_ADMINS.split(',') : 
      [];
    
    this.logger.info(`SuperAdmin inicializado com ${this.superAdmins.length} administradores`);
    
    // Mapeamento de comando para método
    this.commandMap = {
      'joinGrupo': 'joinGroup',
      'addDonateNumero': 'addDonorNumber',
      'addDonateValor': 'updateDonationAmount',
      'mergeDonates': 'mergeDonors',
      'block': 'blockUser',
      'leaveGrupo': 'leaveGroup',
      'foto': 'changeProfilePicture'
    };
  }

  /**
   * Obtém o nome do método para um comando super admin
   * @param {string} command - Nome do comando
   * @returns {string|null} - Nome do método ou null se não encontrado
   */
  getCommandMethod(command) {
    return this.commandMap[command] || null;
  }

  /**
   * Verifica se o usuário é um super admin
   * @param {string} userId - ID do usuário
   * @returns {boolean} - True se o usuário for um super admin
   */
  isSuperAdmin(userId) {
    return this.superAdmins.includes(userId);
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
          await this.database.removePendingInvite(inviteCode);
          
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
      let phoneNumber = args[0].replace(/\D/g, '');
      
      // Se o número não tiver o formato @c.us, adicione
      if (!phoneNumber.includes('@')) {
        phoneNumber = `${phoneNumber}@c.us`;
      }
      
      try {
        // Tenta bloquear o contato
        const contatoBloquear = await bot.client.getContactById(phoneNumber);
        await contatoBloquear.block();
        
        return new ReturnMessage({
          chatId: chatId,
          content: `✅ Contato ${JSON.stringify(contatoBloquear)} bloqueado com sucesso.`
        });
      } catch (blockError) {
        this.logger.error('Erro ao bloquear contato:', blockError, contatoBloquear);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `❌ Erro ao bloquear contato: ${blockError.message}, ${JSON.stringify(contatoBloquear)}`
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
   * Faz o bot sair de um grupo
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
      
      if (args.length === 0) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Por favor, forneça o ID do grupo ou o nome cadastrado. Exemplo: !sa-leaveGrupo 123456789@g.us ou !sa-leaveGrupo nomeGrupo'
        });
      }
      
      const groupIdentifier = args[0];
      let groupId;
      
      // Verifica se o formato é um ID de grupo
      if (groupIdentifier.includes('@g.us')) {
        groupId = groupIdentifier;
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
        // Envia mensagem de despedida para o grupo
        await bot.sendMessage(groupId, '👋 Saindo do grupo por comando administrativo. Até mais!');
        
        // Tenta sair do grupo
        await bot.client.leaveGroup(groupId);
        
        return new ReturnMessage({
          chatId: chatId,
          content: `✅ Bot saiu do grupo ${groupIdentifier} com sucesso.`
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
}

module.exports = SuperAdmin;