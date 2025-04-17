const fs = require('fs');
const path = require('path');
const Logger = require('./Logger');

/**
 * Classe Singleton Database para lidar com persistência baseada em JSON
 */
class Database {
  constructor() {
    this.logger = new Logger('database');
    this.databasePath = path.join(__dirname, '../../data');
    this.backupPath = path.join(__dirname, '../../data/backups');
    this.maxBackups = parseInt(process.env.MAX_BACKUPS) || 0; // 0 = manter todos os backups
    
    // Cria diretórios de banco de dados e backup se não existirem
    this.ensureDirectories();
    
    // Cache para objetos de banco de dados
    this.cache = {
      groups: null,
      variables: null,
      commands: {}
    };
  }

  /**
   * Obtém a instância singleton
   * @returns {Database} A instância do banco de dados
   */
  static getInstance() {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Garante que os diretórios do banco de dados existam
   */
  ensureDirectories() {
    try {
      // Cria diretório de dados se não existir
      if (!fs.existsSync(this.databasePath)) {
        fs.mkdirSync(this.databasePath, { recursive: true });
      }
      
      // Cria diretório de backups se não existir
      if (!fs.existsSync(this.backupPath)) {
        fs.mkdirSync(this.backupPath, { recursive: true });
      }
      
      // Cria diretório custom-cmd se não existir
      const customCmdPath = path.join(this.databasePath, 'custom-cmd');
      if (!fs.existsSync(customCmdPath)) {
        fs.mkdirSync(customCmdPath, { recursive: true });
      }
    } catch (error) {
      this.logger.error('Erro ao garantir diretórios de banco de dados:', error);
    }
  }

  /**
   * Cria um backup de um arquivo
   * @param {string} filePath - Caminho para o arquivo a ser copiado
   */
  createBackup(filePath) {
    try {
      if (!fs.existsSync(filePath)) return;
      
      const fileName = path.basename(filePath);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFileName = `${fileName}.${timestamp}.bak`;
      const backupFilePath = path.join(this.backupPath, backupFileName);
      
      fs.copyFileSync(filePath, backupFilePath);
      this.logger.info(`Backup criado: ${backupFilePath}`);
      
      // Limpa backups antigos se maxBackups estiver definido
      this.cleanupOldBackups(fileName);
    } catch (error) {
      this.logger.error(`Erro ao criar backup para ${filePath}:`, error);
    }
  }
  
  /**
   * Limpa backups antigos de um arquivo
   * @param {string} fileName - Nome do arquivo base
   */
  cleanupOldBackups(fileName) {
    // Limpa apenas se maxBackups estiver definido para um número positivo
    if (!this.maxBackups || this.maxBackups <= 0) return;
    
    try {
      // Obtém todos os backups para este arquivo
      const backupFiles = fs.readdirSync(this.backupPath)
        .filter(file => file.startsWith(`${fileName}.`) && file.endsWith('.bak'))
        .sort()
        .reverse(); // mais recente primeiro
      
      // Se tivermos mais backups que maxBackups, exclui os mais antigos
      if (backupFiles.length > this.maxBackups) {
        const filesToDelete = backupFiles.slice(this.maxBackups);
        
        for (const file of filesToDelete) {
          const filePath = path.join(this.backupPath, file);
          fs.unlinkSync(filePath);
          this.logger.info(`Backup antigo excluído: ${filePath}`);
        }
      }
    } catch (error) {
      this.logger.error(`Erro ao limpar backups antigos para ${fileName}:`, error);
    }
  }

/**
   * Carrega dados JSON de um arquivo
   * @param {string} filePath - Caminho para o arquivo JSON
   * @returns {Object|Array|null} - Os dados JSON analisados ou null em caso de erro
   */
  loadJSON(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        this.logger.debug(`Arquivo não existe: ${filePath}`);
        return null;
      }
      
      const data = fs.readFileSync(filePath, 'utf8');
      if (!data || data.trim() === '') {
        this.logger.warn(`Arquivo está vazio: ${filePath}`);
        return null;
      }
      
      try {
        return JSON.parse(data);
      } catch (parseError) {
        this.logger.error(`Erro ao analisar JSON de ${filePath}:`, parseError);
        // Tenta carregar do backup se disponível
        return this.loadLatestBackup(filePath);
      }
    } catch (error) {
      this.logger.error(`Erro ao carregar JSON de ${filePath}:`, error);
      
      // Tenta carregar do backup se disponível
      return this.loadLatestBackup(filePath);
    }
  }

  /**
   * Salva dados JSON em um arquivo
   * @param {string} filePath - Caminho para salvar o arquivo JSON
   * @param {Object|Array} data - Os dados a serem salvos
   * @returns {boolean} - Status de sucesso
   */
  saveJSON(filePath, data) {
    try {
      // Cria backup do arquivo existente
      this.createBackup(filePath);
      
      // Garante que o diretório exista
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Escreve novos dados
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
      return true;
    } catch (error) {
      this.logger.error(`Erro ao salvar JSON em ${filePath}:`, error);
      return false;
    }
  }

  /**
   * Carrega o backup mais recente de um arquivo
   * @param {string} originalFilePath - Caminho do arquivo original
   * @returns {Object|Array|null} - Os dados JSON analisados ou null em caso de erro
   */
  loadLatestBackup(originalFilePath) {
    try {
      const fileName = path.basename(originalFilePath);
      const backupFiles = fs.readdirSync(this.backupPath)
        .filter(file => file.startsWith(`${fileName}.`) && file.endsWith('.bak'))
        .sort()
        .reverse();
      
      if (backupFiles.length === 0) {
        return null;
      }
      
      // Carrega backup mais recente
      const latestBackup = backupFiles[0];
      const backupPath = path.join(this.backupPath, latestBackup);
      
      this.logger.info(`Carregando do backup: ${backupPath}`);
      const data = fs.readFileSync(backupPath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      this.logger.error(`Erro ao carregar backup para ${originalFilePath}:`, error);
      return null;
    }
  }

/**
   * Obtém todos os grupos
   * @returns {Array} - Array de objetos de grupo
   */
  async getGroups() {
    try {
      // Retorna do cache se disponível
      if (this.cache.groups) {
        return this.cache.groups;
      }
      
      const groupsPath = path.join(this.databasePath, 'groups.json');
      let groups = this.loadJSON(groupsPath);
      
      // Garante que groups seja um array
      if (!groups || !Array.isArray(groups)) {
        this.logger.warn('Arquivo de grupos ausente ou inválido, criando array vazio');
        groups = [];
        // Cria arquivo de grupos vazio se não existir
        await this.saveJSON(groupsPath, groups);
      }
      
      // Atualiza cache
      this.cache.groups = groups;
      
      return groups;
    } catch (error) {
      this.logger.error('Erro em getGroups:', error);
      return [];
    }
  }

  /**
   * Obtém um grupo específico por ID
   * @param {string} groupId - O ID do grupo
   * @returns {Object|null} - O objeto do grupo ou null se não encontrado
   */
  async getGroup(groupId) {
    const groups = await this.getGroups();
    return groups.find(group => group.id === groupId) || null;
  }

/**
   * Salva um grupo
   * @param {Object} group - O objeto do grupo a ser salvo
   * @returns {boolean} - Status de sucesso
   */
  async saveGroup(group) {
    try {
      // Obtém todos os grupos
      const groups = await this.getGroups();
      
      if (!Array.isArray(groups)) {
        this.logger.error('Groups não é um array em saveGroup:', groups);
        // Inicializa como array vazio se não for um array
        this.cache.groups = [];
        return this.saveJSON(path.join(this.databasePath, 'groups.json'), [group]);
      }
      
      // Encontra índice do grupo existente
      const index = groups.findIndex(g => g.id === group.id);
      
      if (index !== -1) {
        // Atualiza grupo existente
        groups[index] = group;
      } else {
        // Adiciona novo grupo
        groups.push(group);
      }
      
      // Atualiza cache
      this.cache.groups = groups;
      
      // Salva no arquivo
      const groupsPath = path.join(this.databasePath, 'groups.json');
      return this.saveJSON(groupsPath, groups);
    } catch (error) {
      this.logger.error('Erro ao salvar grupo:', error);
      return false;
    }
  }

  /**
   * Obtém comandos personalizados para um grupo
   * @param {string} groupId - O ID do grupo
   * @returns {Array} - Array de objetos de comando personalizado
   */
  async getCustomCommands(groupId) {
    // Retorna do cache se disponível
    if (this.cache.commands[groupId]) {
      return this.cache.commands[groupId];
    }
    
    const customCmdPath = path.join(this.databasePath, 'custom-cmd', `${groupId}.json`);
    const commands = this.loadJSON(customCmdPath) || [];
    
    // Atualiza cache
    this.cache.commands[groupId] = commands;
    
    return commands;
  }

  /**
   * Salva um comando personalizado para um grupo
   * @param {string} groupId - O ID do grupo
   * @param {Object} command - O objeto de comando a ser salvo
   * @returns {boolean} - Status de sucesso
   */
  async saveCustomCommand(groupId, command) {
    // Obtém todos os comandos personalizados para este grupo
    const commands = await this.getCustomCommands(groupId);
    
    // Encontra índice do comando existente
    const index = commands.findIndex(c => c.startsWith === command.startsWith);
    
    if (index !== -1) {
      // Atualiza comando existente
      commands[index] = command;
    } else {
      // Adiciona novo comando
      commands.push(command);
    }
    
    // Atualiza cache
    this.cache.commands[groupId] = commands;
    
    // Salva no arquivo
    const customCmdPath = path.join(this.databasePath, 'custom-cmd', `${groupId}.json`);
    return this.saveJSON(customCmdPath, commands);
  }

  /**
   * Atualiza um comando personalizado existente
   * @param {string} groupId - O ID do grupo
   * @param {Object} command - O objeto de comando a atualizar
   * @returns {boolean} - Status de sucesso
   */
  async updateCustomCommand(groupId, command) {
    // Obtém todos os comandos personalizados para este grupo
    const commands = await this.getCustomCommands(groupId);
    
    // Encontra índice do comando existente
    const index = commands.findIndex(c => c.startsWith === command.startsWith);
    
    if (index !== -1) {
      // Atualiza comando existente
      commands[index] = command;
      
      // Atualiza cache
      this.cache.commands[groupId] = commands;
      
      // Salva no arquivo
      const customCmdPath = path.join(this.databasePath, 'custom-cmd', `${groupId}.json`);
      return this.saveJSON(customCmdPath, commands);
    }
    
    return false;
  }

  /**
   * Exclui um comando personalizado
   * @param {string} groupId - O ID do grupo
   * @param {string} commandStart - O valor startsWith do comando
   * @returns {boolean} - Status de sucesso
   */
  async deleteCustomCommand(groupId, commandStart) {
    // Obtém todos os comandos personalizados para este grupo
    const commands = await this.getCustomCommands(groupId);
    
    // Encontra índice do comando existente
    const index = commands.findIndex(c => c.startsWith === commandStart);
    
    if (index !== -1) {
      // Marca comando como excluído
      commands[index].deleted = true;
      commands[index].active = false;
      
      // Atualiza cache
      this.cache.commands[groupId] = commands;
      
      // Salva no arquivo
      const customCmdPath = path.join(this.databasePath, 'custom-cmd', `${groupId}.json`);
      return this.saveJSON(customCmdPath, commands);
    }
    
    return false;
  }

  /**
   * Obtém variáveis personalizadas
   * @returns {Object} - Objeto de variáveis personalizadas
   */
  async getCustomVariables() {
    // Retorna do cache se disponível
    if (this.cache.variables) {
      return this.cache.variables;
    }
    
    const variablesPath = path.join(this.databasePath, 'custom-variables.json');
    const variables = this.loadJSON(variablesPath) || {};
    
    // Atualiza cache
    this.cache.variables = variables;
    
    return variables;
  }

  /**
   * Salva variáveis personalizadas
   * @param {Object} variables - Objeto de variáveis personalizadas
   * @returns {boolean} - Status de sucesso
   */
  async saveCustomVariables(variables) {
    // Atualiza cache
    this.cache.variables = variables;
    
    // Salva no arquivo
    const variablesPath = path.join(this.databasePath, 'custom-variables.json');
    return this.saveJSON(variablesPath, variables);
  }

  /**
   * Limpa cache para uma chave específica ou todo o cache se nenhuma chave for fornecida
   * @param {string} [key] - Chave de cache para limpar
   */
  clearCache(key) {
    if (key) {
      this.cache[key] = null;
    } else {
      this.cache = {
        groups: null,
        variables: null,
        commands: {}
      };
    }
  }

  /**
   * Obtém relatórios de carga
   * @param {number} [since] - Obtém relatórios após este timestamp
   * @returns {Array} - Array de objetos de relatório de carga
   */
  async getLoadReports(since = 0) {
    try {
      const reportsPath = path.join(this.databasePath, 'load-reports.json');
      let reports = this.loadJSON(reportsPath) || [];
      
      // Filtra relatórios por timestamp se 'since' for fornecido
      if (since > 0) {
        reports = reports.filter(report => report.period.end > since);
      }
      
      return reports;
    } catch (error) {
      this.logger.error('Erro ao obter relatórios de carga:', error);
      return [];
    }
  }

  /**
   * Salva relatórios de carga
   * @param {Array} reports - Array de objetos de relatório de carga
   * @returns {boolean} - Status de sucesso
   */
  async saveLoadReports(reports) {
    try {
      const reportsPath = path.join(this.databasePath, 'load-reports.json');
      return this.saveJSON(reportsPath, reports);
    } catch (error) {
      this.logger.error('Erro ao salvar relatórios de carga:', error);
      return false;
    }
  }

  /**
   * Obtém doações
   * @returns {Array} - Array de objetos de doação
   */
  async getDonations() {
    try {
      const donationsPath = path.join(this.databasePath, 'donations.json');
      return this.loadJSON(donationsPath) || [];
    } catch (error) {
      this.logger.error('Erro ao obter doações:', error);
      return [];
    }
  }

  /**
   * Salva doações
   * @param {Array} donations - Array de objetos de doação
   * @returns {boolean} - Status de sucesso
   */
  async saveDonations(donations) {
    try {
      const donationsPath = path.join(this.databasePath, 'donations.json');
      return this.saveJSON(donationsPath, donations);
    } catch (error) {
      this.logger.error('Erro ao salvar doações:', error);
      return false;
    }
  }

  /**
   * Adiciona uma doação
   * @param {string} name - Nome do doador
   * @param {number} amount - Valor da doação
   * @param {string} [numero] - Número do WhatsApp (opcional)
   * @returns {boolean} - Status de sucesso
   */
  async addDonation(name, amount, numero = undefined) {
    try {
      // Obtém doações existentes
      const donations = await this.getDonations();
      
      // Verifica se o doador já existe
      const existingIndex = donations.findIndex(d => d.nome.toLowerCase() === name.toLowerCase());
      
      if (existingIndex !== -1) {
        // Atualiza doação existente
        donations[existingIndex].valor += amount;
        if (numero) {
          donations[existingIndex].numero = numero;
        }
      } else {
        // Adiciona nova doação
        donations.push({
          nome: name,
          valor: amount,
          numero
        });
      }
      
      // Salva doações
      return this.saveDonations(donations);
    } catch (error) {
      this.logger.error('Erro ao adicionar doação:', error);
      return false;
    }
  }

  /**
   * Atualiza número do doador
   * @param {string} name - Nome do doador
   * @param {string} numero - Número do WhatsApp
   * @returns {boolean} - Status de sucesso
   */
  async updateDonorNumber(name, numero) {
    try {
      // Obtém doações existentes
      const donations = await this.getDonations();
      
      // Encontra doador
      const donor = donations.find(d => d.nome.toLowerCase() === name.toLowerCase());
      
      if (!donor) {
        this.logger.warn(`Doador "${name}" não encontrado`);
        return false;
      }
      
      // Atualiza número
      donor.numero = numero;
      
      // Salva doações
      return this.saveDonations(donations);
    } catch (error) {
      this.logger.error('Erro ao atualizar número do doador:', error);
      return false;
    }
  }

  /**
   * Atualiza valor da doação
   * @param {string} name - Nome do doador
   * @param {number} amount - Valor a adicionar (pode ser negativo)
   * @returns {boolean} - Status de sucesso
   */
  async updateDonationAmount(name, amount) {
    try {
      // Obtém doações existentes
      const donations = await this.getDonations();
      
      // Encontra doador
      const donor = donations.find(d => d.nome.toLowerCase() === name.toLowerCase());
      
      if (!donor) {
        this.logger.warn(`Doador "${name}" não encontrado`);
        return false;
      }
      
      // Atualiza valor
      donor.valor += amount;
      
      // Salva doações
      return this.saveDonations(donations);
    } catch (error) {
      this.logger.error('Erro ao atualizar valor da doação:', error);
      return false;
    }
  }

  /**
   * Une dois doadores
   * @param {string} targetName - Nome do doador a manter
   * @param {string} sourceName - Nome do doador a fundir
   * @returns {boolean} - Status de sucesso
   */
  async mergeDonors(targetName, sourceName) {
    try {
      // Obtém doações existentes
      const donations = await this.getDonations();
      
      // Encontra ambos os doadores
      const targetIndex = donations.findIndex(d => d.nome.toLowerCase() === targetName.toLowerCase());
      const sourceIndex = donations.findIndex(d => d.nome.toLowerCase() === sourceName.toLowerCase());
      
      if (targetIndex === -1 || sourceIndex === -1) {
        this.logger.warn(`Um ou ambos os doadores não encontrados para união: "${targetName}", "${sourceName}"`);
        return false;
      }
      
      // Une valores
      donations[targetIndex].valor += donations[sourceIndex].valor;
      
      // Mantém número de origem se o alvo não tiver um
      if (!donations[targetIndex].numero && donations[sourceIndex].numero) {
        donations[targetIndex].numero = donations[sourceIndex].numero;
      }
      
      // Remove doador de origem
      donations.splice(sourceIndex, 1);
      
      // Salva doações
      return this.saveDonations(donations);
    } catch (error) {
      this.logger.error('Erro ao unir doadores:', error);
      return false;
    }
  }

  /**
   * Obtém joins pendentes
   * @returns {Array} - Array de objetos de join pendente
   */
  async getPendingJoins() {
    try {
      const joinsPath = path.join(this.databasePath, 'pending-joins.json');
      return this.loadJSON(joinsPath) || [];
    } catch (error) {
      this.logger.error('Erro ao obter joins pendentes:', error);
      return [];
    }
  }

  /**
   * Salva joins pendentes
   * @param {Array} joins - Array de objetos de join pendente
   * @returns {boolean} - Status de sucesso
   */
  async savePendingJoins(joins) {
    try {
      const joinsPath = path.join(this.databasePath, 'pending-joins.json');
      return this.saveJSON(joinsPath, joins);
    } catch (error) {
      this.logger.error('Erro ao salvar joins pendentes:', error);
      return false;
    }
  }

  /**
   * Salva um join pendente
   * @param {string} inviteCode - Código do convite
   * @param {Object} data - Dados do join (authorId, authorName)
   * @returns {boolean} - Status de sucesso
   */
  async savePendingJoin(inviteCode, data) {
    try {
      // Obtém joins pendentes existentes
      const joins = await this.getPendingJoins();
      
      // Adiciona ou atualiza o join pendente
      const existingIndex = joins.findIndex(join => join.code === inviteCode);
      
      if (existingIndex !== -1) {
        // Atualiza existente
        joins[existingIndex] = { 
          code: inviteCode,
          authorId: data.authorId,
          authorName: data.authorName,
          timestamp: Date.now()
        };
      } else {
        // Adiciona novo
        joins.push({
          code: inviteCode,
          authorId: data.authorId,
          authorName: data.authorName,
          timestamp: Date.now()
        });
      }
      
      // Salva joins
      return this.savePendingJoins(joins);
    } catch (error) {
      this.logger.error('Erro ao salvar join pendente:', error);
      return false;
    }
  }

  /**
   * Remove um join pendente
   * @param {string} inviteCode - Código do convite
   * @returns {boolean} - Status de sucesso
   */
  async removePendingJoin(inviteCode) {
    try {
      // Obtém joins existentes
      let joins = await this.getPendingJoins();
      
      // Filtra o join
      joins = joins.filter(join => join.code !== inviteCode);
      
      // Salva joins
      return this.savePendingJoins(joins);
    } catch (error) {
      this.logger.error('Erro ao remover join pendente:', error);
      return false;
    }
  }
}

module.exports = Database;