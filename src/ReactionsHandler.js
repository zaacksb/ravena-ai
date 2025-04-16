const Logger = require('./utils/Logger');

/**
 * Trata reações a mensagens e executa comandos correspondentes
 */
class ReactionsHandler {
  constructor() {
    this.logger = new Logger('reaction-handler');
    
    // Mapa de emojis de reação para nomes de comandos
    this.reactionCommands = {
      '🖼': 'sticker',     // Comando de sticker
      '✂️': 'stickerbg',   // Sticker com remoção de fundo
      '🪓': 'removebg',    // Remover fundo
      '🤖': 'ai',          // Resposta de IA
      '🤪': 'distort',     // Efeito de distorção
      '📝': 'sketch',      // Efeito de esboço
      '🎭': 'neon',        // Efeito neon
      '🧩': 'pixelate',    // Efeito de pixelização
      '🖌️': 'oil'         // Efeito de pintura a óleo
    };
  }

  /**
   * Processa uma reação a uma mensagem
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} reaction - Os dados da reação
   * @returns {Promise<boolean>} - Se a reação foi tratada
   */
  async processReaction(bot, reaction) {
    try {
      this.logger.info(`Processando reação: ${reaction.emoji} de ${reaction.senderId} na mensagem ${reaction.messageId}`);
      
      // Verifica se este emoji mapeia para um comando
      const commandName = this.reactionCommands[reaction.emoji];
      if (!commandName) {
        this.logger.debug(`Nenhum comando mapeado para o emoji: ${reaction.emoji}`);
        return false;
      }
      
      // Obtém a mensagem que recebeu a reação
      const message = await bot.client.getMessage(reaction.messageId);
      if (!message) {
        this.logger.warn(`Não foi possível encontrar mensagem com ID: ${reaction.messageId}`);
        return false;
      }
      
      // Cria um objeto de mensagem formatado
      const formattedMessage = await bot.formatMessage(message);
      
      // Encontra e executa o comando
      const command = bot.eventHandler.commandHandler.fixedCommands.getCommand(commandName);
      if (command) {
        this.logger.info(`Executando comando ${commandName} via reação ${reaction.emoji}`);
        
        // Extrai argumentos do conteúdo da mensagem, se disponível
        const msgText = formattedMessage.type === 'text' ? formattedMessage.content : formattedMessage.caption;
        const args = msgText ? msgText.trim().split(/\s+/) : [];
        
        // Obtém dados do grupo
        let group = null;
        if (formattedMessage.group) {
          group = await bot.eventHandler.getOrCreateGroup(formattedMessage.group);
        }
        
        // Executa o comando
        await bot.eventHandler.commandHandler.executeFixedCommand(bot, formattedMessage, command, args, group);
        return true;
      } else {
        this.logger.warn(`Comando ${commandName} mapeado do emoji ${reaction.emoji} não encontrado`);
      }
      
      return false;
    } catch (error) {
      this.logger.error('Erro ao processar reação:', error);
      return false;
    }
  }
}

module.exports = ReactionsHandler;