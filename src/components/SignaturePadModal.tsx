import React, { useRef, useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  RotateCcw,
  PenTool,
  ShieldCheck,
  Banknote,
  Landmark,
  CreditCard,
  AlertTriangle,
  PackageMinus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { PodData } from '../lib/services';

interface SignaturePadModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName: string;
  orderId?: string;
  orderTotal?: number;
  onConfirmDelivery: (
    signatureDataUrl: string,
    receiverName: string,
    notes: string,
    podDetails?: PodData
  ) => void;
}

export default function SignaturePadModal({
  isOpen,
  onClose,
  shopName,
  orderId = 'ORD-MX-ACTUAL',
  orderTotal = 1800,
  onConfirmDelivery,
}: SignaturePadModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [receiverName, setReceiverName] = useState('Encargado de Tienda');
  const [notes, setNotes] = useState('Mercancía recibida completa y en buen estado.');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Cobranza contra entrega
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer' | 'credit'>('cash');
  const [paymentReference, setPaymentReference] = useState('');

  // Logística inversa (Mermas / Devoluciones)
  const [hasReturn, setHasReturn] = useState(false);
  const [returnItemsCount, setReturnItemsCount] = useState(1);
  const [returnAmount, setReturnAmount] = useState(120);
  const [returnReason, setReturnReason] = useState('Empaque maltratado en traslado');

  // Set up canvas resolution
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      ctx.scale(ratio, ratio);
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setHasSignature(false);
    }, 50);
    return () => clearTimeout(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const effectiveReturnAmount = hasReturn ? Math.min(orderTotal, Math.max(0, Number(returnAmount) || 0)) : 0;
  const netAmountToCollect = Math.max(0, orderTotal - effectiveReturnAmount);

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasSignature(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas || !hasSignature) return;

    setIsSubmitting(true);
    const dataUrl = canvas.toDataURL('image/png');

    const podDetails: PodData = {
      signatureUrl: dataUrl,
      receiverName,
      deliveryNotes: notes,
      paymentMethod,
      amountCollected: netAmountToCollect,
      paymentReference: paymentMethod === 'transfer' ? paymentReference || 'SPEI-VERIFICADO' : undefined,
      returnItemsCount: hasReturn ? Number(returnItemsCount) || 1 : 0,
      returnAmount: effectiveReturnAmount,
      returnReason: hasReturn ? returnReason : undefined,
    };

    onConfirmDelivery(dataUrl, receiverName, notes, podDetails);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] isolate flex items-center justify-center p-3 bg-black/75 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="w-full max-w-md bg-surface-card rounded-3xl border border-border-subtle shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        >
          {/* Header */}
          <div className="p-4 border-b border-border-subtle flex justify-between items-center bg-bg-main/50 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-role-primary)]/10 text-[var(--color-role-primary)] flex items-center justify-center font-bold">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text-main">Entrega, Cobro y Firma (POD)</h3>
                <p className="text-[10px] text-text-muted">
                  Folio: {orderId} • {shopName}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl hover:bg-surface-hover text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 overflow-y-auto space-y-3.5 text-left">
            {/* 1. Liquidación y Método de Cobro */}
            <div className="p-3 rounded-2xl bg-bg-main border border-border-subtle space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
                  1. Modalidad de Cobro en Tienda
                </span>
                <span className="text-xs font-black text-[var(--color-role-primary)] font-mono">
                  Neto: ${netAmountToCollect.toFixed(2)} MXN
                </span>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                      : 'bg-surface-card border-border-subtle text-text-muted hover:text-text-main'
                  }`}
                >
                  <Banknote size={14} />
                  <span>Efectivo</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('transfer')}
                  className={`py-2 px-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'transfer'
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-surface-card border-border-subtle text-text-muted hover:text-text-main'
                  }`}
                >
                  <Landmark size={14} />
                  <span>SPEI / CoDi</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('credit')}
                  className={`py-2 px-2 rounded-xl border text-[10px] font-bold flex flex-col items-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === 'credit'
                      ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                      : 'bg-surface-card border-border-subtle text-text-muted hover:text-text-main'
                  }`}
                >
                  <CreditCard size={14} />
                  <span>Crédito VMI</span>
                </button>
              </div>

              {paymentMethod === 'transfer' && (
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="Clave de rastreo SPEI o últimos 4 dígitos"
                  className="w-full px-3 py-1.5 text-[11px] rounded-xl bg-surface-card border border-border-subtle text-text-main focus:outline-none focus:border-blue-500"
                />
              )}
            </div>

            {/* 2. Logística Inversa (Mermas / Devoluciones) */}
            <div className="p-3 rounded-2xl bg-bg-main border border-border-subtle space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
                  <PackageMinus size={13} className="text-orange-500" />
                  <span>2. Logística Inversa (Mermas / Rechazo)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setHasReturn(!hasReturn)}
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition-all cursor-pointer ${
                    hasReturn
                      ? 'bg-rose-500/15 text-rose-600 border-rose-500/30'
                      : 'bg-surface-card text-text-muted border-border-subtle'
                  }`}
                >
                  {hasReturn ? 'Con Devolución' : 'Sin Merma (0)'}
                </button>
              </div>

              {hasReturn && (
                <div className="pt-1.5 space-y-2 border-t border-border-subtle/60">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase block mb-0.5">
                        Piezas / Cajas Devueltas
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={returnItemsCount}
                        onChange={(e) => setReturnItemsCount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface-card border border-border-subtle text-text-main font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase block mb-0.5">
                        Descuento Remisión ($ MXN)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={orderTotal}
                        value={returnAmount}
                        onChange={(e) => setReturnAmount(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-surface-card border border-border-subtle text-rose-600 font-bold"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-text-muted uppercase block mb-0.5">
                      Causa de Merma / Devolución a CEDIS
                    </label>
                    <select
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-[11px] rounded-lg bg-surface-card border border-border-subtle text-text-main"
                    >
                      <option value="Empaque maltratado en traslado">Empaque maltratado en traslado</option>
                      <option value="Producto con caducidad próxima">Producto con caducidad próxima</option>
                      <option value="Envase roto o con fuga">Envase roto o con fuga</option>
                      <option value="Ajuste de pedido en tienda">Ajuste de pedido en tienda</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-rose-600 bg-rose-500/10 px-2.5 py-1.5 rounded-lg">
                    <AlertTriangle size={12} className="shrink-0" />
                    <span>
                      Se descontarán <strong>${effectiveReturnAmount.toFixed(2)}</strong> de la nota original (${orderTotal.toFixed(2)}).
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Datos de quien recibe */}
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">
                3. Nombre de quien recibe en tienda
              </label>
              <input
                type="text"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
                placeholder="Nombre del tendero o encargado"
                className="w-full px-3 py-2 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)]"
              />
            </div>

            {/* 4. Canvas de Firma */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-text-main uppercase flex items-center gap-1.5">
                  <PenTool size={12} className="text-[var(--color-role-primary)]" />
                  <span>4. Firma Digital del Receptor *</span>
                </label>
                <button
                  type="button"
                  onClick={handleClear}
                  className="text-[10px] text-danger hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                >
                  <RotateCcw size={11} /> Limpiar
                </button>
              </div>

              <div className="relative border-2 border-dashed border-border-subtle rounded-2xl bg-white overflow-hidden shadow-inner">
                <canvas
                  ref={canvasRef}
                  onPointerDown={startDrawing}
                  onPointerMove={draw}
                  onPointerUp={stopDrawing}
                  onPointerLeave={stopDrawing}
                  className="w-full h-32 cursor-crosshair touch-none"
                />
                {!hasSignature && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-gray-400">
                    <PenTool size={18} className="mb-1 opacity-40" />
                    <span className="text-[11px] font-medium">Firma aquí con el dedo o puntero</span>
                    <span className="text-[9px] text-gray-400">Almacenes Ibarra • Validación Biométrica POD</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase mb-1 block">
                Observaciones de Entrega
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full px-3 py-1.5 text-xs rounded-xl bg-bg-main border border-border-subtle text-text-main focus:outline-none focus:border-[var(--color-role-primary)] resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-3.5 border-t border-border-subtle bg-bg-main/50 flex gap-2 shrink-0">
            <button
              onClick={onClose}
              type="button"
              className="flex-1 py-2.5 text-xs font-bold rounded-xl border border-border-subtle text-text-muted hover:text-text-main transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!hasSignature || isSubmitting}
              type="button"
              className="flex-2 py-2.5 px-4 text-xs font-bold uppercase tracking-wider rounded-xl bg-[var(--color-role-primary)] text-[var(--color-text-light)] shadow-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>Confirmar (${netAmountToCollect.toFixed(0)})</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
