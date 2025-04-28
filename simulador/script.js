// Elementos DOM
const chatContainer = document.getElementById('chat-container');
const typingInput = document.getElementById('typing-input');
const sendButton = document.getElementById('send-button');
const micButton = document.getElementById('mic-button');
const startButton = document.getElementById('start-conversation');
const resetButton = document.getElementById('reset-conversation');
const conversationCode = document.getElementById('conversation-code');
const whatsappContainer = document.getElementById('whatsapp-container');
const speedSlider = document.getElementById('speed-slider');
const speedValue = document.getElementById('speed-value');

// Conversão do valor do slider para multiplicador de velocidade
function getSpeedMultiplier(sliderValue) {
    if (sliderValue === 0) return 1; // Velocidade normal
    if (sliderValue > 0) return 1 + (sliderValue * 0.5); // Mais rápido: 1.5x, 2x, 2.5x, etc.
    return 1 / (1 + Math.abs(sliderValue) * 0.5); // Mais lento: 0.67x, 0.5x, 0.4x, etc.
}

// Atualizar o fator de velocidade quando o slider for alterado
speedSlider.addEventListener('input', () => {
    const value = parseInt(speedSlider.value);
    speedFactor = getSpeedMultiplier(value);
    
    // Atualizar texto de velocidade
    let displayText;
    if (value === 0) {
        displayText = "1x";
    } else if (value > 0) {
        displayText = speedFactor.toFixed(1) + "x";
    } else {
        displayText = speedFactor.toFixed(1) + "x";
    }
    
    speedValue.textContent = displayText;
});

// Variáveis para controlar a conversa
let conversation = [];
let currentMessageIndex = 0;
let allMessages = {};
let isTyping = false;
let speedFactor = 1.0; // Fator de velocidade padrão

// Exemplo de conversa
// let sampleConversation = [
//     {"id": 1, "origem": "remetente", "tipo": "audio", "duracao": "0:12", "delay": 0},
//     {"id": 2, "origem": "remetente", "mensagem": "!stt", "replyId": 1, "delay": 500},
//     {"id": 3, "origem": "destinatario", "mensagem": "<i>Oi, teste de speech-to-text</i>", "delay": 1000}
//     // {"id": 8, "origem": "destinatario", "tipo": "imagem", "legenda": "Veja essa imagem do produto", "delay": 1000},
//     // {"id": 9, "origem": "remetente", "tipo": "video", "legenda": "Aqui está um tutorial de como resolver", "delay": 1000}
// ];
let sampleConversation = [
    {"id": 1, "origem": "remetente", "mensagem": "Resposta do comando exemplo", "delay": 500},
    {"id": 2, "origem": "remetente", "mensagem": "!g-cmdAdd comando", "replyId": 1, "delay": 500},
    {"id": 3, "origem": "destinatario", "mensagem": "Comando personalizado 'comando' adicionado com sucesso.", "delay": 1000},
    {"id": 4, "origem": "remetente", "mensagem": "!comando", "delay": 500},
    {"id": 5, "origem": "destinatario", "mensagem": "Resposta do comando exemplo", "delay": 1000}
    // {"id": 8, "origem": "destinatario", "tipo": "imagem", "legenda": "Veja essa imagem do produto", "delay": 1000},
    // {"id": 9, "origem": "remetente", "tipo": "video", "legenda": "Aqui está um tutorial de como resolver", "delay": 1000}
];


// Carregar exemplo
conversationCode.value = JSON.stringify(sampleConversation, null, 2);

// Iniciar conversa a partir do código
startButton.addEventListener('click', () => {
    try {
        conversation = JSON.parse(conversationCode.value);
        resetChat();
        startConversation();
    } catch (error) {
        alert('Erro no formato do código da conversa: ' + error.message);
    }
});

// Resetar conversa
resetButton.addEventListener('click', resetChat);

// Mostrar botão de envio quando estiver digitando
typingInput.addEventListener('input', () => {
    if (typingInput.value.trim() !== '') {
        micButton.style.display = 'none';
        sendButton.style.display = 'flex';
    } else {
        micButton.style.display = 'flex';
        sendButton.style.display = 'none';
    }
});

// Função para limpar o chat
function resetChat() {
    chatContainer.innerHTML = '';
    currentMessageIndex = 0;
    allMessages = {};
}

// Iniciar a simulação da conversa
function startConversation() {
    if (conversation.length === 0) return;
    
    processNextMessage();
}

// Rolagem suave do chat
function smoothScrollToBottom() {
    const scrollHeight = chatContainer.scrollHeight;
    const currentScrollPosition = chatContainer.scrollTop;
    const targetScrollPosition = scrollHeight - chatContainer.clientHeight;
    
    if (targetScrollPosition <= currentScrollPosition) return;
    
    const distance = targetScrollPosition - currentScrollPosition;
    let startTime = null;
    const duration = 300;
    
    function animation(currentTime) {
        if (startTime === null) startTime = currentTime;
        const timeElapsed = currentTime - startTime;
        const run = Math.min(ease(timeElapsed / duration), 1);
        chatContainer.scrollTop = currentScrollPosition + distance * run;
        
        if (timeElapsed < duration) {
            requestAnimationFrame(animation);
        }
    }
    
    function ease(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }
    
    requestAnimationFrame(animation);
}

// Processar a próxima mensagem na conversa
function processNextMessage() {
    if (currentMessageIndex >= conversation.length) return;
    
    const message = conversation[currentMessageIndex];
    // Aplicar o fator de velocidade ao delay da mensagem
    const delay = (message.delay || 500) / speedFactor;
    
    // Armazenar mensagem no objeto para referência futura (para respostas)
    allMessages[message.id] = message;
    
    // Adicionar um delay antes de processar a mensagem
    setTimeout(() => {
        // Se existe replyId, animar a mensagem referenciada independentemente da origem
        if (message.replyId && allMessages[message.replyId]) {
            simulateSwipeReply(message);
        } else if (message.origem === 'remetente') {
            simulateRealTyping(message);
        } else {
            addMessage(message);
            currentMessageIndex++;
            processNextMessage();
            smoothScrollToBottom();
        }
    }, delay);
}

// Simular o deslize para responder
function simulateSwipeReply(message) {
    // Encontrar a mensagem original que será respondida
    const originalMsgElements = document.querySelectorAll('.message');
    let originalMsgElement = null;
    
    // Procurar o elemento correspondente ao replyId
    for (let i = 0; i < originalMsgElements.length; i++) {
        const msgId = originalMsgElements[i].getAttribute('data-message-id');
        if (msgId === message.replyId.toString()) {
            originalMsgElement = originalMsgElements[i];
            break;
        }
    }
    
    // Se não encontrou o elemento, continuar com o fluxo normal
    if (!originalMsgElement) {
        if (message.origem === 'remetente') {
            simulateRealTyping(message);
        } else {
            addMessage(message);
            currentMessageIndex++;
            processNextMessage();
        }
        return;
    }
    
    // Determinar a direção do swipe com base na origem da mensagem
    const isOriginalSender = originalMsgElement.classList.contains('sender');
    const swipeAmount = isOriginalSender ? 40 : 40;
    const swipeProperty = isOriginalSender ? "marginRight" : "marginLeft"; // Direção oposta dependendo da origem
    const swipeAnimationProperty = isOriginalSender ? "margin-right" : "margin-left"; // Direção oposta dependendo da origem
    
    // Adicionar um delay antes de iniciar a animação (ajustado pela velocidade)
    setTimeout(() => {
        // Armazenar posição original
        const originalMargin = window.getComputedStyle(originalMsgElement)[swipeProperty];
        
        // Adicionar transição (ajustada pela velocidade)
        const animationDuration = 300 / speedFactor;
        originalMsgElement.style.transition = `${swipeAnimationProperty} ${animationDuration}ms ease-in-out`;
        
        // Animar deslizando para a direção determinada
        originalMsgElement.style[swipeProperty] = `${swipeAmount}px`;
        
        // Voltar para a posição original
        setTimeout(() => {
            originalMsgElement.style[swipeProperty] = originalMargin;
            
            // Depois da animação, prosseguir com a resposta
            setTimeout(() => {
                // Enviar a mensagem de resposta adequadamente
                if (message.origem === 'remetente') {
                    simulateRealTyping(message);
                } else {
                    addMessage(message);
                    currentMessageIndex++;
                    processNextMessage();
                    smoothScrollToBottom();
                }
            }, 150 / speedFactor);
        }, animationDuration);
    }, 500 / speedFactor); // Delay antes da animação (ajustado pela velocidade)
}

// Simular digitação real na caixa de texto para mensagens do remetente
function simulateRealTyping(message) {
    if (message.tipo === 'audio') {
        simulateAudioRecording(message);
        return;
    } else if (message.tipo === '   ' || message.tipo === 'video') {
        simulateCameraUsage(message);
        return;
    }
    
    // Exibir indicador de digitação brevemente (200ms ajustado pela velocidade)
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.display = 'flex';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    chatContainer.appendChild(typingIndicator);
    smoothScrollToBottom();
    
    // Remover indicador após tempo ajustado pela velocidade
    setTimeout(() => {
        typingIndicator.remove();
        
        // Agora simular a digitação na caixa de texto
        if (message.mensagem) {
            const textLength = message.mensagem.length;
            // Ajustar velocidade de digitação com base no fator de velocidade
            const typingSpeed = Math.min(500, textLength * 10) / speedFactor;
            let currentIndex = 0;
            
            // Mostrar o botão de envio
            micButton.style.display = 'none';
            sendButton.style.display = 'flex';
            
            // Função para digitar caractere por caractere
            function typeCharacter() {
                if (currentIndex < textLength) {
                    typingInput.value = message.mensagem.substring(0, currentIndex + 1);
                    currentIndex++;
                    setTimeout(typeCharacter, typingSpeed / textLength);
                } else {
                    // Digitação completa, simular envio (com delay ajustado)
                    setTimeout(() => {
                        typingInput.value = '';
                        micButton.style.display = 'flex';
                        sendButton.style.display = 'none';
                        
                        addMessage(message);
                        currentMessageIndex++;
                        processNextMessage();
                        smoothScrollToBottom();
                    }, 300 / speedFactor); // Delay antes de enviar (ajustado)
                }
            }
            
            typeCharacter();
        } else {
            // Se não houver mensagem de texto (ex: apenas mídia)
            addMessage(message);
            currentMessageIndex++;
            processNextMessage();
            smoothScrollToBottom();
        }
    }, 200 / speedFactor);
}

// Simular gravação de áudio
function simulateAudioRecording(message) {
    // Primeiro exibir indicador de digitação brevemente (tempo ajustado pela velocidade)
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.display = 'flex';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    chatContainer.appendChild(typingIndicator);
    smoothScrollToBottom();
    
    setTimeout(() => {
        typingIndicator.remove();
        
        // Agora simular a gravação
        micButton.style.backgroundColor = 'red';
        
        // Tempo de gravação simulado (ajustado pela velocidade)
        setTimeout(() => {
            micButton.style.backgroundColor = '#22056b';
            addMessage(message);
            currentMessageIndex++;
            processNextMessage();
            smoothScrollToBottom();
        }, 2000 / speedFactor);
    }, 200 / speedFactor);
}

// Simular uso da câmera
function simulateCameraUsage(message) {
    // Primeiro exibir indicador de digitação brevemente (tempo ajustado pela velocidade)
    const typingIndicator = document.createElement('div');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.style.display = 'flex';
    typingIndicator.innerHTML = '<span></span><span></span><span></span>';
    chatContainer.appendChild(typingIndicator);
    smoothScrollToBottom();
    
    setTimeout(() => {
        typingIndicator.remove();
        
        // Destaque no botão de anexo
        const attachButton = document.querySelector('.attach-button');
        attachButton.style.color = '#22056b';
        
        setTimeout(() => {
            attachButton.style.color = '#888';
            addMessage(message);
            currentMessageIndex++;
            processNextMessage();
            smoothScrollToBottom();
        }, 1500 / speedFactor);
    }, 200 / speedFactor);
}

// Adicionar mensagem ao chat
function addMessage(message) {
    const msgElement = document.createElement('div');
    msgElement.className = `message ${message.origem === 'remetente' ? 'sender' : 'receiver'}`;
    msgElement.setAttribute('data-message-id', message.id);
    
    // Verificar se há uma resposta
    if (message.replyId && allMessages[message.replyId]) {
        const replyToMsg = allMessages[message.replyId];
        const replyContainer = document.createElement('div');
        replyContainer.className = 'reply-container';
        
        let replyContent = '';
        if (replyToMsg.tipo === 'audio') {
            replyContent = 'Áudio';
        } else if (replyToMsg.tipo === 'imagem') {
            replyContent = replyToMsg.legenda || 'Imagem';
        } else if (replyToMsg.tipo === 'video') {
            replyContent = replyToMsg.legenda || 'Vídeo';
        } else {
            replyContent = replyToMsg.mensagem;
        }
        
        replyContainer.innerHTML = `<div class="reply-text">${replyContent}</div>`;
        msgElement.appendChild(replyContainer);
    }
    
    // Conteúdo baseado no tipo de mensagem
    if (message.tipo === 'audio') {
        // Criar componente de áudio
        const audioComponent = document.createElement('div');
        audioComponent.className = 'message-audio';
        audioComponent.innerHTML = `
            <div class="audio-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
                    <path fill="currentColor" d="M12 1c-4.97 0-9 4.03-9 9v7c0 1.66 1.34 3 3 3h3v-8H5v-2c0-3.87 3.13-7 7-7s7 3.13 7 7v2h-4v8h3c1.66 0 3-1.34 3-3v-7c0-4.97-4.03-9-9-9z"></path>
                </svg>
            </div>
            <div class="audio-waveform">
                <div class="audio-progress"></div>
            </div>
            <div class="audio-duration">${message.duracao || '0:00'}</div>
        `;
        msgElement.appendChild(audioComponent);
    } else if (message.tipo === 'imagem') {
        // Criar componente de imagem
        const mediaComponent = document.createElement('div');
        mediaComponent.className = 'message-media';
        mediaComponent.innerHTML = `<img src="/api/placeholder/200/150" alt="Imagem">`;
        msgElement.appendChild(mediaComponent);
        
        if (message.legenda) {
            const captionDiv = document.createElement('div');
            captionDiv.className = 'message-text';
            captionDiv.innerHTML = message.legenda;
            msgElement.appendChild(captionDiv);
        }
    } else if (message.tipo === 'video') {
        // Criar componente de vídeo
        const mediaComponent = document.createElement('div');
        mediaComponent.className = 'message-media';
        mediaComponent.innerHTML = `
            <div style="position: relative; background-color: #000; width: 200px; height: 150px; display: flex; justify-content: center; align-items: center;">
                <div style="color: white; font-size: 40px;">▶</div>
            </div>
        `;
        msgElement.appendChild(mediaComponent);
        
        if (message.legenda) {
            const captionDiv = document.createElement('div');
            captionDiv.className = 'message-text';
            captionDiv.innerHTML = message.legenda;
            msgElement.appendChild(captionDiv);
        }
    } else {
        // Mensagem de texto padrão
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.innerHTML = message.mensagem;
        msgElement.appendChild(textDiv);
    }
    
    // Adicionar hora e status
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    
    // Hora atual formatada
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    timeDiv.textContent = `${hours}:${minutes}`;
    
    // Adicionar ícones de status para mensagens enviadas
    if (message.origem === 'remetente') {
        timeDiv.innerHTML += `
            <span class="message-status">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 15" width="16" height="15">
                    <path fill="currentColor" d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.064-.512zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.366.366 0 0 0-.515.006l-.423.433a.364.364 0 0 0 .006.514l3.258 3.185c.143.14.361.125.484-.033l6.272-8.048a.365.365 0 0 0-.063-.51z"></path>
                </svg>
            </span>
        `;
    }
    
    msgElement.appendChild(timeDiv);
    
    // Adicionar ao chat e rolar para o final suavemente
    chatContainer.appendChild(msgElement);
    smoothScrollToBottom();
}

// Remover todas as funções relacionadas à gravação de vídeo
async function getDisplayMedia() {}
function startRecording() {}
function stopRecording() {}

// Carregar com a conversa de exemplo
conversationCode.value = JSON.stringify(sampleConversation, null, 2);