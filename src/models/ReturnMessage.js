/**
 * Modelo ReturnMessage representando uma mensagem estruturada para ser enviada pelo bot (Retorno das functions, etc.)
 */
class ReturnMessage {
  /**
   * Cria uma nova ReturnMessage
   * @param {Object} data - Dados da ReturnMessage
   */
  constructor(data = {}) {
    this.chatId = data.chatId || null;
    this.content = data.content || '';
    
    // Configurações padrão completas
    this.options = data.options || {
      // Configurações básicas
      linkPreview: false,           // Mostra previews de links
      sendAudioAsVoice: false,      // Envia áudio como mensagem de voz com forma de onda gerada
      sendVideoAsGif: false,        // Envia vídeo como GIF
      sendMediaAsSticker: false,    // Envia mídia como sticker
      sendMediaAsDocument: false,   // Envia mídia como documento
      isViewOnce: false,            // Envia foto/vídeo como mensagem de visualização única
      parseVCards: true,            // Analisa automaticamente vCards e os envia como contatos
      sendSeen: true,               // Marca a conversa como vista após enviar a mensagem
      
      // Identificação e referência
      caption: '',                  // Legenda para imagem ou vídeo
      quotedMessageId: null,        // Id da mensagem que está sendo citada (ou respondida)
      
      // Menções
      mentions: [],                 // IDs de usuário para mencionar na mensagem
      invokedBotWid: null,          // Wid do bot ao fazer uma menção de bot, como @Meta AI
      
      // Configurações de sticker
      stickerAuthor: null,          // Define o autor do sticker (se sendMediaAsSticker for true)
      stickerName: null,            // Define o nome do sticker (se sendMediaAsSticker for true)
      stickerCategories: null,      // Define as categorias do sticker (se sendMediaAsSticker for true)
      
      // Mídia
      media: null                   // Mídia a ser enviada
    };
    
    // Sobrescreve as opções com valores fornecidos
    if (data.options) {
      this.options = {...this.options, ...data.options};
    }
    
    // Propriedades opcionais adicionais
    this.reactions = data.reactions || null;
    this.delay = data.delay || 0;   // Milissegundos para atrasar antes de enviar
    this.metadata = data.metadata || {}; // Metadados personalizados para rastreamento ou outros fins
  }

  /**
   * Verifica se a ReturnMessage possui todas as propriedades obrigatórias
   * @returns {boolean} - Verdadeiro se válido, falso caso contrário
   */
  isValid() {
    return this.chatId !== null && this.content !== null;
  }

  /**
   * Converte ReturnMessage para um objeto simples para serialização
   * @returns {Object} - Representação em objeto simples
   */
  toJSON() {
    return {
      chatId: this.chatId,
      content: typeof this.content === 'string' ? this.content : '[Conteúdo de Mídia]',
      options: this.options,
      reactions: this.reactions,
      delay: this.delay,
      metadata: this.metadata
    };
  }
}

module.exports = ReturnMessage;