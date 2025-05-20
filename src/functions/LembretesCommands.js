const fs = require('fs').promises;
const path = require('path');
const chrono = require('chrono-node');
const { MessageMedia } = require('whatsapp-web.js');
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('lembretes-commands');
const database = Database.getInstance();

//logger.info('Módulo LembretesCommands carregado');

// Caminho para o arquivo JSON de lembretes
const LEMBRETES_FILE = path.join(database.databasePath, 'lembretes.json');
// Diretório para armazenar mídias dos lembretes
const LEMBRETES_MEDIA_DIR = path.join(database.databasePath, 'lembretes-media');

/**
 * Garante que os diretórios necessários existam
 */
async function garantirDiretorios() {
  try {
    // Cria diretório de mídia para lembretes se não existir
    await fs.mkdir(LEMBRETES_MEDIA_DIR, { recursive: true });
  } catch (error) {
    logger.error('Erro ao criar diretórios necessários:', error);
  }
}

/**
 * Carrega os lembretes do arquivo JSON
 * @returns {Promise<Array>} - Array de objetos de lembrete
 */
async function carregarLembretes() {
  try {
    let lembretes = [];
    
    try {
      // Verifica se o arquivo existe
      await fs.access(LEMBRETES_FILE);
      
      // Lê o arquivo
      const data = await fs.readFile(LEMBRETES_FILE, 'utf8');
      lembretes = JSON.parse(data);
      
      // Garante que seja um array
      if (!Array.isArray(lembretes)) {
        logger.warn('Arquivo de lembretes não contém um array, inicializando vazio');
        lembretes = [];
      }
    } catch (fileError) {
      // Arquivo não existe ou não pode ser lido
      logger.info('Arquivo de lembretes não encontrado ou inválido, criando novo');
      
      // Garante que o diretório exista
      const dir = path.dirname(LEMBRETES_FILE);
      await fs.mkdir(dir, { recursive: true });
      
      // Cria arquivo com array vazio
      await fs.writeFile(LEMBRETES_FILE, '[]', 'utf8');
    }
    
    return lembretes;
  } catch (error) {
    logger.error('Erro ao carregar lembretes:', error);
    return [];
  }
}

/**
 * Salva os lembretes no arquivo JSON
 * @param {Array} lembretes - Array de objetos de lembrete
 * @returns {Promise<boolean>} - Status de sucesso
 */
async function salvarLembretes(lembretes) {
  try {
    await garantirDiretorios();
    await fs.writeFile(LEMBRETES_FILE, JSON.stringify(lembretes, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error('Erro ao salvar lembretes:', error);
    return false;
  }
}

/**
 * Gera um ID único para lembretes
 * @returns {string} - ID único
 */
function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

/**
 * Interpreta a data/hora de um lembrete
 * @param {string} texto - Texto que contém a data
 * @returns {Date|null} - Data interpretada ou null se não for possível interpretar
 */
function interpretarData(texto) {
  try {
    // Configure o chrono para português brasileiro
    const customChrono = chrono.pt.casual;
    
    // Tenta interpretar a data do texto
    const results = customChrono.parse(texto, { forwardDate: true });
    
    if (results.length > 0) {
      const data = results[0].start.date();
      
      // Se apenas a hora for especificada (sem data), e for antes da hora atual, assume o dia seguinte
      const agora = new Date();
      if (results[0].start.impliedValues && results[0].start.impliedValues.day && 
          data.getHours() < agora.getHours()) {
        data.setDate(data.getDate() + 1);
      }
      
      // Se a data for no passado, retorna null
      if (data < new Date()) {
        return null;
      }
      
      return data;
    }
    
    return null;
  } catch (error) {
    logger.error('Erro ao interpretar data:', error);
    return null;
  }
}

/**
 * Formata uma data para exibição amigável
 * @param {Date} data - A data a ser formatada
 * @returns {string} - String formatada da data
 */
function formatarData(data) {
  try {
    const options = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    
    return data.toLocaleDateString('pt-BR', options);
  } catch (error) {
    logger.error('Erro ao formatar data:', error);
    return data.toString();
  }
}

/**
 * Cria um novo lembrete
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com resposta
 */
async function criarLembrete(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    
    // Verifica se há argumentos
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça uma data/hora para o lembrete. Exemplo: !lembrar amanhã às 10:00'
      });
    }
    
    // Obtém a mensagem citada
    const quotedMsg = await message.origin.getQuotedMessage();
    
    if (!quotedMsg) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Este comando deve ser usado como resposta a uma mensagem.'
      });
    }
    
    // Obtém o texto do argumento para interpretar a data
    const textoData = args.join(' ');
    let dataLembrete = interpretarData(textoData);
    
    // Se não conseguir interpretar a data, ou for no passado
    if (!dataLembrete) {
      // Se apenas a hora for fornecida, tenta definir para hoje
      if (textoData.match(/^\d{1,2}(:|h)\d{2}$/)) {
        const [hora, minuto] = textoData.replace('h', ':').split(':').map(n => parseInt(n));
        if (hora >= 0 && hora < 24 && minuto >= 0 && minuto < 60) {
          dataLembrete = new Date();
          dataLembrete.setHours(hora, minuto, 0, 0);
          
          // Se a hora já passou hoje, define para amanhã
          if (dataLembrete < new Date()) {
            dataLembrete.setDate(dataLembrete.getDate() + 1);
          }
        }
      }
      
      // Se ainda não conseguir, tenta usar 7:00 de amanhã como padrão
      if (!dataLembrete && textoData.toLowerCase().includes('amanhã')) {
        dataLembrete = new Date();
        dataLembrete.setDate(dataLembrete.getDate() + 1);
        dataLembrete.setHours(7, 0, 0, 0);
      }
      
      // Se ainda assim não conseguir, informa o erro
      if (!dataLembrete) {
        return new ReturnMessage({
          chatId: chatId,
          content: 'Não foi possível interpretar a data/hora. Use formatos como "amanhã às 10:00" ou "17/04/2025 07:30".'
        });
      }
    }
    
    // Gera um ID único para o lembrete
    const lembreteId = gerarId();
    
    // Cria o objeto do lembrete
    const lembrete = {
      id: lembreteId,
      chatId: chatId,
      userId: message.author,
      data: dataLembrete.getTime(),
      dataFormatada: formatarData(dataLembrete),
      mensagem: quotedMsg.body || '',
      criadoEm: Date.now(),
      ativo: true,
      hasMedia: false,
      mediaPath: null,
      mediaType: null,
      mediaCaption: null
    };
    
    // Se a mensagem citada tiver mídia, salva a mídia
    if (quotedMsg.hasMedia) {
      try {
        // Baixa a mídia
        const media = await quotedMsg.downloadMedia();
        
        // Define o tipo de mídia
        let mediaType = media.mimetype.split('/')[0]; // 'image', 'audio', 'video', etc.
        if (quotedMsg.type === 'sticker') mediaType = 'sticker';
        if (quotedMsg.type === 'voice') mediaType = 'voice';
        
        // Gera nome de arquivo com extensão apropriada
        let fileExt = media.mimetype.split('/')[1];
        if (fileExt && fileExt.includes(';')) {
          fileExt = fileExt.split(';')[0];
        }
        
        // Cria nome de arquivo único para a mídia
        const fileName = `${lembreteId}.${fileExt || 'bin'}`;
        const mediaPath = path.join(LEMBRETES_MEDIA_DIR, fileName);
        
        // Salva a mídia
        await fs.writeFile(mediaPath, Buffer.from(media.data, 'base64'));
        
        // Atualiza informações do lembrete
        lembrete.hasMedia = true;
        lembrete.mediaPath = fileName;
        lembrete.mediaType = media.mimetype;
        lembrete.mediaCaption = quotedMsg.caption || '';
        
        logger.info(`Mídia salva para lembrete: ${mediaPath}`);
      } catch (mediaError) {
        logger.error('Erro ao salvar mídia para lembrete:', mediaError);
        // Continua criando o lembrete mesmo sem mídia, mas envia aviso
        return new ReturnMessage({
          chatId: chatId,
          content: 'Não foi possível salvar a mídia para o lembrete. O lembrete será criado apenas com o texto.'
        });
      }
    }
    
    // Carrega lembretes existentes
    const lembretes = await carregarLembretes();
    
    // Adiciona o novo lembrete
    lembretes.push(lembrete);
    
    // Salva os lembretes
    const salvou = await salvarLembretes(lembretes);
    
    if (salvou) {
      // Inicia o temporizador para este lembrete
      iniciarTemporizador(bot, lembrete);
      
      // Retorna mensagem de confirmação
      return new ReturnMessage({
        chatId: chatId,
        content: `✅ Lembrete configurado para ${lembrete.dataFormatada} (ID: ${lembrete.id})`
      });
    } else {
      return new ReturnMessage({
        chatId: chatId,
        content: '❌ Erro ao salvar o lembrete. Por favor, tente novamente.'
      });
    }
  } catch (error) {
    logger.error('Erro ao criar lembrete:', error);
    const chatId = message.group || message.author;
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao criar lembrete. Por favor, tente novamente.'
    });
  }
}

/**
 * Lista os lembretes ativos
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com lista de lembretes
 */
async function listarLembretes(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    const userId = message.author;
    
    // Carrega lembretes
    const lembretes = await carregarLembretes();
    
    // Filtra lembretes para este chat e/ou usuário
    const lembretesFiltrados = lembretes.filter(l => {
      // Se for chat privado, mostra apenas os lembretes do usuário
      if (!message.group) {
        return l.userId === userId && l.ativo;
      }
      
      // Se for grupo, mostra os lembretes do grupo
      return l.chatId === chatId && l.ativo;
    });
    
    if (lembretesFiltrados.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Não há lembretes ativos.'
      });
    }
    
    // Ordena por data (mais próximos primeiro)
    lembretesFiltrados.sort((a, b) => a.data - b.data);
    
    // Constrói a mensagem
    let mensagem = '📅 *Lembretes Ativos:*\n\n';
    
    for (const lembrete of lembretesFiltrados) {
      // Calcula tempo restante
      const agora = Date.now();
      const tempoRestante = lembrete.data - agora;
      const dias = Math.floor(tempoRestante / (1000 * 60 * 60 * 24));
      const horas = Math.floor((tempoRestante % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutos = Math.floor((tempoRestante % (1000 * 60 * 60)) / (1000 * 60));
      
      let tempoFormatado = '';
      if (dias > 0) tempoFormatado += `${dias}d `;
      if (horas > 0) tempoFormatado += `${horas}h `;
      tempoFormatado += `${minutos}m`;
      
      // Formata a mensagem do lembrete (limitada a 50 caracteres)
      const mensagemCurta = lembrete.mensagem && lembrete.mensagem.length > 50 
        ? lembrete.mensagem.substring(0, 47) + '...' 
        : lembrete.mensagem || '(sem texto)';
      
      // Adiciona informação se tem mídia
      const temMidia = lembrete.hasMedia ? ' 📎' : '';
      
      mensagem += `*ID:* ${lembrete.id}\n`;
      mensagem += `*Data:* ${lembrete.dataFormatada}\n`;
      mensagem += `*Tempo restante:* ${tempoFormatado}\n`;
      mensagem += `*Mensagem:* ${mensagemCurta}${temMidia}\n\n`;
    }
    
    mensagem += `Para cancelar um lembrete, use: !l-cancelar <id>`;
    
    return new ReturnMessage({
      chatId: chatId,
      content: mensagem
    });
  } catch (error) {
    logger.error('Erro ao listar lembretes:', error);
    const chatId = message.group || message.author;
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao listar lembretes. Por favor, tente novamente.'
    });
  }
}

/**
 * Cancela um lembrete por ID
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} message - Dados da mensagem
 * @param {Array} args - Argumentos do comando
 * @param {Object} group - Dados do grupo
 * @returns {Promise<ReturnMessage>} - ReturnMessage com resposta
 */
async function cancelarLembrete(bot, message, args, group) {
  try {
    const chatId = message.group || message.author;
    const userId = message.author;
    
    // Verifica se foi fornecido um ID
    if (args.length === 0) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Por favor, forneça o ID do lembrete a ser cancelado. Use !lembretes para ver os IDs.'
      });
    }
    
    const lembreteId = args[0];
    
    // Carrega lembretes
    const lembretes = await carregarLembretes();
    
    // Encontra o lembrete
    const index = lembretes.findIndex(l => l.id === lembreteId);
    
    if (index === -1) {
      return new ReturnMessage({
        chatId: chatId,
        content: `Lembrete com ID ${lembreteId} não encontrado.`
      });
    }
    
    const lembrete = lembretes[index];
    
    // Verifica se o usuário tem permissão para cancelar o lembrete
    // No grupo, apenas o criador do lembrete pode cancelar
    // Em chat privado, apenas lembretes criados pelo usuário podem ser cancelados
    if (lembrete.userId !== userId && (!message.group || lembrete.chatId !== chatId)) {
      return new ReturnMessage({
        chatId: chatId,
        content: 'Você não tem permissão para cancelar este lembrete.'
      });
    }
    
    // Marca o lembrete como inativo
    lembrete.ativo = false;
    
    // Salva os lembretes
    const salvou = await salvarLembretes(lembretes);
    
    if (salvou) {
      // Se tiver mídia, exclui o arquivo
      if (lembrete.hasMedia && lembrete.mediaPath) {
        try {
          await fs.unlink(path.join(LEMBRETES_MEDIA_DIR, lembrete.mediaPath));
        } catch (unlinkError) {
          logger.error('Erro ao excluir mídia do lembrete:', unlinkError);
        }
      }
      
      return new ReturnMessage({
        chatId: chatId,
        content: `✅ Lembrete com ID ${lembreteId} foi cancelado.`
      });
    } else {
      return new ReturnMessage({
        chatId: chatId,
        content: '❌ Erro ao cancelar o lembrete. Por favor, tente novamente.'
      });
    }
  } catch (error) {
    logger.error('Erro ao cancelar lembrete:', error);
    const chatId = message.group || message.author;
    return new ReturnMessage({
      chatId: chatId,
      content: 'Erro ao cancelar lembrete. Por favor, tente novamente.'
    });
  }
}

/**
 * Inicia temporizador para um lembrete
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {Object} lembrete - O objeto do lembrete
 */
function iniciarTemporizador(bot, lembrete) {
  try {
    // Calcula o tempo até o lembrete
    const agora = Date.now();
    let tempoPraDisparar = lembrete.data - agora;
    
    // Se já passou da hora, não agenda
    if (tempoPraDisparar <= 0) {
      logger.warn(`Lembrete ${lembrete.id} já expirou, não será agendado`);
      return;
    }
    
    // Limita o tempo máximo do timer para 24h (JavaScript tem limitações)
    const MAX_TIMER = 24 * 60 * 60 * 1000; // 24 horas em ms
    
    if (tempoPraDisparar > MAX_TIMER) {
      // Agenda um timer para verificar novamente após 24h
      logger.info(`Lembrete ${lembrete.id} agendado para reavaliação em 24h`);
      setTimeout(() => {
        // Recarrega o lembrete para garantir que ainda está ativo
        verificarLembrete(bot, lembrete.id);
      }, MAX_TIMER);
    } else {
      // Agenda para o tempo exato
      logger.info(`Lembrete ${lembrete.id} agendado para disparar em ${formatarTempoRestante(tempoPraDisparar)}`);
      setTimeout(() => {
        // Dispara o lembrete
        dispararLembrete(bot, lembrete.id);
      }, tempoPraDisparar);
    }
  } catch (error) {
    logger.error(`Erro ao iniciar temporizador para lembrete ${lembrete.id}:`, error);
  }
}

/**
 * Formata o tempo restante de forma legível
 * @param {number} ms - Tempo em milissegundos
 * @returns {string} - Tempo formatado
 */
function formatarTempoRestante(ms) {
  const segundos = Math.floor(ms / 1000);
  const minutos = Math.floor(segundos / 60);
  const horas = Math.floor(minutos / 60);
  const dias = Math.floor(horas / 24);
  
  if (dias > 0) {
    return `${dias} dias e ${horas % 24} horas`;
  } else if (horas > 0) {
    return `${horas} horas e ${minutos % 60} minutos`;
  } else if (minutos > 0) {
    return `${minutos} minutos e ${segundos % 60} segundos`;
  } else {
    return `${segundos} segundos`;
  }
}

/**
 * Verifica se um lembrete ainda está ativo e reconfigura o temporizador
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {string} lembreteId - ID do lembrete
 */
async function verificarLembrete(bot, lembreteId) {
  try {
    // Carrega lembretes
    const lembretes = await carregarLembretes();
    
    // Encontra o lembrete
    const lembrete = lembretes.find(l => l.id === lembreteId && l.ativo);
    
    // Se encontrou e ainda está ativo, reconfigura o temporizador
    if (lembrete) {
      iniciarTemporizador(bot, lembrete);
    }
  } catch (error) {
    logger.error(`Erro ao verificar lembrete ${lembreteId}:`, error);
  }
}

/**
 * Dispara um lembrete
 * @param {WhatsAppBot} bot - Instância do bot
 * @param {string} lembreteId - ID do lembrete
 */
async function dispararLembrete(bot, lembreteId) {
  try {
    // Carrega lembretes
    const lembretes = await carregarLembretes();
    
    // Encontra o lembrete
    const index = lembretes.findIndex(l => l.id === lembreteId && l.ativo);
    
    if (index === -1) {
      logger.warn(`Lembrete ${lembreteId} não encontrado ou não está ativo`);
      return;
    }
    
    const lembrete = lembretes[index];
    
    // Marca o lembrete como inativo
    lembrete.ativo = false;
    
    // Salva os lembretes
    await salvarLembretes(lembretes);
    
    // Se o chat for um grupo, verifica se está pausado
    if (lembrete.chatId.endsWith('@g.us')) {
      // Obtém o grupo do banco de dados
      const group = await database.getGroup(lembrete.chatId);
      
      // Se o grupo estiver pausado, não envia o lembrete
      if (group && group.paused) {
        logger.info(`Ignorando lembrete ${lembreteId} para grupo pausado: ${lembrete.chatId}`);
        return;
      }
    }
    
    // Formata a mensagem do lembrete
    const textoLembrete = `⏰ *LEMBRETE!*\n\n${lembrete.mensagem || ''}`;
    
    // Usa ReturnMessage para enviar
    let returnMessage;
    
    // Verifica se tem mídia
    if (lembrete.hasMedia && lembrete.mediaPath) {
      try {
        // Carrega a mídia
        const mediaPath = path.join(LEMBRETES_MEDIA_DIR, lembrete.mediaPath);
        const mediaData = await fs.readFile(mediaPath);
        
        // Cria objeto de mídia
        const media = new MessageMedia(
          lembrete.mediaType || 'application/octet-stream',
          mediaData.toString('base64'),
          lembrete.mediaPath
        );
        
        // Cria ReturnMessage com mídia
        returnMessage = new ReturnMessage({
          chatId: lembrete.chatId,
          content: media,
          options: {
            caption: textoLembrete
          }
        });
        
        // Envia a mensagem
        await bot.sendReturnMessages(returnMessage);
        
        // Exclui o arquivo de mídia após enviar
        try {
          await fs.unlink(mediaPath);
        } catch (unlinkError) {
          logger.error('Erro ao excluir mídia do lembrete após envio:', unlinkError);
        }
      } catch (mediaError) {
        logger.error('Erro ao enviar mídia do lembrete:', mediaError);
        // Se falhar, envia apenas o texto
        returnMessage = new ReturnMessage({
          chatId: lembrete.chatId,
          content: `${textoLembrete}\n\n_(Não foi possível enviar a mídia)_`
        });
        
        await bot.sendReturnMessages(returnMessage);
      }
    } else {
      // Envia apenas o texto
      returnMessage = new ReturnMessage({
        chatId: lembrete.chatId,
        content: textoLembrete
      });
      
      await bot.sendReturnMessages(returnMessage);
    }
    
    logger.info(`Lembrete ${lembreteId} disparado com sucesso`);
  } catch (error) {
    logger.error(`Erro ao disparar lembrete ${lembreteId}:`, error);
  }
}

// Comandos utilizando a classe Command
const commands = [
  new Command({
    name: 'lembretes',
    description: 'Lista os lembretes ativos',
    category: "utilidades",
    reactions: {
      before: "⏳",
      after: "📋"
    },
    method: listarLembretes
  }),
  new Command({
    name: 'lembrar',
    description: 'Configura um lembrete para uma data específica',
    category: "utilidades",
    reactions: {
      before: "⏳",
      after: "⏰"
    },
    needsQuotedMsg: true,
    method: criarLembrete
  }),
  
  
  new Command({
    name: 'l-cancelar',
    description: 'Cancela um lembrete por ID',
    category: "utilidades",
    reactions: {
      before: "⏳",
      after: "🗑"
    },
    method: cancelarLembrete
  })
];

// Ao carregar o módulo, inicia temporizadores para lembretes ativos
(async () => {
  try {
    await garantirDiretorios();
    
    // Carrega lembretes
    const lembretes = await carregarLembretes();
    
    // Filtra lembretes ativos
    const lembretesAtivos = lembretes.filter(l => l.ativo);
    
    if (lembretesAtivos.length > 0) {
      logger.info(`Iniciando temporizadores para ${lembretesAtivos.length} lembretes ativos`);
      
      // Inicia temporizadores
      for (const lembrete of lembretesAtivos) {
        // Verifica se já passou da hora
        if (lembrete.data <= Date.now()) {
          logger.info(`Lembrete ${lembrete.id} já expirou, marcando como inativo`);
          lembrete.ativo = false;
        }
      }
      
      // Salva lembretes atualizados
      await salvarLembretes(lembretes);
      
      // Agora inicia temporizadores apenas para os que ainda estão ativos
      const lembretesAtualizados = lembretes.filter(l => l.ativo);
      logger.info(`${lembretesAtualizados.length} lembretes ainda ativos após verificação`);
      
      // Ao iniciar o bot, os temporizadores serão configurados quando o bot estiver conectado
      // Isso acontece porque precisamos da instância do bot para enviar mensagens
    }
  } catch (error) {
    logger.error('Erro ao iniciar temporizadores de lembretes:', error);
  }
})();

// Registra os comandos sendo exportados
//logger.debug(`Exportando ${commands.length} comandos:`, commands.map(cmd => cmd.name));

module.exports = { 
  commands,
  // Exporta funções úteis para uso externo
  inicializarLembretes: async (bot) => {
    try {
      const lembretes = await carregarLembretes();
      const lembretesAtivos = lembretes.filter(l => l.ativo);
      
      logger.info(`Inicializando ${lembretesAtivos.length} lembretes para o bot`);
      
      for (const lembrete of lembretesAtivos) {
        iniciarTemporizador(bot, lembrete);
      }
    } catch (error) {
      logger.error('Erro ao inicializar lembretes para o bot:', error);
    }
  }
};