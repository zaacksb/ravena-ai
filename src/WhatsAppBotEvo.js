const { Contact, LocalAuth, MessageMedia, Location, Poll } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { randomBytes } = require('crypto');
const imagemagick = require('imagemagick');
const ffmpeg = require('fluent-ffmpeg');
const { promisify } = require('util');
const express = require('express');
const mime = require('mime-types');
const axios = require('axios');
const sharp = require('sharp');
const path =require('path');
const fs = require('fs');
const os = require('os');
const { io } = require("socket.io-client");

const EvolutionApiClient = require('./services/EvolutionApiClient');
const CacheManager = require('./services/CacheManager');
const ReturnMessage = require('./models/ReturnMessage');
const ReactionsHandler = require('./ReactionsHandler');
const LLMService = require('./services/LLMService');
const MentionHandler = require('./MentionHandler');
const AdminUtils = require('./utils/AdminUtils');
const InviteSystem = require('./InviteSystem');
const StreamSystem = require('./StreamSystem');
const Database = require('./utils/Database');
const LoadReport = require('./LoadReport');
const Logger = require('./utils/Logger');

// Utils
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const writeFileAsync = promisify(fs.writeFile);
const readFileAsync = promisify(fs.readFile);
const unlinkAsync = promisify(fs.unlink);
const convertAsync = promisify(imagemagick.convert);

class WhatsAppBotEvo {
  /**
   * @param {Object} options
   * @param {string} options.id - Your internal Bot ID
   * @param {string} options.phoneNumber - Phone number (for reference or if API needs it)
   * @param {Object} options.eventHandler - Instance of your EventHandler
   * @param {string} options.prefix
   * @param {Array} options.otherBots
   * @param {string} options.evolutionApiUrl - Base URL of Evolution API
   * @param {string} options.evolutionApiKey - API Key for Evolution API
   * @param {string} options.instanceName - Name of the Evolution API instance
   * @param {string} options.webhookHost - Publicly accessible host for webhook (e.g., https://your.domain.com)
   * @param {number} options.webhookPort - Local port for Express server to listen on
   * @param {string} options.userAgent - (May not be used directly with Evo API but kept for options consistency)
   */
  constructor(options) {
    this.id = options.id;
    this.phoneNumber = options.phoneNumber;
    this.eventHandler = options.eventHandler;
    this.prefix = options.prefix || process.env.DEFAULT_PREFIX || '!';
    this.logger = new Logger(`bot-evo-${this.id}`);
    this.websocket = options.useWebsocket ?? false;
    this.evolutionWS = options.evolutionWS;
    this.evolutionApiUrl = options.evolutionApiUrl;
    this.evolutionApiKey = options.evolutionApiKey;
    this.instanceName = options.evoInstanceName;
    this.webhookHost = options.webhookHost; // e.g., from cloudflared tunnel
    this.webhookPort = options.webhookPort || process.env.WEBHOOK_PORT_EVO || 3000;
    this.notificarDonate = options.notificarDonate;

    this.redisURL = options.redisURL;
    this.redisDB = options.redisDB || 0;
    this.redisTTL = options.redisTTL || 604800;
    this.maxCacheSize = 3000;


    this.messageCache = [];
    this.contactCache = [];
    this.sentMessagesCache = [];
    this.cacheManager = new CacheManager(
      this.redisURL,     
      this.redisDB,    
      this.redisTTL,
      this.maxCacheSize 
    );

    if (!this.evolutionApiUrl || !this.evolutionApiKey || !this.instanceName || !this.webhookHost) {
        const errMsg = 'WhatsAppBotEvo: evolutionApiUrl, evolutionApiKey, instanceName, and webhookHost are required!';
        this.logger.error(errMsg, {
            evolutionApiUrl: !!this.evolutionApiUrl,
            evolutionApiKey: !!this.evolutionApiKey,
            instanceName: !!this.instanceName,
            webhookHost: !!this.webhookHost
        });
        throw new Error(errMsg);
    }

    this.apiClient = new EvolutionApiClient(
      this.evolutionApiUrl,
      this.evolutionApiKey,
      this.instanceName, // apiClient doesn't need instanceName per method if we pass it in constructor
      this.logger
    );

    this.database = Database.getInstance();
    this.isConnected = true;
    this.safeMode = options.safeMode !== undefined ? options.safeMode : (process.env.SAFE_MODE === 'true');
    this.otherBots = options.otherBots || [];
    
    this.ignorePV = options.ignorePV || false;
    this.whitelist = options.whitelistPV || []; // This should be populated by loadDonationsToWhitelist
    this.ignoreInvites = options.ignoreInvites || false;
    this.grupoLogs = options.grupoLogs || process.env.GRUPO_LOGS;
    this.grupoInvites = options.grupoInvites || process.env.GRUPO_INVITES;
    this.grupoAvisos = options.grupoAvisos || process.env.GRUPO_AVISOS;
    // ... other group IDs ...
    this.userAgent = options.userAgent || process.env.USER_AGENT;


    this.mentionHandler = new MentionHandler();

    this.lastMessageReceived = Date.now();
    this.startupTime = Date.now();
    
    this.loadReport = new LoadReport(this);
    this.inviteSystem = new InviteSystem(this); // Will require Evo API for joining groups
    this.reactionHandler = new ReactionsHandler(); // Will need Evo API for sending/receiving reactions
    
    // StreamSystem and stabilityMonitor might need re-evaluation for Evolution API
    this.streamSystem = null; 
    this.streamMonitor = null;
    this.stabilityMonitor = options.stabilityMonitor ?? false;

    this.llmService = new LLMService({});
    this.adminUtils = AdminUtils.getInstance(); // Will need adaptation for permission checks via API

    this.webhookApp = null; // Express app instance
    this.webhookServer = null; // HTTP server instance

    this.blockedContacts = []; // To be populated via API if possible / needed

    if (!this.streamSystem) {
      this.streamSystem = new StreamSystem(this);
      this.streamSystem.initialize();
      this.streamMonitor = this.streamSystem.streamMonitor;
    }

    // Client Fake
    this.client = {
      getChatById: (arg) => {
        return this.getChatDetails(arg);
      },
      getContactById: (arg) => {
        return this.getContactDetails(arg);
      },
      getInviteInfo: (arg) => {
        return this.inviteInfo(arg);
      },
      getMessageById: async (messageId) => {
        return await this.recoverMsgFromCache(messageId);
      },
      setStatus: (arg) => {
        this.updateProfileStatus(arg);
      },
      leaveGroup: (arg) => {
        this.leaveGroup(arg);
      },
      setProfilePicture: (arg) => {
        this.updateProfilePicture(arg);
      },
      acceptInvite: (arg) => {
        return this.acceptInviteCode(arg);
      },
      sendPresenceUpdate: async (xxx) => {
        // Sem necessidade dessa função
        return true;
      },
      info: {
        wid: {
          _serialized: `${options.phoneNumber}@c.us`
        }
      }
    }
  }

  async convertToSquareWebPImage(base64ImageContent) {
    let inputPath = ''; // Will be set to the path of the temporary input file
    let isTempInputFile = false;
    const tempId = randomBytes(16).toString('hex');
    
    // Use system's temporary directory for better portability
    const tempDirectory = os.tmpdir();
    // Using a generic extension like .tmp as ffmpeg will auto-detect the input format (JPG/PNG)
    const tempInputPath = path.join(tempDirectory, `${tempId}_input.tmp`); 
    const tempOutputPath = path.join(tempDirectory, `${tempId}_output.webp`);

    try {
      // Validate and decode base64 input
      if (!base64ImageContent || typeof base64ImageContent !== 'string') {
        throw new Error('Invalid base64ImageContent: Must be a non-empty string.');
      }

      this.logger.info('[toSquareWebPImage] Input is base64. Decoding and saving to temporary file...');
      // Remove potential data URI prefix (e.g., "data:image/png;base64,")
      const base64Data = base64ImageContent.includes(',') ? base64ImageContent.split(',')[1] : base64ImageContent;
      
      if (!base64Data) {
        throw new Error('Invalid base64ImageContent: Empty data after stripping prefix.');
      }

      const buffer = Buffer.from(base64Data, 'base64');
      await writeFileAsync(tempInputPath, buffer);
      inputPath = tempInputPath;
      isTempInputFile = true;
      this.logger.info('[toSquareWebPImage] Base64 input saved to temporary file:', tempInputPath);
      
      this.logger.info('[toSquareWebPImage] Starting square WebP image conversion for:', inputPath);

      const targetSize = 512; // Target dimension for the square output

      // ffmpeg filter to:
      // 1. Scale the image to fit within targetSize x targetSize, preserving aspect ratio.
      // 2. Pad the scaled image to targetSize x targetSize, centering it.
      //    The padding color is set to transparent (black@0.0).
      const videoFilter = `scale=${targetSize}:${targetSize}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${targetSize}:${targetSize}:(ow-iw)/2:(oh-ih)/2:color=black@0.0`;

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-vf', videoFilter,       // Apply the scaling and padding filter
            '-c:v', 'libwebp',        // Set the codec to libwebp
            '-lossless', '0',         // Use lossy compression (0 for lossy, 1 for lossless). Lossy is often preferred for stickers for smaller file size.
            '-q:v', '80',             // Quality for lossy WebP (0-100). Adjust for balance. Higher is better quality/larger file.
            '-compression_level', '6',// Compression effort (0-6). Higher means more compression (smaller size) but slower.
            // No animation-specific options like -loop, fps, etc.
          ])
          .toFormat('webp') // Output format
          .on('end', () => {
            this.logger.info('[toSquareWebPImage] Square WebP image conversion finished.');
            resolve();
          })
          .on('error', (err) => {
            let ffmpegCommand = '';
            // fluent-ffmpeg might expose the command it tried to run in err.ffmpegCommand or similar
            if (typeof err.spawnargs !== 'undefined') { // Check common property for spawn arguments
                ffmpegCommand = `FFmpeg arguments: ${err.spawnargs.join(' ')}`;
            }
            this.logger.error(`[toSquareWebPImage] Error during WebP image conversion: ${err.message}. ${ffmpegCommand}`, err.stack);
            reject(err);
          })
          .save(tempOutputPath);
      });

      this.logger.info('[toSquareWebPImage] Square WebP image saved to temporary file:', tempOutputPath);

      // Read the generated WebP and convert to base64
      const webpBuffer = await readFileAsync(tempOutputPath);
      const base64WebP = webpBuffer.toString('base64');
      this.logger.info('[toSquareWebPImage] Square WebP image converted to base64.');

      return base64WebP; // Return raw base64 string

    } catch (error) {
      this.logger.error('[toSquareWebPImage] Error in convertToSquareWebPImage function:', error.message, error.stack);
      throw error; // Re-throw the error to be caught by the caller
    } finally {
      // Clean up temporary files
      if (isTempInputFile && fs.existsSync(tempInputPath)) {
        try {
          await unlinkAsync(tempInputPath);
          this.logger.info('[toSquareWebPImage] Temporary input file deleted:', tempInputPath);
        } catch (e) {
          this.logger.error('[toSquareWebPImage] Error deleting temporary input file:', tempInputPath, e.message);
        }
      }
      if (fs.existsSync(tempOutputPath)) { // Check existence before unlinking
        try {
          await unlinkAsync(tempOutputPath);
          this.logger.info('[toSquareWebPImage] Temporary output file deleted:', tempOutputPath);
        } catch (e) {
          this.logger.error('[toSquareWebPImage] Error deleting temporary output file:', tempOutputPath, e.message);
        }
      }
    }
  }

  async convertToSquarePNGImage(base64ImageContent) {
    // tempId can still be useful for logging traceability, even without temp files
    const tempId = randomBytes(16).toString('hex');

    try {
      // Validate and decode base64 input
      if (!base64ImageContent || typeof base64ImageContent !== 'string') {
        throw new Error('Invalid base64ImageContent: Must be a non-empty string.');
      }

      this.logger.info(`[convertToSquarePNGImage] [${tempId}] Input is base64. Decoding...`);
      const base64Data = base64ImageContent.includes(',') ? base64ImageContent.split(',')[1] : base64ImageContent;

      if (!base64Data) {
        throw new Error('Invalid base64ImageContent: Empty data after stripping prefix.');
      }

      const imageBuffer = Buffer.from(base64Data, 'base64');
      this.logger.info(`[convertToSquarePNGImage] [${tempId}] Base64 decoded to buffer. Input buffer length: ${imageBuffer.length}`);

      const targetSize = 800; // Target dimension for the square output
      this.logger.info(`[convertToSquarePNGImage] [${tempId}] Starting square PNG image conversion with Sharp. Target size: ${targetSize}x${targetSize}`);

      // 1. Resize the image to fit within targetSize, preserving aspect ratio.
      //    'sharp.fit.inside' is equivalent to ffmpeg's 'force_original_aspect_ratio=decrease'.
      //    'withoutEnlargement: false' ensures images smaller than targetSize ARE scaled up.
      //    'kernel: sharp.kernel.lanczos3' uses Lanczos3 for high-quality resizing.
      const resizedImageBuffer = await sharp(imageBuffer)
        .resize({
          width: targetSize,
          height: targetSize,
          fit: sharp.fit.inside,
          withoutEnlargement: false, // Allow upscaling
          kernel: sharp.kernel.lanczos3,
        })
        .toBuffer(); // Get the resized image as a buffer

      this.logger.info(`[convertToSquarePNGImage] [${tempId}] Image resized with Sharp.`);

      // 2. Create a new transparent square canvas and composite the resized image onto it.
      //    The 'gravity: sharp.gravity.center' option will center the resized image.
      //    The background '{ r: 0, g: 0, b: 0, alpha: 0 }' makes the padding transparent.
      const finalImageBuffer = await sharp({
        create: {
          width: targetSize,
          height: targetSize,
          channels: 4, // 4 channels for RGBA (to support transparency)
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        }
      })
      .composite([{
        input: resizedImageBuffer,    // The buffer of the resized image
        gravity: sharp.gravity.center // Center the image on the new canvas
      }])
      .png({
        // PNG specific options for compression:
        compressionLevel: 6, // zlib compression level (0-9), default is 6. Higher is smaller but slower.
        adaptiveFiltering: true // Use adaptive row filtering for potentially smaller file size.
      })
      .toBuffer();

      this.logger.info(`[convertToSquarePNGImage] [${tempId}] Square PNG image created and composited with Sharp.`);

      // Convert the final image buffer to a base64 string
      const base64Png = finalImageBuffer.toString('base64');
      this.logger.info(`[convertToSquarePNGImage] [${tempId}] Final PNG image converted to base64.`);

      return base64Png; // Return raw base64 string

    } catch (error) {
      this.logger.error(`[convertToSquarePNGImage] [${tempId}] Error during Sharp processing: ${error.message}`, error.stack);
      throw error; // Re-throw the error to be caught by the caller
    }
  }

  async convertAnimatedWebpToGif(base64Webp, keepFile = false) {
    const tempId = randomBytes(8).toString('hex');
    const tempDir = os.tmpdir();
    const inputPath = path.join(tempDir, `${tempId}.webp`);
    const outputFileName = `${tempId}.gif`;

    // Output location: public/gifs
    const outputDir = path.join(__dirname, '..', 'public', 'gifs');
    fs.mkdirSync(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, outputFileName);

    // Decode and save base64 WebP to temp file
    const buffer = Buffer.from(base64Webp.split(',').pop(), 'base64');
    await writeFileAsync(inputPath, buffer);

    try {
      // imagemagick.convert takes an array of args (like CLI)
      await convertAsync([
        inputPath,
        '-coalesce',
        '-background', 'none',
        '-alpha', 'on',
        '-dispose', 'previous',
        outputPath
      ]);

      // Clean up input
      await unlinkAsync(inputPath).catch(() => {});

      // Return public file URL
      const fileUrl = `${process.env.BOT_DOMAIN}/gifs/${outputFileName}`;

      // Optionally delete GIF after 60s
      if (!keepFile) {
        setTimeout(() => {
          fs.unlink(outputPath, () => {});
        }, 60000);
      }

      return fileUrl;
    } catch (err) {
      await unlinkAsync(inputPath).catch(() => {});
      console.error(`[convertAnimatedWebpToGif] ImageMagick error: ${err.message}`);
      throw err;
    }
  }

  async convertToSquareAnimatedGif(inputContent, keepFile = false) {
    console.log("[convertToSquareAnimatedGif] ",inputContent.substring(0, 30));
    let inputPath = inputContent;
    let isTempInputFile = false;
    const tempId = randomBytes(16).toString('hex');
    
    const tempInputDirectory = os.tmpdir();
    const tempInputPath = path.join(tempInputDirectory, `${tempId}_input.tmp`);
    
    // Define the output directory and ensure it exists
    const outputDir = path.join(__dirname, '..', 'public', 'gifs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const outputFileName = `${tempId}.gif`;
    const outputPath = path.join(outputDir, outputFileName);

    try {
      if (inputContent && !inputContent.startsWith('http://') && !inputContent.startsWith('https://')) {
        this.logger.info('[toSquareAnimatedGif] Input is base64. Decoding and saving to temporary file...');
        const base64Data = inputContent.includes(',') ? inputContent.split(',')[1] : inputContent;
        const buffer = Buffer.from(base64Data, 'base64');
        await writeFileAsync(tempInputPath, buffer);
        inputPath = tempInputPath;
        isTempInputFile = true;
        this.logger.info('[toSquareAnimatedGif] Base64 input saved to temporary file:', tempInputPath);
      } else if (inputContent && (inputContent.startsWith('http://') || inputContent.startsWith('https://'))) {
        this.logger.info('[toSquareAnimatedGif] Input is a URL:', inputPath);
        // ffmpeg can handle URLs directly
      } else {
        throw new Error('Invalid inputContent provided. Must be a URL or base64 string.');
      }

      this.logger.info('[toSquareAnimatedGif] Starting square animated GIF conversion for:', inputPath);

      const targetSize = 512;
      const fps = 15; // WhatsApp tends to prefer 10-20 FPS for GIFs. 15 is a good compromise.

      const videoFilter = 
        `fps=${fps},` +
        `scale=${targetSize}:${targetSize}:force_original_aspect_ratio=decrease:flags=lanczos,` +
        `pad=${targetSize}:${targetSize}:(ow-iw)/2:(oh-ih)/2:color=black@0.0,` +
        `split[s0][s1];[s0]palettegen=stats_mode=diff:max_colors=250:reserve_transparent=on[p];[s1][p]paletteuse=dither=bayer:alpha_threshold=128`;

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-vf', videoFilter,
            '-loop', '0',
          ])
          .toFormat('gif')
          .on('end', () => {
            this.logger.info('[toSquareAnimatedGif] Square animated GIF conversion finished.');
            resolve();
          })
          .on('error', (err) => {
            let ffmpegCommandDetails = '';
            if (err.ffmpegCommand) {
                ffmpegCommandDetails = `FFmpeg command: ${err.ffmpegCommand}`;
            } else if (err.spawnargs) {
                ffmpegCommandDetails = `FFmpeg arguments: ${err.spawnargs.join(' ')}`;
            }
            this.logger.error(`[toSquareAnimatedGif] Error during GIF conversion: ${err.message}. ${ffmpegCommandDetails}`, err.stack);
            reject(err);
          })
          .save(outputPath); // Save to the new permanent path
      });

      this.logger.info('[toSquareAnimatedGif] Square animated GIF saved to:', outputPath);

      // Schedule file deletion
      if(!keepFile){
        setTimeout(() => {
          fs.unlink(outputPath, (err) => {
            if (err) {
              this.logger.error(`[toSquareAnimatedGif] Error deleting file ${outputPath}:`, err);
            } else {
              this.logger.info(`[toSquareAnimatedGif] Deleted file: ${outputPath}`);
            }
          });
        }, 60000); 
      }

      // Check file size - WhatsApp has limits for GIFs (often around 1MB, but can vary)
      const stats = fs.statSync(outputPath);
      const fileSizeInMB = stats.size / (1024 * 1024);
      this.logger.info(`[toSquareAnimatedGif] Output GIF file size: ${fileSizeInMB.toFixed(2)} MB`);
      if (fileSizeInMB > 1.5) { // Example threshold, adjust as needed
          this.logger.warn(`[toSquareAnimatedGif] WARNING: Output GIF size is ${fileSizeInMB.toFixed(2)} MB, which might be too large for WhatsApp.`);
      }

      const fileUrl = `${process.env.BOT_DOMAIN}/gifs/${outputFileName}`;
      this.logger.info('[toSquareAnimatedGif] Returning URL:', fileUrl);
      return fileUrl;

    } catch (error) {
      this.logger.error('[toSquareAnimatedGif] Error in convertToSquareAnimatedGif function:', error.message, error.stack);
      throw error;
    } finally {
      if (isTempInputFile && fs.existsSync(tempInputPath)) {
        try {
          await unlinkAsync(tempInputPath);
          this.logger.info('[toSquareAnimatedGif] Temporary input file deleted:', tempInputPath);
        } catch (e) {
          this.logger.error('[toSquareAnimatedGif] Error deleting temporary input file:', tempInputPath, e.message);
        }
      }
    }
  }

  async convertToAnimatedWebP(inputContent) {
    let inputPath = inputContent;
    let isTempInputFile = false;
    const tempId = randomBytes(16).toString('hex');
    
    const tempDirectory = os.tmpdir();
    const tempInputPath = path.join(tempDirectory, `${tempId}_input.tmp`); 
    const tempOutputPath = path.join(tempDirectory, `${tempId}_output.webp`);

    try {
      if (inputContent && !inputContent.startsWith('http://') && !inputContent.startsWith('https://')) {
        this.logger.info('[toAnimatedWebP] Input is base64. Decoding and saving to temporary file...');
        const base64Data = inputContent.includes(',') ? inputContent.split(',')[1] : inputContent;
        const buffer = Buffer.from(base64Data, 'base64');
        await writeFileAsync(tempInputPath, buffer);
        inputPath = tempInputPath;
        isTempInputFile = true;
        this.logger.info('[toAnimatedWebP] Base64 input saved to temporary file:', tempInputPath);
      } else if (inputContent && (inputContent.startsWith('http://') || inputContent.startsWith('https://'))) {
        this.logger.info('[toAnimatedWebP] Input is a URL:', inputPath);
      } else {
        throw new Error('Invalid inputContent provided. Must be a URL or base64 string.');
      }

      this.logger.info('[toAnimatedWebP] Starting square animated WebP conversion for:', inputPath);

      // Define the target square dimensions
      const targetSize = 512;

      // Construct the complex video filter string
      // 1. Set FPS
      // 2. Scale to fit within targetSize x targetSize, preserving aspect ratio (lanczos for quality)
      // 3. Pad to targetSize x targetSize, center content, fill with transparent background
      // 4. Generate and use a palette for better WebP quality and transparency handling
      const videoFilter = `fps=20,scale=${targetSize}:${targetSize}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${targetSize}:${targetSize}:(ow-iw)/2:(oh-ih)/2:color=black@0.0,split[s0][s1];[s0]palettegen=max_colors=250:reserve_transparent=on[p];[s1][p]paletteuse=dither=bayer:alpha_threshold=128`;

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-vf', videoFilter,
            '-loop', '0',
            '-c:v', 'libwebp',
            '-lossless', '0',
            '-q:v', '75', // Quality for lossy WebP (0-100)
            '-compression_level', '6', // Compression level (0-6)
            '-preset', 'default',
            '-an', // Remove audio
            '-vsync', 'cfr', // Constant frame rate
          ])
          .toFormat('webp')
          .on('end', () => {
            this.logger.info('[toAnimatedWebP] Square animated WebP conversion finished.');
            resolve();
          })
          .on('error', (err) => {
            let ffmpegCommand = '';
            if (err.ffmpegCommand) {
                ffmpegCommand = `FFmpeg command: ${err.ffmpegCommand}`;
            }
            this.logger.error(`[toAnimatedWebP] Error during square WebP conversion: ${err.message}. ${ffmpegCommand}`, err.stack);
            reject(err);
          })
          .save(tempOutputPath);
      });

      this.logger.info('[toAnimatedWebP] Square animated WebP saved to temporary file:', tempOutputPath);

      const webpBuffer = await readFileAsync(tempOutputPath);
      const base64WebP = webpBuffer.toString('base64');
      this.logger.info('[toAnimatedWebP] Square animated WebP converted to base64.');

      return base64WebP;

    } catch (error) {
      this.logger.error('[toAnimatedWebP] Error in convertToAnimatedWebP function:', error.message, error.stack);
      throw error;
    } finally {
      if (isTempInputFile && fs.existsSync(tempInputPath)) {
        try {
          await unlinkAsync(tempInputPath);
          this.logger.info('[toAnimatedWebP] Temporary input file deleted:', tempInputPath);
        } catch (e) {
          this.logger.error('[toAnimatedWebP] Error deleting temporary input file:', tempInputPath, e.message);
        }
      }
      if (fs.existsSync(tempOutputPath)) {
        try {
          await unlinkAsync(tempOutputPath);
          this.logger.info('[toAnimatedWebP] Temporary output file deleted:', tempOutputPath);
        } catch (e) {
          this.logger.error('[toAnimatedWebP] Error deleting temporary output file:', tempOutputPath, e.message);
        }
      }
    }
  }

  async toGif(inputContent) {
    let inputPath = inputContent;
    let isTempFile = false;
    const tempDirectory = os.tmpdir();
    const tempId = randomBytes(16).toString('hex'); // Generate a unique ID for temp files
    const tempInputPath = path.join(tempDirectory, `${tempId}_input.mp4`);
    const tempOutputPath = path.join(tempDirectory, `${tempId}_output.gif`);

    try {
      // Check if inputContent is base64 or URL
      if (!inputContent.startsWith('http://') && !inputContent.startsWith('https://')) {
        // Assume it's base64, decode and write to a temporary file
        const base64Data = inputContent.includes(',') ? inputContent.split(',')[1] : inputContent;
        const buffer = Buffer.from(base64Data, 'base64');
        await writeFileAsync(tempInputPath, buffer);
        inputPath = tempInputPath;
        isTempFile = true;
        this.logger.info('[toGif] Input is base64, saved to temporary file:', tempInputPath);
      } else {
        this.logger.info('[toGif] Input is a URL:', inputPath);
      }

      this.logger.info('[toGif] Starting GIF conversion for:', inputPath);

      await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
          .outputOptions([
            '-vf', 'fps=20,scale=512:-1:flags=lanczos', // Example: 10 fps, 320px width, maintain aspect ratio
            '-loop', '0' // 0 for infinite loop, -1 for no loop, N for N loops
          ])
          .toFormat('gif')
          .on('end', () => {
            this.logger.info('[toGif] GIF conversion finished.');
            resolve();
          })
          .on('error', (err) => {
            this.logger.error('[toGif] Error during GIF conversion:', err.message);
            reject(err);
          })
          .save(tempOutputPath);
      });

      this.logger.info('[toGif] GIF saved to temporary file:', tempOutputPath);

      // Read the generated GIF and convert to base64
      const gifBuffer = await readFileAsync(tempOutputPath);
      const base64Gif = gifBuffer.toString('base64');
      this.logger.info('[toGif] GIF converted to base64.');

      return base64Gif; // 'data:image/gif;base64,' não inclui

    } catch (error) {
      this.logger.error('[toGif] Error in toGif function:', error);
      throw error; // Re-throw the error to be caught by the caller
    } finally {
      // Clean up temporary files
      if (isTempFile && fs.existsSync(tempInputPath)) {
        try {
          await unlinkAsync(tempInputPath);
          this.logger.info('[toGif] Temporary input file deleted:', tempInputPath);
        } catch (e) {
          this.logger.error('[toGif] Error deleting temporary input file:', tempInputPath, e.message);
        }
      }
      if (fs.existsSync(tempOutputPath)) {
        try {
          await unlinkAsync(tempOutputPath);
          this.logger.info('[toGif] Temporary output file deleted:', tempOutputPath);
        } catch (e) {
          this.logger.error('[toGif] Error deleting temporary output file:', tempOutputPath, e.message);
        }
      }
    }
  }

  recoverMsgFromCache(messageId){
    return new Promise(async (resolve, reject) => {
      try{
        if(!messageId){
          resolve(null);
        } else {
          const msg = await this.cacheManager.getMessageFromCache(messageId);
          const recovered = await this.formatMessageFromEvo(msg?.evoMessageData); // Pra recriar os métodos
          if(!recovered){
            this.logger.warn(`[recoverMsgFromCache] A msg '${messageId}' do cache não tinha evoMessageData?`, msg);
            resolve(msg);
          } else {
            resolve(recovered);
          }
        }
      } catch(e){
        this.logger.error(`[recoverMsgFromCache] Erro recuperando msg '${messageId}'`, e);
        reject(e);
      }
    });
  }

  recoverContactFromCache(number){
    return new Promise(async (resolve, reject) => {
      try{
        if(!number){
          resolve(null);
        } else {
          const contact = await this.cacheManager.getContactFromCache(number);
          
          if(contact){
            contact.block = async () => {
              return await this.setCttBlockStatus(contact.number, "block");
            };
            contact.unblock = async () => {
              return await this.setCttBlockStatus(contact.number, "unblock");
            };

            resolve(contact);
          } else {
            resolve(null);
          }
        }
      } catch(e){
        this.logger.error(`[recoverContactFromCache] Erro recuperando contato '${number}'`, e);
        reject(e);
      }
    });
  }

  async initialize() {
    const wsUrl = `${this.evolutionWS}/${this.instanceName}`;

    const instanceDesc = this.websocket ? `Websocket to ${wsUrl}` : `Webhook on ${this.instanceName}:${this.webhookPort}`; 
    this.logger.info(`Initializing Evolution API bot instance ${this.id} (Evo Instance: ${instanceDesc})`);
    this.database.registerBotInstance(this);
    this.startupTime = Date.now();

    try {
      // 1. Setup Webhook Server OR Websocket connection
      if(this.websocket){
        this.logger.info(`Usar websocket`);
        const socket = io(wsUrl, {
          transports: ['websocket']
        });

        socket.on('connect', () => {
          this.logger.info('>>> Conectado ao WebSocket da Evolution API <<<');
        });

        // Escutando eventos
        socket.on('messages.upsert', (data) => this.handleWebsocket(data));

        socket.on('group-participants.update', (data) => {
          this.logger.info('group-participants.update', data);

          this.handleWebsocket(data);
        });

        socket.on('groups.upsert', (data) => {
          this.logger.info('groups.upsert', data);
          this.handleWebsocket(data);
        });

        socket.on('connection.update', (data) => {
          this.logger.info('connection.update', data);

          this.handleWebsocket(data);
        });

        // socket.on('contacts.update', (data) => {
        //    this.logger.info('contacts.update', data);
        //    this.handleWebsocket(data);
        // });

        socket.on('send.message', (data) => {
          this.handleWebsocket(data);
        });

        // Lidando com desconexão
        socket.on('disconnect', () => {
          this.logger.info('Desconectado do WebSocket da Evolution API');
        });
      } else {
        this.webhookApp = express();
        this.webhookApp.use(express.json());
        const webhookPath = `/webhook/evo/${this.id}`; // Unique path for this bot instance
        this.webhookApp.post(webhookPath, this._handleWebhook.bind(this));

        await new Promise((resolve, reject) => {
          this.webhookServer = this.webhookApp.listen(this.webhookPort, () => {
            this.logger.info(`Webhook listener for bot ${this.id} started on http://localhost:${this.webhookPort}${webhookPath}`);
            resolve();
          }).on('error', (err) => {
            this.logger.error(`Failed to start webhook listener for bot ${this.id}:`, err);
            reject(err);
          });
        });

      }

      // 2. Configure Webhook in Evolution API
      // const fullWebhookUrl = `${this.webhookHost.replace(/\/$/, '')}${webhookPath}`;
      // this.logger.info(`Attempting to set Evolution API webhook for instance ${this.instanceName} to: ${fullWebhookUrl}`);
      
      // // IMPORTANT: Verify the exact event names your Evolution API version uses!
      // const desiredEvents = [
      //   "messages.upsert", 
      //   "messages.update", // For reactions or edits, if applicable
      //   "connection.update",
      //   "group-participants.update", // For join/leave
      //   // "groups.update", // For group subject/description changes
      //   // "message.reaction" // If reactions are a separate event
      // ];

      // await this.apiClient.post(`/instance/webhook/set`, { // Pass instanceName via constructor to apiClient
      //   enabled: true,
      //   url: fullWebhookUrl,
      //   // events: desiredEvents // Some Evolution API versions might not support granular events here, it might be all or none
      // });
      // this.logger.info(`Successfully requested webhook setup for instance ${this.instanceName}.`);

    } catch (error) {
      this.logger.error(`Error during webhook setup for instance ${this.instanceName}:`, error);
      // Decide if we should throw or try to continue without webhooks for sending only
    }

    // 3. Load donations to whitelist (from original bot)
    this._loadDonationsToWhitelist();

    // 4. Check instance status and connect if necessary
    this._checkInstanceStatusAndConnect();
    
    return this;
  }

  async _checkInstanceStatusAndConnect(isRetry = false) {
    this.logger.info(`Checking instance status for ${this.instanceName}...`);
    try {
      /*
      {
        "instance": {
          "instanceName": "teste-docs",
          "state": "open"
        }
      }
      */
      const instanceDetails = await this.apiClient.get(`/instance/connectionState`);
      this.logger.info(`Instance ${this.instanceName} state: ${instanceDetails?.instance?.state}`, instanceDetails?.instance);

      const state = (instanceDetails?.instance?.state ?? "error").toUpperCase();
      if (state === 'CONNECTED' || state === 'OPEN') { // open não era pra ser
        this._onInstanceConnected();
      } else if (state === 'CONNECTING' || state === 'PAIRING' || !state /* if undefined, try to connect */) {
        this.logger.info(`Instance ${this.instanceName} is not connected (state: ${state}). Attempting to connect...`);
        const connectData = await this.apiClient.get(`/instance/connect`, {number: this.phoneNumber});

        if (connectData.pairingCode) {
           this.logger.info(`[${this.id}] Instance ${this.instanceName} PAIRING CODE: ${connectData.pairingCode.code}. Enter this on your phone in Linked Devices -> Link with phone number.`);
        } else 
        if (connectData.code) {
          this.logger.info(`[${this.id}] QR Code for ${this.instanceName} (Scan with WhatsApp):`);
          qrcode.generate(connectData.code, { small: true });

          // TODO: Save QR to file as in original bot:
          // const qrCodeLocal = path.join(this.database.databasePath, `qrcode_evo_${this.id}.png`);
          // fs.writeFileSync(qrCodeLocal, Buffer.from(connectData.qrcode.base64, 'base64'));
          // this.logger.info(`QR Code saved to ${qrCodeLocal}`);
        } else {
          this.logger.warn(`[${this.id}] Received connection response for ${this.instanceName}, but no QR/Pairing code found. State: ${connectData?.state}. Waiting for webhook confirmation.`, connectData);
        }
        // After attempting to connect, we wait for a 'connection.update' webhook.
      } else if (state === 'TIMEOUT' && !isRetry) {
        this.logger.warn(`Instance ${this.instanceName} timed out. Retrying connection once...`);
        await sleep(5000);
        this._checkInstanceStatusAndConnect(true);
      } else {
        this.logger.error(`Instance ${this.instanceName} is in an unhandled state: ${state}. Manual intervention may be required.`);
        // Consider calling onDisconnected here if it's a definitively disconnected state
      }
    } catch (error) {
      this.logger.error(`Error checking/connecting instance ${this.instanceName}:`, error);
      // Schedule a retry or notify admin?
    }
  }

  async _onInstanceConnected() {
    if (this.isConnected) return; // Prevent multiple calls
    this.isConnected = true;
    this.logger.info(`[${this.id}] Successfully connected to WhatsApp via Evolution API for instance ${this.instanceName}.`);
    
    if (this.eventHandler && typeof this.eventHandler.onConnected === 'function') {
      this.eventHandler.onConnected(this);
    }

    await this._sendStartupNotifications();
    await this.fetchAndPrepareBlockedContacts(); // Fetch initial blocklist
  }

  _onInstanceDisconnected(reason = 'Unknown') {
    if (!this.isConnected && reason !== 'INITIALIZING') return; // Prevent multiple calls if already disconnected
    const wasConnected = this.isConnected;
    this.isConnected = false;
    this.logger.info(`[${this.id}] Disconnected from WhatsApp (Instance: ${this.instanceName}). Reason: ${reason}`);
    
    if (this.eventHandler && typeof this.eventHandler.onDisconnected === 'function' && wasConnected) {
      this.eventHandler.onDisconnected(this, reason);
    }
    // Optionally, attempt to reconnect after a delay
    // setTimeout(() => this._checkInstanceStatusAndConnect(), 30000); // Reconnect after 30s
  }

  async handleWebsocket(data){
    return this._handleWebhook({websocket: true, body: data}, {sendStatus: () => 0 }, true);
  }
  async _handleWebhook(req, res, socket = false) {
    // this.logger.info(req.params);
    // const botIdFromPath = req.params.botId;
    // if (botIdFromPath !== this.id) {
    //   this.logger.warn(`Webhook received for unknown botId ${botIdFromPath}. Ignoring.`);
    //   return res.status(400).send('Unknown botId');
    // }

    const payload = req.body;
    //this.logger.debug(`[${this.id}] ${socket ? 'Websocket' : 'Webhook'} received: Event: ${payload.event}, Instance: ${payload.instance}`, payload.data?.key?.id || payload.data?.id);

    if (this.shouldDiscardMessage() && payload.event === 'messages.upsert') { // Only discard messages, not connection events
      this.logger.debug(`[${this.id}] Discarding webhook message during initial ${this.id} startup period.`);
      return res.sendStatus(200);
    }
    
    try {
      switch (payload.event) {
        case 'connection.update':
          const connectionState = payload.data?.state;
          this.logger.info(`[${this.id}] Connection update: ${connectionState}`);
          if (connectionState === 'CONNECTED') {
            this._onInstanceConnected();
          } else if (['CLOSE', 'DISCONNECTED', 'LOGGED_OUT', 'TIMEOUT', 'CONFLICT'].includes(connectionState)) {
            this._onInstanceDisconnected(connectionState);
          }
          break;

        case 'send.message':
/*
{
  event: 'send.message',
  instance: 'ravena-testes',
  data: {
    key: {
      remoteJid: '120363402005217365@g.us',
      fromMe: true,
      id: '3EB0B46BB2D742C4B85CC492153D8CA463DAB035'
    },
    pushName: '',
    status: 'PENDING',
    message: {
      conversation: '🗑 Só posso apagar minhas próprias mensagens ou mensagens de outros se eu for admin do grupo.'
    },
    contextInfo: null,
    messageType: 'conversation',
    messageTimestamp: 1748533669,
    instanceId: 'e1af61d2-4abc-4e85-9efb-b8f19df5eebc',
    source: 'unknown'
  },
  server_url: 'http://localhost:4567',
  date_time: '2025-05-29T12:47:49.381Z',
  sender: '555596424307@s.whatsapp.net', // CUIDAR ISSO PQ MUDA ESSE LIXO???
  apikey: '784C1817525B-4C53-BB49-36FF0887F8BF'
}
*/
          const incomingSentMessageData = Array.isArray(payload.data) ? payload.data[0] : payload.data;
          if (incomingSentMessageData && incomingSentMessageData.key && incomingSentMessageData.key.fromMe) {
            const incomingSentMessageData = Array.isArray(payload.data) ? payload.data[0] : payload.data;
            incomingSentMessageData.event = "send.message";
            incomingSentMessageData.sender = payload.sender;
            this.formatMessageFromEvo(incomingSentMessageData);
          }

          // Marca msg como enviada, não faço ideia qual os status, não tem no doc
          // talvez venha em outro evento...
          if(incomingSentMessageData.status != "PENDING"){
            this.logger.info(`======STATUS====== ${incomingSentMessageData.status} ======STATUS=====`);
          }

          if(incomingSentMessageData.status === "DELIVERY_ACK"){
            this.cacheManager.putSentMessageInCache(incomingSentMessageData.key); // Vai ser usado pra ver se a mensagem foi enviada
          }
          break;

        case 'messages.upsert':
          this.lastMessageReceived = Date.now();
          const incomingMessageData = Array.isArray(payload.data) ? payload.data[0] : payload.data;
          if (incomingMessageData && incomingMessageData.key) {
            // Basic filtering (from original bot)
            const chatToFilter = incomingMessageData.key.remoteJid;
            if (chatToFilter === this.grupoLogs || chatToFilter === this.grupoInvites || chatToFilter === this.grupoEstabilidade) {
                this.logger.debug(`[${this.id}] Ignoring message from system group: ${chatToFilter}`);
                break;
            }

            incomingMessageData.event = "messages.upsert";
            incomingMessageData.sender = payload.sender;
            //console.log(incomingMessageData);
            this.formatMessageFromEvo(incomingMessageData).then(formattedMessage => {
              if (formattedMessage && this.eventHandler && typeof this.eventHandler.onMessage === 'function') {
                if(!incomingMessageData.key.fromMe){ // Só rodo o onMessage s enão for msg do bot. preciso chamar o formatMessage pra elas serem formatadas e irem pro cache
                  this.eventHandler.onMessage(this, formattedMessage);
                }
              }
            }).catch(e => {
              this.logger(`[messages.upsert] Erro formatando mensagem`,incomingMessageData, e, "-----");
            })

          }
          break;
        
        case 'groups.upsert':
/*
{
  event: 'groups.upsert',
  instance: 'ravena-testes',
  data: [
    {
      id: '120363402005217365@g.us',
      subject: '💚mutez Subes ONLINE',
      subjectOwner: '555596424307@s.whatsapp.net',
      subjectTime: 1748560136,
      size: 2,
      creation: 1745262897,
      owner: '555598273712@s.whatsapp.net',
      desc: 'canal para inscritos na twitch do muutiz',
      descId: '8F5C7FE14D2F39D2',
      restrict: false,
      announce: false,
      isCommunity: false,
      isCommunityAnnounce: false,
      joinApprovalMode: false,
      memberAddMode: true,
      participants: [Array],
      author: '555598273712@s.whatsapp.net'
    }
  ],
  server_url: 'http://localhost:4567',
  date_time: '2025-05-29T20:21:26.033Z',
  sender: '555596424307@s.whatsapp.net',
  apikey: '784C1817525B-4C53-BB49-36FF0887F8BF'
}
*/        
          // Simular que um membro foi add
          const groupUpsertData = payload.data[0];
          groupUpsertData.action = "add";
          groupUpsertData.sender = payload.sender;
          groupUpsertData.isBotJoining = true; // Pra saber se não foi o bot add no grupo
          if (groupUpsertData && groupUpsertData.id && groupUpsertData.action && groupUpsertData.participants) {
             this._handleGroupParticipantsUpdate(groupUpsertData);
          }
          break;
        case 'group-participants.update':
          /*{
event: 'group-participants.update',
instance: 'ravena-testes',
data: {
  id: '120363402005217365@g.us',
  author: '555598273712@s.whatsapp.net',
  participants: [ '559591146078@s.whatsapp.net' ],
  action: 'remove'
},
server_url: 'http://localhost:4567',
date_time: '2025-05-28T17:14:08.899Z',
sender: '555596424307@s.whatsapp.net',
apikey: '784C1817525B-4C53-BB49-36FF0887F8BF'
          }*/
          const groupUpdateData = payload.data;
          groupUpdateData.isBotJoining = false;
          if (groupUpdateData && groupUpdateData.id && groupUpdateData.action && groupUpdateData.participants) {
             this.logger.info(`[${this.id}] Group participants update:`, groupUpdateData);
             this._handleGroupParticipantsUpdate(groupUpdateData);
          }
          break;
/*
{
  event: 'contacts.update',
  instance: 'ravena5',
  data: {
    remoteJid: '120363419136690677@g.us',
    pushName: 'thur',
    profilePicUrl: 'https://pps.whatsapp.net/v/t61.24694-24/491873879_682709417977241_6996710407633107392_n.jpg?ccb=11-4&oh=01_Q5Aa1gEbquJJ4ACmZNCLVVM5GVC7ovHNTLYASKJklr9nYWBMEQ&oe=68496F52&_nc_sid=5e03e0&_nc_cat=105',
    instanceId: '73edb4c1-ba23-4b09-b7d0-cf54da0a0eb6'
  },
  server_url: 'http://localhost:7654',
  date_time: '2025-06-01T11:08:25.047Z',
  sender: '555591537296@s.whatsapp.net',
}
*/
        case 'contacts.update':
          if(Array.isArray(payload.data)){
            for(const cttData of payload.data){
              if(cttData.pushname){ // Atualiza só se veio o nome, se não não tem sentido
                updateContact(cttData);
              }
            }
          }
          break;

        default:
          this.logger.debug(`[${this.id}] Unhandled webhook event: ${payload.event}`);
      }
    } catch (error) {
      this.logger.error(`[${this.id}] Error processing webhook for event ${payload.event}:`, error);
    }
    res.sendStatus(200);
  }

  async formatMessage(data){
    // Usada no ReactionsHandler pq a message que vem lá era do wwebjs
    // Agora o cache já retorna a mensagem formatada, não precisa formatar de novo
    return data;
  }


  formatMessageFromEvo(evoMessageData, skipCache = false) {
    // Explicitly return a new Promise
    return new Promise(async (resolve, reject) => { // Executor function is async to use await inside
      //this.logger.info(JSON.stringify(evoMessageData, null, "\t"));
      try {
        const key = evoMessageData?.key;
        const waMessage = evoMessageData?.message; // The actual message content part
        if (!key || !waMessage) {
          this.logger.warn(`[${this.id}] Incomplete Evolution message data for formatting:`, evoMessageData);
          resolve(null);
        }

        const chatId = key.remoteJid;
        const isGroup = chatId.endsWith('@g.us');
        let isSentMessage = false;
        // Added evoMessageData.author as a potential source
        let author = isGroup ? (evoMessageData.author || key.participant || key.remoteJid) : key.remoteJid;

        const messageTimestamp = typeof evoMessageData.messageTimestamp === 'number' 
            ? evoMessageData.messageTimestamp 
            : (typeof evoMessageData.messageTimestamp === 'string' ? parseInt(evoMessageData.messageTimestamp, 10) : Math.floor(Date.now()/1000));
        const responseTime = Math.max(0, this.getCurrentTimestamp() - messageTimestamp);

        if(evoMessageData.event === "send.message"){
          isSentMessage = true;
          author = evoMessageData.sender.split("@")[0]+"@c.us";
        } else {
          // send.message é evento de enviadas, então se não for, recebeu uma
          this.loadReport.trackReceivedMessage(isGroup, responseTime, author);
        }


        const authorName = evoMessageData.pushName || author.split('@')[0]; // pushName is often sender's name
        
        

        

        let type = 'unknown';
        let content = null;
        let caption = null;
        let mediaInfo = null; // To store { url, mimetype, filename, data (base64 if downloaded) }

        // Determine message type and content
        if (waMessage.conversation) {
          type = 'text';
          content = waMessage.conversation;
        } else if (waMessage.extendedTextMessage) {
          type = 'text';
          content = waMessage.extendedTextMessage.text;
        } else if (waMessage.imageMessage) {
          type = 'image';
          caption = waMessage.imageMessage.caption;
          mediaInfo = {
            isMessageMedia: true,
            mimetype: waMessage.imageMessage.mimetype || 'image/jpeg',
            url: waMessage.imageMessage.url, 
            filename: waMessage.imageMessage.fileName || `image-${key.id}.${mime.extension(waMessage.imageMessage.mimetype || 'image/jpeg') || 'jpg'}`,
            _evoMediaDetails: waMessage.imageMessage 
          };
          content = mediaInfo;
        } else if (waMessage.videoMessage) {
          type = 'video';
          caption = waMessage.videoMessage.caption;
          mediaInfo = {
            isMessageMedia: true,
            mimetype: waMessage.videoMessage.mimetype || 'video/mp4',
            url: waMessage.videoMessage.url,
            filename: waMessage.videoMessage.fileName || `video-${key.id}.${mime.extension(waMessage.videoMessage.mimetype || 'video/mp4') || 'mp4'}`,
            seconds: waMessage.videoMessage.seconds,
            _evoMediaDetails: waMessage.videoMessage
          };
          content = mediaInfo;
        } else if (waMessage.audioMessage) {
          type = waMessage.audioMessage.ptt ? 'ptt' : 'audio';
          mediaInfo = {
            isMessageMedia: true,
            mimetype: waMessage.audioMessage.mimetype || (waMessage.audioMessage.ptt ? 'audio/ogg' : 'audio/mpeg'),
            url: waMessage.audioMessage.url,
            filename: `audio-${key.id}.${mime.extension(waMessage.audioMessage.mimetype || (waMessage.audioMessage.ptt ? 'audio/ogg' : 'audio/mpeg')) || (waMessage.audioMessage.ptt ? 'ogg' : 'mp3')}`,
            seconds: waMessage.audioMessage.seconds,
            ptt: waMessage.audioMessage.ptt,
            _evoMediaDetails: waMessage.audioMessage
          };
          content = mediaInfo;
        } else if (waMessage.documentMessage) {
          type = 'document';
          caption = waMessage.documentMessage.title || waMessage.documentMessage.fileName;
          mediaInfo = {
            isMessageMedia: true,
            mimetype: waMessage.documentMessage.mimetype || 'application/octet-stream',
            url: waMessage.documentMessage.url,
            filename: waMessage.documentMessage.fileName || `document-${key.id}${waMessage.documentMessage.mimetype ? '.' + (mime.extension(waMessage.documentMessage.mimetype) || '') : ''}`.replace(/\.$/,''),
            title: waMessage.documentMessage.title,
            _evoMediaDetails: waMessage.documentMessage
          };
          content = mediaInfo;
        } else if (waMessage.stickerMessage) {
          type = 'sticker';
          mediaInfo = {
            isMessageMedia: true,
            isAnimated: waMessage.stickerMessage.isAnimated ?? false,
            mimetype: waMessage.stickerMessage.mimetype || 'image/webp',
            url: waMessage.stickerMessage.url,
            filename: `sticker-${key.id}.webp`,
            _evoMediaDetails: waMessage.stickerMessage
          };
          content = mediaInfo;
        } else if (waMessage.locationMessage) {
          type = 'location';
          content = {
            isLocation: true,
            latitude: waMessage.locationMessage.degreesLatitude,
            longitude: waMessage.locationMessage.degreesLongitude,
            name: waMessage.locationMessage.name,
            address: waMessage.locationMessage.address,
            description: waMessage.locationMessage.name || waMessage.locationMessage.address,
            jpegThumbnail: waMessage.locationMessage.jpegThumbnail,
          };
        } else if (waMessage.contactMessage) {
          type = 'contact';
          content = {
              isContact: true,
              displayName: waMessage.contactMessage.displayName,
              vcard: waMessage.contactMessage.vcard,
              _evoContactDetails: waMessage.contactMessage
          };
        } else if (waMessage.contactsArrayMessage) {
          type = 'contacts_array';
          content = {
              displayName: waMessage.contactsArrayMessage.displayName,
              contacts: waMessage.contactsArrayMessage.contacts.map(contact => ({
                  isContact: true,
                  displayName: contact.displayName, 
                  vcard: contact.vcard
              })),
              _evoContactsArrayDetails: waMessage.contactsArrayMessage
          };
        } 
        else if(waMessage.reactionMessage && evoMessageData.event === "messages.upsert"){ // Pra evitar pegar coisa do send.message
          const reactionData = waMessage.reactionMessage;
          if (reactionData && reactionData.key && !reactionData.key.fromMe) {
              if(reactionData.text !== ""){
                this.logger.debug(`[${this.id}] Received reaction:`, reactionData);
                this.reactionHandler.processReaction(this, { // await is used here
                  reaction: reactionData.text,
                  senderId: reactionData.key?.participant ? reactionData.key.participant.split("@")[0]+"@c.us" : waMessage.sender, // waMessage.sender vem no send.message event
                  msgId: {_serialized: reactionData.key.id}
                });
              }
          }
          resolve(null);
          return;
        }
        else {
          if(!isSentMessage){
            this.logger.warn(`[${this.id}] Unhandled Evolution message type:`, Object.keys(waMessage).join(', '));
            this.logger.warn(`[${this.id}][ev-${evoMessageData.event}] Unhandled Evolution message type:`, waMessage);
          }
          resolve(null);
          return;
        }

        const mentions = (evoMessageData.contextInfo?.mentionedJid ?? []).map(m => m.split("@")[0]+"@c.us");

        const isLid = ((evoMessageData.key.remoteJid.includes('@lid') || evoMessageData.key.participant?.includes('@lid')) && (evoMessageData.key.senderPn || evoMessageData.key.participantPn));
        const senderPn = isLid ? (evoMessageData.key.participantPn ?? evoMessageData.key.senderPn) : false; // quando vem @lid precisa pegar esse senderPn ou participantPn se for group (evo 2.3.0)

        if(isLid){
          this.logger.info(`[${this.id}][LID_WARNING] LID detectado. PN? ${JSON.stringify(senderPn)}\n---${JSON.stringify(evoMessageData)}\n---`);
          author = senderPn;
        }

        const formattedMessage = {
          evoMessageData: evoMessageData, // pra ser recuperada no cache
          id: key.id,
          fromMe: evoMessageData.key.fromMe,
          group: isGroup ? chatId : null,
          from: isGroup ? chatId : author,
          author: author.replace("@s.whatsapp.net", "@c.us"),
          name: authorName,
          authorName: authorName,
          pushname: authorName,
          type: type,
          content: content, 
          body: content,
          mentions: mentions,
          caption: caption,
          origin: {}, 
          responseTime: responseTime,
          timestamp: messageTimestamp,
          key: key, 
          secret: evoMessageData.message?.messageContextInfo?.messageSecret,
          hasMedia: (mediaInfo && (mediaInfo.url || mediaInfo._evoMediaDetails)),

          getContact: async () => {
              const contactIdToFetch = isGroup ? (key.participant || author) : author;
              return await this.getContactDetails(contactIdToFetch, senderPn, authorName);
          },

          getChat: async () => {
              return await this.getChatDetails(chatId);
          },
          delete: async (forEveryone = true) => { 
              return this.deleteMessageByKey(evoMessageData.key);
          },
          downloadMedia: async () => {
              if (mediaInfo && (mediaInfo.url || mediaInfo._evoMediaDetails)) {
                  const downloadedMedia = await this._downloadMediaAsBase64(mediaInfo, key, evoMessageData);
                  let stickerGif = false;
                  if(mediaInfo.isAnimated){
                    stickerGif = await this.convertAnimatedWebpToGif(downloadedMedia);
                    this.logger.debug(`[downloadMedia] isAnimated, gif salvo: '${stickerGif}'`);
                  }
                  return { mimetype: mediaInfo.mimetype, data: downloadedMedia, stickerGif, filename: mediaInfo.filename, source: 'file', isMessageMedia: true };
              }
              this.logger.warn(`[${this.id}] downloadMedia called for non-media or unfulfillable message:`, type, mediaInfo);
              return null;
          }
        };
        
        if (['image', 'video', 'sticker'].includes(type)) {
            try {
              const media = await formattedMessage.downloadMedia(); // await is used here
              if (media) {
                  formattedMessage.content = media;
              }
            } catch (dlError) {
                this.logger.error(`[${this.id}] Failed to pre-download media for NSFW check:`, dlError);
            }
        }


        formattedMessage.origin = {
          mentionedIds: formattedMessage.mentions,
          id: { _serialized: `${evoMessageData.key.remoteJid}_${evoMessageData.key.fromMe}_${evoMessageData.key.id}`},
          author: formattedMessage.author,
          from: formattedMessage.from,
          // If this.sendReaction is async, this will correctly return a Promise
          react: (emoji) => this.sendReaction(evoMessageData.key.remoteJid, evoMessageData.key.id, emoji), 
          getContact: formattedMessage.getContact,
          getChat: formattedMessage.getChat,
          getQuotedMessage: async () => {
            const quotedMsgId = evoMessageData.contextInfo?.quotedMessage ? evoMessageData.contextInfo?.stanzaId : null;
            return await this.recoverMsgFromCache(quotedMsgId);
          },
          delete: async () => {
            return this.deleteMessageByKey(evoMessageData.key);
          },
          body: content,
          ...evoMessageData
        };

        if(!skipCache){
          this.cacheManager.putMessageInCache(formattedMessage);
        }
        resolve(formattedMessage); // Resolve with the formatted message

      } catch (error) {
        this.logger.error(`[${this.id}] Error formatting message from Evolution API:`, error, evoMessageData);
        // To match original behavior of returning null on error (which means promise resolves with null)
        resolve(null); 
        // If you'd rather have the promise reject on error, use:
        // reject(error); 
      }
    });
  }
  
  shortJson(json, max = 30){
    return JSON.stringify(json, null, "\t").substring(0,max);
  }

  async _downloadMediaAsBase64(mediaInfo, messageKey, evoMessageData) {
    this.logger.debug(`[${this.id}] Download media for: ${mediaInfo.filename}`);

    if (!messageKey || !messageKey.id || !messageKey.remoteJid) {
      this.logger.error(`[${this.id}] Crucial messageKey information (id, remoteJid) is missing. Cannot use /chat/getBase64FromMediaMessage.`);
      // Proceed to fallback if messageKey is invalid or essential parts are missing.
    }

    if (messageKey && messageKey.id && messageKey.remoteJid && this.evolutionApiUrl && this.evolutionApiKey && this.instanceName) {
      this.logger.info(`[${this.id}] Attempting media download via Evolution API POST /chat/getBase64FromMediaMessage for: ${mediaInfo.filename}`);
      try {
        const endpoint = `${this.evolutionApiUrl}/chat/getBase64FromMediaMessage/${this.instanceName}`;
        const payload = {message: evoMessageData};
        if(evoMessageData.videoMessage){
          payload.convertToMp4 = true;
        }

        if (messageKey.participant) {
          payload.participant = messageKey.participant;
        }
        //this.logger.debug(`[${this.id}] Calling Evolution API POST endpoint: ${endpoint} with payload: ${this.shortJson(payload)}`);

        const response = await axios.post(endpoint, payload, {
          headers: {
            'apikey': this.evolutionApiKey,
            'Content-Type': 'application/json', // Explicitly set Content-Type for POST
          },
          // timeout: 30000, // 30 seconds, for example
        });

        // Process the response (same logic as before):
        if (response.data) {
          if (typeof response.data === 'string' && response.data.length > 100) {
            this.logger.info(`[${this.id}] Media downloaded successfully as direct base64 string via Evolution API for: ${mediaInfo.filename}`);
            return response.data;
          } else if (response.data.base64 && typeof response.data.base64 === 'string') {
            this.logger.info(`[${this.id}] Media downloaded successfully (from base64 field) via Evolution API for: ${mediaInfo.filename}`);
            writeFileAsync('teste.webp', Buffer.from(response.data.base64, 'base64'));
            return response.data.base64;
          } else {
            this.logger.warn(`[${this.id}] Evolution API /chat/getBase64FromMediaMessage did not return expected base64 data for ${mediaInfo.filename}. Response data:`, response.data);
          }
        } else {
          this.logger.warn(`[${this.id}] No data received from Evolution API /chat/getBase64FromMediaMessage for ${mediaInfo.filename}`);
        }

      } catch (apiError) {
        let errorMessage = apiError.message;
        if (apiError.response) {
          errorMessage = `Status: ${apiError.response.status}, Data: ${JSON.stringify(apiError.response.data)}`;
        }
        this.logger.error(`[${this.id}] Error downloading media via Evolution API POST /chat/getBase64FromMediaMessage for ${mediaInfo.filename}: ${errorMessage}`);
      }
    } else {
      this.logger.info(`[${this.id}] Skipping Evolution API POST /chat/getBase64FromMediaMessage download for ${mediaInfo.filename} due to missing messageKey or API configuration.`);
    }

    this.logger.warn(`[${this.id}] Failed to download media for ${mediaInfo.filename} using all available methods.`);
    return null;
  }

  async sendMessage(chatId, content, options = {}) {
    this.logger.debug(`[${this.id}] sendMessage to ${chatId} (Type: ${typeof content} / ${JSON.stringify(options)})`); // , {content: typeof content === 'string' ? content.substring(0,30) : content, options}
    try {
      const isGroup = chatId.endsWith('@g.us');
      this.loadReport.trackSentMessage(isGroup); // From original bot

      if (this.safeMode) {
        this.logger.info(`[${this.id}] [SAFE MODE] Would send to ${chatId}: ${typeof content === 'string' ? content.substring(0, 70) + '...' : '[Media/Object]'}`);
        return { id: { _serialized: `safe-mode-msg-${this.rndString()}` }, ack: 0, body: content }; // Mimic wwebjs
      }

      
      if (!this.isConnected) {
        this.logger.warn(`[${this.id}] Attempted to send message while disconnected from ${this.instanceName}.`);
        throw new Error('Not connected to WhatsApp via Evolution API');
      }
      

      // Variáveis padrões do payload
      const evoPayload = {
        number: chatId,
        delay: options.delay || 0, //Math.floor(Math.random() * (1500 - 300 + 1)) + 300
        linkPreview: options.linkPreview ?? false
      };

      if(options.evoReply){
        evoPayload.quoted = options.evoReply;
      }


      // Ou marca todos com a API do EVO ou menciona manual alguns
      if(options.marcarTodos){
        evoPayload.mentionEveryOne = true;
      } else {
        if(options.mentions && options.mentions.length > 0){
          evoPayload.mentioned = options.mentions.map(s => s.split('@')[0]);
        }
      }

      if(options.quotedMsgId){
        // quotedMessageId: message.origin.id._serialized
        // Esse id serialized é xxx_xxx_key.id
        const mentionedKey = options.quotedMsgId.split("_")[2]; 
        if(mentionedKey){
          evoPayload.quoted = { key: { id: mentionedKey } };
        } else {
          this.logger.info(`[sendMessage] quotedMsgId: ${options.quotedMsgId}, não tem key?`);
        }
      }


      // Não usar o formato completo, apenas os dados `data:${content.mimetype};base64,${content.data}`
      let formattedContent = (content.data && content.data?.length > 10) ? content.data : (content.url ?? content);

      // Cada tipo de mensagem tem um endpoint diferente
      let endpoint = null;
      if (typeof content === 'string' && !options.sendMediaAsSticker) { // sticker pode vir URL, que é string
        endpoint = '/message/sendText';
        evoPayload.text = content;
        evoPayload.presence = "composing";

      } else if (content instanceof MessageMedia || content.isMessageMedia || options.sendMediaAsSticker) {

        endpoint = '/message/sendMedia';
        this.logger.debug(`[sendMessage] ${endpoint} (${JSON.stringify(options)})`);
        

        let mediaType = 'image';

        if(content.mimetype){
          if (content.mimetype.includes('image')) mediaType = 'image';
          else if (content.mimetype.includes('mp4')) mediaType = 'video';
          else if (content.mimetype.includes('audio') || content.mimetype.includes('ogg')) mediaType = 'audio';
        }


        if (options.sendMediaAsDocument){
          mediaType = 'document';
          evoPayload.fileName = content.filename || `media.${mime.extension(content.mimetype) || 'bin'}`;
        }

        if (options.sendMediaAsSticker){
          this.logger.debug(`[sendMessage] sendMediaAsSticker: ${formattedContent}`);
          if(!formattedContent.startsWith("http")){
            if(mediaType == 'video' || mediaType == 'gif'){
              // Converter pra aceitar sticker animado
              formattedContent = await this.convertToSquareAnimatedGif(formattedContent);
            } else {
              // Essa lib estica as imagens de stickers, mas quero preservar como era antes
              formattedContent = await this.convertToSquarePNGImage(formattedContent);
            }
          }
          this.logger.debug("[sendMesage] cheguei aqui 6");
          endpoint = '/message/sendSticker';
          this.logger.debug(`[sendMessage] ${endpoint}`);
          evoPayload.sticker = formattedContent;
        }

        if (options.sendAudioAsVoice || mediaType === 'audio'){
          endpoint = '/message/sendWhatsAppAudio';
          evoPayload.audio = formattedContent;
          evoPayload.presence = "recording";
        } 

        if (options.sendVideoAsGif && mediaType === 'video'){
          formattedContent = await this.convertToSquareAnimatedGif(formattedContent);
          mediaType = "image"; // GIF precisa ser enviado como imagem
        } 

        if (options.isViewOnce) evoPayload.viewOnce = true;

        if(options.caption && options.caption.length > 0){
          evoPayload.caption = options.caption;
        }

        evoPayload.mediatype = mediaType;
        
        if(!evoPayload.sticker && !evoPayload.audio){ // sticker e audio no endpoint não usam o 'media'
          evoPayload.media = formattedContent;
        }
      } else if (content instanceof Location || content.isLocation) {
        endpoint = '/message/sendLocation';
        this.logger.debug(`[sendMessage] ${endpoint}`);

        evoPayload.latitude = content.latitude;
        evoPayload.longitude = content.longitude;
        evoPayload.name = content.description || content.name || "Localização";
      } else if (content instanceof Contact || content.isContact) {
        endpoint = '/message/sendContact';
        this.logger.debug(`[sendMessage] ${endpoint}`);
        
        evoPayload.contact = [{
            "fullName": content.name ?? content.pushname,
            "wuid": content.number,
            "phoneNumber": content.number
            // "organization": "Company Name",
            // "email": "email",
            // "url": "url page"
        }];
      } else if (content instanceof Poll || content.isPoll) {
        endpoint = '/message/sendPoll';
        this.logger.debug(`[sendMessage] ${endpoint}`);

        evoPayload.name = content.name;
        evoPayload.selectableCount = contet.options.allowMultipleAnswers ? content.pollOptions.length : 1;
        evoPayload.values = content.pollOptions;
      } else {
        this.logger.error(`[${this.id}] sendMessage: Unhandled content type for Evolution API. Content:`, content);
        //throw new Error('Unhandled content type for Evolution API');
        return;
      }


      //this.logger.info(`EVO- API posting, ${endpoint}`, evoPayload);
      const response = await this.apiClient.post(endpoint, evoPayload);

      // Mimic whatsapp-web.js Message object structure for return (as much as useful)
      return {
        id: {
          _serialized: response.key?.id || `evo-msg-${this.rndString()}`,
          remote: response.key?.remoteJid || chatId,
          fromMe: true, // Sent by us
          participant: response.key?.participant // if sent to group, bot is participant
        },
        ack: this._mapEvoStatusToAck(response.status), // You'll need to map Evo's status
        body: typeof content === 'string' ? content : `[${evoPayload.mediaMessage?.mediaType || 'media'}]`,
        type: typeof content === 'string' ? 'text' : (evoPayload.mediaMessage?.mediaType || 'unknown'),
        timestamp: Math.floor(Date.now() / 1000),
        from: this.phoneNumber ? `${this.phoneNumber.replace(/\D/g, '')}@c.us` : this.instanceName, // Approximate sender
        to: chatId,
        url: (content && content.url) ? content.url : undefined, // if media sent by URL
        _data: response,
        getInfo: () => { // Usado no StreamSystem pra saber se foi enviada
          return { delivery: [1], played: [1],read: [1] };
        }
      };

    } catch (error) {
      this.logger.error(`[${this.id}] Error sending message to ${chatId} via Evolution API:`, error);
      throw error; // Re-throw for the caller (e.g., CommandHandler) to handle
    }
  }
  
  _mapEvoStatusToAck(status) {
    // Based on Evolution API documentation for message status
    // PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, ERROR: -1
    // This is a guess, check Evo docs for actual status strings/numbers
    if (!status) return 0; // Undefined or pending
    status = status.toUpperCase();
    if (status === 'SENT' || status === 'DELIVERED_TO_SERVER') return 1; // Message sent to server
    if (status === 'DELIVERED_TO_USER' || status === 'DELIVERED') return 2; // Delivered to recipient
    if (status === 'READ' || status === 'SEEN') return 3; // Read by recipient
    if (status === 'ERROR' || status === 'FAILED') return -1;
    return 0; // Default for other statuses like "PENDING"
  }

  async sendReturnMessages(returnMessages) {
    if (!Array.isArray(returnMessages)) {
      returnMessages = [returnMessages];
    }
    const validMessages = returnMessages.filter(msg => msg && msg.isValid && msg.isValid());
    if (validMessages.length === 0) {
      this.logger.warn(`[${this.id}] No valid ReturnMessages to send.`);
      return [];
    }
    const results = [];
    for (const message of validMessages) {
      if (message.delay > 0) {
        await sleep(message.delay);
      }
      
      let contentToSend = message.content;
      let options = { ...(message.options || {}) }; // Clone options

      try {
        const result = await this.sendMessage(message.chatId, contentToSend, options);
        results.push(result);

        if (message.reaction && result && result.id?._serialized) {
          try {
              await this.sendReaction(message.chatId, result.id._serialized, message.reaction); // Assuming result.id has the ID
          } catch (reactError) {
              this.logger.error(`[${this.id}] Failed to send reaction "${message.reaction}" to ${result.id._serialized}:`, reactError);
          }
        }
      } catch(sendError) {
        this.logger.error(`[${this.id}] Failed to send one of the ReturnMessages to ${message.chatId}:`, sendError);
        results.push({ error: sendError, messageContent: message.content }); // Push error for this message
      }
    }
    return results;
  }

  async createMedia(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
      }
      const data = fs.readFileSync(filePath, { encoding: 'base64' });
      const filename = path.basename(filePath);
      const mimetype = mime.lookup(filePath) || 'application/octet-stream';
      return { mimetype, data, filename, source: 'file', isMessageMedia: true }; // MessageMedia compatible
    } catch (error) {
      this.logger.error(`[${this.id}] Evo: Error creating media from ${filePath}:`, error);
      throw error;
    }
  }

  async updateContact(contactData){
    // TODO
    // O evento vem com @g.us... não vem o numero da pessoa, só se for no PV
    const contato = {
      isContact: false,
      id: { _serialized: contactData },
      name: profileData.name,
      pushname: profileData.name,
      number: number,
      isUser: true,
      status: profileData.status,
      isBusiness: profileData.isBusiness,
      picture: profileData.picture,
      block: async () => {
        return await this.setCttBlockStatus(number, "block");
      },
      unblock: async () => {
        return await this.setCttBlockStatus(number, "unblock");
      }
    };

    this.cacheManager.putContactInCache(contato);
  }

  // Essa ode alterar pra mandar a URL e o Evolution se vira
  async createMediaFromURL(url, options = { unsafeMime: true }) {
    try {
      // For Evolution API, passing URL directly to `sendMessage` is often possible if `content.url` is used.
      const filename = path.basename(new URL(url).pathname) || 'media_from_url';
      let mimetype = mime.lookup(url.split("?")[0]) || (options.unsafeMime ? 'application/octet-stream' : null);
      
      if (!mimetype && options.unsafeMime) {
          // Try to get Content-Type header if it's a direct download
          try {
              const headResponse = await axios.head(url);
              this.logger.info("mimetype do hedaer? ", headResponse);
              mimetype = headResponse.headers['content-type']?.split(';')[0] || 'application/octet-stream';
          } catch(e) { /* ignore */ }
      }
      return { url, mimetype, filename, source: 'url', isMessageMedia: true}; // MessageMedia compatible for URL sending
    } catch (error) {
      this.logger.error(`[${this.id}] Evo: Error creating media from URL ${url}:`, error);
      throw error;
    }
  }
  
  // --- Placeholder/To be implemented based on Evo API specifics ---
  async getContactDetails(cid, senderPn, prefetchedName = false) {
    if (!cid) return null;

    try {
      let contato;
      /*if(contactId.includes("@lid")){ // Consertado na evo 2.3.0
        this.logger.debug(`[getContactDetails][${this.id}] IGNORING contact with LID: ${contactId}`);
        contato = {
          isContact: false,
          id: { _serialized: contactId },
          name: `Pessoa Misteriosa`,
          pushname: `Pessoa Misteriosa`,
          number: contactId.split('@')[0],
          isUser: true,
          status: "",
          isBusiness: false,
          picture: ""
        };
      } else {
      */

      let contactId = ((typeof cid === "object") ? cid.id : cid) ?? null;

      const isLid = contactId.includes("@lid") && senderPn;
      contactId = isLid ? senderPn : contactId;

      const number = contactId.split("@")[0];
      contato = await this.recoverContactFromCache(number);

      if(isLid){
        this.logger.debug(`[getContactDetails][${this.id}][DEBUG_LID] ${JSON.stringify(cid)}, senderPn: ${JSON.stringify(senderPn)}`);
      }

      if(!contato){
        this.logger.debug(`[getContactDetails][${this.id}] Fetching contact details for: ${contactId}`);
        const profileData = await this.apiClient.post(`/chat/fetchProfile`, {number});
        if(profileData){
          contato = {
            isContact: false,
            id: { _serialized: contactId },
            name: profileData.name ?? prefetchedName,
            pushname: profileData.name ?? prefetchedName,
            number: number,
            isUser: true,
            status: profileData.status,
            isBusiness: profileData.isBusiness,
            picture: profileData.picture,
            block: async () => {
              return await this.setCttBlockStatus(number, "block");
            },
            unblock: async () => {
              return await this.setCttBlockStatus(number, "unblock");
            }
          };

          this.cacheManager.putContactInCache(contato);
          return contato;
        } else {
          this.logger.debug(`[getContactDetails][${this.id}] Não consegui pegar os dados para '${contactId}'`);
          contato = {
            isContact: false,
            id: { _serialized: contactId },
            name: `Pessoa Misteriosa`,
            pushname: `Pessoa Misteriosa`,
            number: contactId.split('@')[0],
            isUser: true,
            status: "",
            isBusiness: false,
            picture: ""
          };
        }
      }
      
      //this.logger.debug(`[getContactDetails][${this.id}] Dados do cache para '${number}'`);

      return contato;
      /*
      profileData
      {
        wuid: '555598273712@s.whatsapp.net',
        name: 'moothz',
        numberExists: true,
        picture: 'https://pps.whatsapp.net/v/t61.24694-24/366408615_6228517803924212_5681812432108429726_n.jpg?ccb=11-4&oh=01_Q5Aa1gGsIN043_6xCmfA-TTP9uy_1ZSPWtWoZjCiQ1opre47HQ&oe=68458BB2&_nc_sid=5e03e0&_nc_cat=105',
        status: { status: 'mude mesas', setAt: '2019-12-07T23:02:57.000Z' },
        isBusiness: false
      }
      */
      /*
      // Aqui vem um array com todos os contatos do celular...
      this.logger.debug(`[${this.id}] Fetching contact details for: ${contactId}`);
      // Aqui vem um array com todos os contatos do celular...
      const contactsData = await this.apiClient.post(`/chat/findContacts`); // { where: {id: contactId} }
      //this.logger.debug(`[${this.id}] contactsData:`, contactsData);

      const contactData = contactsData.find(c => c.remoteJid == contactId);
      if(contactData){
        return {
          isContact: true,
          id: { _serialized: contactData.jid || contactId },
          name: contactData.pushName || contactData.name || contactData.notify, // 'name' is usually the saved name, 'notify' is pushName
          pushname: contactData.pushName || contactData.name || contactData.notify,
          number: (contactData.remoteJid || contactId).split('@')[0],
          isUser: true, // Assume
          // ... other relevant fields from Evo response
          _rawEvoContact: contactData
        };
      } else {
        return {
          isContact: false,
          id: { _serialized: contactId },
          name: `Nome ${contactId}`,
          pushname: `Nome ${contactId}`,
          number: contactId.split('@')[0],
          isUser: true
        };
      }
      */
    } catch (error) {
      this.logger.error(`[${this.id}] Failed to get contact details.`, error);
      return { id: { _serialized: "000000000000@c.us" }, name: "000000000000", pushname: "000000000000", number: "000000000000", isUser: true, _isPartial: true }; // Basic fallback
    }
  }

  setCttBlockStatus(ctt, blockStatus){
    return new Promise(async (resolve, reject) => {
      try{
        this.logger.debug(`[setCttBlockStatus][${this.instanceName}] '${ctt}' => '${blockStatus}'`);
        const resp = await this.apiClient.post(`/chat/updateBlockStatus`, { number: ctt, status: blockStatus });

        resolve(resp.accepted);
      } catch(e){
        this.logger.warn(`[setCttBlockStatus] Erro setando blockStatus ${blockStatus} para '${ct}'`);
        reject(e);
      }

    });
  }

  acceptInviteCode(inviteCode){
    return new Promise(async (resolve, reject) => {
      try{
        this.logger.debug(`[acceptInviteCode][${this.instanceName}] '${inviteCode}'`);
        const resp = await this.apiClient.get(`/group/acceptInviteCode`, { inviteCode });

        resolve(resp.accepted);
      } catch(e){
        this.logger.warn(`[acceptInviteCode] Erro pegando invite info para '${inviteCode}'`);
        reject(e);
      }

    });
  }

  inviteInfo(inviteCode){
    return new Promise(async (resolve, reject) => {
      try{
        this.logger.debug(`[inviteInfo][${this.instanceName}] '${inviteCode}'`);
        const inviteInfo = await this.apiClient.get(`/group/inviteInfo`, { inviteCode });
        this.logger.info(`[inviteInfo] '${inviteCode}': ${JSON.stringify(inviteInfo)}`);

        resolve(inviteInfo);
      } catch(e){
        this.logger.warn(`[inviteInfo] Erro pegando invite info para '${inviteCode}'`);
        reject(e);
      }

    });
  }

  leaveGroup(groupJid){
    try{
      this.logger.debug(`[leaveGroup][${this.instanceName}] '${groupJid}'`);
      this.apiClient.delete(`/group/leaveGroup`, { groupJid });
    } catch(e){
      this.logger.warn(`[leaveGroup] Erro saindo do grupo '${groupJid}'`, e);
    }
  }

  updateProfilePicture(url){
    try{
      this.logger.debug(`[updateProfilePicture][${this.instanceName}] '${url}'`);
      this.apiClient.post(`/chat/updateProfilePicture`, { picture: url });
    } catch(e){
      this.logger.warn(`[updateProfilePicture] Erro trocando imagem '${url}'`, e);
    }
  }

  updateProfileStatus(status){
    try{
      this.logger.debug(`[updateProfileStatus][${this.instanceName}] '${status}'`);
      this.apiClient.post(`/chat/updateProfileStatus`, { status });
    } catch(e){
      this.logger.warn(`[updateProfileStatus] Erro definindo status '${status}'`, status);
    }
  }
  async getChatDetails(chatId) {
    /*
{
  "id": "120363295648424210@g.us",
  "subject": "Example Group",
  "subjectOwner": "553198296801@s.whatsapp.net",
  "subjectTime": 1714769954,
  "pictureUrl": null,
  "size": 1,
  "creation": 1714769954,
  "owner": "553198296801@s.whatsapp.net",
  "desc": "optional",
  "descId": "BAE57E16498982ED",
  "restrict": false,
  "announce": false,
  "participants": [
    {
      "id": "553198296801@s.whatsapp.net",
      "admin": "superadmin"
    }
  ]
}
    */
    if (!chatId) return null;
    try {
      this.logger.debug(`[${this.id}] Fetching chat details for: ${chatId}`);
      if (chatId.endsWith('@g.us')) {
        const groupData = await this.apiClient.get(`/group/findGroupInfos`, { groupJid: chatId });
        //this.logger.debug(`[${this.id}] groupInfos:`, groupData);

        return {
          setSubject: async (title) => {
            return await this.apiClient.post(`/group/updateGroupSubject`, { groupJid: chatId, subject: title });
          },
          fetchMessages: async (limit = 30) => {
            //https://doc.evolution-api.com/v2/api-reference/chat-controller/find-messages
            return false;
          },
          setMessagesAdminsOnly: async (adminOnly) => {
            if(adminOnly){
              return await this.apiClient.post(`/group/updateSetting`, { groupJid: chatId, action: "announcement" });
            } else {
              return await this.apiClient.post(`/group/updateSetting`, { groupJid: chatId, action: "not_announcement" });
            }
          },
          id: { _serialized: groupData.id || chatId },
          name: groupData.subject,
          isGroup: true,
          participants: groupData.participants.map(p => {
            return {
              id: { _serialized: p.id.split("@")[0]+"@c.us" },
              isAdmin: p.admin?.includes("admin") ?? false
            }
          }), // Structure this as needed
          // ... other group fields like description (subjectOwner, etc.)
          _rawEvoGroup: groupData
        };
      } else { // User chat
        // For user chats, often there isn't a separate "chat" object beyond the contact
        const contact = await this.getContactDetails(chatId);
        return {
          isContact: true,
          id: { _serialized: chatId },
          name: contact.name || contact.pushname,
          isGroup: false,
          // ...
          _rawEvoContactForChat: contact // if needed
        };
      }
    } catch (error) {
      this.logger.error(`[${this.id}] Failed to get chat details for ${chatId}:`, error);
      return { id: { _serialized: chatId }, name: chatId.split('@')[0], isGroup: chatId.endsWith('@g.us'), _isPartial: true }; // Basic fallback
    }
  }

  
  async deleteMessageByKey(key){
      if (!key) {
          this.logger.error(`[${this.id}] Invalid messageKey for deletion. ${key}`);
          return false;
      }

      this.logger.info(`[${this.id}][deleteMessage] Requesting deletion of message ${JSON.stringify(key)}`);
      try {
        return this.apiClient.delete("/chat/deleteMessageForEveryone", { ...key  });
      } catch (error) {
        this.logger.error(`[${this.id}][deleteMessage] Failed to delete message ${JSON.stringify(key)}:`, error);
        return false;
      }
  }

  async sendReaction(chatId, messageId, reaction) {
      // reaction can be an emoji string e.g. "👍" or "" to remove
      
      // Sanitizar a string pra quela tenha só um emoji e apenas isso mais nada e nada mais
      reaction = (reaction.match(/(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu) || [])[0] || "";
      if (!this.isConnected) {
          this.logger.warn(`[${this.id}] Cannot send reaction, not connected.`);
          return;
      }
      this.logger.debug(`[${this.id}] Sending reaction '${reaction}' in chat ${chatId}`);
      try {
          const payload = {
                key: { remoteJid: chatId, id: messageId, fromMe: false }, 
                reaction: reaction
          };
          await this.apiClient.post(`/message/sendReaction`, payload);
          return true;
      } catch (error) {
          this.logger.error(`[${this.id}] Failed to send reaction '${reaction}':`, error);
          return false;
      }
  }

  async _handleGroupParticipantsUpdate(groupUpdateData) {
    this.logger.info(groupUpdateData);

    const groupId = groupUpdateData.id;
    const action = groupUpdateData.action;
    const participants = groupUpdateData.isBotJoining ? [{ id: `${this.phoneNumber}@s.whatsapp.net`, admin: null }] : groupUpdateData.participants; // Array of JIDs

    try {
        let groupName;
        if(groupUpdateData.subject){
          groupName = groupUpdateData.subject;
        } else {
          this.logger.info(`[_handleGroupParticipantsUpdate] Não veio nome do grupo no evento, buscando infos de '${groupId}'`);
          const groupDetails = await this.getChatDetails(groupId);
          groupName = groupDetails?.name || groupId;
        }

        let gUpdAuthor;
        if(groupUpdateData.author){
          gUpdAuthor = (typeof groupUpdateData.author === "object") ? groupUpdateData.author?.id : groupUpdateData.author;
        } else {
          gUpdAuthor = groupUpdateData.owner ?? "123456789@c.us";
        }
        
        const responsibleContact = await this.getContactDetails(gUpdAuthor) ?? {id: gUpdAuthor.split("@")[0]+"@c.us", name: "Admin do Grupo"};
        if(gUpdAuthor.includes("@lid")){
          this.logger.info(`[_handleGroupParticipantsUpdate][LID_WARNING] gUpdAuthor é um @lid: ${gUpdAuthor}, ${JSON.stringify(groupUpdateData)}`);
        }

        for (const uid of participants) { // Dispara 1x para cada participant add
            const userId = (typeof uid === "object") ? uid.id : uid;
            const userContact = await this.getContactDetails(userId);

            if(gUpdAuthor.includes("@lid")){
              this.logger.info(`[_handleGroupParticipantsUpdate][LID_WARNING] userId adicionado é um @lid: ${userId}, ${JSON.stringify(participants)}`);
            }

            const eventData = {
                group: { id: groupId, name: groupName },
                user: { id: userId.split('@')[0]+"@c.us", name: userContact?.name || userId.split('@')[0] },
                responsavel: { id: responsibleContact.id?._serialized, name: responsibleContact.name || 'Sistema' },
                origin: { 
                    ...groupUpdateData, // Raw data from webhook related to this specific update
                    getChat: async () => await this.getChatDetails(groupId)
                } 
            };

            if (action === 'add') {
                if (this.eventHandler && typeof this.eventHandler.onGroupJoin === 'function') {
                    this.eventHandler.onGroupJoin(this, eventData);
                }
            } else if (action === 'remove' || action === 'leave') { // 'leave' might be self-leave
                if (this.eventHandler && typeof this.eventHandler.onGroupLeave === 'function') {
                    this.eventHandler.onGroupLeave(this, eventData);
                }
            }
        }
    } catch (error) {
        this.logger.error(`[${this.id}] Error processing group participant update:`, error, groupUpdateData);
    }
  }

  async isUserAdminInGroup(userId, groupId) {
    /*
{
  "participants": [
    {
      "id": "553198296801@s.whatsapp.net",
      "admin": "superadmin"
    }
  ]
}
    */
    if (!userId || !groupId) return false;
    try {
      const response = await this.apiClient.get(`/group/participants`, { groupJid: groupId });
      const member = response.participants.find(m => m.id.split("@")[0] === userId.split("@")[0]);
      if(member){
        const isAdmin = (member.admin ?? "").includes("admin");
        return isAdmin;
      }

      return false;
    } catch (error) {
      this.logger.error(`[${this.id}] Error checking admin status for ${userId} in ${groupId}:`, error);
      return false;
    }
  }

  async fetchAndPrepareBlockedContacts() {
    // Evolution API does not list a direct "get all blocked contacts" endpoint in the provided link.
    // It has /contacts/blockUnblock. This functionality might be limited or require different handling.
    this.blockedContacts = []; // Reset
    this.logger.info(`[${this.id}] Blocked contacts list management needs verification with Evolution API capabilities.`);
    // If an endpoint is found, implement fetching here. Example:
    // try {
    //   const blockedList = await this.apiClient.get(`/contacts/blockedlist`); // Hypothetical
    //   this.blockedContacts = blockedList.map(jid => ({ id: { _serialized: jid } }));
    // } catch (e) { this.logger.warn('Could not fetch blocked contacts.'); }
    this.prepareOtherBotsBlockList(); // From original bot
  }

  async _loadDonationsToWhitelist() {
    // From original bot, should work as is if database methods are stable
    try {
        const donations = await this.database.getDonations();
        for(let don of donations){
            if(don.numero && don.numero?.length > 5){
            this.whitelist.push(don.numero.replace(/\D/g, ''));
            }
        }
        this.logger.info(`[${this.id}] [whitelist] ${this.whitelist.length} números na whitelist do PV.`);
    } catch (error) {
        this.logger.error(`[${this.id}] Error loading donations to whitelist:`, error);
    }
  }

  async _sendStartupNotifications() {
    // From original bot
    if (!this.isConnected) return;
    if (this.grupoLogs) {
      try {
        await this.sendMessage(this.grupoLogs, `🤖 Bot ${this.id} (Evo) inicializado com sucesso em ${new Date().toLocaleString("pt-BR")}`);
      } catch (error) { this.logger.error(`[${this.id}] Error sending startup notification to grupoLogs:`, error); }
    }
    if (this.grupoAvisos) {
      try {
        // const startMessage = `🟢 [${this.phoneNumber.slice(2,4)}] *${this.id}* (Evo) tá _on_! (${new Date().toLocaleString("pt-BR")})`;
        // await this.sendMessage(this.grupoAvisos, startMessage); // Original was commented out
      } catch (error) { this.logger.error(`[${this.id}] Error sending startup notification to grupoAvisos:`, error); }
    }
  }
  
  // --- Utility methods from original bot that should largely remain compatible ---
  notInWhitelist(author){ // author is expected to be a JID string
    const cleanAuthor = author.replace(/\D/g, ''); // Cleans non-digits from JID user part
    return !(this.whitelist.includes(cleanAuthor))
  }

  rndString(){
    return (Math.random() + 1).toString(36).substring(7);
  }
  
  prepareOtherBotsBlockList() {
    if (!this.otherBots || !this.otherBots.length) return;
    if (!this.blockedContacts || !Array.isArray(this.blockedContacts)) {
      this.blockedContacts = [];
    }
    for (const bot of this.otherBots) { // Assuming otherBots is an array of JID-like strings or bot IDs
      const botId = bot.endsWith("@c.us") || bot.endsWith("@s.whatsapp.net") ? bot : `${bot}@c.us`; // Basic normalization
      if (!this.blockedContacts.some(c => c.id._serialized === botId)) {
        this.blockedContacts.push({
          id: { _serialized: botId },
          name: `Other Bot: ${bot}` // Or some identifier
        });
        this.logger.info(`[${this.id}] Added other bot '${botId}' to internal ignore list.`);
      }
    }
    this.logger.info(`[${this.id}] Ignored contacts/bots list size: ${this.blockedContacts.length}`);
  }

  shouldDiscardMessage() {
    const timeSinceStartup = Date.now() - this.startupTime;
    return timeSinceStartup < (parseInt(process.env.DISCARD_MSG_STARTUP_SECONDS) || 5) * 1000; // 5 seconds default
  }

  getCurrentTimestamp(){
    return Math.round(Date.now()/1000);
  }
  
  async destroy() {
    this.logger.info(`[${this.id}] Destroying Evolution API bot instance ${this.id} (Evo Instance: ${this.instanceName})`);
    if (this.webhookServer) {
      this.webhookServer.close(() => this.logger.info(`[${this.id}] Webhook server closed.`));
    }
    this._onInstanceDisconnected('DESTROYED'); // Mark as disconnected internally
    try {
      //await this.apiClient.post(`/instance/logout`); // Logout the instance
      //this.logger.info(`[${this.id}] Instance ${this.instanceName} logout requested.`);
    } catch (error) {
      this.logger.error(`[${this.id}] Error logging out instance ${this.instanceName}:`, error);
    }
    if (this.loadReport) this.loadReport.destroy();
    // Clean up other resources if necessary
  }

  async restartBot(reason = 'Restart requested') {
    this.logger.info(`[${this.id}] Restarting Evo bot ${this.id}. Reason: ${reason}`);
    if (this.grupoAvisos && this.isConnected) {
        try {
            await this.sendMessage(this.grupoAvisos, `🔄 Bot ${this.id} (Evo) reiniciando. Motivo: ${reason}`);
            await sleep(2000);
        } catch (e) { this.logger.warn(`[${this.id}] Could not send restart notification during restart:`, e.message); }
    }
    
    // Simplified destroy for restart (don't fully logout instance if it's a soft restart)
    if (this.webhookServer) {
      this.webhookServer.close();
      this.webhookServer = null;
    }
    this._onInstanceDisconnected('RESTARTING');
    if (this.loadReport) this.loadReport.destroy();
    // if (this.streamSystem) this.streamSystem.destroy(); this.streamSystem = null;

    this.logger.info(`[${this.id}] Bot resources partially cleared, attempting re-initialization...`);
    await sleep(2000);
    
    try {
      await this.initialize(); // Re-run the initialization process
      this.logger.info(`[${this.id}] Bot ${this.id} (Evo) re-initialization process started.`);
      // Success notification will be handled by _onInstanceConnected -> _sendStartupNotifications if grupoAvisos configured
    } catch (error) {
      this.logger.error(`[${this.id}] CRITICAL ERROR during bot restart:`, error);
      if (this.grupoLogs) {
        try {
          // Attempt to send error even if disconnected (might fail)
          await this.apiClient.post(`/message/sendText`, {
            number: this.grupoLogs,
            text: `❌ Falha CRÍTICA ao reiniciar bot ${this.id} (Evo). Erro: ${error.message}`
          }).catch(e => this.logger.error("Failed to send critical restart error to logs:", e.message));
        } catch (e) { /* ignore */ }
      }
    }
  }

  // Mock for createContact for now, as it's complex and depends on how EventHandler uses it
  async createContact(phoneNumber, name, surname) {
    this.logger.warn(`[${this.id}] WhatsAppBotEvo.createContact is a mock. Fetching real contact instead.`);
    const formattedNumber = phoneNumber.endsWith('@c.us') 
        ? phoneNumber 
        : `${phoneNumber.replace(/\D/g, '')}@c.us`;
    return await this.getContactDetails(formattedNumber);
  }

}

module.exports = WhatsAppBotEvo;