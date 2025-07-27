const axios = require('axios');

class EvolutionApiClient {
  /**
   * @param {string} baseUrl - The base URL of the Evolution API (e.g., http://localhost:8080)
   * @param {string} apiKey - The API key for Evolution API
   * @param {string} instanceName - The name of the Evolution API instance
   * @param {object} logger - A logger instance (e.g., from your Logger class)
   */
  constructor(baseUrl, apiKey, instanceName, logger) {
    if (!baseUrl || !apiKey || !instanceName) {
      throw new Error('Evolution API Client: baseUrl, apiKey, and instanceName are required.');
    }
    this.instanceName = instanceName;
    this.logger = logger || console; // Fallback to console.log if no logger is provided
    this.client = axios.create({
      baseURL: baseUrl, // The API reference shows paths like /message/sendText, not /v1/message/sendText
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      }
    });

    this.logger.info(`EvolutionApiClient initialized for instance: ${instanceName}, baseUrl: ${baseUrl}`);
  }

  async get(endpoint, params = {}) {
    const url = `${endpoint}/${this.instanceName}`;
    //this.logger.debug(`Evo API GET: ${url}`, params);
    try {
      const response = await this.client.get(url, { params });
      //this.logger.debug(`Evo API GET Response from ${url}:`, response.status);
      return response.data;
    } catch (error) {
      this.logger.error(`Evo API GET Error from ${url}:`, error.response?.status, error.response?.data || error.message);
      throw error.response?.data || error;
    }
  }

  async post(endpoint, data = {}, params = {}) {
    const url = endpoint.includes('{instanceName}')
        ? endpoint.replace('{instanceName}', this.instanceName) // For endpoints like /instance/webhook/set/{instanceName}
        : `${endpoint}/${this.instanceName}`;
    
    //this.logger.debug(`Evo API POST: ${url}`, data);
    try {
      const response = await this.client.post(url, data, { params });
      //this.logger.debug(`Evo API POST Response from ${url}:`, response.status, response.data?.status || response.data?.key?.id);
      return response.data;
    } catch (error) {
      this.logger.error(`Evo API POST Error from ${url}:`, error.response?.status, error.response?.data || error.message);
      throw error.response?.data || error;
    }
  }

  async delete(endpoint, data = {}, params = {}) {
    const url = endpoint.includes('{instanceName}')
        ? endpoint.replace('{instanceName}', this.instanceName) // For endpoints like /instance/webhook/set/{instanceName}
        : `${endpoint}/${this.instanceName}`;
    
    //this.logger.debug(`Evo API DELETE: ${url}`, data);
    try {
      const response = await this.client.delete(url, { data, params });
      //this.logger.debug(`Evo API DELETE Response from ${url}:`, response.status, response.data?.status || response.data?.key?.id);
      return response.data;
    } catch (error) {
      this.logger.error(`Evo API DELETE Error from ${url}:`, error.response?.status, error.response?.data || error.message);
      throw error.response?.data || error;
    }
  }
}

module.exports = EvolutionApiClient;