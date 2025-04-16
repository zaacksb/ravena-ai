#!/usr/bin/env python3
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
