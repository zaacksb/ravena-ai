/**
 * Modelo Group representando um grupo do WhatsApp com propriedades e configurações
 */
class Group {
  /**
   * Cria uma nova instância de Group
   * @param {Object} data - Dados do grupo
   */
  constructor(data = {}) {
    this.id = data.id || null;
    this.addedBy = data.addedBy || null;
    this.removedBy = data.removedBy || false;
    this.name = data.name || (this.id ? this.id.split('@')[0].toLowerCase().replace(/\s+/g, '').substring(0, 16) : null);
    this.prefix = data.prefix || '!';
    this.customIgnoresPrefix = data.customIgnoresPrefix || false;
    this.inviteCode = data.inviteCode || null;
    this.paused = data.paused || false;
    this.additionalAdmins = data.additionalAdmins || [];
    
    // Filtros
    this.filters = data.filters || {
      nsfw: false,
      links: false,
      words: [],
      people: []
    };
    
    // Monitoramento de plataformas
    this.twitch = data.twitch || [];
    this.kick = data.kick || [];
    this.youtube = data.youtube || [];
    this.botNotInGroup = data.botNotInGroup || [];

    // Mensagens de boas-vindas e despedida
    this.greetings = data.greetings || {};
    this.farewells = data.farewells || {};

    // Interacoes Auto
    this.interact = data.interact || {
      enabled: true,
      useCmds: true,
      lastInteraction: 0,
      cooldown: 30,
      chance: 100,
    };

    // Outras config
    this.autoStt = data.autoStt || false;
    this.ignoredNumbers = data.ignoredNumbers || [];
    this.ignoredUsers = data.ignoredUsers || [];
    this.mutedStrings = data.mutedStrings || [];
    this.mutedCategories = data.mutedCategories || [];
    this.nicks = data.nicks || [];
    
    
    // Metadados
    this.createdAt = data.createdAt || Date.now();
    this.updatedAt = Date.now();
  }

  /**
   * Converte instância de Group para objeto simples para serialização
   * @returns {Object} - Representação em objeto simples
   */
  toJSON() {
    return {
      id: this.id,
      addedBy: this.addedBy,
      removedBy: this.removedBy,
      name: this.name,
      prefix: this.prefix,
      customIgnoresPrefix: this.customIgnoresPrefix,
      inviteCode: this.inviteCode,
      paused: this.paused,
      additionalAdmins: this.additionalAdmins,
      filters: this.filters,
      twitch: this.twitch,
      kick: this.kick,
      youtube: this.youtube,
      botNotInGroup: this.botNotInGroup,
      greetings: this.greetings,
      farewells: this.farewells,
      interact: this.interact,
      autoStt: this.autoStt,
      ignoredNumbers: this.ignoredNumbers,
      ignoredUsers: this.ignoredUsers, 
      mutedStrings: this.mutedStrings,
      nicks: this.nicks,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Atualiza propriedades do grupo
   * @param {Object} data - Novos dados do grupo
   */
  update(data) {
    // Atualiza apenas propriedades fornecidas
    if (data.name) this.name = data.name;
    if (data.prefix) this.prefix = data.prefix;
    if (data.customIgnoresPrefix) this.customIgnoresPrefix = data.customIgnoresPrefix;
    if (data.inviteCode) this.inviteCode = data.inviteCode;
    if (typeof data.paused === 'boolean') this.paused = data.paused;
    if (data.additionalAdmins) this.additionalAdmins = data.additionalAdmins;
    
    // Atualiza filtros se fornecidos
    if (data.filters) {
      this.filters = {
        ...this.filters,
        ...data.filters
      };
    }
    
    // Atualiza monitoramento de plataformas
    if (data.twitch) this.twitch = data.twitch;
    if (data.kick) this.kick = data.kick;
    if (data.youtube) this.youtube = data.youtube;
    
    // Not in group
    if (data.botNotInGroup) this.botNotInGroup = data.botNotInGroup;

    // Atualiza boas-vindas
    if (data.greetings) {
      this.greetings = {
        ...this.greetings,
        ...data.greetings
      };
    }
    
    // Atualiza despedidas
    if (data.farewells) {
      this.farewells = {
        ...this.farewells,
        ...data.farewells
      };
    }
    
    // Atualiza interações automáticas
    if (data.interact) {
      this.interact = {
        ...this.interact,
        ...data.interact
      };
    }
    
    // Atualiza outras configurações
    if (typeof data.autoStt === 'boolean') this.autoStt = data.autoStt;
    if (data.ignoredNumbers) this.ignoredNumbers = data.ignoredNumbers;
    if (data.ignoredUsers) this.ignoredUsers = data.ignoredUsers;
    if (data.mutedStrings) this.mutedStrings = data.mutedStrings;
    if (data.nicks) this.nicks = data.nicks;
    
    // Atualiza carimbos de data/hora
    this.updatedAt = Date.now();
  }

  /**
   * Define o grupo como removido
   * @param {string} userId - ID do usuário que removeu o bot
   */
  setRemoved(userId) {
    this.removedBy = userId;
    //this.paused = true;
    this.updatedAt = Date.now();
  }

  /**
   * Verifica se um usuário está monitorando um canal de plataforma específico
   * @param {string} platform - Nome da plataforma ('twitch', 'kick', 'youtube')
   * @param {string} channel - Nome ou ID do canal
   * @returns {boolean} - True se estiver monitorando
   */
  isMonitoring(platform, channel) {
    if (!this[platform] || !Array.isArray(this[platform])) {
      return false;
    }
    
    if (platform === 'twitch' || platform === 'kick') {
      return this[platform].some(ch => ch.name.toLowerCase() === channel.toLowerCase());
    } else if (platform === 'youtube') {
      return this[platform].includes(channel);
    }
    
    return false;
  }

  /**
   * Adiciona monitoramento de plataforma
   * @param {string} platform - Nome da plataforma ('twitch', 'kick', 'youtube')
   * @param {Object|string} channelData - Dados do canal ou ID
   */
  addMonitoring(platform, channelData) {
    if (!this[platform] || !Array.isArray(this[platform])) {
      this[platform] = [];
    }
    
    if (platform === 'twitch' || platform === 'kick') {
      // Verifica se já está monitorando
      const index = this[platform].findIndex(ch => ch.name.toLowerCase() === channelData.name.toLowerCase());
      
      if (index !== -1) {
        // Atualiza monitoramento existente
        this[platform][index] = channelData;
      } else {
        // Adiciona novo monitoramento
        this[platform].push(channelData);
      }
    } else if (platform === 'youtube') {
      // Adiciona se ainda não estiver monitorando
      if (!this[platform].includes(channelData)) {
        this[platform].push(channelData);
      }
    }
    
    this.updatedAt = Date.now();
  }

  /**
   * Remove monitoramento de plataforma
   * @param {string} platform - Nome da plataforma ('twitch', 'kick', 'youtube')
   * @param {string} channel - Nome ou ID do canal
   */
  removeMonitoring(platform, channel) {
    if (!this[platform] || !Array.isArray(this[platform])) {
      return;
    }
    
    if (platform === 'twitch' || platform === 'kick') {
      this[platform] = this[platform].filter(ch => ch.name.toLowerCase() !== channel.toLowerCase());
    } else if (platform === 'youtube') {
      this[platform] = this[platform].filter(id => id !== channel);
    }
    
    this.updatedAt = Date.now();
  }
}

module.exports = Group;