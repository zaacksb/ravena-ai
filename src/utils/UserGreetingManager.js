const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');

class UserGreetingManager {
  constructor() {
    this.logger = new Logger('user-greeting');
    this.database = Database.getInstance();
    this.greetedUsers = {};
    this.greetedUsersPath = path.join(this.database.databasePath, 'greeted-ids.json');
    this.greetingTextPath = path.join(this.database.databasePath, 'textos', 'bot-greeting.txt');
    
    // Carrega os usuários já saudados na inicialização
    this.loadGreetedUsers();
  }
  
  /**
   * Carrega a lista de usuários já saudados do arquivo
   */
  async loadGreetedUsers() {
    try {
      try {
        const data = await fs.readFile(this.greetedUsersPath, 'utf8');
        this.greetedUsers = JSON.parse(data);
        this.logger.info(`Carregados ${Object.keys(this.greetedUsers).length} usuários já saudados`);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          this.logger.error('Erro ao carregar usuários saudados:', error);
        } else {
          this.logger.info('Arquivo de usuários saudados não encontrado, iniciando com lista vazia');
        }
        this.greetedUsers = {};
      }
    } catch (error) {
      this.logger.error('Erro ao inicializar usuários saudados:', error);
      this.greetedUsers = {};
    }
  }
  
  /**
   * Salva a lista de usuários saudados no arquivo
   */
  async saveGreetedUsers() {
    try {
      // Cria o diretório se não existir
      const dir = path.dirname(this.greetedUsersPath);
      await fs.mkdir(dir, { recursive: true }).catch(() => {});
      
      await fs.writeFile(this.greetedUsersPath, JSON.stringify(this.greetedUsers, null, 2));
      this.logger.debug('Usuários saudados salvos com sucesso');
    } catch (error) {
      this.logger.error('Erro ao salvar usuários saudados:', error);
    }
  }
  
  /**
   * Verifica se um usuário já foi saudado recentemente
   * @param {string} userId - ID do usuário
   * @returns {boolean} - True se o usuário já foi saudado recentemente
   */
  wasGreetedRecently(userId) {
    if (!this.greetedUsers[userId]) {
      return false;
    }
    
    const lastGreeted = this.greetedUsers[userId];
    const now = Date.now();
    const oneWeekMs = 7 * 24 * 60 * 60 * 1000; // Uma semana em milissegundos
    
    return (now - lastGreeted) < oneWeekMs;
  }
  
  /**
   * Marca um usuário como saudado
   * @param {string} userId - ID do usuário
   */
  async markAsGreeted(userId) {
    this.greetedUsers[userId] = Date.now();
    await this.saveGreetedUsers();
  }
  
  /**
   * Lê o texto de saudação do arquivo
   * @returns {Promise<string>} - O texto de saudação
   */
  async getGreetingText() {
    try {
      // Criar o diretório 'textos' se não existir
      const textosDir = path.join(this.database.databasePath, 'textos');
      await fs.mkdir(textosDir, { recursive: true }).catch(() => {});
      
      // Verificar se o arquivo de saudação existe
      try {
        await fs.access(this.greetingTextPath);
      } catch (error) {
        // Se o arquivo não existir, cria com um texto padrão
        const defaultGreeting = `🦇 *Olá! Eu sou a Ravena!* 🦇\n\nSou uma bot de WhatsApp com várias funções úteis!\n\nDigite *!cmd* para ver todos os comandos disponíveis. Aqui no privado, você pode:\n\n• Enviar áudios e eu farei a transcrição automaticamente\n• Enviar imagens/vídeos e eu crio figurinhas pra você\n• Utilizar comandos de texto para voz como *!tts* seguido do texto\n\nÉ possível também me adicionar em grupos! 😉`;
        
        await fs.writeFile(this.greetingTextPath, defaultGreeting);
        this.logger.info('Arquivo de saudação criado com texto padrão');
        return defaultGreeting;
      }
      
      // Ler o arquivo de saudação
      const greeting = await fs.readFile(this.greetingTextPath, 'utf8');
      return greeting;
    } catch (error) {
      this.logger.error('Erro ao obter texto de saudação:', error);
      return "🦇 Olá! Eu sou a Ravena, um bot de WhatsApp. Digite !cmd para ver os comandos disponíveis.";
    }
  }
  
  /**
   * Processa a saudação para um usuário
   * @param {WhatsAppBot} bot - Instância do bot
   * @param {Object} message - A mensagem do usuário
   * @returns {Promise<boolean>} - Se a saudação foi enviada
   */
  async processGreeting(bot, message) {
    try {
      // Verificar se a mensagem é de chat privado
      if (message.group) {
        return false;
      }
      
      const userId = message.author;
      
      // Verificar se o usuário já foi saudado recentemente
      if (this.wasGreetedRecently(userId)) {
        this.logger.debug(`Usuário ${userId} já foi saudado recentemente`);
        return false;
      } else {
        this.logger.debug(`Usuário ${userId} será saudado!`);
      }
      
      // Obter o texto de saudação
      const greetingText = await this.getGreetingText();
      
      // Enviar a saudação
      await bot.sendMessage(userId, greetingText);
      
      // Marcar o usuário como saudado
      await this.markAsGreeted(userId);
      
      this.logger.info(`Saudação enviada para ${userId}`);
      return true;
    } catch (error) {
      this.logger.error('Erro ao processar saudação:', error);
      return false;
    }
  }
}

// Instância única
let instance = null;

module.exports = {
  getInstance: () => {
    if (!instance) {
      instance = new UserGreetingManager();
    }
    return instance;
  }
};