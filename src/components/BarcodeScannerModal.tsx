import React, { useRef, useState, useEffect } from 'react';
import { X, Camera, QrCode, CheckCircle2, AlertTriangle, Plus, RefreshCw, Zap, Volume2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Product } from '../lib/services';
import { cn } from '../lib/utils';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProductUpdated: () => void;
}

export default function BarcodeScannerModal({
  isOpen,
  onClose,
  onProductUpdated
}: BarcodeScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scannedCode, setScannedCode] = useState<string>('');
  const [matchedProduct, setMatchedProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [quantityToAdd, setQuantityToAdd] = useState(1);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Reproducir un pitido de confirmación con Web Audio API
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime); // Nota La 880Hz
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio fallback silencioso
    }
  };

  // Iniciar cámara
  const startCamera = async () => {
    setCameraError(null);
    try {
      const constraints: MediaStreamConstraints = {
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 } }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setCameraActive(true);

      // Si el navegador soporta BarcodeDetector nativo
      if ('BarcodeDetector' in window) {
        const barcodeDetector = new (window as any).BarcodeDetector({
          formats: ['qr_code', 'ean_13', 'ean_8', 'code_128', 'upc_a']
        });
        const interval = setInterval(async () => {
          if (!videoRef.current || !streamRef.current) {
            clearInterval(interval);
            return;
          }
          try {
            const barcodes = await barcodeDetector.detect(videoRef.current);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              handleCodeScanned(code);
              clearInterval(interval);
            }
          } catch {
            // Ignorar frames sin código
          }
        }, 600);
      }
    } catch (err: any) {
      console.warn("Camera stream notice:", err);
      setCameraError('No se pudo acceder a la cámara. Puedes usar los códigos de prueba rápidos o ingresar el SKU.');
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setMatchedProduct(null);
      setScannedCode('');
      setStatusMessage(null);
    }
    return () => stopCamera();
  }, [isOpen]);

  // Buscar producto al detectar código
  const handleCodeScanned = async (code: string) => {
    const clean = code.trim().toUpperCase();
    setScannedCode(clean);
    playBeep();
    setLoadingProduct(true);
    setStatusMessage(null);

    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .or(`sku.ilike.%${clean}%,name.ilike.%${clean}%,id.eq.${clean}`)
          .maybeSingle();

        if (!error && data) {
          setMatchedProduct({
            id: data.id,
            name: data.name,
            sku: data.sku,
            stock: data.stock,
            price: Number(data.price),
            imageUrl: data.image_url,
            category: data.category
          });
          setLoadingProduct(false);
          return;
        }
      }

      // Fallback local por SKU
      const mockItems: Product[] = [
        { id: 'inv-1', name: 'Coca-Cola 600ml', sku: 'CC-600-MX', stock: 4, price: 20 },
        { id: 'inv-2', name: 'Barcel Chips Jalapeño', sku: 'BC-JAL-120', stock: 15, price: 22 },
        { id: 'inv-3', name: 'Agua Ciel 1L', sku: 'CIEL-1L', stock: 42, price: 14 },
        { id: 'inv-4', name: 'Leche Alpura 1L', sku: 'ALP-1L', stock: 6, price: 26 },
      ];
      const found = mockItems.find(p => p.sku.toUpperCase().includes(clean) || p.name.toUpperCase().includes(clean));
      if (found) {
        setMatchedProduct(found);
      } else {
        setStatusMessage(`Producto con SKU ${clean} no encontrado en inventario.`);
      }
    } catch (err: any) {
      setStatusMessage('Error al consultar producto.');
    } finally {
      setLoadingProduct(false);
    }
  };

  // Actualizar stock en Supabase
  const handleUpdateStock = async () => {
    if (!matchedProduct) return;
    const newStock = matchedProduct.stock + quantityToAdd;

    if (isSupabaseConfigured) {
      try {
        await supabase
          .from('products')
          .update({ stock: newStock, updated_at: new Date().toISOString() })
          .eq('id', matchedProduct.id);
      } catch (e) {
        console.warn("Aviso al actualizar stock en Supabase:", e);
      }
    }

    setMatchedProduct(prev => prev ? { ...prev, stock: newStock } : null);
    setStatusMessage(`¡Stock actualizado! Nuevo total: ${newStock} unidades.`);
    playBeep();
    onProductUpdated();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-4 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-surface-card rounded-3xl border border-border-subtle shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-bg-main/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] flex items-center justify-center font-bold">
                <QrCode size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">Escáner de Inventario</h3>
                <p className="text-[10px] text-text-muted">Cámara en vivo • Código de Barras / QR</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-4">
            {/* Viewfinder de la Cámara */}
            <div className="relative w-full h-48 bg-black rounded-2xl overflow-hidden flex items-center justify-center border border-border-subtle shadow-inner">
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
              />
              {cameraActive ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  {/* Marco de enfoque con láser animado */}
                  <div className="w-48 h-28 border-2 border-[var(--color-role-primary)] rounded-xl relative shadow-lg">
                    <div className="absolute inset-x-0 h-0.5 bg-danger shadow-[0_0_8px_#ef4444] animate-pulse top-1/2 -translate-y-1/2" />
                    <span className="absolute -bottom-5 inset-x-0 text-center text-[9px] font-bold text-white bg-black/60 py-0.5 rounded">
                      Centra el código de barras
                    </span>
                  </div>
                </div>
              ) : (
                <div className="text-center p-4 text-text-muted">
                  <Camera size={28} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">{cameraError || 'Iniciando cámara...'}</p>
                </div>
              )}
            </div>

            {/* Accesos rápidos de prueba de códigos de barras reales */}
            <div>
              <p className="text-[10px] font-bold text-text-muted uppercase mb-1.5 flex items-center gap-1">
                <Zap size={11} className="text-amber-500" />
                <span>Simular lectura de producto de tienda:</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Coca-Cola 600ml', code: 'CC-600-MX' },
                  { label: 'Chips Jalapeño', code: 'BC-JAL-120' },
                  { label: 'Agua Ciel 1L', code: 'CIEL-1L' },
                  { label: 'Leche Alpura', code: 'ALP-1L' },
                ].map((item) => (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => handleCodeScanned(item.code)}
                    className="px-2.5 py-1 text-[10px] font-semibold rounded-lg bg-bg-main border border-border-subtle hover:border-[var(--color-role-primary)] text-text-main transition-colors cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* O Búsqueda manual de SKU */}
            <div className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                placeholder="O escribe el SKU / Código"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl bg-bg-main border border-border-subtle text-text-main uppercase focus:outline-none focus:border-[var(--color-role-primary)]"
              />
              <button
                type="button"
                onClick={() => handleCodeScanned(manualCode)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-surface-hover border border-border-subtle hover:bg-[var(--color-role-primary)] hover:text-white transition-colors cursor-pointer"
              >
                Buscar
              </button>
            </div>

            {/* Tarjeta del Producto Encontrado */}
            {loadingProduct && (
              <div className="p-4 text-center text-xs text-text-muted flex items-center justify-center gap-2">
                <RefreshCw size={14} className="animate-spin text-[var(--color-role-primary)]" />
                <span>Buscando en Supabase...</span>
              </div>
            )}

            {matchedProduct && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-surface-card border-2 border-[var(--color-role-primary)]/40 soft-shadow space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] uppercase">
                      Detectado: {matchedProduct.sku}
                    </span>
                    <h4 className="text-sm font-bold text-text-main mt-1">{matchedProduct.name}</h4>
                    <p className="text-[11px] text-text-muted">Stock actual: <strong className="text-text-main">{matchedProduct.stock} piezas</strong></p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-extrabold text-[var(--color-role-primary)]">
                      ${matchedProduct.price ? matchedProduct.price.toFixed(2) : '0.00'}
                    </span>
                  </div>
                </div>

                {/* Control para reabastecer */}
                <div className="flex items-center gap-2 pt-2 border-t border-border-subtle">
                  <span className="text-[11px] font-bold text-text-muted">Agregar:</span>
                  <div className="flex gap-1">
                    {[1, 5, 10, 24].map((qty) => (
                      <button
                        key={qty}
                        type="button"
                        onClick={() => setQuantityToAdd(qty)}
                        className={cn(
                          "px-2.5 py-1 text-[10px] font-bold rounded-lg transition-all",
                          quantityToAdd === qty 
                            ? "bg-[var(--color-role-primary)] text-white shadow-sm"
                            : "bg-bg-main border border-border-subtle text-text-muted"
                        )}
                      >
                        +{qty}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleUpdateStock}
                    className="ml-auto px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg bg-[var(--color-role-primary)] text-[var(--color-text-light)] shadow hover:brightness-110 active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>Sumar Stock</span>
                  </button>
                </div>
              </motion.div>
            )}

            {statusMessage && (
              <p className="text-xs text-center font-medium text-emerald-600 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
                {statusMessage}
              </p>
            )}
          </div>

          <div className="p-3 border-t border-border-subtle bg-bg-main/50 text-center">
            <button
              onClick={onClose}
              type="button"
              className="px-6 py-2 text-xs font-bold rounded-xl bg-surface-card border border-border-subtle text-text-main hover:bg-surface-hover transition-colors"
            >
              Cerrar Escáner
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
