// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

const WhatsAppBot = require('./src/WhatsAppBot');
const EventHandler = require('./src/EventHandler');
const Logger = require('./src/utils/Logger');
const BotAPI = require('./src/BotAPI');
const MentionHandler = require('./src/MentionHandler');
const LoadReport = require('./src/LoadReport');
const InviteSystem = require('./src/InviteSystem');

/**
 * Exemplo de criação de múltiplas instâncias de bot
 */
async function main() {
  const logger = new Logger('main');
  let botInstances = [];
  
  try {
    // Cria manipulador de eventos compartilhado
    const eventHandler = new EventHandler();
    
    // Configurações do puppeteer
    const chromePath = process.env.CHROME_PATH || '';
    const headlessMode = process.env.HEADLESS_MODE !== 'false'; // Padrão: true
    
    logger.info(`Configuração de Chrome: Path=${chromePath || 'padrão'}, Headless=${headlessMode}`);
    
    // Cria primeira instância do bot
    const ravenaTestes = new WhatsAppBot({
      id: 'ravena-testes',
      phoneNumber: '555596424307', // Número de telefone para solicitar código de pareamento
      eventHandler: eventHandler,
      prefix: process.env.DEFAULT_PREFIX || '!',
      // Configurações de puppeteer
      puppeteerOptions: {
        executablePath: chromePath || undefined,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-extensions', 
          '--disable-gpu', 
          '--disable-accelerated-2d-canvas', 
          '--no-first-run', 
          '--no-zygote', 
          '--disable-dev-shm-usage'
        ],
        headless: headlessMode
      },
      // IDs dos grupos para notificações da comunidade
      grupoLogs: process.env.GRUPO_LOGS,
      grupoInvites: process.env.GRUPO_INVITES,
      grupoAvisos: process.env.GRUPO_AVISOS,
      grupoInteracao: process.env.GRUPO_INTERACAO,
      linkGrupao: process.env.LINK_GRUPO_INTERACAO,
      linkAvisos: process.env.LINK_GRUPO_AVISOS
    });
    
    botInstances.push(ravenaTestes);
    
    // Inicializa e inicia os bots
    await ravenaTestes.initialize();
    
    logger.info('Todos os bots inicializados e rodando');
    
    // Inicializa servidor da API
    const botAPI = new BotAPI({
      port: process.env.API_PORT || 5000,
      bots: botInstances
    });
    
    // Inicia servidor da API
    await botAPI.start();
    logger.info('Servidor API iniciado');
    
    // Manipula encerramento do programa
    process.on('SIGINT', async () => {
      logger.info('Desligando bots e servidor API...');
      
      // Para o servidor API primeiro
      await botAPI.stop();
      
      // Destrói todas as instâncias de bot
      for (const bot of botInstances) {
        await bot.destroy();
      }
      
      process.exit(0);
    });
    
  } catch (error) {
    logger.error('Erro no processo principal:', error);
    process.exit(1);
  }

  // Manipula encerramento do programa - modificar para esta versão:
  process.on('SIGINT', async () => {
    logger.info('Desligando bots e servidor API (SIGINT)...');
    
    // Força a persistência de dados do banco de dados
    await Database.getInstance().forcePersist();
    
    // Para o servidor API primeiro
    await botAPI.stop();
    
    // Destrói todas as instâncias de bot com timeout
    const promises = [];
    for (const bot of botInstances) {
      promises.push(
        // Adiciona um timeout para garantir que o processo não fique preso indefinidamente
        Promise.race([
          bot.destroy(),
          new Promise(resolve => setTimeout(() => {
            logger.warn(`Timeout ao destruir bot ${bot.id}`);
            resolve();
          }, 5000))
        ])
      );
    }
    
    await Promise.all(promises);
    logger.info('Todos os bots destruídos com sucesso. Encerrando...');
    
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    logger.info('Desligando bots e servidor API (SIGTERM)...');
    
    // Força a persistência de dados do banco de dados
    await Database.getInstance().forcePersist();
    
    // Para o servidor API primeiro
    await botAPI.stop();
    
    // Destrói todas as instâncias de bot com timeout
    const promises = [];
    for (const bot of botInstances) {
      promises.push(
        // Adiciona um timeout para garantir que o processo não fique preso indefinidamente
        Promise.race([
          bot.destroy(),
          new Promise(resolve => setTimeout(() => {
            logger.warn(`Timeout ao destruir bot ${bot.id}`);
            resolve();
          }, 5000))
        ])
      );
    }
    
    await Promise.all(promises);
    logger.info('Todos os bots destruídos com sucesso. Encerrando...');
    
    process.exit(0);
  });
}


// Executa a função principal
main().catch(console.error);