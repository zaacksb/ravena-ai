const path = require('path');
const fs = require('fs').promises;
const Logger = require('../utils/Logger');
const Database = require('../utils/Database');
const Command = require('../models/Command');
const ReturnMessage = require('../models/ReturnMessage');

const logger = new Logger('roleta-russa-commands');
const database = Database.getInstance();

//logger.info('Módulo RoletaRussaCommands carregado');

/**
 * Caminho para o arquivo JSON de dados da Roleta Russa
 */
const ROLETA_RUSSA_FILE = path.join(__dirname, '../../data/roletarussa.json');

/**
 * Emojis para ranking
 */
const EMOJIS_RANKING = ["","🥇","🥈","🥉","🐅","🐆","🦌","🐐","🐏","🐓","🐇"];

/**
 * Carrega os dados da roleta russa
 * @returns {Promise<Object>} Dados da roleta russa
 */
async function carregarDadosRoleta() {
  try {
    let dados;
    
    try {
      // Tenta ler o arquivo existente
      const fileContent = await fs.readFile(ROLETA_RUSSA_FILE, 'utf8');
      dados = JSON.parse(fileContent);
    } catch (error) {
      logger.info('Arquivo de dados da roleta russa não encontrado ou inválido, criando novo');
      
      // Cria estrutura de dados inicial
      dados = {
        grupos: {},
        configuracoes: {
          tempoDefault: 300 // 5 minutos em segundos
        }
      };
      
      // Garante que o diretório exista
      const dir = path.dirname(ROLETA_RUSSA_FILE);
      await fs.mkdir(dir, { recursive: true });
      
      // Salva o arquivo
      await fs.writeFile(ROLETA_RUSSA_FILE, JSON.stringify(dados, null, 2), 'utf8');
    }
    
    return dados;
  } catch (error) {
    logger.error('Erro ao carregar dados da roleta russa:', error);
    // Retorna estrutura vazia em caso de erro
    return {
      grupos: {},
      configuracoes: {
        tempoDefault: 300
      }
    };
  }
}

/**
 * Salva os dados da roleta russa
 * @param {Object} dados Dados a serem salvos
 * @returns {Promise<boolean>} Sucesso ou falha
 */
async function salvarDadosRoleta(dados) {
  try {
    await fs.writeFile(ROLETA_RUSSA_FILE, JSON.stringify(dados, null, 2), 'utf8');
    return true;
  } catch (error) {
    logger.error('Erro ao salvar dados da roleta russa:', error);
    return false;
  }
}

/**
 * Inicializa dados de um grupo se não existirem
 * @param {Object} dados Dados da roleta russa
 * @param {string} groupId ID do grupo
 * @returns {Object} Dados atualizados
 */
function inicializarGrupo(dados, groupId) {
  if (!dados.grupos[groupId]) {
    dados.grupos[groupId] = {
      tempoTimeout: dados.configuracoes.tempoDefault,
      jogadores: {},
      ultimoJogador: null
    };
  }
  return dados;
}

/**
 * Inicializa dados de um jogador se não existirem
 * @param {Object} dados Dados da roleta russa
 * @param {string} groupId ID do grupo
 * @param {string} userId ID do jogador
 * @returns {Object} Dados atualizados
 */
function inicializarJogador(dados, groupId, userId) {
  if (!dados.grupos[groupId].jogadores[userId]) {
    dados.grupos[groupId].jogadores[userId] = {
      tentativasAtuais: 0,
      tentativasMaximo: 0,
      mortes: 0,
      timeoutAte: 0
    };
  }
  return dados;
}

/**
 * Joga roleta russa
 * @param {WhatsAppBot} bot Instância do bot
 * @param {Object} message Dados da mensagem
 * @param {Array} args Argumentos do comando
 * @param {Object} group Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function jogarRoletaRussa(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'A roleta russa só pode ser jogada em grupos.'
      });
    }
    
    const groupId = message.group;
    const userId = message.author;
    
    // Obtém o nome do jogador
    let userName = "Jogador";
    try {
      const contact = await message.origin.getContact();
      userName = contact.pushname || contact.name || "Jogador";
    } catch (error) {
      logger.error('Erro ao obter contato:', error);
    }
    
    // Carrega dados da roleta
    let dados = await carregarDadosRoleta();
    
    // Inicializa dados do grupo se necessário
    dados = inicializarGrupo(dados, groupId);
    
    // Inicializa dados do jogador se necessário
    dados = inicializarJogador(dados, groupId, userId);
    
    const jogadorDados = dados.grupos[groupId].jogadores[userId];
    
    // Verifica se o jogador está em timeout
    const agora = Math.floor(Date.now() / 1000);
    if (jogadorDados.timeoutAte > agora) {
      const tempoRestante = jogadorDados.timeoutAte - agora;
      const minutos = Math.floor(tempoRestante / 60);
      const segundos = tempoRestante % 60;
      
      // Reage com emoji de caixão se estiver em timeout
      try {
        await message.origin.react("⚰️");
      } catch (reactError) {
        logger.error('Erro ao aplicar reação de caixão:', reactError);
      }
      
      return new ReturnMessage({
        chatId: groupId,
        content: `☠️ ${userName} já está morto na roleta russa. Ressuscita em ${minutos}m${segundos}s.`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Verifica se é o mesmo jogador jogando consecutivamente
    if (dados.grupos[groupId].ultimoJogador === userId) {
      return new ReturnMessage({
        chatId: groupId,
        content: `🔄 ${userName}, espere outra pessoa jogar antes de tentar novamente.`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
    
    // Atualiza último jogador
    dados.grupos[groupId].ultimoJogador = userId;
    
    // Incrementa tentativas atuais
    jogadorDados.tentativasAtuais++;
    
    // Determina se o jogador "morre" (1 em 6 chances, como um revólver)
    const morreu = Math.floor(Math.random() * 6) === 0;
    
    if (morreu) {
      // Jogador "morreu"
      jogadorDados.mortes++;
      
      // Registra se é um novo recorde
      const novoRecorde = jogadorDados.tentativasAtuais > jogadorDados.tentativasMaximo;
      if (novoRecorde) {
        jogadorDados.tentativasMaximo = jogadorDados.tentativasAtuais;
      }
      
      // Define timeout
      const tempoTimeout = dados.grupos[groupId].tempoTimeout;
      jogadorDados.timeoutAte = agora + tempoTimeout;
      
      // Reinicia contagem de tentativas
      const tentativasAntes = jogadorDados.tentativasAtuais;
      jogadorDados.tentativasAtuais = 0;
      
      // Salva dados
      await salvarDadosRoleta(dados);
      
      // Mensagem personalizada com base no recorde
      let info;
      if (novoRecorde) {
        info = `Morreu em ${tentativasAntes}, um novo record! Seu máximo antes disso era ${jogadorDados.tentativasMaximo - tentativasAntes}.\nNeste grupo, você já morreu ${jogadorDados.mortes} vezes.`;
      } else {
        info = `Morreu em ${tentativasAntes}.\nNeste grupo, você já morreu ${jogadorDados.mortes} vezes.`;
      }
      
      // Reage com emoji de caixão
      try {
        await message.origin.react("⚰️");
      } catch (reactError) {
        logger.error('Erro ao aplicar reação de caixão:', reactError);
      }
      
      return new ReturnMessage({
        chatId: groupId,
        content: `💥🔫 *BANG* - *F no chat* ${info}`,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    } else {
      // Jogador sobreviveu
      // Salva dados
      await salvarDadosRoleta(dados);
      
      return new ReturnMessage({
        chatId: groupId,
        content: `💨🔫 *click* - Tá *safe*! \`\`\`${jogadorDados.tentativasAtuais}\`\`\``,
        options: {
          quotedMessageId: message.origin.id._serialized
        }
      });
    }
  } catch (error) {
    logger.error('Erro ao jogar roleta russa:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao jogar roleta russa. Por favor, tente novamente.'
    });
  }
}

/**
 * Mostra ranking da roleta russa
 * @param {WhatsAppBot} bot Instância do bot
 * @param {Object} message Dados da mensagem
 * @param {Array} args Argumentos do comando
 * @param {Object} group Dados do grupo
 * @returns {Promise<ReturnMessage>} Mensagem de retorno
 */
async function mostrarRanking(bot, message, args, group) {
  try {
    // Verifica se está em um grupo
    if (!message.group) {
      return new ReturnMessage({
        chatId: message.author,
        content: 'O ranking da roleta russa só pode ser visualizado em grupos.'
      });
    }
    
    const groupId = message.group;
    
    // Carrega dados da roleta
    let dados = await carregarDadosRoleta();
    
    // Inicializa dados do grupo se necessário
    dados = inicializarGrupo(dados, groupId);
    
    const grupoData = dados.grupos[groupId];
    
    // Se não houver jogadores, exibe mensagem
    if (Object.keys(grupoData.jogadores).length === 0) {
      return new ReturnMessage({
        chatId: groupId,
        content: '🏆 Ainda não há jogadores na roleta russa deste grupo.'
      });
    }
    
    // Prepara arrays para ranking
    const jogadoresArray = [];
    
    for (const [userId, jogador] of Object.entries(grupoData.jogadores)) {
      try {
        // Obtém nome do jogador
        let userName = "Jogador";
        try {
          const contact = await bot.client.getContactById(userId);
          userName = contact.pushname || contact.name || "Jogador";
        } catch (contactError) {
          logger.error('Erro ao obter contato para ranking:', contactError);
        }
        
        // Calcula melhor tentativa: o máximo entre o recorde e as tentativas atuais
        const melhorTentativa = Math.max(jogador.tentativasMaximo, jogador.tentativasAtuais || 0);
        
        jogadoresArray.push({
          id: userId,
          nome: userName,
          tentativasMaximo: melhorTentativa, // Usa o valor calculado
          tentativasAtuais: jogador.tentativasAtuais || 0,
          mortes: jogador.mortes
        });
      } catch (error) {
        logger.error('Erro ao processar jogador para ranking:', error);
      }
    }
    
    // Ordena por tentativas máximas (decrescente)
    const rankingSorte = [...jogadoresArray]
      .filter(j => j.tentativasMaximo > 0)
      .sort((a, b) => b.tentativasMaximo - a.tentativasMaximo)
      .slice(0, 10);
    
    // Ordena por número de mortes (decrescente)
    const rankingMortes = [...jogadoresArray]
      .filter(j => j.mortes > 0)
      .sort((a, b) => b.mortes - a.mortes)
      .slice(0, 10);
    
    // Monta mensagem de ranking
    let mensagem = "🏆 *Rankings Roleta Russa* 🔫\n\n";
    
    // Ranking de sorte (tentativas máximas sem morrer)
    mensagem += "🍀 *Sorte - Máx. Tentativas sem morrer*\n";
    if (rankingSorte.length > 0) {
      rankingSorte.forEach((jogador, index) => {
        const emoji = index < EMOJIS_RANKING.length ? EMOJIS_RANKING[index + 1] : "";
        const jogandoAtualmente = jogador.tentativasAtuais > 0 ? ` *(${jogador.tentativasAtuais} atual)*` : '';
        mensagem += `\t${emoji} ${index + 1}°: ${jogador.tentativasMaximo}${jogandoAtualmente} - ${jogador.nome}\n`;
      });
    } else {
      mensagem += "\tAinda não há jogadores neste ranking\n";
    }
    
    // Ranking de mortes
    mensagem += "\n🪦 *Número de Mortes*\n";
    if (rankingMortes.length > 0) {
      rankingMortes.forEach((jogador, index) => {
        const emoji = index < EMOJIS_RANKING.length ? EMOJIS_RANKING[index + 1] : "";
        mensagem += `\t${emoji} ${index + 1}°: ${jogador.mortes} - ${jogador.nome}\n`;
      });
    } else {
      mensagem += "\tAinda não há jogadores neste ranking\n";
    }
    
    return new ReturnMessage({
      chatId: groupId,
      content: mensagem
    });
  } catch (error) {
    logger.error('Erro ao mostrar ranking:', error);
    
    return new ReturnMessage({
      chatId: message.group || message.author,
      content: 'Erro ao mostrar ranking da roleta russa. Por favor, tente novamente.'
    });
  }
}


// Lista de comandos usando a classe Command
const commands = [
  new Command({
    name: 'roletarussa',
    description: 'Joga roleta russa, risco de ser silenciado',
    category: "jogos",
    cooldown: 0,
    reactions: {
      after: "🔫",
      error: "❌"
    },
    method: jogarRoletaRussa
  }),
  
  new Command({
    name: 'roletaranking',
    description: 'Mostra ranking da roleta russa',
    category: "jogos",
    cooldown: 10,
    reactions: {
      after: "🏆",
      error: "❌"
    },
    method: mostrarRanking
  })
];

// Verifica o status de timeout dos jogadores periodicamente
setInterval(async () => {
  try {
    const dados = await carregarDadosRoleta();
    const agora = Math.floor(Date.now() / 1000);
    let modificado = false;
    
    // Verifica cada grupo
    for (const groupId in dados.grupos) {
      const grupo = dados.grupos[groupId];
      
      // Verifica cada jogador
      for (const userId in grupo.jogadores) {
        const jogador = grupo.jogadores[userId];
        
        // Se o jogador está em timeout, mas o tempo acabou
        if (jogador.timeoutAte > 0 && jogador.timeoutAte <= agora) {
          jogador.timeoutAte = 0;
          modificado = true;
        }
      }
    }
    
    // Salva dados se houve modificação
    if (modificado) {
      await salvarDadosRoleta(dados);
    }
  } catch (error) {
    logger.error('Erro na verificação periódica de timeout da roleta russa:', error);
  }
}, 30000); // Verifica a cada 30 segundos

module.exports = { commands, carregarDadosRoleta, inicializarGrupo, salvarDadosRoleta };