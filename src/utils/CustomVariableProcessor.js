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

    this.redditCache = {};
  }

  /**
   * Processa variáveis em uma string
   * @param {string} text - Texto contendo variáveis
   * @param {Object} context - Dados de contexto (mensagem, grupo, etc.)
   * @returns {Promise<string|Object>} - Texto processado ou objeto MessageMedia para variáveis de arquivo
   */
  async process(text, context) {
    if (!text) return '';

    this.logger.debug(`[CustomVariableProcessor][process] ${text} <=> ${Object.keys(context)}`);
    
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

      let processedText = text;

      // Verifica se é variável de reddit
      const redditResult = await this.processRedditVariable(text, context);

      if(redditResult){
        if (redditResult.type === 'media') {
            // Se retornou mídia, envia o payload diretamente
            return redditResult.payload;
        } else {
          processedText = redditResult.text;
        }
      }
      
      // Carrega variáveis personalizadas se não estiverem em cache ou o cache estiver obsoleto
      if (!this.cache.variables || Date.now() - this.cache.lastFetch > 300000) { // 5 minutos
        await this.loadCustomVariables();
      }
      
      // Processa variáveis de API
      processedText = await this.processAPIRequest(processedText, context);
      
      // Processa variáveis de tempo e data
      processedText = this.processSystemVariables(processedText);
      
      // Processa variáveis estáticas personalizadas
      if (this.cache.variables) {
        processedText = this.processCustomStaticVariables(processedText);
      }
      
      // Processa variáveis específicas de contexto
      if (context) {
        processedText = await this.processContextVariables(processedText, context);
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
    
    // NOVAS VARIÁVEIS DE DATA E HORA DETALHADAS
    // Substitui {data-hora} pela hora atual
    text = text.replace(/{data-hora}/g, now.getHours().toString().padStart(2, '0'));
    
    // Substitui {data-minuto} pelo minuto atual
    text = text.replace(/{data-minuto}/g, now.getMinutes().toString().padStart(2, '0'));
    
    // Substitui {data-segundo} pelo segundo atual
    text = text.replace(/{data-segundo}/g, now.getSeconds().toString().padStart(2, '0'));
    
    // Substitui {data-dia} pelo dia atual
    text = text.replace(/{data-dia}/g, now.getDate().toString().padStart(2, '0'));
    
    // Substitui {data-mes} pelo mês atual
    text = text.replace(/{data-mes}/g, (now.getMonth() + 1).toString().padStart(2, '0'));
    
    // Substitui {data-ano} pelo ano atual
    text = text.replace(/{data-ano}/g, now.getFullYear());
    
    // VARIÁVEIS DE NÚMEROS ALEATÓRIOS
    // Substitui {randomPequeno} por um número aleatório de 1 a 10
    text = text.replace(/{randomPequeno}/g, () => Math.floor(Math.random() * 10) + 1);
    
    // Substitui {randomMedio} por um número aleatório de 1 a 100
    text = text.replace(/{randomMedio}/g, () => Math.floor(Math.random() * 100) + 1);
    
    // Substitui {randomGrande} por um número aleatório de 1 a 1000
    text = text.replace(/{randomGrande}/g, () => Math.floor(Math.random() * 1000) + 1);
    
    // Substitui {randomMuitoGrande} por um número aleatório de 1 a 10000
    text = text.replace(/{randomMuitoGrande}/g, () => Math.floor(Math.random() * 10000) + 1);
    
    // Processar variáveis {rndDado-X} para valores de dado
    const dadoMatches = text.matchAll(/{rndDado-(\d+)}/g);
    for (const match of Array.from(dadoMatches)) {
      const lados = parseInt(match[1]);
      if (!isNaN(lados) && lados > 0) {
        const valor = Math.floor(Math.random() * lados) + 1;
        text = text.replace(match[0], valor);
      }
    }
    
    // Processar variáveis {rndDadoRange-X-Y} para valores de dado em um intervalo
    const rangeMatches = text.matchAll(/{rndDadoRange-(\d+)-(\d+)}/g);
    for (const match of Array.from(rangeMatches)) {
      const min = parseInt(match[1]);
      const max = parseInt(match[2]);
      if (!isNaN(min) && !isNaN(max) && min <= max) {
        const valor = Math.floor(Math.random() * (max - min + 1)) + min;
        text = text.replace(match[0], valor);
      }
    }
    
    // Variável {somaRandoms} - calcula a soma das variáveis random já processadas
    const sumMatches = text.match(/{somaRandoms}/g);
    if (sumMatches) {
      // Procura por números anteriores no texto que foram gerados por variáveis random
      const numbersInText = text.split(/\\s+/).filter(word => /^\\d+$/.test(word)).map(num => parseInt(num));
      const sum = numbersInText.reduce((acc, curr) => acc + curr, 0);
      
      // Substitui {somaRandoms} pela soma
      text = text.replace(/{somaRandoms}/g, sum);
    }
    
    return text;
  }

  /**
   * Obter um membro aleatório do grupo
   * @param {Object} bot - Instância do bot
   * @param {string} groupId - ID do grupo
   * @returns {Promise<Object|null>} - Membro aleatório ou null
   */
  async getRandomGroupMember(bot, groupId) {
    try {
      if (!bot || !bot.client || !groupId) {
        return null;
      }

      // Obtém o chat do grupo
      const chat = await bot.client.getChatById(groupId);
      if (!chat || !chat.isGroup) {
        return null;
      }

      // Obtém todos os participantes
      const participants = chat.participants;
      if (!participants || participants.length === 0) {
        return null;
      }

      // Filtra para excluir o próprio bot
      const filteredParticipants = participants.filter(
        p => p.id._serialized !== bot.client.info.wid._serialized
      );

      if (filteredParticipants.length === 0) {
        return null;
      }

      // Seleciona um participante aleatório
      const randomIndex = Math.floor(Math.random() * filteredParticipants.length);
      const randomParticipant = filteredParticipants[randomIndex];

      // Obtém o objeto de contato
      const contact = await bot.client.getContactById(randomParticipant.id._serialized);
      return contact;
    } catch (error) {
      this.logger.error('Erro ao obter membro aleatório do grupo:', error);
      return null;
    }
  }

  /**
   * Processa variáveis específicas de contexto (mensagem, grupo, etc.)
   * @param {string} text - Texto contendo variáveis
   * @param {Object} context - Dados de contexto
   * @returns {string} - Texto processado
   */
  async processContextVariables(text, context) {
    // Substitui {pessoa} pelo nome do remetente
    if (context.message && context.message.author) {
      // Tenta obter o nome real ou o apelido do remetente
      let authorName = "Usuário";
      if (context.message.authorName) {
        authorName = context.message.authorName;
      } else if (context.message.origin && context.message.origin.getContact) {
        try {
          const contact = await context.message.origin.getContact();
          authorName = contact.pushname || contact.name || "Usuário";
        } catch (error) {
          this.logger.error('Erro ao obter contato para variável {pessoa}:', error);
        }
      }
      text = text.replace(/{pessoa}/g, authorName);
      
      // Nova variável {nomeAutor} - mesmo comportamento que {pessoa}
      text = text.replace(/{nomeAutor}/g, authorName);
    }
    
    // Substitui {group} pelo nome do grupo
    if (context.group && context.group.name) {
      text = text.replace(/{group}/g, context.group.name);
      
      // Novas variáveis {nomeCanal} e {nomeGrupo} - mesmo comportamento que {group}
      text = text.replace(/{nomeCanal}/g, context.group.name);
      text = text.replace(/{nomeGrupo}/g, context.group.name);
    }
    
    // Variável {contador} - número de vezes que o comando foi executado
    if (context.command && context.command.count !== undefined) {
      text = text.replace(/{contador}/g, context.command.count);
    }
    
    // Variável {membroRandom} - nome de um membro aleatório do grupo
    const membroRandomMatches = text.match(/{membroRandom}/g);
    if (membroRandomMatches && context.bot && context.message && context.message.group) {
      try {
        const randomMember = await this.getRandomGroupMember(context.bot, context.message.group);
        const memberName = randomMember ? (randomMember.pushname || randomMember.name || "Alguém") : "Alguém";
        text = text.replace(/{membroRandom}/g, memberName);
      } catch (error) {
        this.logger.error('Erro ao processar variável {membroRandom}:', error);
        text = text.replace(/{membroRandom}/g, "Alguém");
      }
    }
    
    // Variável {mention} - nome da pessoa mencionada ou um membro aleatório se não houver menção
    if (context.message && context.message.origin) {
      try {
        // Quando for um mention, usar @1234567 ao invés do nome
        /* Ordem de pegar mention:
        1. Pessoa marcada na mensagem (mentionedIds)
        2. Mensagem em quote
        3. Membro random do grupo
        */
        
        // Rastreia menções já usadas para não repetir a mesma pessoa
        const usedMentions = [];
        
        // Função para substituir cada ocorrência de {mention} com uma pessoa diferente
        const replaceMention = async (fallbackNumber = false) => {
          let mentionId = null;
          let mentionName = null;
          
          // 1. Primeiro, verifica se há pessoas mencionadas na mensagem original
          if (context.message.origin.mentionedIds && context.message.origin.mentionedIds.length > 0) {
            // Filtra para usar apenas menções que ainda não foram usadas
            const availableMentions = context.message.origin.mentionedIds.filter(id => !usedMentions.includes(id));
            this.logger.debug(`[processContextVariables][availableMentions] `,availableMentions);
            if (availableMentions.length > 0) {
              // Seleciona uma menção aleatória das disponíveis
              const randomIndex = Math.floor(Math.random() * availableMentions.length);
              mentionId = availableMentions[randomIndex];
              
              let mentionContact = undefined;
              try {
                // Obtém informações do contato mencionado
                mentionContact = await context.bot.client.getContactById(mentionId);
                mentionName = `@${mentionContact.number || mentionContact.id.user}`;
              } catch (err) {
                this.logger.error('Erro ao obter contato mencionado:', err);
                mentionName = `@${mentionId.split('@')[0]}`;
              }
              
              // Marca esta menção como usada
              usedMentions.push(mentionId);
              return { mentionId, mentionName, mentionContact };
            }
          }
          
          // 2. Se não há menções ou todas já foram usadas, tenta usar a mensagem citada
          const quotedMsg = await context.message.origin.getQuotedMessage().catch(() => null);
          
          if (quotedMsg && !usedMentions.includes(quotedMsg.author)) {
            // Usa o contato da mensagem citada
            try {
              const mentionContact = await quotedMsg.getContact();
              if (mentionContact) {
                mentionId = mentionContact.id._serialized;
                mentionName = `@${mentionContact.number || mentionContact.id.user}`;
                
                // Marca esta menção como usada
                usedMentions.push(mentionId);
                return { mentionId, mentionName, mentionContact };
              }
            } catch (err) {
              this.logger.error('Erro ao obter contato da mensagem citada:', err);
            }
          }
          
          // 3. Se não há mensagem citada ou já foi usada, seleciona um membro aleatório - a não ser que tenha um fallback especificado
          if(fallbackNumber){
              const mentionContact = await context.bot.client.getContactById(fallbackNumber);
              mentionName = `@${mentionContact.number || mentionContact.id.user}`;

              return { mentionId: fallbackNumber, mentionName, mentionContact };
          } else {
            if (context.bot && context.message.group) {
              try {
                // Obtém membros que ainda não foram usados
                const chat = await context.bot.client.getChatById(context.message.group);
                if (chat && chat.isGroup) {
                  // Filtra participantes para excluir o próprio bot e menções já usadas
                  const filteredParticipants = chat.participants.filter(
                    p => p.id._serialized !== context.bot.client.info.wid._serialized && 
                        !usedMentions.includes(p.id._serialized)
                  );
                  
                  if (filteredParticipants.length > 0) {
                    // Seleciona um participante aleatório
                    const randomIndex = Math.floor(Math.random() * filteredParticipants.length);
                    const randomParticipant = filteredParticipants[randomIndex];
                    
                    mentionId = randomParticipant.id._serialized;
                    
                    // Obtém o objeto de contato
                    const mentionContact = await context.bot.client.getContactById(mentionId);
                    mentionName = `@${mentionContact.number || mentionContact.id.user}`;
                    
                    // Marca esta menção como usada
                    usedMentions.push(mentionId);
                    return { mentionId, mentionName, mentionContact };
                  } else if (chat.participants.length > 1) {
                    // Se todos já foram usados, reseta e usa qualquer um exceto o bot
                    const nonBotParticipants = chat.participants.filter(
                      p => p.id._serialized !== context.bot.client.info.wid._serialized
                    );
                    
                    if (nonBotParticipants.length > 0) {
                      const randomIndex = Math.floor(Math.random() * nonBotParticipants.length);
                      const randomParticipant = nonBotParticipants[randomIndex];
                      
                      mentionId = randomParticipant.id._serialized;
                      
                      // Obtém o objeto de contato
                      const mentionContact = await context.bot.client.getContactById(mentionId);
                      mentionName = `@${mentionContact.number || mentionContact.id.user}`;
                      
                      return { mentionId, mentionName, mentionContact };
                    }
                  }
                }
              } catch (err) {
                this.logger.error('Erro ao obter membro aleatório do grupo:', err);
              }
            }
          }
          
          // Fallback se nada funcionar
          return { mentionId: null, mentionName: "Usuário", mentionContact: null };
        };
        
        // Conta quantas ocorrências de {mention} existem no texto
        const mentionMatches = text.match(/{mention}/g);
        if (mentionMatches) {
          // Para cada ocorrência, substitui por uma menção diferente
          for (let i = 0; i < mentionMatches.length; i++) {
            const { mentionId, mentionName, mentionContact } = await replaceMention();
            
            // Substitui apenas a primeira ocorrência restante
            text = text.replace(/{mention}/, mentionName);
            
            // Adiciona à lista de menções para notificação
            if (mentionId) {
              this.logger.debug(`[processContextVariables] Mention: ${mentionId}, ${mentionName}`);
              if (context.options && context.options.mentions){
                if (!context.options.mentions.includes(mentionId)) {
                  context.options.mentions.push(mentionId);
                }
              } else if (context.options) {
                context.options.mentions = [mentionId];
              }
            }
          }
        }

        const singleMentionMatches = text.match(/{singleMention}/g);
        if (singleMentionMatches) {
          // Todos pela mesma
          const { mentionId, mentionName, mentionContact } = await replaceMention();
          for (let i = 0; i < singleMentionMatches.length; i++) {
            // Substitui apenas a primeira ocorrência restante
            text = text.replace(/{singleMention}/, mentionName);
          }
          // Adiciona à lista de menções para notificação
          if (mentionId) {
            this.logger.debug(`[processContextVariables] SingleMention: ${mentionId}, ${mentionName}`);
            if (context.options && context.options.mentions){
              if (!context.options.mentions.includes(mentionId)) {
                context.options.mentions.push(mentionId);
              }
            } else if (context.options) {
              context.options.mentions = [mentionId];
            }
          }
        }

        const selfMentionMatches = text.match(/{mentionOuEu}/g);
        if (selfMentionMatches) {
          // Todos pela mesma
          const { mentionId, mentionName, mentionContact } = await replaceMention(context.message.author);
          for (let i = 0; i < selfMentionMatches.length; i++) {
            // Substitui apenas a primeira ocorrência restante
            text = text.replace(/{mentionOuEu}/, mentionName);
          }

          // Adiciona à lista de menções para notificação
          if (mentionId) {
            this.logger.debug(`[processContextVariables] mentionOuEu: ${mentionId}, ${mentionName}`);
            if (context.options && context.options.mentions){
              if (!context.options.mentions.includes(mentionId)) {
                context.options.mentions.push(mentionId);
              }
            } else if (context.options) {
              context.options.mentions = [mentionId];
            }
          }
        }


        
      } catch (error) {
        this.logger.error('Erro ao processar variável {mention}:', error);
      }
    }
    
    // Processa variáveis de menções específicas {mention-NUMERO@c.us}
    const mentionMatches = text.matchAll(/{mention-([^}]+)}/g);
    for (const match of Array.from(mentionMatches)) {
      const userIdToMention = match[1];
      
      // Verifica se o ID é válido
      if (userIdToMention && userIdToMention.includes('@')) {
        // Se estamos em um contexto de grupo e temos acesso ao bot
        if (context.group && context.bot) {
          try {
            // Obtém informações do contato
            const contact = await context.bot.client.getContactById(userIdToMention);
            const contactName = contact.number || contact.pushname || contact.name || userIdToMention;
            
            // Adiciona à lista de menções para notificação
            if (context.options && context.options.mentions) {
              context.options.mentions.push(userIdToMention);
            } else if (context.options) {
              context.options.mentions = [userIdToMention];
            }
            
            // Substitui a variável apenas pelo nome (a menção será processada pelo WhatsApp)
            text = text.replace(match[0], `@${contactName}`);
          } catch (error) {
            this.logger.error(`Erro ao processar menção para ${userIdToMention}:`, error);
            // Mantém a string original em caso de erro
            text = text.replace(match[0], `@${userIdToMention.split('@')[0]}`);
          }
        } else {
          // Substitui por uma versão básica se não temos acesso ao bot
          text = text.replace(match[0], `@${userIdToMention.split('@')[0]}`);
        }
      } else {
        // Remove a variável inválida
        text = text.replace(match[0], '');
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


  async processRedditVariable(text, context) {
    // A regex agora busca por {reddit-xxx} dentro do texto recebido
    const regex = /\{reddit-(.+?)\}/;
    const match = text.match(regex);

    // Se a variável não for encontrada, retorna o texto original para continuar o processamento.
    if (!match) {
        return { type: 'text', text: text };
    }

    const fullVariable = match[0]; // Ex: "{reddit-memes-funny-coolthings}"
    
    // Separa os subreddits especificados pelo caractere '-'
    const subredditOptions = match[1].split('-'); // Ex: ['memes', 'funny', 'coolthings']
    
    // Escolhe um subreddit aleatório da lista fornecida
    const subreddit = subredditOptions[Math.floor(Math.random() * subredditOptions.length)];


    try {
        // 1. Busca os posts mais recentes via API do Reddit
        const response = await axios.get(`https://www.reddit.com/r/${subreddit}/new.json?limit=100`);
        const posts = response?.data?.data?.children;

        if (!posts || posts.length === 0) {
            const newText = text.replace(fullVariable, `Subreddit r/${subreddit} não foi encontrado ou não possui posts.`);
            return { type: 'text', text: newText };
        }

        // 2. Gerencia o cache global
        const groupId = context.group;
        if (!this.redditCache[groupId]) this.redditCache[groupId] = {};
        if (!this.redditCache[groupId][subreddit]) this.redditCache[groupId][subreddit] = [];

        // 3. Filtra posts fixados e já enviados
        let availablePosts = posts
            .filter(p => !p.data.stickied)
            .filter(p => !this.redditCache[groupId][subreddit].includes(p.data.id));

        // 4. Se todos os posts já foram vistos, reseta o cache
        if (availablePosts.length === 0 && posts.filter(p => !p.data.stickied).length > 0) {
            this.redditCache[groupId][subreddit] = [];
            availablePosts = posts.filter(p => !p.data.stickied);
        }

        // 5. Separa e seleciona a mídia com base na prioridade (Imagem > GIF > Vídeo)
        const images = [], gifs = [], videos = [];
        for (const post of availablePosts) {
            const { data } = post;
            const url = data.url_overridden_by_dest;
            const hint = data.post_hint;
            if (!url) continue;

            if (hint === 'image' && (url.endsWith('.jpg') || url.endsWith('.png'))) images.push(post);
            else if (hint === 'image' && (url.endsWith('.gif') || url.endsWith('.gifv'))) gifs.push(post);
            else if ((data.is_video || hint === 'hosted:video') && data?.media?.reddit_video?.fallback_url) {
                videos.push(post);
            }
        }
        
        const selectRandom = (arr) => arr.length > 0 ? arr[Math.floor(Math.random() * arr.length)] : null;
        let selectedPost, mediaUrl, mediaType;

        if (selectedPost = selectRandom(images)) {
            mediaUrl = selectedPost.data.url_overridden_by_dest;
            mediaType = 'image';
        } else if (selectedPost = selectRandom(gifs)) {
            mediaUrl = selectedPost.data.url_overridden_by_dest;
            mediaType = 'image';
        } else if (selectedPost = selectRandom(videos)) {
            mediaUrl = selectedPost.data.media.reddit_video.fallback_url;
            mediaType = 'video';
        }
        


        // 6. Cria o MessageMedia e retorna o payload
        if (selectedPost && mediaUrl && mediaType) {
            const media = await context.bot.createMediaFromURL(mediaUrl);

            // Hijack as options pra fazer legenda
            context.options.caption = `🖼️ [${selectedPost.data.subreddit_name_prefixed}] _${selectedPost.data.title}_
> ${selectedPost.data.ups} 👍 ${selectedPost.data.downs} 👎
> reddit.com/${selectedPost.data.permalink}`; // > reddit.com/u/${selectedPost.data.author

            if (media) {
                this.redditCache[groupId][subreddit].push(selectedPost.data.id);                
                // Retorna um tipo 'media' para indicar que a mensagem inteira deve ser este anexo
                return { type: 'media', payload: media };
            }
        }
        
        // Se nenhuma mídia foi encontrada ou a criação do MessageMedia falhou
        const errorText = `Nenhuma mídia (imagem/gif/vídeo) recente encontrada em r/${subreddit}.`;
        return { type: 'text', text: text.replace(fullVariable, errorText) };

    } catch (error) {
        console.error(`[RedditVariable] Erro ao processar r/${subreddit}:`, error.message);
        const errorText = `Subreddit r/${subreddit} não foi encontrado.`;
        return { type: 'text', text: text.replace(fullVariable, errorText) };
    }
  }
}

module.exports = CustomVariableProcessor;