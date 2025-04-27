const express = require('express');
const bodyParser = require('body-parser');
const Logger = require('./utils/Logger');
const Database = require('./utils/Database');
const path = require('path');

/**
 * Servidor API para o bot WhatsApp
 */
class BotAPI {
  /**
   * Cria um novo servidor API
   * @param {Object} options - Opções de configuração
   * @param {number} options.port - Porta para escutar
   * @param {Array} options.bots - Array de instâncias de WhatsAppBot
   */
  constructor(options = {}) {
    this.port = options.port || process.env.API_PORT || 5000;
    this.bots = options.bots || [];
    this.logger = new Logger('bot-api');
    this.database = Database.getInstance();
    this.app = express();

    // Credenciais de autenticação para endpoints protegidos
    this.apiUser = process.env.BOTAPI_USER || 'admin';
    this.apiPassword = process.env.BOTAPI_PASSWORD || 'senha12345';
    
    // Configura middlewares
    this.app.use(bodyParser.json());
    this.app.use(bodyParser.urlencoded({ extended: true }));
    this.app.use(express.static(path.join(__dirname, '../public')));
    
    // Configura rotas
    this.setupRoutes();
  }

  /**
   * Configura rotas da API
   */
  setupRoutes() {
    // Endpoint de verificação de saúde
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        bots: this.bots.map(bot => ({
          id: bot.id,
          phoneNumber: bot.phoneNumber,
          connected: bot.isConnected,
          lastMessageReceived: bot.lastMessageReceived || null
        }))
      });
    });
    
    // Middleware de autenticação básica
    const authenticateBasic = (req, res, next) => {
      // Verifica se os cabeçalhos de autenticação existem
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        res.set('WWW-Authenticate', 'Basic realm="RavenaBot API"');
        return res.status(401).json({
          status: 'error',
          message: 'Autenticação requerida'
        });
      }
      
      // Decodifica e verifica credenciais
      try {
        // O formato é 'Basic <base64 encoded username:password>'
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
        const [username, password] = credentials.split(':');
        
        if (username === this.apiUser && password === this.apiPassword) {
          return next();
        }
      } catch (error) {
        this.logger.error('Erro ao processar autenticação básica:', error);
      }
      
      // Credenciais inválidas
      res.set('WWW-Authenticate', 'Basic realm="RavenaBot API"');
      return res.status(401).json({
        status: 'error',
        message: 'Credenciais inválidas'
      });
    };
    
    // Novo endpoint para reiniciar um bot específico (requer autenticação)
    this.app.post('/restart/:botId', authenticateBasic, async (req, res) => {
      try {
        // Obter parâmetros
        const { botId } = req.params;
        const { reason } = req.body || {};
        
        // Validar parâmetros
        if (!botId) {
          return res.status(400).json({
            status: 'error',
            message: 'ID do bot não especificado'
          });
        }
        
        // Encontrar o bot solicitado
        const bot = this.bots.find(b => b.id === botId);
        if (!bot) {
          return res.status(404).json({
            status: 'error',
            message: `Bot com ID '${botId}' não encontrado`
          });
        }
        
        // Verificar se o método de reinicialização está disponível
        if (typeof bot.restartBot !== 'function') {
          return res.status(400).json({
            status: 'error',
            message: `Bot '${botId}' não suporta reinicialização`
          });
        }
        
        // Iniciar reinicialização em modo assíncrono
        const restartReason = reason || `Reinicialização via API em ${new Date().toLocaleString("pt-BR")}`;
        
        // Responder imediatamente ao cliente
        res.json({
          status: 'ok',
          message: `Reiniciando bot '${botId}'`,
          timestamp: Date.now()
        });
        
        // Executar reinicialização em segundo plano
        setTimeout(async () => {
          try {
            this.logger.info(`Reiniciando bot ${botId} via endpoint API`);
            await bot.restartBot(restartReason);
            this.logger.info(`Bot ${botId} reiniciado com sucesso via API`);
          } catch (error) {
            this.logger.error(`Erro ao reiniciar bot ${botId} via API:`, error);
          }
        }, 500);
      } catch (error) {
        this.logger.error('Erro no endpoint de reinicialização:', error);
        res.status(500).json({
          status: 'error',
          message: 'Erro interno do servidor'
        });
      }
    });
    
    // Webhook de doação do Tipa.ai
    this.app.post('/donate_tipa', async (req, res) => {
      try {
        this.logger.info('Recebido webhook de doação do Tipa.ai');
        
        // Registra a requisição completa para depuração
        const donateData = {
          headers: req.headers,
          body: req.body
        };
        
        this.logger.debug('Dados da doação:', donateData);
        
        // Verifica o segredo do webhook
        const headerTipa = req.headers["x-tipa-webhook-secret-token"] || false;
        const expectedToken = process.env.TIPA_TOKEN;
        
        if (!headerTipa || headerTipa !== expectedToken) {
          this.logger.warn('Token webhook inválido:', headerTipa);
          return res.status(403).send('-');
        }
        
        // Extrai detalhes da doação
        const nome = req.body.payload.tip.name || "Alguém";
        const valor = parseFloat(req.body.payload.tip.amount) || 0;
        const msg = req.body.payload.tip.message || "";
        
        if (valor <= 0) {
          this.logger.warn(`Valor de doação inválido: ${valor}`);
          return res.send('ok');
        }
        
        // Adiciona doação ao banco de dados
        await this.database.addDonation(nome, valor);
        
        // Notifica grupos sobre a doação
        await this.notifyGroupsAboutDonation(nome, valor, msg);
        
        res.send('ok');
      } catch (error) {
        this.logger.error('Erro ao processar webhook de doação:', error);
        res.status(500).send('error');
      }
    });
    
    // Endpoint para obter relatórios de carga
    this.app.post('/getLoad', async (req, res) => {
      try {
        const { timestamp } = req.body;
        
        if (!timestamp || isNaN(parseInt(timestamp))) {
          return res.status(400).json({
            status: 'error',
            message: 'Timestamp inválido ou ausente'
          });
        }
        
        // Obtém relatórios de carga após o timestamp especificado
        const reports = await this.database.getLoadReports(parseInt(timestamp));
        
        res.json({
          status: 'ok',
          timestamp: Date.now(),
          reports
        });
      } catch (error) {
        this.logger.error('Erro ao obter relatórios de carga:', error);
        res.status(500).json({
          status: 'error',
          message: 'Erro interno do servidor'
        });
      }
    });
  }

  /**
   * Notifica grupos sobre uma doação
   * @param {string} name - Nome do doador
   * @param {number} amount - Valor da doação
   * @param {string} message - Mensagem da doação
   */
  async notifyGroupsAboutDonation(name, amount, message) {
    try {
      // Prepara a mensagem de notificação
      const donationMsg = 
        `💸 Recebemos um DONATE no tipa.ai! 🥳\n\n` +
        `*MUITO obrigado* pelos R$${amount.toFixed(2)}, ${name}! 🥰\n` +
        `Compartilho aqui com todos sua mensagem:\n` +
        `💬 ${message}\n\n` +
        `\`\`\`!doar ou !donate pra conhecer os outros apoiadores e doar também\`\`\``;
      
      // Calcula tempo extra de fixação com base no valor da doação (300 segundos por 1 unidade de moeda)
      const extraPinTime = Math.floor(amount * 300);
      const pinDuration = 600 + extraPinTime; // Base de 10 minutos + tempo extra
      
      // Envia para todos os bots e grupos configurados
      for (const bot of this.bots) {
        // Primeiro notifica o grupo de logs
        if (bot.grupoLogs) {
          try {
            await bot.sendMessage(bot.grupoLogs, donationMsg);
          } catch (error) {
            this.logger.error(`Erro ao enviar notificação de doação para grupoLogs (${bot.grupoLogs}):`, error);
          }
        }
        
        // Notifica o grupo de avisos
        if (bot.grupoAvisos) {
          try {
            const sentMsg = await bot.sendMessage(bot.grupoAvisos, donationMsg);
            
            // Tenta fixar a mensagem
            try {
              if (sentMsg && sentMsg.pin) {
                await sentMsg.pin(pinDuration);
              }
            } catch (pinError) {
              this.logger.error('Erro ao fixar mensagem no grupoAvisos:', pinError);
            }
          } catch (error) {
            this.logger.error(`Erro ao enviar notificação de doação para grupoAvisos (${bot.grupoAvisos}):`, error);
          }
        }
        
        // Notifica o grupo de interação
        if (bot.grupoInteracao) {
          try {
            const sentMsg = await bot.sendMessage(bot.grupoInteracao, donationMsg);
            
            // Tenta fixar a mensagem
            try {
              if (sentMsg && sentMsg.pin) {
                await sentMsg.pin(pinDuration);
              }
            } catch (pinError) {
              this.logger.error('Erro ao fixar mensagem no grupoInteracao:', pinError);
            }
          } catch (error) {
            this.logger.error(`Erro ao enviar notificação de doação para grupoInteracao (${bot.grupoInteracao}):`, error);
          }
        }
      }
    } catch (error) {
      this.logger.error('Erro ao notificar grupos sobre doação:', error);
    }
  }

  /**
   * Inicia o servidor API
   */
  start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.port, () => {
          this.logger.info(`Servidor API escutando na porta ${this.port}`);
          resolve();
        });
      } catch (error) {
        this.logger.error('Erro ao iniciar servidor API:', error);
        reject(error);
      }
    });
  }

  /**
   * Para o servidor API
   */
  stop() {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }
      
      try {
        this.server.close(() => {
          this.logger.info('Servidor API parado');
          this.server = null;
          resolve();
        });
      } catch (error) {
        this.logger.error('Erro ao parar servidor API:', error);
        reject(error);
      }
    });
  }

  /**
   * Adiciona uma instância de bot à API
   * @param {WhatsAppBot} bot - A instância do bot a adicionar
   */
  addBot(bot) {
    if (!this.bots.includes(bot)) {
      this.bots.push(bot);
    }
  }

  /**
   * Remove uma instância de bot da API
   * @param {WhatsAppBot} bot - A instância do bot a remover
   */
  removeBot(bot) {
    const index = this.bots.indexOf(bot);
    if (index !== -1) {
      this.bots.splice(index, 1);
    }
  }
}

module.exports = BotAPI;