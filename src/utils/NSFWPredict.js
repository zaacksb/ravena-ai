const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const Logger = require('./Logger');
const crypto = require('crypto');

/**
 * Utilitário para detecção de conteúdo NSFW em imagens
 */
class NSFWPredict {
  constructor() {
    this.logger = new Logger('nsfw-predict');
    this.threshold = parseFloat(process.env.NSFW_THRESHOLD || '0.7');
    this.tempDir = path.join(__dirname, '../../temp');
    
    // Verifica se o diretório temporário existe
    this.ensureTempDirectory();
  }

  /**
   * Verifica se o diretório temporário existe
   */
  ensureTempDirectory() {
    try {
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true });
        this.logger.info(`Diretório temporário criado: ${this.tempDir}`);
      }
    } catch (error) {
      this.logger.error('Erro ao verificar diretório temporário:', error);
    }
  }

  /**
   * Extrai JSON de uma string de saída
   * @param {string} stdout - Output do comando
   * @returns {Object|null} - Objeto JSON extraído ou null se não encontrado
   */
  extractJSON(str){
    var firstOpen, firstClose, candidate;
    firstOpen = str.indexOf('{', firstOpen + 1);
    do {
      firstClose = str.lastIndexOf('}');
      //console.log('firstOpen: ' + firstOpen, 'firstClose: ' + firstClose);
      if(firstClose <= firstOpen) {
        return null;
      }
      do {
        candidate = str.substring(firstOpen, firstClose + 1);
        //console.log('candidate: ' + candidate);
        try {
          var res = JSON.parse(candidate);
          //console.log('...found');
          return [res, firstOpen, firstClose + 1];
        }
        catch(e) {
          //console.log('...failed');
        }
        firstClose = str.substr(0, firstClose).lastIndexOf('}');
      } while(firstClose > firstOpen);
      firstOpen = str.indexOf('{', firstOpen + 1);
    } while(firstOpen != -1);
  }

  /**
   * Gera um nome de arquivo temporário aleatório
   * @param {string} extension - Extensão do arquivo
   * @returns {string} - Caminho completo do arquivo temporário
   */
  generateTempFilePath(extension) {
    const randomId = crypto.randomBytes(8).toString('hex');
    return path.join(this.tempDir, `nsfw-${randomId}.${extension}`);
  }

  /**
   * Apaga um arquivo após um tempo determinado
   * @param {string} filePath - Caminho do arquivo a ser apagado
   * @param {number} delay - Tempo em ms para aguardar antes de apagar (padrão: 1 minuto)
   */
  deleteFileAfterDelay(filePath, delay = 60000) {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          this.logger.debug(`Arquivo temporário removido: ${filePath}`);
        }
      } catch (error) {
        this.logger.error(`Erro ao remover arquivo temporário ${filePath}:`, error);
      }
    }, delay);
  }


  /**
   * Verifica se uma imagem contém conteúdo NSFW
   * @param {string} imagePath - Caminho para o arquivo de imagem
   * @returns {Promise<{isNSFW: boolean, scores: Object}>} - Resultado da detecção
   */
  async detectNSFW(imagePath) {
    this.logger.info(`Detectando NSFW em: ${imagePath}`);
    
    return new Promise((resolve) => {
      try {
        if (!fs.existsSync(imagePath)) {
          this.logger.error(`Arquivo não encontrado: ${imagePath}`);
          resolve({ isNSFW: false, scores: {}, error: 'Arquivo não encontrado' });
          return;
        }

        // Usa a configuração do caminho completo do comando
        const command = `${process.env.NSFW_PREDICT_COMMAND} --saved_model_path "${process.env.NSFW_PREDICT_MODEL}" --image_source "${imagePath}"`;
        this.logger.debug(`Executando comando: ${command}`);
        
        exec(command, (error, stdout, stderr) => {
          if (error) {
            this.logger.error(`Erro ao executar detecção NSFW: ${error.message}`);
            resolve({ isNSFW: false, scores: {}, error: error.message });
            return;
          }
          
          if (stderr) {
            this.logger.warn(`Aviso na detecção NSFW: ${stderr}`);
          }
          
          try {
            // Extrai o JSON da saída
            const output = this.extractJSON(stdout);
            
            if (!output) {
              this.logger.error('Não foi possível extrair JSON da saída');
              resolve({ isNSFW: false, scores: {}, error: 'Falha ao processar saída' });
              return;
            }
            
            // Determina o formato do resultado (array ou objeto direto)
            let resultado;
            if (Array.isArray(output)) {
              resultado = Object.values(output[0])[0];
            } else {
              resultado = output[imagePath] ?? output;
            }
            
            // Verifica se alguma das categorias NSFW está acima do limiar
            const isNSFW = (resultado.porn >= this.threshold || 
                           resultado.sexy >= this.threshold || 
                           resultado.hentai >= this.threshold) && 
                           resultado.neutral < 0.5;
            
            this.logger.info(`Detecção NSFW para ${imagePath}: ${isNSFW ? 'NSFW' : 'Seguro'}`);
            this.logger.debug('Scores:', resultado);
            
            resolve({ isNSFW, scores: resultado });
          } catch (parseError) {
            this.logger.error('Erro ao analisar resultado da detecção NSFW:', parseError);
            this.logger.debug('Saída do comando:', stdout);
            resolve({ isNSFW: false, scores: {}, error: 'Erro ao analisar resultado' });
          }
        });
      } catch (error) {
        this.logger.error('Erro ao executar detecção NSFW:', error);
        resolve({ isNSFW: false, scores: {}, error: error.message });
      }
    });
  }

  /**
   * Detecta NSFW em um objeto MessageMedia da biblioteca whatsapp-web.js
   * @param {Object} messageMedia - Objeto MessageMedia com dados, mimetype e filename
   * @returns {Promise<{isNSFW: boolean, scores: Object}>} - Resultado da detecção
   */
  async detectNSFWFromMessageMedia(messageMedia) {
    try {
      if (!messageMedia || !messageMedia.data || !messageMedia.mimetype) {
        this.logger.error('MessageMedia inválido fornecido');
        return { isNSFW: false, scores: {}, error: 'MessageMedia inválido' };
      }
      
      // Extrai extensão do mimetype
      const extension = messageMedia.mimetype.split('/').pop();
      
      // Gera caminho para arquivo temporário
      const tempFilePath = this.generateTempFilePath(extension);
      
      // Decodifica dados base64 e salva em arquivo temporário
      const buffer = Buffer.from(messageMedia.data, 'base64');
      fs.writeFileSync(tempFilePath, buffer);
      
      this.logger.info(`Arquivo temporário criado: ${tempFilePath}`);
      
      // Executa detecção NSFW no arquivo temporário
      const result = await this.detectNSFW(tempFilePath);
      
      // Agenda a remoção do arquivo temporário
      this.deleteFileAfterDelay(tempFilePath);
      
      return result;
    } catch (error) {
      this.logger.error('Erro ao processar MessageMedia para detecção NSFW:', error);
      return { isNSFW: false, scores: {}, error: error.message };
    }
  }

  /**
   * Obtém uma instância singleton da classe
   * @returns {NSFWPredict} - Instância da classe
   */
  static getInstance() {
    if (!NSFWPredict.instance) {
      NSFWPredict.instance = new NSFWPredict();
    }
    return NSFWPredict.instance;
  }
}

module.exports = NSFWPredict;