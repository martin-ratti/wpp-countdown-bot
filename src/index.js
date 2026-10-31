import http from 'node:http';
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

import { parseEventInput, buildTempResponse, buildEventsListResponse } from './countdown.js';
import {
  getEvents,
  addEvent,
  findEvent,
  removeEvent,
  clearAllEvents,
  isChatActive,
  activateChat,
  deactivateChat
} from './storage.js';

const makeWASocket = baileys.default || baileys;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_DIR = path.resolve(__dirname, '../auth_info');

// Servidor HTTP ligero para compatibilidad con el tier gratuito de Render (Web Service)
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('🤖 Bot de WhatsApp Cuenta Regresiva activo y funcionando.');
});
server.listen(PORT, () => {
  console.log(`🌐 Servidor de monitoreo activo en el puerto ${PORT}`);
});

// Rate limiting anti-spam (3 segundos de cooldown por chat)
const COOLDOWN_MS = 3000;
const lastCommandTime = new Map();

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

  const sock = makeWASocket({
    version,
    logger,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger)
    },
    printQRInTerminal: false,
    syncFullHistory: false,
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
      console.log('Control de activación: /activar o /bot on (Solo dueño)');
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

      // Identificar si el remitente es el dueño del bot (el teléfono vinculado)
      const sender = msg.key.participant || msg.key.remoteJid;
      const botNumber = sock.user?.id ? sock.user.id.split(':')[0] : null;
      const isOwner = Boolean(
        msg.key.fromMe ||
        (botNumber && sender.startsWith(botNumber))
      );

      // 1. COMANDOS DE ACTIVACIÓN / CONTROL DE ACCESO (Exclusivo para el Dueño)
      if (
        command === '/activar' ||
        command === '!activar' ||
        (command === '/bot' && rawArgs.toLowerCase() === 'on') ||
        (command === '!bot' && rawArgs.toLowerCase() === 'on')
      ) {
        if (!isOwner) {
          await sock.sendMessage(
            chatId,
            { text: '⚠️ *Acceso denegado.* Solo el dueño del bot puede activar este chat.' },
            { quoted: msg }
          );
          console.log(`⛔ [ACCESO DENEGADO] Intento de activación no autorizado en ${chatId}`);
          continue;
        }

        activateChat(chatId);
        const reply =
          `🟢 *¡Bot de Cuenta Regresiva ACTIVADO en este chat!* 🎉\n\n` +
          `A partir de ahora cualquier participante puede usar los comandos:\n` +
          `• */temp* - Ver cuánto falta para el próximo evento\n` +
          `• */eventos* - Ver la lista de eventos\n` +
          `• */set DD/MM/AAAA HH:mm Nombre* - Registrar un evento\n` +
          `• */ayuda* - Ver todos los comandos disponibles\n\n` +
          `_(Para desactivarlo en cualquier momento, el dueño puede enviar /desactivar)_`;
        await sock.sendMessage(chatId, { text: reply }, { quoted: msg });
        console.log(`✅ [ACTIVADO] Chat ${chatId} activado por el dueño.`);
        continue;
      }

      if (
        command === '/desactivar' ||
        command === '!desactivar' ||
        (command === '/bot' && rawArgs.toLowerCase() === 'off') ||
        (command === '!bot' && rawArgs.toLowerCase() === 'off')
      ) {
        if (!isOwner) {
          await sock.sendMessage(
            chatId,
            { text: '⚠️ *Acceso denegado.* Solo el dueño del bot puede desactivar este chat.' },
            { quoted: msg }
          );
          console.log(`⛔ [ACCESO DENEGADO] Intento de desactivación no autorizado en ${chatId}`);
          continue;
        }

        deactivateChat(chatId);
        const reply = `🔴 *Bot desactivado en este chat.* Ya no responderá a ningún comando aquí a menos que el dueño lo vuelva a activar con */activar*.`;
        await sock.sendMessage(chatId, { text: reply }, { quoted: msg });
        console.log(`🛑 [DESACTIVADO] Chat ${chatId} desactivado por el dueño.`);
        continue;
      }

      // FILTRO DE SEGURIDAD / WHITELIST:
      // Si el chat NO fue activado previamente por el dueño, ignorar silenciosamente
      if (!isChatActive(chatId)) {
        console.log(`🔒 [IGNORADO] Chat ${chatId} no está activado. Comando "${command}" descartado.`);
        continue;
      }

      // Control de Anti-Spam / Rate-Limiting por chat activado
      const now = Date.now();
      const lastTime = lastCommandTime.get(chatId) || 0;
      if (now - lastTime < COOLDOWN_MS) {
        console.log(`🛡️ [ANTI-SPAM] Cooldown activo en ${chatId}. Comando "${command}" ignorado.`);
        continue;
      }
      lastCommandTime.set(chatId, now);

      const senderType = isOwner ? 'Dueño (Vos)' : 'Participante';
      console.log(`\n📩 [MENSAJE RECIBIDO] de: ${senderType} | Chat: ${chatId}`);
      console.log(`   Comando: "${command}" | Args: "${rawArgs}"`);

      // 2. Comando /temp [número o nombre opcional]
      if (command === '/temp' || command === '!temp') {
        const events = getEvents(chatId);
        const event = findEvent(chatId, rawArgs);

        if (!event && rawArgs) {
          await sock.sendMessage(
            chatId,
            { text: `⚠️ No se encontró ningún evento que coincida con "*${rawArgs}*". Usá */eventos* para ver la lista completa.` },
            { quoted: msg }
          );
          console.log(`📤 [RESPUESTA] Evento no encontrado para "${rawArgs}".`);
          continue;
        }

        const replyText = buildTempResponse(event, new Date(), events.length);
        await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
        console.log(`📤 [RESPUESTA] Cuenta regresiva enviada.`);
        continue;
      }

      // 3. Comando /eventos o /events (Lista completa de eventos)
      if (command === '/eventos' || command === '!eventos' || command === '/events' || command === '!events') {
        const events = getEvents(chatId);
        const replyText = buildEventsListResponse(events);
        await sock.sendMessage(chatId, { text: replyText }, { quoted: msg });
        console.log(`📤 [RESPUESTA] Lista de ${events.length} eventos enviada.`);
        continue;
      }

      // 4. Comando /set (Agregar nuevo evento)
      if (command === '/set' || command === '!set') {
        if (!rawArgs) {
          const helpMsg =
            'ℹ️ *Uso del comando /set:*\n\n' +
            '👉 */set DD/MM/AAAA HH:mm Nombre del evento*\n\n' +
            '*Ejemplos:*\n' +
            '• `/set 15/11/2026 21:00 Cumple de Lucas`\n' +
            '• `/set 20/11/2026 Asado` _(sin hora asume 00:00 hs)_\n\n' +
            '📝 _Máximo 80 caracteres para el nombre._\n' +
            '💡 _Podés registrar múltiples eventos y verlos todos con */eventos*._';
          await sock.sendMessage(chatId, { text: helpMsg }, { quoted: msg });
          console.log(`📤 [RESPUESTA] Instrucciones de /set enviadas.`);
          continue;
        }

        const parseResult = parseEventInput(rawArgs);
        if (!parseResult.valid) {
          await sock.sendMessage(chatId, { text: `⚠️ ${parseResult.error}` }, { quoted: msg });
          console.log(`⚠️ [ERROR EN /set] ${parseResult.error}`);
          continue;
        }

        const { event: saved, total } = addEvent(chatId, {
          name: parseResult.name,
          targetIso: parseResult.targetIso,
          formattedDate: parseResult.formattedDate,
          setBy: sender
        });

        const successMsg =
          `✅ *¡Evento registrado con éxito!* (#${saved.id})\n\n` +
          `📌 *Evento:* ${saved.name}\n` +
          `📅 *Fecha y hora:* ${saved.formattedDate}\n\n` +
          `💡 Hay *${total} evento(s)* en este grupo.\n` +
          `• Usá */eventos* para ver la lista completa.\n` +
          `• Usá */temp* para ver el tiempo del próximo evento.`;

        await sock.sendMessage(chatId, { text: successMsg }, { quoted: msg });
        console.log(`📤 [RESPUESTA] Evento "${saved.name}" (#${saved.id}) guardado.`);
        continue;
      }

      // 5. Comando /deltemp [número o nombre] (Eliminar evento específico)
      if (command === '/deltemp' || command === '!deltemp') {
        if (!rawArgs) {
          await sock.sendMessage(
            chatId,
            { text: 'ℹ️ Indicá qué evento querés borrar:\n👉 */deltemp [número o nombre]*\n\n*Ejemplos:*\n• `/deltemp 1`\n• `/deltemp Lucas`\n\nUsá */eventos* para ver los números de cada uno.' },
            { quoted: msg }
          );
          continue;
        }

        const result = removeEvent(chatId, rawArgs);
        if (result.success) {
          await sock.sendMessage(
            chatId,
            { text: `🗑️ *Evento eliminado:* "${result.removed.name}".\nQuedan *${result.remainingCount} evento(s)* activos en el grupo.` },
            { quoted: msg }
          );
          console.log(`📤 [RESPUESTA] Evento "${result.removed.name}" eliminado.`);
        } else {
          await sock.sendMessage(
            chatId,
            { text: `⚠️ No se encontró ningún evento con "*${rawArgs}*". Consultá la lista con */eventos*.` },
            { quoted: msg }
          );
        }
        continue;
      }

      // 6. Comando /cleartemp (Eliminar todos los eventos del grupo)
      if (command === '/cleartemp' || command === '!cleartemp') {
        const removed = clearAllEvents(chatId);
        if (removed) {
          await sock.sendMessage(
            chatId,
            { text: '🗑️ *Todos los eventos fueron eliminados.* Ya no hay cuentas regresivas activas en este grupo.' },
            { quoted: msg }
          );
          console.log(`📤 [RESPUESTA] Todos los eventos eliminados.`);
        } else {
          await sock.sendMessage(
            chatId,
            { text: 'ℹ️ No había ningún evento registrado en este grupo.' },
            { quoted: msg }
          );
        }
        continue;
      }

      // 7. Comando /ayuda o /help (Menú de ayuda completo y actualizado)
      if (command === '/ayuda' || command === '!ayuda' || command === '/help' || command === '!help') {
        const helpText =
          `🤖 *BOT DE CUENTA REGRESIVA - GUÍA DE COMANDOS*\n\n` +
          `⏳ */temp*\n` +
          `   _Muestra cuánto falta para el evento más cercano._\n\n` +
          `⏳ */temp [número o nombre]*\n` +
          `   _Cuenta regresiva de un evento específico._\n` +
          `   _Ej: /temp 2  o  /temp Lucas_\n\n` +
          `📋 */eventos*\n` +
          `   _Muestra la lista de todos los eventos del grupo ordenados cronológicamente._\n\n` +
          `📅 */set DD/MM/AAAA HH:mm Nombre*\n` +
          `   _Agrega un nuevo evento al grupo._\n` +
          `   _Ej: /set 15/11/2026 21:00 Cumple de Lucas_\n` +
          `   _Nota: Si no ponés hora, asume 00:00 hs (máx. 80 caracteres)._\n\n` +
          `🗑️ */deltemp [número o nombre]*\n` +
          `   _Elimina un evento específico._\n` +
          `   _Ej: /deltemp 1  o  /deltemp Lucas_\n\n` +
          `🗑️ */cleartemp*\n` +
          `   _Elimina todos los eventos del grupo actual._\n\n` +
          `⚙️ */desactivar* (Solo dueño)\n` +
          `   _Desactiva el bot en este chat._\n\n` +
          `🛡️ _Protección anti-spam: Cooldown de 3 segundos entre comandos._`;

        await sock.sendMessage(chatId, { text: helpText }, { quoted: msg });
        console.log(`📤 [RESPUESTA] Menú de ayuda enviado.`);
        continue;
      }
    }
  });
}

// Cierre graceful
process.on('SIGTERM', () => {
  console.log('Recibida señal SIGTERM. Apagando bot limpiamente...');
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('Recibida señal SIGINT. Apagando bot limpiamente...');
  process.exit(0);
});

// Iniciar el bot
startBot().catch((err) => {
  console.error('Error fatal al iniciar el bot:', err);
});
