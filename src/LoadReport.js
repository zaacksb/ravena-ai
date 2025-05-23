const Database = require('./utils/Database');
const Logger = require('./utils/Logger');

/**
 * Rastreia carga de mensagens e gera relatórios
 */
class LoadReport {
  /**
   * Cria uma nova instância do LoadReport
   * @param {WhatsAppBot} bot - A instância do bot
   */
  constructor(bot) {
    this.bot = bot;
    this.logger = new Logger(`load-report-${bot.id}`);
    this.database = Database.getInstance();
    this.stats = {
      receivedPrivate: 0,
      receivedGroup: 0,
      sentPrivate: 0,
      sentGroup: 0,
      groups: {},
      responseTimes: [], // Array para armazenar todos os tempos de resposta
      totalResponseTime: 0, // Soma total para cálculo de média
      maxResponseTime: 0, // Valor máximo de tempo de resposta
      timestamp: Date.now()
    };
    
    // Configura intervalo para relatório (a cada 10 minutos)
    this.reportInterval = setInterval(() => this.generateReport(), 10 * 60 * 1000);
  }

  /**
   * Rastreia mensagem recebida
   * @param {boolean} isGroup - Se a mensagem foi em um grupo
   * @param {number} responseTime - Tempo de resposta em segundos
   */
  trackReceivedMessage(isGroup, responseTime = 0, msgFrom = "123@c.us") {
    if (isGroup) {
      this.stats.receivedGroup++;

      if(!this.stats.groups[msgFrom]){
        this.stats.groups[msgFrom] = 1;
      } else {
        this.stats.groups[msgFrom]++;
      }

    } else {
      this.stats.receivedPrivate++;
    }
    
    // Rastreia tempo de resposta
    if (responseTime > 0) {
      this.stats.responseTimes.push(responseTime);
      this.stats.totalResponseTime += responseTime;
      
      // Atualiza o tempo máximo de resposta se necessário
      if (responseTime > this.stats.maxResponseTime) {
        this.stats.maxResponseTime = responseTime;
      }
    }
  }

  /**
   * Rastreia mensagem enviada
   * @param {boolean} isGroup - Se a mensagem foi em um grupo
   */
  trackSentMessage(isGroup) {
    if (isGroup) {
      this.stats.sentGroup++;
    } else {
      this.stats.sentPrivate++;
    }
  }

  /**
   * Gera e salva um relatório de carga
   */
  async generateReport() {
    try {
      const currentTime = Date.now();
      
      // Calcula média de tempo de resposta
      const responseTimeCount = this.stats.responseTimes.length;
      const avgResponseTime = responseTimeCount > 0 
        ? this.stats.totalResponseTime / responseTimeCount 
        : 0;

      //this.logger.debug(`[generateReport] ${JSON.striginfy(this.stats)}`);
      
      const report = {
        botId: this.bot.id,
        period: {
          start: this.stats.timestamp,
          end: currentTime
        },
        duration: Math.floor((currentTime - this.stats.timestamp) / 1000), // em segundos
        messages: {
          receivedPrivate: this.stats.receivedPrivate,
          receivedGroup: this.stats.receivedGroup,
          sentPrivate: this.stats.sentPrivate,
          sentGroup: this.stats.sentGroup,
          totalReceived: this.stats.receivedPrivate + this.stats.receivedGroup,
          totalSent: this.stats.sentPrivate + this.stats.sentGroup,
        },
        // Adiciona informações de tempo de resposta ao relatório
        responseTime: {
          average: avgResponseTime.toFixed(2), // Média em segundos, com 2 casas decimais
          max: this.stats.maxResponseTime,     // Valor máximo em segundos
          count: responseTimeCount             // Quantidade de medições
        },
        // Adiciona informações por grupo
        groups: this.stats.groups ?? {},
        timestamp: currentTime // Adicionamos um timestamp para facilitar filtros
      };
      report.messages.messagesPerHour = Math.floor((report.messages.totalReceived + report.messages.totalSent) / (report.duration / 3600));

      // Salva relatório no banco de dados
      await this.saveReport(report);
      
      try {
        // Obtém emoji de carga com base em msgs/h
        const loadLevels = ["⬜", "🟩", "🟨", "🟧", "🟥", "⬛"];
        let loadEmoji = loadLevels[0];
        
        if (report.messages.messagesPerHour > 100) loadEmoji = loadLevels[1];
        if (report.messages.messagesPerHour > 500) loadEmoji = loadLevels[2]; 
        if (report.messages.messagesPerHour > 1000) loadEmoji = loadLevels[3];
        if (report.messages.messagesPerHour > 1500) loadEmoji = loadLevels[4];
        if (report.messages.messagesPerHour > 2000) loadEmoji = loadLevels[5];
        
        // Formata data para status
        const now = new Date();
        const dateString = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}`;
        const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
        
        // Constrói string de status com informação de atraso médio
        const status = `${loadEmoji} ${dateString} ${timeString} | ${report.messages.messagesPerHour}msg/h | delay: ${avgResponseTime.toFixed(1)}s | !cmd, !info | ravena.moothz.win`;
        
        // Atualiza status do bot
        if (this.bot.client && this.bot.isConnected) {
          await this.bot.client.setStatus(status);
          this.logger.info(`Status do bot atualizado: ${status}`);
        }
      } catch (statusError) {
        this.logger.error('Erro ao atualizar status do bot:', statusError);
      }
      
      // Envia relatório para o grupo de logs se configurado
      if (this.bot.grupoEstabilidade) {
        try {
          const reportMessage = this.formatReportMessage(report);
          this.logger.info(reportMessage);
          await this.bot.sendMessage(this.bot.grupoEstabilidade, reportMessage);
        } catch (error) {
          this.logger.error('Erro ao enviar relatório de carga para o grupo de estatbilidade:', error);
        }
      }

      // Reseta estatísticas para o próximo período
      this.stats = {
        receivedPrivate: 0,
        receivedGroup: 0,
        sentPrivate: 0,
        sentGroup: 0,
        groups: {},
        responseTimes: [],
        totalResponseTime: 0,
        maxResponseTime: 0,
        timestamp: currentTime
      };
    } catch (error) {
      this.logger.error('Erro ao gerar relatório de carga:', error);
    }
  }

  /**
   * Formata relatório como uma mensagem legível
   * @param {Object} report - O objeto do relatório
   * @returns {string} - Mensagem formatada
   */
  formatReportMessage(report) {
    const startDate = new Date(report.period.start).toLocaleString("pt-BR");
    const endDate = new Date(report.period.end).toLocaleString("pt-BR");
    const durationMinutes = Math.floor(report.duration / 60);
    const rndString = (Math.random() + 1).toString(36).substring(7);

    return `📊 *LoadReport para ${this.bot.id}* - ${startDate}~${endDate} (${rndString}}\n\n` +
           `📥 *Mensagens:*\n` +
           `- Mensagens/h: ${report.messages.messagesPerHour}\n`+
           `- Recebidas: ${report.messages.totalReceived} (${report.messages.receivedPrivate} pv/${report.messages.receivedGroup} gp)\n`+
           `- Enviadas: ${report.messages.totalSent} (${report.messages.sentPrivate} pv/${report.messages.sentGroup} gp)\n\n`+
           `⏱️ *Tempo de Resposta:*\n` +
           `- Média: ${report.responseTime.average}s\n` +
           `- Máximo: ${report.responseTime.max}s\n` +
           `- Medições: ${report.responseTime.count}\n\n${rndString}`;
  }

  /**
   * Salva relatório no banco de dados
   * @param {Object} report - O relatório a salvar
   */
  async saveReport(report) {
    try {
      // Obtém relatórios existentes
      let reports = await this.database.getLoadReports() || [];
      
      // Adiciona novo relatório
      reports.push(report);
      
      // Limita o tamanho da coleção para evitar arquivos muito grandes
      // Mantém apenas os últimos 90 dias de relatórios (aproximadamente)
      const ninetyDaysAgo = Date.now() - (90 * 24 * 60 * 60 * 1000);
      reports = reports.filter(r => r.timestamp && r.timestamp > ninetyDaysAgo);
      
      // Salva no banco de dados
      await this.database.saveLoadReports(reports);
      
      this.logger.debug('Relatório de carga salvo com sucesso');
    } catch (error) {
      this.logger.error('Erro ao salvar relatório de carga:', error);
    }
  }

  /**
   * Limpa recursos
   */
  destroy() {
    if (this.reportInterval) {
      clearInterval(this.reportInterval);
      this.reportInterval = null;
    }
  }
}

module.exports = LoadReport;