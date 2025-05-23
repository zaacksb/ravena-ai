const Logger = require('./utils/Logger');
const ReturnMessage = require('./models/ReturnMessage');
const { aiCommand } = require('./functions/AICommands');
/**
 * Trata menções ao bot em mensagens
 */
class MentionHandler {
  constructor() {
    this.logger = new Logger('mention-handler');
    
    // Emoji de reação padrão para menções
    this.reactions = {
      before: "⏳",
      after: "🤖",
      error: "❌" 
    };
  }

  /**
   * Processa uma mensagem que menciona o bot
   * @param {WhatsAppBot} bot - A instância do bot
   * @param {Object} message - A mensagem formatada
   * @param {string} text - O texto da mensagem
   * @returns {Promise<boolean>} - Se a menção foi tratada
   */
  async processMention(bot, message, text) {
    try {
      if (!text) return false;

      // Obtém o número de telefone do bot para verificar menções
      const botNumber = bot.client.info.wid._serialized.split('@')[0];
      //const botNumber = bot.client.info?.wid?._serialized || bot.client.user?.id || '';
      
      // Verifica se a mensagem COMEÇA com uma menção ao bot
      const mentionRegexStart = new RegExp(`^\\s*@${botNumber}\\b`, 'i');
      if (!mentionRegexStart.test(text)) {
        return false;
      }

      this.logger.info(`Menção ao bot detectada no início da mensagem de ${message.author} em ${message.group || 'chat privado'}`);
      
      // Reage com o emoji "antes"
      try {
        await message.origin.react(this.reactions.before);
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "antes":', reactError);
      }
      
      // Remove a menção do prompt
      const prompt = text.replace(mentionRegexStart, '').trim();
      
      if (!prompt) {
        // Apenas uma menção sem texto, envia uma resposta padrão
        const chatId = message.group || message.author;
        const returnMessage = new ReturnMessage({
          chatId: chatId,
          content: "Olá! Como posso te ajudar? Se quiser saber meus comandos, envie !cmd",
          reactions: {
            after: this.reactions.after
          }
        });
        
        await bot.sendReturnMessages(returnMessage);
        return true;
      }

      this.logger.info(`Processando prompt para LLM: "${prompt}"`);

      const msgsLLM = await aiCommand(bot, message, null, null)
      await bot.sendReturnMessages(msgsLLM);
      return true;
    } catch (error) {
      this.logger.error('Erro ao processar menção:', error);
      return false;
    }
  }
}

module.exports = MentionHandler;