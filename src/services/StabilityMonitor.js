const Logger = require('../utils/Logger');

/**
 * Serviço para monitorar estabilidade das ravenas
 */
class StabilityMonitor {
  constructor(config = {}) {
    this.logger = new Logger('stability-monitor');
    this.instances = config.instances || [];
    this.history = {};
    this.restartHistory = {};

    setTimeout((is) => {
      this.logger.info(`[StabilityMonitor] Inicializado monitorando ${is.length} bots: ${is.map(i => i.id).join(", ")}`);
    }, 15000, this.instances);
    setInterval(this.checkStability, 5 * 60 * 1000);
  }

  getCurrentTimestamp(){
    return Math.round(+new Date()/1000);
  }

  // Recebe direto do eventHandler, então msg é um objeto do whatsapp
  async registerBotMessage(msg) {
    if(msg.from.includes("@g")){ // Só considera mensagens de grupo, elas não vão se comunicar no PV
      let author = msg.author;
      if(!author){ 
        this.logger.info(`[registerBotMessage] Msg não tinha author, pegando contato`)
        const sender = await msg.getContact();
        author = sender.id._serialized;
      }

      // Sistema de estabilidade onde as ravenas monitoram as outras ravenas
      for(let bIns of this.instances){
        if(author.includes(bIns.phoneNumber)){
          // Recebi mensagem de algum bot
          this.logger.info(`[registerBotMessage] Detectada mensagem de ${bIns.id} (${bIns.phoneNumber})`);
          this.history[bIns.id] = this.getCurrentTimestamp();
        }
      }
    }
  }

  checkStability(){
    const currentTs = this.getCurrentTimestamp();

    for(let bIns of this.instances){
      const dif = (currentTs - this.history[bIns.id]);

      this.logger.info(`[checkStability] ${bIns.id}: ${dif}s`);

      // Os bots enviam mensagem de loadReport a cada 10 minutos
      // então é o tempo limite pra não ver msgs uma das outras
      if(dif > 660){ // 11 Minutos
        this.logger.warn(`[checkStability] ${bIns.id}: DELAY ELEVADO! (${dif}s) Reiniciando.`)
        bIns.restartBot(`O delay está elevado (${responseTime}s), por isso o bot será reiniciado.`).catch(err => this.logger.error(`Erro ao reiniciar bot ${bIns.id} por delay elevado:`, err));
        this.restartHistory = currentTs;
        this.history = currentTs + 60 * 5; // Pra evitar que seja reiniciado novamente, adiciona 5 minutos no tempo
      }
    }
  }

}

module.exports = StabilityMonitor;