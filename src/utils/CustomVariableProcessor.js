const Database = require('./Database');
const Logger = require('./Logger');
const axios = require('axios').default;
const { processFileVariable } = require('../functions/FileManager');

/**
 * Processa variáveis personalizadas em respostas de comandos
 */
class CustomVariableProcessor {
  constructor() {
    this.logger = new Logger('variable-processor');
    this.database = Database.getInstance();
    this.cache = {
      variables: null,
      lastFetch: 0
    };
  }

  /**
   * Processa variáveis em uma string
   * @param {string} text - Texto contendo variáveis
   * @param {Object} context - Dados de contexto (mensagem, grupo, etc.)
   * @returns {Promise<string|Object>} - Texto processado ou objeto MessageMedia para variáveis de arquivo
   */
  async process(text, context) {
    if (!text) return '';
    
    try {
      // Verifica se é uma variável de comando
      const cmdMatch = text.match(/^\{cmd-(.*?)\}$/);
      if (cmdMatch && context && context.message && context.bot) {
        // Este é um comando embutido, retorna objeto especial para ser executado
        const commandText = cmdMatch[1].trim();
        this.logger.debug(`Detectada variável de comando: ${commandText}`);
        
        return {
          type: 'embedded-command',
          command: commandText
        };
      }
      
      // Verifica se é uma variável de arquivo
      const fileMatch = text.match(/^\{file-(.*?)\}$/);
      if (fileMatch && context && context.message) {
        const chatId = context.message.group || context.message.author;
        const bot = context.bot;
        
        if (bot) {
          // Processa variável de arquivo e retorna o MessageMedia
          const media = await processFileVariable(text, bot, chatId);
          if (media) {
            return media;
          }
        }
      }
      
      // Carrega variáveis personalizadas se não estiverem em cache ou o cache estiver obsoleto
      if (!this.cache.variables || Date.now() - this.cache.lastFetch > 300000) { // 5 minutos
        await this.loadCustomVariables();
      }
      
      let processedText = text;
      
      // Processa variáveis de tempo e data
      processedText = this.processSystemVariables(processedText);
      
      // Processa variáveis específicas de contexto
      if (context) {
        processedText = this.processContextVariables(processedText, context);
      }
      
      // Processa variáveis estáticas personalizadas
      if (this.cache.variables) {
        processedText = this.processCustomStaticVariables(processedText);
      }
      
      // Processa variáveis dinâmicas de API
      processedText = await this.processDynamicVariables(processedText);
      
      // Processa variáveis de comando embutido
      processedText = await this.processEmbeddedCommands(processedText, context);
      
      return processedText;
    } catch (error) {
      this.logger.error('Erro ao processar variáveis:', error);
      return text; // Retorna o texto original em caso de erro
    }
  }

  /**
   * Carrega variáveis personalizadas do banco de dados
   */
  async loadCustomVariables() {
    try {
      this.cache.variables = await this.database.getCustomVariables();
      this.cache.lastFetch = Date.now();
    } catch (error) {
      this.logger.error('Erro ao carregar variáveis personalizadas:', error);
    }
  }

  /**
   * Processa variáveis do sistema (data, hora, etc.)
   * @param {string} text - Texto contendo variáveis
   * @returns {string} - Texto processado
   */
  processSystemVariables(text) {
    const now = new Date();
    
    // Substitui {day} pelo nome do dia atual
    const days = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    text = text.replace(/{day}/g, days[now.getDay()]);
    
    // Substitui {date} pela data atual
    const dateStr = now.toLocaleDateString();
    text = text.replace(/{date}/g, dateStr);
    
    // Substitui {time} pela hora atual
    const timeStr = now.toLocaleTimeString();
    text = text.replace(/{time}/g, timeStr);
    
    return text;
  }

  /**
   * Processa variáveis específicas de contexto (mensagem, grupo, etc.)
   * @param {string} text - Texto contendo variáveis
   * @param {Object} context - Dados de contexto
   * @returns {string} - Texto processado
   */
  processContextVariables(text, context) {
    // Substitui {pessoa} pelo nome do remetente
    if (context.message && context.message.author) {
      // Isso precisaria ser implementado para obter o nome real do remetente
      text = text.replace(/{pessoa}/g, 'Usuário');
    }
    
    // Substitui {group} pelo nome do grupo
    if (context.group && context.group.name) {
      text = text.replace(/{group}/g, context.group.name);
    }
    
    // Substitui variáveis de menção
    if (context.command && context.command.mentions && Array.isArray(context.command.mentions)) {
      for (let i = 0; i < context.command.mentions.length; i++) {
        const mention = context.command.mentions[i];
        text = text.replace(new RegExp(`{mention${i+1}}`, 'g'), mention);
      }
    }
    
    return text;
  }

  /**
   * Processa variáveis estáticas personalizadas do banco de dados
   * @param {string} text - Texto contendo variáveis
   * @returns {string} - Texto processado
   */
  processCustomStaticVariables(text) {
    // Nenhuma substituição se nenhuma variável carregada
    if (!this.cache.variables) return text;
    
    // Verifica por variáveis personalizadas
    const customVars = this.cache.variables;
    for (const [key, value] of Object.entries(customVars)) {
      if (typeof value === 'string') {
        // Substitui {varname} pelo seu valor
        text = text.replace(new RegExp(`{${key}}`, 'g'), value);
      }
    }
    
    return text;
  }

  /**
   * Processa variáveis dinâmicas que requerem chamadas de API ou computação
   * @param {string} text - Texto contendo variáveis
   * @returns {Promise<string>} - Texto processado
   */
  async processDynamicVariables(text) {
    try {
      // Variável de clima: {weather:location}
      const weatherMatches = text.match(/{weather:([^}]+)}/g);
      if (weatherMatches) {
        for (const match of weatherMatches) {
          const location = match.substring(9, match.length - 1);
          const weather = await this.getWeather(location);
          text = text.replace(match, weather);
        }
      }
      
      // Espaço reservado para mais variáveis dinâmicas
      
      return text;
    } catch (error) {
      this.logger.error('Erro ao processar variáveis dinâmicas:', error);
      return text;
    }
  }

  /**
   * Processa variáveis de comando embutido
   * @param {string} text - Texto contendo variáveis
   * @param {Object} context - Dados de contexto
   * @returns {Promise<string>} - Texto processado
   */
  async processEmbeddedCommands(text, context) {
    try {
      if (!context || !context.bot) {
        return text;
      }
      
      // Procura por padrões {cmd-!comando arg1 arg2}
      const cmdMatches = text.match(/{cmd-([^}]+)}/g);
      if (!cmdMatches) {
        return text;
      }
      
      // Processa cada ocorrência
      for (const match of cmdMatches) {
        try {
          // Extrai o comando
          const commandText = match.substring(5, match.length - 1).trim();
          
          this.logger.debug(`Processando comando embutido: ${commandText}`);
          
          // Este processamento é apenas para variáveis incluídas em texto,
          // não para variáveis que compõem todo o texto (essas são tratadas separadamente)
          if (!commandText) {
            continue;
          }
          
          // Por simplicidade, só substituímos a variável por uma indicação
          // A execução real será feita no CommandHandler
          text = text.replace(match, `[Comando embutido: ${commandText}]`);
        } catch (cmdError) {
          this.logger.error(`Erro ao processar comando embutido ${match}:`, cmdError);
          text = text.replace(match, '[Erro no comando embutido]');
        }
      }
      
      return text;
    } catch (error) {
      this.logger.error('Erro ao processar variáveis de comando:', error);
      return text;
    }
  }

  /**
   * Obtém informações de clima (implementação de exemplo)
   * @param {string} location - Nome da localização
   * @returns {Promise<string>} - Informações de clima
   */
  async getWeather(location) {
    try {
      // Isso é um placeholder. Em uma implementação real, você chamaria uma API de clima
      return `Clima para ${location}: Ensolarado, 25°C`;
    } catch (error) {
      this.logger.error(`Erro ao obter clima para ${location}:`, error);
      return `Dados de clima não disponíveis para ${location}`;
    }
  }
}

module.exports = CustomVariableProcessor;