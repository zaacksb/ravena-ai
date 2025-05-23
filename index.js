// Carrega variáveis de ambiente do arquivo .env
require('dotenv').config();

const WhatsAppBot = require('./src/WhatsAppBot');
const EventHandler = require('./src/EventHandler');
const Logger = require('./src/utils/Logger');
const BotAPI = require('./src/BotAPI');
const StabilityMonitor = require('./src/services/StabilityMonitor');
const fs = require('fs');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Exemplo de criação de múltiplas instâncias de bot
 */
async function main() {
  const logger = new Logger('main');
  let botInstances = [];
  
  try {

    // Cria manipulador de eventos compartilhado com SingleTon do StabilityMonitor
    const eventHandler = new EventHandler();

    // Monitor de estabilidade também é compartilhado
    const stabilityMonitor = new StabilityMonitor({instances: botInstances})
    
    // Configurações do puppeteer
    const chromePath = process.env.CHROME_PATH || '';
    const headlessMode = process.env.HEADLESS_MODE !== 'false'; // Padrão: true
    
    
    const rBots = JSON.parse(fs.readFileSync("bots.json", 'utf8')) || [];

    if(rBots.length == 0){
      logger.info(`Nenhum bot definido no bots.json.`);
      return;
    } else {
      logger.info(`Inicializando ${rBots.length} bots:\n${JSON.stringify(rBots, null, "\t")}`);
    }

    logger.info(`Configuração de Chrome: Path=${chromePath || 'padrão'}, Headless=${headlessMode}`);

    for(let rBot of rBots){
      const newRBot = new WhatsAppBot({
        id: rBot.nome,
        phoneNumber: rBot.numero, // Número de telefone para solicitar código de pareamento
        eventHandler: eventHandler,
        stabilityMonitor: stabilityMonitor,
        prefix: rBot.customPrefix || process.env.DEFAULT_PREFIX || '!',
        otherBots: rBots.map(rB => rB.numero),
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
            '--disable-dev-shm-usage',
            '--disable-session-crashed-bubble',
            '--start-maximized',
            '--disable-prompt-on-repost',
            '--disable-beforeunload',
            '--disable-features=InfiniteSessionRestore',
            `--window-name=${rBot.nome}`

          ],
          headless: headlessMode
        },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:138.0) Gecko/20100101 Firefox/138.0",
        ignorePV: rBot.ignorePV ?? false,
        ignoreInvites: rBot.ignoreInvites ?? false,
        // IDs dos grupos para notificações da comunidade
        grupoEstabilidade: rBot.grupoEstabilidade ?? process.env.GRUPO_ESTABILIDADE,
        grupoLogs: rBot.grupoLogs ?? process.env.GRUPO_LOGS,
        grupoInvites: rBot.grupoInvites ?? process.env.GRUPO_INVITES,
        grupoAvisos: rBot.grupoAvisos ?? process.env.GRUPO_AVISOS,
        grupoInteracao: rBot.grupoInteracao ?? process.env.GRUPO_INTERACAO,
        linkGrupao: rBot.linkGrupao ?? process.env.LINK_GRUPO_INTERACAO,
        linkAvisos: rBot.linkAvisos ?? process.env.LINK_GRUPO_AVISOS
      });
      
      newRBot.initialize();
      await sleep(500);
      botInstances.push(newRBot);
    }
    
    logger.info('Todos os bots inicializados e rodando');
    
    // Inicializa servidor da API
    const botAPI = new BotAPI({
      port: process.env.API_PORT || 5000,
      bots: botInstances,
      eventHandler: eventHandler
    });
    
    // Inicia servidor da API
    await botAPI.start();
    logger.info('Servidor API iniciado');
    
    // Manipula encerramento do programa
    process.on('SIGINT', async () => {
      logger.info('[SIGINT] Desligando bots e servidor API...');
      
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

  process.on('unhandledRejection', (reason, p) => {
    logger.warn("---- Rejection não tratada ");
    logger.warn(p);
    logger.warn("---- Fim ");
  })

  process.on('uncaughtException', err => {
    logger.error("---- Erro Não tratado ");
    logger.error(err);
    logger.error("---- Fim ");
  });
}


// Executa a função principal
main().catch(console.error);