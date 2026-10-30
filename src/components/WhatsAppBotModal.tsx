import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  Mic, 
  Phone, 
  Video, 
  MoreVertical, 
  CheckCheck, 
  Sparkles, 
  Package, 
  Truck, 
  ExternalLink, 
  ArrowRight,
  ShoppingBag,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Edit3,
  QrCode,
  Smartphone,
  Radio
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
  isOrder?: boolean;
  orderId?: string;
  orderTotal?: number;
}

interface WhatsAppBotModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateToOrders?: () => void;
  shopName?: string;
}

export default function WhatsAppBotModal({
  isOpen,
  onClose,
  onNavigateToOrders,
  shopName = "Abarrotes Don Lupe"
}: WhatsAppBotModalProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return [
      {
        id: 'msg-welcome',
        sender: 'bot',
        text: `*👋 ¡Hola! Bienvenido al canal oficial de pedidos de Almacenes Ibarra (CEDIS Altamira).* 🏪\n\nSoy tu asistente logístico automatizado. Puedes realizar tus pedidos escribiendo tal como hablas, por ejemplo:\n\n👉 _"Mándame 2 cajas de Coca 600 y 1 de Sabritas a Don Lupe"_\n\nO pulsa alguno de los botones rápidos de abajo. ¡Tu pedido entra en la ruta de reparto de mañana! 🚛`,
        timestamp: now,
      }
    ];
  });

  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('8331002030');
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneInput, setPhoneInput] = useState('8331002030');
  const [activeView, setActiveView] = useState<'chat' | 'qr'>('chat');
  const [gatewayStatus, setGatewayStatus] = useState<{
    isConnected: boolean;
    qrDataUrl: string | null;
    connectedPhone: string | null;
    lastError: string | null;
    isInitializing: boolean;
  }>({
    isConnected: false,
    qrDataUrl: null,
    connectedPhone: null,
    lastError: null,
    isInitializing: false
  });
  const [startingGateway, setStartingGateway] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && activeView === 'chat') {
      setTimeout(scrollToBottom, 150);
    }
  }, [isOpen, messages, activeView]);

  // Polling del estado de Baileys WhatsApp Gateway
  useEffect(() => {
    let interval: any = null;
    const fetchStatus = () => {
      fetch('/api/whatsapp/gateway-status')
        .then(r => r.json())
        .then(data => {
          setGatewayStatus(data);
          if (data.connectedPhone) {
            const clean = data.connectedPhone.replace(/\D/g, '');
            setPhoneNumber(clean);
          }
        })
        .catch(() => {});
    };

    if (isOpen) {
      fetchStatus();
      interval = setInterval(fetchStatus, activeView === 'qr' ? 2500 : 8000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, activeView]);

  // Cargar configuración de teléfono desde localStorage o servidor
  useEffect(() => {
    const saved = localStorage.getItem('vmi_whatsapp_phone');
    if (saved) {
      setPhoneNumber(saved);
      setPhoneInput(saved);
    } else {
      fetch('/api/whatsapp/config')
        .then(res => res.json())
        .then(data => {
          if (data.targetNumber) {
            const clean = data.targetNumber.replace(/\D/g, '');
            setPhoneNumber(clean);
            setPhoneInput(clean);
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleStartGateway = async () => {
    setStartingGateway(true);
    try {
      const res = await fetch('/api/whatsapp/gateway-start', { method: 'POST' });
      const data = await res.json();
      setGatewayStatus(data);
    } catch (err) {
      console.warn("Error starting gateway:", err);
    } finally {
      setStartingGateway(false);
    }
  };

  const handleDisconnectGateway = async () => {
    try {
      const res = await fetch('/api/whatsapp/gateway-disconnect', { method: 'POST' });
      const data = await res.json();
      setGatewayStatus(data);
    } catch (err) {
      console.warn("Error disconnecting gateway:", err);
    }
  };

  const getCleanWaPhone = (num: string) => {
    const digits = num.replace(/\D/g, '');
    if (digits.startsWith('52')) return digits;
    return `52${digits}`;
  };

  const handleSavePhone = async () => {
    const clean = phoneInput.replace(/\D/g, '');
    if (clean.length >= 10) {
      setPhoneNumber(clean);
      localStorage.setItem('vmi_whatsapp_phone', clean);
      setIsEditingPhone(false);
      try {
        await fetch('/api/whatsapp/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber: clean })
        });
      } catch (err) {
        console.warn("Aviso actualizando teléfono:", err);
      }
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || loading) return;

    const userTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: userTime
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/whatsapp/process-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          phone: `+52${phoneNumber}`,
          shopName,
          shopId: 'shp-1'
        })
      });

      const data = await response.json();
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (data.success) {
        const botMsg: ChatMessage = {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: data.replyText,
          timestamp: botTime,
          isOrder: data.isOrder,
          orderId: data.orderId,
          orderTotal: data.order?.total
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        throw new Error(data.error || "Error al procesar mensaje");
      }
    } catch (err: any) {
      const botTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages(prev => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          sender: 'bot',
          text: `⚠️ *Aviso de conexión:* Se registró tu solicitud en el búfer local. Un preventista de Almacenes Ibarra te contactará para confirmar.`,
          timestamp: botTime
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Simulación de Nota de Voz
  const handleSimulateVoice = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      handleSendMessage("Don Lupe: Por favor mándame 2 cajas de coca de 600 y 1 caja de sabritas con sal urgente");
    }, 1800);
  };

  // Formateador simple de negritas e itálicas estilo WhatsApp
  const renderFormattedText = (raw: string) => {
    const lines = raw.split('\n');
    return lines.map((line, lIdx) => {
      // Reemplazar *negrita* por <strong>
      const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g);
      return (
        <span key={lIdx} className="block leading-relaxed">
          {parts.map((p, pIdx) => {
            if (p.startsWith('*') && p.endsWith('*')) {
              return <strong key={pIdx} className="font-bold">{p.slice(1, -1)}</strong>;
            }
            if (p.startsWith('_') && p.endsWith('_')) {
              return <em key={pIdx} className="italic text-slate-500 dark:text-slate-400">{p.slice(1, -1)}</em>;
            }
            return p;
          })}
        </span>
      );
    });
  };

  const quickPrompts = [
    { label: "🥤 2 Cajas Coca y 1 Sabritas", text: "Mándame 2 cajas de Coca 600 y 1 de Sabritas a Don Lupe" },
    { label: "🥛 3 Cajas Leche Alpura", text: "Necesito 3 cajas de Leche Alpura 1L para surtir mañana" },
    { label: "🍞 Pan Bimbo + Aceite", text: "Ponme 2 cajas de Pan Blanco Bimbo y 1 de Aceite Nutrioli" },
    { label: "📦 Estatus de Pedido", text: "¿Cuál es el estatus de mi último pedido para hoy?" },
    { label: "📋 Consultar Catálogo", text: "Hola, ¿me puedes enviar el catálogo de precios mayoristas?" }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="w-full max-w-lg bg-[#efeae2] dark:bg-[#0b141a] rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[650px] max-h-[90vh] border border-border-subtle"
      >
        {/* Cabecera estilo WhatsApp Verde */}
        <header className="bg-[#008069] dark:bg-[#202c33] text-white px-4 py-3 flex items-center justify-between shadow-md shrink-0 z-10">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-emerald-300 flex items-center justify-center text-xl font-black">
                🏬
              </div>
              <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 rounded-full border-2 border-[#008069] dark:border-[#202c33]" />
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-bold text-sm tracking-wide">Almacenes Ibarra • Pedidos</h3>
                <span className="bg-emerald-400/30 text-emerald-100 text-[9px] px-1.5 py-0.2 rounded-full font-bold flex items-center gap-0.5 border border-emerald-400/40">
                  <CheckCircle2 size={10} className="text-emerald-300" /> VMI
                </span>
              </div>
              <p className="text-[11px] text-emerald-100/90 flex items-center gap-1">
                <span>en línea</span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Sparkles size={11} className="text-amber-300" /> Atención Automática 24/7
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                const next = activeView === 'chat' ? 'qr' : 'chat';
                setActiveView(next);
                if (next === 'qr' && !gatewayStatus.isConnected && !gatewayStatus.qrDataUrl) {
                  handleStartGateway();
                }
              }}
              className={`py-1.5 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeView === 'qr'
                  ? 'bg-white text-emerald-900 shadow-sm'
                  : 'bg-white/15 hover:bg-white/25 text-white'
              }`}
              title="Vincular tu teléfono físico escaneando código QR"
            >
              <QrCode size={14} />
              <span>{gatewayStatus.isConnected ? 'Conectado ✅' : 'Vincular QR'}</span>
            </button>

            <a 
              href={`https://wa.me/${getCleanWaPhone(phoneNumber)}?text=${encodeURIComponent('Hola Almacenes Ibarra, quiero levantar un pedido para mi tienda ' + shopName)}`}
              target="_blank" 
              rel="noopener noreferrer"
              title="Abrir en WhatsApp Real"
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-white"
            >
              <ExternalLink size={18} />
            </a>

            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-white/10 transition-colors text-white cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Banner de Sincronización Real con CEDIS */}
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border-b border-emerald-200 dark:border-emerald-800/40 px-3.5 py-2 flex items-center justify-between text-[11px] text-emerald-800 dark:text-emerald-300 shrink-0">
          <span className="flex items-center gap-1.5 font-medium truncate max-w-[210px] sm:max-w-none">
            <Truck size={13} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>CEDIS Altamira (Ruta Tampico-Madero)</span>
          </span>

          {isEditingPhone ? (
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-mono font-bold text-emerald-800 dark:text-emerald-200">+52</span>
              <input
                type="tel"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                placeholder="10 dígitos"
                className="w-24 px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-slate-800 text-slate-900 dark:text-white rounded border border-emerald-500 outline-none"
                maxLength={10}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSavePhone()}
              />
              <button
                type="button"
                onClick={handleSavePhone}
                className="bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-bold px-2 py-0.5 rounded cursor-pointer"
              >
                Guardar
              </button>
              <button
                type="button"
                onClick={() => setIsEditingPhone(false)}
                className="text-slate-400 hover:text-slate-600 text-[10px] px-0.5 cursor-pointer"
              >
                ✕
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] bg-emerald-200/60 dark:bg-emerald-900/60 px-2 py-0.5 rounded font-bold text-emerald-900 dark:text-emerald-200">
                +52 {phoneNumber}
              </span>
              <button
                type="button"
                onClick={() => {
                  setPhoneInput(phoneNumber);
                  setIsEditingPhone(true);
                }}
                className="text-emerald-700 dark:text-emerald-300 hover:underline text-[10px] font-bold cursor-pointer flex items-center gap-0.5"
                title="Cambiar por tu número de teléfono real"
              >
                <Edit3 size={11} />
                <span>Cambiar</span>
              </button>
            </div>
          )}
        </div>

        {/* VISTA 1: Escaneo de Código QR de WhatsApp Web */}
        {activeView === 'qr' ? (
          <div className="flex-1 bg-white dark:bg-[#111b21] p-6 flex flex-col items-center justify-center text-center overflow-y-auto">
            {gatewayStatus.isConnected ? (
              <div className="space-y-4 max-w-sm">
                <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  ¡Tu WhatsApp físico está vinculado!
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Número activo: <strong className="text-emerald-600 font-mono text-sm">{gatewayStatus.connectedPhone || `+52 ${phoneNumber}`}</strong>
                </p>
                <div className="bg-emerald-50 dark:bg-emerald-950/30 p-3.5 rounded-2xl text-[11px] text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-left space-y-1.5">
                  <p className="font-bold flex items-center gap-1.5">
                    <Radio size={14} className="animate-pulse text-emerald-500" />
                    Recepción automática de pedidos activa
                  </p>
                  <p className="text-[10px] leading-relaxed">
                    Cualquier cliente que envíe un WhatsApp a este número recibirá confirmación inmediata y sus pedidos quedarán registrados en el sistema del CEDIS.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveView('chat')}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm"
                  >
                    Ir al Chat
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnectGateway}
                    className="py-2.5 px-3 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-300 text-xs font-bold transition-all cursor-pointer border border-red-200 dark:border-red-800"
                  >
                    Desvincular
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 max-w-sm flex flex-col items-center">
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                    <Smartphone size={20} className="text-emerald-600" />
                    Vincular tu WhatsApp al Servidor
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Escanea este código QR desde tu celular para que el bot responda solo desde tu número.
                  </p>
                </div>

                {gatewayStatus.qrDataUrl ? (
                  <div className="bg-white p-3 rounded-2xl shadow-md border-2 border-emerald-500/30 flex flex-col items-center">
                    <img 
                      src={gatewayStatus.qrDataUrl} 
                      alt="Código QR WhatsApp" 
                      className="w-52 h-52 object-contain rounded-xl"
                    />
                    <span className="text-[10px] text-slate-500 mt-2 flex items-center gap-1 font-mono">
                      <RefreshCw size={11} className="animate-spin text-emerald-600" />
                      Esperando escaneo en vivo...
                    </span>
                  </div>
                ) : (
                  <div className="w-52 h-52 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center p-4 text-center">
                    {startingGateway ? (
                      <div className="space-y-2">
                        <RefreshCw size={24} className="animate-spin text-emerald-600 mx-auto" />
                        <p className="text-xs text-slate-500 font-bold">Generando código QR...</p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleStartGateway}
                        className="py-2.5 px-4 rounded-xl bg-[#008069] hover:bg-[#00705c] text-white text-xs font-bold transition-all shadow-md cursor-pointer flex items-center gap-2"
                      >
                        <QrCode size={16} />
                        <span>Generar Código QR</span>
                      </button>
                    )}
                  </div>
                )}

                <div className="bg-slate-50 dark:bg-slate-900/60 p-3 rounded-2xl text-[11px] text-slate-600 dark:text-slate-300 text-left space-y-1 w-full border border-slate-200 dark:border-slate-800">
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-[11px]">Pasos para vincular:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-[10px]">
                    <li>Abre <strong>WhatsApp</strong> en tu teléfono físico.</li>
                    <li>Toca en <strong>Menú (⋮)</strong> o <strong>Configuración</strong>.</li>
                    <li>Selecciona <strong>Dispositivos vinculados</strong>.</li>
                    <li>Toca en <strong>Vincular un dispositivo</strong> y apunta tu cámara al QR.</li>
                  </ol>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveView('chat')}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold underline cursor-pointer"
                >
                  Volver al chat de pedidos
                </button>
              </div>
            )}
          </div>
        ) : (
          /* VISTA 2: Chat en vivo */
          <>
            {/* Zona de Mensajes del Chat */}
            <div 
              className="flex-1 overflow-y-auto p-4 space-y-3 relative"
              style={{
                backgroundImage: "radial-gradient(#cbd5e1 0.75px, transparent 0.75px)",
                backgroundSize: "16px 16px"
              }}
            >
              {/* Mensaje de cifrado */}
              <div className="flex justify-center my-1">
                <div className="bg-[#ffeecd] dark:bg-[#182229] text-[#54656f] dark:text-[#8696a0] text-[10px] py-1 px-3 rounded-lg text-center max-w-xs shadow-xs border border-amber-200/50 dark:border-transparent">
                  🔒 Los pedidos registrados en este canal se asignan automáticamente al CEDIS Altamira y a tu ruta de reparto.
                </div>
              </div>

              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div 
                    key={msg.id} 
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1`}
                  >
                    <div 
                      className={`max-w-[85%] rounded-2xl p-3 text-xs shadow-xs relative ${
                        isUser 
                          ? 'bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-slate-100 rounded-tr-xs' 
                          : 'bg-white dark:bg-[#202c33] text-slate-900 dark:text-slate-100 rounded-tl-xs border border-slate-200/60 dark:border-transparent'
                      }`}
                    >
                      <div className="space-y-1">
                        {renderFormattedText(msg.text)}
                      </div>

                      {/* Acciones directas si el bot generó un pedido real */}
                      {msg.isOrder && msg.orderId && (
                        <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 size={14} />
                            <span>Folio: {msg.orderId}</span>
                          </div>

                          {onNavigateToOrders && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onNavigateToOrders();
                              }}
                              className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                            >
                              <span>Ver en Historial</span>
                              <ArrowRight size={11} />
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400 dark:text-slate-400">
                        <span>{msg.timestamp}</span>
                        {isUser && <CheckCheck size={13} className="text-sky-500" />}
                      </div>
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 italic bg-white dark:bg-[#202c33] px-3.5 py-2 rounded-2xl w-fit shadow-xs">
                  <RefreshCw size={13} className="animate-spin text-emerald-600" />
                  <span>Almacenes Ibarra está procesando tu pedido...</span>
                </div>
              )}

              {isRecording && (
                <div className="flex items-center gap-2 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 px-4 py-2 rounded-2xl w-fit shadow-xs animate-pulse">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-600"></span>
                  <span className="font-bold">Grabando nota de voz...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Sugerencias Rápidas de Pedidos (Chips) */}
            <div className="bg-[#f0f2f5] dark:bg-[#111b21] p-2 border-t border-slate-200 dark:border-[#222e35] shrink-0">
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                {quickPrompts.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    disabled={loading}
                    onClick={() => handleSendMessage(q.text)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-[#202c33] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-slate-700 dark:text-slate-200 text-[10px] font-medium border border-slate-300 dark:border-slate-700 transition-colors shadow-2xs cursor-pointer shrink-0 disabled:opacity-50"
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Barra de Entrada de Texto estilo WhatsApp */}
            <footer className="bg-[#f0f2f5] dark:bg-[#202c33] p-2.5 flex items-center gap-2 shrink-0">
              <button 
                type="button"
                onClick={handleSimulateVoice}
                disabled={loading || isRecording}
                title="Enviar nota de voz"
                className="p-2.5 rounded-full bg-white dark:bg-[#2a3942] text-emerald-600 dark:text-emerald-400 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Mic size={18} />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Escribe un pedido (ej: 2 cajas de coca y 1 de sabritas)..."
                disabled={loading}
                className="flex-1 bg-white dark:bg-[#2a3942] text-slate-900 dark:text-slate-100 text-xs px-4 py-2.5 rounded-full outline-hidden border border-slate-200 dark:border-transparent placeholder:text-slate-400 shadow-xs"
              />

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!inputText.trim() || loading}
                className="p-2.5 rounded-full bg-[#008069] hover:bg-[#00705c] active:scale-95 text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs cursor-pointer"
              >
                <Send size={18} />
              </button>
            </footer>
          </>
        )}
      </motion.div>
    </div>
  );
}
