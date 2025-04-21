const Database = require('./Database');
const Logger = require('./Logger');

/**
 * Classe utilitária para verificação de permissões administrativas
 */
class AdminUtils {
  constructor() {
    this.logger = new Logger('admin-utils');
    this.database = Database.getInstance();
    this.superAdmins = process.env.SUPER_ADMINS ? process.env.SUPER_ADMINS.split(',') : [];
  }

  /**
   * Verifica se um usuário é administrador no grupo
   * @param {string} userId - ID do usuário a verificar
   * @param {Object} group - Objeto do grupo do banco de dados
   * @param {Object} chat - Objeto de chat do WhatsApp (opcional)
   * @param {Object} client - Instância do cliente WhatsApp (opcional)
   * @returns {Promise<boolean>} - True se o usuário for admin
   */
  async isAdmin(userId, group, chat = null, client = null) {
    try {
      // 1. Verifica se é um super admin
      if (this.isSuperAdmin(userId)) {
        this.logger.debug(`Usuário ${userId} é super admin`);
        return true;
      }

      // 2. Verifica additionalAdmins no objeto de grupo
      if (group && group.additionalAdmins && Array.isArray(group.additionalAdmins)) {
        if (group.additionalAdmins.includes(userId)) {
          this.logger.debug(`Usuário ${userId} é admin adicional no grupo ${group.id}`);
          return true;
        }
      }

      // 3. Verifica se é admin no WhatsApp
      // 3.1. Se já temos o objeto de chat, usamos ele
      if (chat && chat.isGroup) {
        const participant = chat.participants.find(p => p.id._serialized === userId);
        if (participant && participant.isAdmin) {
          this.logger.debug(`Usuário ${userId} é admin no WhatsApp para o grupo ${group.id}`);
          return true;
        }
      } 
      // 3.2. Se não temos o chat mas temos o cliente, buscamos o chat
      else if (client && group && group.id) {
        try {
          const fetchedChat = await client.getChatById(group.id);
          if (fetchedChat && fetchedChat.isGroup) {
            const participant = fetchedChat.participants.find(p => p.id._serialized === userId);
            if (participant && participant.isAdmin) {
              this.logger.debug(`Usuário ${userId} é admin no WhatsApp para o grupo ${group.id}`);
              return true;
            }
          }
        } catch (chatError) {
          this.logger.error(`Erro ao buscar chat para verificação de admin: ${chatError.message}`);
        }
      }

      // Nenhuma das verificações acima resultou em verdadeiro
      return false;
    } catch (error) {
      this.logger.error(`Erro ao verificar se usuário ${userId} é admin:`, error);
      return false;
    }
  }

  /**
   * Verifica se um usuário é super admin
   * @param {string} userId - ID do usuário a verificar
   * @returns {boolean} - True se o usuário for super admin
   */
  isSuperAdmin(userId) {
    return this.superAdmins.includes(userId);
  }

  /**
   * Verifica se um usuário é dono do grupo
   * @param {string} userId - ID do usuário a verificar 
   * @param {Object} group - Objeto do grupo do banco de dados
   * @returns {boolean} - True se o usuário for dono do grupo
   */
  isGroupOwner(userId, group) {
    if (!group || !group.addedBy) return false;
    return group.addedBy === userId;
  }
}

// Singleton para reutilização
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new AdminUtils();
    }
    return instance;
  }
};