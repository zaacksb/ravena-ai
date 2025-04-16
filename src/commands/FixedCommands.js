const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');

/**
 * Gerencia comandos fixos carregados da pasta functions
 */
class FixedCommands {
  constructor() {
    this.logger = new Logger('fixed-commands');
    this.commands = [];
    this.functionsPath = path.join(__dirname, '../functions');
  }

  /**
   * Carrega todos os módulos de comando da pasta functions
   */
  async loadCommands() {
    try {
      // Verifica se o diretório functions existe
      try {
        await fs.access(this.functionsPath);
      } catch (error) {
        this.logger.info('Diretório functions não existe, criando-o');
        await fs.mkdir(this.functionsPath, { recursive: true });
      }

      // Obtém todos os arquivos no diretório functions
      const files = await fs.readdir(this.functionsPath);
      const jsFiles = files.filter(file => file.endsWith('.js'));

      this.logger.info(`Encontrados ${jsFiles.length} arquivos de comando`);

      // Carrega cada módulo de comando
      for (const file of jsFiles) {
        try {
          const commandModule = require(path.join(this.functionsPath, file));
          
          // Verifica se o módulo exporta comandos
          if (commandModule.commands && Array.isArray(commandModule.commands)) {
            // Adiciona configuração de reação padrão se não fornecida
            const processedCommands = commandModule.commands.map(cmd => {
              if (!cmd.reactions) {
                cmd.reactions = {
                  before: "⏳",
                  after: "✅"
                };
              }
              return cmd;
            });
            
            this.commands.push(...processedCommands);
          }
        } catch (error) {
          this.logger.error(`Erro ao carregar módulo de comando ${file}:`, error);
        }
      }

      this.logger.info(`Carregados ${this.commands.length} comandos fixos`);
      
      // Adiciona comandos de placeholder se nenhum for encontrado
      if (this.commands.length === 0) {
        this.addPlaceholderCommands();
      }
    } catch (error) {
      this.logger.error('Erro ao carregar comandos:', error);
    }
  }

  /**
   * Adiciona comandos de placeholder se nenhum comando foi carregado
   */
  addPlaceholderCommands() {
    this.logger.info('Adicionando comandos placeholder');
    
    // Comando ping
    this.commands.push({
      name: 'ping',
      description: 'Verifica se o bot está online',
      reactions: {
        before: "⏳",
        after: "✅"
      },
      method: async (bot, message, args, group) => {
        const chatId = message.group || message.author;
        await bot.sendMessage(chatId, 'Pong! 🏓');
      }
    });
    
    // Comando weather
    this.commands.push({
      name: 'weather',
      description: 'Obtém informações do clima para um local',
      reactions: {
        before: "⏳",
        after: "✅"
      },
      method: async (bot, message, args, group) => {
        const chatId = message.group || message.author;
        
        if (args.length === 0) {
          await bot.sendMessage(chatId, 'Por favor, forneça um local. Exemplo: !weather São Paulo');
          return;
        }
        
        const location = args.join(' ');
        await bot.sendMessage(chatId, `Informações do clima para ${location} ainda não estão disponíveis. Este é um comando placeholder.`);
      }
    });
    
    // Comando help
    this.commands.push({
      name: 'help',
      description: 'Mostra comandos disponíveis',
      reactions: {
        before: "⏳",
        after: "✅"
      },
      method: async (bot, message, args, group) => {
        const chatId = message.group || message.author;
        
        let helpText = '*Comandos Disponíveis:*\n\n';
        
        // Adiciona comandos fixos
        helpText += '*Comandos Fixos:*\n';
        for (const cmd of this.commands) {
          helpText += `- !${cmd.name}: ${cmd.description || 'Sem descrição'}\n`;
        }
        
        // Adiciona informações sobre comandos de gerenciamento
        helpText += '\n*Comandos de Gerenciamento:*\n';
        helpText += '- !g-setName: Mudar nome do grupo\n';
        helpText += '- !g-addCmd: Adicionar um comando personalizado\n';
        helpText += '- !g-delCmd: Deletar um comando personalizado\n';
        helpText += '- !g-manage: Gerenciar um grupo a partir de chat privado\n';
        
        await bot.sendMessage(chatId, helpText);
      }
    });
    
    this.logger.info(`Adicionados ${this.commands.length} comandos placeholder`);
  }

  /**
   * Obtém um comando pelo nome
   * @param {string} name - Nome do comando
   * @returns {Object|null} - Objeto do comando ou null se não encontrado
   */
  getCommand(name) {
    return this.commands.find(cmd => cmd.name === name) || null;
  }

  /**
   * Obtém todos os comandos
   * @returns {Array} - Array de todos os objetos de comando
   */
  getAllCommands() {
    return this.commands;
  }
}

module.exports = FixedCommands;