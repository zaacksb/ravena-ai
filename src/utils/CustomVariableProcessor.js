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
      
      // Processa variáveis de API (nova função)
      processedText = await this.processAPIRequest(processedText, context);
      
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
    
    // Rastreia quais índices já foram usados para cada variável de array
    const usedIndices = {};
    
    for (const [key, value] of Object.entries(customVars)) {
      // Cria regex para a variável
      const regex = new RegExp(`{${key}}`, 'g');
      
      // Se o valor é um array, seleciona elementos aleatórios para cada ocorrência
      if (Array.isArray(value)) {
        // Conta ocorrências desta variável
        const matches = text.match(regex);
        if (!matches) continue;
        
        // Inicializa índices usados para esta variável
        usedIndices[key] = [];
        
        // Substitui cada ocorrência por um elemento aleatório
        for (let i = 0; i < matches.length; i++) {
          // Obtém índices disponíveis (ainda não usados)
          let availableIndices = Array.from({ length: value.length }, (_, i) => i)
            .filter(idx => !usedIndices[key].includes(idx));
          
          // Se todos os índices já foram usados, reseta se precisarmos de mais
          if (availableIndices.length === 0) {
            usedIndices[key] = [];
            availableIndices = Array.from({ length: value.length }, (_, i) => i);
          }
          
          // Seleciona um índice disponível aleatório
          const randomIndex = Math.floor(Math.random() * availableIndices.length);
          const selectedIndex = availableIndices[randomIndex];
          
          // Marca este índice como usado
          usedIndices[key].push(selectedIndex);
          
          // Substitui a primeira ocorrência da variável pelo valor selecionado
          text = text.replace(regex, value[selectedIndex]);
        }
      } else if (typeof value === 'string') {
        // Para valores de string, substitui normalmente
        text = text.replace(regex, value);
      }
    }
    
    return text;
  }

  /**
   * Processa variáveis de solicitação de API no formato {API#MÉTODO#TIPO_RESPOSTA#URL}
   * @param {string} text - Texto contendo variáveis de API
   * @param {Object} context - Dados de contexto (mensagem, args, etc.)
   * @returns {Promise<string>} - Texto processado
   */
  async processAPIRequest(text, context) {
    try {
      // Expressão regular para encontrar variáveis de solicitação de API
      const apiRegex = /{API#(GET|POST|FORM)#(TEXT|JSON)#([^}]+)}/gs;
      
      // Encontra todas as variáveis de solicitação de API
      const matches = Array.from(text.matchAll(apiRegex));
      if (matches.length === 0) return text;
      
      this.logger.debug(`Encontradas ${matches.length} variáveis de API para processar`);
      
      // Processa cada correspondência
      for (const match of matches) {
        const [fullMatch, method, responseType, urlAndTemplate] = match;
        
        // Divide URL e template (para tipo de resposta JSON)
        let url, template;
        if (responseType === 'JSON') {
          // Encontra a primeira quebra de linha para separar URL do template
          const firstLineBreak = urlAndTemplate.indexOf('\n');
          if (firstLineBreak !== -1) {
            url = urlAndTemplate.substring(0, firstLineBreak).trim();
            template = urlAndTemplate.substring(firstLineBreak + 1).trim();
          } else {
            url = urlAndTemplate.trim();
            template = '';
          }
        } else {
          url = urlAndTemplate.trim();
        }
        
        // Processa argumentos na URL (arg1, arg2, etc.)
        if (context && context.command && Array.isArray(context.command.args)) {
          // Substitui arg1, arg2, etc. pelos argumentos reais
          url = url.replace(/arg(\d+)/g, (match, index) => {
            const argIndex = parseInt(index, 10) - 1;
            return argIndex < context.command.args.length ? encodeURIComponent(context.command.args[argIndex]) : '';
          });
        }
        
        this.logger.debug(`Processando solicitação de API: ${method} ${url}`);
        
        // Faz a solicitação de API real
        let response;
        try {
          if (method === 'GET') {
            response = await axios.get(url);
          } else if (method === 'POST') {
            // Analisa a URL para extrair dados
            const [baseUrl, queryParams] = url.split('?');
            const data = {};
            
            if (queryParams) {
              queryParams.split('&').forEach(param => {
                const [key, value] = param.split('=');
                if (key && value) {
                  data[decodeURIComponent(key)] = decodeURIComponent(value);
                }
              });
            }
            
            response = await axios.post(baseUrl, data);
          } else if (method === 'FORM') {
            // Analisa a URL para extrair dados do formulário
            const [baseUrl, queryParams] = url.split('?');
            const formData = new URLSearchParams();
            
            if (queryParams) {
              queryParams.split('&').forEach(param => {
                const [key, value] = param.split('=');
                if (key && value) {
                  formData.append(decodeURIComponent(key), decodeURIComponent(value));
                }
              });
            }
            
            response = await axios.post(baseUrl, formData, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });
          }
          
          // Processa a resposta com base no tipo de resposta
          let result;
          if (responseType === 'TEXT') {
            // Retorna a resposta de texto bruto
            result = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
          } else if (responseType === 'JSON') {
            // Processa o template JSON
            const jsonData = response.data;
            
            // Substitui [variavel.caminho] no template por valores da resposta JSON
            result = template.replace(/\[([^\]]+)\]/g, (match, path) => {
              // Navega no objeto JSON usando o caminho
              const parts = path.split('.');
              let value = jsonData;
              
              for (const part of parts) {
                if (value === undefined || value === null) {
                  return '[indefinido]';
                }
                value = value[part];
              }
              
              return value !== undefined ? value : '[indefinido]';
            });
          }
          
          // Substitui a variável de API pelo resultado
          text = text.replace(fullMatch, result);
        } catch (apiError) {
          this.logger.error(`Erro ao fazer solicitação de API para ${url}:`, apiError);
          text = text.replace(fullMatch, `Erro na requisição API: ${apiError.message}`);
        }
      }
      
      return text;
    } catch (error) {
      this.logger.error('Erro ao processar solicitações de API:', error);
      return text;
    }
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