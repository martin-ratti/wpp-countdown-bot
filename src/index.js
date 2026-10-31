import baileys, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseEventInput, buildTempResponse } from './countdown.js';
import { getEvent, setEvent, removeEvent } from './storage.js';

const makeWASocket = baileys.default || baileys;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '../auth_info');

/**
 * Desenvuelve mensajes anidados (efímeros, viewOnce, con multimedia, etc.)
 */
function unwrapMessage(rawMessage) {
  if (!rawMessage) return null;
  let msg = rawMessage;

  if (msg.ephemeralMessage) msg = msg.ephemeralMessage.message;
  if (msg.viewOnceMessage) msg = msg.viewOnceMessage.message;
  if (msg.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;
  if (msg.documentWithCaptionMessage) msg = msg.documentWithCaptionMessage.message;

  return msg;
}

/**
 * Extrae el texto legible de cualquier tipo de mensaje
 */
function getMessageText(rawMessage) {
  const msg = unwrapMessage(rawMessage);
  if (!msg) return '';

  return (
    msg.conversation ||
    msg.extendedTextMessage?.text ||
    msg.imageMessage?.caption ||
    msg.videoMessage?.caption ||
    ''
  ).trim();
}

/**
 * Función principal de conexión del bot
 */
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
  const { version } = await fetchLatestBaileysVersion();
  const logger = pino({ level: 'silent' });

  // Usamos makeCacheableSignalKeyStore para evitar el error de "Bad MAC" por colisiones de I/O en disco
  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    printQRInTerminal: false,
    syncFullHistory: false, // Evita saturar la sesión descargando gigabytes de chats viejos
    generateHighQualityLinkPreview: false,
    getMessage: async () => ({ conversation: '' })
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n======================================================');
      console.log('📱 ESCANEÁ ESTE CÓDIGO QR CON WHATSAPP EN TU TELÉFONO');
      console.log('(WhatsApp > Dispositivos vinculados > Vincular un dispositivo)');
      console.log('======================================================\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(`⚠️ Conexión cerrada (código: ${statusCode}). Reconectando: ${shouldReconnect}`);

      if (shouldReconnect) {
        setTimeout(startBot, 3000);
      } else {
        console.log('❌ Sesión cerrada permanentemente. Eliminá la carpeta auth_info para volver a vincular.');
      }
    } else if (connection === 'open') {
      console.log('\n======================================================');
      console.log('✅ ¡BOT CONECTADO CON ÉXITO A WHATSAPP!');
      console.log('Esperando comandos en chats y grupos...');
      console.log('Comandos listos: /temp, /set, /cleartemp, /ayuda');
      console.log('======================================================\n');
    }
  });

  // Escuchar mensajes entrantes y enviados desde el propio teléfono
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify' && type !== 'append') return;

    for (const msg of messages) {
      if (!msg.message) continue;

      const chatId = msg.key.remoteJid;
      if (!chatId) continue;

      const text = getMessageText(msg.message);
      if (!text || (!text.startsWith('/') && !text.startsWith('!'))) continue;

      const [commandRaw] = text.split(/\s+/);
      const command = commandRaw.toLowerCase();
      const rawArgs = text.slice(commandRaw.length).trim();

      const senderType = msg.key.fromMe ? 'Vos (tu teléfono)' : 'Otro usuario';
      console.log(`\n📩 [MENSAJE RECIBIDO] de: ${senderType} | Chat: ${chatId}`);
      console.log(`   Comando: "${command}" | Argumentos: "${rawArgs}"`);

      // 1. Comando /temp
      if (command === '/temp' || command === '!temp') {
        const event = getEvent(chatId);
        const replyText = buildTempResponse(event);
        await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
        console.log(`📤 [RESPUESTA ENVIADA] Cuenta regresiva enviada al chat.`);
        continue;
      }

      // 2. Comando /set
      if (command === '/set' || command === '!set') {
        if (!rawArgs) {
          const helpMsg =
            'ℹ️ *Uso del comando /set:*\n\n' +
            '👉 */set DD/MM/AAAA HH:mm Nombre del evento*\n\n' +
            '*Ejemplos:*\n' +
            '• `/set 25/12/2026 21:00 Fiesta de Navidad`\n' +
            '• `/set 31/12/2026 Fin de Año`';
          await sock.sendMessage(chatId, { text: helpMsg }, { quoted: msg });
          console.log(`📤 [RESPUESTA ENVIADA] Instrucciones de /set enviadas.`);
          continue;
        }

        const parseResult = parseEventInput(rawArgs);
        if (!parseResult.valid) {
          await sock.sendMessage(chatId, { text: `⚠️ ${parseResult.error}` }, { quoted: msg });
          console.log(`⚠️ [ERROR EN /set] ${parseResult.error}`);
          continue;
        }

        const sender = msg.key.participant || msg.key.remoteJid;
        const saved = setEvent(chatId, {
          name: parseResult.name,
          targetIso: parseResult.targetIso,
          formattedDate: parseResult.formattedDate,
          setBy: sender
        });

        const successMsg =
          `✅ *¡Evento configurado con éxito!*\n\n` +
          `📌 *Evento:* ${saved.name}\n` +
          `📅 *Fecha y hora:* ${saved.formattedDate}\n\n` +
          `💡 Podés consultar cuánto falta en cualquier momento enviando */temp*.`;

        await sock.sendMessage(chatId, { text: successMsg }, { quoted: msg });
        console.log(`📤 [RESPUESTA ENVIADA] Evento "${saved.name}" configurado para ${saved.formattedDate}.`);
        continue;
      }

      // 3. Comando /cleartemp o /deltemp
      if (command === '/cleartemp' || command === '!cleartemp' || command === '/deltemp') {
        const removed = removeEvent(chatId);
        if (removed) {
          await sock.sendMessage(
            chatId,
            { text: '🗑️ *Cuenta regresiva eliminada.* Ya no hay ningún evento configurado en este grupo.' },
            { quoted: msg }
          );
          console.log(`📤 [RESPUESTA ENVIADA] Evento eliminado del chat.`);
        } else {
          await sock.sendMessage(
            chatId,
            { text: 'ℹ️ No había ningún evento configurado en este grupo.' },
            { quoted: msg }
          );
          console.log(`📤 [RESPUESTA ENVIADA] Aviso de que no había evento activo.`);
        }
        continue;
      }

      // 4. Comando /ayuda o /help
      if (command === '/ayuda' || command === '!ayuda' || command === '/help' || command === '!help') {
        const helpText =
          `🤖 *BOT DE CUENTA REGRESIVA - COMANDOS*\n\n` +
          `⏳ */temp* - Muestra cuánto falta para el evento de este grupo.\n\n` +
          `📅 */set DD/MM/AAAA HH:mm Nombre* - Configura un nuevo evento.\n` +
          `   _Ej: /set 25/12/2026 21:00 Asado con amigos_\n\n` +
          `🗑️ */cleartemp* - Borra el evento actual del grupo.\n\n` +
          `❓ */ayuda* - Muestra este mensaje de ayuda.`;

        await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
        console.log(`📤 [RESPUESTA ENVIADA] Menú de ayuda enviado.`);
        continue;
      }
    }
  });
}

// Iniciar el bot
startBot().catch((err) => {
  console.error('Error fatal al iniciar el bot:', err);
});
