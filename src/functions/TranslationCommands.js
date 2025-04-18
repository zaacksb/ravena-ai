const Logger = require('../utils/Logger');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');
const translate = require('@vitalets/google-translate-api');
const { wrapper } = require('@vitalets/google-translate-api/dist/cjs/middleware/rateLimiter');

// Set up the translation API with rate limiting to avoid IP blocks
const translateWithRateLimiter = wrapper(translate, {
  delay: 500, // 500ms delay between requests
  maxRetries: 3 // Retry up to 3 times if rate limit is hit
});

const logger = new Logger('translation-commands');

logger.info('Módulo TranslationCommands carregado');

// Mapping of language codes to full names
const LANGUAGE_NAMES = {
  'af': 'Afrikaans',
  'sq': 'Albanian',
  'am': 'Amharic',
  'ar': 'Arabic',
  'hy': 'Armenian',
  'az': 'Azerbaijani',
  'eu': 'Basque',
  'be': 'Belarusian',
  'bn': 'Bengali',
  'bs': 'Bosnian',
  'bg': 'Bulgarian',
  'ca': 'Catalan',
  'ceb': 'Cebuano',
  'ny': 'Chichewa',
  'zh-cn': 'Chinese (Simplified)',
  'zh-tw': 'Chinese (Traditional)',
  'co': 'Corsican',
  'hr': 'Croatian',
  'cs': 'Czech',
  'da': 'Danish',
  'nl': 'Dutch',
  'en': 'English',
  'eo': 'Esperanto',
  'et': 'Estonian',
  'tl': 'Filipino',
  'fi': 'Finnish',
  'fr': 'French',
  'fy': 'Frisian',
  'gl': 'Galician',
  'ka': 'Georgian',
  'de': 'German',
  'el': 'Greek',
  'gu': 'Gujarati',
  'ht': 'Haitian Creole',
  'ha': 'Hausa',
  'haw': 'Hawaiian',
  'iw': 'Hebrew',
  'hi': 'Hindi',
  'hmn': 'Hmong',
  'hu': 'Hungarian',
  'is': 'Icelandic',
  'ig': 'Igbo',
  'id': 'Indonesian',
  'ga': 'Irish',
  'it': 'Italian',
  'ja': 'Japanese',
  'jw': 'Javanese',
  'kn': 'Kannada',
  'kk': 'Kazakh',
  'km': 'Khmer',
  'ko': 'Korean',
  'ku': 'Kurdish (Kurmanji)',
  'ky': 'Kyrgyz',
  'lo': 'Lao',
  'la': 'Latin',
  'lv': 'Latvian',
  'lt': 'Lithuanian',
  'lb': 'Luxembourgish',
  'mk': 'Macedonian',
  'mg': 'Malagasy',
  'ms': 'Malay',
  'ml': 'Malayalam',
  'mt': 'Maltese',
  'mi': 'Maori',
  'mr': 'Marathi',
  'mn': 'Mongolian',
  'my': 'Myanmar (Burmese)',
  'ne': 'Nepali',
  'no': 'Norwegian',
  'ps': 'Pashto',
  'fa': 'Persian',
  'pl': 'Polish',
  'pt': 'Portuguese',
  'pa': 'Punjabi',
  'ro': 'Romanian',
  'ru': 'Russian',
  'sm': 'Samoan',
  'gd': 'Scots Gaelic',
  'sr': 'Serbian',
  'st': 'Sesotho',
  'sn': 'Shona',
  'sd': 'Sindhi',
  'si': 'Sinhala',
  'sk': 'Slovak',
  'sl': 'Slovenian',
  'so': 'Somali',
  'es': 'Spanish',
  'su': 'Sundanese',
  'sw': 'Swahili',
  'sv': 'Swedish',
  'tg': 'Tajik',
  'ta': 'Tamil',
  'te': 'Telugu',
  'th': 'Thai',
  'tr': 'Turkish',
  'uk': 'Ukrainian',
  'ur': 'Urdu',
  'uz': 'Uzbek',
  'vi': 'Vietnamese',
  'cy': 'Welsh',
  'xh': 'Xhosa',
  'yi': 'Yiddish',
  'yo': 'Yoruba',
  'zu': 'Zulu',
  // Common shortcuts
  'pt-br': 'Portuguese (Brazil)',
  'zh': 'Chinese (Simplified)'
};

// Mapping of flags to language codes
const FLAG_TO_LANGUAGE = {
  '🇦🇷': 'es', // Argentina - Spanish
  '🇦🇹': 'de', // Austria - German
  '🇦🇺': 'en', // Australia - English
  '🇧🇪': 'fr', // Belgium - French
  '🇧🇷': 'pt', // Brazil - Portuguese
  '🇨🇦': 'en', // Canada - English
  '🇨🇭': 'de', // Switzerland - German
  '🇨🇱': 'es', // Chile - Spanish
  '🇨🇳': 'zh-cn', // China - Chinese
  '🇨🇴': 'es', // Colombia - Spanish
  '🇨🇿': 'cs', // Czech Republic - Czech
  '🇩🇪': 'de', // Germany - German
  '🇩🇰': 'da', // Denmark - Danish
  '🇪🇦': 'es', // Spain (Ceuta & Melilla) - Spanish
  '🇪🇬': 'ar', // Egypt - Arabic
  '🇪🇸': 'es', // Spain - Spanish
  '🇫🇮': 'fi', // Finland - Finnish
  '🇫🇷': 'fr', // France - French
  '🇬🇧': 'en', // UK - English
  '🇬🇷': 'el', // Greece - Greek
  '🇭🇰': 'zh-tw', // Hong Kong - Traditional Chinese
  '🇭🇺': 'hu', // Hungary - Hungarian
  '🇮🇩': 'id', // Indonesia - Indonesian
  '🇮🇪': 'en', // Ireland - English
  '🇮🇱': 'iw', // Israel - Hebrew
  '🇮🇳': 'hi', // India - Hindi
  '🇮🇷': 'fa', // Iran - Persian
  '🇮🇸': 'is', // Iceland - Icelandic
  '🇮🇹': 'it', // Italy - Italian
  '🇯🇵': 'ja', // Japan - Japanese
  '🇰🇷': 'ko', // South Korea - Korean
  '🇲🇽': 'es', // Mexico - Spanish
  '🇲🇾': 'ms', // Malaysia - Malay
  '🇳🇱': 'nl', // Netherlands - Dutch
  '🇳🇴': 'no', // Norway - Norwegian
  '🇳🇿': 'en', // New Zealand - English
  '🇵🇪': 'es', // Peru - Spanish
  '🇵🇭': 'tl', // Philippines - Filipino
  '🇵🇱': 'pl', // Poland - Polish
  '🇵🇹': 'pt', // Portugal - Portuguese
  '🇷🇴': 'ro', // Romania - Romanian
  '🇷🇺': 'ru', // Russia - Russian
  '🇸🇦': 'ar', // Saudi Arabia - Arabic
  '🇸🇪': 'sv', // Sweden - Swedish
  '🇸🇬': 'en', // Singapore - English
  '🇹🇭': 'th', // Thailand - Thai
  '🇹🇷': 'tr', // Turkey - Turkish
  '🇹🇼': 'zh-tw', // Taiwan - Traditional Chinese
  '🇺🇦': 'uk', // Ukraine - Ukrainian
  '🇺🇸': 'en', // USA - English
  '🇻🇳': 'vi', // Vietnam - Vietnamese
  '🇿🇦': 'en'  // South Africa - English
};

// Mapping of common language name variations to language codes
const LANGUAGE_ALIASES = {
  'inglês': 'en',
  'ingles': 'en',
  'english': 'en',
  'português': 'pt',
  'portugues': 'pt',
  'portuguese': 'pt',
  'brasileiro': 'pt',
  'brazil': 'pt-br',
  'brasil': 'pt-br',
  'pt-br': 'pt',
  'espanhol': 'es',
  'spanish': 'es',
  'francês': 'fr',
  'frances': 'fr',
  'french': 'fr',
  'alemão': 'de',
  'alemao': 'de',
  'german': 'de',
  'italiano': 'it',
  'italian': 'it',
  'japonês': 'ja',
  'japones': 'ja',
  'japanese': 'ja',
  'chinês': 'zh-cn',
  'chines': 'zh-cn',
  'chinese': 'zh-cn',
  'russo': 'ru',
  'russian': 'ru',
  'árabe': 'ar',
  'arabe': 'ar',
  'arabic': 'ar',
  'coreano': 'ko',
  'korean': 'ko',
};

/**
 * Gets language code from language name or alias
 * @param {string} languageName - Language name or alias
 * @returns {string|null} - Language code or null if not found
 */
function getLanguageCode(languageName) {
  const lowercaseLanguage = languageName.toLowerCase().trim();
  
  // Check if it's a direct language code
  if (LANGUAGE_NAMES[lowercaseLanguage]) {
    return lowercaseLanguage;
  }
  
  // Check if it's an alias
  if (LANGUAGE_ALIASES[lowercaseLanguage]) {
    return LANGUAGE_ALIASES[lowercaseLanguage];
  }
  
  // Search in language names
  for (const [code, name] of Object.entries(LANGUAGE_NAMES)) {
    if (name.toLowerCase() === lowercaseLanguage) {
      return code;
    }
  }
  
  return null;
}

/**
 * Translates text to the specified language
 * @param {string} text - Text to translate
 * @param {string} targetLanguage - Target language code
 * @returns {Promise<string>} - Translated text
 */
async function translateText(text, targetLanguage) {
  try {
    const result = await translateWithRateLimiter(text, { to: targetLanguage });
    return result.text;
  } catch (error) {
    logger.error('Error translating text:', error);
    throw error;
  }
}

/**
 * Handles the translation command
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} message - Message data
 * @param {Array} args - Command arguments
 * @param {Object} group - Group data
 * @returns {Promise<ReturnMessage>} - Return message with translation
 */
async function handleTranslation(bot, message, args, group) {
  const chatId = message.group || message.author;
  
  try {
    // Prepare to handle different formats:
    // 1. !traduzir en Hello, world!
    // 2. !traduzir en (in reply to a message)
    
    if (args.length === 0) {
      return new ReturnMessage({
        chatId,
        content: 'Por favor, forneça o idioma de destino e o texto a ser traduzido.\n' +
                 'Exemplo: !traduzir en Olá, mundo!\n' +
                 'Ou responda a uma mensagem com: !traduzir en'
      });
    }
    
    // Get target language code
    const languageArg = args[0].toLowerCase();
    const targetLanguage = getLanguageCode(languageArg);
    
    if (!targetLanguage) {
      return new ReturnMessage({
        chatId,
        content: `Idioma não reconhecido: "${args[0]}".\n` +
                 'Exemplo de idiomas suportados: en (inglês), es (espanhol), fr (francês), etc.'
      });
    }
    
    let textToTranslate;
    let quotedText = '';
    
    // Check if it's a reply to a message
    if (args.length === 1) {
      try {
        const quotedMsg = await message.origin.getQuotedMessage();
        if (!quotedMsg) {
          return new ReturnMessage({
            chatId,
            content: 'Por favor, responda a uma mensagem ou forneça um texto para traduzir.'
          });
        }
        
        textToTranslate = quotedMsg.body;
        quotedText = `Original: "${textToTranslate}"\n\n`;
      } catch (error) {
        logger.error('Error getting quoted message:', error);
        return new ReturnMessage({
          chatId,
          content: 'Erro ao obter a mensagem citada. Por favor, tente novamente.'
        });
      }
    } else {
      // Text is provided in the command
      textToTranslate = args.slice(1).join(' ');
    }
    
    if (!textToTranslate || textToTranslate.trim() === '') {
      return new ReturnMessage({
        chatId,
        content: 'Texto vazio. Por favor, forneça um texto para traduzir.'
      });
    }
    
    // Translate the text
    const translatedText = await translateText(textToTranslate, targetLanguage);
    
    // Create the response
    const languageName = LANGUAGE_NAMES[targetLanguage];
    const response = `🌐 *Tradução para ${languageName}*\n\n${quotedText}${translatedText}`;
    
    return new ReturnMessage({
      chatId,
      content: response,
      options: {
        quotedMessageId: message.origin.id._serialized
      }
    });
  } catch (error) {
    logger.error('Error in translation command:', error);
    return new ReturnMessage({
      chatId,
      content: 'Erro ao traduzir o texto. Por favor, tente novamente.'
    });
  }
}

/**
 * Processes a reaction to potentially translate a message
 * @param {WhatsAppBot} bot - Bot instance
 * @param {Object} reaction - Reaction data
 * @returns {Promise<boolean>} - True if the reaction was processed
 */
async function processTranslationReaction(bot, reaction) {
  try {
    // Check if the emoji is a flag
    const emoji = reaction.emoji;
    if (!FLAG_TO_LANGUAGE[emoji]) {
      return false;
    }
    
    const targetLanguage = FLAG_TO_LANGUAGE[emoji];
    
    // Get the message being reacted to
    const message = await bot.client.getMessage(reaction.messageId);
    if (!message || !message.body) {
      return false;
    }
    
    const textToTranslate = message.body;
    const chatId = reaction.chatId;
    
    // Translate the text
    const translatedText = await translateText(textToTranslate, targetLanguage);
    
    // Create the response
    const languageName = LANGUAGE_NAMES[targetLanguage];
    const response = `🌐 *Tradução para ${languageName}*\n\n${translatedText}`;
    
    // Send the translation
    await bot.sendMessage(chatId, response, {
      quotedMessageId: reaction.messageId
    });
    
    return true;
  } catch (error) {
    logger.error('Error processing translation reaction:', error);
    return false;
  }
}

// Command definition
const commands = [
  new Command({
    name: 'traduzir',
    description: 'Traduz um texto para o idioma especificado',
    usage: '!traduzir [idioma] [texto] ou !traduzir [idioma] em resposta a uma mensagem',
    reactions: {
      before: "🌐",
      after: "✅",
      error: "❌"
    },
    method: handleTranslation
  })
];

// Export commands and reaction handler
module.exports = {
  commands,
  processTranslationReaction
};