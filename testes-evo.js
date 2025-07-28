// Exemplo cru de como chamar o EvoAPIClient
require('dotenv').config();
const EvolutionApiClient = require('./src/services/EvolutionApiClient');


const apiClient = new EvolutionApiClient(
  process.env.EVOLUTION_API_URL,
  process.env.EVOLUTION_API_KEY,
  "ravena-testes"
);

function testarText(){
	const evoPayload = {
      number: process.env.NUMERO_TESTES,
      delay: 0,
      linkPreview: false,
      text: "bzzzz"
    };

	apiClient.post('/message/sendText', evoPayload);
}

function testarSticker(){
	const evoPayload = {
      number: process.env.NUMERO_TESTES,
      delay: 0,
      linkPreview: false,
      sticker: "https://ravena.moothz.win/gifs/homer.gif"
    };

	apiClient.post('/message/sendSticker', evoPayload);
}


testarSticker();