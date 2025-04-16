const Logger = require('./utils/Logger');
const LLMService = require('./services/LLMService');

/**
 * Trata menções ao bot em mensagens
 */
class MentionHandler {
  constructor() {
    this.logger = new Logger('mention-handler');
    this.llmService = new LLMService({});
    
    // Emoji de reação padrão para menções
    this.reactions = {
      before: "👀",
      after: "✅",
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
      
      // Verifica se a mensagem contém uma menção ao bot
      const mentionRegex = new RegExp(`@${botNumber}\\b`, 'i');
      if (!mentionRegex.test(text)) {
        return false;
      }

      this.logger.info(`Menção ao bot detectada de ${message.author} em ${message.group || 'chat privado'}`);
      
      // Reage com o emoji "antes"
      try {
        await message.origin.react(this.reactions.before);
      } catch (reactError) {
        this.logger.error('Erro ao aplicar reação "antes":', reactError);
      }
      
      // Remove a menção do prompt
      const prompt = text.replace(mentionRegex, '').trim();
      
      if (!prompt) {
        // Apenas uma menção sem texto, envia uma resposta padrão
        await bot.sendMessage(message.group || message.author, "Olá! Como posso te ajudar?");
        
        // Reage com o emoji "depois"
        try {
          await message.origin.react(this.reactions.after);
        } catch (reactError) {
          this.logger.error('Erro ao aplicar reação "depois":', reactError);
        }
        
        return true;
      }

      this.logger.info(`Processando prompt para LLM: "${prompt}"`);

      // Envia indicador de digitação
      try {
        await bot.client.sendPresenceUpdate('composing', message.group || message.author);
      } catch (error) {
        this.logger.error('Erro ao enviar indicador de digitação:', error);
      }

      // Obtém resposta do LLM com Promise em vez de await para evitar bloqueio
      this.llmService.getCompletion({
        prompt: prompt,
        provider: 'openrouter', // Usa OpenRouter conforme especificado
        temperature: 0.7,
        maxTokens: 500
      }).then(response => {
        if (response) {
          // Registra a resposta
          this.logger.info(`Resposta do LLM recebida: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);
          
          // Envia a resposta
          bot.sendMessage(message.group || message.author, response, {
            quotedMessageId: message.origin.id._serialized
          }).then(() => {
            // Reage com o emoji "depois"
            try {
              message.origin.react(this.reactions.after);
            } catch (reactError) {
              this.logger.error('Erro ao aplicar reação "depois":', reactError);
            }
          }).catch(sendError => {
            this.logger.error('Erro ao enviar resposta do LLM:', sendError);
            // Reage com o emoji "depois" mesmo em erro
            try {
              message.origin.react(this.reactions.error);
            } catch (reactError) {
              this.logger.error('Erro ao aplicar reação "depois":', reactError);
            }
          });
        } else {
          // Registra a resposta vazia
          this.logger.error('Resposta vazia recebida da API LLM');
          bot.sendMessage(message.group || message.author, "Desculpe, não consegui processar sua solicitação no momento.", {
            quotedMessageId: message.origin.id._serialized
          }).then(() => {
            // Reage com o emoji "depois"
            try {
              message.origin.react(this.reactions.after);
            } catch (reactError) {
              this.logger.error('Erro ao aplicar reação "depois":', reactError);
            }
          }).catch(sendError => {
            this.logger.error('Erro ao enviar resposta alternativa:', sendError);
            // Reage com o emoji "depois" mesmo em erro
            try {
              message.origin.react(this.reactions.after);
            } catch (reactError) {
              this.logger.error('Erro ao aplicar reação "depois":', reactError);
            }
          });
        }
      }).catch(error => {
        this.logger.error('Erro ao obter conclusão do LLM para menção:', error);
        // Envia mensagem de erro
        bot.sendMessage(message.group || message.author, "Desculpe, encontrei um erro ao processar sua solicitação.", {
          quotedMessageId: message.origin.id._serialized
        }).then(() => {
          // Reage com o emoji "depois"
          try {
            message.origin.react(this.reactions.after);
          } catch (reactError) {
            this.logger.error('Erro ao aplicar reação "depois":', reactError);
          }
        }).catch(sendError => {
          this.logger.error('Erro ao enviar mensagem de erro:', sendError);
          // Reage com o emoji "depois" mesmo em erro
          try {
            message.origin.react(this.reactions.after);
          } catch (reactError) {
            this.logger.error('Erro ao aplicar reação "depois":', reactError);
          }
        });
      });
      
      return true;
    } catch (error) {
      this.logger.error('Erro ao processar menção:', error);
      return false;
    }
  }
}

module.exports = MentionHandler;