const axios = require('axios');
const Logger = require('../utils/Logger');

/**
 * Serviço para interagir com APIs de LLM
 */
class LLMService {
  /**
   * Cria um novo serviço LLM
   * @param {Object} config - Opções de configuração
   */
  constructor(config = {}) {
    this.logger = new Logger('llm-service');
    this.openRouterKey = config.openRouterKey || process.env.OPENROUTER_API_KEY;
    this.openAIKey = config.openAIKey || process.env.OPENAI_API_KEY;
    this.localEndpoint = config.localEndpoint || process.env.LOCAL_LLM_ENDPOINT || 'http://localhost:1234/v1';
    this.apiTimeout = config.apiTimeout || parseInt(process.env.API_TIMEOUT) || 10000;
    
    this.logger.debug('LLMService inicializado com configuração:', {
      hasOpenRouterKey: !!this.openRouterKey,
      hasOpenAIKey: !!this.openAIKey,
      localEndpoint: this.localEndpoint,
      apiTimeout: this.apiTimeout
    });
  }

  /**
   * Envia uma solicitação de completação para OpenRouter
   * @param {Object} options - Opções de solicitação
   * @param {string} options.prompt - O texto do prompt
   * @param {string} [options.model='google/gemini-2.0-flash-exp:free'] - O modelo a usar
   * @param {number} [options.maxTokens=1000] - Número máximo de tokens a gerar
   * @param {number} [options.temperature=0.7] - Temperatura de amostragem
   * @returns {Promise<Object>} - A resposta da API
   */
  async openRouterCompletion(options) {
    try {
      if (!this.openRouterKey) {
        this.logger.error('Chave da API OpenRouter não configurada');
        throw new Error('Chave da API OpenRouter não configurada');
      }

      this.logger.debug('Enviando solicitação para API OpenRouter:', { 
        model: options.model || 'google/gemini-2.0-flash-exp:free',
        promptLength: options.prompt.length,
        maxTokens: options.maxTokens || 1000
      });

      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: options.model || 'google/gemini-2.0-flash-exp:free',
          messages: [
            { role: 'user', content: options.prompt }
          ],
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${this.openRouterKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || this.apiTimeout
        }
      );

      this.logger.debug('Resposta recebida da API OpenRouter', {
        status: response.status,
        data: response.data,
        contentLength: JSON.stringify(response.data).length
      });

      return response.data;
    } catch (error) {
      this.logger.error('Erro ao chamar API OpenRouter:', error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * Envia uma solicitação de completação para OpenAI (ou LM Studio local)
   * @param {Object} options - Opções de solicitação
   * @param {string} options.prompt - O texto do prompt
   * @param {string} [options.model='gpt-3.5-turbo'] - O modelo a usar
   * @param {number} [options.maxTokens=1000] - Número máximo de tokens a gerar
   * @param {number} [options.temperature=0.7] - Temperatura de amostragem
   * @param {boolean} [options.useLocal=false] - Se deve usar o endpoint LM Studio local
   * @returns {Promise<Object>} - A resposta da API
   */
  async openAICompletion(options) {
    try {
      // Determina endpoint e chave da API com base em local ou remoto
      const endpoint = options.useLocal 
        ? `${this.localEndpoint}/chat/completions` 
        : 'https://api.openai.com/v1/chat/completions';
      
      const apiKey = options.useLocal ? 'lm-studio' : this.openAIKey;
      
      if (!options.useLocal && !this.openAIKey) {
        this.logger.error('Chave da API OpenAI não configurada');
        throw new Error('Chave da API OpenAI não configurada');
      }

      this.logger.debug(`Enviando solicitação para API ${options.useLocal ? 'LM Studio Local' : 'OpenAI'}:`, { 
        endpoint,
        model: options.model || 'gpt-3.5-turbo',
        promptLength: options.prompt.length,
        maxTokens: options.maxTokens || 1000
      });

      const response = await axios.post(
        endpoint,
        {
          model: options.model || 'gpt-3.5-turbo',
          messages: [
            { role: 'user', content: options.prompt }
          ],
          max_tokens: options.maxTokens || 1000,
          temperature: options.temperature || 0.7
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: options.timeout || this.apiTimeout
        }
      );

      this.logger.debug(`Resposta recebida da API ${options.useLocal ? 'LM Studio Local' : 'OpenAI'}`, {
        status: response.status,
        contentLength: JSON.stringify(response.data).length
      });

      return response.data;
    } catch (error) {
      this.logger.error(`Erro ao chamar API ${options.useLocal ? 'LM Studio Local' : 'OpenAI'}:`, error.response ? error.response.data : error.message);
      throw error;
    }
  }

  /**
   * Obtém completação de texto de qualquer LLM configurado
   * @param {Object} options - Opções de solicitação
   * @param {string} options.prompt - O texto do prompt
   * @param {string} [options.provider='openai'] - O provedor a usar ('openai', 'openrouter', ou 'local')
   * @param {string} [options.model] - O modelo a usar (específico do provedor)
   * @param {number} [options.maxTokens=1000] - Número máximo de tokens a gerar
   * @param {number} [options.temperature=0.7] - Temperatura de amostragem
   * @returns {Promise<string>} - O texto gerado
   */
  async getCompletion(options) {
    try {
      this.logger.debug('Obtendo completação com opções:', { 
        provider: options.provider || 'openai',
        promptLength: options.prompt.length,
        temperature: options.temperature || 0.7
      });

      let response;
      
      switch (options.provider || 'openai') {
        case 'openrouter':
          response = await this.openRouterCompletion(options);
          if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
            this.logger.error('Resposta inválida da API OpenRouter:', response);
            return "Não foi possível gerar uma resposta. Por favor, tente novamente mais tarde.";
          }
          return response.choices[0].message.content;
          
        case 'local':
          response = await this.openAICompletion({ ...options, useLocal: true });
          if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
            this.logger.error('Resposta inválida da API Local:', response);
            return "Não foi possível gerar uma resposta. Por favor, tente novamente mais tarde.";
          }
          return response.choices[0].message.content;
          
        case 'openai':
        default:
          response = await this.openAICompletion(options);
          if (!response || !response.choices || !response.choices[0] || !response.choices[0].message) {
            this.logger.error('Resposta inválida da API OpenAI:', response);
            return "Não foi possível gerar uma resposta. Por favor, tente novamente mais tarde.";
          }
          return response.choices[0].message.content;
      }
    } catch (error) {
      this.logger.error('Erro ao obter completação:', error);
      return "Ocorreu um erro ao gerar uma resposta. Por favor, tente novamente mais tarde.";
    }
  }
}

module.exports = LLMService;