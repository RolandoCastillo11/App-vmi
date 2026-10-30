import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason, 
  WASocket,
  proto
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';

interface WhatsAppGatewayState {
  isConnected: boolean;
  qrDataUrl: string | null;
  qrRaw: string | null;
  connectedPhone: string | null;
  lastError: string | null;
  isInitializing: boolean;
}

const state: WhatsAppGatewayState = {
  isConnected: false,
  qrDataUrl: null,
  qrRaw: null,
  connectedPhone: null,
  lastError: null,
  isInitializing: false
};

let sock: WASocket | null = null;
let messageHandlerCallback: ((text: string, phone: string) => Promise<string | null>) | null = null;

const SESSIONS_DIR = path.join(process.cwd(), 'whatsapp_auth_sessions');

export function getWhatsAppGatewayState() {
  return { ...state };
}

export async function initWhatsAppGateway(
  onIncomingMessage: (text: string, phone: string) => Promise<string | null>
) {
  messageHandlerCallback = onIncomingMessage;

  if (state.isInitializing || state.isConnected) {
    return;
  }

  state.isInitializing = true;
  state.lastError = null;

  try {
    if (!fs.existsSync(SESSIONS_DIR)) {
      fs.mkdirSync(SESSIONS_DIR, { recursive: true });
    }

    const { state: authState, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR);

    // Creamos el socket de conexión de Baileys
    sock = makeWASocket({
      auth: authState,
      printQRInTerminal: false, // Manejamos nosotros el QR para app y terminal
      browser: ['VMI CEDIS Altamira', 'Chrome', '1.0.0'],
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        state.qrRaw = qr;
        try {
          state.qrDataUrl = await QRCode.toDataURL(qr, { width: 320, margin: 2 });
          console.log('\n======================================================');
          console.log('📲 ¡CÓDIGO QR DE WHATSAPP DISPONIBLE!');
          console.log('Escanea el QR en la app web o en la terminal para vincular tu número:');
          const terminalQr = await QRCode.toString(qr, { type: 'terminal', small: true });
          console.log(terminalQr);
          console.log('======================================================\n');
        } catch (qrErr) {
          console.error('Error generando QR data URL:', qrErr);
        }
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp Gateway] Conexión cerrada. Código: ${statusCode}. Reconectar: ${shouldReconnect}`);
        
        state.isConnected = false;
        state.qrDataUrl = null;
        state.isInitializing = false;

        if (shouldReconnect) {
          setTimeout(() => {
            initWhatsAppGateway(onIncomingMessage);
          }, 3000);
        } else {
          // Si cerró sesión, limpiar credenciales
          try {
            fs.rmSync(SESSIONS_DIR, { recursive: true, force: true });
          } catch {}
          state.connectedPhone = null;
        }
      } else if (connection === 'open') {
        console.log('======================================================');
        console.log('✅ ¡WHATSAPP VINCULADO CON ÉXITO AL SERVIDOR!');
        const userJid = sock?.user?.id || '';
        const phone = userJid.split(':')[0] || userJid.split('@')[0];
        state.connectedPhone = `+${phone}`;
        state.isConnected = true;
        state.qrDataUrl = null;
        state.isInitializing = false;
        console.log(`Número de atención de pedidos activo: ${state.connectedPhone}`);
        console.log('======================================================');
      }
    });

    const botSentIds = new Set<string>();

    function extractMessageContent(m: any): string {
      const content = 
        m.message?.ephemeralMessage?.message || 
        m.message?.viewOnceMessage?.message || 
        m.message?.viewOnceMessageV2?.message || 
        m.message?.documentWithCaptionMessage?.message ||
        m.message;

      return (
        content?.conversation ||
        content?.extendedTextMessage?.text ||
        content?.imageMessage?.caption ||
        content?.videoMessage?.caption ||
        ''
      ).trim();
    }

    // Escuchar mensajes entrantes en tiempo real
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // Atender tanto notify como append (para chats propios y sincronización en vivo)
      if (type !== 'notify' && type !== 'append') return;

      for (const m of messages) {
        if (!m.key || !m.message) continue;

        // Evitar bucles: ignorar mensajes generados y enviados por este mismo bot
        if (m.key.id && botSentIds.has(m.key.id)) continue;

        const remoteJid = m.key.remoteJid || '';
        // Ignorar grupos y difusiones de estado
        if (!remoteJid || remoteJid.endsWith('@g.us') || remoteJid.includes('broadcast')) {
          continue;
        }

        const myPhoneClean = state.connectedPhone?.replace(/\D/g, '') || '';
        const userJidPhone = sock?.user?.id?.split(':')[0]?.replace(/\D/g, '') || '';
        const userLidPhone = sock?.user?.lid?.split(':')[0] || '';

        // Detectar si el usuario está probando el bot enviándose un mensaje a sí mismo
        const isSelfChat = 
          Boolean(m.key.fromMe) && (
            (myPhoneClean && remoteJid.includes(myPhoneClean)) || 
            (userJidPhone && remoteJid.includes(userJidPhone)) ||
            (userLidPhone && remoteJid.includes(userLidPhone))
          );

        // Si fue enviado por el teléfono del dueño a OTRA persona, no intervenir
        if (m.key.fromMe && !isSelfChat) {
          continue;
        }

        const messageText = extractMessageContent(m);
        if (!messageText) continue;

        const senderPhone = remoteJid.split('@')[0];
        console.log(`\n📩 [WhatsApp Recibido] De +${senderPhone} (Self: ${isSelfChat}): "${messageText}"`);

        if (messageHandlerCallback) {
          try {
            // Mostrar indicador "escribiendo..." en WhatsApp del cliente
            await sock?.sendPresenceUpdate('composing', remoteJid);

            const replyText = await messageHandlerCallback(messageText, `+${senderPhone}`);

            if (replyText && sock) {
              const sentMsg = await sock.sendMessage(remoteJid, { text: replyText });
              if (sentMsg?.key?.id) {
                botSentIds.add(sentMsg.key.id);
                // Limitar el tamaño del historial de IDs del bot
                if (botSentIds.size > 500) {
                  const oldest = botSentIds.values().next().value;
                  if (oldest) botSentIds.delete(oldest);
                }
              }
              console.log(`📤 [WhatsApp Respondido] A +${senderPhone}: "${replyText.substring(0, 50)}..."`);
            }
          } catch (replyErr) {
            console.error('Error procesando respuesta automática de WhatsApp:', replyErr);
          } finally {
            await sock?.sendPresenceUpdate('paused', remoteJid);
          }
        }
      }
    });

  } catch (err: any) {
    console.error('Error inicializando WhatsApp Gateway:', err);
    state.lastError = err?.message || 'Error desconocido';
    state.isInitializing = false;
  }
}

export async function disconnectWhatsAppGateway() {
  try {
    if (sock) {
      await sock.logout();
      sock = null;
    }
  } catch {}
  try {
    if (fs.existsSync(SESSIONS_DIR)) {
      fs.rmSync(SESSIONS_DIR, { recursive: true, force: true });
    }
  } catch {}
  state.isConnected = false;
  state.qrDataUrl = null;
  state.connectedPhone = null;
  state.isInitializing = false;
}
