// WhatsAppBotBaileys.js
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    // makeInMemoryStore, // REMOVED
    jidNormalizedUser,
    downloadMediaMessage,
    getContentType,
    Mimetype,
    WAProto,
    Browsers,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const qrimg = require('qr-image');
const fs = require('fs');
const path = require('path');
const P = require('pino');
const { URL } = require('url');

// Local dependencies
const Database = require('./utils/Database');
const Logger = require('./utils/Logger');
const LoadReport = require('./LoadReport');
const ReactionsHandler = require('./ReactionsHandler');
const InviteSystem = require('./InviteSystem');
const StreamSystem = require('./StreamSystem');
const LLMService = require('./services/LLMService');
const AdminUtils = require('./utils/AdminUtils');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// BaileysMessageMedia and BaileysLocation classes remain the same as previously defined...
// Helper for MessageMedia equivalent
class BaileysMessageMedia {
    constructor(mimetype, data, filename = null) {
        this.mimetype = mimetype;
        this.data = data; // Buffer or stream (Baileys prefers Buffer for sending)
        this.filename = filename;
        if (Buffer.isBuffer(data)) {
            this.size = data.length;
        }
    }

    static async fromFilePath(filePath) {
        let mimetype = 'application/octet-stream';
        try {
            const mime = await import('mime-types');
            mimetype = mime.lookup(filePath) || 'application/octet-stream';
        } catch (e) {
            console.warn("[BaileysMessageMedia] mime-types library not found or failed to load. Please install it: npm install mime-types. Falling back to default mimetype.", e);
        }
        const data = fs.readFileSync(filePath);
        return new BaileysMessageMedia(mimetype, data, path.basename(filePath));
    }

    static async fromUrl(url, options = { unsafeMime: false, filename: null }) {
        if (typeof fetch === "undefined") {
            throw new Error("[BaileysMessageMedia] Global fetch is not available. Install node-fetch or use Node 18+ for fromUrl.");
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`[BaileysMessageMedia] Failed to fetch URL (${response.status}): ${response.statusText}`);
        }
        const data = Buffer.from(await response.arrayBuffer());
        let mimetype = response.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';

        if (options.unsafeMime && options.mimetype) {
            mimetype = options.mimetype;
        }

        let filename = options.filename;
        if (!filename) {
            try {
                filename = path.basename(new URL(url).pathname);
            } catch { /* ignore invalid URL for pathname extraction */ }
        }
        const disposition = response.headers.get('content-disposition');
        if (disposition) {
            const filenameMatch = disposition.match(/filename="?(.+?)"?/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }
        filename = filename || 'file_from_url';

        return new BaileysMessageMedia(mimetype, data, filename);
    }
}

// Helper for Location equivalent
class BaileysLocation {
    constructor(latitude, longitude, description = null, name = null) { // Added name to match wweb.js Location
        this.latitude = latitude;
        this.longitude = longitude;
        this.description = description; // Corresponds to wweb.js Location.description
        this.name = name; // Corresponds to wweb.js Location.name (often used for address/place name)
    }
}


class WhatsAppBotBaileys {
    constructor(options) {
        this.id = options.id;
        this.phoneNumber = options.phoneNumber;
        this.eventHandler = options.eventHandler;
        this.prefix = options.prefix || process.env.DEFAULT_PREFIX || '!';
        
        this.logger = new Logger(`bot-${this.id}-baileys`);
        this.pinoLogger = P({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' });

        this.sock = null;
        
        // Simple in-memory caches
        this.contactsCache = new Map(); // Stores { jid: string, pushName?: string, name?: string }
        this.messageCache = new Map();  // Stores { messageKey: string, WAMessage }
        this.MAX_MESSAGE_CACHE_SIZE = parseInt(process.env.MAX_MESSAGE_CACHE_SIZE) || 200; // Max messages to keep in cache

        this.database = Database.getInstance();
        this.isConnected = false;
        // ... (rest of the constructor properties as before) ...
        this.safeMode = options.safeMode !== undefined ? options.safeMode : (process.env.SAFE_MODE === 'true');
        this.otherBots = options.otherBots || [];
        this.blockedContacts = []; 

        this.ignorePV = options.ignorePV || false;
        this.whitelist = options.whitelistPV || []; 
        this.ignoreInvites = options.ignoreInvites || false;
        this.grupoLogs = options.grupoLogs || process.env.GRUPO_LOGS;
        this.grupoInvites = options.grupoInvites || process.env.GRUPO_INVITES;
        this.grupoAvisos = options.grupoAvisos || process.env.GRUPO_AVISOS;
        this.grupoInteracao = options.grupoInteracao || process.env.GRUPO_INTERACAO;
        this.grupoEstabilidade = options.grupoEstabilidade || process.env.GRUPO_ESTABILIDADE;
        this.linkGrupao = options.linkGrupao || process.env.LINK_GRUPO_INTERACAO;
        this.linkAvisos = options.linkAvisos || process.env.LINK_GRUPO_AVISOS;
        this.userAgent = options.userAgent || process.env.USER_AGENT; 

        this.lastMessageReceived = Date.now();
        this.startupTime = Date.now();
        this.lastRestartForDelay = 0; 

        this.loadReport = new LoadReport(this);
        this.inviteSystem = new InviteSystem(this);
        this.reactionHandler = new ReactionsHandler();
        this.streamSystem = null; 
        this.streamMonitor = null;
        this.stabilityMonitor = options.stabilityMonitor ?? false;
        this.llmService = new LLMService({});
        this.adminUtils = AdminUtils.getInstance();

        this.sessionDir = path.join(__dirname, '..', '.baileys_auth', this.id);
        if (!fs.existsSync(this.sessionDir)) {
            fs.mkdirSync(this.sessionDir, { recursive: true });
        }
        
        this.authState = null;
        this.saveCreds = null;
    }

    async initialize() {
        this.logger.info(`Inicializando instância de bot ${this.id} com Baileys, prefixo ${this.prefix}`);
        this.database.registerBotInstance(this);
        this.startupTime = Date.now();

        const { state, saveCreds } = await useMultiFileAuthState(path.join(this.sessionDir, 'auth_info_baileys'));
        this.authState = state;
        this.saveCreds = saveCreds;

        const { version, isLatest } = await fetchLatestBaileysVersion();
        this.logger.info(`Usando Baileys v${version.join('.')}, é a mais recente: ${isLatest}`);

        this.sock = makeWASocket({
            version,
            logger: this.pinoLogger,
            printQRInTerminal: false,
            auth: this.authState,
            //browser: this.userAgent ? Browsers.custom(this.userAgent) : Browsers.appropriate('Desktop'),
            generateHighQualityLinkPreview: true,
            getMessage: async (key) => {
                const msgKey = `${key.remoteJid}_${key.id}`;
                if (this.messageCache.has(msgKey)) {
                    return this.messageCache.get(msgKey).message || undefined;
                }
                this.logger.debug(`[getMessage] Mensagem ${key.id} de ${key.remoteJid} não encontrada no cache.`);
                // For a persistent store, you would query your DB/file here.
                // Returning undefined means Baileys might not be able to reconstruct context for replies to older messages.
                return undefined; 
            }
        });

        // No store.bind() anymore

        const donations = await this.database.getDonations();
        for(let don of donations){
            if(don.numero && don.numero?.length > 5){
                this.whitelist.push(don.numero.replace(/\D/g, ''));
            }
        }
        this.logger.info(`[whitelist][${this.id}] ${this.whitelist.length} números na whitelist do PV.`);

        this.registerEventHandlers();
        return this;
    }

    // notInWhitelist, rndString, prepareOtherBotsBlockList, shouldDiscardMessage remain the same

    registerEventHandlers() {
        // connection.update logic remains largely the same

        this.sock.ev.on('creds.update', this.saveCreds); // Crucial for session persistence

        this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
            if (type !== 'notify' && type !== 'append') return;

            for (const baileysMessage of messages) {
                if (!baileysMessage.message) continue;

                // Add message to cache
                const msgIdKey = `${baileysMessage.key.remoteJid}_${baileysMessage.key.id}`;
                this.messageCache.set(msgIdKey, baileysMessage);
                // Evict oldest if cache exceeds size
                if (this.messageCache.size > this.MAX_MESSAGE_CACHE_SIZE) {
                    const oldestKey = this.messageCache.keys().next().value;
                    this.messageCache.delete(oldestKey);
                }

                // Update contactsCache with sender's pushName
                const senderJid = jidNormalizedUser(baileysMessage.key.participant || baileysMessage.key.remoteJid);
                if (senderJid && baileysMessage.pushName) {
                    const existingContact = this.contactsCache.get(senderJid) || { jid: senderJid };
                    if (existingContact.pushName !== baileysMessage.pushName) {
                        existingContact.pushName = baileysMessage.pushName;
                        this.contactsCache.set(senderJid, existingContact);
                        // this.logger.debug(`[contactsCache] Updated pushName for ${senderJid} to "${baileysMessage.pushName}"`);
                    }
                }

                // If it's a contact card, update cache from vCard display name
                if (getContentType(baileysMessage.message) === 'contactMessage') {
                    const contactMsg = baileysMessage.message.contactMessage;
                    const vcard = contactMsg.vcard;
                    try {
                        // Try to parse JID from vCard (often in TEL;waid=...)
                        const vcardJidMatch = vcard.match(/TEL(?:;[^:]*)?;waid=([0-9]+):/);
                        if (vcardJidMatch && vcardJidMatch[1]) {
                            const vcardContactJid = jidNormalizedUser(`${vcardJidMatch[1]}@s.whatsapp.net`);
                            if (vcardContactJid && contactMsg.displayName) {
                                const existingVCardContact = this.contactsCache.get(vcardContactJid) || { jid: vcardContactJid };
                                if (existingVCardContact.name !== contactMsg.displayName) { // 'name' here from vcard is usually a good quality name
                                    existingVCardContact.name = contactMsg.displayName;
                                    this.contactsCache.set(vcardContactJid, existingVCardContact);
                                    // this.logger.debug(`[contactsCache] Updated name for ${vcardContactJid} from vCard to "${contactMsg.displayName}"`);
                                }
                            }
                        }
                    } catch (e) { this.logger.warn(`Error parsing vCard for contact cache: ${e}`); }
                }


                // ... (rest of messages.upsert logic: stabilityMonitor, shouldDiscardMessage, timestamps, blocked checks)
                // The call to formatMessage will now use contactsCache
                const responseTime = 0;
                 const formattedMessage = await this.formatMessage(baileysMessage, responseTime);
                 if (formattedMessage) {
                     this.eventHandler.onMessage(this, formattedMessage);
                 }
            }
        });

        this.sock.ev.on('contacts.update', (updates) => {
            for (const update of updates) {
                const jid = jidNormalizedUser(update.id);
                if (!jid) continue;

                let contact = this.contactsCache.get(jid) || { jid };
                if (update.notify) contact.pushName = update.notify; // `notify` is often the pushName
                if (update.name) contact.name = update.name;         // `name` might be a user-saved name
                
                this.contactsCache.set(jid, contact);
                // this.logger.debug(`[contactsCache] Contact update for ${jid}: Name='${contact.name}', PushName='${contact.pushName}'`);
            }
        });
        
        this.sock.ev.on('chats.update', (updates) => { // Can provide group names or contact names
            for (const chatUpdate of updates) {
                const jid = jidNormalizedUser(chatUpdate.id);
                if (!jid) continue;

                if (chatUpdate.name) { // `name` here is group subject or contact's saved name
                    let contact = this.contactsCache.get(jid) || { jid };
                    contact.name = chatUpdate.name;
                    this.contactsCache.set(jid, contact);
                    // this.logger.debug(`[contactsCache] Chat update for ${jid}: Set name to '${chatUpdate.name}'`);
                }
            }
        });


        // messages.reaction logic remains largely the same

        this.sock.ev.on('group-participants.update', async (update) => {
            const { id: groupId, participants, action, author } = update;
            // Fetch group name, fallback to groupId
            let groupName = groupId;
            try {
                const groupMeta = await this.sock.groupMetadata(groupId);
                if (groupMeta && groupMeta.subject) groupName = groupMeta.subject;
            } catch (e) { this.logger.warn(`Failed to get group metadata for ${groupId} during participants.update: ${e}`); }


            const getContactInfo = (jidStr) => {
                if (!jidStr) return { id: { _serialized: 'unknown@s.whatsapp.net' }, name: 'Desconhecido', pushname: 'Desconhecido' };
                const normJid = jidNormalizedUser(jidStr);
                const cached = this.contactsCache.get(normJid);
                return {
                    id: { _serialized: normJid },
                    name: cached?.name || cached?.pushName || normJid.split('@')[0],
                    pushname: cached?.pushName || cached?.name || normJid.split('@')[0]
                };
            };

            const responsibleContact = getContactInfo(author);

            for (const userId of participants) {
                const userContact = getContactInfo(userId);
                const eventData = {
                    group: { id: groupId, name: groupName },
                    user: userContact,
                    responsavel: responsibleContact,
                    origin: update 
                };
                if (action === 'add') this.eventHandler.onGroupJoin(this, eventData);
                else if (action === 'remove') this.eventHandler.onGroupLeave(this, eventData);
            }
        });

        // call logic remains largely the same
        // ... connection.update logic
        this.sock.ev.on('connection.update', async (update) => {
            //console.log(update);
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                const qrCodeLocal = path.join(this.database.databasePath, `qrcode_${this.id}.png`);
                try {
                    const qr_png = qrimg.image(qr, { type: 'png' });
                    qr_png.pipe(fs.createWriteStream(qrCodeLocal));
                    this.logger.info(`QR Code recebido, escaneie para autenticar a '${this.id}'\n\t-> ${qrCodeLocal}`);
                } catch (e) { this.logger.error(`Erro ao salvar QR como imagem: ${e}`); }
                qrcode.generate(qr, { small: true });
                this.logger.info(`------------ qrcode '${this.id}' -----------`);
            }

            if (connection === 'close') {
                this.isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const reason = DisconnectReason[statusCode] || `Desconhecido (code ${statusCode})`;
                this.logger.info(`Conexão fechada, motivo: ${reason}`);
                this.eventHandler.onDisconnected(this, reason);

                if (statusCode === DisconnectReason.loggedOut) {
                    this.logger.error('Dispositivo deslogado, limpando credenciais e parando.');
                    try {
                        const authPath = path.join(this.sessionDir, 'auth_info_baileys');
                        if (fs.existsSync(authPath)) {
                            fs.rmSync(authPath, { recursive: true, force: true }); // Remove auth files
                            this.logger.info("Arquivos de autenticação removidos.");
                        }
                        process.exit(1); 
                    } catch (e) {
                        this.logger.error("Erro ao limpar pasta de sessão de autenticação:", e);
                         process.exit(1); // Still exit
                    }
                } else if (statusCode !== DisconnectReason.connectionClosed && 
                           statusCode !== DisconnectReason.connectionLost && // Baileys often retries these
                           statusCode !== DisconnectReason.timedOut &&
                           ///statusCode !== DisconnectReason.restartRequired && 
                           statusCode !== DisconnectReason.connectionReplaced) { // Not user-initiated disconnects
                    this.logger.warn(`Conexão perdida (${reason}). Tentando reinicializar o bot...`);
                     setTimeout(() => this.restartBot(`Reconexão automática devido a: ${reason}`).catch(err => {
                        this.logger.error('Falha crítica na tentativa de reinicialização automática:', err);
                    }), 10000 + Math.random() * 5000); // Delay with jitter
                }
            } else if (connection === 'open') {
                this.isConnected = true;
                this.logger.info(`[${this.id}] Conectado no whats com Baileys. ID: ${jidNormalizedUser(this.sock.user.id)}`);
                this.eventHandler.onConnected(this);

                // On connected logic (send messages, fetch blocklist, etc.)
                if (this.grupoLogs && this.isConnected) { /* ... send message ... */ }
                if (this.grupoAvisos && this.isConnected) { /* ... send message ... */ }

                try {
                    const fetchedBlocklist = await this.sock.fetchBlocklist();
                    this.blockedContacts = fetchedBlocklist.map(jid => ({ id: { _serialized: jid } }));
                    this.logger.info(`Carregados ${this.blockedContacts.length} contatos bloqueados (Baileys)`);
                    if (this.isConnected && this.otherBots.length > 0) {
                        this.prepareOtherBotsBlockList();
                    }
                } catch (error) {
                    this.logger.error('Erro ao carregar contatos bloqueados (Baileys):', error);
                    this.blockedContacts = [];
                }
                
                if (!this.streamSystem && StreamSystem) { 
                    this.streamSystem = new StreamSystem(this);
                    if(typeof this.streamSystem.initialize === 'function') await this.streamSystem.initialize();
                    this.streamMonitor = this.streamSystem.streamMonitor;
                }
            }
        });
        // ... other event handlers like messages.reaction, call ...
        this.sock.ev.on('messages.reaction', async ({ reactions }) => {
            if (this.shouldDiscardMessage()) {
                this.logger.debug(`Descartando reação (Baileys) durante período inicial de ${this.id}`);
                return;
            }

            for (const reactionData of reactions) { 
                try {
                    const senderId = reactionData.key.participant || reactionData.key.remoteJid; 
                    const botItself = jidNormalizedUser(this.sock.user.id);

                    if (jidNormalizedUser(senderId) !== botItself) {
                        if (this.blockedContacts.some(c => c.id._serialized === jidNormalizedUser(senderId))) {
                            this.logger.debug(`Ignorando reaction (Baileys) de contato bloqueado: ${senderId}`);
                            continue;
                        }
                        
                        const adaptedReaction = {
                            msgId: { 
                                _serialized: reactionData.key.id,
                                remote: reactionData.key.remoteJid, 
                            },
                            id: reactionData.key, 
                            senderId: jidNormalizedUser(senderId),
                            reaction: reactionData.reaction.text, 
                            timestamp: reactionData.reaction.senderTimestampMs ? Math.floor(reactionData.reaction.senderTimestampMs / 1000) : this.getCurrentTimestamp(),
                        };
                        this.reactionHandler.processReaction(this, adaptedReaction);
                    }
                } catch (error) {
                    this.logger.error('Erro ao tratar reação de mensagem (Baileys):', error);
                }
            }
        });

        this.sock.ev.on('call', async (calls) => { 
            for (const call of calls) {
                if (call.status === 'offer' && !call.isGroup) { 
                    this.logger.info(`[Call][Baileys] Rejeitando chamada de ${call.from} (ID: ${call.id})`);
                    try {
                        await this.sock.rejectCall(call.id, call.from);
                    } catch (e) {
                        this.logger.error(`[Call][Baileys] Falha ao rejeitar chamada: ${e}`);
                    }
                }
            }
        });

    }


    async formatMessage(baileysMessage, responseTime) {
        try {
            const msgContent = baileysMessage.message;
            if (!msgContent) return null;

            const chatId = baileysMessage.key.remoteJid;
            const isGroup = chatId.endsWith('@g.us');
            const senderJid = jidNormalizedUser(baileysMessage.key.participant || baileysMessage.key.remoteJid);
            
            const cachedContact = this.contactsCache.get(senderJid);
            const authorName = cachedContact?.name || cachedContact?.pushName || baileysMessage.pushName || senderJid.split('@')[0];
            
            this.loadReport.trackReceivedMessage(isGroup, responseTime, chatId);

            let type = 'unknown';
            let content = '';
            let caption = null;
            let mediaWrapper = null;

            const messageType = getContentType(msgContent);

            if (messageType === 'conversation') {
                type = 'text';
                content = msgContent.conversation;
            } else if (messageType === 'extendedTextMessage') {
                type = 'text';
                content = msgContent.extendedTextMessage.text;
            } else if (messageType === 'imageMessage') {
                type = 'image';
                const imgMsg = msgContent.imageMessage;
                caption = imgMsg.caption;
                const buffer = await downloadMediaMessage(baileysMessage, 'buffer', {}, { logger: this.pinoLogger, reuploadRequest: this.sock.updateMediaMessage });
                mediaWrapper = new BaileysMessageMedia(imgMsg.mimetype || Mimetype.jpeg, buffer, imgMsg.fileName || 'image.jpg');
            } else if (messageType === 'videoMessage') {
                type = 'video';
                const vidMsg = msgContent.videoMessage;
                caption = vidMsg.caption;
                const buffer = await downloadMediaMessage(baileysMessage, 'buffer', {}, { logger: this.pinoLogger, reuploadRequest: this.sock.updateMediaMessage });
                mediaWrapper = new BaileysMessageMedia(vidMsg.mimetype || Mimetype.mp4, buffer, vidMsg.fileName || 'video.mp4');
            } else if (messageType === 'audioMessage') {
                type = msgContent.audioMessage.ptt ? 'ptt' : 'audio';
                const audMsg = msgContent.audioMessage;
                const buffer = await downloadMediaMessage(baileysMessage, 'buffer', {}, { logger: this.pinoLogger, reuploadRequest: this.sock.updateMediaMessage });
                mediaWrapper = new BaileysMessageMedia(audMsg.mimetype || Mimetype.ogg, buffer, 'audio.ogg');
            } else if (messageType === 'documentMessage') {
                type = 'document';
                const docMsg = msgContent.documentMessage;
                caption = docMsg.caption; 
                const buffer = await downloadMediaMessage(baileysMessage, 'buffer', {}, { logger: this.pinoLogger, reuploadRequest: this.sock.updateMediaMessage });
                mediaWrapper = new BaileysMessageMedia(docMsg.mimetype, buffer, docMsg.fileName || 'file');
            } else if (messageType === 'stickerMessage') {
                type = 'sticker';
                const stickerMsg = msgContent.stickerMessage;
                const buffer = await downloadMediaMessage(baileysMessage, 'buffer', {}, { logger: this.pinoLogger, reuploadRequest: this.sock.updateMediaMessage });
                mediaWrapper = new BaileysMessageMedia(stickerMsg.mimetype || Mimetype.webp, buffer, 'sticker.webp');
            } else if (messageType === 'locationMessage') {
                type = 'location';
                const locMsg = msgContent.locationMessage;
                mediaWrapper = new BaileysLocation(locMsg.degreesLatitude, locMsg.degreesLongitude, locMsg.address, locMsg.name);
            } else if (messageType === 'contactMessage') {
                type = 'contact';
                const contactMsg = msgContent.contactMessage;
                mediaWrapper = { 
                    displayName: contactMsg.displayName,
                    vcard: contactMsg.vcard,
                    id: { _serialized: contactMsg.vcard?.match(/TEL.*waid=([0-9]+):/)?.[1].replace(/\D/g, '') + '@s.whatsapp.net' || 'unknown@s.whatsapp.net' },
                    name: contactMsg.displayName,
                };
            } else if (messageType === 'contactsArrayMessage') {
                 type = 'contact_array';
                 mediaWrapper = msgContent.contactsArrayMessage.contacts.map(c => ({
                    displayName: c.displayName,
                    vcard: c.vcard,
                    id: { _serialized: c.vcard?.match(/TEL.*waid=([0-9]+):/)?.[1].replace(/\D/g, '') + '@s.whatsapp.net' || 'unknown@s.whatsapp.net' },
                    name: c.displayName,
                 }));
            } else {
                this.logger.warn(`Tipo de mensagem não totalmente suportado para formatação (Baileys): ${messageType}`, msgContent);
                type = messageType || 'unknown';
                content = `[Conteúdo não processado para tipo: ${type}]`;
            }
            
            return {
                group: isGroup ? chatId : null,
                author: senderJid,
                authorName: authorName,
                type,
                content: mediaWrapper || content,
                caption,
                origin: baileysMessage, 
                responseTime
            };

        } catch (error) {
            this.logger.error('Erro ao formatar mensagem (Baileys):', error, baileysMessage);
            return null;
        }
    }


    async createContact(phoneNumber, name, surname) {
        try {
            const normalizedJid = jidNormalizedUser(phoneNumber.includes('@') ? phoneNumber : `${phoneNumber.replace(/\D/g, '')}@s.whatsapp.net`);
            const fullName = `${name || ''} ${surname || ''}`.trim();
            const cachedContact = this.contactsCache.get(normalizedJid);

            let contactData = {
                id: {
                    server: normalizedJid.split('@')[1] || 's.whatsapp.net',
                    user: normalizedJid.split('@')[0],
                    _serialized: normalizedJid
                },
                name: cachedContact?.name || fullName,
                shortName: name || '',
                pushname: cachedContact?.pushName || fullName,
                number: normalizedJid.split('@')[0],
                isUser: true,
                isWAContact: true, 
                isMyContact: !!cachedContact?.name, // Heuristic: if we have a saved name, it's "my contact"
                isGroup: false,
                isBusiness: false, 
                isEnterprise: false, 
                isMe: jidNormalizedUser(this.sock?.user?.id) === normalizedJid,
                isBlocked: this.blockedContacts.some(c => c.id._serialized === normalizedJid),
                getAbout: async () => {
                    try { const status = await this.sock?.fetchStatus(normalizedJid); return status?.status || `About for ${fullName}`; }
                    catch { return `About for ${fullName} (fetch failed)`; }
                },
                getChat: async () => { 
                    return { id: { _serialized: normalizedJid }, name: cachedContact?.name || fullName, isGroup: false };
                },
                getCommonGroups: async () => [],
            };
            
            contactData.displayName = cachedContact?.name || cachedContact?.pushName || fullName || name || normalizedJid.split('@')[0];
            contactData.vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${contactData.displayName}\nTEL;TYPE=CELL:${contactData.number}\nEND:VCARD`;

            this.logger.debug(`Criado/Consultado objeto de contato (Baileys) para ${normalizedJid}`);
            return contactData;

        } catch (error) {
            this.logger.error(`Erro ao criar contato (Baileys) para ${phoneNumber}:`, error);
            throw error;
        }
    }

    // sendMessage, sendReturnMessages, createMedia, createMediaFromURL,
    // isUserAdminInGroup, destroy, restartBot, getCurrentTimestamp
    // methods remain structurally similar to the previous Baileys version,
    // but their internal reliance on contact names will use this.contactsCache.
    // sendMessage's ability to quote older messages will depend on this.messageCache.
    // ... (These methods from the previous detailed Baileys response can be used here,
    //      just ensure any this.store references are changed to this.contactsCache or removed
    //      if not applicable)
    async sendMessage(chatId, content, options = {}) {
        if (!this.isConnected || !this.sock) {
            this.logger.error(`[sendMessage][Baileys] Bot não conectado. Não é possível enviar para ${chatId}.`);
            throw new Error("Bot not connected");
        }
        try {
            const isGroup = chatId.endsWith('@g.us');
            this.loadReport.trackSentMessage(isGroup);

            if (this.safeMode) {
                const contentType = typeof content === 'string' ? 'texto' : (content?.constructor?.name || 'mídia/objeto');
                this.logger.info(`[MODO SEGURO][Baileys] Enviaria para ${chatId} (${contentType}): ${typeof content === 'string' ? content.substring(0,50) : '[Conteúdo complexo]'}`);
                return { id: { fromMe: true, remote: chatId, id: `safe-mode-${this.rndString()}`, _serialized: `true_${chatId}_safe-mode-${this.rndString()}` } };
            }

            let baileysPayload = {};
            let baileysOptions = {};

            if (options.quoted) { 
                baileysOptions.quoted = options.quoted.origin || options.quoted; 
            } else if (options.quotedMessageId && options.quotedRemoteJid) { 
                 baileysOptions.quoted = {
                    key: {
                        remoteJid: options.quotedRemoteJid,
                        id: options.quotedMessageId,
                        fromMe: options.quotedFromMe === true 
                    },
                 };
            }

            if (options.mentions && Array.isArray(options.mentions)) {
                baileysPayload.mentions = options.mentions.map(m => typeof m === 'string' ? m : m.id._serialized).filter(Boolean);
            }

            if (typeof content === 'string') {
                baileysPayload.text = content;
                if (options.linkPreview === false) {
                     this.logger.warn("[Baileys] A opção 'linkPreview: false' tem suporte limitado/complexo em Baileys para mensagens de texto simples.");
                }

            } else if (content instanceof BaileysLocation) {
                baileysPayload.location = {
                    degreesLatitude: content.latitude,
                    degreesLongitude: content.longitude,
                    name: content.name, 
                    address: content.description 
                };
            } else if (content instanceof BaileysMessageMedia) {
                const mediaBuffer = Buffer.isBuffer(content.data) ? content.data : fs.readFileSync(content.data); 

                if (options.asSticker || content.mimetype === Mimetype.webp || (content.mimetype.startsWith('image/') && options.asSticker)) {
                    baileysPayload.sticker = mediaBuffer;
                } else if (content.mimetype.startsWith('image/')) {
                    baileysPayload.image = mediaBuffer;
                    baileysPayload.caption = options.caption || '';
                    baileysPayload.mimetype = content.mimetype;
                } else if (content.mimetype.startsWith('video/')) {
                    baileysPayload.video = mediaBuffer;
                    baileysPayload.caption = options.caption || '';
                    baileysPayload.mimetype = content.mimetype;
                } else if (content.mimetype.startsWith('audio/')) {
                    baileysPayload.audio = mediaBuffer;
                    baileysPayload.mimetype = content.mimetype;
                    baileysPayload.ptt = !!options.ptt; 
                } else { 
                    baileysPayload.document = mediaBuffer;
                    baileysPayload.mimetype = content.mimetype;
                    baileysPayload.fileName = content.filename || 'file';
                    baileysPayload.caption = options.caption || ''; 
                }
            } else if (typeof content === 'object' && content.vcard && content.displayName) { 
                baileysPayload.contacts = {
                    displayName: content.displayName,
                    contacts: [{ vcard: content.vcard }]
                }
            }
             else {
                this.logger.error(`[sendMessage][Baileys] Tipo de conteúdo não suportado: ${typeof content}`, content);
                throw new Error('Unsupported content type for Baileys sendMessage');
            }
            
            const sentMsg = await this.sock.sendMessage(chatId, baileysPayload, baileysOptions);
            
            return {
                ...sentMsg, 
                id: { 
                    fromMe: sentMsg.key.fromMe,
                    remote: sentMsg.key.remoteJid,
                    id: sentMsg.key.id,
                    _serialized: `${sentMsg.key.fromMe}_${sentMsg.key.remoteJid}_${sentMsg.key.id}`
                },
                ack: sentMsg.status, 
                body: typeof content === 'string' ? content : (baileysPayload.caption || '[Media Content]'),
            };

        } catch (error) {
            this.logger.error(`Erro ao enviar mensagem (Baileys) para ${chatId}:`, error, "Content:", content, "Options:", options);
            if (error.message?.includes('invalid jid') || error.output?.statusCode === 404) {
                 this.logger.warn(`Parece que o JID ${chatId} é inválido ou não existe.`);
            }
            throw error;
        }
    }

    async sendReturnMessages(returnMessages) {
        try {
            if (!Array.isArray(returnMessages)) {
                returnMessages = [returnMessages];
            }
            const validMessages = returnMessages.filter(msg => msg && msg.isValid && msg.isValid());

            if (validMessages.length === 0) {
                this.logger.warn('[Baileys] No valid ReturnMessages to send');
                return [];
            }
            const results = [];
            for (const message of validMessages) {
                if (message.delay > 0) {
                    await sleep(message.delay);
                }
                const result = await this.sendMessage(message.chatId, message.content, message.options);
                results.push(result);

                if (message.reactions && result && result.id?._serialized) {
                    if (message.metadata) {
                       message.metadata.messageId = result.id._serialized; 
                    }
                    // If message.reactions means "react to the message I just sent"
                    if (Array.isArray(message.reactions) && result.key) {
                        for (const reactionEmoji of message.reactions) {
                            if (typeof reactionEmoji === 'string' && reactionEmoji.length > 0) {
                                try {
                                    await this.sock.sendMessage(message.chatId, {
                                        react: { text: reactionEmoji, key: result.key }
                                    });
                                    await sleep(300 + Math.random() * 200); // Small delay
                                } catch (reactErr) {
                                    this.logger.error(`Falha ao aplicar auto-reação '${reactionEmoji}' à mensagem ${result.key.id}:`, reactErr);
                                }
                            }
                        }
                    }
                }
            }
            return results;
        } catch (error) {
            this.logger.error('Error sending ReturnMessages (Baileys):', error);
            throw error;
        }
    }

    async createMedia(filePath) {
        try {
            return BaileysMessageMedia.fromFilePath(filePath);
        } catch (error) {
            this.logger.error(`Erro ao criar mídia (Baileys) de ${filePath}:`, error);
            throw error;
        }
    }

    async createMediaFromURL(url, options = {}) { 
        try {
            return BaileysMessageMedia.fromUrl(url, options);
        } catch (error) {
            this.logger.error(`Erro ao criar mídia (Baileys) de URL ${url}:`, error);
            throw error;
        }
    }
    
    async isUserAdminInGroup(userId, groupId) {
        try {
            const groupMetadata = await this.sock.groupMetadata(groupId);
            if (!groupMetadata) {
                this.logger.warn(`Metadados do grupo ${groupId} não encontrados (Baileys).`);
                return false;
            }
            const participant = groupMetadata.participants.find(p => jidNormalizedUser(p.id) === jidNormalizedUser(userId));
            if (!participant) return false;
            return participant.admin === 'admin' || participant.admin === 'superadmin';
        } catch (error) {
            this.logger.error(`Erro ao verificar se usuário ${userId} é admin no grupo ${groupId} (Baileys):`, error);
            return false;
        }
    }

    async destroy(forRestart = false) {
        this.logger.info(`Destruindo instância de bot ${this.id} (Baileys). ForRestart: ${forRestart}`);
        this.isConnected = false; 
        
        if (this.loadReport?.destroy) this.loadReport.destroy();
        if (this.inviteSystem?.destroy) this.inviteSystem.destroy();
        if (this.streamSystem?.destroy) this.streamSystem.destroy();
        this.streamSystem = null; this.streamMonitor = null;

        if (this.sock) {
            this.sock.ev.removeAllListeners(); // Remove all listeners registered on this.sock.ev

            if (forRestart) {
                this.logger.info("Fechando conexão do socket para reinício...");
                this.sock.end(new Error('Restarting bot client')); 
            } else {
                this.logger.info("Deslogando e fechando socket permanentemente...");
                try {
                    await this.sock.logout("Bot shutdown requested"); 
                } catch (e) {
                    this.logger.error("Erro durante o logout do socket, forçando o encerramento:", e);
                    this.sock.end(new Error('Forced shutdown after logout error'));
                }
            }
            this.sock = null;
        }
        // Clear caches on full destroy, maybe optional for restart
        if (!forRestart) {
            this.messageCache.clear();
            this.contactsCache.clear();
            this.logger.info("Caches de mensagem e contato limpos.");
        }
        this.logger.info(`Instância ${this.id} (Baileys) destruída.`);
    }

    async restartBot(reason = 'Reinicialização solicitada (Baileys)') {
        this.logger.info(`Iniciando processo de reinicialização do bot ${this.id}. Motivo: ${reason}`);
        try {
            /*
            if (this.isConnected && this.grupoAvisos) {
                try {
                    const restartMsg = `🔄 Bot ${this.id} (Baileys) reiniciando...\nMotivo: ${reason}`;
                    await this.sendMessage(this.grupoAvisos, restartMsg);
                    await sleep(2000); 
                } catch (e) { this.logger.error("Erro ao enviar mensagem de aviso de reinício:", e); }
            }
            */

            await this.destroy(true); 

            this.logger.info(`Bot ${this.id} (Baileys) desconectado, aguardando para reinicializar...`);
            await sleep(5000); 

            // Clear caches before re-init as they might contain stale socket references or old data
            this.messageCache.clear();
            this.contactsCache.clear();

            await this.initialize(); 
            this.logger.info(`Bot ${this.id} (Baileys) reinicializado, aguardando conexão...`);

            let waitTime = 0;
            const maxWaitTime = 60000; 
            while (!this.isConnected && waitTime < maxWaitTime) {
                await sleep(2000);
                waitTime += 2000;
                if(waitTime % 10000 === 0) this.logger.info(`Aguardando conexão... ${waitTime/1000}s`);
            }

            if (this.isConnected) {
                this.logger.info(`Bot ${this.id} (Baileys) reconectado após ${waitTime}ms.`);
                /*
                 if (this.grupoAvisos) {
                    await this.sendMessage(this.grupoAvisos, `✅ Bot ${this.id} (Baileys) reiniciado com sucesso!\nMotivo: ${reason}`)
                        .catch(e => this.logger.error("Erro ao enviar msg de sucesso de reinício:", e));
                }*/
            } else {
                this.logger.error(`Falha ao reconectar bot ${this.id} (Baileys) após ${maxWaitTime}ms.`);
                if (this.grupoLogs) {
                     await this.sendMessage(this.grupoLogs, `❌ Falha crítica ao reiniciar bot ${this.id} (Baileys).\nMotivo: ${reason}`)
                        .catch(e => this.logger.error("Erro ao enviar msg de falha de reinício:", e));
                }
            }
        } catch (error) {
            this.logger.error(`Erro catastrófico durante a reinicialização do bot ${this.id} (Baileys):`, error);
            throw error; 
        }
    }

    getCurrentTimestamp(){
        return Math.round(Date.now()/1000);
    }

}

module.exports = WhatsAppBotBaileys;