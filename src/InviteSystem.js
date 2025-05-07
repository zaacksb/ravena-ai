const Logger = require('./utils/Logger');
const Database = require('./utils/Database');
const path = require('path');
const fs = require('fs').promises;

/**
 * Gerencia o sistema de convites para o bot
 * 
 * Fluxo de trabalho:
 * 1. Usuário envia um link de convite para o bot em um chat privado
 * 2. Bot pergunta o motivo para adicionar o bot ao grupo
 * 3. Usuário responde com um motivo ou ocorre timeout
 * 4. Bot encaminha os detalhes do convite para um grupo designado para aprovação
 * 5. Admins podem usar um comando para entrar no grupo
 */
class InviteSystem {
  /**
   * Cria uma nova instância do InviteSystem
   * @param {WhatsAppBot} bot - A instância do bot
   */
  constructor(bot) {
    this.bot = bot;
    this.logger = new Logger(`invite-system-${bot.id}`);
    this.database = Database.getInstance();
    this.pendingRequests = new Map(); // Mapa de autor -> { inviteLink, timeout }
  }

  /**
   * Processa uma mensagem privada que pode conter um link de convite
   * @param {Object} message - O objeto da mensagem
   * @returns {Promise<boolean>} - Se a mensagem foi tratada como um convite
   */
  async processMessage(message) {
    try {
      // Processa apenas mensagens privadas
      if (message.group) return false;
      
      const text = message.type === 'text' ? message.content : message.caption;
      if (!text) return false;
      
      // Verifica se a mensagem contém um link de convite do WhatsApp
      const inviteMatch = text.match(/chat.whatsapp.com\/([a-zA-Z0-9]{20,24})/i);
      if (!inviteMatch) return false;
      
      const inviteLink = inviteMatch[0];
      const inviteCode = inviteMatch[1];
      
      this.logger.info(`Recebido convite de grupo de ${message.author}: ${inviteLink}`);
      
      // Verifica se o usuário já tem uma solicitação pendente
      if (this.pendingRequests.has(message.author)) {
        // Limpa o timeout anterior
        clearTimeout(this.pendingRequests.get(message.author).timeout);
        this.pendingRequests.delete(message.author);
      }
      
      // Pergunta o motivo para adicionar o bot
      await this.bot.sendMessage(message.author, 
        "Obrigado pelo convite! Por favor, me diga por que você quer me adicionar a este grupo. " +
        "Vou esperar sua explicação por 5 minutos antes de processar este convite.");
      
      // Define um timeout para tratar o convite mesmo se o usuário não responder
      const timeoutId = setTimeout(() => {
        this.handleInviteRequest(message.author, inviteCode, inviteLink, "Nenhum motivo fornecido");
      }, 5 * 60 * 1000); // 5 minutos
      
      // Armazena a solicitação pendente
      this.pendingRequests.set(message.author, {
        inviteLink,
        inviteCode,
        timeout: timeoutId
      });
      
      return true;
    } catch (error) {
      this.logger.error('Erro ao processar potencial convite:', error);
      return false;
    }
  }

  /**
   * Processa uma mensagem de acompanhamento (motivo do convite)
   * @param {Object} message - O objeto da mensagem
   * @returns {Promise<boolean>} - Se a mensagem foi tratada como um motivo de convite
   */
  async processFollowUpMessage(message) {
    try {
      // Processa apenas mensagens privadas
      if (message.group) return false;
      
      // Verifica se o usuário tem uma solicitação pendente
      if (!this.pendingRequests.has(message.author)) return false;
      
      const text = message.type === 'text' ? message.content : message.caption;
      if (!text) return false;
      
      const { inviteCode, inviteLink, timeout } = this.pendingRequests.get(message.author);
      
      // Limpa o timeout
      clearTimeout(timeout);
      this.pendingRequests.delete(message.author);
      
      // Trata o convite com o motivo fornecido
      await this.handleInviteRequest(message.author, inviteCode, inviteLink, text);
      
      return true;
    } catch (error) {
      this.logger.error('Erro ao processar mensagem de acompanhamento de convite:', error);
      return false;
    }
  }

  /**
   * Trata uma solicitação de convite
   * @param {string} authorId - ID do usuário que enviou o convite
   * @param {string} inviteCode - O código de convite
   * @param {string} inviteLink - O link de convite completo
   * @param {string} reason - Motivo do convite
   */
  async handleInviteRequest(authorId, inviteCode, inviteLink, reason) {
    try {
      this.logger.info(`Processando solicitação de convite de ${authorId} para o código ${inviteCode}`);
      
      // Obtém informações do usuário
      let userName = "Desconhecido";
      try {
        const contact = await this.bot.client.getContactById(authorId);
        userName = contact.pushname || contact.name || "Desconhecido";
      } catch (error) {
        this.logger.error('Erro ao obter contato:', error);
      }
      
      // Salva o convite pendente no banco de dados
      const invite = {
        code: inviteCode,
        link: inviteLink,
        author: {
          id: authorId,
          name: userName
        },
        reason: reason,
        timestamp: Date.now()
      };
      
      // Alteração: usar savePendingJoin em vez de addPendingInvite
      await this.database.savePendingJoin(inviteCode, {
        authorId: authorId, 
        authorName: userName
      });
      
      // Envia notificação para o usuário
      const invitesPosPath = path.join(this.database.databasePath, 'textos', 'invites_pos.txt');
      const posConvite = await fs.readFile(invitesPosPath, 'utf8');

      await this.bot.sendMessage(authorId, "Obrigado! Seu convite foi recebido e será analisado.\n"+posConvite);
      
      // Envia notificações para o grupoInvites se configurado
      if (this.bot.grupoInvites) {
        try {
          const inviteInfo = await this.bot.client.getInviteInfo(inviteCode);
          console.log(inviteInfo);

          // Envia primeira mensagem com informações do usuário e motivo
          const infoMessage = 
            `📩 *Nova Solicitação de Convite de Grupo*\n\n` +
            `🔗 *Link*: chat.whatsapp.com/${inviteCode}\n`+
            `👤 *De:* ${userName} (${authorId})\n\n` +
            `💬 *Motivo:*\n${reason}`;
          
          await this.bot.sendMessage(this.bot.grupoInvites, infoMessage);
          
          // Envia segunda mensagm com comando para aceitar
          const commandMessage =  `!sa-joinGrupo ${inviteCode} ${authorId} ${userName}`;
          
          await this.bot.sendMessage(this.bot.grupoInvites, commandMessage);
        } catch (error) {
          this.logger.error('Erro ao enviar notificação de convite para grupoInvites:', error);
          
          // Tenta notificar o usuário sobre o erro
          try {
            await this.bot.sendMessage(authorId, 
              "Houve um erro ao encaminhar seu convite. Por favor, tente novamente mais tarde ou entre em contato com o administrador do bot.");
          } catch (notifyError) {
            this.logger.error('Erro ao enviar notificação de erro para o usuário:', notifyError);
          }
        }
      } else {
        this.logger.warn('Nenhum grupoInvites configurado, o convite não será encaminhado');
        
        // Notifica o usuário
        await this.bot.sendMessage(authorId, 
          "O bot não está configurado corretamente para lidar com convites no momento. " +
          "Por favor, tente novamente mais tarde ou entre em contato com o administrador do bot.");
      }
    } catch (error) {
      this.logger.error('Erro ao tratar solicitação de convite:', error);
    }
  }
  
  /**
   * Limpa recursos
   */
  destroy() {
    // Limpa todos os timeouts pendentes
    for (const { timeout } of this.pendingRequests.values()) {
      clearTimeout(timeout);
    }
    this.pendingRequests.clear();
  }
}

module.exports = InviteSystem;