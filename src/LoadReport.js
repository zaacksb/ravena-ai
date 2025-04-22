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
      timestamp: Date.now()
    };
    
    // Configura intervalo para relatório (a cada 10 minutos)
    this.reportInterval = setInterval(() => this.generateReport(), 10 * 60 * 1000);
  }

  /**
   * Rastreia mensagem recebida
   * @param {boolean} isGroup - Se a mensagem foi em um grupo
   */
  trackReceivedMessage(isGroup) {
    if (isGroup) {
      this.stats.receivedGroup++;
    } else {
      this.stats.receivedPrivate++;
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
        }
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
        
        // Constrói string de status
        const status = `${loadEmoji} ${dateString} ${timeString} | ${report.messages.messagesPerHour}msg/h | !cmd, !info | ravena.moothz.win`;
        
        // Atualiza status do bot
        if (this.bot.client && this.bot.isConnected) {
          await this.bot.client.setStatus(status);
          this.logger.info(`Status do bot atualizado: ${status}`);
        }
      } catch (statusError) {
        this.logger.error('Erro ao atualizar status do bot:', statusError);
      }
      
      // Envia relatório para o grupo de logs se configurado
      if (this.bot.grupoLogs) {
        try {
          const reportMessage = this.formatReportMessage(report);
          await this.bot.sendMessage(this.bot.grupoLogs, reportMessage);
        } catch (error) {
          this.logger.error('Erro ao enviar relatório de carga para o grupo de logs:', error);
        }
      }

      // Reseta estatísticas para o próximo período
      this.stats = {
        receivedPrivate: 0,
        receivedGroup: 0,
        sentPrivate: 0,
        sentGroup: 0,
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
    const startDate = new Date(report.period.start).toLocaleString();
    const endDate = new Date(report.period.end).toLocaleString();
    const durationMinutes = Math.floor(report.duration / 60);
    
    return `📊 *Relatório de Carga para ${this.bot.id}* - ${startDate}~${endDate}\n\n` +
           `📥 *Mensagens:*\n` +
           `- Recebidas: ${report.messages.totalSent} (${report.messages.sentPrivate} pv/${report.messages.sentGroup} gp)\n`+
           `- Enviadas: ${report.messages.totalReceived} (${report.messages.receivedPrivate} pv/${report.messages.receivedGroup} gp)`;
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