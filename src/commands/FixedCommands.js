const fs = require('fs').promises;
const path = require('path');
const Logger = require('../utils/Logger');
const Command = require('../models/Command');

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

      const modulosComErro = [];
      // Carrega cada módulo de comando
      for (const file of jsFiles) {
        try {
          const commandModule = require(path.join(this.functionsPath, file));
          
          // Verifica se o módulo exporta comandos
          if (commandModule.commands && Array.isArray(commandModule.commands)) {
            // Processa cada comando - verifica se é uma instância Command ou objeto simples
            const processedCommands = commandModule.commands.map(cmd => {
              // Se já for uma instância de Command, use-a diretamente
              if (cmd instanceof Command) {
                return cmd;
              } 
              
              // Se for um objeto simples, crie uma instância de Command
              else {
                // Adiciona configuração de reação padrão se não fornecida
                if (!cmd.reactions) {
                  cmd.reactions = {
                    before: process.env.LOADING_EMOJI ?? "🌀",
                    after: "✅"
                  };
                }
                
                // Cria uma nova instância de Command com os dados do objeto
                return new Command(cmd);
              }
            });
            
            this.commands.push(...processedCommands);
          }
        } catch (error) {
          this.logger.error(`Erro ao carregar módulo de comando ${file}:`, error);
          modulosComErro.push(file);
        }
      }

      this.logger.info(`Carregados ${this.commands.length} comandos fixos`);
      if(modulosComErro.length > 0){
        this.logger.warn(`ATENÇÃO: ${modulosComErro.length} módulos com erro:\n ${modulosComErro.join("\n- ")}`);
      }
      
    } catch (error) {
      this.logger.error('Erro ao carregar comandos:', error);
    }
  }

  /**
   * Obtém um comando pelo nome
   * @param {string} name - Nome do comando
   * @returns {Command|null} - Objeto do comando ou null se não encontrado
   */
  getCommand(name) {
    return this.commands.find(cmd => {
      if (cmd.caseSensitive === false) {
        return cmd.name.toLowerCase() === name.toLowerCase();
      }
      return cmd.name === name;
    }) || null;
  }

  /**
   * Obtém todos os comandos
   * @returns {Array<Command>} - Array de todos os objetos de comando
   */
  getAllCommands() {
    return this.commands;
  }
}

module.exports = FixedCommands;