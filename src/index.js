import http from 'node:http';
import fs from 'node:fs';
import baileys, {
  DisconnectReason,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcodeTerminal from 'qrcode-terminal';
import QRCode from 'qrcode';
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

// Estado global de la conexión del bot
let botState = 'connecting'; // 'connecting' | 'qr_ready' | 'connected' | 'disconnected'
let currentQrSvg = null;
let connectedUser = null;

// Servidor HTTP con dashboard web para escaneo visual de QR y verificación de salud
const PORT = process.env.PORT || 3000;
const server = http.createServer((req, res) => {
  const url = req.url?.split('?')[0] || '/';

  // Endpoint de verificación de salud para Render / Railway / UptimeRobot (soporta /health y /healt)
  if (url === '/health' || url === '/healt') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(
      JSON.stringify({
        status: 'ok',
        state: botState,
        connectedUser: connectedUser || null,
        uptime: Math.floor(process.uptime())
      })
    );
  }

  // Dashboard Web interactivo y visualizador de QR en tiempo real
  if (url === '/' || url === '/qr') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });

    let bodyContent = '';
    let autoRefresh = '<meta http-equiv="refresh" content="5">';

    if (botState === 'connected') {
      autoRefresh = '<meta http-equiv="refresh" content="30">';
      bodyContent = `
        <div class="card status-connected">
          <div class="icon">✅</div>
          <h1>Bot Conectado con Éxito</h1>
          <p class="subtitle">El bot está activo y conectado a WhatsApp.</p>
          <div class="badge success">🟢 En línea: +${connectedUser}</div>
          <div class="info-box">
            <h3>⚙️ Modo Sigilo Activo:</h3>
            <p>Para activar el bot en cualquier grupo o chat privado, enviá como dueño:</p>
            <code>/activar</code> o <code>/bot on</code>
          </div>
        </div>
      `;
    } else if (botState === 'qr_ready' && currentQrSvg) {
      autoRefresh = '<meta http-equiv="refresh" content="5">';
      bodyContent = `
        <div class="card">
          <div class="icon">📱</div>
          <h1>Vincular WhatsApp</h1>
          <p class="subtitle">Escaneá este código QR con la app de WhatsApp en tu teléfono:</p>
          <ol class="steps">
            <li>Abrí <strong>WhatsApp</strong> en tu teléfono</li>
            <li>Andá a <strong>Dispositivos vinculados</strong> &gt; <strong>Vincular un dispositivo</strong></li>
            <li>Apuntá tu cámara a este código QR:</li>
          </ol>
          <div class="qr-container">
            ${currentQrSvg}
          </div>
          <p class="refresh-hint">🔄 El código se actualiza automáticamente cada 20 segundos.</p>
        </div>
      `;
    } else {
      autoRefresh = '<meta http-equiv="refresh" content="3">';
      bodyContent = `
        <div class="card">
          <div class="icon">🔄</div>
          <h1>Iniciando Conexión...</h1>
          <p class="subtitle">Preparando cliente de WhatsApp. Generando código QR...</p>
          <div class="spinner"></div>
          <p class="refresh-hint">Esta página se actualizará automáticamente en unos segundos.</p>
        </div>
      `;
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${autoRefresh}
  <title>Bot de WhatsApp - Cuenta Regresiva</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --primary: #25d366;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      max-width: 480px;
      width: 100%;
      padding: 32px 24px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    .icon { font-size: 44px; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; margin-bottom: 8px; color: #fff; }
    .subtitle { color: var(--text-muted); font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
    .steps {
      text-align: left;
      font-size: 13px;
      color: var(--text-muted);
      margin: 0 auto 20px;
      padding-left: 20px;
      line-height: 1.6;
    }
    .steps strong { color: var(--text); }
    .qr-container {
      background: #ffffff;
      padding: 16px;
      border-radius: 12px;
      display: inline-block;
      margin: 10px auto;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }
    .qr-container svg {
      display: block;
      width: 260px;
      height: 260px;
    }
    .refresh-hint { font-size: 12px; color: var(--text-muted); margin-top: 14px; }
    .badge {
      display: inline-block;
      padding: 8px 16px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 600;
      margin: 16px 0;
    }
    .badge.success { background: rgba(37, 211, 102, 0.15); color: #25d366; border: 1px solid rgba(37, 211, 102, 0.3); }
    .info-box {
      background: #0f172a;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 14px;
      text-align: left;
      font-size: 13px;
      margin-top: 16px;
    }
    .info-box h3 { font-size: 13px; margin-bottom: 6px; color: var(--primary); }
    .info-box code {
      background: #334155;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      color: #38bdf8;
    }
    .spinner {
      border: 4px solid rgba(255,255,255,0.1);
      border-top: 4px solid var(--primary);
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: 24px auto;
    }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
  </style>
</head>
<body>
  ${bodyContent}
</body>
</html>`;

    return res.end(html);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Ruta no encontrada');
});

// Enlazar explícitamente a 0.0.0.0 para que Render, Railway y Docker detecten el puerto
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌐 Servidor web y de monitoreo activo en http://0.0.0.0:${PORT}`);
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

  // Identificación en WhatsApp: Nombre "Bor" e icono de navegador Chrome
  const sock = makeWASocket({
    version,
    logger,
    browser: ['Bor', 'Chrome', '1.0.0'],
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

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      botState = 'qr_ready';
      try {
        currentQrSvg = await QRCode.toString(qr, {
          type: 'svg',
          margin: 2,
          width: 280
        });
      } catch (err) {
        console.error('Error generando SVG de QR:', err);
      }

      console.log('\n======================================================');
      console.log('📱 ESCANEÁ ESTE CÓDIGO QR CON WHATSAPP EN TU TELÉFONO');
      console.log('(WhatsApp > Dispositivos vinculados > Vincular un dispositivo)');
      console.log(`🌐 O escanealo directamente en la web abriendo: http://localhost:${PORT}`);
      console.log('======================================================\n');
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === 'close') {
      botState = 'disconnected';
      currentQrSvg = null;
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;

      console.log(`⚠️ Conexión cerrada (código: ${statusCode}). ¿Desvinculado?: ${isLoggedOut}`);

      if (isLoggedOut) {
        console.log('🔄 Sesión desvinculada por WhatsApp. Limpiando credenciales y generando nuevo QR en 3s...');
        try {
          fs.rmSync(AUTH_DIR, { recursive: true, force: true });
        } catch (err) {
          console.error('Error al limpiar auth_info:', err);
        }
        setTimeout(startBot, 3000);
      } else {
        console.log('🔄 Reconectando socket en 3 segundos...');
        setTimeout(startBot, 3000);
      }
    } else if (connection === 'open') {
      botState = 'connected';
      currentQrSvg = null;
      connectedUser = sock.user?.id ? sock.user.id.split(':')[0] : 'Desconocido';

      console.log('\n======================================================');
      console.log(`✅ ¡BOT CONECTADO CON ÉXITO A WHATSAPP! (+${connectedUser})`);
      console.log('Esperando comandos en chats y grupos...');
      console.log('Modo Sigilo activo: /activar o /bot on (Solo el dueño)');
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

      // 1. COMANDOS DE ACTIVACIÓN / CONTROL DE ACCESO (Modo Sigilo / Stealth)
      if (
        command === '/activar' ||
        command === '!activar' ||
        (command === '/bot' && rawArgs.toLowerCase() === 'on') ||
        (command === '!bot' && rawArgs.toLowerCase() === 'on')
      ) {
        if (!isOwner) {
          console.log(`🤫 [MODO SIGILO] Intento de activación no autorizado en ${chatId} ignorado en silencio.`);
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
          console.log(`🤫 [MODO SIGILO] Intento de desactivación no autorizado en ${chatId} ignorado en silencio.`);
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
        console.log(`🔒 [IGNORADO] Chat ${chatId} no está activado. Comando "${command}" descartado en silencio.`);
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
let isShuttingDown = false;
const handleShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`Recibida señal ${signal}. Apagando bot limpiamente...`);
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

// Iniciar el bot
startBot().catch((err) => {
  console.error('Error fatal al iniciar el bot:', err);
});
