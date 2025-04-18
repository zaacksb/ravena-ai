const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const Logger = require('./Logger');

/**
 * Utilitário para detecção de conteúdo NSFW em imagens
 */
class NSFWPredict {
  constructor() {
    this.logger = new Logger('nsfw-predict');
    this.pythonPath = process.env.PYTHON_PATH || 'python3';
    this.nsfwScriptPath = process.env.NSFW_SCRIPT_PATH || path.join(__dirname, '../../scripts/nsfw_detect.py');
    this.threshold = parseFloat(process.env.NSFW_THRESHOLD || '0.7');
    
    // Verifica se o script Python existe
    this.checkPythonScript();
  }

  /**
   * Verifica se o script Python existe
   */
  checkPythonScript() {
    try {
      if (!fs.existsSync(this.nsfwScriptPath)) {
        this.logger.warn(`Script NSFW não encontrado: ${this.nsfwScriptPath}`);
        this.createDefaultPythonScript();
      }
    } catch (error) {
      this.logger.error('Erro ao verificar script NSFW:', error);
    }
  }

  /**
   * Cria um script Python padrão para detecção NSFW
   */
  createDefaultPythonScript() {
    try {
      const scriptDir = path.dirname(this.nsfwScriptPath);
      
      if (!fs.existsSync(scriptDir)) {
        fs.mkdirSync(scriptDir, { recursive: true });
      }
      
      // Script Python básico que utiliza a biblioteca nsfw-detector
      const pythonScript = `#!/usr/bin/env python3
# NSFW Detection script using nsfw-detector
# Requires: pip install nsfw-detector pillow tensorflow

import sys
import json
import os
from nsfw_detector import predict
from PIL import Image
import numpy as np

def detect_nsfw(image_path):
    # Carrega o modelo (baixa automaticamente se necessário)
    model = predict.load_model('nsfw_mobilenet2.224x224.h5')
    
    # Prediz a probabilidade
    result = predict.classify(model, image_path)
    
    # Retorna os resultados para o primeiro (e único) arquivo
    return result[image_path]

if __name__ == "__main__":
    # Verifica argumentos
    if len(sys.argv) != 2:
        print(json.dumps({"error": "Forneça o caminho da imagem como argumento"}))
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    # Verifica se o arquivo existe
    if not os.path.isfile(image_path):
        print(json.dumps({"error": f"Arquivo não encontrado: {image_path}"}))
        sys.exit(1)
    
    try:
        # Tenta abrir a imagem para verificar se é um formato válido
        with Image.open(image_path) as img:
            pass
            
        # Executa detecção
        result = detect_nsfw(image_path)
        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
`;
      
      fs.writeFileSync(this.nsfwScriptPath, pythonScript);
      fs.chmodSync(this.nsfwScriptPath, 0o755); // Torna o script executável
      
      this.logger.info(`Script NSFW padrão criado em: ${this.nsfwScriptPath}`);
    } catch (error) {
      this.logger.error('Erro ao criar script NSFW padrão:', error);
    }
  }

  /**
   * Verifica se uma imagem contém conteúdo NSFW
   * @param {string} imagePath - Caminho para o arquivo de imagem
   * @returns {Promise<{isNSFW: boolean, scores: Object}>} - Resultado da detecção
   */
  async detectNSFW(imagePath) {
    logger.info(`[detectNSFW] -> ${imagePath}`);
    
    return new Promise((resolve) => {
      try {
        if (!fs.existsSync(imagePath)) {
          this.logger.error(`Arquivo não encontrado: ${imagePath}`);
          resolve({ isNSFW: false, scores: {}, error: 'Arquivo não encontrado' });
          return;
        }
        
        const process = spawn(this.pythonPath, [this.nsfwScriptPath, imagePath]);
        
        let outputData = '';
        let errorData = '';
        
        process.stdout.on('data', (data) => {
          outputData += data.toString();
        });
        
        process.stderr.on('data', (data) => {
          errorData += data.toString();
        });
        
        process.on('close', (code) => {
          if (code !== 0) {
            this.logger.error(`Processo de detecção NSFW encerrado com código ${code}: ${errorData}`);
            resolve({ isNSFW: false, scores: {}, error: errorData });
            return;
          }
          
          try {
            const result = JSON.parse(outputData);
            
            if (result.error) {
              this.logger.error(`Erro na detecção NSFW: ${result.error}`);
              resolve({ isNSFW: false, scores: {}, error: result.error });
              return;
            }
            
            // Verifica se alguma das categorias NSFW está acima do limiar
            const isNSFW = result.porn >= this.threshold || 
                          result.sexy >= this.threshold || 
                          result.hentai >= this.threshold;
            
            this.logger.info(`Detecção NSFW para ${imagePath}: ${isNSFW ? 'NSFW' : 'Seguro'}`);
            this.logger.debug('Scores:', result);
            
            resolve({ isNSFW, scores: result });
          } catch (parseError) {
            this.logger.error('Erro ao analisar resultado da detecção NSFW:', parseError);
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