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
          totalSent: this.stats.sentPrivate + this.stats.sentGroup
        }
      };

      // Salva relatório no banco de dados
      await this.saveReport(report);
      
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
    
    return `📊 *Relatório de Carga para ${this.bot.id}*\n\n` +
           `⏱️ Período: ${startDate} até ${endDate}\n` +
           `⌛ Duração: ${durationMinutes} minutos\n\n` +
           `📥 *Mensagens Recebidas:*\n` +
           `- Privadas: ${report.messages.receivedPrivate}\n` +
           `- Grupos: ${report.messages.receivedGroup}\n` +
           `- Total: ${report.messages.totalReceived}\n\n` +
           `📤 *Mensagens Enviadas:*\n` +
           `- Privadas: ${report.messages.sentPrivate}\n` +
           `- Grupos: ${report.messages.sentGroup}\n` +
           `- Total: ${report.messages.totalSent}`;
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